import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Chrome, Copy, Download, Edit3, LocateFixed, LogOut, MapPin, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { APP_VERSION, featureFlags } from '../lib/config.js';
import { requestCurrentPosition } from '../lib/location.js';
import { supabase } from '../lib/supabase.js';
export default function SettingsPage() {
    const { profile, preferences, updateProfile, updatePreferences, places, createPlace, updatePlace, deletePlace, items, spaces, events, notes } = useAppData();
    const { signOut, deleteAccount, demo } = useAuth();
    const [name, setName] = useState(profile?.greeting_name || '');
    const [wake, setWake] = useState(profile?.wake_time || '07:00');
    const [sleep, setSleep] = useState(profile?.sleep_time || '23:00');
    const [workStart, setWorkStart] = useState(profile?.work_start || '');
    const [workEnd, setWorkEnd] = useState(profile?.work_end || '');
    const [theme, setTheme] = useState(profile?.theme || 'system');
    const [timeFormat, setTimeFormat] = useState(profile?.time_format || '12h');
    const [weekStart, setWeekStart] = useState(String(profile?.week_starts_on ?? 0));
    const [placeName, setPlaceName] = useState('');
    const [placeAddress, setPlaceAddress] = useState('');
    const [placeCategory, setPlaceCategory] = useState('other');
    const [placeCoords, setPlaceCoords] = useState(null);
    const [editingPlaceId, setEditingPlaceId] = useState('');
    const [locationMessage, setLocationMessage] = useState('');
    const [accountMessage, setAccountMessage] = useState('');
    const [browserIntegrations, setBrowserIntegrations] = useState([]);
    const [browserToken, setBrowserToken] = useState('');
    const [browserMessage, setBrowserMessage] = useState('');
    const [browserBusy, setBrowserBusy] = useState(false);
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'system')
            delete root.dataset.theme;
        else
            root.dataset.theme = theme;
    }, [theme]);
    async function saveProfile() {
        await updateProfile({
            greeting_name: name.trim() || 'there',
            wake_time: wake,
            sleep_time: sleep,
            work_start: workStart || null,
            work_end: workEnd || null,
            theme,
            time_format: timeFormat,
            week_starts_on: Number(weekStart),
        });
    }
    function exportData() {
        const data = { exported_at: new Date().toISOString(), profile, preferences, items, spaces, places, events, notes };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'justglance-export.json';
        anchor.click();
        URL.revokeObjectURL(url);
    }
    async function requestLocation() {
        setLocationMessage('');
        try {
            const position = await requestCurrentPosition();
            setPlaceCoords(position);
            await updateProfile({ location_permission_state: 'granted' });
            await updatePreferences({ location_reminders_enabled: true });
            setLocationMessage('Location is enabled. Nearby suggestions stay on-device unless you explicitly save a place.');
        }
        catch (error) {
            const unsupported = !('geolocation' in navigator);
            await updateProfile({ location_permission_state: unsupported ? 'unsupported' : 'denied' });
            setLocationMessage(error instanceof Error ? error.message : 'Location could not be enabled.');
        }
    }
    function clearPlaceForm() {
        setEditingPlaceId('');
        setPlaceName('');
        setPlaceAddress('');
        setPlaceCategory('other');
        setPlaceCoords(null);
    }
    function startPlaceEdit(id) {
        const place = places.find(candidate => candidate.id === id);
        if (!place)
            return;
        setEditingPlaceId(place.id);
        setPlaceName(place.name);
        setPlaceAddress(place.address || '');
        setPlaceCategory(place.category || 'other');
        setPlaceCoords(place.latitude != null && place.longitude != null ? { latitude: place.latitude, longitude: place.longitude } : null);
    }
    async function savePlace() {
        if (!placeName.trim())
            return;
        const payload = {
            name: placeName.trim(),
            address: placeAddress.trim() || null,
            category: placeCategory,
            latitude: placeCoords?.latitude ?? null,
            longitude: placeCoords?.longitude ?? null,
            radius_meters: 200,
        };
        if (editingPlaceId)
            await updatePlace(editingPlaceId, payload);
        else
            await createPlace(payload);
        clearPlaceForm();
    }
    async function removePlace() {
        if (!editingPlaceId)
            return;
        await deletePlace(editingPlaceId);
        clearPlaceForm();
    }
    async function loadBrowserIntegrations() {
        if (!supabase || demo)
            return;
        const { data, error } = await supabase.from('browser_integrations').select('id,user_id,name,created_at,last_used_at,revoked_at').is('revoked_at', null).order('created_at', { ascending: false });
        if (error) {
            setBrowserMessage(error.message.includes('browser_integrations') ? 'Run migration 004 to enable the browser extension bridge.' : error.message);
            return;
        }
        setBrowserIntegrations((data || []));
    }
    useEffect(() => { void loadBrowserIntegrations(); }, [demo]);
    async function createBrowserPairing() {
        if (!supabase || demo)
            return;
        setBrowserBusy(true);
        setBrowserMessage('');
        setBrowserToken('');
        try {
            const { data, error } = await supabase.rpc('create_browser_integration', { p_name: 'Chrome extension' });
            if (error)
                throw error;
            const token = data?.token || '';
            if (!token)
                throw new Error('Supabase did not return a pairing code.');
            setBrowserToken(token);
            setBrowserMessage('Pairing code created. Paste it into the JustGlance browser panel once; it can be revoked at any time.');
            await loadBrowserIntegrations();
        }
        catch (error) {
            setBrowserMessage(error instanceof Error ? error.message : 'Could not create a pairing code.');
        }
        finally {
            setBrowserBusy(false);
        }
    }
    async function revokeBrowserPairing(id) {
        if (!supabase || demo)
            return;
        const { error } = await supabase.rpc('revoke_browser_integration', { p_id: id });
        if (error) {
            setBrowserMessage(error.message);
            return;
        }
        setBrowserMessage('Browser connection revoked.');
        await loadBrowserIntegrations();
    }
    return _jsxs("div", { className: "page", children: [_jsx("header", { className: "page-header", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "SETTINGS" }), _jsx("h1", { children: "Keep the system out of your way." }), _jsx("p", { children: "Most defaults are designed to work without tuning." })] }) }), _jsxs("div", { className: "settings-grid", children: [_jsxs("section", { className: "settings-section", children: [_jsx("span", { className: "eyebrow", children: "PROFILE" }), _jsx("h2", { children: "Profile" }), _jsxs("label", { children: ["Greeting name", _jsx("input", { value: name, onChange: e => setName(e.target.value) })] }), _jsxs("label", { children: ["Timezone", _jsx("input", { value: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, readOnly: true })] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("span", { className: "eyebrow", children: "SCHEDULE" }), _jsx("h2", { children: "Your usual rhythm" }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Wake time", _jsx("input", { type: "time", value: wake, onChange: e => setWake(e.target.value) })] }), _jsxs("label", { children: ["Sleep time", _jsx("input", { type: "time", value: sleep, onChange: e => setSleep(e.target.value) })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Work starts", _jsx("input", { type: "time", value: workStart, onChange: e => setWorkStart(e.target.value) })] }), _jsxs("label", { children: ["Work ends", _jsx("input", { type: "time", value: workEnd, onChange: e => setWorkEnd(e.target.value) })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Week starts", _jsxs("select", { value: weekStart, onChange: e => setWeekStart(e.target.value), children: [_jsx("option", { value: "0", children: "Sunday" }), _jsx("option", { value: "1", children: "Monday" })] })] }), _jsxs("label", { children: ["Time format", _jsxs("select", { value: timeFormat, onChange: e => setTimeFormat(e.target.value), children: [_jsx("option", { value: "12h", children: "12 hour" }), _jsx("option", { value: "24h", children: "24 hour" })] })] })] }), _jsx("button", { className: "secondary-button", onClick: saveProfile, children: "Save profile & schedule" })] }), _jsxs("section", { className: "settings-section", children: [_jsx("span", { className: "eyebrow", children: "APPEARANCE" }), _jsx("h2", { children: "Theme" }), _jsxs("label", { children: ["Theme", _jsxs("select", { value: theme, onChange: e => setTheme(e.target.value), children: [_jsx("option", { value: "system", children: "System" }), _jsx("option", { value: "light", children: "Light" }), _jsx("option", { value: "dark", children: "Dark" })] })] }), _jsx("p", { className: "muted", children: "Changes preview immediately. Save profile & schedule to keep the preference on your account." })] }), _jsxs("section", { className: "settings-section", children: [_jsx("span", { className: "eyebrow", children: "PLACES" }), _jsx("h2", { children: "Places & location" }), places.map(place => _jsxs("div", { className: "place-row editable-row", children: [_jsx(MapPin, { size: 17 }), _jsxs("div", { children: [_jsx("strong", { children: place.name }), _jsxs("span", { children: [place.address || place.category, place.latitude != null ? ' · location saved' : ''] })] }), _jsx("button", { className: "icon-button subtle", onClick: () => startPlaceEdit(place.id), "aria-label": `Edit ${place.name}`, children: _jsx(Edit3, { size: 15 }) })] }, place.id)), _jsxs("div", { className: "form-stack settings-place-form", children: [editingPlaceId && _jsxs("div", { className: "editing-banner", children: [_jsx("strong", { children: "Editing saved place" }), _jsx("button", { className: "text-button", onClick: clearPlaceForm, children: "Cancel" })] }), _jsxs("label", { children: ["Name", _jsx("input", { value: placeName, onChange: e => setPlaceName(e.target.value), placeholder: "Gym, Walmart, Parents\u2019 house" })] }), _jsxs("label", { children: ["Address (optional)", _jsx("input", { value: placeAddress, onChange: e => setPlaceAddress(e.target.value), placeholder: "Manual address" })] }), _jsxs("label", { children: ["Category", _jsxs("select", { value: placeCategory, onChange: e => setPlaceCategory(e.target.value), children: [_jsx("option", { value: "other", children: "Other" }), _jsx("option", { value: "home", children: "Home" }), _jsx("option", { value: "work", children: "Work" }), _jsx("option", { value: "store", children: "Store" }), _jsx("option", { value: "gym", children: "Gym" }), _jsx("option", { value: "pharmacy", children: "Pharmacy" })] })] }), _jsxs("div", { className: "place-actions", children: [_jsxs("button", { className: "secondary-button", type: "button", onClick: requestLocation, disabled: !featureFlags.LOCATION, children: [_jsx(LocateFixed, { size: 17 }), "Use current location"] }), editingPlaceId && _jsxs("button", { className: "text-button danger-text", type: "button", onClick: removePlace, children: [_jsx(Trash2, { size: 15 }), "Delete"] }), _jsx("button", { className: "primary-button", type: "button", onClick: savePlace, disabled: !placeName.trim(), children: editingPlaceId ? _jsxs(_Fragment, { children: [_jsx(Edit3, { size: 17 }), "Save place"] }) : _jsxs(_Fragment, { children: [_jsx(Plus, { size: 17 }), "Add place"] }) })] }), placeCoords && _jsx("p", { className: "muted", children: "Coordinates are saved with this place." }), locationMessage && _jsx("div", { className: "form-message", children: locationMessage })] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("span", { className: "eyebrow", children: "NOTIFICATIONS" }), _jsx("h2", { children: "What may interrupt you" }), _jsx(Toggle, { label: "Urgent reminders", value: preferences?.urgent_reminders_enabled ?? true, onChange: value => updatePreferences({ urgent_reminders_enabled: value }) }), _jsx(Toggle, { label: "Upcoming tasks", value: preferences?.upcoming_tasks_enabled ?? true, onChange: value => updatePreferences({ upcoming_tasks_enabled: value }) }), _jsx(Toggle, { label: "Morning brief", value: preferences?.morning_brief_enabled ?? true, onChange: value => updatePreferences({ morning_brief_enabled: value }) }), _jsx(Toggle, { label: "Daily reset", value: preferences?.daily_reset_enabled ?? true, onChange: value => updatePreferences({ daily_reset_enabled: value }) }), _jsx(Toggle, { label: "Shared activity", value: preferences?.shared_activity_enabled ?? true, onChange: value => updatePreferences({ shared_activity_enabled: value }) }), _jsx(Toggle, { label: "Location reminders", value: preferences?.location_reminders_enabled ?? false, onChange: value => updatePreferences({ location_reminders_enabled: value }) }), _jsx(Toggle, { label: "Routine reminders", value: preferences?.routine_reminders_enabled ?? true, onChange: value => updatePreferences({ routine_reminders_enabled: value }) }), _jsx("p", { className: "muted", children: "These preferences are stored now. Actual push delivery remains disabled until a push provider is configured." })] }), _jsxs("section", { className: "settings-section browser-extension-settings", children: [_jsx("span", { className: "eyebrow", children: "BROWSER" }), _jsxs("h2", { children: [_jsx(Chrome, { size: 20 }), " Add to JustGlance"] }), _jsx("p", { className: "muted", children: "The Chrome extension adds a small button to shopping pages, reads product title/image/price from the page, syncs your named shopping lists, and saves directly to the list you choose." }), _jsxs("div", { className: "browser-extension-actions", children: [_jsxs("a", { className: "secondary-button", href: "./chrome-extension/JustGlance-Chrome-Extension-v1.0.1.zip", download: true, children: [_jsx(Download, { size: 17 }), "Download extension"] }), _jsxs("button", { className: "primary-button", onClick: createBrowserPairing, disabled: browserBusy || demo, children: [_jsx(Chrome, { size: 17 }), browserBusy ? 'Creating…' : 'Create pairing code'] })] }), browserToken && _jsxs("div", { className: "pairing-token-card", children: [_jsx("span", { children: "ONE-TIME PAIRING CODE" }), _jsx("code", { children: browserToken }), _jsxs("button", { className: "secondary-button", onClick: async () => navigator.clipboard.writeText(browserToken), children: [_jsx(Copy, { size: 16 }), "Copy code"] }), _jsx("small", { children: "JustGlance stores only a hash. This raw code is shown only in this session." })] }), browserMessage && _jsx("div", { className: "form-message", children: browserMessage }), _jsxs("div", { className: "integration-list", children: [_jsxs("div", { className: "section-heading inline", children: [_jsx("strong", { children: "Connected browsers" }), _jsx("button", { className: "icon-button", onClick: loadBrowserIntegrations, "aria-label": "Refresh browser connections", children: _jsx(RefreshCw, { size: 15 }) })] }), browserIntegrations.length ? browserIntegrations.map(integration => _jsxs("div", { className: "integration-row", children: [_jsxs("span", { children: [_jsx("b", { children: integration.name }), _jsx("small", { children: integration.last_used_at ? `Last used ${new Date(integration.last_used_at).toLocaleString()}` : `Connected ${new Date(integration.created_at).toLocaleString()}` })] }), _jsx("button", { className: "text-button danger-text", onClick: () => revokeBrowserPairing(integration.id), children: "Revoke" })] }, integration.id)) : _jsx("p", { className: "muted", children: "No browser connections yet." })] }), _jsxs("p", { className: "muted", children: ["Install: unzip the download, open ", _jsx("b", { children: "chrome://extensions" }), ", enable Developer mode, choose ", _jsx("b", { children: "Load unpacked" }), ", and select the extracted extension folder. Then paste the pairing code into the bottom-left JustGlance button on any normal website."] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("span", { className: "eyebrow", children: "PRIVACY & DATA" }), _jsx("h2", { children: "Your data" }), _jsxs("button", { className: "secondary-button", onClick: exportData, children: [_jsx(Download, { size: 17 }), "Export my data"] }), _jsx("p", { className: "muted", children: "Exports stay on your device. Task and note text is never sent to analytics by this app." }), _jsx("p", { className: "muted", children: "Privacy Policy and Terms URLs should be published before public launch; no dead links are exposed in this build." })] }), _jsxs("section", { className: "settings-section danger-zone", children: [_jsx("span", { className: "eyebrow", children: "ACCOUNT" }), _jsx("h2", { children: "Account" }), _jsxs("button", { className: "secondary-button", onClick: signOut, disabled: demo, children: [_jsx(LogOut, { size: 17 }), demo ? 'Sign out unavailable in demo' : 'Sign out'] }), _jsxs("button", { className: "danger-button", disabled: demo, onClick: async () => { if (!confirm('Permanently delete your JustGlance account and all owned data? This cannot be undone.'))
                                    return; const err = await deleteAccount(); if (err)
                                    setAccountMessage(err); }, children: [_jsx(Trash2, { size: 17 }), demo ? 'Delete account unavailable in demo' : 'Delete account'] }), accountMessage && _jsx("div", { className: "form-message", children: accountMessage }), _jsxs("p", { className: "muted", children: ["Version ", APP_VERSION] })] })] })] });
}
function Toggle({ label, value, onChange }) {
    const [busy, setBusy] = useState(false);
    async function toggle() {
        setBusy(true);
        try {
            await onChange(!value);
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs("div", { className: "toggle-row", children: [_jsx("span", { children: label }), _jsx("button", { type: "button", className: `switch ${value ? 'on' : ''}`, onClick: toggle, "aria-pressed": value, disabled: busy, children: _jsx("span", {}) })] });
}
