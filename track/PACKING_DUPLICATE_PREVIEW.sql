-- READ ONLY. This file deletes nothing.
-- Use it only if you still see duplicate packing entries after V2.9.3 is deployed.
select trip_id, user_id, lower(trim(label)) as label, count(*) as copies,
       bool_or(packed) as any_copy_checked
from public.itinerary_packing_items
where lower(trim(label)) in (
  'clothing','toiletries','chargers','medications',
  'swimwear','comfort items','snacks','travel documents'
)
group by trip_id,user_id,lower(trim(label))
having count(*) > 1
order by copies desc;
