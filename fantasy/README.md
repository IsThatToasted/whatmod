# Afterglow — Private Photo Flash Fix

Upload the contents of this folder into `/fantasy/`.

This is a visual/performance patch only.

## Changed
- Timed private photo thumbnails now keep stable signed URLs during chat polling.
- Chat rendering skips DOM rebuilds when the message list has not actually changed.
- Prevents the sent photo preview from flashing/reloading during refresh cycles.

## Preserved
- Existing private photo upload behavior
- Existing 72-hour message/photo expiry behavior
- Existing shop/unlocks/admin/profile/matching features
- Existing Supabase schema
