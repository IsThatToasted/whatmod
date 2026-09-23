# JustGlance product-preview Edge Function

This optional function lets the GitHub Pages app inspect a pasted product URL server-side. Browsers normally cannot read arbitrary shopping pages because of CORS.

Deploy after logging the Supabase CLI into the JustGlance project:

```bash
supabase functions deploy product-preview
```

Leave JWT verification enabled. The JustGlance web app calls it through the signed-in Supabase client.

The Chrome extension does **not** depend on this function; it reads metadata directly from the product page DOM and can therefore capture rich title/image/price data immediately.
