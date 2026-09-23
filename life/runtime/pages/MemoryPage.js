import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Archive, FileText, Image as ImageIcon, Link2, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
function MemoryCard({ capture, getUrl, analyze }) {
    const [url, setUrl] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { let active = true; if (capture.storage_path && (capture.kind === 'image' || capture.kind === 'file' || capture.kind === 'contact_import' || capture.kind === 'calendar_import'))
        void getUrl(capture.storage_path).then(v => { if (active)
            setUrl(v); }); return () => { active = false; }; }, [capture.storage_path, capture.kind, getUrl]);
    async function runAnalysis() { setBusy(true); try {
        await analyze(capture.id);
    }
    finally {
        setBusy(false);
    } }
    return _jsxs("article", { className: "memory-card", children: [capture.kind === 'image' && url ? _jsx("a", { className: "memory-thumb", href: url, target: "_blank", rel: "noreferrer", children: _jsx("img", { src: url, alt: "Saved memory" }) }) : _jsx("div", { className: "memory-type-icon", children: capture.kind === 'link' ? _jsx(Link2, {}) : capture.kind === 'image' ? _jsx(ImageIcon, {}) : _jsx(FileText, {}) }), _jsxs("div", { className: "memory-card-body", children: [_jsxs("div", { className: "memory-meta", children: [_jsx("span", { children: capture.parsed_kind || capture.kind }), _jsx("span", { children: new Date(capture.created_at).toLocaleString() }), _jsx("span", { children: capture.status })] }), _jsx("strong", { children: capture.title }), _jsx("p", { children: capture.ai_summary || capture.raw_text?.slice(0, 360) || capture.source_url || capture.file_name || 'Saved memory' }), _jsxs("div", { className: "row-actions memory-actions", children: [capture.source_url && _jsxs("a", { className: "secondary-button compact-action", href: capture.source_url, target: "_blank", rel: "noreferrer", children: [_jsx(Link2, { size: 14 }), "Open link"] }), url && _jsxs("a", { className: "secondary-button compact-action", href: url, target: "_blank", rel: "noreferrer", children: ["Open ", capture.kind === 'image' ? 'photo' : 'file'] }), (capture.kind === 'image' || capture.raw_text) && capture.ai_status !== 'processing' && _jsxs("button", { className: "secondary-button compact-action", disabled: busy, onClick: () => void runAnalysis(), children: [_jsx(Sparkles, { size: 14 }), busy ? 'Analyzing…' : capture.ai_status === 'analyzed' ? 'Analyze again' : 'Smart analyze'] })] })] })] });
}
export default function MemoryPage() {
    const { captures, getCaptureSignedUrl, analyzeCapture } = useAppData();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return captures.filter(c => {
            const filterOk = filter === 'all' || (filter === 'photos' && c.kind === 'image') || (filter === 'links' && c.kind === 'link') || (filter === 'text' && ['text', 'thought'].includes(c.kind)) || (filter === 'files' && ['file', 'calendar_import', 'contact_import'].includes(c.kind));
            if (!filterOk)
                return false;
            if (!q)
                return true;
            return `${c.title} ${c.raw_text || ''} ${c.source_url || ''} ${c.file_name || ''} ${c.parsed_kind || ''} ${c.ai_summary || ''} ${JSON.stringify(c.ai_entities || {})}`.toLowerCase().includes(q);
        });
    }, [captures, query, filter]);
    const counts = { all: captures.length, photos: captures.filter(c => c.kind === 'image').length, files: captures.filter(c => ['file', 'calendar_import', 'contact_import'].includes(c.kind)).length, links: captures.filter(c => c.kind === 'link').length, text: captures.filter(c => ['text', 'thought'].includes(c.kind)).length };
    return _jsxs("div", { className: "page organizer-page memory-page", children: [_jsx("header", { className: "page-header", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "MEMORY" }), _jsx("h1", { children: "Everything you asked JustGlance to remember." }), _jsx("p", { children: "The original capture stays here even after JustGlance turns it into a task, appointment, contact, shopping item or other structured record." })] }) }), _jsxs("div", { className: "memory-toolbar", children: [_jsxs("label", { className: "search-field", children: [_jsx(Search, { size: 17 }), _jsx("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Search photos, files, links, people, text\u2026" })] }), _jsx("div", { className: "chip-row memory-filters", children: ['all', 'photos', 'files', 'links', 'text'].map(v => _jsxs("button", { className: `chip ${filter === v ? 'active' : ''}`, onClick: () => setFilter(v), children: [v, " ", _jsx("small", { children: counts[v] })] }, v)) })] }), _jsx("section", { className: "memory-grid", children: shown.map(c => _jsx(MemoryCard, { capture: c, getUrl: getCaptureSignedUrl, analyze: analyzeCapture }, c.id)) }), !shown.length && _jsxs("div", { className: "empty-state", children: [_jsx(Archive, {}), _jsx("strong", { children: "No matching memories." }), _jsx("span", { children: "Use Capture to type, paste, photograph or upload almost anything." })] })] });
}
