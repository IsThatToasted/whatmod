-- READ ONLY: shows currently active WeTrack entitlements and their feature flags.
select u.email, e.plan, e.active, e.source, e.license_key, e.expires_at,
       e.events_per_day, e.max_trips, e.enable_maps, e.enable_memories,
       e.enable_shopping_lists, e.enable_recaps, e.updated_at
from public.itinerary_user_entitlements e
join auth.users u on u.id=e.user_id
order by e.updated_at desc nulls last, e.created_at desc;
