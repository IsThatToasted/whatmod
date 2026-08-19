
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
      document.querySelector('.toolbar.glass'),
      document.querySelector('.planner-panel'),
      document.querySelector('.timeline-controls')
    ],
    explore: () => [
      document.querySelector('.toolbar.glass'),
      document.getElementById('dailyMapPanel')
    ],
    memories: () => [
      document.querySelector('.toolbar.glass'),
      document.getElementById('memoryPanel')
    ],
    tools: () => [
      document.querySelector('.toolbar.glass'),
      document.getElementById('packingPanel'),
      document.getElementById('mustDoPanel'),
      document.getElementById('gasPanel'),
      document.getElementById('activityGeneratorPanel')
    ],
    people: () => [
      document.querySelector('.toolbar.glass'),
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
      <div><small>WETRACK</small><h1 id="v2WorkspaceTitle">Trip Home</h1></div>
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
    more.innerHTML = `
      <button type="button" class="v2-sheet-close" aria-label="Close">×</button>
      <h2>More</h2>
      <button data-v2-nav="tools"><span>◫</span><b>Travel Tools</b><small>Packing, Must Do, gas & activities</small></button>
      <button data-v2-nav="people"><span>♟</span><b>People</b><small>Travelers & invitations</small></button>
      <a href="./settings.html"><span>⚙</span><b>Settings</b><small>Theme, display & account</small></a>`;
    document.body.appendChild(more);

    nav.querySelector('[data-v2-nav="more"]')?.addEventListener('click', e => {
      e.preventDefault();
      more.classList.add('open');
    });
    more.querySelector('.v2-sheet-close')?.addEventListener('click', () => more.classList.remove('open'));
    more.addEventListener('click', e => {
      if (e.target === more) more.classList.remove('open');
    });
  }

  function bindNavigation() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-v2-nav]');
      if (!btn) return;
      const target = btn.dataset.v2Nav;
      if (!workspaceOrder.includes(target)) return;
      e.preventDefault();
      document.getElementById('v2MoreSheet')?.classList.remove('open');
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
