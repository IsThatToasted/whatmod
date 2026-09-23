import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return btoa(binary)
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text
  const pieces: string[] = []
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') pieces.push(content.text)
    }
  }
  return pieces.join('\n')
}

function parseJsonLoose(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(clean) } catch {}
  const start = clean.indexOf('{'), end = clean.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1))
  throw new Error('AI response was not valid JSON')
}

const systemPrompt = `You are the classification engine for JustGlance, a private personal memory and organization app.
Analyze the supplied capture and return ONLY one JSON object. Never identify a real person from their face or infer identity from appearance. You may extract names that are visibly written in the image/document.

Goal: preserve what the user would want to remember, then decide whether there is an obvious structured action.
Use this schema exactly:
{
  "kind": "appointment|task|reminder|shopping|call|contact|receipt|document|reference|idea|place|image",
  "title": "short useful title",
  "summary": "1-3 sentence useful memory summary",
  "confidence": 0.0,
  "due_date": "YYYY-MM-DD or null",
  "due_time": "HH:MM or null",
  "location": "string or null",
  "person": "visible/mentioned person name or null",
  "phone": "phone or null",
  "email": "email or null",
  "url": "url or null",
  "tags": ["short","tags"],
  "suggested_action": "create_event|create_item|create_contact|keep_memory",
  "contact": {
    "first_name": null,
    "last_name": null,
    "display_name": null,
    "company": null,
    "job_title": null,
    "email_personal": null,
    "email_work": null,
    "phone_mobile": null,
    "phone_home": null,
    "phone_work": null,
    "address_home": null,
    "address_business": null,
    "birthday": null,
    "notes": null
  },
  "shopping": {
    "store": null,
    "price": null,
    "currency": null,
    "product_name": null
  }
}

Rules:
- A business card/contact card should be kind contact and create_contact.
- An appointment card, invitation, reservation, ticket, event flyer or screenshot with an actionable date/time should be appointment/create_event when details are sufficiently clear.
- A product, shopping screenshot, product tag or item the user appears to want should be shopping/create_item.
- A bill, receipt, warranty, serial number, parking location, sign, confirmation, reference screenshot or document can remain keep_memory; summarize the details that are likely useful later.
- For photographs without visible text, describe the useful object/context without guessing private facts.
- Resolve relative dates using the current date provided in the user prompt.
- Do not invent dates, prices, names, phone numbers, addresses or brands that are not visible/provided.
- Confidence describes how certain the classification/extraction is.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405)

  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || ''
  const model = Deno.env.get('JUSTGLANCE_AI_MODEL') || 'gpt-5.6-luna'
  if (!supabaseUrl || !anonKey) return json({ error: 'Supabase function environment is incomplete' }, 500)
  if (!openaiKey) return json({ error: 'OPENAI_API_KEY is not configured for Smart Intake', code: 'AI_NOT_CONFIGURED' }, 503)

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: 'Invalid session' }, 401)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const captureId = String(body?.capture_id || '')
  if (!captureId) return json({ error: 'capture_id is required' }, 400)

  const { data: capture, error: captureError } = await supabase.from('captures').select('*').eq('id', captureId).single()
  if (captureError || !capture) return json({ error: captureError?.message || 'Capture not found' }, 404)

  await supabase.from('captures').update({ ai_status: 'processing' }).eq('id', captureId)

  try {
    const current = new Date().toISOString()
    const contextText = [
      `Current timestamp: ${current}`,
      `Original capture title: ${capture.title || ''}`,
      capture.raw_text ? `User text / extracted file text:\n${String(capture.raw_text).slice(0, 24000)}` : '',
      capture.source_url ? `Source URL: ${capture.source_url}` : '',
      capture.file_name ? `File name: ${capture.file_name}` : '',
      capture.mime_type ? `MIME type: ${capture.mime_type}` : '',
    ].filter(Boolean).join('\n\n')

    const content: any[] = [{ type: 'input_text', text: `${systemPrompt}\n\n${contextText}` }]

    if (capture.storage_path && String(capture.mime_type || '').startsWith('image/')) {
      const download = await supabase.storage.from('justglance-captures').download(capture.storage_path)
      if (download.error || !download.data) throw new Error(download.error?.message || 'Could not load image')
      if (download.data.size > 8_000_000) throw new Error('Image is too large for Smart Intake analysis')
      const bytes = new Uint8Array(await download.data.arrayBuffer())
      const mime = capture.mime_type || download.data.type || 'image/jpeg'
      content.push({ type: 'input_image', image_url: `data:${mime};base64,${bytesToBase64(bytes)}` })
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content }],
        max_output_tokens: 1800,
      }),
    })
    const raw = await response.json()
    if (!response.ok) throw new Error(raw?.error?.message || `OpenAI request failed (${response.status})`)
    const analysis = parseJsonLoose(extractOutputText(raw))

    const normalized = {
      kind: String(analysis.kind || 'reference'),
      title: String(analysis.title || capture.title || 'Saved memory').slice(0, 500),
      summary: String(analysis.summary || '').slice(0, 5000),
      confidence: Math.max(0, Math.min(1, Number(analysis.confidence || 0))),
      due_date: analysis.due_date || null,
      due_time: analysis.due_time || null,
      location: analysis.location || null,
      person: analysis.person || null,
      phone: analysis.phone || null,
      email: analysis.email || null,
      url: analysis.url || capture.source_url || null,
      tags: Array.isArray(analysis.tags) ? analysis.tags.map(String).slice(0, 20) : [],
      suggested_action: ['create_event','create_item','create_contact','keep_memory'].includes(analysis.suggested_action) ? analysis.suggested_action : 'keep_memory',
      contact: analysis.contact && typeof analysis.contact === 'object' ? analysis.contact : {},
      shopping: analysis.shopping && typeof analysis.shopping === 'object' ? analysis.shopping : {},
    }

    await supabase.from('captures').update({
      title: normalized.title,
      parsed_kind: normalized.kind,
      parsed_data: { ...(capture.parsed_data || {}), ai: normalized },
      ai_status: 'analyzed',
      ai_summary: normalized.summary || null,
      ai_entities: { person: normalized.person, phone: normalized.phone, email: normalized.email, location: normalized.location, url: normalized.url, contact: normalized.contact, shopping: normalized.shopping },
      ai_suggestions: { action: normalized.suggested_action, due_date: normalized.due_date, due_time: normalized.due_time, tags: normalized.tags, confidence: normalized.confidence },
    }).eq('id', captureId)

    return json({ analysis: normalized })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Smart Intake analysis failed'
    await supabase.from('captures').update({ ai_status: 'error', ai_summary: message }).eq('id', captureId)
    return json({ error: message }, 500)
  }
})
