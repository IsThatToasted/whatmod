# ScooterCast iOS

Everything required for the iOS app lives in this folder.

Expected repository layout:

```text
whatmod/
├── .github/
│   └── workflows/
│       └── scootercast-ios-build.yml
└── ios/
    └── ScooterCast/
        ├── project.yml
        ├── Config.swift
        ├── LiveStreamManager.swift
        ├── LocationService.swift
        ├── Models.swift
        ├── RideAPI.swift
        ├── RiderHomeView.swift
        ├── RiderViewModel.swift
        └── ScooterCastApp.swift
```

The GitHub Action runs entirely with `ios/ScooterCast` as its working directory.

Required GitHub repository secret:

`RIDER_ADMIN_KEY`
