/*
 * WebView Activity with Native MWA Bridge
 * This replaces TWA to allow JavaScript interface injection for native MWA support
 */
package `fun`.playsolmate.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.*
import androidx.activity.ComponentActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class WebViewActivity : ComponentActivity() {
    private val TAG = "WebViewActivity"
    private lateinit var webView: WebView
    private lateinit var mwaBridge: NativeMwaBridge

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Make fullscreen with status bar
        window.apply {
            clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
            addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            statusBarColor = Color.parseColor("#9945FF") // Solana purple
            navigationBarColor = Color.BLACK
        }
        
        // Create WebView programmatically
        webView = WebView(this).apply {
            layoutParams = android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
        }
        setContentView(webView)
        
        // Configure WebView settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            
            // Enable modern web features
            javaScriptCanOpenWindowsAutomatically = true
        }
        
        // Create and attach MWA Bridge
        mwaBridge = NativeMwaBridge(this, webView)
        webView.addJavascriptInterface(mwaBridge, NativeMwaBridge.JS_INTERFACE_NAME)
        
        // Set up WebView client for URL handling
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                Log.d(TAG, "shouldOverrideUrlLoading: $url")
                
                // IMPORTANT: Let the JS MWA SDK handle solana-wallet:// intents
                // Don't intercept these - let them go through the iframe mechanism
                if (url.startsWith("solana-wallet:")) {
                    Log.d(TAG, "Allowing solana-wallet:// URL through iframe")
                    // Try to launch via intent
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        intent.addCategory(Intent.CATEGORY_BROWSABLE)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to launch solana-wallet intent: $url", e)
                        return false
                    }
                }
                
                // Handle other wallet deep links
                if (url.startsWith("solflare:") || 
                    url.startsWith("phantom:") ||
                    url.startsWith("https://phantom.app") ||
                    url.startsWith("https://solflare.com")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to open external URL: $url", e)
                    }
                }
                
                // Handle our domain
                if (url.contains("playsolmate.fun") || url.contains("localhost") || url.contains("netlify")) {
                    return false // Let WebView handle it
                }
                
                // Open other external links in browser
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to open browser: $url", e)
                    }
                }
                
                return false
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "Page loaded: $url")
                
                // DON'T inject native MWA flag - let JS MWA SDK handle everything
                // The JS SDK works in Chrome and should work here too
                view?.evaluateJavascript("""
                    (function() {
                        // Disable native MWA so JS SDK is used
                        window.isNativeMwaAvailable = false;
                        window.nativeMwaVersion = null;
                        console.log('[WebView] Native MWA disabled - using JS MWA SDK');
                    })();
                """.trimIndent(), null)
            }
            
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                Log.e(TAG, "WebView error: ${error?.description}")
            }
        }
        
        // Set up Chrome client for console logging and permissions
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    Log.d(TAG, "[WebConsole] ${it.messageLevel()}: ${it.message()} (${it.sourceId()}:${it.lineNumber()})")
                }
                return true
            }
            
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
        }
        
        // Load the app
        val launchUrl = "https://playsolmate.fun/"
        Log.d(TAG, "Loading URL: $launchUrl")
        webView.loadUrl(launchUrl)
    }
    
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    override fun onResume() {
        super.onResume()
        webView.onResume()
    }
    
    override fun onPause() {
        super.onPause()
        webView.onPause()
    }
    
    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
