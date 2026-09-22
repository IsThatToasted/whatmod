import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { X } from 'lucide-react';
export function Modal({ open, onClose, title, children }) {
    if (!open)
        return null;
    return _jsx("div", { className: "modal-backdrop", role: "presentation", onMouseDown: e => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("section", { className: "modal", role: "dialog", "aria-modal": "true", "aria-label": title, children: [_jsxs("div", { className: "modal-head", children: [_jsx("h2", { children: title }), _jsx("button", { className: "icon-button", onClick: onClose, "aria-label": "Close", children: _jsx(X, { size: 20 }) })] }), children] }) });
}
