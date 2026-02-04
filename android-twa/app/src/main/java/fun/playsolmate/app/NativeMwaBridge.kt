/*
 * Native MWA Bridge - Provides JavaScript interface for Mobile Wallet Adapter
 * This allows the web app to use native Android MWA instead of WebSocket-based MWA
 */
package `fun`.playsolmate.app

import android.app.Activity
import android.net.Uri
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import com.solana.mobilewalletadapter.common.ProtocolContract
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference

class NativeMwaBridge(
    activity: Activity,
    private val webView: WebView
) {
    private val TAG = "NativeMwaBridge"
    private val activityRef = WeakReference(activity)
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    
    // Stored authorization data
    private var authToken: ByteArray? = null
    private var publicKey: ByteArray? = null
    private var walletUri: Uri? = null

    companion object {
        const val JS_INTERFACE_NAME = "NativeMwa"
    }

    /**
     * Check if native MWA is available
     */
    @JavascriptInterface
    fun isAvailable(): Boolean {
        return true // On Android with this bridge, native MWA is available
    }

    /**
     * Connect to wallet and authorize
     * Returns JSON with publicKey or error
     */
    @JavascriptInterface
    fun connect(cluster: String, appName: String, appUri: String, appIcon: String): String {
        Log.d(TAG, "connect() called - cluster=$cluster, app=$appName")
        
        val activity = activityRef.get()
        if (activity == null) {
            return errorJson("Activity not available")
        }

        // This needs to be synchronous for JS, so we use a blocking approach
        var result: String = ""
        val latch = java.util.concurrent.CountDownLatch(1)

        activity.runOnUiThread {
            coroutineScope.launch {
                try {
                    val sender = ActivityResultSender(activity)
                    
                    val mwa = MobileWalletAdapter()
                    
                    val authResult = mwa.authorize(
                        sender,
                        MobileWalletAdapter.LocalAssociationIntentCreator,
                        Uri.parse(appUri),
                        Uri.parse(appIcon),
                        appName,
                        getClusterRpcUri(cluster)
                    )
                    
                    when (authResult) {
                        is TransactionResult.Success -> {
                            val auth = authResult.payload
                            authToken = auth.authToken
                            publicKey = auth.publicKey
                            walletUri = auth.walletUriBase
                            
                            val pubKeyBase64 = Base64.encodeToString(auth.publicKey, Base64.NO_WRAP)
                            val pubKeyBase58 = base58Encode(auth.publicKey)
                            
                            Log.d(TAG, "Authorization successful! PublicKey: $pubKeyBase58")
                            
                            result = JSONObject().apply {
                                put("success", true)
                                put("publicKey", pubKeyBase58)
                                put("publicKeyBase64", pubKeyBase64)
                                put("walletName", auth.walletUriBase?.toString() ?: "Unknown Wallet")
                            }.toString()
                        }
                        is TransactionResult.Failure -> {
                            Log.e(TAG, "Authorization failed: ${authResult.message}")
                            result = errorJson("Authorization failed: ${authResult.message}")
                        }
                        is TransactionResult.NoWalletFound -> {
                            Log.e(TAG, "No wallet found")
                            result = errorJson("No MWA-compatible wallet found")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "connect() error", e)
                    result = errorJson("Error: ${e.message}")
                }
                latch.countDown()
            }
        }

        // Wait for result (with timeout)
        try {
            latch.await(60, java.util.concurrent.TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            return errorJson("Connection timeout")
        }

        return result
    }

    /**
     * Sign a transaction
     * @param transactionBase64 - base64 encoded transaction bytes
     * @return JSON with signed transaction or error
     */
    @JavascriptInterface
    fun signTransaction(transactionBase64: String): String {
        Log.d(TAG, "signTransaction() called")
        
        val activity = activityRef.get()
        if (activity == null) {
            return errorJson("Activity not available")
        }
        
        if (authToken == null) {
            return errorJson("Not connected - call connect() first")
        }

        var result: String = ""
        val latch = java.util.concurrent.CountDownLatch(1)

        activity.runOnUiThread {
            coroutineScope.launch {
                try {
                    val transactionBytes = Base64.decode(transactionBase64, Base64.DEFAULT)
                    val sender = ActivityResultSender(activity)
                    val mwa = MobileWalletAdapter()
                    
                    val signResult = mwa.signTransactions(
                        sender,
                        MobileWalletAdapter.LocalAssociationIntentCreator,
                        arrayOf(transactionBytes)
                    )
                    
                    when (signResult) {
                        is TransactionResult.Success -> {
                            val signedTxs = signResult.payload
                            if (signedTxs.isNotEmpty()) {
                                val signedBase64 = Base64.encodeToString(signedTxs[0], Base64.NO_WRAP)
                                result = JSONObject().apply {
                                    put("success", true)
                                    put("signedTransaction", signedBase64)
                                }.toString()
                            } else {
                                result = errorJson("No signed transaction returned")
                            }
                        }
                        is TransactionResult.Failure -> {
                            result = errorJson("Sign failed: ${signResult.message}")
                        }
                        is TransactionResult.NoWalletFound -> {
                            result = errorJson("No wallet found")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "signTransaction() error", e)
                    result = errorJson("Sign error: ${e.message}")
                }
                latch.countDown()
            }
        }

        try {
            latch.await(120, java.util.concurrent.TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            return errorJson("Sign timeout")
        }

        return result
    }

    /**
     * Sign and send a transaction
     */
    @JavascriptInterface
    fun signAndSendTransaction(transactionBase64: String): String {
        Log.d(TAG, "signAndSendTransaction() called")
        
        val activity = activityRef.get()
        if (activity == null) {
            return errorJson("Activity not available")
        }
        
        if (authToken == null) {
            return errorJson("Not connected - call connect() first")
        }

        var result: String = ""
        val latch = java.util.concurrent.CountDownLatch(1)

        activity.runOnUiThread {
            coroutineScope.launch {
                try {
                    val transactionBytes = Base64.decode(transactionBase64, Base64.DEFAULT)
                    val sender = ActivityResultSender(activity)
                    val mwa = MobileWalletAdapter()
                    
                    val sendResult = mwa.signAndSendTransactions(
                        sender,
                        MobileWalletAdapter.LocalAssociationIntentCreator,
                        arrayOf(transactionBytes)
                    )
                    
                    when (sendResult) {
                        is TransactionResult.Success -> {
                            val signatures = sendResult.payload
                            if (signatures.isNotEmpty()) {
                                val sigBase64 = Base64.encodeToString(signatures[0], Base64.NO_WRAP)
                                result = JSONObject().apply {
                                    put("success", true)
                                    put("signature", sigBase64)
                                }.toString()
                            } else {
                                result = errorJson("No signature returned")
                            }
                        }
                        is TransactionResult.Failure -> {
                            result = errorJson("Send failed: ${sendResult.message}")
                        }
                        is TransactionResult.NoWalletFound -> {
                            result = errorJson("No wallet found")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "signAndSendTransaction() error", e)
                    result = errorJson("Send error: ${e.message}")
                }
                latch.countDown()
            }
        }

        try {
            latch.await(120, java.util.concurrent.TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            return errorJson("Send timeout")
        }

        return result
    }

    /**
     * Disconnect from wallet
     */
    @JavascriptInterface
    fun disconnect(): String {
        Log.d(TAG, "disconnect() called")
        authToken = null
        publicKey = null
        walletUri = null
        return JSONObject().apply {
            put("success", true)
        }.toString()
    }

    /**
     * Get current connection status
     */
    @JavascriptInterface
    fun getConnectionStatus(): String {
        val connected = authToken != null && publicKey != null
        return JSONObject().apply {
            put("connected", connected)
            if (connected) {
                put("publicKey", publicKey?.let { base58Encode(it) })
            }
        }.toString()
    }

    private fun errorJson(message: String): String {
        return JSONObject().apply {
            put("success", false)
            put("error", message)
        }.toString()
    }

    private fun getClusterRpcUri(cluster: String): Uri {
        return when (cluster.lowercase()) {
            "mainnet-beta", "mainnet" -> Uri.parse("https://api.mainnet-beta.solana.com")
            "devnet" -> Uri.parse("https://api.devnet.solana.com")
            "testnet" -> Uri.parse("https://api.testnet.solana.com")
            else -> Uri.parse("https://api.mainnet-beta.solana.com")
        }
    }

    // Base58 encoding for Solana public keys
    private fun base58Encode(input: ByteArray): String {
        val alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        var bi = java.math.BigInteger(1, input)
        val sb = StringBuilder()
        while (bi >= java.math.BigInteger.valueOf(58)) {
            val mod = bi.mod(java.math.BigInteger.valueOf(58))
            sb.insert(0, alphabet[mod.toInt()])
            bi = bi.subtract(mod).divide(java.math.BigInteger.valueOf(58))
        }
        sb.insert(0, alphabet[bi.toInt()])
        // Handle leading zeros
        for (b in input) {
            if (b.toInt() == 0) {
                sb.insert(0, '1')
            } else {
                break
            }
        }
        return sb.toString()
    }
}
