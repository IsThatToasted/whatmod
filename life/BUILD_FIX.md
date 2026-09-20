# Build fix history

The earlier Supabase nullability build error in `AppDataContext.tsx` is fixed.

As of v1.0.4, web deployment is also corrected at the architecture level: the single repository Pages workflow builds JustGlance and deploys `life/dist` into `_site/life`, matching the existing compiled `/app` pattern while preserving static apps such as WeTrack.
