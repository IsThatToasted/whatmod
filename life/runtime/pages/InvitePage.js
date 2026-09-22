import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckCircle2, Link2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext.js';
export default function InvitePage() {
    const { token } = useParams();
    const { consumeInvite } = useAppData();
    const nav = useNavigate();
    const [state, setState] = useState('ready');
    const [message, setMessage] = useState('');
    async function join() { if (!token)
        return; setState('joining'); try {
        const spaceId = await consumeInvite(token);
        setState('done');
        setTimeout(() => nav(spaceId ? `/spaces/${spaceId}` : '/spaces'), 400);
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Invite could not be accepted.');
        setState('error');
    } }
    return _jsx("div", { className: "page", children: _jsxs("div", { className: "large-empty invite-state", children: [state === 'error' ? _jsx(XCircle, {}) : state === 'done' ? _jsx(CheckCircle2, {}) : _jsx(Link2, {}), _jsx("h2", { children: state === 'done' ? 'You joined the space.' : state === 'error' ? 'This invite can’t be used.' : 'You’ve been invited to a JustGlance space.' }), _jsx("p", { children: message || 'Shared tasks, shopping, chores, and activity will appear only after you accept.' }), state === 'ready' && _jsx("button", { className: "primary-button", onClick: join, children: "Join space" }), state === 'joining' && _jsx("button", { className: "primary-button", disabled: true, children: "Joining\u2026" }), state === 'error' && _jsx("button", { className: "secondary-button", onClick: () => nav('/spaces'), children: "Back to Spaces" })] }) });
}
