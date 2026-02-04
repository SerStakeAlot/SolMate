/*
 * Native MWA Bridge - Provides JavaScript interface for Mobile Wallet Adapter
 * This allows the web app to use native Android MWA instead of WebSocket-based MWA
 * 
 * Uses mobile-wallet-adapter-clientlib-ktx 2.0.3
 */
package `fun`.playsolmate.app

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.ConnectionIdentity
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.Solana
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.lang.ref.WeakReference

class NativeMwaBridge(
    activity: ComponentActivity,
    private val webView: WebView
) {
    private val TAG = "NativeMwaBridge"
    private val activityRef = WeakReference(activity)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    
    // Stored authorization data
    @Volatile private var publicKeyBytes: ByteArray? = null
    @Volatile private var accountLabel: String? = null
    @Volatile private var isConnecting = false

    companion object {
        const val JS_INTERFACE_NAME = "NativeMwa"
    }

    /**
     * Check if native MWA is available
     */
    @JavascriptInterface
    fun isAvailable(): Boolean {
        Log.d(TAG, "isAvailable() called - returning true")
        return true
    }

    /**
     * Get connection status
     */
    @JavascriptInterface
    fun getConnectionStatus(): String {
        val connected = publicKeyBytes != null
        val pubKey = publicKeyBytes?.let { base58Encode(it) }
        Log.d(TAG, "getConnectionStatus() - connected=$connected, pubKey=$pubKey")
        return JSONObject().apply {
            put("connected", connected)
            put("publicKey", pubKey)
            put("accountLabel", accountLabel)
        }.toString()
    }

    /**
     * Connect to wallet - ASYNC version
     * This starts the connection and immediately returns.
     * Result will be delivered via JavaScript callback.
     */
    @JavascriptInterface
    fun connectAsync(cluster: String, appName: String, appUri: String, appIcon: String) {
        Log.d(TAG, "connectAsync() called - cluster=$cluster, app=$appName")
        
        if (isConnecting) {
            Log.w(TAG, "Already connecting, ignoring duplicate request")
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
        
        // Run connection on main thread with coroutine
        mainHandler.post {
            coroutineScope.launch {
                var result: String
                try {
                    Log.d(TAG, "Creating ActivityResultSender...")
                    val sender = ActivityResultSender(activity)
                    
                    val identityUri = Uri.parse(appUri)
                    val iconUri = Uri.parse(appIcon)
                    
                    Log.d(TAG, "Creating ConnectionIdentity: uri=$identityUri, icon=$iconUri, name=$appName")
                    val connectionIdentity = ConnectionIdentity(
                        identityUri = identityUri,
                        iconUri = iconUri,
                        identityName = appName
                    )
                    
                    val mwa = MobileWalletAdapter(connectionIdentity = connectionIdentity)
                    
                    mwa.blockchain = when (cluster) {
                        "devnet" -> Solana.Devnet
                        "testnet" -> Solana.Testnet
                        else -> Solana.Mainnet
                    }
                    
                    Log.d(TAG, "Calling mwa.connect() with blockchain=${mwa.blockchain}...")
                    
                    val connectResult = mwa.connect(sender)
                    
                    Log.d(TAG, "mwa.connect() returned: $connectResult")
                    
                    result = when (connectResult) {
                        is TransactionResult.Success -> {
                            val authResult = connectResult.authResult
                            Log.d(TAG, "TransactionResult.Success - authResult=$authResult")
                            
                            if (authResult != null && authResult.accounts.isNotEmpty()) {
                                val account = authResult.accounts.first()
                                publicKeyBytes = account.publicKey
                                accountLabel = account.accountLabel
                                
                                val pubKeyBase58 = base58Encode(account.publicKey)
                                
                                Log.d(TAG, "Authorization successful! PublicKey: $pubKeyBase58, Label: ${account.accountLabel}")
                                
                                JSONObject().apply {
                                    put("success", true)
                                    put("publicKey", pubKeyBase58)
                                    put("publicKeyBase64", Base64.encodeToString(account.publicKey, Base64.NO_WRAP))
                                    put("accountLabel", account.accountLabel ?: "Unknown")
                                }.toString()
                            } else {
                                Log.e(TAG, "Success but no accounts returned")
                                errorJson("No accounts returned from wallet")
                            }
                        }
                        is TransactionResult.NoWalletFound -> {
                            Log.e(TAG, "No wallet found!")
                            errorJson("No MWA-compatible wallet found. Please ensure Seed Vault is enabled in your settings.")
                        }
                        is TransactionResult.Failure -> {
                            Log.e(TAG, "Authorization failed: ${connectResult.message}")
                            errorJson("Authorization failed: ${connectResult.message}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Connection error", e)
                    result = errorJson("Connection error: ${e.message}")
                } finally {
                    isConnecting = false
                }
                
                Log.d(TAG, "Sending result to JS: $result")
                sendResultToJS("onNativeMwaConnectResult", result)
            }
        }
    }
    
    /**
     * Old synchronous connect - kept for compatibility but now calls async version
     */
    @JavascriptInterface
    fun connect(cluster: String, appName: String, appUri: String, appIcon: String): String {
        Log.d(TAG, "connect() (sync) called - redirecting to connectAsync")
        connectAsync(cluster, appName, appUri, appIcon)
        // Return immediately - actual result will come via callback
        return JSONObject().apply {
            put("success", false)
            put("pending", true)
            put("message", "Connection started, result will be delivered via callback")
        }.toString()
    }

    /**
     * Disconnect from wallet
     */
    @JavascriptInterface
    fun disconnect(): String {
        Log.d(TAG, "disconnect() called")
        publicKeyBytes = null
        accountLabel = null
        return JSONObject().apply {
            put("success", true)
        }.toString()
    }

    /**
     * Sign a transaction (async) - placeholder for future implementation
     */
    @JavascriptInterface
    fun signTransactionAsync(transactionBase64: String) {
        Log.d(TAG, "signTransactionAsync() called - not yet implemented")
        sendResultToJS("onNativeMwaSignResult", errorJson("Sign transaction not yet implemented - use connect first"))
    }
    
    /**
     * Old sync version - now uses async
     */
    @JavascriptInterface
    fun signTransaction(transactionBase64: String): String {
        signTransactionAsync(transactionBase64)
        return JSONObject().apply {
            put("pending", true)
        }.toString()
    }

    /**
     * Sign and send a transaction (async) - placeholder for future implementation
     */
    @JavascriptInterface
    fun signAndSendTransactionAsync(transactionBase64: String) {
        Log.d(TAG, "signAndSendTransactionAsync() called - not yet implemented")
        sendResultToJS("onNativeMwaSendResult", errorJson("Sign and send not yet implemented - use connect first"))
    }
    
    /**
     * Old sync version
     */
    @JavascriptInterface
    fun signAndSendTransaction(transactionBase64: String): String {
        signAndSendTransactionAsync(transactionBase64)
        return JSONObject().apply {
            put("pending", true)
        }.toString()
    }

    // Helper to send result back to JavaScript
    private fun sendResultToJS(callback: String, result: String) {
        val escapedResult = result.replace("\\", "\\\\").replace("'", "\\'")
        val js = "if(window.$callback){window.$callback('$escapedResult');}else{console.log('No callback: $callback', '$escapedResult');}"
        
        mainHandler.post {
            Log.d(TAG, "Executing JS: $js")
            webView.evaluateJavascript(js, null)
        }
    }

    // Helper to create error JSON
    private fun errorJson(message: String): String {
        return JSONObject().apply {
            put("success", false)
            put("error", message)
        }.toString()
    }

    // Base58 encoding for Solana public keys
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

        // Add leading zeros
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
