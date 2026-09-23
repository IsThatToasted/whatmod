import { supabase } from './supabase.js';
const urlRx = /https?:\/\/[^\s<>"']+/i;
export function extractFirstUrl(text) {
    return text.match(urlRx)?.[0]?.replace(/[),.;!?]+$/, '') || null;
}
function titleFromSlug(url) {
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '')
        .replace(/[-_+]+/g, ' ')
        .replace(/\b(?:dp|product|products|item|p)\b/gi, '')
        .replace(/\b[A-Z0-9]{8,}\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return last.length >= 3 ? last.replace(/\b\w/g, char => char.toUpperCase()) : url.hostname.replace(/^www\./, '');
}
export function fallbackProductPreview(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return {
            url: url.href,
            canonical_url: url.href,
            title: titleFromSlug(url),
            store: url.hostname.replace(/^www\./, ''),
            image_url: null,
            price: null,
            currency: null,
            category: null,
            brand: null,
            product_id: null,
            description: null,
            metadata: {},
            confidence: .4,
            source: 'url-fallback',
        };
    }
    catch {
        return { url: rawUrl, title: 'Saved product', confidence: .2, source: 'url-fallback', metadata: {} };
    }
}
export async function fetchProductPreview(rawUrl) {
    const fallback = fallbackProductPreview(rawUrl);
    if (!supabase)
        return fallback;
    try {
        const { data, error } = await supabase.functions.invoke('product-preview', { body: { url: rawUrl } });
        if (error || !data || typeof data !== 'object')
            return fallback;
        const parsed = data;
        return {
            ...fallback,
            url: String(parsed.url || fallback.url),
            canonical_url: typeof parsed.canonical_url === 'string' ? parsed.canonical_url : fallback.canonical_url,
            title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : fallback.title,
            image_url: typeof parsed.image_url === 'string' ? parsed.image_url : null,
            price: typeof parsed.price === 'number' ? parsed.price : parsed.price ? Number(parsed.price) || null : null,
            currency: typeof parsed.currency === 'string' ? parsed.currency : null,
            store: typeof parsed.store === 'string' ? parsed.store : fallback.store,
            category: typeof parsed.category === 'string' ? parsed.category : null,
            brand: typeof parsed.brand === 'string' ? parsed.brand : null,
            product_id: typeof parsed.product_id === 'string' ? parsed.product_id : null,
            description: typeof parsed.description === 'string' ? parsed.description : null,
            metadata: typeof parsed.metadata === 'object' && parsed.metadata ? parsed.metadata : {},
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : .88,
            source: 'edge',
        };
    }
    catch {
        return fallback;
    }
}
function words(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(word => word.length > 2);
}
const semanticHints = {
    heels: ['heel', 'heels', 'stiletto', 'stilettos', 'pump', 'pumps', 'platform', 'platforms', 'sandal', 'sandals', 'shoe', 'shoes', 'boot', 'boots', 'wedge', 'wedges'],
    lingerie: ['lingerie', 'panty', 'panties', 'thong', 'thongs', 'bra', 'bras', 'bralette', 'bodysuit', 'teddy', 'garter', 'lace', 'underwear', 'intimates'],
    groceries: ['food', 'grocery', 'groceries', 'snack', 'drink', 'beverage', 'produce', 'meat', 'dairy', 'pantry'],
    beauty: ['beauty', 'makeup', 'cosmetic', 'cosmetics', 'skincare', 'skin', 'hair', 'fragrance', 'perfume'],
    home: ['home', 'house', 'decor', 'kitchen', 'bath', 'bedroom', 'furniture', 'household'],
    tech: ['tech', 'electronics', 'computer', 'phone', 'tablet', 'gaming', 'cable', 'charger'],
};
export function suggestShoppingList(preview, lists) {
    if (!lists.length)
        return { list: null, confidence: 0, reason: '' };
    const haystack = [preview.title, preview.category, preview.brand, preview.store, preview.description, preview.url].filter(Boolean).join(' ').toLowerCase();
    let best = null;
    let bestScore = 0;
    let bestReason = '';
    for (const list of lists) {
        const listWords = words(list.name);
        let score = 0;
        const reasons = [];
        for (const word of listWords) {
            if (haystack.includes(word)) {
                score += 5;
                reasons.push(word);
            }
            const hints = semanticHints[word] || [];
            for (const hint of hints)
                if (new RegExp(`\\b${hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack)) {
                    score += 3;
                    reasons.push(hint);
                }
        }
        // Multi-word list names such as "Lingerie/Panties" get both semantic families.
        for (const [family, hints] of Object.entries(semanticHints)) {
            if (!list.name.toLowerCase().includes(family))
                continue;
            for (const hint of hints)
                if (new RegExp(`\\b${hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack)) {
                    score += 3;
                    reasons.push(hint);
                }
        }
        if (score > bestScore) {
            bestScore = score;
            best = list;
            bestReason = [...new Set(reasons)].slice(0, 3).join(', ');
        }
    }
    return { list: best, confidence: Math.min(.99, bestScore / 10), reason: bestReason };
}
export function formatMoney(price, currency) {
    if (price == null || Number.isNaN(price))
        return null;
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(price);
    }
    catch {
        return `${currency || '$'} ${price.toFixed(2)}`;
    }
}
