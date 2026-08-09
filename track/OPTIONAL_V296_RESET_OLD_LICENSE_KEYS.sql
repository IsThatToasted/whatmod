
-- OPTIONAL: WeTrack V2.9.6 development-license reset
-- Run ONLY after you have generated a new V2 key for yourself.
-- This invalidates all old generation-1 license keys and their license-key
-- entitlements. Manual/admin and StoreKit entitlements are preserved.

begin;

update public.itinerary_license_keys
set active=false
where coalesce(license_generation,1) < 2;

update public.itinerary_user_entitlements e
set active=false, updated_at=now()
where e.source='license_key'
  and exists (
    select 1 from public.itinerary_license_keys k
    where k.license_key=e.license_key
      and coalesce(k.license_generation,1) < 2
  );

commit;
notify pgrst, 'reload schema';

select license_key, active, license_generation, redemption_count
from public.itinerary_license_keys
order by created_at desc;
