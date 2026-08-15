# ScooterCast iOS V1.2

Single-folder iOS project.

V1.2 startup hardening:
- explicit typed Info.plist
- background location is disabled during app launch
- background location only activates when a ride starts
- no automatic location permission dialog on launch
- URL config no longer uses force unwraps
- GitHub build validates and prints the final app Info.plist
- build artifact contains diagnostics

Repository layout:

whatmod/
├── .github/workflows/scootercast-ios-build.yml
└── ios/ScooterCast/
    ├── project.yml
    ├── Info.plist
    └── Swift sources...

Required GitHub repository secret:
RIDER_ADMIN_KEY
