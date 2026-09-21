# V12 – Local Content Studio

V12 moves normal question acquisition and media resolution off GitHub Actions.

## Install

1. Deploy the drop-in files.
2. Run `supabase/migrations/013_local_content_studio.sql` once in Supabase SQL Editor.
3. Open `/triviaadmin` → Questions and download the Windows Content Studio.
4. Run `START_CONTENT_STUDIO.bat`.
5. Acquire questions, resolve media, review selections, and export one content package.
6. In `/triviaadmin` → Questions, choose **Import Content Package** and select that one JSON file.

The browser batches the uploaded package internally. The local tool never receives Supabase credentials.

## Safety

- Questions dedupe by `canonical_key`.
- Admin-created and admin-edited questions are `content_locked` and are not overwritten by automated content packages.
- Retired/deleted questions are not silently resurrected.
- Approved/locked media is preserved.
- Local imports are recorded in the existing question audit log with `origin=local_content_studio` and the package ID.
- GitHub question hydration and media resolution workflows are manual fallback only.
