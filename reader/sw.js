@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');

:root {
  color-scheme: light;
  --bg: #f7f5ff;
  --bg-elevated: rgba(255, 255, 255, 0.78);
  --surface: #ffffff;
  --surface-soft: #f7f5fb;
  --surface-strong: #efebfa;
  --text: #252238;
  --muted: #756f88;
  --faint: #a59fb5;
  --line: rgba(53, 43, 92, 0.11);
  --primary: #7159e8;
  --primary-strong: #5a42d4;
  --primary-soft: #eeeaff;
  --accent: #ef8fbd;
  --success: #40a980;
  --shadow-sm: 0 8px 24px rgba(62, 49, 110, 0.08);
  --shadow-lg: 0 28px 80px rgba(52, 39, 100, 0.16);
  --radius-xl: 32px;
  --radius-lg: 22px;
  --radius-md: 15px;
  --font-ui: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-display: "Fraunces", Georgia, serif;
}

[data-theme="dark"] {
  color-scheme: dark;
  --bg: #12101b;
  --bg-elevated: rgba(29, 26, 42, 0.83);
  --surface: #201d2d;
  --surface-soft: #191722;
  --surface-strong: #2a2639;
  --text: #f4f1ff;
  --muted: #aaa3bd;
  --faint: #787189;
  --line: rgba(255, 255, 255, 0.09);
  --primary: #9e8cff;
  --primary-strong: #8871ff;
  --primary-soft: rgba(126, 102, 255, 0.15);
  --accent: #f2a0c8;
  --success: #63c79e;
  --shadow-sm: 0 10px 26px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 32px 90px rgba(0, 0, 0, 0.42);
}

* { box-sizing: border-box; }
html { min-height: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 12% 0%, rgba(201, 187, 255, 0.35), transparent 34%),
    radial-gradient(circle at 100% 15%, rgba(255, 199, 225, 0.26), transparent 28%),
    var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  transition: background-color .25s ease, color .25s ease;
}
button, input, textarea { font: inherit; }
button { color: inherit; }
button, [role="button"] { -webkit-tap-highlight-color: transparent; }
button:focus-visible, input:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary) 40%, transparent);
  outline-offset: 3px;
}
svg { width: 1.2em; height: 1.2em; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
[hidden] { display: none !important; }
.sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

.ambient { position: fixed; pointer-events: none; filter: blur(1px); z-index: -1; opacity: .8; }
.ambient-one { width: 280px; height: 280px; border-radius: 44% 56% 59% 41%; top: 32%; left: -130px; background: rgba(151, 126, 255, .12); transform: rotate(18deg); }
.ambient-two { width: 250px; height: 250px; border-radius: 58% 42% 40% 60%; right: -120px; bottom: 15%; background: rgba(255, 147, 198, .1); transform: rotate(-12deg); }

.app-shell { width: min(1180px, calc(100% - 36px)); margin: 0 auto; padding-bottom: 150px; }
.topbar { height: 92px; display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 11px; border: 0; background: none; padding: 6px; border-radius: 16px; cursor: pointer; text-align: left; }
.brand-mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 14px; color: white; background: linear-gradient(145deg, #8d79ff, #5b42d5); box-shadow: 0 10px 24px rgba(102, 77, 221, .28); }
.brand-mark svg { width: 29px; height: 29px; }
.brand-mark svg path:first-child { fill: currentColor; stroke: none; opacity: .96; }
.brand-mark svg path:last-child { stroke: #6a51dc; stroke-width: 1.4; }
.brand-copy { display: grid; line-height: 1.05; }
.brand-copy strong { font-family: var(--font-display); font-size: 1.25rem; letter-spacing: -.02em; }
.brand-copy small { margin-top: 4px; color: var(--muted); font-size: .69rem; letter-spacing: .08em; text-transform: uppercase; }
.top-actions { display: flex; align-items: center; gap: 8px; }
.save-state { color: var(--muted); font-size: .78rem; margin-right: 8px; }
.save-state::before { content: ""; display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 99px; background: var(--success); vertical-align: 1px; }
.icon-button { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 14px; border: 1px solid var(--line); background: var(--bg-elevated); backdrop-filter: blur(18px); cursor: pointer; transition: transform .18s ease, background .18s ease, border-color .18s ease; }
.icon-button:hover { transform: translateY(-2px); background: var(--surface); border-color: color-mix(in srgb, var(--primary) 25%, var(--line)); }
.icon-button svg { width: 19px; height: 19px; }
[data-theme="dark"] .sun-icon, :root:not([data-theme="dark"]) .moon-icon { display: none; }

.main-content { padding-top: 54px; }
.welcome { max-width: 760px; margin: 0 auto 42px; text-align: center; animation: rise .65s ease both; }
.eyebrow, .eyebrow-mini { color: var(--primary); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.eyebrow { display: inline-flex; align-items: center; gap: 9px; font-size: .72rem; padding: 8px 13px; border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--surface) 75%, transparent); backdrop-filter: blur(16px); }
.pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 0 0 rgba(113,89,232,.35); animation: pulse 2.2s infinite; }
.welcome h1 { margin: 18px 0 14px; font-family: var(--font-display); font-size: clamp(3.25rem, 7vw, 5.8rem); line-height: .92; letter-spacing: -.065em; }
.welcome h1 span { background: linear-gradient(100deg, var(--primary), var(--accent)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.welcome p { max-width: 650px; margin: 0 auto; color: var(--muted); font-size: 1.05rem; line-height: 1.7; }

.workspace { position: relative; max-width: 980px; margin: 0 auto; overflow: visible; border: 1px solid var(--line); border-radius: var(--radius-xl); background: var(--bg-elevated); box-shadow: var(--shadow-lg); backdrop-filter: blur(30px); animation: rise .7s .08s ease both; }
.workspace::before { content: ""; position: absolute; inset: 1px; pointer-events: none; border-radius: calc(var(--radius-xl) - 1px); background: linear-gradient(125deg, rgba(255,255,255,.34), transparent 28%); }
.workspace-head { position: relative; z-index: 2; display: flex; justify-content: space-between; gap: 20px; padding: 24px 28px 18px; border-bottom: 1px solid var(--line); }
.document-identity { flex: 1; min-width: 0; }
.title-input { width: 100%; padding: 0; border: 0; background: transparent; color: var(--text); font-family: var(--font-display); font-weight: 700; font-size: 1.35rem; letter-spacing: -.02em; outline: none !important; }
.document-meta { color: var(--muted); margin-top: 5px; font-size: .78rem; }
.document-actions { position: relative; display: flex; align-items: center; gap: 8px; }
.soft-button { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--line); border-radius: 13px; padding: 0 14px; background: var(--surface); color: var(--text); font-weight: 650; font-size: .83rem; cursor: pointer; box-shadow: 0 4px 14px rgba(39,31,75,.04); transition: transform .18s ease, border-color .18s ease, background .18s ease; }
.soft-button:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--primary) 30%, var(--line)); }
.soft-button svg { width: 17px; height: 17px; }
.soft-button.compact { min-height: 36px; padding: 0 11px; font-size: .78rem; }
.soft-button.wide, .read-button.wide { width: 100%; }
.menu-trigger { width: 42px; padding: 0; }
.menu { position: absolute; z-index: 20; top: calc(100% + 8px); right: 0; min-width: 190px; padding: 7px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow-sm); }
.menu button { width: 100%; border: 0; border-radius: 9px; padding: 10px 11px; background: transparent; text-align: left; color: var(--text); cursor: pointer; font-size: .84rem; }
.menu button:hover { background: var(--surface-soft); }

.editor-wrap { position: relative; min-height: 440px; padding: 10px 28px 0; }
#textInput { position: relative; z-index: 2; width: 100%; min-height: 430px; resize: vertical; border: 0; outline: 0; padding: 28px 16px 42px; background: transparent; color: var(--text); font-family: var(--font-display); font-size: clamp(1.12rem, 2vw, 1.35rem); line-height: 1.78; caret-color: var(--primary); }
#textInput::placeholder { color: var(--faint); opacity: .68; }
.editor-glow { position: absolute; width: 140px; height: 140px; right: 10%; bottom: 4%; border-radius: 50%; background: rgba(126,104,240,.08); filter: blur(50px); pointer-events: none; }
.reader-wrap { min-height: 480px; padding: 20px 44px 50px; outline: 0; }
.reader-toolbar { position: sticky; top: 12px; z-index: 3; display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; color: var(--muted); font-size: .77rem; }
.reader-text { max-width: 760px; margin: 0 auto; font-family: var(--font-display); font-size: clamp(1.2rem, 2vw, 1.48rem); line-height: 1.9; }
.reader-text .chunk { border-radius: 6px; transition: background .18s ease, color .18s ease, box-shadow .18s ease; cursor: pointer; }
.reader-text .chunk:hover { background: var(--surface-soft); }
.reader-text .chunk.active { background: linear-gradient(100deg, color-mix(in srgb, var(--primary) 18%, transparent), color-mix(in srgb, var(--accent) 12%, transparent)); color: var(--text); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 8%, transparent); }
.reader-text .paragraph { display: block; margin: 0 0 1.25em; }

.workspace-footer { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 20px 28px 24px; border-top: 1px solid var(--line); }
.voice-pill { min-width: 215px; max-width: 360px; display: flex; align-items: center; gap: 11px; padding: 7px 12px 7px 8px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); cursor: pointer; text-align: left; transition: transform .18s ease, border-color .18s ease; }
.voice-pill:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--primary) 35%, var(--line)); }
.voice-avatar { flex: 0 0 38px; height: 38px; display: grid; place-items: center; border-radius: 12px; background: linear-gradient(145deg, var(--primary-soft), color-mix(in srgb, var(--accent) 16%, var(--surface))); color: var(--primary); font-family: var(--font-display); font-weight: 700; }
.voice-copy { flex: 1; min-width: 0; display: grid; }
.voice-copy small { color: var(--muted); font-size: .67rem; }
.voice-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .84rem; }
.voice-pill > svg { color: var(--faint); }
.primary-actions { display: flex; align-items: center; gap: 16px; }
.cursor-option { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: .78rem; cursor: pointer; }
.cursor-option input { width: 16px; height: 16px; accent-color: var(--primary); }
.read-button { min-height: 52px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; border: 0; border-radius: 16px; padding: 0 22px; background: linear-gradient(135deg, #8069f1, #6046dc); color: white; font-weight: 700; cursor: pointer; box-shadow: 0 12px 28px rgba(102,75,220,.28); transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
.read-button:hover { transform: translateY(-2px); box-shadow: 0 15px 32px rgba(102,75,220,.36); filter: saturate(1.08); }
.read-button:active { transform: translateY(0); }
.read-button.small { min-height: 42px; border-radius: 13px; padding: 0 15px; font-size: .84rem; }
.read-button.small svg { width: 16px; }
.read-icon { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 10px; background: rgba(255,255,255,.15); }

.feature-ribbon { max-width: 920px; margin: 24px auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.feature-ribbon > div { display: flex; align-items: center; gap: 12px; padding: 14px 16px; color: var(--muted); }
.feature-ribbon svg { flex: 0 0 23px; color: var(--primary); }
.feature-ribbon span { display: grid; }
.feature-ribbon strong { color: var(--text); font-size: .8rem; }
.feature-ribbon small { margin-top: 2px; font-size: .69rem; line-height: 1.3; }

.drawer { position: fixed; inset: 0; z-index: 90; pointer-events: none; visibility: hidden; }
.drawer.open { pointer-events: auto; visibility: visible; }
.drawer-backdrop { position: absolute; inset: 0; background: rgba(17,13,30,.32); opacity: 0; backdrop-filter: blur(4px); transition: opacity .26s ease; }
.drawer.open .drawer-backdrop { opacity: 1; }
.drawer-panel { position: absolute; top: 0; right: 0; width: min(480px, 100%); height: 100%; overflow-y: auto; padding: 30px 30px max(30px, env(safe-area-inset-bottom)); border-left: 1px solid var(--line); background: var(--surface); box-shadow: -24px 0 70px rgba(28,21,54,.2); transform: translateX(104%); transition: transform .34s cubic-bezier(.2,.8,.2,1); }
.drawer.open .drawer-panel { transform: translateX(0); }
.drawer-handle { display: none; }
.drawer-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 28px; }
.eyebrow-mini { display: block; font-size: .65rem; margin-bottom: 6px; }
.drawer-head h2, .modal-head h2 { margin: 0; font-family: var(--font-display); font-size: 2rem; letter-spacing: -.035em; }
.setting-block > label, .range-setting label { font-weight: 700; font-size: .82rem; }
.search-field { position: relative; margin: 12px 0; }
.search-field svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--faint); }
.search-field input { width: 100%; height: 44px; border: 1px solid var(--line); border-radius: 13px; padding: 0 14px 0 41px; background: var(--surface-soft); color: var(--text); outline: 0; }
.voice-list { max-height: 300px; overflow-y: auto; display: grid; gap: 7px; padding-right: 3px; scrollbar-width: thin; }
.voice-option { display: flex; align-items: center; gap: 11px; width: 100%; border: 1px solid transparent; border-radius: 14px; padding: 9px; background: transparent; text-align: left; cursor: pointer; }
.voice-option:hover { background: var(--surface-soft); }
.voice-option.selected { border-color: color-mix(in srgb, var(--primary) 25%, transparent); background: var(--primary-soft); }
.voice-option .voice-avatar { flex-basis: 36px; height: 36px; }
.voice-option-copy { min-width: 0; flex: 1; display: grid; }
.voice-option-copy strong { font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.voice-option-copy small { color: var(--muted); font-size: .68rem; }
.voice-badge { padding: 4px 7px; border-radius: 999px; background: var(--surface-strong); color: var(--muted); font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.voice-badge.local { color: var(--success); background: color-mix(in srgb, var(--success) 11%, transparent); }
.setting-note { color: var(--muted); font-size: .68rem; line-height: 1.5; }
.local-dot { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: var(--success); }
.setting-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 18px; margin: 30px 0; padding-top: 26px; border-top: 1px solid var(--line); }
.range-setting.full { grid-column: 1 / -1; }
.range-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.range-label output { color: var(--primary); font-size: .77rem; font-weight: 700; }
.range-setting input { width: 100%; accent-color: var(--primary); }
.range-marks { display: flex; justify-content: space-between; margin-top: 5px; color: var(--faint); font-size: .62rem; }
.drawer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 24px; border-top: 1px solid var(--line); }

.library-modal { width: min(760px, calc(100% - 28px)); max-height: min(720px, calc(100dvh - 40px)); padding: 0; border: 1px solid var(--line); border-radius: 26px; background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); }
.library-modal::backdrop { background: rgba(17,13,30,.38); backdrop-filter: blur(5px); }
.modal-head { display: flex; justify-content: space-between; gap: 20px; padding: 27px 28px 21px; border-bottom: 1px solid var(--line); }
.modal-head p { margin: 6px 0 0; color: var(--muted); font-size: .82rem; }
.library-list { min-height: 280px; max-height: 480px; overflow-y: auto; padding: 14px; }
.library-empty { min-height: 280px; display: grid; place-items: center; text-align: center; color: var(--muted); }
.library-empty svg { width: 42px; height: 42px; margin-bottom: 12px; color: var(--primary); }
.library-item { display: grid; grid-template-columns: 46px minmax(0,1fr) auto; align-items: center; gap: 13px; padding: 12px; border-radius: 16px; cursor: pointer; transition: background .16s ease; }
.library-item:hover { background: var(--surface-soft); }
.library-icon { width: 46px; height: 54px; display: grid; place-items: center; border-radius: 10px; background: linear-gradient(150deg, var(--primary-soft), color-mix(in srgb, var(--accent) 12%, var(--surface))); color: var(--primary); }
.library-icon svg { width: 22px; }
.library-copy { min-width: 0; }
.library-copy strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-display); font-size: 1rem; }
.library-copy p { margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: .72rem; }
.library-copy small { color: var(--faint); font-size: .66rem; }
.library-delete { opacity: 0; border: 0; border-radius: 10px; padding: 8px; background: transparent; color: var(--muted); cursor: pointer; transition: opacity .16s, background .16s; }
.library-item:hover .library-delete, .library-delete:focus-visible { opacity: 1; }
.library-delete:hover { background: rgba(210,73,95,.1); color: #d2495f; }
.modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 22px; border-top: 1px solid var(--line); color: var(--muted); font-size: .7rem; }

.player { position: fixed; z-index: 70; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); width: min(1050px, calc(100% - 28px)); transform: translateX(-50%); border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--line)); border-radius: 23px; background: color-mix(in srgb, var(--surface) 92%, transparent); box-shadow: 0 24px 65px rgba(35,25,72,.24); backdrop-filter: blur(28px); animation: playerIn .35s ease both; }
.player-progress-track { height: 3px; overflow: hidden; border-radius: 23px 23px 0 0; background: var(--surface-strong); }
.player-progress-track div { width: 0; height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); transition: width .2s linear; }
.player-inner { min-height: 82px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 18px; padding: 11px 16px; }
.now-playing { min-width: 0; display: flex; align-items: center; gap: 12px; }
.playing-art { flex: 0 0 48px; height: 48px; display: flex; align-items: center; justify-content: center; gap: 3px; border-radius: 14px; background: linear-gradient(145deg, var(--primary-soft), color-mix(in srgb, var(--accent) 15%, var(--surface))); }
.playing-art span { width: 3px; border-radius: 3px; background: var(--primary); animation: wave .9s ease-in-out infinite alternate; }
.playing-art span:nth-child(1) { height: 12px; animation-delay: -.5s; }
.playing-art span:nth-child(2) { height: 22px; animation-delay: -.25s; }
.playing-art span:nth-child(3) { height: 17px; animation-delay: -.7s; }
.playing-art span:nth-child(4) { height: 9px; animation-delay: -.1s; }
.player.paused .playing-art span { animation-play-state: paused; }
.now-playing > div:last-child { min-width: 0; display: grid; }
.now-playing small { color: var(--muted); font-size: .61rem; text-transform: uppercase; letter-spacing: .08em; }
.now-playing strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .83rem; }
.now-playing #playerStatus { color: var(--faint); font-size: .65rem; white-space: nowrap; }
.transport { display: flex; align-items: center; gap: 8px; }
.transport-button, .tool-button { border: 0; background: transparent; cursor: pointer; color: var(--muted); }
.transport-button { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 12px; }
.transport-button:hover, .tool-button:hover { color: var(--text); background: var(--surface-soft); }
.play-pause { width: 50px; height: 50px; display: grid; place-items: center; border: 0; border-radius: 50%; background: linear-gradient(145deg, var(--primary), var(--primary-strong)); color: white; cursor: pointer; box-shadow: 0 9px 22px rgba(99,73,215,.27); }
.play-pause svg { grid-area: 1/1; width: 22px; height: 22px; }
.play-pause .play-symbol { display: none; }
.player.paused .play-pause .pause-symbol { display: none; }
.player.paused .play-pause .play-symbol { display: block; }
.player-tools { justify-self: end; display: flex; align-items: center; gap: 3px; }
.time-readout { display: flex; gap: 4px; color: var(--faint); margin-right: 5px; font-variant-numeric: tabular-nums; font-size: .66rem; }
.tool-button { position: relative; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; }
.tool-button svg { width: 18px; }
#sleepBadge { position: absolute; top: 1px; right: 0; min-width: 15px; height: 15px; display: grid; place-items: center; border-radius: 999px; background: var(--primary); color: white; font-size: .52rem; font-weight: 700; }
.player-scrubber { position: absolute; left: 16px; right: 16px; bottom: 5px; width: calc(100% - 32px); height: 8px; opacity: 0; cursor: pointer; }
.player:hover .player-scrubber, .player-scrubber:focus-visible { opacity: 1; }

.popover { position: fixed; z-index: 85; min-width: 170px; padding: 8px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow-sm); }
.popover strong { display: block; padding: 7px 9px; font-size: .73rem; }
.popover button { width: 100%; padding: 8px 9px; border: 0; border-radius: 9px; background: transparent; color: var(--text); text-align: left; cursor: pointer; font-size: .76rem; }
.popover button:hover { background: var(--surface-soft); }
.toast-region { position: fixed; z-index: 120; right: 20px; top: 20px; display: grid; gap: 9px; }
.toast { max-width: min(360px, calc(100vw - 40px)); padding: 12px 15px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow-sm); color: var(--text); font-size: .78rem; animation: toastIn .25s ease both; }
.toast.error { border-color: rgba(210,73,95,.25); }

[data-tooltip] { position: relative; }
[data-tooltip]::after { content: attr(data-tooltip); position: absolute; z-index: 100; bottom: calc(100% + 8px); left: 50%; transform: translate(-50%, 4px); pointer-events: none; opacity: 0; padding: 5px 8px; border-radius: 7px; background: #2c283b; color: white; font-size: .62rem; white-space: nowrap; transition: opacity .15s, transform .15s; }
[data-tooltip]:hover::after { opacity: 1; transform: translate(-50%, 0); }

@keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 70% { box-shadow: 0 0 0 8px rgba(113,89,232,0); } 100% { box-shadow: 0 0 0 0 rgba(113,89,232,0); } }
@keyframes playerIn { from { opacity: 0; transform: translate(-50%, 18px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes wave { from { transform: scaleY(.5); opacity: .65; } to { transform: scaleY(1); opacity: 1; } }
@keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 760px) {
  .app-shell { width: min(100% - 20px, 680px); padding-bottom: 160px; }
  .topbar { height: 74px; }
  .save-state { display: none; }
  .brand-copy small { display: none; }
  .main-content { padding-top: 28px; }
  .welcome { margin-bottom: 28px; padding: 0 10px; }
  .welcome h1 { font-size: clamp(3rem, 15vw, 4.7rem); }
  .welcome p { font-size: .93rem; }
  .workspace { border-radius: 24px; }
  .workspace-head { align-items: flex-start; padding: 20px 18px 15px; }
  .document-actions .soft-button:first-of-type { width: 42px; padding: 0; }
  .document-actions .soft-button:first-of-type svg { margin: 0; }
  .document-actions .soft-button:first-of-type { font-size: 0; }
  .title-input { font-size: 1.16rem; }
  .editor-wrap { min-height: 390px; padding: 0 12px; }
  #textInput { min-height: 390px; padding: 25px 12px 36px; font-size: 1.08rem; line-height: 1.72; }
  .reader-wrap { min-height: 420px; padding: 16px 22px 40px; }
  .reader-text { font-size: 1.13rem; line-height: 1.85; }
  .workspace-footer { align-items: stretch; flex-direction: column; padding: 16px 18px 19px; }
  .voice-pill { max-width: none; width: 100%; }
  .primary-actions { justify-content: space-between; }
  .read-button { flex: 1; }
  .cursor-option { flex: 0 0 auto; }
  .feature-ribbon { grid-template-columns: 1fr; margin-top: 12px; }
  .feature-ribbon > div { padding: 8px 14px; }
  .drawer-panel { top: auto; bottom: 0; width: 100%; height: min(88dvh, 780px); border-left: 0; border-top: 1px solid var(--line); border-radius: 24px 24px 0 0; padding: 15px 20px max(22px, env(safe-area-inset-bottom)); transform: translateY(104%); }
  .drawer.open .drawer-panel { transform: translateY(0); }
  .drawer-handle { display: block; width: 40px; height: 4px; margin: 0 auto 14px; border-radius: 999px; background: var(--surface-strong); }
  .drawer-head { margin-bottom: 20px; }
  .setting-grid { margin: 22px 0; }
  .drawer-actions { position: sticky; bottom: calc(-1 * max(22px, env(safe-area-inset-bottom))); padding-bottom: max(22px, env(safe-area-inset-bottom)); background: var(--surface); }
  .player { bottom: max(9px, env(safe-area-inset-bottom)); width: calc(100% - 18px); border-radius: 20px; }
  .player-inner { min-height: 96px; grid-template-columns: minmax(0,1fr) auto; gap: 8px; padding: 10px 11px 14px; }
  .now-playing { grid-column: 1; }
  .playing-art { flex-basis: 42px; height: 42px; }
  .transport { grid-column: 2; grid-row: 1; }
  .transport-button { display: none; }
  .play-pause { width: 48px; height: 48px; }
  .player-tools { grid-column: 1 / -1; justify-self: stretch; justify-content: flex-end; border-top: 1px solid var(--line); padding-top: 6px; }
  .time-readout { margin-right: auto; }
  .player-scrubber { opacity: 1; bottom: 4px; }
  .library-modal { max-height: calc(100dvh - 20px); border-radius: 22px; }
  .modal-head { padding: 22px 20px 17px; }
  .modal-footer { padding: 12px 14px; }
  .modal-footer > span { display: none; }
  .modal-footer .read-button { width: 100%; }
  .library-item { grid-template-columns: 42px minmax(0,1fr) auto; padding: 10px 6px; }
  .library-delete { opacity: 1; }
}

@media (max-width: 420px) {
  .brand-mark { width: 38px; height: 38px; }
  .icon-button { width: 39px; height: 39px; }
  .welcome h1 { font-size: 3.15rem; }
  .eyebrow { font-size: .62rem; }
  .cursor-option span { display: none; }
  .cursor-option input { width: 19px; height: 19px; }
  .drawer-actions { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
