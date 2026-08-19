
/* ============================================================
   WeTrack V3.1 — V2 Workspace Presentation Layer
   This file intentionally does not own Supabase/data logic.
   It only changes navigation/presentation and calls existing controls.
   ============================================================ */
(() => {
  const PREF_KEY = 'itineraryTrackerV2.settings';
  const SPACES = {
    home: {
      kicker: 'Trip command center',
      title: 'Home',
      subtitle: 'The next thing that matters, your readiness, travelers, and trip snapshot.'
    },
    plan: {
      kicker: 'Itinerary',
      title: 'Plan',
      subtitle: 'Build the day, move events, adjust timing, and keep the schedule readable.'
    },
    explore: {
      kicker: 'Route & places',
      title: 'Explore',
      subtitle: 'See the selected day on a full-width map without planner clutter.'
    },
    memories: {
      kicker: 'Trip journal',
      title: 'Memories',
      subtitle: 'Capture photos and moments now, then turn the trip into a recap later.'
    },
    tools: {
      kicker: 'Travel toolkit',
      title: 'Tools',
      subtitle: 'Packing, shared Must Dos, fuel estimates, and nearby activity ideas.'
    },
    people: {
      kicker: 'Travel together',
      title: 'People',
      subtitle: 'Invite travelers, manage collaboration, and open traveler profiles.'
    }
  };

  const $$ = (q, root=document) => Array.from(root.querySelectorAll(q));
  const $ = id => document.getElementById(id);

  function prefs(){
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) { return {}; }
  }
  function displayVersion(){ return prefs().displayVersion === 'v1' ? 'v1' : 'v2'; }

  const assignments = [
    ['homeDashboard','home'],
    [null,'home','.toolbar'],
    [null,'home','.trip-hero'],
    [null,'home','.summary-grid'],
    [null,'plan','.planner-panel'],
    [null,'plan','.timeline-controls'],
    ['dailyMapPanel','explore'],
    ['memoryPanel','memories'],
    [null,'memories','.progress-panel'],
    ['packingPanel','tools'],
    ['mustDoPanel','tools'],
    ['gasPanel','tools'],
    ['activityGeneratorPanel','tools'],
    [null,'people','.share-panel'],
    [null,'home people','.details-panel']
  ];

  function markSpaces(){
    assignments.forEach(([id, space, selector]) => {
      const el = id ? $(id) : document.querySelector(selector);
      if (el) el.dataset.v2Space = space;
    });
  }

  function currentWorkspace(){
    const saved = sessionStorage.getItem('wetrack.v2.workspace');
    return SPACES[saved] ? saved : 'home';
  }

  function updateTripLabel(){
    const select = $('tripSelect');
    const label = $('v2CurrentTripLabel');
    if (!label || !select) return;
    const text = select.options?.[select.selectedIndex]?.textContent?.trim() || 'Your trip';
    label.textContent = text;
  }

  const TOOL_SECTIONS = {
    packing: 'packingPanel',
    mustdo: 'mustDoPanel',
    gas: 'gasPanel',
    activities: 'activityGeneratorPanel'
  };
  function currentTool(){
    const value=sessionStorage.getItem('wetrack.v2.tool');
    return TOOL_SECTIONS[value] ? value : 'packing';
  }
  function setTool(tool){
    if (!TOOL_SECTIONS[tool]) tool='packing';
    sessionStorage.setItem('wetrack.v2.tool',tool);
    Object.entries(TOOL_SECTIONS).forEach(([key,id]) => {
      const el=$(id);
      if (el) el.classList.toggle('v2-tool-active',key===tool);
    });
    $$('[data-v2-tool]').forEach(btn => btn.classList.toggle('active',btn.dataset.v2Tool===tool));
    const target=$(TOOL_SECTIONS[tool]);
    requestAnimationFrame(()=>target?.scrollIntoView({behavior:'smooth',block:'start'}));
  }

  function workspaceActions(space){
    const box = $('v2WorkspaceActions');
    if (!box) return;
    box.innerHTML = '';
    const addButton = (label, action, cls='') => {
      const b = document.createElement('button');
      b.type='button'; b.className=cls; b.textContent=label; b.addEventListener('click',action); box.appendChild(b);
    };
    if (space === 'plan') {
      addButton('+ Add event', () => $('addAnyItemBtn')?.click(), 'v2-primary-action');
    } else if (space === 'explore') {
      const a = $('dailyDirectionsLink');
      if (a && !a.classList.contains('hidden') && a.href) {
        const link = document.createElement('a');
        link.className='v2-primary-action'; link.textContent='Open directions ↗'; link.href=a.href; link.rel='noopener';
        box.appendChild(link);
      }
    } else if (space === 'memories') {
      addButton('📷 Add Memory', () => $('memoryPhotoBtn')?.click(), 'v2-primary-action');
    } else if (space === 'tools') {
      addButton('+ Packing item', () => { $('packingInput')?.focus(); }, 'v2-secondary-action');
      addButton('+ Must Do', () => { $('mustDoInput')?.focus(); }, 'v2-secondary-action');
    } else if (space === 'people') {
      addButton('Invite people', () => $('createInviteBtn')?.focus(), 'v2-primary-action');
    }
  }

  function setWorkspace(space, opts={scroll:true}){
    if (!SPACES[space]) space='home';
    sessionStorage.setItem('wetrack.v2.workspace', space);
    document.documentElement.dataset.v2Workspace = space;
    document.body.dataset.v2Workspace = space;

    const meta=SPACES[space];
    if ($('v2WorkspaceKicker')) $('v2WorkspaceKicker').textContent=meta.kicker;
    if ($('v2WorkspaceTitle')) $('v2WorkspaceTitle').textContent=meta.title;
    if ($('v2WorkspaceSubtitle')) $('v2WorkspaceSubtitle').textContent=meta.subtitle;

    $$('[data-v2-go]').forEach(el => {
      const active = el.dataset.v2Go === space;
      el.classList.toggle('active',active);
      if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    });
    $('v2MoreMenu')?.classList.add('hidden');
    workspaceActions(space);
    updateTripLabel();
    if (space === 'tools') setTool(currentTool());

    // Leaflet needs a resize after becoming visible.
    if (space === 'explore') {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        try { window.renderDayMap?.(); } catch (_) {}
      });
    }
    if (opts.scroll) {
      requestAnimationFrame(() => $('v2WorkspaceHeading')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }
  }

  function applyDisplay(){
    const version=displayVersion();
    document.documentElement.dataset.displayVersion=version;
    document.body.dataset.displayVersion=version;
    if (version==='v2') setWorkspace(currentWorkspace(),{scroll:false});
  }

  function bind(){
    markSpaces();
    $$('[data-v2-go]').forEach(el => el.addEventListener('click', e => {
      if (el.tagName === 'A') return;
      e.preventDefault();
      setWorkspace(el.dataset.v2Go);
    }));
    $$('[data-v2-tool]').forEach(btn => btn.addEventListener('click', e => {
      e.preventDefault();
      setTool(btn.dataset.v2Tool);
    }));
    $('homeContinueBtn')?.addEventListener('click', () => {
      if (displayVersion()==='v2') setWorkspace('plan');
    });
    $('viewItineraryBtn')?.addEventListener('click', () => {
      if (displayVersion()==='v2') setWorkspace('plan');
    });
    $('v2MoreBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      $('v2MoreMenu')?.classList.toggle('hidden');
    });
    document.addEventListener('click', e => {
      const menu=$('v2MoreMenu');
      if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !e.target.closest('#v2MoreBtn')) menu.classList.add('hidden');
    });

    $('tripSelect')?.addEventListener('change', () => {
      updateTripLabel();
      if (document.documentElement.dataset.displayVersion==='v2') setTimeout(()=>setWorkspace(currentWorkspace(),{scroll:false}),50);
    });

    // V2 sidebar "People" and top-level workspace links remain stable after dynamic rerenders.
    window.addEventListener('storage', e => {
      if (e.key===PREF_KEY) applyDisplay();
    });

    applyDisplay();
    updateTripLabel();

    // Keep label synchronized with dynamically loaded trips.
    const select=$('tripSelect');
    if (select) new MutationObserver(updateTripLabel).observe(select,{childList:true,subtree:true,attributes:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);
  else bind();

  window.WeTrackDisplayV2={setWorkspace,applyDisplay};
})();
