// Supabase Edge Function: product-preview
// Deploy with: supabase functions deploy product-preview
// JWT verification should remain enabled. No service-role key is exposed to the browser.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' } })
}

function isPrivateIPv4(ip: string) {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some(v => Number.isNaN(v))) return false
  return p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 0
}

function obviouslyPrivate(host: string) {
  const lower = host.toLowerCase().replace(/^\[|\]$/g, '')
  return lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:') || isPrivateIPv4(lower)
}

async function assertPublicUrl(input: string) {
  const url = new URL(input)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http/https product links are supported.')
  if (url.username || url.password) throw new Error('Links containing credentials are not supported.')
  if (obviouslyPrivate(url.hostname)) throw new Error('Private/local network links are not supported.')
  try {
    const addresses = await Deno.resolveDns(url.hostname, 'A')
    if (addresses.some(isPrivateIPv4)) throw new Error('Private/local network links are not supported.')
  } catch (error) {
    if (error instanceof Error && error.message.includes('Private/local')) throw error
    // Some hosts only resolve over IPv6. The hostname checks above still block obvious local targets.
  }
  return url
}

async function safeFetch(startUrl: URL) {
  let current = startUrl
  for (let i = 0; i < 4; i++) {
    await assertPublicUrl(current.href)
    const response = await fetch(current.href, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; JustGlanceProductPreview/1.0; +https://whatmod.com/life/)',
        'accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-US,en;q=0.8',
      },
    })
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Product page redirected without a destination.')
      current = new URL(location, current)
      continue
    }
    return { response, finalUrl: current }
  }
  throw new Error('Too many redirects while reading product page.')
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).trim()
}

function attrs(tag: string) {
  const out: Record<string,string> = {}
  const rx = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(tag))) out[m[1].toLowerCase()] = decodeHtml(m[2] ?? m[3] ?? m[4] ?? '')
  return out
}

function metaMap(html: string) {
  const map = new Map<string,string>()
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(match[0])
    const key = (a.property || a.name || a.itemprop || '').toLowerCase()
    if (key && a.content && !map.has(key)) map.set(key, a.content)
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(match[0])
    if ((a.rel || '').toLowerCase().split(/\s+/).includes('canonical') && a.href) map.set('canonical', a.href)
  }
  return map
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) for (const item of value) { const found = firstString(item); if (found) return found }
  if (value && typeof value === 'object') {
    const obj = value as Record<string,unknown>
    return firstString(obj.url) || firstString(obj.contentUrl) || firstString(obj.name) || firstString(obj.value)
  }
  return null
}

function findProduct(node: unknown): Record<string,unknown> | null {
  if (!node) return null
  if (Array.isArray(node)) { for (const child of node) { const found = findProduct(child); if (found) return found } return null }
  if (typeof node !== 'object') return null
  const obj = node as Record<string,unknown>
  const type = obj['@type']
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return obj
  for (const key of ['@graph','mainEntity','itemListElement','item']) { const found = findProduct(obj[key]); if (found) return found }
  return null
}

function productFromJsonLd(html: string) {
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1].trim().replace(/^<!--|-->$/g,'').trim()
    try { const product = findProduct(JSON.parse(raw)); if (product) return product } catch { /* malformed vendor JSON-LD */ }
  }
  return null
}

function offerData(product: Record<string,unknown> | null) {
  const offers = product?.offers
  const offer = Array.isArray(offers) ? offers[0] : offers && typeof offers === 'object' ? offers as Record<string,unknown> : null
  if (!offer) return { price: null as number|null, currency: null as string|null }
  const raw = (offer as Record<string,unknown>).price ?? (offer as Record<string,unknown>).lowPrice
  const price = raw == null ? null : Number(String(raw).replace(/[^0-9.\-]/g,''))
  const currency = firstString((offer as Record<string,unknown>).priceCurrency)
  return { price: Number.isFinite(price as number) ? price : null, currency }
}

function absolutize(value: string | null, base: URL) {
  if (!value) return null
  try { return new URL(value, base).href } catch { return value }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405)
  try {
    const body = await req.json().catch(() => ({})) as { url?: string }
    if (!body.url) return json({ error: 'A product URL is required.' }, 400)
    const start = await assertPublicUrl(body.url)
    const { response, finalUrl } = await safeFetch(start)
    if (!response.ok) return json({ error: `Product page returned HTTP ${response.status}.` }, 422)
    const type = response.headers.get('content-type') || ''
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) return json({ error: 'That link did not return an HTML product page.' }, 422)
    const html = (await response.text()).slice(0, 2_500_000)
    const meta = metaMap(html)
    const product = productFromJsonLd(html)
    const offers = offerData(product)
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    const productTitle = firstString(product?.name)
    const title = productTitle || meta.get('og:title') || meta.get('twitter:title') || (titleTag ? decodeHtml(titleTag.replace(/<[^>]+>/g,'')) : null) || finalUrl.hostname
    const image = firstString(product?.image) || meta.get('og:image') || meta.get('twitter:image') || null
    const metaPrice = meta.get('product:price:amount') || meta.get('price') || meta.get('product:price') || null
    const price = offers.price ?? (metaPrice ? Number(metaPrice.replace(/[^0-9.\-]/g,'')) : null)
    const currency = offers.currency || meta.get('product:price:currency') || meta.get('pricecurrency') || null
    const brand = firstString(product?.brand) || meta.get('brand') || null
    const category = firstString(product?.category) || meta.get('product:category') || meta.get('category') || null
    const productId = firstString(product?.sku) || firstString(product?.productID) || firstString(product?.mpn) || meta.get('product:retailer_item_id') || null
    const description = firstString(product?.description) || meta.get('og:description') || meta.get('description') || null
    const canonicalRaw = meta.get('canonical') || firstString(product?.url) || finalUrl.href
    const canonical = absolutize(canonicalRaw, finalUrl)
    const store = finalUrl.hostname.replace(/^www\./,'')
    return json({
      url: finalUrl.href,
      canonical_url: canonical,
      title,
      image_url: absolutize(image, finalUrl),
      price: Number.isFinite(price as number) ? price : null,
      currency: currency?.toUpperCase() || null,
      store,
      category,
      brand,
      product_id: productId,
      description,
      confidence: product ? .96 : meta.get('og:title') ? .84 : .62,
      metadata: { json_ld_product: Boolean(product), fetched_at: new Date().toISOString() },
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not inspect product link.' }, 400)
  }
})
