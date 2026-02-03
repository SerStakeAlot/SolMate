/*
 * Custom Activity that intercepts solana-wallet:// intents and handles them
 * This ensures MWA works correctly in the TWA environment
 */
package fun.playsolmate.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

public class MwaRedirectActivity extends Activity {
    private static final String TAG = "MwaRedirect";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Intent intent = getIntent();
        Uri uri = intent.getData();
        
        if (uri != null) {
            String scheme = uri.getScheme();
            Log.d(TAG, "Received intent with URI: " + uri.toString());
            
            if ("solana-wallet".equals(scheme)) {
                // Forward to the actual wallet app
                Log.d(TAG, "Forwarding solana-wallet intent to wallet app");
                
                Intent walletIntent = new Intent(Intent.ACTION_VIEW, uri);
                // Don't add extra flags - let the system handle the task naturally
                // This allows the wallet bottom sheet to appear properly
                
                try {
                    startActivity(walletIntent);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to launch wallet", e);
                }
            }
        }
        
        // Finish this activity immediately so it doesn't block wallet UI
        finish();
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        // Ensure we finish when paused to not interfere
        finish();
    }
}
