
(() => {
  'use strict';

  const PREF_KEY = 'itineraryTrackerV2.settings';
  const workspaceOrder = ['home','plan','explore','memories','tools','people'];
  let workspace = 'home';

  const readPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); }
    catch { return {}; }
  };

  const layoutMode = () => readPrefs().appLayout || 'v2';

  function visible(el, yes) {
    if (!el) return;
    el.classList.toggle('v2-workspace-hidden', !yes);
  }

  function allWorkspaceSections() {
    return [
      document.getElementById('homeDashboard'),
      document.querySelector('.toolbar.glass'),
      document.querySelector('.trip-hero'),
      document.querySelector('.summary-grid'),
      document.querySelector('.planner-panel'),
      document.getElementById('dailyMapPanel'),
      document.querySelector('.timeline-controls'),
      document.querySelector('.share-panel'),
      document.querySelector('.details-panel'),
      document.getElementById('packingPanel'),
      document.getElementById('mustDoPanel'),
      document.getElementById('gasPanel'),
      document.getElementById('activityGeneratorPanel'),
      document.getElementById('memoryPanel'),
      document.querySelector('.progress-panel')
    ].filter(Boolean);
  }

  const groups = {
    home: () => [
      document.getElementById('homeDashboard'),
      document.querySelector('.toolbar.glass'),
      document.querySelector('.trip-hero'),
      document.querySelector('.summary-grid'),
      document.querySelector('.details-panel'),
      document.querySelector('.progress-panel')
    ],
    plan: () => [
      document.querySelector('.planner-panel'),
      document.querySelector('.timeline-controls')
    ],
    explore: () => [
      document.getElementById('dailyMapPanel')
    ],
    memories: () => [
      document.getElementById('memoryPanel')
    ],
    tools: () => [
      document.getElementById('packingPanel'),
      document.getElementById('mustDoPanel'),
      document.getElementById('gasPanel'),
      document.getElementById('activityGeneratorPanel')
    ],
    people: () => [
      document.querySelector('.share-panel')
    ]
  };

  function setWorkspace(next, options={}) {
    if (!workspaceOrder.includes(next)) next = 'home';
    workspace = next;
    document.documentElement.dataset.v2Workspace = next;

    const allowed = new Set((groups[next]?.() || []).filter(Boolean));
    allWorkspaceSections().forEach(el => visible(el, allowed.has(el)));

    document.querySelectorAll('[data-v2-nav]').forEach(btn => {
      const active = btn.dataset.v2Nav === next || (btn.dataset.v2Nav === 'more' && ['tools','people'].includes(next));
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });

    const title = document.getElementById('v2WorkspaceTitle');
    if (title) title.textContent = ({
      home:'Trip Home', plan:'Plan', explore:'Explore', memories:'Memories',
      tools:'Travel Tools', people:'People'
    })[next];

    const tripLabel = document.getElementById('v2CurrentTripLabel');
    if (tripLabel) {
      const select = document.getElementById('tripSelect');
      const label = select?.selectedOptions?.[0]?.textContent?.trim() || '';
      tripLabel.textContent = label;
      tripLabel.hidden = next === 'home' || !label;
    }

    if (next === 'explore') {
      setTimeout(() => {
        try { window.dailyRouteMap?.invalidateSize?.(); } catch {}
        try { window.renderDayMap?.(); } catch {}
      }, 120);
    }
    if (next === 'plan') {
      document.body.classList.add('agenda-view');
      document.body.classList.remove('timeline-view');
      try { window.renderTimeline?.(); } catch {}
    }
    if (!options.silent) window.scrollTo({top:0, behavior:'smooth'});
  }

  function buildDesktopNav() {
    const sidebar = document.querySelector('.sidebar');
    const oldNav = sidebar?.querySelector('.side-nav');
    if (!sidebar || !oldNav || document.getElementById('v2DesktopNav')) return;

    const nav = document.createElement('nav');
    nav.id = 'v2DesktopNav';
    nav.className = 'v2-desktop-nav';
    nav.setAttribute('aria-label','Workspace navigation');
    nav.innerHTML = `
      <button data-v2-nav="home"><span>⌂</span><b>Home</b></button>
      <button data-v2-nav="plan"><span>▣</span><b>Plan</b></button>
      <button data-v2-nav="explore"><span>◎</span><b>Explore</b></button>
      <button data-v2-nav="memories"><span>♡</span><b>Memories</b></button>
      <p>TRIP</p>
      <button data-v2-nav="tools"><span>◫</span><b>Tools</b></button>
      <button data-v2-nav="people"><span>♟</span><b>People</b></button>
      <a href="./settings.html"><span>⚙</span><b>Settings</b></a>
    `;
    oldNav.insertAdjacentElement('afterend', nav);
  }

  function buildWorkspaceHeader() {
    const main = document.querySelector('#appArea');
    if (!main || document.getElementById('v2WorkspaceHeader')) return;
    const header = document.createElement('div');
    header.id = 'v2WorkspaceHeader';
    header.className = 'v2-workspace-header';
    header.innerHTML = `
      <div><small>WETRACK</small><h1 id="v2WorkspaceTitle">Trip Home</h1><span id="v2CurrentTripLabel" class="v2-current-trip-label" hidden></span></div>
      <div class="v2-trip-shortcut">
        <button type="button" data-v2-nav="plan">Continue planning →</button>
      </div>`;
    main.prepend(header);
  }

  function buildMobileNav() {
    if (document.getElementById('v2MobileNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'v2MobileNav';
    nav.className = 'v2-mobile-nav';
    nav.setAttribute('aria-label','Workspace navigation');
    nav.innerHTML = `
      <button data-v2-nav="home"><span>⌂</span><b>Home</b></button>
      <button data-v2-nav="plan"><span>▣</span><b>Plan</b></button>
      <button data-v2-nav="explore"><span>◎</span><b>Explore</b></button>
      <button data-v2-nav="memories"><span>♡</span><b>Memories</b></button>
      <button data-v2-nav="more"><span>•••</span><b>More</b></button>`;
    document.body.appendChild(nav);

    const more = document.createElement('div');
    more.id = 'v2MoreSheet';
    more.className = 'v2-more-sheet';
    more.setAttribute('role','dialog');
    more.setAttribute('aria-modal','true');
    more.setAttribute('aria-labelledby','v2MoreTitle');
    more.innerHTML = `
      <section class="v2-more-panel">
        <div class="v2-sheet-grabber" aria-hidden="true"></div>
        <header class="v2-more-header">
          <div>
            <span class="v2-more-eyebrow">WETRACK</span>
            <h2 id="v2MoreTitle">More</h2>
            <p>Trip tools, travelers and app settings.</p>
          </div>
          <button type="button" class="v2-sheet-close" aria-label="Close More menu">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>
          </button>
        </header>
        <div class="v2-more-group">
          <span class="v2-more-group-label">TRIP</span>
          <button data-v2-nav="tools" class="v2-more-row">
            <span class="v2-more-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm3 0v13m8-13v13"/></svg>
            </span>
            <span class="v2-more-copy"><b>Travel Tools</b><small>Packing, Must Do, gas & activity ideas</small></span>
            <span class="v2-more-chevron" aria-hidden="true">›</span>
          </button>
          <button data-v2-nav="people" class="v2-more-row">
            <span class="v2-more-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-1a3 3 0 1 0 0-6m-7 9c-3.6 0-6.5 2.1-6.5 4.8V20h13v-2.2C15 15.1 12.1 13 8.5 13Zm7.3-.1c3 .3 5.2 2.2 5.2 4.5V20h-4"/></svg>
            </span>
            <span class="v2-more-copy"><b>People</b><small>Travelers, collaboration and invitations</small></span>
            <span class="v2-more-chevron" aria-hidden="true">›</span>
          </button>
        </div>
        <div class="v2-more-group">
          <span class="v2-more-group-label">APP</span>
          <a href="./settings.html" class="v2-more-row">
            <span class="v2-more-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4Zm7.2-3.2c0-.5 0-1-.1-1.4l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.4-1.4L14 2.7h-4l-.4 2.6a8 8 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.5a8.8 8.8 0 0 0 0 2.8l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.4 1.4l.4 2.6h4l.4-2.6a8 8 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.4Z"/></svg>
            </span>
            <span class="v2-more-copy"><b>Settings</b><small>Display, notifications, account and preferences</small></span>
            <span class="v2-more-chevron" aria-hidden="true">›</span>
          </a>
        </div>
        <div class="v2-more-footer"><span>WeTrack</span><small>Plan together. Remember everything.</small></div>
      </section>`;
    document.body.appendChild(more);

    const openMore = () => {
      more.classList.add('open');
      document.body.classList.add('v2-sheet-open');
      setTimeout(() => more.querySelector('.v2-sheet-close')?.focus(), 60);
    };
    const closeMore = () => {
      more.classList.remove('open');
      document.body.classList.remove('v2-sheet-open');
    };

    nav.querySelector('[data-v2-nav="more"]')?.addEventListener('click', e => {
      e.preventDefault();
      openMore();
    });
    more.querySelector('.v2-sheet-close')?.addEventListener('click', closeMore);
    more.addEventListener('click', e => {
      if (e.target === more) closeMore();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && more.classList.contains('open')) closeMore();
    });
  }

  function bindNavigation() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-v2-nav]');
      if (!btn) return;
      const target = btn.dataset.v2Nav;
      if (!workspaceOrder.includes(target)) return;
      e.preventDefault();
      document.getElementById('v2MoreSheet')?.classList.remove('open'); document.body.classList.remove('v2-sheet-open');
      setWorkspace(target);
    });

    document.getElementById('homeContinueBtn')?.addEventListener('click', () => {
      if (layoutMode() === 'v2') setWorkspace('plan');
    });
    document.getElementById('viewItineraryBtn')?.addEventListener('click', () => {
      if (layoutMode() === 'v2') setWorkspace('plan');
    });
  }

  function applyLayout() {
    const mode = layoutMode();
    document.documentElement.dataset.displayVersion = mode;
    document.body.classList.toggle('display-v2', mode === 'v2');
    document.body.classList.toggle('display-v1', mode !== 'v2');

    if (mode === 'v2') {
      setWorkspace(workspace, {silent:true});
    } else {
      allWorkspaceSections().forEach(el => visible(el, true));
      delete document.documentElement.dataset.v2Workspace;
    }
  }

  buildDesktopNav();
  buildWorkspaceHeader();
  buildMobileNav();
  bindNavigation();
  applyLayout();

  window.addEventListener('storage', e => {
    if (e.key === PREF_KEY) applyLayout();
  });
  window.WeTrackDisplayV2 = { setWorkspace, applyLayout };
})();
