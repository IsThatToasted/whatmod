
-- OPTIONAL AFTER V2.9.8 IS VERIFIED
-- This only archives old multi-row entitlement records.
-- WeTrack V2.9.8 no longer reads them.
update public.itinerary_user_entitlements
set active=false, updated_at=now()
where active=true;

select count(*) as active_legacy_rows
from public.itinerary_user_entitlements
where active=true;
