import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { lifeIntentParser } from '../lib/parser.js';
const helpOptions = ['Tasks', 'Shopping', 'Appointments', 'Household', 'Errands', 'Everything'];
export default function OnboardingPage() {
    const { profile, updateProfile, createItem } = useAppData();
    const [step, setStep] = useState(1);
    const [name, setName] = useState(profile?.greeting_name || profile?.display_name || '');
    const [areas, setAreas] = useState(profile?.help_areas || ['Everything']);
    const [wake, setWake] = useState(profile?.wake_time || '07:00');
    const [sleep, setSleep] = useState(profile?.sleep_time || '23:00');
    const [workStart, setWorkStart] = useState(profile?.work_start || '');
    const [workEnd, setWorkEnd] = useState(profile?.work_end || '');
    const [first, setFirst] = useState('');
    const [busy, setBusy] = useState(false);
    function toggleArea(area) {
        setAreas(current => area === 'Everything' ? ['Everything'] : current.includes(area) ? current.filter(x => x !== area) : [...current.filter(x => x !== 'Everything'), area]);
    }
    async function finish() {
        if (busy)
            return;
        setBusy(true);
        try {
            if (first.trim())
                await createItem(lifeIntentParser.parse(first), first);
            await updateProfile({
                greeting_name: name.trim() || 'there',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                help_areas: areas.length ? areas : ['Everything'],
                wake_time: wake,
                sleep_time: sleep,
                work_start: workStart || null,
                work_end: workEnd || null,
                onboarding_complete: true,
            });
            location.hash = '/now';
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs("div", { className: "onboarding", children: [_jsx("div", { className: "onboarding-progress", "aria-label": `Onboarding step ${step} of 5`, children: [1, 2, 3, 4, 5].map(n => _jsx("span", { className: n <= step ? 'active' : '' }, n)) }), step === 1 && _jsxs("section", { children: [_jsx("div", { className: "brand-orb xl", children: "J" }), _jsx("span", { className: "eyebrow", children: "WELCOME TO JUSTGLANCE" }), _jsx("h1", { children: "Your life, at a glance." }), _jsx("p", { children: "Capture something once. We\u2019ll help surface it when it\u2019s useful." }), _jsxs("button", { className: "primary-button", onClick: () => setStep(2), children: ["Get started ", _jsx(ArrowRight, {})] })] }), step === 2 && _jsxs("section", { children: [_jsx(Sparkles, {}), _jsx("span", { className: "eyebrow", children: "A LITTLE PERSONAL" }), _jsx("h1", { children: "What should we call you?" }), _jsx("input", { className: "onboarding-input", autoFocus: true, value: name, onChange: e => setName(e.target.value), placeholder: "Brian" }), _jsxs("button", { className: "primary-button", onClick: () => setStep(3), disabled: !name.trim(), children: ["Continue ", _jsx(ArrowRight, {})] })] }), step === 3 && _jsxs("section", { children: [_jsx("span", { className: "eyebrow", children: "WHAT SHOULD WE CATCH?" }), _jsx("h1", { children: "What would you like help remembering?" }), _jsx("p", { children: "This keeps early suggestions relevant. It never hides the rest of the app." }), _jsx("div", { className: "onboarding-options", children: helpOptions.map(option => _jsxs("button", { className: `choice-card ${areas.includes(option) ? 'selected' : ''}`, onClick: () => toggleArea(option), children: [areas.includes(option) && _jsx(Check, { size: 17 }), _jsx("span", { children: option })] }, option)) }), _jsxs("button", { className: "primary-button", onClick: () => setStep(4), disabled: !areas.length, children: ["Continue ", _jsx(ArrowRight, {})] })] }), step === 4 && _jsxs("section", { children: [_jsx("span", { className: "eyebrow", children: "YOUR RHYTHM" }), _jsx("h1", { children: "When does your day usually run?" }), _jsx("p", { children: "Wake and sleep are enough. Work hours are optional and can be changed later." }), _jsxs("div", { className: "two-col onboarding-times", children: [_jsxs("label", { children: ["Wake", _jsx("input", { type: "time", value: wake, onChange: e => setWake(e.target.value) })] }), _jsxs("label", { children: ["Sleep", _jsx("input", { type: "time", value: sleep, onChange: e => setSleep(e.target.value) })] })] }), _jsxs("div", { className: "two-col onboarding-times", children: [_jsxs("label", { children: ["Work starts (optional)", _jsx("input", { type: "time", value: workStart, onChange: e => setWorkStart(e.target.value) })] }), _jsxs("label", { children: ["Work ends (optional)", _jsx("input", { type: "time", value: workEnd, onChange: e => setWorkEnd(e.target.value) })] })] }), _jsxs("button", { className: "primary-button", onClick: () => setStep(5), children: ["Continue ", _jsx(ArrowRight, {})] })] }), step === 5 && _jsxs("section", { children: [_jsx(Check, {}), _jsx("span", { className: "eyebrow", children: "ONE LAST THING" }), _jsx("h1", { children: "Capture your first thought." }), _jsx("p", { children: "Try something natural. JustGlance will do the organizing." }), _jsx("textarea", { className: "onboarding-input", value: first, onChange: e => setFirst(e.target.value), placeholder: "I need to call the dentist this week", rows: 3 }), _jsx("button", { className: "primary-button", onClick: finish, disabled: busy, children: busy ? 'Saving…' : _jsxs(_Fragment, { children: ["Show me Now ", _jsx(ArrowRight, {})] }) })] })] });
}
