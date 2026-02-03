/*
 * MWA Intent Helper - Handles solana-wallet:// intents for Mobile Wallet Adapter
 */
package fun.playsolmate.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Log;

import java.util.List;

public class MwaIntentHelper {
    private static final String TAG = "MwaIntentHelper";
    private static final String SOLANA_WALLET_SCHEME = "solana-wallet";

    /**
     * Check if a URL is a solana-wallet:// URL
     */
    public static boolean isSolanaWalletUrl(String url) {
        if (url == null) return false;
        return url.startsWith(SOLANA_WALLET_SCHEME + "://") || 
               url.startsWith(SOLANA_WALLET_SCHEME + ":");
    }

    /**
     * Launch a solana-wallet:// intent
     * Returns true if successfully launched, false otherwise
     */
    public static boolean launchSolanaWalletIntent(Context context, String url) {
        if (!isSolanaWalletUrl(url)) {
            Log.d(TAG, "Not a solana-wallet URL: " + url);
            return false;
        }

        try {
            Uri uri = Uri.parse(url);
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            // Check if there's an app to handle this intent
            PackageManager pm = context.getPackageManager();
            List<ResolveInfo> resolveInfos = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
            
            if (resolveInfos != null && !resolveInfos.isEmpty()) {
                Log.d(TAG, "Found " + resolveInfos.size() + " apps to handle solana-wallet intent");
                context.startActivity(intent);
                return true;
            } else {
                Log.w(TAG, "No apps found to handle solana-wallet intent");
                return false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error launching solana-wallet intent", e);
            return false;
        }
    }

    /**
     * Check if any wallet apps are available to handle MWA
     */
    public static boolean isWalletAvailable(Context context) {
        try {
            Uri uri = Uri.parse(SOLANA_WALLET_SCHEME + "://");
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            
            PackageManager pm = context.getPackageManager();
            List<ResolveInfo> resolveInfos = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
            
            boolean available = resolveInfos != null && !resolveInfos.isEmpty();
            Log.d(TAG, "Wallet available: " + available);
            return available;
        } catch (Exception e) {
            Log.e(TAG, "Error checking wallet availability", e);
            return false;
        }
    }
}
