# Trivia V17 — Room Lifecycle Maintenance

V17 adds conservative server-side cleanup for abandoned rooms and stale connection/presence records.

## Automatic cleanup

The existing signed-in presence heartbeat now opportunistically triggers a server-throttled lifecycle sweep at most once every 5 minutes across the whole project. There is no GitHub Action and no extra timer service required.

A room is **never** closed just because it is old while a human participant has a recent heartbeat in that room.

Default empty-room thresholds:

- active matchmaking question/results: 20 minutes with zero recent humans
- active custom question/results: 30 minutes with zero recent humans
- finished room: 20 minutes with zero recent humans
- matchmaking lobby: 30 minutes with zero recent humans
- public custom lobby: 90 minutes with zero recent humans
- invite-only custom lobby: 4 hours with zero recent humans

Presence is considered recent for lifecycle purposes for 2 minutes. Live Ops still labels users online using its tighter 90-second display window.

Stale rooms are soft-closed with `status='cancelled'`, `closed_at`, and `close_reason`. Historical rows are preserved.

## Admin controls

Live Ops shows the last lifecycle sweep and has a **Run stale-room sweep** button. Manual runs use the same conservative rules; they do not force-close healthy rooms.

Run `017_room_lifecycle_cleanup.sql` once in Supabase.
