/*
 * Native MWA Bridge - Direct Local Association Implementation
 * 
 * This implements MWA using LocalAssociationScenario directly,
 * which is the same approach used by native Android dApps.
 */
package `fun`.playsolmate.app

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import com.solana.mobilewalletadapter.clientlib.protocol.MobileWalletAdapterClient
import com.solana.mobilewalletadapter.clientlib.scenario.LocalAssociationIntentCreator
import com.solana.mobilewalletadapter.clientlib.scenario.LocalAssociationScenario
import com.solana.mobilewalletadapter.clientlib.scenario.Scenario
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

class NativeMwaBridge(
    activity: ComponentActivity,
    private val webView: WebView
) {
    private val TAG = "NativeMwaBridge"
    private val activityRef = WeakReference(activity)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val coroutineScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    // Stored authorization data
    @Volatile private var publicKeyBytes: ByteArray? = null
    @Volatile private var accountLabel: String? = null
    @Volatile private var authToken: String? = null
    @Volatile private var isConnecting = false
    
    // Activity result launcher for MWA
    private var mwaResultLauncher: ActivityResultLauncher<Intent>? = null
    private var pendingScenario: LocalAssociationScenario? = null

    companion object {
        const val JS_INTERFACE_NAME = "NativeMwa"
        private const val LOCAL_ASSOCIATION_START_TIMEOUT_MS = 60000L
        private const val LOCAL_ASSOCIATION_CLOSE_TIMEOUT_MS = 5000L
    }
    
    init {
        // Register activity result launcher on the main thread
        mainHandler.post {
            try {
                val act = activityRef.get()
                if (act != null) {
                    mwaResultLauncher = act.registerForActivityResult(
                        ActivityResultContracts.StartActivityForResult()
                    ) { result ->
                        Log.d(TAG, "Activity result: ${result.resultCode}")
                        if (result.resultCode == Activity.RESULT_CANCELED) {
                            Log.d(TAG, "User cancelled wallet selection")
                            // The scenario will handle the timeout
                        }
                    }
                    Log.d(TAG, "Activity result launcher registered")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register activity result launcher", e)
            }
        }
    }

    @JavascriptInterface
    fun isAvailable(): Boolean {
        Log.d(TAG, "isAvailable() called")
        return true
    }

    @JavascriptInterface
    fun getAvailableWallets(): String {
        Log.d(TAG, "getAvailableWallets() called")
        val activity = activityRef.get() ?: return errorJson("Activity not available")
        
        val pm = activity.packageManager
        val wallets = JSONArray()
        
        // Check if any wallet endpoint is available
        val isAvailable = LocalAssociationIntentCreator.isWalletEndpointAvailable(pm)
        Log.d(TAG, "isWalletEndpointAvailable: $isAvailable")
        
        // Check for solana-wallet scheme handlers
        val testUri = Uri.parse("solana-wallet:/v1/associate/local")
        val intent = Intent(Intent.ACTION_VIEW, testUri).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
        }
        val handlers = pm.queryIntentActivities(intent, 0)
        Log.d(TAG, "Found ${handlers.size} handlers for solana-wallet:// scheme")
        
        for (handler in handlers) {
            val pkg = handler.activityInfo.packageName
            val name = handler.activityInfo.name
            Log.d(TAG, "  Handler: $pkg / $name")
            wallets.put(JSONObject().apply {
                put("package", pkg)
                put("activity", name)
            })
        }
        
        return JSONObject().apply {
            put("wallets", wallets)
            put("isWalletEndpointAvailable", isAvailable)
            put("handlerCount", handlers.size)
        }.toString()
    }

    @JavascriptInterface
    fun getConnectionStatus(): String {
        val connected = publicKeyBytes != null
        val pubKey = publicKeyBytes?.let { base58Encode(it) }
        Log.d(TAG, "getConnectionStatus() - connected=$connected")
        return JSONObject().apply {
            put("connected", connected)
            put("publicKey", pubKey)
            put("accountLabel", accountLabel)
        }.toString()
    }

    @JavascriptInterface
    fun connectAsync(cluster: String, appName: String, appUri: String, appIconUri: String) {
        Log.d(TAG, "connectAsync() called - cluster=$cluster, app=$appName, uri=$appUri")
        
        if (isConnecting) {
            Log.w(TAG, "Already connecting")
            sendResultToJS("onNativeMwaConnectResult", errorJson("Already connecting"))
            return
        }
        
        val activity = activityRef.get() as? ComponentActivity
        if (activity == null) {
            Log.e(TAG, "Activity not available")
            sendResultToJS("onNativeMwaConnectResult", errorJson("Activity not available"))
            return
        }

        isConnecting = true
        
        coroutineScope.launch(Dispatchers.IO) {
            var result: String
            var localAssociation: LocalAssociationScenario? = null
            
            try {
                Log.d(TAG, "Creating LocalAssociationScenario...")
                localAssociation = LocalAssociationScenario(Scenario.DEFAULT_CLIENT_TIMEOUT_MS)
                pendingScenario = localAssociation
                
                val port = localAssociation.port
                Log.d(TAG, "LocalAssociationScenario created on port $port")
                
                // Create the association intent
                val associationIntent = LocalAssociationIntentCreator.createAssociationIntent(
                    null, // No URI prefix
                    port,
                    localAssociation.session
                )
                
                Log.d(TAG, "Association Intent created: ${associationIntent.data}")
                
                // Launch the intent on main thread
                withContext(Dispatchers.Main) {
                    try {
                        Log.d(TAG, "Launching wallet intent...")
                        activity.startActivity(associationIntent)
                        Log.d(TAG, "Wallet intent launched successfully")
                    } catch (e: ActivityNotFoundException) {
                        Log.e(TAG, "No wallet app found to handle intent", e)
                        throw Exception("No MWA wallet found. Please install Phantom, Solflare, or enable Seed Vault.")
                    }
                }
                
                // Start the local association and wait for connection
                Log.d(TAG, "Starting local association (waiting for wallet to connect)...")
                val mwaClient: MobileWalletAdapterClient
                try {
                    mwaClient = localAssociation.start()
                        .get(LOCAL_ASSOCIATION_START_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                    Log.d(TAG, "MWA client connected!")
                } catch (e: TimeoutException) {
                    Log.e(TAG, "Timeout waiting for wallet connection", e)
                    throw Exception("Timeout: Wallet did not connect. Make sure Seed Vault is enabled and try again.")
                } catch (e: ExecutionException) {
                    Log.e(TAG, "Failed to establish connection", e)
                    throw Exception("Connection failed: ${e.cause?.message ?: e.message}")
                }
                
                // Now authorize
                Log.d(TAG, "Authorizing with wallet...")
                val identityUri = Uri.parse(appUri)
                val iconUri = Uri.parse(appIconUri)
                
                val chainId = when (cluster) {
                    "devnet" -> "solana:devnet"
                    "testnet" -> "solana:testnet"
                    else -> "solana:mainnet"
                }
                
                // authorize() returns AuthorizationFuture, need to call .get()
                val authFuture = mwaClient.authorize(
                    identityUri,
                    iconUri,
                    appName,
                    chainId,
                    null, // authToken for reauth
                    null, // features (String[])
                    null, // addresses (byte[][])
                    null  // signInPayload
                )
                
                // Get the actual result (blocking call)
                val authResult = authFuture.get(LOCAL_ASSOCIATION_START_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                
                Log.d(TAG, "Authorization result received")
                
                if (authResult != null && authResult.accounts.isNotEmpty()) {
                    val account = authResult.accounts.first()
                    publicKeyBytes = account.publicKey
                    accountLabel = account.accountLabel
                    authToken = authResult.authToken
                    
                    val pubKeyBase58 = base58Encode(account.publicKey)
                    Log.d(TAG, "Authorized! PublicKey: $pubKeyBase58, Label: ${account.accountLabel}")
                    
                    result = JSONObject().apply {
                        put("success", true)
                        put("publicKey", pubKeyBase58)
                        put("publicKeyBase64", Base64.encodeToString(account.publicKey, Base64.NO_WRAP))
                        put("accountLabel", account.accountLabel ?: "Unknown")
                        put("walletUri", authResult.walletUriBase?.toString())
                    }.toString()
                } else {
                    result = errorJson("No accounts returned from wallet")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Connection error", e)
                result = errorJson(e.message ?: "Unknown error")
            } finally {
                isConnecting = false
                pendingScenario = null
                
                // Close the scenario
                try {
                    localAssociation?.close()?.get(LOCAL_ASSOCIATION_CLOSE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                } catch (e: Exception) {
                    Log.w(TAG, "Error closing scenario", e)
                }
            }
            
            Log.d(TAG, "Sending result to JS: $result")
            sendResultToJS("onNativeMwaConnectResult", result)
        }
    }

    @JavascriptInterface
    fun connect(cluster: String, appName: String, appUri: String, appIcon: String): String {
        connectAsync(cluster, appName, appUri, appIcon)
        return JSONObject().apply {
            put("pending", true)
            put("message", "Connection started, result via callback")
        }.toString()
    }

    @JavascriptInterface
    fun disconnect(): String {
        Log.d(TAG, "disconnect() called")
        publicKeyBytes = null
        accountLabel = null
        authToken = null
        return JSONObject().apply {
            put("success", true)
        }.toString()
    }

    @JavascriptInterface
    fun signTransactionAsync(transactionBase64: String) {
        sendResultToJS("onNativeMwaSignResult", errorJson("Not implemented yet - connect first"))
    }

    @JavascriptInterface
    fun signTransaction(transactionBase64: String): String {
        signTransactionAsync(transactionBase64)
        return JSONObject().apply { put("pending", true) }.toString()
    }

    @JavascriptInterface
    fun signAndSendTransactionAsync(transactionBase64: String) {
        sendResultToJS("onNativeMwaSendResult", errorJson("Not implemented yet - connect first"))
    }

    @JavascriptInterface
    fun signAndSendTransaction(transactionBase64: String): String {
        signAndSendTransactionAsync(transactionBase64)
        return JSONObject().apply { put("pending", true) }.toString()
    }

    private fun sendResultToJS(callback: String, result: String) {
        val escapedResult = result
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
        
        val js = """
            (function() {
                console.log('[NativeMwa] Callback: $callback');
                if (window.$callback) {
                    window.$callback('$escapedResult');
                } else {
                    console.log('[NativeMwa] No callback registered: $callback');
                    console.log('[NativeMwa] Result: $escapedResult');
                }
            })();
        """.trimIndent()
        
        mainHandler.post {
            Log.d(TAG, "Executing JS callback: $callback")
            webView.evaluateJavascript(js, null)
        }
    }

    private fun errorJson(message: String): String {
        return JSONObject().apply {
            put("success", false)
            put("error", message)
        }.toString()
    }

    private fun base58Encode(bytes: ByteArray): String {
        val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        val result = StringBuilder()
        var num = java.math.BigInteger(1, bytes)
        val base = java.math.BigInteger.valueOf(58)
        val zero = java.math.BigInteger.ZERO

        while (num > zero) {
            val (quotient, remainder) = num.divideAndRemainder(base)
            result.insert(0, ALPHABET[remainder.toInt()])
            num = quotient
        }

        for (byte in bytes) {
            if (byte.toInt() == 0) {
                result.insert(0, '1')
            } else {
                break
            }
        }

        return result.toString()
    }
}
