import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
export default function PasswordRecoveryPage() {
    const { updatePassword } = useAuth();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    async function save() {
        if (password.length < 8)
            return setMessage('Use at least 8 characters.');
        if (password !== confirm)
            return setMessage('Those passwords do not match.');
        setBusy(true);
        setMessage('');
        const error = await updatePassword(password);
        if (error)
            setMessage(error);
        setBusy(false);
    }
    return _jsxs("div", { className: "auth-page recovery-page", children: [_jsxs("section", { className: "auth-brand-panel", children: [_jsx("div", { className: "brand-orb xl", children: "J" }), _jsx("span", { className: "eyebrow", children: "JUSTGLANCE" }), _jsx("h1", { children: "One quick reset." }), _jsx("p", { children: "Choose a new password, then you\u2019ll return to your normal glance." })] }), _jsxs("section", { className: "auth-card", children: [_jsx(KeyRound, { size: 28 }), _jsxs("div", { children: [_jsx("h2", { children: "Choose a new password" }), _jsx("p", { children: "Your reset link has been verified." })] }), _jsxs("label", { children: ["New password", _jsx("input", { type: "password", value: password, onChange: e => setPassword(e.target.value), autoComplete: "new-password" })] }), _jsxs("label", { children: ["Confirm password", _jsx("input", { type: "password", value: confirm, onChange: e => setConfirm(e.target.value), autoComplete: "new-password" })] }), message && _jsx("div", { className: "form-message", children: message }), _jsx("button", { className: "primary-button full", onClick: save, disabled: busy || !password || !confirm, children: busy ? 'Updating…' : 'Update password' })] })] });
}
