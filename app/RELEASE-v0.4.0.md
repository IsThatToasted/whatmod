# Aurelium Field v0.4.0 — Admin Workspace

## Admin / Employee workspace separation
- Owner/admin accounts can switch into a dedicated Admin View.
- Non-admin accounts cannot enter the admin route/view even by direct navigation.
- Employee View no longer exposes invite links, time approvals, employee management, or organization administration.
- Employee home metrics were revised to remove admin/financial dashboard information.

## Admin dashboard
- Overview counts for active employees, submitted timecards, edit requests, and active invites.
- Dedicated Timecards, Employees, and Invites sections on web and iOS.
- Explicit switch back to Employee View.

## Timecards
- View submitted organization timecards.
- Approve or reject submitted cards.
- Edit timecards before/after review with a required admin adjustment reason.
- Review and approve/reject employee correction requests.
- Reviewed-history section.
- Admin adjustments record administrator, timestamp, and note.
- Rejected cards can be resubmitted by employees.

## Employees
- List active and inactive organization members.
- Edit display name, phone, role, and active access.
- Remove employees by deactivating membership, preserving time/audit history.
- Owner safeguards prevent an admin from managing owners and prevent removal of the final active owner.

## Invites
- Invite generation exists only in Admin View.
- Email-scoped or open join links.
- Role selection.
- Invite history and revocation.
- Only owners may create owner-level invitations.

## Supabase migration
Run `supabase/migrations/004_admin_workspace.sql` after migrations 001–003.
It tightens RLS and adds admin RPCs/audit fields.
