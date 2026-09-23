# JustGlance Smart Intake Edge Function

This authenticated Supabase Edge Function enriches durable JustGlance capture records. It is intentionally separate from the static GitHub Pages client so private API credentials are never shipped to the browser.

## Configure

```bash
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

Optional model selection:

```bash
supabase secrets set JUSTGLANCE_AI_MODEL=gpt-5.6-luna
```

Deploy with JWT verification enabled:

```bash
supabase functions deploy smart-intake
```

## Data path

1. The app saves the user's raw capture first.
2. It invokes this function with only the capture UUID.
3. The function uses the caller's Supabase JWT and RLS to load that capture.
4. For images, it downloads the user's private object from `justglance-captures`.
5. It sends text/image context to the OpenAI Responses API and requests structured JSON.
6. It writes the resulting summary/entities/suggestions back to that capture.
7. The client may auto-apply only sufficiently confident structured actions. Otherwise the memory remains available for review.

No service-role key is used. The OpenAI API key exists only in Supabase Function secrets.
