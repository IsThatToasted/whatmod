
(() => {
  const PREF_KEY = 'itineraryTrackerV2.settings';
  const LAYOUT_KEY = 'wetrack.displayVersion.v2';
  const WORKSPACE_KEY = 'wetrack.v2.workspace';

  const WORKSPACES = ['home','plan','explore','memories','tools','people'];

  function readPrefs(){
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); }
    catch { return {}; }
  }

  function readDisplayVersion(){
    const prefs = readPrefs();
    const stored = localStorage.getItem(LAYOUT_KEY);
    const value = stored || prefs.displayVersion || 'v1';
    return value === 'v2' ? 'v2' : 'v1';
  }

  function saveDisplayVersion(value){
    const version = value === 'v2' ? 'v2' : 'v1';
    localStorage.setItem(LAYOUT_KEY, version);
    try {
      const prefs = readPrefs();
      prefs.displayVersion = version;
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch {}
    applyDisplayVersion(version);
  }

  function currentWorkspace(){
    const value = sessionStorage.getItem(WORKSPACE_KEY) || 'home';
    return WORKSPACES.includes(value) ? value : 'home';
  }

  function setWorkspace(name, options={}){
    if (!WORKSPACES.includes(name)) name='home';
    sessionStorage.setItem(WORKSPACE_KEY, name);
    document.documentElement.dataset.v2Workspace = name;

    document.querySelectorAll('[data-v2-target]').forEach(btn => {
      const active = btn.dataset.v2Target === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });

    if (!options.noScroll) {
      requestAnimationFrame(() => window.scrollTo({top:0, behavior: options.instant ? 'auto' : 'smooth'}));
    }

    // Leaflet needs a size refresh when a previously-hidden map becomes visible.
    if (name === 'explore') {
      setTimeout(() => {
        try { window.renderDayMap?.(); } catch {}
        window.dispatchEvent(new Event('resize'));
      }, 80);
    }
  }

  function createV2Navigation(){
    if (document.getElementById('v2SideNav')) return;

    const sidebar = document.querySelector('.sidebar');
    const classicNav = sidebar?.querySelector('.side-nav');
    if (sidebar && classicNav) {
      const nav = document.createElement('nav');
      nav.id = 'v2SideNav';
      nav.className = 'v2-side-nav';
      nav.setAttribute('aria-label','Workspace navigation');
      nav.innerHTML = `
        <button type="button" data-v2-target="home"><span>⌂</span><strong>Home</strong></button>
        <button type="button" data-v2-target="plan"><span>▣</span><strong>Plan</strong></button>
        <button type="button" data-v2-target="explore"><span>⌖</span><strong>Explore</strong></button>
        <button type="button" data-v2-target="memories"><span>♡</span><strong>Memories</strong></button>
        <button type="button" data-v2-target="tools"><span>✦</span><strong>Tools</strong></button>
        <button type="button" data-v2-target="people"><span>♟</span><strong>People</strong></button>
        <a href="./settings.html"><span>⚙</span><strong>Settings</strong></a>
      `;
      classicNav.after(nav);
    }

    const mobile = document.createElement('nav');
    mobile.id = 'v2MobileNav';
    mobile.className = 'v2-mobile-nav';
    mobile.setAttribute('aria-label','Workspace navigation');
    mobile.innerHTML = `
      <button type="button" data-v2-target="home"><span>⌂</span><strong>Home</strong></button>
      <button type="button" data-v2-target="plan"><span>▣</span><strong>Plan</strong></button>
      <button type="button" data-v2-target="explore"><span>⌖</span><strong>Explore</strong></button>
      <button type="button" data-v2-target="memories"><span>♡</span><strong>Memories</strong></button>
      <button id="v2MoreBtn" type="button"><span>•••</span><strong>More</strong></button>
    `;
    document.body.append(mobile);

    const more = document.createElement('div');
    more.id = 'v2MoreSheet';
    more.className = 'v2-more-sheet';
    more.innerHTML = `
      <button type="button" class="v2-more-close" aria-label="Close">×</button>
      <div class="v2-more-head"><span>WeTrack</span><strong>More</strong></div>
      <button type="button" data-v2-target="tools"><span>✦</span>Travel Tools</button>
      <button type="button" data-v2-target="people"><span>♟</span>People & Sharing</button>
      <a href="./settings.html"><span>⚙</span>Settings</a>
    `;
    document.body.append(more);

    document.querySelectorAll('[data-v2-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        setWorkspace(btn.dataset.v2Target);
        more.classList.remove('open');
      });
    });
    document.getElementById('v2MoreBtn')?.addEventListener('click', () => more.classList.toggle('open'));
    more.querySelector('.v2-more-close')?.addEventListener('click', () => more.classList.remove('open'));
  }

  function applyDisplayVersion(version=readDisplayVersion()){
    const v = version === 'v2' ? 'v2' : 'v1';
    document.documentElement.dataset.displayVersion = v;
    document.body.classList.toggle('display-v2', v === 'v2');
    document.body.classList.toggle('display-v1', v !== 'v2');
    createV2Navigation();
    if (v === 'v2') setWorkspace(currentWorkspace(), {noScroll:true});
    else delete document.documentElement.dataset.v2Workspace;
  }

  // Existing quick actions can take V2 users into the appropriate workspace.
  function wireExistingActions(){
    document.getElementById('homeContinueBtn')?.addEventListener('click', () => {
      if (readDisplayVersion()==='v2') setWorkspace('plan');
    });
    document.getElementById('viewItineraryBtn')?.addEventListener('click', () => {
      if (readDisplayVersion()==='v2') setWorkspace('plan');
    });
  }

  window.WeTrackDisplay = {
    getVersion: readDisplayVersion,
    setVersion: saveDisplayVersion,
    setWorkspace,
    getWorkspace: currentWorkspace
  };

  applyDisplayVersion();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireExistingActions, {once:true});
  } else {
    wireExistingActions();
  }
})();
