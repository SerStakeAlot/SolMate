/*
 * Native MWA Bridge - Provides JavaScript interface for Mobile Wallet Adapter
 * This allows the web app to use native Android MWA instead of WebSocket-based MWA
 * 
 * Uses mobile-wallet-adapter-clientlib-ktx 2.0.3
 */
package `fun`.playsolmate.app

import android.net.Uri
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
import com.solana.mobilewalletadapter.clientlib.successPayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class NativeMwaBridge(
    activity: ComponentActivity,
    private val webView: WebView
) {
    private val TAG = "NativeMwaBridge"
    private val activityRef = WeakReference(activity)
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    
    // Stored authorization data
    private var publicKeyBytes: ByteArray? = null
    private var accountLabel: String? = null

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
     * Get connection status
     */
    @JavascriptInterface
    fun getConnectionStatus(): String {
        return JSONObject().apply {
            put("connected", publicKeyBytes != null)
            put("publicKey", publicKeyBytes?.let { base58Encode(it) })
            put("accountLabel", accountLabel)
        }.toString()
    }

    /**
     * Connect to wallet and authorize
     * Returns JSON with publicKey or error
     */
    @JavascriptInterface
    fun connect(cluster: String, appName: String, appUri: String, appIcon: String): String {
        Log.d(TAG, "connect() called - cluster=$cluster, app=$appName")
        
        val activity = activityRef.get() as? ComponentActivity
        if (activity == null) {
            return errorJson("Activity not available")
        }

        var result = ""
        val latch = CountDownLatch(1)

        activity.runOnUiThread {
            coroutineScope.launch {
                try {
                    val sender = ActivityResultSender(activity)
                    
                    val identityUri = Uri.parse(appUri)
                    val iconUri = Uri.parse(appIcon)
                    
                    // Create connection identity
                    val connectionIdentity = ConnectionIdentity(
                        identityUri = identityUri,
                        iconUri = iconUri,
                        identityName = appName
                    )
                    
                    // Create MWA instance with connection identity
                    val mwa = MobileWalletAdapter(connectionIdentity = connectionIdentity)
                    
                    // Set blockchain/cluster
                    mwa.blockchain = when (cluster) {
                        "devnet" -> Solana.Devnet
                        "testnet" -> Solana.Testnet
                        else -> Solana.Mainnet
                    }
                    
                    Log.d(TAG, "Calling mwa.connect()...")
                    
                    val connectResult = mwa.connect(sender)
                    
                    when (connectResult) {
                        is TransactionResult.Success -> {
                            val authResult = connectResult.authResult
                            if (authResult != null && authResult.accounts.isNotEmpty()) {
                                val account = authResult.accounts.first()
                                publicKeyBytes = account.publicKey
                                accountLabel = account.accountLabel
                                
                                val pubKeyBase58 = base58Encode(account.publicKey)
                                
                                Log.d(TAG, "Authorization successful! PublicKey: $pubKeyBase58")
                                
                                result = JSONObject().apply {
                                    put("success", true)
                                    put("publicKey", pubKeyBase58)
                                    put("publicKeyBase64", Base64.encodeToString(account.publicKey, Base64.NO_WRAP))
                                    put("accountLabel", account.accountLabel ?: "Unknown")
                                }.toString()
                            } else {
                                result = errorJson("No accounts returned from wallet")
                            }
                        }
                        is TransactionResult.NoWalletFound -> {
                            Log.e(TAG, "No wallet found")
                            result = errorJson("No MWA-compatible wallet found. Please install Phantom, Solflare, or ensure Seed Vault is enabled.")
                        }
                        is TransactionResult.Failure -> {
                            Log.e(TAG, "Authorization failed: ${connectResult.message}")
                            result = errorJson("Authorization failed: ${connectResult.message}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Connection error", e)
                    result = errorJson("Connection error: ${e.message}")
                } finally {
                    latch.countDown()
                }
            }
        }

        // Wait for result (with timeout)
        try {
            latch.await(60, TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            return errorJson("Connection timeout")
        }

        return result
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
     * Sign a transaction
     * @param transactionBase64 Base64 encoded transaction
     * @return JSON with signed transaction or error
     */
    @JavascriptInterface
    fun signTransaction(transactionBase64: String): String {
        Log.d(TAG, "signTransaction() called")
        
        val activity = activityRef.get() as? ComponentActivity
        if (activity == null) {
            return errorJson("Activity not available")
        }
        
        if (publicKeyBytes == null) {
            return errorJson("Not connected to wallet")
        }

        var result = ""
        val latch = CountDownLatch(1)

        activity.runOnUiThread {
            coroutineScope.launch {
                try {
                    val sender = ActivityResultSender(activity)
                    val transaction = Base64.decode(transactionBase64, Base64.DEFAULT)
                    
                    val connectionIdentity = ConnectionIdentity(
                        identityUri = Uri.parse("https://playsolmate.fun"),
                        iconUri = Uri.parse("https://playsolmate.fun/images/solmate-logo.png"),
                        identityName = "SolMate"
                    )
                    
                    val mwa = MobileWalletAdapter(connectionIdentity = connectionIdentity)
                    
                    val transactResult = mwa.transact(sender) { authResult ->
                        // Sign the transaction using AdapterOperations
                        @Suppress("DEPRECATION")
                        signTransactions(arrayOf(transaction))
                    }
                    
                    when (transactResult) {
                        is TransactionResult.Success -> {
                            val signedPayloads = transactResult.successPayload
                            if (signedPayloads != null && signedPayloads.signedPayloads.isNotEmpty()) {
                                val signedTx = signedPayloads.signedPayloads[0]
                                result = JSONObject().apply {
                                    put("success", true)
                                    put("signedTransaction", Base64.encodeToString(signedTx, Base64.NO_WRAP))
                                }.toString()
                            } else {
                                result = errorJson("No signed transaction returned")
                            }
                        }
                        is TransactionResult.NoWalletFound -> {
                            result = errorJson("Wallet not found")
                        }
                        is TransactionResult.Failure -> {
                            result = errorJson("Signing failed: ${transactResult.message}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Sign error", e)
                    result = errorJson("Sign error: ${e.message}")
                } finally {
                    latch.countDown()
                }
            }
        }

        try {
            latch.await(120, TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            return errorJson("Sign timeout")
        }

        return result
    }

    /**
     * Sign and send a transaction
     * @param transactionBase64 Base64 encoded transaction
     * @return JSON with signature or error
     */
    @JavascriptInterface
    fun signAndSendTransaction(transactionBase64: String): String {
        Log.d(TAG, "signAndSendTransaction() called")
        
        val activity = activityRef.get() as? ComponentActivity
        if (activity == null) {
            return errorJson("Activity not available")
        }
        
        if (publicKeyBytes == null) {
            return errorJson("Not connected to wallet")
        }

        var result = ""
        val latch = CountDownLatch(1)

        activity.runOnUiThread {
            coroutineScope.launch {
                try {
                    val sender = ActivityResultSender(activity)
                    val transaction = Base64.decode(transactionBase64, Base64.DEFAULT)
                    
                    val connectionIdentity = ConnectionIdentity(
                        identityUri = Uri.parse("https://playsolmate.fun"),
                        iconUri = Uri.parse("https://playsolmate.fun/images/solmate-logo.png"),
                        identityName = "SolMate"
                    )
                    
                    val mwa = MobileWalletAdapter(connectionIdentity = connectionIdentity)
                    
                    val transactResult = mwa.transact(sender) { authResult ->
                        // Sign and send using AdapterOperations
                        signAndSendTransactions(arrayOf(transaction))
                    }
                    
                    when (transactResult) {
                        is TransactionResult.Success -> {
                            val sendResult = transactResult.successPayload
                            if (sendResult != null && sendResult.signatures.isNotEmpty()) {
                                val sig = sendResult.signatures[0]
                                result = JSONObject().apply {
                                    put("success", true)
                                    put("signature", base58Encode(sig))
                                    put("signatureBase64", Base64.encodeToString(sig, Base64.NO_WRAP))
                                }.toString()
                            } else {
                                result = errorJson("No signature returned")
                            }
                        }
                        is TransactionResult.NoWalletFound -> {
                            result = errorJson("Wallet not found")
                        }
                        is TransactionResult.Failure -> {
                            result = errorJson("Send failed: ${transactResult.message}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Sign and send error", e)
                    result = errorJson("Sign and send error: ${e.message}")
                } finally {
                    latch.countDown()
                }
            }
        }

        try {
            latch.await(120, TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            return errorJson("Send timeout")
        }

        return result
    }

    // Helper functions
    
    private fun errorJson(message: String): String {
        return JSONObject().apply {
            put("success", false)
            put("error", message)
        }.toString()
    }

    // Base58 encoding for Solana public keys
    private fun base58Encode(bytes: ByteArray): String {
        val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        
        if (bytes.isEmpty()) return ""
        
        // Count leading zeros
        var zeros = 0
        for (b in bytes) {
            if (b.toInt() == 0) zeros++ else break
        }
        
        // Convert to base58
        val input = bytes.copyOf()
        val encoded = CharArray(bytes.size * 2)
        var outputStart = encoded.size
        
        var inputStart = zeros
        while (inputStart < input.size) {
            outputStart--
            encoded[outputStart] = ALPHABET[divmod(input, inputStart, 256, 58)]
            if (input[inputStart].toInt() and 0xFF == 0) {
                inputStart++
            }
        }
        
        // Preserve leading zeros as '1's
        while (outputStart < encoded.size && encoded[outputStart] == ALPHABET[0]) {
            outputStart++
        }
        for (i in 0 until zeros) {
            outputStart--
            encoded[outputStart] = ALPHABET[0]
        }
        
        return String(encoded, outputStart, encoded.size - outputStart)
    }
    
    private fun divmod(number: ByteArray, firstDigit: Int, base: Int, divisor: Int): Int {
        var remainder = 0
        for (i in firstDigit until number.size) {
            val digit = number[i].toInt() and 0xFF
            val temp = remainder * base + digit
            number[i] = (temp / divisor).toByte()
            remainder = temp % divisor
        }
        return remainder
    }
}
