/*
 * MWA Handler Activity - Handles mwa:// deep links from the web app
 * This allows the web app to trigger native MWA through deep links
 */
package `fun`.playsolmate.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Log
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class MwaHandlerActivity : Activity() {
    private val TAG = "MwaHandler"
    private val coroutineScope = CoroutineScope(Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val uri = intent?.data
        Log.d(TAG, "Received URI: $uri")

        if (uri == null) {
            finishWithError("No URI provided")
            return
        }

        when (uri.host) {
            "connect" -> handleConnect(uri)
            "sign" -> handleSign(uri)
            "send" -> handleSignAndSend(uri)
            else -> finishWithError("Unknown action: ${uri.host}")
        }
    }

    private fun handleConnect(uri: Uri) {
        val cluster = uri.getQueryParameter("cluster") ?: "mainnet-beta"
        val callbackUrl = uri.getQueryParameter("callback") ?: return finishWithError("No callback URL")
        
        Log.d(TAG, "Connect request - cluster=$cluster, callback=$callbackUrl")

        coroutineScope.launch {
            try {
                val sender = ActivityResultSender(this@MwaHandlerActivity)
                val mwa = MobileWalletAdapter()
                
                val result = mwa.authorize(
                    sender,
                    MobileWalletAdapter.LocalAssociationIntentCreator,
                    Uri.parse("https://solmate.gg"),
                    Uri.parse("https://solmate.gg/images/logo.png"),
                    "SolMate",
                    getClusterRpcUri(cluster)
                )

                when (result) {
                    is TransactionResult.Success -> {
                        val auth = result.payload
                        val pubKey = base58Encode(auth.publicKey)
                        Log.d(TAG, "Connect success! PublicKey: $pubKey")
                        
                        // Redirect back to web app with the public key
                        val redirectUri = Uri.parse(callbackUrl).buildUpon()
                            .appendQueryParameter("success", "true")
                            .appendQueryParameter("publicKey", pubKey)
                            .appendQueryParameter("authToken", Base64.encodeToString(auth.authToken, Base64.URL_SAFE or Base64.NO_WRAP))
                            .build()
                        
                        val intent = Intent(Intent.ACTION_VIEW, redirectUri)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        startActivity(intent)
                    }
                    is TransactionResult.Failure -> {
                        redirectWithError(callbackUrl, "Authorization failed: ${result.message}")
                    }
                    is TransactionResult.NoWalletFound -> {
                        redirectWithError(callbackUrl, "No MWA wallet found")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Connect error", e)
                redirectWithError(callbackUrl, "Error: ${e.message}")
            }
            finish()
        }
    }

    private fun handleSign(uri: Uri) {
        val txBase64 = uri.getQueryParameter("tx") ?: return finishWithError("No transaction")
        val callbackUrl = uri.getQueryParameter("callback") ?: return finishWithError("No callback URL")
        
        Log.d(TAG, "Sign request")

        coroutineScope.launch {
            try {
                val txBytes = Base64.decode(txBase64, Base64.URL_SAFE)
                val sender = ActivityResultSender(this@MwaHandlerActivity)
                val mwa = MobileWalletAdapter()
                
                val result = mwa.signTransactions(
                    sender,
                    MobileWalletAdapter.LocalAssociationIntentCreator,
                    arrayOf(txBytes)
                )

                when (result) {
                    is TransactionResult.Success -> {
                        val signedTxs = result.payload
                        if (signedTxs.isNotEmpty()) {
                            val signedBase64 = Base64.encodeToString(signedTxs[0], Base64.URL_SAFE or Base64.NO_WRAP)
                            val redirectUri = Uri.parse(callbackUrl).buildUpon()
                                .appendQueryParameter("success", "true")
                                .appendQueryParameter("signedTx", signedBase64)
                                .build()
                            
                            val intent = Intent(Intent.ACTION_VIEW, redirectUri)
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                            startActivity(intent)
                        } else {
                            redirectWithError(callbackUrl, "No signed transaction")
                        }
                    }
                    is TransactionResult.Failure -> {
                        redirectWithError(callbackUrl, "Sign failed: ${result.message}")
                    }
                    is TransactionResult.NoWalletFound -> {
                        redirectWithError(callbackUrl, "No wallet found")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Sign error", e)
                redirectWithError(callbackUrl, "Error: ${e.message}")
            }
            finish()
        }
    }

    private fun handleSignAndSend(uri: Uri) {
        val txBase64 = uri.getQueryParameter("tx") ?: return finishWithError("No transaction")
        val callbackUrl = uri.getQueryParameter("callback") ?: return finishWithError("No callback URL")
        
        Log.d(TAG, "Sign and send request")

        coroutineScope.launch {
            try {
                val txBytes = Base64.decode(txBase64, Base64.URL_SAFE)
                val sender = ActivityResultSender(this@MwaHandlerActivity)
                val mwa = MobileWalletAdapter()
                
                val result = mwa.signAndSendTransactions(
                    sender,
                    MobileWalletAdapter.LocalAssociationIntentCreator,
                    arrayOf(txBytes)
                )

                when (result) {
                    is TransactionResult.Success -> {
                        val signatures = result.payload
                        if (signatures.isNotEmpty()) {
                            val sigBase58 = base58Encode(signatures[0])
                            val redirectUri = Uri.parse(callbackUrl).buildUpon()
                                .appendQueryParameter("success", "true")
                                .appendQueryParameter("signature", sigBase58)
                                .build()
                            
                            val intent = Intent(Intent.ACTION_VIEW, redirectUri)
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                            startActivity(intent)
                        } else {
                            redirectWithError(callbackUrl, "No signature")
                        }
                    }
                    is TransactionResult.Failure -> {
                        redirectWithError(callbackUrl, "Send failed: ${result.message}")
                    }
                    is TransactionResult.NoWalletFound -> {
                        redirectWithError(callbackUrl, "No wallet found")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Send error", e)
                redirectWithError(callbackUrl, "Error: ${e.message}")
            }
            finish()
        }
    }

    private fun redirectWithError(callbackUrl: String, error: String) {
        val redirectUri = Uri.parse(callbackUrl).buildUpon()
            .appendQueryParameter("success", "false")
            .appendQueryParameter("error", error)
            .build()
        
        val intent = Intent(Intent.ACTION_VIEW, redirectUri)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        startActivity(intent)
    }

    private fun finishWithError(error: String) {
        Log.e(TAG, error)
        finish()
    }

    private fun getClusterRpcUri(cluster: String): Uri {
        return when (cluster.lowercase()) {
            "mainnet-beta", "mainnet" -> Uri.parse("https://api.mainnet-beta.solana.com")
            "devnet" -> Uri.parse("https://api.devnet.solana.com")
            "testnet" -> Uri.parse("https://api.testnet.solana.com")
            else -> Uri.parse("https://api.mainnet-beta.solana.com")
        }
    }

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
        for (b in input) {
            if (b.toInt() == 0) sb.insert(0, '1') else break
        }
        return sb.toString()
    }
}
