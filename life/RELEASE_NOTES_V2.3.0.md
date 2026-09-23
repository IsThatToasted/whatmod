# JustGlance v2.3.0 — Universal Memory + Contacts

This release expands Capture from a task parser into the foundation of a durable personal memory system. It is additive and designed so the data entered now remains useful as the intelligence layer improves.

## Universal memory

- Every text capture now writes the original capture record first, before creating a task, call, appointment, project, contact or note. If later structuring fails, the original remains in Memory Inbox instead of disappearing.
- The app now loads a larger history of captures, not only unresolved Inbox rows.
- New **Memory** page keeps processed and archived photos, files, links and original capture text searchable after they have been converted into structured records.
- Photo-only capture is first-class: **Take photo** opens the mobile rear-camera flow where supported, saves the private original, then optionally sends the saved capture through Smart Intake.
- Smart Intake confidence gates prevent uncertain photos from silently creating actions. Confident reference/document memories are organized into Memory; uncertain ones remain in Inbox for review.

## Contacts

New private Contacts include display/first/last/nickname, relationship, company, job title, personal/work email, mobile/home/work phone, home/business address, birthday, notes, tags and an optional linked JustGlance profile.

- Add/edit/search contacts inside JustGlance.
- Import `.vcf` / vCard contact files.
- Capture text can resolve an existing contact locally by full name, nickname, or an unambiguous first name.
- Tasks/calls and appointments can store `contact_id`.
- Linked call items show a small **Dial** action using the contact's phone number.
- Planner rows for linked people also expose **Dial**.
- Upcoming birthdays can surface on Now.

Example after an `Ashley` contact exists:

`call Ashley for something next Tuesday`

becomes a dated Call item linked to Ashley. It appears in Planner and includes a Dial action when Ashley has a phone number.

## Smart Intake Edge Function

`supabase/functions/smart-intake` is an authenticated server-side enrichment layer for private captures. It reads only the signed-in user's capture through RLS. Images are downloaded from the private `justglance-captures` bucket and sent to the configured OpenAI vision-capable model. The OpenAI API key is stored only as a Supabase Edge Function secret and is never exposed in `/life` or GitHub Pages.

The current engine can extract/classify useful concepts such as appointments, calls, contacts/business cards, shopping products, receipts, documents, references, ideas, places and general images. High-confidence captures can become structured entities; uncertain material stays as a memory.

## Database

Run the additive migration:

`supabase/migrations/005_contacts_universal_memory.sql`

It creates `contacts`, adds contact links to items/events/captures, adds AI analysis fields to captures, and preserves existing data.

## Deployment

There are no GitHub Pages workflow changes. `/life` continues to deploy through the shared repository-wide `web-pages.yml`. Do not restore `justglance-web-build.yml`.
