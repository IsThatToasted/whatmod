import type { Contact } from '../types'

export function contactPrimaryPhone(contact?: Contact | null) {
  return contact?.phone_mobile || contact?.phone_work || contact?.phone_home || null
}

export function contactPrimaryEmail(contact?: Contact | null) {
  return contact?.email_personal || contact?.email_work || null
}

export function contactPrimaryAddress(contact?: Contact | null) {
  return contact?.address_home || contact?.address_business || null
}

export function dialHref(phone?: string | null) {
  if (!phone) return ''
  const clean = phone.trim().replace(/[^\d+*#,;]/g, '')
  return clean ? `tel:${clean}` : ''
}

export function mailHref(email?: string | null) {
  return email?.trim() ? `mailto:${email.trim()}` : ''
}

export function mapHref(address?: string | null) {
  return address?.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}` : ''
}

function variants(contact: Contact) {
  const out = new Set<string>()
  const full = `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
  for (const value of [contact.display_name, contact.nickname, full]) {
    if (value?.trim()) out.add(value.trim())
  }
  if (contact.first_name?.trim()) out.add(contact.first_name.trim())
  return [...out]
}

function wordMatch(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'iu').test(text)
}

/**
 * Resolve a contact from free-form capture text without sending the address book anywhere.
 * Full names and nicknames win. A first-name-only match is accepted only when unique.
 */
export function resolveContactFromText(text: string, contacts: Contact[]) {
  const active = contacts.filter(contact => !contact.deleted_at)
  const candidates: Array<{ contact: Contact; score: number; matched: string }> = []
  for (const contact of active) {
    const names = variants(contact)
    for (const name of names) {
      if (!wordMatch(text, name)) continue
      const words = name.trim().split(/\s+/).length
      const isNickname = !!contact.nickname && name.toLowerCase() === contact.nickname.toLowerCase()
      const isDisplay = name.toLowerCase() === contact.display_name.toLowerCase()
      let score = 20 + name.length + words * 20
      if (isNickname) score += 25
      if (isDisplay) score += 15
      candidates.push({ contact, score, matched: name })
    }
  }
  if (!candidates.length) return null
  candidates.sort((a,b) => b.score - a.score)
  const best = candidates[0]
  const bestWords = best.matched.trim().split(/\s+/).length
  if (bestWords === 1) {
    const same = candidates.filter(candidate => candidate.matched.toLowerCase() === best.matched.toLowerCase())
    const ids = new Set(same.map(candidate => candidate.contact.id))
    if (ids.size > 1) return null
  }
  return best.contact
}

function unescapeVCard(value: string) {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim()
}

function vcardAddress(value: string) {
  const parts = unescapeVCard(value).split(';').filter(Boolean)
  return parts.join(', ')
}

export function parseVCardContacts(text: string): Array<Partial<Contact> & { display_name: string }> {
  const blocks = text.replace(/\r\n/g,'\n').match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) || []
  const out: Array<Partial<Contact> & { display_name: string }> = []
  for (const block of blocks) {
    const rows = block.split('\n').filter(Boolean)
    const values = new Map<string, Array<{ params: string; value: string }>>()
    for (const row of rows) {
      const idx = row.indexOf(':')
      if (idx < 0) continue
      const left = row.slice(0, idx)
      const [key, ...paramParts] = left.split(';')
      const normalized = key.toUpperCase().replace(/^ITEM\d+\./,'')
      const params = paramParts.join(';').toUpperCase()
      values.set(normalized, [...(values.get(normalized)||[]), { params, value: row.slice(idx+1) }])
    }
    const fn = unescapeVCard(values.get('FN')?.[0]?.value || '')
    const n = unescapeVCard(values.get('N')?.[0]?.value || '').split(';')
    const first = n[1] || ''
    const last = n[0] || ''
    const display = fn || `${first} ${last}`.trim()
    if (!display) continue
    const phones = values.get('TEL') || []
    const emails = values.get('EMAIL') || []
    const addresses = values.get('ADR') || []
    const org = unescapeVCard(values.get('ORG')?.[0]?.value || '').replace(/;/g,' · ')
    const title = unescapeVCard(values.get('TITLE')?.[0]?.value || '')
    const note = unescapeVCard(values.get('NOTE')?.[0]?.value || '')
    const bdayRaw = unescapeVCard(values.get('BDAY')?.[0]?.value || '')
    const birthday = /^\d{4}-\d{2}-\d{2}$/.test(bdayRaw) ? bdayRaw : null
    const findPhone = (needle: RegExp) => phones.find(entry => needle.test(entry.params))?.value || null
    const findEmail = (needle: RegExp) => emails.find(entry => needle.test(entry.params))?.value || null
    const findAddress = (needle: RegExp) => addresses.find(entry => needle.test(entry.params))?.value || null
    out.push({
      display_name: display,
      first_name: first || null,
      last_name: last || null,
      company: org || null,
      job_title: title || null,
      phone_mobile: unescapeVCard(findPhone(/CELL|MOBILE/i) || phones[0]?.value || '' ) || null,
      phone_home: unescapeVCard(findPhone(/HOME/i) || '') || null,
      phone_work: unescapeVCard(findPhone(/WORK/i) || '') || null,
      email_personal: unescapeVCard(findEmail(/HOME|PERSONAL/i) || emails[0]?.value || '') || null,
      email_work: unescapeVCard(findEmail(/WORK/i) || '') || null,
      address_home: findAddress(/HOME/i) ? vcardAddress(findAddress(/HOME/i)!) : null,
      address_business: findAddress(/WORK/i) ? vcardAddress(findAddress(/WORK/i)!) : null,
      birthday,
      notes: note || null,
      tags: ['imported'],
    })
  }
  return out
}
