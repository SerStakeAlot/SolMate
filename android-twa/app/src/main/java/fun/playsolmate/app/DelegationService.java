package fun.playsolmate.app;

// Location delegation removed - was causing Google Play Services AR requirement
// import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;


public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();

        // Location delegation removed for Seeker compatibility
        // registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
    }
}

