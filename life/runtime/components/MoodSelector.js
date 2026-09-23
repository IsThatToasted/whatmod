import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const opts = [['nothing', 'Nothing'], ['quick', 'Quick win'], ['productive', 'Productive'], ['errands', 'Errands'], ['home', 'Home'], ['relax', 'Relax'], ['fun', 'Fun']];
const descriptions = {
    nothing: 'Keep it light — urgent, easy, and low-energy things only.',
    quick: 'Short tasks that fit into about 15 minutes rise to the top.',
    productive: 'Important tasks, calls, and higher-energy work rise to the top.',
    errands: 'Shopping and out-of-the-house errands rise to the top.',
    home: 'Chores, shopping, and home-related items rise to the top.',
    relax: 'Low-energy ideas and optional things rise to the top.',
    fun: 'Ideas, hobbies, and fun-tagged things rise to the top.',
};
export function MoodSelector({ value, onChange }) { return _jsxs("div", { className: "mood-wrap", children: [_jsx("p", { children: "What do you feel like doing?" }), _jsx("div", { className: "chip-row", children: opts.map(([v, l]) => _jsx("button", { type: "button", "aria-pressed": value === v, className: `chip ${value === v ? 'active' : ''}`, onClick: () => onChange(value === v ? null : v), children: l }, v)) }), value && _jsxs("div", { className: "mood-feedback", children: [_jsxs("strong", { children: [opts.find(([v]) => v === value)?.[1], " mode"] }), _jsx("span", { children: descriptions[value] })] })] }); }
