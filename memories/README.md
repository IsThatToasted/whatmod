import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://gapqvyfoxxyoymtogvbt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JGjmBr-Btu_GT2cOw5Tf7A_bItVoMH6';
const STORAGE_BUCKET = 'memory-media';
const APP_VERSION = '1.0.0';
const DEMO_STORAGE_KEY = 'whatmod-memories-demo-v1';
const THEME_KEY = 'whatmod-memories-theme';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const state = {
  mode: 'landing',
  authMode: 'signin',
  user: null,
  profile: null,
  memories: [],
  people: [],
  places: [],
  chapters: [],
  pathways: [],
  links: [],
  activeView: 'today',
  timelineFilter: 'all',
  timelineSort: 'desc',
  fragmentSort: 'new',
  search: '',
  pendingFiles: [],
  existingMedia: [],
  realtimeChannel: null,
  realtimeEnabled: true,
  constellation: {
    nodes: [],
    links: [],
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    moved: false,
    lastX: 0,
    lastY: 0,
    animationFrame: null
  }
};

const prompts = [
  ['A room from your childhood', 'Close your eyes for a moment. What is the first object you can place in the room?', '▣'],
  ['A meal you still remember', 'Who was at the table, what could you smell, and what made that meal different?', '◒'],
  ['A sound from another chapter', 'A voice, song, appliance, street, or animal can open a surprisingly clear path.', '♪'],
  ['The first time somewhere felt like home', 'It may have been a building, a person, a neighborhood, or only a brief moment.', '⌂'],
  ['A person you have not thought about lately', 'Where did you usually see them, and what detail about them appears first?', '♧'],
  ['A day that changed direction', 'What did you expect when the day began, and what was different by the end?', '↝'],
  ['A tradition that quietly disappeared', 'What happened every time, who took part, and when did it begin to fade?', '∞'],
  ['The vehicle that belongs to a chapter', 'Picture the seats, dashboard, smell, music, passengers, and roads around it.', '◇'],
  ['Weather tied to a strong memory', 'Heat, snow, rain, wind, or a particular kind of light can carry a whole scene.', '☂'],
  ['Something ordinary you miss', 'The smallest routines are often the details that disappear first.', '○']
];

const gradients = [
  'linear-gradient(145deg,#544190,#a45f83)',
  'linear-gradient(145deg,#2d6674,#6c65a2)',
  'linear-gradient(145deg,#7e5b39,#b96672)',
  'linear-gradient(145deg,#3c537e,#87689f)',
  'linear-gradient(145deg,#4c705f,#96736b)',
  'linear-gradient(145deg,#70536d,#4b6f84)',
  'linear-gradient(145deg,#65508b,#4a8b91)',
  'linear-gradient(145deg,#875a66,#6d6840)'
];

const entityGradients = {
  violet: 'linear-gradient(135deg,#7d61e8,#a883ff)',
  rose: 'linear-gradient(135deg,#c85b87,#ff98bd)',
  amber: 'linear-gradient(135deg,#a96e36,#efbd68)',
  aqua: 'linear-gradient(135deg,#318c83,#71dccb)',
  sage: 'linear-gradient(135deg,#55785e,#9ccba3)'
};

const demoSeed = {
  profile: {
    id: 'demo-user',
    display_name: 'Demo Explorer',
    current_chapter: 'Building a life worth remembering',
    created_at: new Date().toISOString()
  },
  people: [
    { id: 'p1', user_id: 'demo-user', name: 'Ashley', kind: 'Partner', notes: 'A central person in many recent chapters.', color: 'rose' },
    { id: 'p2', user_id: 'demo-user', name: 'Grandma Rose', kind: 'Family', notes: 'Her kitchen, stories, and summer visits are recurring anchors.', color: 'amber' },
    { id: 'p3', user_id: 'demo-user', name: 'Marcus', kind: 'Childhood friend', notes: 'School years, bikes, games, and the old neighborhood.', color: 'aqua' },
    { id: 'p4', user_id: 'demo-user', name: 'Dad', kind: 'Family', notes: 'Road trips, work lessons, and Saturday mornings.', color: 'sage' }
  ],
  places: [
    { id: 'l1', user_id: 'demo-user', name: 'Bluewater Lake', kind: 'Vacation place', notes: 'A quiet lake with a dock and cedar cabins.', color: 'aqua' },
    { id: 'l2', user_id: 'demo-user', name: 'Maple Street House', kind: 'Childhood home', notes: 'The house with the narrow stairs and big backyard.', color: 'violet' },
    { id: 'l3', user_id: 'demo-user', name: 'First Apartment', kind: 'Home', notes: 'Small, imperfect, and completely mine.', color: 'rose' },
    { id: 'l4', user_id: 'demo-user', name: 'Grandma’s Kitchen', kind: 'Family home', notes: 'Yellow light, radio by the window, cinnamon and coffee.', color: 'amber' }
  ],
  chapters: [
    { id: 'c1', user_id: 'demo-user', name: 'The Maple Street Years', description: 'Childhood, school, the backyard, and the neighborhood.', color: 'violet', start_year: 2002, end_year: 2010 },
    { id: 'c2', user_id: 'demo-user', name: 'Learning Independence', description: 'First apartment, early work, mistakes, and small victories.', color: 'rose', start_year: 2018, end_year: 2020 },
    { id: 'c3', user_id: 'demo-user', name: 'Building Us', description: 'Travel, partnership, routines, and imagining the future.', color: 'aqua', start_year: 2024, end_year: null }
  ],
  memories: [
    {
      id: 'm1', user_id: 'demo-user', title: 'The summer at Bluewater Lake', body: 'The first thing I remember is the sound of water under the dock. We arrived late in the afternoon, and the cabin smelled like cedar and sunscreen. Everyone unpacked slowly because nobody wanted to miss the light on the lake.', memory_type: 'memory', occurred_on: '2018-07-14', date_precision: 'month', time_of_day: 'Afternoon', life_chapter: 'Learning Independence', emotions: ['Joy','Nostalgia','Calm'], sensory: { sounds: 'Water under the dock, an old radio', smells: 'Cedar, sunscreen, charcoal', visuals: 'Gold light, green water, red cooler' }, tags: ['summer','lake','family','vacation'], certainty: 'likely', visibility: 'private', is_favorite: true, created_at: daysAgo(2), updated_at: daysAgo(2), people: [{id:'p2',name:'Grandma Rose'}], place: {id:'l1',name:'Bluewater Lake'}, media: []
    },
    {
      id: 'm2', user_id: 'demo-user', title: 'The keys to my first apartment', body: 'I sat in the empty living room longer than I expected. There was almost nothing inside, but the quiet felt enormous. I remember putting the keys on the windowsill and taking a picture because the moment felt official.', memory_type: 'memory', occurred_on: '2018-03-03', date_precision: 'exact', time_of_day: 'Evening', life_chapter: 'Learning Independence', emotions: ['Pride','Excitement','Fear'], sensory: { sounds: 'The refrigerator humming', smells: 'Fresh paint and cardboard', visuals: 'Keys on a white windowsill' }, tags: ['home','firsts','independence'], certainty: 'confirmed', visibility: 'private', is_favorite: true, created_at: daysAgo(8), updated_at: daysAgo(8), people: [], place: {id:'l3',name:'First Apartment'}, media: []
    },
    {
      id: 'm3', user_id: 'demo-user', title: 'Saturday pancakes in Grandma’s kitchen', body: 'The radio was always a little too loud and the first pancake was always oddly shaped. She used the same chipped bowl every time. I can still picture the yellow light over the table.', memory_type: 'memory', occurred_on: '2007-10-01', date_precision: 'season', time_of_day: 'Morning', life_chapter: 'The Maple Street Years', emotions: ['Love','Calm','Nostalgia'], sensory: { sounds: 'Oldies radio and a whisk against the bowl', smells: 'Coffee, cinnamon, butter', visuals: 'Yellow light and a chipped blue bowl' }, tags: ['family','food','tradition','childhood'], certainty: 'likely', visibility: 'private', is_favorite: false, created_at: daysAgo(10), updated_at: daysAgo(10), people: [{id:'p2',name:'Grandma Rose'}], place: {id:'l4',name:'Grandma’s Kitchen'}, media: []
    },
    {
      id: 'm4', user_id: 'demo-user', title: 'The night drive with no destination', body: 'We said we were going out for coffee and somehow ended up two hours away. The windows were cracked, one song kept repeating, and neither of us wanted to turn around.', memory_type: 'memory', occurred_on: '2025-05-23', date_precision: 'exact', time_of_day: 'Night', life_chapter: 'Building Us', emotions: ['Love','Excitement','Wonder'], sensory: { sounds: 'The same song three times', smells: 'Rain and coffee', visuals: 'Dashboard glow and wet roads' }, tags: ['road trip','music','rain','relationship'], certainty: 'confirmed', visibility: 'private', is_favorite: true, created_at: daysAgo(1), updated_at: daysAgo(1), people: [{id:'p1',name:'Ashley'}], place: null, media: []
    },
    {
      id: 'm5', user_id: 'demo-user', title: 'Bikes behind Maple Street', body: 'Marcus and I had a route through the alleys that felt like a secret map. We used a broken wooden ramp behind the garage and pretended the empty lot was much larger than it was.', memory_type: 'memory', occurred_on: '2008-06-01', date_precision: 'season', time_of_day: 'Afternoon', life_chapter: 'The Maple Street Years', emotions: ['Joy','Excitement'], sensory: { sounds: 'Bike chains and cicadas', smells: 'Cut grass and hot pavement', visuals: 'A plywood ramp behind the garage' }, tags: ['childhood','friends','summer','bikes'], certainty: 'likely', visibility: 'private', is_favorite: false, created_at: daysAgo(14), updated_at: daysAgo(14), people: [{id:'p3',name:'Marcus'}], place: {id:'l2',name:'Maple Street House'}, media: []
    },
    {
      id: 'm6', user_id: 'demo-user', title: 'Dad teaching me to change a tire', body: 'I was impatient and kept putting the jack in the wrong place. He did not take over. He just waited until I slowed down enough to see what he had been pointing at.', memory_type: 'memory', occurred_on: '2010-04-01', date_precision: 'month', time_of_day: 'Morning', life_chapter: 'The Maple Street Years', emotions: ['Pride','Love'], sensory: { sounds: 'Tools on concrete', smells: 'Rubber and garage dust', visuals: 'Morning sun across the driveway' }, tags: ['dad','learning','cars','home'], certainty: 'likely', visibility: 'private', is_favorite: false, created_at: daysAgo(21), updated_at: daysAgo(21), people: [{id:'p4',name:'Dad'}], place: {id:'l2',name:'Maple Street House'}, media: []
    },
    {
      id: 'm7', user_id: 'demo-user', title: 'The red hotel hallway', body: 'A long red hallway with gold numbers on the doors. Rain against a window at the far end. Someone laughing behind me, but I cannot place the voice or why we were there.', memory_type: 'fragment', occurred_on: '2011-01-01', date_precision: 'approximate', time_of_day: 'Night', life_chapter: '', emotions: ['Confusion','Nostalgia'], sensory: { sounds: 'Laughter and an ice machine', smells: '', visuals: 'Red carpet, gold door numbers, rain' }, tags: ['hotel','rain','travel'], certainty: 'uncertain', visibility: 'private', is_favorite: false, created_at: daysAgo(3), updated_at: daysAgo(3), people: [], place: null, media: []
    },
    {
      id: 'm8', user_id: 'demo-user', title: 'A blue coat near a train platform', body: 'I remember waiting beside someone in a blue coat. It was cold enough to see our breath. I cannot tell whether we were leaving or waiting for someone to arrive.', memory_type: 'fragment', occurred_on: null, date_precision: 'unknown', time_of_day: 'Evening', life_chapter: '', emotions: ['Wonder','Confusion'], sensory: { sounds: 'A distant train announcement', smells: 'Cold air and coffee', visuals: 'A bright blue coat and white breath' }, tags: ['train','winter','unknown person'], certainty: 'uncertain', visibility: 'private', is_favorite: false, created_at: daysAgo(5), updated_at: daysAgo(5), people: [], place: null, media: []
    }
  ],
  pathways: [
    { id: 'pw1', user_id: 'demo-user', title: 'Places that felt like home', description: 'The rooms, buildings, and people that gave me a sense of belonging.', icon: '⌂', color: 'violet', memory_ids: ['m2','m3','m5','m6'], created_at: daysAgo(7) },
    { id: 'pw2', user_id: 'demo-user', title: 'Summers that stayed with me', description: 'Heat, water, bikes, long light, and the feeling that the day would not end.', icon: '☀', color: 'amber', memory_ids: ['m1','m5'], created_at: daysAgo(4) },
    { id: 'pw3', user_id: 'demo-user', title: 'Building us', description: 'Small adventures and moments that changed how I imagined the future.', icon: '♡', color: 'rose', memory_ids: ['m4'], created_at: daysAgo(1) }
  ],
  links: [
    { id:'link1', source_memory_id:'m3', target_memory_id:'m1', relation_type:'person' },
    { id:'link2', source_memory_id:'m5', target_memory_id:'m6', relation_type:'place' },
    { id:'link3', source_memory_id:'m2', target_memory_id:'m4', relation_type:'chapter' }
  ]
};

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function normalizeList(value = '') {
  return [...new Set(String(value).split(',').map(item => item.trim()).filter(Boolean))];
}

function formatDate(memory, options = {}) {
  if (!memory.occurred_on) return 'Date unknown';
  const date = new Date(`${memory.occurred_on}T12:00:00`);
  if (Number.isNaN(date.getTime())) return memory.occurred_on;
  const precision = memory.date_precision || 'exact';
  if (precision === 'year' || precision === 'approximate') return `${precision === 'approximate' ? 'Around ' : ''}${date.getFullYear()}`;
  if (precision === 'season') return `${seasonForMonth(date.getMonth())} ${date.getFullYear()}`;
  if (precision === 'month') return date.toLocaleDateString(undefined, { month:'long', year:'numeric' });
  return date.toLocaleDateString(undefined, options.compact ? { month:'short', day:'numeric', year:'numeric' } : { month:'long', day:'numeric', year:'numeric' });
}

function seasonForMonth(month) {
  if ([11,0,1].includes(month)) return 'Winter';
  if ([2,3,4].includes(month)) return 'Spring';
  if ([5,6,7].includes(month)) return 'Summer';
  return 'Autumn';
}

function memoryEmoji(memory) {
  const tags = (memory.tags || []).map(t => t.toLowerCase());
  const title = `${memory.title || ''} ${tags.join(' ')}`.toLowerCase();
  if (memory.memory_type === 'fragment') return '◌';
  if (/lake|water|beach|ocean|swim/.test(title)) return '≈';
  if (/home|house|apartment|room/.test(title)) return '⌂';
  if (/music|song|concert/.test(title)) return '♪';
  if (/road|car|drive|trip/.test(title)) return '◇';
  if (/food|meal|kitchen|pancake/.test(title)) return '◒';
  if (/school|childhood|bike/.test(title)) return '✦';
  if (/love|relationship|partner/.test(title)) return '♡';
  return '✧';
}

function memoryGradient(memory) {
  let hash = 0;
  for (const char of String(memory.id || memory.title || 'memory')) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  return gradients[Math.abs(hash) % gradients.length];
}

function colorWash(color = 'violet') {
  const values = {
    violet: 'rgba(157,124,255,.18)',
    rose: 'rgba(255,139,184,.18)',
    amber: 'rgba(247,189,104,.18)',
    aqua: 'rgba(109,227,208,.16)',
    sage: 'rgba(156,203,163,.17)'
  };
  return values[color] || values.violet;
}

function initials(name = 'M') {
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase() || 'M';
}

function toast(title, message = '', type = 'success') {
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'is-error' : ''}`;
  el.innerHTML = `<span class="toast__icon">${type === 'error' ? '!' : '✓'}</span><div><b>${escapeHTML(title)}</b>${message ? `<small>${escapeHTML(message)}</small>` : ''}</div>`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4400);
}

function setSyncing(isSyncing, label = 'Syncing your archive…') {
  const el = $('#sync-indicator');
  if (!el) return;
  $('b', el).textContent = label;
  el.hidden = !isSyncing;
}

function showLanding() {
  state.mode = 'landing';
  $('#landing').hidden = false;
  $('#app-shell').hidden = true;
  document.body.classList.remove('in-app');
}

async function enterApp(mode) {
  state.mode = mode;
  $('#landing').hidden = true;
  $('#app-shell').hidden = false;
  document.body.classList.add('in-app');
  setSyncing(true, 'Opening your archive…');
  try {
    await loadData();
    renderAll();
    navigate(location.hash.replace('#','') || 'today', false);
    if (mode === 'supabase' && state.realtimeEnabled) subscribeRealtime();
  } catch (error) {
    console.error(error);
    toast('Could not open the archive', friendlyError(error), 'error');
    if (mode === 'supabase') {
      showLanding();
    }
  } finally {
    setSyncing(false);
  }
}

function friendlyError(error) {
  return error?.message || error?.error_description || 'Please try again.';
}

function demoData() {
  const stored = localStorage.getItem(DEMO_STORAGE_KEY);
  if (!stored) return clone(demoSeed);
  try {
    const parsed = JSON.parse(stored);
    return { ...clone(demoSeed), ...parsed };
  } catch {
    return clone(demoSeed);
  }
}

function saveDemoData() {
  const payload = {
    profile: state.profile,
    memories: state.memories,
    people: state.people,
    places: state.places,
    chapters: state.chapters,
    pathways: state.pathways,
    links: state.links
  };
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    toast('Demo storage is full', 'Large photos can exceed browser storage. Sign in to use Supabase Storage.', 'error');
    console.warn(error);
  }
}

async function loadData() {
  if (state.mode === 'demo') {
    const data = demoData();
    state.user = { id:'demo-user', email:'demo@memories.local' };
    state.profile = data.profile;
    state.memories = data.memories || [];
    state.people = data.people || [];
    state.places = data.places || [];
    state.chapters = data.chapters || [];
    state.pathways = data.pathways || [];
    state.links = data.links || [];
    return;
  }

  if (!state.user) throw new Error('Your session is no longer available.');

  const userId = state.user.id;
  const [profileRes, memoriesRes, mediaRes, peopleRes, memoryPeopleRes, placesRes, memoryPlacesRes, chaptersRes, pathwaysRes, pathwayMemoriesRes, linksRes] = await Promise.all([
    supabase.from('memory_profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('memories').select('*').eq('user_id', userId).order('occurred_on', { ascending:false, nullsFirst:false }),
    supabase.from('memory_media').select('*').eq('user_id', userId).order('sort_order'),
    supabase.from('memory_people').select('*').eq('user_id', userId).order('name'),
    supabase.from('memory_person_links').select('*').eq('user_id', userId),
    supabase.from('memory_places').select('*').eq('user_id', userId).order('name'),
    supabase.from('memory_place_links').select('*').eq('user_id', userId),
    supabase.from('memory_life_chapters').select('*').eq('user_id', userId).order('start_year', { ascending:true, nullsFirst:false }),
    supabase.from('memory_pathways').select('*').eq('user_id', userId).order('updated_at', { ascending:false }),
    supabase.from('memory_pathway_items').select('*').eq('user_id', userId).order('sort_order'),
    supabase.from('memory_links').select('*').eq('user_id', userId)
  ]);

  const errors = [profileRes, memoriesRes, mediaRes, peopleRes, memoryPeopleRes, placesRes, memoryPlacesRes, chaptersRes, pathwaysRes, pathwayMemoriesRes, linksRes].map(result => result.error).filter(Boolean);
  if (errors.length) throw errors[0];

  state.profile = profileRes.data || {
    id: userId,
    display_name: state.user.user_metadata?.full_name || state.user.email?.split('@')[0] || 'My archive',
    current_chapter: 'The chapter I am living'
  };
  state.people = peopleRes.data || [];
  state.places = placesRes.data || [];
  state.chapters = chaptersRes.data || [];
  state.links = linksRes.data || [];

  const signedMedia = await Promise.all((mediaRes.data || []).map(async media => {
    if (!media.storage_path) return media;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(media.storage_path, 60 * 60 * 6);
    return { ...media, url: error ? '' : data.signedUrl };
  }));

  state.memories = (memoriesRes.data || []).map(memory => {
    const personIds = (memoryPeopleRes.data || []).filter(link => link.memory_id === memory.id).map(link => link.person_id);
    const placeLink = (memoryPlacesRes.data || []).find(link => link.memory_id === memory.id);
    return {
      ...memory,
      people: state.people.filter(person => personIds.includes(person.id)),
      place: state.places.find(place => place.id === placeLink?.place_id) || null,
      media: signedMedia.filter(media => media.memory_id === memory.id)
    };
  });

  state.pathways = (pathwaysRes.data || []).map(pathway => ({
    ...pathway,
    memory_ids: (pathwayMemoriesRes.data || []).filter(item => item.pathway_id === pathway.id).map(item => item.memory_id)
  }));
}

function subscribeRealtime() {
  if (state.realtimeChannel) supabase.removeChannel(state.realtimeChannel);
  if (!state.user || state.mode !== 'supabase') return;
  const userId = state.user.id;
  let timer;
  state.realtimeChannel = supabase.channel(`memory-archive-${userId}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'memories', filter:`user_id=eq.${userId}` }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'memory_media', filter:`user_id=eq.${userId}` }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'memory_people', filter:`user_id=eq.${userId}` }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'memory_places', filter:`user_id=eq.${userId}` }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'memory_pathways', filter:`user_id=eq.${userId}` }, refresh)
    .subscribe();

  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!state.realtimeEnabled || state.mode !== 'supabase') return;
      try {
        await loadData();
        renderAll();
      } catch (error) {
        console.warn('Realtime refresh failed', error);
      }
    }, 450);
  }
}

function renderAll() {
  renderProfile();
  renderDashboard();
  renderTimeline();
  renderPathways();
  renderFragments();
  renderLibrary();
  prepareConstellation();
}

function renderProfile() {
  const name = state.profile?.display_name || state.user?.user_metadata?.full_name || state.user?.email?.split('@')[0] || 'My archive';
  $('#profile-name').textContent = name;
  $('#profile-avatar').textContent = initials(name);
  $('#profile-status').textContent = state.mode === 'demo' ? 'Local demo archive' : 'Private & synced';
  const currentChapter = state.profile?.current_chapter || state.chapters.find(chapter => !chapter.end_year)?.name || 'The chapter I am living';
  $('#current-chapter-label').textContent = currentChapter;
  $('#current-chapter-count').textContent = `${state.memories.filter(memory => memory.life_chapter === currentChapter).length} memories`;
  const list = $('#chapter-options');
  list.innerHTML = state.chapters.map(chapter => `<option value="${escapeHTML(chapter.name)}"></option>`).join('');
}

function renderDashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
  $('#welcome-heading').textContent = greeting;
  $('#welcome-subheading').textContent = state.memories.length ? 'What part of your story would you like to visit?' : 'Begin with the first moment that comes to mind.';

  const score = Math.min(100, Math.round(state.memories.length * 6 + state.people.length * 3 + state.places.length * 3 + state.pathways.length * 5));
  $('#archive-score').textContent = score;
  $('.archive-health__ring').style.setProperty('--score', `${Math.max(3, score)}%`);
  $('#archive-depth-label').textContent = score < 15 ? 'Just beginning' : score < 40 ? 'Taking shape' : score < 70 ? 'Richly connected' : 'Deep archive';
  $('#archive-depth-detail').textContent = `${state.memories.length} memories · ${state.people.length + state.places.length} anchors`;

  renderFeaturedMemory();
  renderDailyPrompt();
  renderStats();
  renderFragmentPreview();

  const recent = filteredMemories().sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0,8);
  $('#recent-memory-grid').innerHTML = recent.length ? recent.map(memoryCardHTML).join('') : emptyHTML('✧', 'Your first memory starts here', 'Capture a moment, a fragment, or even one sensory detail.', 'new-memory', 'Add a memory');

  const suggestions = buildPathwaySuggestions().slice(0,3);
  $('#pathway-suggestion-grid').innerHTML = suggestions.length ? suggestions.map(suggestion => `
    <button class="pathway-suggestion" data-action="create-suggested-pathway" data-suggestion="${escapeHTML(suggestion.key)}">
      <div class="pathway-suggestion__top"><span class="pathway-suggestion__icon">${suggestion.icon}</span><small>${suggestion.count} memories</small></div>
      <h3>${escapeHTML(suggestion.title)}</h3><p>${escapeHTML(suggestion.description)}</p>
    </button>`).join('') : emptyHTML('〰', 'Pathways appear as your archive grows', 'Shared people, places, tags, and chapters will become suggested story paths.');
}

function renderFeaturedMemory(forceIndex = null) {
  const eligible = filteredMemories().filter(memory => memory.memory_type !== 'fragment');
  const host = $('#featured-memory-content');
  if (!eligible.length) {
    host.innerHTML = emptyHTML('✧', 'No memories to revisit yet', 'Begin with one moment. It can be as complete or incomplete as you need.', 'new-memory', 'Capture a memory');
    return;
  }
  const index = forceIndex ?? Math.floor((new Date().getDate() + eligible.length) % eligible.length);
  const memory = eligible[index % eligible.length];
  const media = firstImage(memory);
  host.innerHTML = `
    <div class="featured-memory__art" style="--memory-gradient:${memoryGradient(memory)}" data-memory-id="${memory.id}">
      ${media ? `<img src="${escapeHTML(media.url)}" alt="" />` : `<span>${memoryEmoji(memory)}</span>`}
    </div>
    <div class="featured-memory__copy">
      <div class="memory-meta"><span>${escapeHTML(formatDate(memory))}</span>${memory.place ? `<span>⌖ ${escapeHTML(memory.place.name)}</span>` : ''}</div>
      <h3>${escapeHTML(memory.title)}</h3>
      <p>${escapeHTML(memory.body || 'Open this memory to explore its details and connections.')}</p>
      <button class="button button--soft" data-memory-id="${memory.id}">Open memory</button>
    </div>`;
}

function renderDailyPrompt() {
  const prompt = prompts[(new Date().getDate() + new Date().getMonth()) % prompts.length];
  $('#daily-prompt-content').innerHTML = `<div class="prompt-body"><span class="prompt-body__icon">${prompt[2]}</span><h3>${escapeHTML(prompt[0])}</h3><p>${escapeHTML(prompt[1])}</p><button class="button button--soft" data-action="answer-prompt" data-prompt="${escapeHTML(prompt[0])}">Follow this memory</button></div>`;
}

function renderStats() {
  const fragments = state.memories.filter(memory => memory.memory_type === 'fragment').length;
  const years = new Set(state.memories.map(memory => memory.occurred_on?.slice(0,4)).filter(Boolean));
  $('#stats-grid').innerHTML = [
    ['✦', state.memories.length, 'Memories'],
    ['♧', state.people.length, 'People'],
    ['⌖', state.places.length, 'Places'],
    ['◌', fragments, 'Fragments']
  ].map(([icon,value,label]) => `<div class="stat-tile"><span>${icon}</span><strong>${value}</strong><small>${label}</small></div>`).join('');
  const counts = Array.from({length:30}, (_,i) => state.memories.filter(memory => {
    const created = new Date(memory.created_at || 0);
    const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - (29-i));
    const end = new Date(start); end.setDate(end.getDate()+1);
    return created >= start && created < end;
  }).length);
  const max = Math.max(1, ...counts);
  $('#activity-ribbon').innerHTML = counts.map(count => `<span style="height:${Math.max(5, Math.round(count/max*40))}px" title="${count} added"></span>`).join('');
}

function renderFragmentPreview() {
  const fragments = state.memories.filter(memory => memory.memory_type === 'fragment').sort((a,b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  const host = $('#fragment-preview-content');
  $('#fragment-badge').textContent = fragments.length;
  if (!fragments.length) {
    host.innerHTML = emptyHTML('◌', 'Nothing is too incomplete', 'Save a face, room, phrase, sound, or image before it fades.', 'new-fragment', 'Save a fragment');
    return;
  }
  const fragment = fragments[0];
  host.innerHTML = `<div class="fragment-preview-card" data-memory-id="${fragment.id}"><div class="fragment-preview-card__orb">◌</div><div><h3>${escapeHTML(fragment.title)}</h3><p>${escapeHTML(fragment.body || 'An unfinished memory waiting for more clues.')}</p><button class="text-button" data-memory-id="${fragment.id}">Explore the clues →</button></div></div>`;
}

function renderTimeline() {
  let memories = filteredMemories();
  const filter = state.timelineFilter;
  if (filter === 'favorite') memories = memories.filter(memory => memory.is_favorite);
  if (filter === 'photo') memories = memories.filter(memory => firstImage(memory));
  if (filter === 'uncertain') memories = memories.filter(memory => ['unknown','approximate'].includes(memory.date_precision) || ['uncertain','reconstructed'].includes(memory.certainty));
  if (filter === 'fragment') memories = memories.filter(memory => memory.memory_type === 'fragment');

  const sort = state.timelineSort;
  memories.sort((a,b) => {
    if (sort === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    const aDate = a.occurred_on ? new Date(a.occurred_on) : new Date(0);
    const bDate = b.occurred_on ? new Date(b.occurred_on) : new Date(0);
    return sort === 'asc' ? aDate-bDate : bDate-aDate;
  });

  const groups = new Map();
  for (const memory of memories) {
    const year = memory.occurred_on?.slice(0,4) || 'Unknown';
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(memory);
  }
  const host = $('#timeline-shell');
  if (!memories.length) {
    host.innerHTML = `<div class="timeline-empty"><span>◷</span><h3>No memories match this view</h3><p>Try a different filter or add another moment to your archive.</p><button class="button button--primary" data-action="new-memory">Add memory</button></div>`;
    return;
  }
  host.innerHTML = [...groups.entries()].map(([year,items]) => `<section class="timeline-year"><div class="timeline-year__label">${escapeHTML(year)}</div><div class="timeline-items">${items.map(timelineItemHTML).join('')}</div></section>`).join('');
}

function renderPathways() {
  const list = $('#pathway-list');
  if (!state.pathways.length) {
    list.innerHTML = emptyHTML('〰', 'Create your first pathway', 'Gather related memories into a story about a person, place, season, tradition, or transformation.', 'new-pathway', 'Create pathway');
  } else {
    list.innerHTML = state.pathways.map(pathway => {
      const items = (pathway.memory_ids || []).map(id => state.memories.find(memory => memory.id === id)).filter(Boolean);
      return `<article class="pathway-card">
        <div class="pathway-card__head" style="--path-color:${colorWash(pathway.color)}">
          <div class="pathway-card__icon">${escapeHTML(pathway.icon || '〰')}</div>
          <div><h3>${escapeHTML(pathway.title)}</h3><p>${escapeHTML(pathway.description || 'A connected story through your archive.')}</p></div>
          <span>${items.length} ${items.length === 1 ? 'memory' : 'memories'}</span>
        </div>
        <div class="pathway-card__trail">${items.length ? items.map(memory => `<button class="pathway-memory-mini" data-memory-id="${memory.id}"><small>${escapeHTML(formatDate(memory))}</small><b>${escapeHTML(memory.title)}</b></button>`).join('') : '<span class="muted">No memories selected yet.</span>'}</div>
        <div class="pathway-card__actions"><button class="button button--soft" data-action="edit-pathway" data-pathway-id="${pathway.id}">Edit pathway</button><button class="button button--ghost" data-action="delete-pathway" data-pathway-id="${pathway.id}">Delete</button></div>
      </article>`;
    }).join('');
  }

  const suggestions = buildPathwaySuggestions().slice(0,4);
  $('#pathway-insights').innerHTML = suggestions.length ? suggestions.map(suggestion => `<button class="insight-card" data-action="create-suggested-pathway" data-suggestion="${escapeHTML(suggestion.key)}"><span>${suggestion.icon}</span><h3>${escapeHTML(suggestion.title)}</h3><p>${escapeHTML(suggestion.description)}</p></button>`).join('') : '<div class="insight-card"><span>✦</span><h3>More connections will emerge</h3><p>Add people, places, chapters, and tags to reveal possible pathways.</p></div>';
}

function renderFragments() {
  let fragments = filteredMemories().filter(memory => memory.memory_type === 'fragment');
  if (state.fragmentSort === 'old') fragments.sort((a,b) => new Date(a.created_at||0)-new Date(b.created_at||0));
  else if (state.fragmentSort === 'certainty') fragments.sort((a,b) => clueCount(b)-clueCount(a));
  else fragments.sort((a,b) => new Date(b.created_at||0)-new Date(a.created_at||0));
  $('#fragment-grid').innerHTML = fragments.length ? fragments.map(fragment => `
    <article class="fragment-card" data-memory-id="${fragment.id}">
      <div class="fragment-card__top"><span>${escapeHTML(formatDate(fragment))}</span><span>${escapeHTML(fragment.certainty || 'uncertain')}</span></div>
      <h3>${escapeHTML(fragment.title)}</h3><p>${escapeHTML(fragment.body || 'An unfinished detail waiting for context.')}</p>
      <div class="fragment-card__clues">${fragmentClues(fragment).slice(0,4).map(clue => `<span>${escapeHTML(clue)}</span>`).join('')}</div>
    </article>`).join('') : emptyHTML('◌', 'The Fog is empty', 'Save an image, phrase, face, sound, room, or feeling without needing to explain it.', 'new-fragment', 'Save a fragment');
}

function renderLibrary() {
  $('#people-grid').innerHTML = state.people.length ? state.people.map(person => entityCardHTML(person, 'person')).join('') : emptyHTML('♧', 'No people added yet', 'People are created automatically when you name them in a memory, or you can add one now.', 'new-person', 'Add person');
  $('#places-grid').innerHTML = state.places.length ? state.places.map(place => entityCardHTML(place, 'place')).join('') : emptyHTML('⌖', 'No places added yet', 'Homes, destinations, workplaces, and unnamed corners can all anchor memories.', 'new-place', 'Add place');
  $('#chapters-grid').innerHTML = state.chapters.length ? state.chapters.map(chapter => {
    const count = state.memories.filter(memory => memory.life_chapter === chapter.name).length;
    return `<article class="chapter-library-card" style="--chapter-color:${colorWash(chapter.color)}" data-action="edit-entity" data-entity-type="chapter" data-entity-id="${chapter.id}"><span>${chapter.start_year || 'ANYTIME'}${chapter.end_year ? ` — ${chapter.end_year}` : chapter.start_year ? ' — NOW' : ''}</span><h3>${escapeHTML(chapter.name)}</h3><p>${escapeHTML(chapter.description || '')}</p><div class="entity-card__stats"><span><b>${count}</b> memories</span></div></article>`;
  }).join('') : emptyHTML('∞', 'Name a chapter of your life', 'Chapters can be chronological, emotional, relational, or defined only by what they meant to you.', 'new-chapter', 'Add chapter');
}

function entityCardHTML(entity, type) {
  const count = state.memories.filter(memory => type === 'person' ? (memory.people || []).some(person => person.id === entity.id || person.name === entity.name) : memory.place?.id === entity.id || memory.place?.name === entity.name).length;
  return `<article class="entity-card" data-action="edit-entity" data-entity-type="${type}" data-entity-id="${entity.id}"><div class="entity-card__avatar" style="--entity-gradient:${entityGradients[entity.color] || entityGradients.violet}">${type === 'place' ? '⌖' : initials(entity.name)}</div><h3>${escapeHTML(entity.name)}</h3><p>${escapeHTML(entity.kind || (type === 'place' ? 'Meaningful place' : 'Person in your story'))}</p><div class="entity-card__stats"><span><b>${count}</b> memories</span></div></article>`;
}

function memoryCardHTML(memory) {
  const media = firstImage(memory);
  return `<article class="memory-card" data-memory-id="${memory.id}"><div class="memory-card__art" style="--memory-gradient:${memoryGradient(memory)}">${media ? `<img src="${escapeHTML(media.url)}" alt="" loading="lazy" />` : `<span>${memoryEmoji(memory)}</span>`}${memory.is_favorite ? '<i class="memory-card__favorite">★</i>' : ''}</div><div class="memory-card__body"><small>${escapeHTML(formatDate(memory))}</small><h3>${escapeHTML(memory.title)}</h3><p>${escapeHTML(memory.body || 'Open to explore this memory.')}</p></div></article>`;
}

function timelineItemHTML(memory) {
  const media = firstImage(memory);
  return `<article class="timeline-item" data-memory-id="${memory.id}"><div class="timeline-item__art" style="--memory-gradient:${memoryGradient(memory)}">${media ? `<img src="${escapeHTML(media.url)}" alt="" loading="lazy" />` : `<span>${memoryEmoji(memory)}</span>`}</div><div class="timeline-item__body"><small>${escapeHTML(formatDate(memory))}${memory.time_of_day ? ` · ${escapeHTML(memory.time_of_day)}` : ''}</small><h3>${escapeHTML(memory.title)}</h3><p>${escapeHTML(memory.body || '')}</p></div></article>`;
}

function emptyHTML(icon, title, copy, action = '', label = '') {
  return `<div class="empty-card"><div><span>${icon}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(copy)}</p>${action ? `<button class="button button--soft" data-action="${action}">${escapeHTML(label)}</button>` : ''}</div></div>`;
}

function firstImage(memory) {
  return (memory.media || []).find(media => media.media_type === 'image' || media.mime_type?.startsWith('image/'));
}

function filteredMemories() {
  const query = state.search.trim().toLowerCase();
  if (!query) return [...state.memories];
  return state.memories.filter(memory => [
    memory.title,
    memory.body,
    memory.life_chapter,
    memory.place?.name,
    ...(memory.tags || []),
    ...(memory.emotions || []),
    ...(memory.people || []).map(person => person.name),
    ...Object.values(memory.sensory || {})
  ].filter(Boolean).join(' ').toLowerCase().includes(query));
}

function fragmentClues(memory) {
  return [
    ...(memory.tags || []),
    ...(memory.people || []).map(person => person.name),
    memory.place?.name,
    memory.time_of_day,
    memory.life_chapter
  ].filter(Boolean);
}

function clueCount(memory) {
  return fragmentClues(memory).length + Object.values(memory.sensory || {}).filter(Boolean).length + (memory.body ? 1 : 0);
}

function buildPathwaySuggestions() {
  const buckets = new Map();
  const add = (key, title, description, icon, memory) => {
    if (!key) return;
    if (!buckets.has(key)) buckets.set(key, { key, title, description, icon, memoryIds:new Set() });
    buckets.get(key).memoryIds.add(memory.id);
  };
  for (const memory of state.memories.filter(item => item.memory_type !== 'fragment')) {
    for (const person of memory.people || []) add(`person:${person.name}`, `My story with ${person.name}`, `Follow the moments, places, and chapters connected to ${person.name}.`, '♧', memory);
    if (memory.place) add(`place:${memory.place.name}`, `Memories of ${memory.place.name}`, `See how one place changed across different moments in your life.`, '⌖', memory);
    if (memory.life_chapter) add(`chapter:${memory.life_chapter}`, memory.life_chapter, `Explore the memories that give this chapter its shape.`, '∞', memory);
    for (const tag of memory.tags || []) add(`tag:${tag.toLowerCase()}`, `${titleCase(tag)} through the years`, `A pathway built from memories connected by “${tag}.”`, '〰', memory);
  }
  return [...buckets.values()].filter(bucket => bucket.memoryIds.size >= 2).sort((a,b) => b.memoryIds.size-a.memoryIds.size).map(bucket => ({...bucket, count:bucket.memoryIds.size, memoryIds:[...bucket.memoryIds]}));
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, char => char.toUpperCase());
}

function navigate(view, updateHash = true) {
  const allowed = ['today','timeline','pathways','constellation','fragments','people','settings'];
  if (!allowed.includes(view)) view = 'today';
  state.activeView = view;
  $$('.view').forEach(section => section.classList.toggle('is-active', section.dataset.view === view));
  $$('.nav-item[data-nav]').forEach(item => item.classList.toggle('is-active', item.dataset.nav === view));
  const titles = {
    today:['YOUR ARCHIVE','Today'], timeline:['EXPLORE THROUGH TIME','Timeline'], pathways:['FOLLOW THE THREADS','Pathways'], constellation:['EXPLORE BY ASSOCIATION','Constellation'], fragments:['UNPLACED MEMORIES','The Fog'], people:['THE ANCHORS IN YOUR STORY','People & places'], settings:['YOUR ARCHIVE, YOUR RULES','Settings']
  };
  $('#view-eyebrow').textContent = titles[view][0];
  $('#view-title').textContent = titles[view][1];
  if (updateHash) history.replaceState(null,'',`#${view}`);
  closeSidebar();
  if (view === 'constellation') {
    resizeConstellation();
    startConstellation();
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}

function openAuth(mode = 'signin') {
  setAuthMode(mode);
  $('#auth-modal').showModal();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === 'signup';
  $$('[data-auth-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.authTab === mode));
  $('#auth-title').textContent = signup ? 'Begin your archive' : 'Welcome back';
  $('#auth-description').textContent = signup ? 'Create a private place for the life only you can tell.' : 'Continue exploring the story only you can tell.';
  $('#auth-submit').textContent = signup ? 'Create account' : 'Sign in';
  $('#auth-name-row').hidden = !signup;
  $('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const name = $('#auth-name').value.trim();
  const button = $('#auth-submit');
  button.disabled = true;
  button.textContent = state.authMode === 'signup' ? 'Creating archive…' : 'Opening archive…';
  try {
    if (state.authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options:{ data:{ full_name:name || email.split('@')[0] }, emailRedirectTo:location.href.split('#')[0] } });
      if (error) throw error;
      if (!data.session) {
        toast('Check your email', 'Confirm your account, then return here to sign in.');
        setAuthMode('signin');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    toast('Could not continue', friendlyError(error), 'error');
  } finally {
    button.disabled = false;
    button.textContent = state.authMode === 'signup' ? 'Create account' : 'Sign in';
  }
}

async function googleAuth() {
  const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:location.href.split('#')[0] } });
  if (error) toast('Google sign-in failed', friendlyError(error), 'error');
}

async function sendMagicLink() {
  const email = $('#auth-email').value.trim();
  if (!email) {
    toast('Enter your email first', 'Then choose the password-free sign-in link.', 'error');
    $('#auth-email').focus();
    return;
  }
  const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo:location.href.split('#')[0] } });
  if (error) toast('Could not send the link', friendlyError(error), 'error');
  else toast('Check your email', 'Your secure sign-in link is on the way.');
}

async function signOut() {
  if (state.mode === 'supabase') await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
  if (state.realtimeChannel) supabase.removeChannel(state.realtimeChannel);
  showLanding();
}

function openMemoryModal({ memory = null, type = 'memory', prompt = '', title = '' } = {}) {
  const modal = $('#memory-modal');
  $('#memory-form').reset();
  state.pendingFiles = [];
  state.existingMedia = memory?.media ? [...memory.media] : [];
  $('#memory-id').value = memory?.id || '';
  $('#memory-title').value = memory?.title || title || prompt || '';
  $('#memory-body').value = memory?.body || (prompt ? `${prompt}\n\n` : '');
  $('#memory-date').value = memory?.occurred_on || '';
  $('#memory-date-precision').value = memory?.date_precision || (type === 'fragment' ? 'unknown' : 'exact');
  $('#memory-time-of-day').value = memory?.time_of_day || '';
  $('#memory-people').value = (memory?.people || []).map(person => person.name).join(', ');
  $('#memory-place').value = memory?.place?.name || '';
  $('#memory-sounds').value = memory?.sensory?.sounds || '';
  $('#memory-smells').value = memory?.sensory?.smells || '';
  $('#memory-visuals').value = memory?.sensory?.visuals || '';
  $('#memory-chapter').value = memory?.life_chapter || '';
  $('#memory-tags').value = (memory?.tags || []).join(', ');
  $('#memory-certainty').value = memory?.certainty || (type === 'fragment' ? 'uncertain' : 'likely');
  $('#memory-visibility').value = memory?.visibility || 'private';
  $('#memory-favorite').checked = Boolean(memory?.is_favorite);
  $$('#emotion-choices button').forEach(button => button.classList.toggle('is-selected', (memory?.emotions || []).includes(button.dataset.choice)));
  setMemoryType(memory?.memory_type || type);
  $('#memory-modal-eyebrow').textContent = memory ? 'RETURN TO A MEMORY' : type === 'fragment' ? 'SAVE A CLUE' : 'A NEW THREAD';
  $('#memory-modal-title').textContent = memory ? 'Edit this memory' : type === 'fragment' ? 'Save a fragment' : 'Capture a memory';
  $('#memory-save-button').innerHTML = `<span>✦</span>${memory ? 'Save changes' : type === 'fragment' ? 'Save fragment' : 'Save memory'}`;
  renderUploadPreview();
  modal.showModal();
  setTimeout(() => $('#memory-title').focus(), 100);
}

function setMemoryType(type) {
  $$('#memory-type-control button').forEach(button => button.classList.toggle('is-active', button.dataset.memoryType === type));
  $('#memory-type-help').textContent = type === 'fragment' ? 'An unfinished image, clue, phrase, feeling, or scene that may find context later.' : 'A moment with enough context to place in your timeline.';
  $('#memory-type-control').dataset.value = type;
}

async function handleMemorySave(event) {
  event.preventDefault();
  const id = $('#memory-id').value || crypto.randomUUID();
  const existing = state.memories.find(memory => memory.id === id);
  const peopleNames = normalizeList($('#memory-people').value);
  const placeName = $('#memory-place').value.trim();
  const memory = {
    id,
    user_id: state.user.id,
    title: $('#memory-title').value.trim(),
    body: $('#memory-body').value.trim(),
    memory_type: $('#memory-type-control').dataset.value || 'memory',
    occurred_on: $('#memory-date').value || null,
    date_precision: $('#memory-date-precision').value,
    time_of_day: $('#memory-time-of-day').value || null,
    life_chapter: $('#memory-chapter').value.trim(),
    emotions: $$('#emotion-choices button.is-selected').map(button => button.dataset.choice),
    sensory: {
      sounds: $('#memory-sounds').value.trim(),
      smells: $('#memory-smells').value.trim(),
      visuals: $('#memory-visuals').value.trim()
    },
    tags: normalizeList($('#memory-tags').value),
    certainty: $('#memory-certainty').value,
    visibility: $('#memory-visibility').value,
    is_favorite: $('#memory-favorite').checked,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    people: [],
    place: null,
    media: [...state.existingMedia]
  };
  if (!memory.title) return;

  const saveButton = $('#memory-save-button');
  saveButton.disabled = true;
  saveButton.innerHTML = '<span>◌</span>Saving…';
  setSyncing(true, existing ? 'Saving changes…' : 'Adding this memory…');
  try {
    if (state.mode === 'demo') {
      memory.people = await ensureDemoPeople(peopleNames);
      memory.place = placeName ? await ensureDemoPlace(placeName) : null;
      const newMedia = await Promise.all(state.pendingFiles.map(fileToDemoMedia));
      memory.media.push(...newMedia.map((media,index) => ({...media,id:crypto.randomUUID(),memory_id:id,user_id:state.user.id,sort_order:memory.media.length+index})));
      const index = state.memories.findIndex(item => item.id === id);
      if (index >= 0) state.memories[index] = memory; else state.memories.unshift(memory);
      ensureDemoChapter(memory.life_chapter);
      saveDemoData();
    } else {
      await saveMemorySupabase(memory, peopleNames, placeName);
      await loadData();
    }
    $('#memory-modal').close();
    renderAll();
    toast(existing ? 'Memory updated' : memory.memory_type === 'fragment' ? 'Fragment saved' : 'Memory saved', 'Another thread has been added to your archive.');
  } catch (error) {
    console.error(error);
    toast('Could not save this memory', friendlyError(error), 'error');
  } finally {
    setSyncing(false);
    saveButton.disabled = false;
    saveButton.innerHTML = `<span>✦</span>${existing ? 'Save changes' : memory.memory_type === 'fragment' ? 'Save fragment' : 'Save memory'}`;
  }
}

async function saveMemorySupabase(memory, peopleNames, placeName) {
  const payload = { ...memory };
  delete payload.people; delete payload.place; delete payload.media; delete payload.created_at;
  const { error:memoryError } = await supabase.from('memories').upsert(payload, { onConflict:'id' });
  if (memoryError) throw memoryError;

  await Promise.all([
    supabase.from('memory_person_links').delete().eq('memory_id', memory.id).eq('user_id', state.user.id),
    supabase.from('memory_place_links').delete().eq('memory_id', memory.id).eq('user_id', state.user.id)
  ]);

  for (const name of peopleNames) {
    const { data:person, error } = await supabase.from('memory_people').upsert({ user_id:state.user.id, name }, { onConflict:'user_id,normalized_name' }).select().single();
    if (error) throw error;
    const { error:linkError } = await supabase.from('memory_person_links').upsert({ user_id:state.user.id, memory_id:memory.id, person_id:person.id }, { onConflict:'memory_id,person_id' });
    if (linkError) throw linkError;
  }

  if (placeName) {
    const { data:place, error } = await supabase.from('memory_places').upsert({ user_id:state.user.id, name:placeName }, { onConflict:'user_id,normalized_name' }).select().single();
    if (error) throw error;
    const { error:linkError } = await supabase.from('memory_place_links').upsert({ user_id:state.user.id, memory_id:memory.id, place_id:place.id }, { onConflict:'memory_id,place_id' });
    if (linkError) throw linkError;
  }

  if (memory.life_chapter) {
    const { error } = await supabase.from('memory_life_chapters').upsert({ user_id:state.user.id, name:memory.life_chapter }, { onConflict:'user_id,normalized_name' });
    if (error) throw error;
  }

  for (let index = 0; index < state.pendingFiles.length; index++) {
    const original = state.pendingFiles[index];
    const prepared = original.type.startsWith('image/') ? await compressImage(original) : original;
    const safeName = `${Date.now()}-${index}-${original.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const path = `${state.user.id}/${memory.id}/${safeName}`;
    const { error:uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, prepared, { contentType:prepared.type || original.type, upsert:false });
    if (uploadError) throw uploadError;
    const mediaType = original.type.startsWith('image/') ? 'image' : original.type.startsWith('video/') ? 'video' : original.type.startsWith('audio/') ? 'audio' : 'document';
    const { error:rowError } = await supabase.from('memory_media').insert({ user_id:state.user.id, memory_id:memory.id, storage_path:path, media_type:mediaType, mime_type:original.type, original_name:original.name, sort_order:state.existingMedia.length+index });
    if (rowError) throw rowError;
  }
}

async function ensureDemoPeople(names) {
  return names.map(name => {
    let person = state.people.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (!person) {
      person = { id:crypto.randomUUID(), user_id:state.user.id, name, kind:'', notes:'', color:['violet','rose','aqua','amber','sage'][state.people.length%5] };
      state.people.push(person);
    }
    return person;
  });
}

async function ensureDemoPlace(name) {
  let place = state.places.find(item => item.name.toLowerCase() === name.toLowerCase());
  if (!place) {
    place = { id:crypto.randomUUID(), user_id:state.user.id, name, kind:'', notes:'', color:['aqua','violet','rose','amber','sage'][state.places.length%5] };
    state.places.push(place);
  }
  return place;
}

function ensureDemoChapter(name) {
  if (!name || state.chapters.some(chapter => chapter.name.toLowerCase() === name.toLowerCase())) return;
  state.chapters.push({ id:crypto.randomUUID(), user_id:state.user.id, name, description:'', color:'violet', start_year:null, end_year:null });
}

async function fileToDemoMedia(file) {
  const prepared = file.type.startsWith('image/') ? await compressImage(file) : file;
  const url = await fileToDataURL(prepared);
  return { url, media_type:file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document', mime_type:file.type, original_name:file.name };
}

function fileToDataURL(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.size < 650000) return file;
  const bitmap = await createImageBitmap(file);
  const max = 1800;
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .84));
  bitmap.close();
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type:'image/jpeg' });
}

function renderUploadPreview() {
  const host = $('#upload-preview');
  const existing = state.existingMedia.map((media,index) => ({ ...media, existing:true, index }));
  const pending = state.pendingFiles.map((file,index) => ({ file, index, url:file.type.startsWith('image/') ? URL.createObjectURL(file) : '', media_type:file.type.startsWith('image/') ? 'image' : 'document' }));
  host.innerHTML = [...existing,...pending].map(item => `<div class="upload-preview__item">${item.media_type === 'image' && item.url ? `<img src="${escapeHTML(item.url)}" alt="" />` : `<span>${escapeHTML(item.original_name || item.file?.name || 'File')}</span>`}<button type="button" data-action="remove-upload" data-existing="${item.existing ? 'true':'false'}" data-upload-index="${item.index}">×</button></div>`).join('');
}

async function removeExistingMedia(index) {
  const media = state.existingMedia[index];
  if (!media) return;
  if (state.mode === 'supabase') {
    setSyncing(true, 'Removing media…');
    try {
      if (media.storage_path) await supabase.storage.from(STORAGE_BUCKET).remove([media.storage_path]);
      await supabase.from('memory_media').delete().eq('id', media.id).eq('user_id', state.user.id);
    } catch (error) {
      toast('Could not remove media', friendlyError(error), 'error');
      return;
    } finally { setSyncing(false); }
  }
  state.existingMedia.splice(index,1);
  renderUploadPreview();
}

function openMemoryDetail(id) {
  const memory = state.memories.find(item => item.id === id);
  if (!memory) return;
  const media = firstImage(memory);
  const sensory = Object.entries(memory.sensory || {}).filter(([,value]) => value);
  const content = $('#detail-content');
  content.innerHTML = `
    <header class="detail-hero" style="--memory-gradient:${memoryGradient(memory)}">${media ? `<img src="${escapeHTML(media.url)}" alt="" />` : ''}<div class="detail-hero__copy"><small>${escapeHTML(memory.memory_type === 'fragment' ? 'MEMORY FRAGMENT' : formatDate(memory).toUpperCase())}</small><h2>${escapeHTML(memory.title)}</h2><div class="memory-meta">${memory.place ? `<span>⌖ ${escapeHTML(memory.place.name)}</span>`:''}${memory.life_chapter ? `<span>∞ ${escapeHTML(memory.life_chapter)}</span>`:''}</div></div></header>
    <div class="detail-body">
      <div class="detail-actions"><button class="button button--primary" data-action="edit-memory" data-memory-id="${memory.id}">Edit</button><button class="button button--soft" data-action="toggle-favorite" data-memory-id="${memory.id}">${memory.is_favorite ? '★ Favorited' : '☆ Favorite'}</button><button class="button button--danger" data-action="delete-memory" data-memory-id="${memory.id}">Delete</button></div>
      <p class="detail-story">${escapeHTML(memory.body || 'No written details yet.')}</p>
      ${memory.media?.length ? `<section class="detail-section"><h3>Photos & evidence</h3><div class="detail-media-grid">${memory.media.map(item => item.media_type === 'image' ? `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener"><img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.original_name || '')}" /></a>` : `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener">${escapeHTML(item.original_name || item.media_type)}</a>`).join('')}</div></section>`:''}
      ${(memory.people || []).length ? `<section class="detail-section"><h3>People</h3><div class="detail-chip-row">${memory.people.map(person => `<span>♧ ${escapeHTML(person.name)}</span>`).join('')}</div></section>`:''}
      ${(memory.emotions || []).length ? `<section class="detail-section"><h3>How it felt</h3><div class="detail-chip-row">${memory.emotions.map(item => `<span>${escapeHTML(item)}</span>`).join('')}</div></section>`:''}
      ${sensory.length ? `<section class="detail-section"><h3>Sensory clues</h3><div class="detail-chip-row">${sensory.map(([key,value]) => `<span>${escapeHTML(titleCase(key))}: ${escapeHTML(value)}</span>`).join('')}</div></section>`:''}
      ${(memory.tags || []).length ? `<section class="detail-section"><h3>Tags</h3><div class="detail-chip-row">${memory.tags.map(item => `<span>#${escapeHTML(item)}</span>`).join('')}</div></section>`:''}
      <section class="detail-section"><h3>Certainty & privacy</h3><div class="detail-chip-row"><span>${escapeHTML(titleCase(memory.certainty || 'likely'))}</span><span>${memory.visibility === 'shared' ? 'Shared by invitation' : 'Only me'}</span><span>${escapeHTML(formatDate(memory))}</span></div></section>
    </div>`;
  $('#detail-drawer').classList.add('is-open');
  $('#detail-drawer').setAttribute('aria-hidden','false');
}

function closeDetail() {
  $('#detail-drawer').classList.remove('is-open');
  $('#detail-drawer').setAttribute('aria-hidden','true');
}

async function toggleFavorite(id) {
  const memory = state.memories.find(item => item.id === id);
  if (!memory) return;
  memory.is_favorite = !memory.is_favorite;
  if (state.mode === 'demo') saveDemoData();
  else {
    const { error } = await supabase.from('memories').update({ is_favorite:memory.is_favorite }).eq('id',id).eq('user_id',state.user.id);
    if (error) {
      memory.is_favorite = !memory.is_favorite;
      toast('Could not update favorite', friendlyError(error), 'error');
      return;
    }
  }
  renderAll();
  openMemoryDetail(id);
}

async function deleteMemory(id) {
  const memory = state.memories.find(item => item.id === id);
  if (!memory || !confirm(`Delete “${memory.title}”? This cannot be undone.`)) return;
  setSyncing(true, 'Removing memory…');
  try {
    if (state.mode === 'demo') {
      state.memories = state.memories.filter(item => item.id !== id);
      state.pathways.forEach(pathway => pathway.memory_ids = (pathway.memory_ids || []).filter(memoryId => memoryId !== id));
      saveDemoData();
    } else {
      const paths = (memory.media || []).map(item => item.storage_path).filter(Boolean);
      if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      const { error } = await supabase.from('memories').delete().eq('id',id).eq('user_id',state.user.id);
      if (error) throw error;
      await loadData();
    }
    closeDetail();
    renderAll();
    toast('Memory removed');
  } catch (error) {
    toast('Could not delete memory', friendlyError(error), 'error');
  } finally { setSyncing(false); }
}

function openPathwayModal(pathway = null, suggestion = null) {
  $('#pathway-form').reset();
  const selected = pathway?.memory_ids || suggestion?.memoryIds || [];
  $('#pathway-id').value = pathway?.id || '';
  $('#pathway-title').value = pathway?.title || suggestion?.title || '';
  $('#pathway-description').value = pathway?.description || suggestion?.description || '';
  $('#pathway-icon').value = pathway?.icon || suggestion?.icon || '〰';
  $('#pathway-color').value = pathway?.color || 'violet';
  $('#pathway-modal-title').textContent = pathway ? 'Edit pathway' : 'Create a pathway';
  $('#pathway-memory-options').innerHTML = state.memories.filter(memory => memory.memory_type !== 'fragment').map(memory => `<label class="pathway-picker-item"><input type="checkbox" value="${memory.id}" ${selected.includes(memory.id)?'checked':''}/><span class="pathway-picker-item__art" style="--memory-gradient:${memoryGradient(memory)}">${memoryEmoji(memory)}</span><span><b>${escapeHTML(memory.title)}</b><small>${escapeHTML(formatDate(memory))}</small></span></label>`).join('');
  updatePathwaySelectedCount();
  $('#pathway-modal').showModal();
}

function updatePathwaySelectedCount() {
  const count = $$('#pathway-memory-options input:checked').length;
  $('#pathway-selected-count').textContent = `${count} selected`;
}

async function handlePathwaySave(event) {
  event.preventDefault();
  const id = $('#pathway-id').value || crypto.randomUUID();
  const existing = state.pathways.find(item => item.id === id);
  const pathway = {
    id, user_id:state.user.id,
    title:$('#pathway-title').value.trim(),
    description:$('#pathway-description').value.trim(),
    icon:$('#pathway-icon').value,
    color:$('#pathway-color').value,
    memory_ids:$$('#pathway-memory-options input:checked').map(input => input.value),
    created_at:existing?.created_at || new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
  if (!pathway.title) return;
  setSyncing(true, 'Saving pathway…');
  try {
    if (state.mode === 'demo') {
      const index = state.pathways.findIndex(item => item.id === id);
      if (index >= 0) state.pathways[index] = pathway; else state.pathways.unshift(pathway);
      saveDemoData();
    } else {
      const payload = {...pathway}; delete payload.memory_ids; delete payload.created_at;
      const { error } = await supabase.from('memory_pathways').upsert(payload,{onConflict:'id'});
      if (error) throw error;
      await supabase.from('memory_pathway_items').delete().eq('pathway_id',id).eq('user_id',state.user.id);
      if (pathway.memory_ids.length) {
        const rows = pathway.memory_ids.map((memoryId,index) => ({ user_id:state.user.id, pathway_id:id, memory_id:memoryId, sort_order:index }));
        const { error:itemError } = await supabase.from('memory_pathway_items').insert(rows);
        if (itemError) throw itemError;
      }
      await loadData();
    }
    $('#pathway-modal').close();
    renderAll();
    toast(existing ? 'Pathway updated' : 'Pathway created');
  } catch (error) {
    toast('Could not save pathway', friendlyError(error), 'error');
  } finally { setSyncing(false); }
}

async function deletePathway(id) {
  const pathway = state.pathways.find(item => item.id === id);
  if (!pathway || !confirm(`Delete the pathway “${pathway.title}”? Your memories will remain.`)) return;
  if (state.mode === 'demo') {
    state.pathways = state.pathways.filter(item => item.id !== id); saveDemoData();
  } else {
    const { error } = await supabase.from('memory_pathways').delete().eq('id',id).eq('user_id',state.user.id);
    if (error) return toast('Could not delete pathway', friendlyError(error), 'error');
    await loadData();
  }
  renderAll(); toast('Pathway removed');
}

function openEntityModal(type, entity = null) {
  $('#entity-form').reset();
  $('#entity-id').value = entity?.id || '';
  $('#entity-type').value = type;
  $('#entity-name').value = entity?.name || '';
  $('#entity-kind').value = type === 'chapter' ? [entity?.start_year, entity?.end_year].filter(Boolean).join(' – ') : entity?.kind || '';
  $('#entity-notes').value = entity?.notes || entity?.description || '';
  $('#entity-color').value = entity?.color || 'violet';
  $('#entity-title').textContent = `${entity ? 'Edit' : 'Add'} ${type === 'person' ? 'person' : type === 'place' ? 'place' : 'life chapter'}`;
  $('#entity-eyebrow').textContent = type === 'person' ? 'A PERSON IN YOUR STORY' : type === 'place' ? 'YOUR PERSONAL GEOGRAPHY' : 'A SEASON OF YOUR LIFE';
  $('#entity-description').textContent = type === 'chapter' ? 'Name the period and describe what gave it shape.' : 'Create an anchor that memories can connect to.';
  $('#entity-name-label').textContent = type === 'chapter' ? 'Chapter name' : 'Name';
  $('#entity-kind-label').textContent = type === 'chapter' ? 'Years, such as 2018 – 2020' : type === 'person' ? 'Relationship' : 'Place type';
  $('#entity-modal').showModal();
}

async function handleEntitySave(event) {
  event.preventDefault();
  const type = $('#entity-type').value;
  const id = $('#entity-id').value || crypto.randomUUID();
  const name = $('#entity-name').value.trim();
  if (!name) return;
  const kind = $('#entity-kind').value.trim();
  const notes = $('#entity-notes').value.trim();
  const color = $('#entity-color').value;
  const collection = type === 'person' ? state.people : type === 'place' ? state.places : state.chapters;
  const existing = collection.find(item => item.id === id);
  let entity;
  if (type === 'chapter') {
    const years = kind.match(/\d{4}/g) || [];
    entity = { id,user_id:state.user.id,name,description:notes,color,start_year:years[0] ? Number(years[0]) : null,end_year:years[1] ? Number(years[1]) : null };
  } else entity = { id,user_id:state.user.id,name,kind,notes,color };

  setSyncing(true, 'Saving…');
  try {
    if (state.mode === 'demo') {
      const index = collection.findIndex(item => item.id === id);
      if (index >= 0) collection[index] = entity; else collection.push(entity);
      saveDemoData();
    } else {
      const table = type === 'person' ? 'memory_people' : type === 'place' ? 'memory_places' : 'memory_life_chapters';
      const { error } = await supabase.from(table).upsert(entity,{onConflict:'id'});
      if (error) throw error;
      await loadData();
    }
    $('#entity-modal').close(); renderAll(); toast(existing ? 'Updated' : 'Added to your archive');
  } catch (error) { toast('Could not save', friendlyError(error), 'error'); }
  finally { setSyncing(false); }
}

async function editCurrentChapter() {
  const current = state.profile?.current_chapter || '';
  const value = prompt('What chapter of life are you living now?', current);
  if (value === null || !value.trim()) return;
  state.profile.current_chapter = value.trim();
  if (state.mode === 'demo') saveDemoData();
  else {
    const { error } = await supabase.from('memory_profiles').update({ current_chapter:value.trim() }).eq('id',state.user.id);
    if (error) return toast('Could not update chapter', friendlyError(error), 'error');
  }
  renderProfile();
}

function exportArchive() {
  const payload = {
    format:'whatmod-memories-archive', version:APP_VERSION, exported_at:new Date().toISOString(),
    profile:state.profile, memories:state.memories.map(memory => ({...memory, media:(memory.media||[]).map(media => ({...media,url:media.url?.startsWith('data:') ? media.url : undefined}))})), people:state.people, places:state.places, chapters:state.chapters, pathways:state.pathways, links:state.links
  };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `memories-archive-${new Date().toISOString().slice(0,10)}.json`; anchor.click();
  URL.revokeObjectURL(url);
  toast('Archive exported', 'Keep the downloaded file somewhere safe.');
}

async function importArchive(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.format !== 'whatmod-memories-archive') throw new Error('This is not a compatible Memories archive.');
    if (state.mode === 'demo') {
      state.profile = payload.profile || state.profile;
      state.memories = mergeById(state.memories,payload.memories||[]);
      state.people = mergeById(state.people,payload.people||[]);
      state.places = mergeById(state.places,payload.places||[]);
      state.chapters = mergeById(state.chapters,payload.chapters||[]);
      state.pathways = mergeById(state.pathways,payload.pathways||[]);
      state.links = mergeById(state.links,payload.links||[]);
      saveDemoData(); renderAll(); toast('Archive imported');
    } else {
      if (!confirm('Import records into your synced archive? Matching IDs will be updated. Original media files are not embedded in JSON exports and may need to be added again.')) return;
      setSyncing(true,'Importing archive…');

      const isUUID = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
      const createIdMap = items => new Map((items || []).map(item => [item.id, isUUID(item.id) ? item.id : crypto.randomUUID()]));
      const memoryIdMap = createIdMap(payload.memories);
      const personIdMap = createIdMap(payload.people);
      const placeIdMap = createIdMap(payload.places);
      const chapterIdMap = createIdMap(payload.chapters);
      const pathwayIdMap = createIdMap(payload.pathways);
      const linkIdMap = createIdMap(payload.links);
      const mapped = (map, id) => map.get(id) || (isUUID(id) ? id : null);
      const ensureSuccess = result => { if (result?.error) throw result.error; return result?.data; };
      const withoutGenerated = item => {
        const row = {...item};
        delete row.normalized_name;
        return row;
      };

      async function importNamedEntity(table, item, idMap) {
        const normalizedName = String(item.name || '').trim().toLowerCase();
        if (!normalizedName) return null;
        const existingResult = await supabase.from(table).select('id').eq('user_id',state.user.id).eq('normalized_name',normalizedName).maybeSingle();
        ensureSuccess(existingResult);
        const existingId = existingResult.data?.id;
        const id = existingId || mapped(idMap,item.id) || crypto.randomUUID();
        idMap.set(item.id,id);
        const row = withoutGenerated({...item,id,user_id:state.user.id});
        ensureSuccess(await supabase.from(table).upsert(row,{onConflict:'id'}));
        return id;
      }

      for (const person of payload.people || []) await importNamedEntity('memory_people',person,personIdMap);
      for (const place of payload.places || []) await importNamedEntity('memory_places',place,placeIdMap);
      for (const chapter of payload.chapters || []) await importNamedEntity('memory_life_chapters',chapter,chapterIdMap);

      for (const memory of payload.memories || []) {
        const row = {...memory,id:mapped(memoryIdMap,memory.id),user_id:state.user.id};
        delete row.people; delete row.place; delete row.media;
        ensureSuccess(await supabase.from('memories').upsert(row,{onConflict:'id'}));
      }

      for (const memory of payload.memories || []) {
        const memoryId = mapped(memoryIdMap,memory.id);
        ensureSuccess(await supabase.from('memory_person_links').delete().eq('memory_id',memoryId).eq('user_id',state.user.id));
        ensureSuccess(await supabase.from('memory_place_links').delete().eq('memory_id',memoryId).eq('user_id',state.user.id));

        const personRows = (memory.people || []).map(person => ({
          user_id:state.user.id,
          memory_id:memoryId,
          person_id:mapped(personIdMap,person.id)
        })).filter(row => row.person_id);
        if (personRows.length) ensureSuccess(await supabase.from('memory_person_links').upsert(personRows,{onConflict:'memory_id,person_id'}));

        const placeId = mapped(placeIdMap,memory.place?.id);
        if (placeId) ensureSuccess(await supabase.from('memory_place_links').upsert({
          user_id:state.user.id,
          memory_id:memoryId,
          place_id:placeId
        },{onConflict:'memory_id,place_id'}));
      }

      for (const pathway of payload.pathways || []) {
        const pathwayId = mapped(pathwayIdMap,pathway.id);
        const row = {...pathway,id:pathwayId,user_id:state.user.id};
        delete row.memory_ids;
        ensureSuccess(await supabase.from('memory_pathways').upsert(row,{onConflict:'id'}));
        ensureSuccess(await supabase.from('memory_pathway_items').delete().eq('pathway_id',pathwayId).eq('user_id',state.user.id));
        const itemRows = (pathway.memory_ids || []).map((memoryId,index) => ({
          user_id:state.user.id,
          pathway_id:pathwayId,
          memory_id:mapped(memoryIdMap,memoryId),
          sort_order:index
        })).filter(row => row.memory_id);
        if (itemRows.length) ensureSuccess(await supabase.from('memory_pathway_items').insert(itemRows));
      }

      for (const link of payload.links || []) {
        const sourceId = mapped(memoryIdMap,link.source_memory_id);
        const targetId = mapped(memoryIdMap,link.target_memory_id);
        if (!sourceId || !targetId || sourceId === targetId) continue;
        const row = {
          ...link,
          id:mapped(linkIdMap,link.id) || crypto.randomUUID(),
          user_id:state.user.id,
          source_memory_id:sourceId,
          target_memory_id:targetId
        };
        ensureSuccess(await supabase.from('memory_links').upsert(row,{onConflict:'id'}));
      }

      if (payload.profile?.current_chapter) {
        ensureSuccess(await supabase.from('memory_profiles').update({ current_chapter:payload.profile.current_chapter }).eq('id',state.user.id));
      }

      await loadData(); renderAll(); toast('Archive imported','Memories, connections, and pathways were restored. Media files may need to be added again.');
    }
  } catch (error) { toast('Import failed',friendlyError(error),'error'); }
  finally { setSyncing(false); $('#import-file').value=''; }
}

function mergeById(current, incoming) {
  const map = new Map(current.map(item => [item.id,item]));
  for (const item of incoming) map.set(item.id,{...map.get(item.id),...item});
  return [...map.values()];
}

/* Constellation */
function prepareConstellation() {
  const memories = filteredMemories();
  const nodes = memories.map((memory,index) => {
    const angle = index / Math.max(1,memories.length) * Math.PI * 2;
    const radius = 120 + (index%4)*55;
    return { memory, x:Math.cos(angle)*radius + (Math.random()-.5)*50, y:Math.sin(angle)*radius + (Math.random()-.5)*50, vx:0,vy:0,r:memory.memory_type==='fragment'?9:11 };
  });
  const links = [];
  for (let i=0;i<nodes.length;i++) for (let j=i+1;j<nodes.length;j++) {
    const strength = connectionStrength(nodes[i].memory,nodes[j].memory);
    if (strength > 0) links.push({a:nodes[i],b:nodes[j],strength});
  }
  state.constellation.nodes = nodes;
  state.constellation.links = links.sort((a,b)=>b.strength-a.strength).slice(0,Math.max(40,nodes.length*4));
  $('#constellation-empty').hidden = nodes.length >= 2;
}

function connectionStrength(a,b) {
  let score = 0;
  const aPeople = new Set((a.people||[]).map(p=>p.name.toLowerCase()));
  if ((b.people||[]).some(p=>aPeople.has(p.name.toLowerCase()))) score += 3;
  if (a.place?.name && a.place.name === b.place?.name) score += 3;
  if (a.life_chapter && a.life_chapter === b.life_chapter) score += 2;
  const aTags = new Set((a.tags||[]).map(t=>t.toLowerCase()));
  score += Math.min(2,(b.tags||[]).filter(t=>aTags.has(t.toLowerCase())).length);
  if (a.occurred_on && b.occurred_on && Math.abs(new Date(a.occurred_on)-new Date(b.occurred_on)) < 120*86400000) score += 1;
  return score;
}

function resizeConstellation() {
  const canvas = $('#constellation-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2,window.devicePixelRatio||1);
  canvas.width = Math.max(1,Math.round(rect.width*dpr)); canvas.height = Math.max(1,Math.round(rect.height*dpr));
  canvas.dataset.dpr = dpr;
}

function startConstellation() {
  cancelAnimationFrame(state.constellation.animationFrame);
  const loop = () => {
    if (state.activeView === 'constellation') drawConstellation();
    state.constellation.animationFrame = requestAnimationFrame(loop);
  };
  loop();
}

function drawConstellation() {
  const canvas = $('#constellation-canvas');
  if (!canvas || !canvas.width) return;
  const ctx = canvas.getContext('2d');
  const dpr = Number(canvas.dataset.dpr || 1);
  const width = canvas.width/dpr, height = canvas.height/dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
  const c = state.constellation;

  // A light, stable force pass keeps the graph alive without allowing it to explode.
  for (const link of c.links) {
    const dx=link.b.x-link.a.x, dy=link.b.y-link.a.y, distance=Math.max(1,Math.hypot(dx,dy));
    const target=110 + (3-link.strength)*24;
    const force=(distance-target)*.00035;
    link.a.vx += dx/distance*force; link.a.vy += dy/distance*force;
    link.b.vx -= dx/distance*force; link.b.vy -= dy/distance*force;
  }
  for (let i=0;i<c.nodes.length;i++) {
    const node=c.nodes[i];
    node.vx += -node.x*.00003; node.vy += -node.y*.00003;
    for (let j=i+1;j<c.nodes.length;j++) {
      const other=c.nodes[j], dx=other.x-node.x, dy=other.y-node.y, d2=Math.max(150,dx*dx+dy*dy), f=12/d2;
      node.vx -= dx*f; node.vy -= dy*f; other.vx += dx*f; other.vy += dy*f;
    }
    node.vx*=.94; node.vy*=.94; node.x+=node.vx; node.y+=node.vy;
  }

  ctx.save(); ctx.translate(width/2+c.offsetX,height/2+c.offsetY); ctx.scale(c.scale,c.scale);
  for (const link of c.links) {
    ctx.beginPath(); ctx.moveTo(link.a.x,link.a.y); ctx.lineTo(link.b.x,link.b.y);
    ctx.strokeStyle=`rgba(157,124,255,${.05+link.strength*.035})`; ctx.lineWidth=.8/c.scale; ctx.stroke();
  }
  for (const node of c.nodes) {
    const fragment=node.memory.memory_type==='fragment';
    const glow=ctx.createRadialGradient(node.x,node.y,0,node.x,node.y,node.r*3.2);
    glow.addColorStop(0,fragment?'rgba(255,139,184,.28)':'rgba(157,124,255,.28)'); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(node.x,node.y,node.r*3.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fragment?'#ff8bb8':'#9d7cff'; ctx.beginPath(); ctx.arc(node.x,node.y,node.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1/c.scale; ctx.stroke();
    if (c.scale>.65) {
      ctx.font=`${11/c.scale}px DM Sans`; ctx.textAlign='center'; ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';
      const label=node.memory.title.length>28?node.memory.title.slice(0,26)+'…':node.memory.title;
      ctx.fillText(label,node.x,node.y+node.r+16/c.scale);
    }
  }
  ctx.restore();
}

function constellationPoint(event) {
  const canvas=$('#constellation-canvas'), rect=canvas.getBoundingClientRect(), c=state.constellation;
  const x=(event.clientX-rect.left-rect.width/2-c.offsetX)/c.scale;
  const y=(event.clientY-rect.top-rect.height/2-c.offsetY)/c.scale;
  return {x,y};
}

/* UI events */
function closeModal(button) {
  const dialog = button.closest('dialog');
  if (dialog) dialog.close();
}
function openSidebar() { $('#sidebar').classList.add('is-open'); $('#mobile-backdrop').classList.add('is-visible'); }
function closeSidebar() { $('#sidebar').classList.remove('is-open'); $('#mobile-backdrop').classList.remove('is-visible'); }

function applyTheme(theme) {
  const effective = theme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = effective;
  localStorage.setItem(THEME_KEY,theme);
  $$('[data-theme-choice]').forEach(button => button.classList.toggle('is-active',button.dataset.themeChoice===theme));
  $('#theme-toggle').textContent = effective === 'light' ? '☾' : '☼';
}

function cycleTheme() {
  const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  applyTheme(current === 'light' ? 'dark' : 'light');
}

function positionProfileMenu() {
  const trigger=$('[data-action="profile-menu"]'), menu=$('#profile-menu'), rect=trigger.getBoundingClientRect();
  menu.style.left=`${Math.max(10,rect.left)}px`; menu.style.top=`${Math.max(10,rect.top-menu.offsetHeight-8)}px`; menu.hidden=!menu.hidden;
}

function setupEvents() {
  document.addEventListener('click', async event => {
    const nav = event.target.closest('[data-nav]');
    if (nav && state.mode !== 'landing') { event.preventDefault(); navigate(nav.dataset.nav); $('#profile-menu').hidden=true; return; }
    const memoryTarget = event.target.closest('[data-memory-id]');
    if (memoryTarget && !memoryTarget.dataset.action) { event.preventDefault(); openMemoryDetail(memoryTarget.dataset.memoryId); return; }
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) {
      if (!event.target.closest('#profile-menu') && !event.target.closest('[data-action="profile-menu"]')) $('#profile-menu').hidden=true;
      return;
    }
    const action = actionEl.dataset.action;
    if (action === 'open-auth') openAuth(actionEl.dataset.mode || 'signin');
    else if (action === 'enter-demo') enterApp('demo');
    else if (action === 'close-modal') closeModal(actionEl);
    else if (action === 'google-auth') googleAuth();
    else if (action === 'magic-link') sendMagicLink();
    else if (action === 'new-memory') openMemoryModal();
    else if (action === 'new-fragment') openMemoryModal({type:'fragment'});
    else if (action === 'answer-prompt') openMemoryModal({prompt:actionEl.dataset.prompt});
    else if (action === 'shuffle-featured') renderFeaturedMemory(Math.floor(Math.random()*Math.max(1,state.memories.length)));
    else if (action === 'edit-memory') { closeDetail(); openMemoryModal({memory:state.memories.find(item=>item.id===actionEl.dataset.memoryId)}); }
    else if (action === 'toggle-favorite') toggleFavorite(actionEl.dataset.memoryId);
    else if (action === 'delete-memory') deleteMemory(actionEl.dataset.memoryId);
    else if (action === 'close-detail') closeDetail();
    else if (action === 'new-pathway') openPathwayModal();
    else if (action === 'edit-pathway') openPathwayModal(state.pathways.find(item=>item.id===actionEl.dataset.pathwayId));
    else if (action === 'delete-pathway') deletePathway(actionEl.dataset.pathwayId);
    else if (action === 'create-suggested-pathway') openPathwayModal(null,buildPathwaySuggestions().find(item=>item.key===actionEl.dataset.suggestion));
    else if (action === 'new-person') openEntityModal('person');
    else if (action === 'new-place') openEntityModal('place');
    else if (action === 'new-chapter') openEntityModal('chapter');
    else if (action === 'edit-entity') {
      const type=actionEl.dataset.entityType, list=type==='person'?state.people:type==='place'?state.places:state.chapters;
      openEntityModal(type,list.find(item=>item.id===actionEl.dataset.entityId));
    }
    else if (action === 'edit-chapter') editCurrentChapter();
    else if (action === 'profile-menu') positionProfileMenu();
    else if (action === 'export-data') exportArchive();
    else if (action === 'sign-out') signOut();
    else if (action === 'remove-upload') {
      const index=Number(actionEl.dataset.uploadIndex);
      if (actionEl.dataset.existing==='true') await removeExistingMedia(index); else { state.pendingFiles.splice(index,1); renderUploadPreview(); }
    }
    else if (action === 'jump-today') { state.timelineSort='desc'; $('#timeline-sort').value='desc'; renderTimeline(); }
  });

  document.addEventListener('click', event => {
    const filter=event.target.closest('[data-filter]');
    if (filter) { state.timelineFilter=filter.dataset.filter; $$('[data-filter]').forEach(item=>item.classList.toggle('is-active',item===filter)); renderTimeline(); }
    const tab=event.target.closest('[data-auth-tab]'); if(tab) setAuthMode(tab.dataset.authTab);
    const type=event.target.closest('[data-memory-type]'); if(type) setMemoryType(type.dataset.memoryType);
    const choice=event.target.closest('[data-choice]'); if(choice) choice.classList.toggle('is-selected');
    const fragmentPrompt=event.target.closest('[data-fragment-prompt]'); if(fragmentPrompt) openMemoryModal({type:'fragment',title:fragmentPrompt.dataset.fragmentPrompt});
    const libraryTab=event.target.closest('[data-library-tab]');
    if(libraryTab){ $$('[data-library-tab]').forEach(item=>item.classList.toggle('is-active',item===libraryTab)); $$('.library-panel').forEach(panel=>panel.classList.toggle('is-active',panel.id===`library-${libraryTab.dataset.libraryTab}`)); }
    const theme=event.target.closest('[data-theme-choice]'); if(theme) applyTheme(theme.dataset.themeChoice);
  });

  $('#auth-form').addEventListener('submit',handleAuthSubmit);
  $('#memory-form').addEventListener('submit',handleMemorySave);
  $('#pathway-form').addEventListener('submit',handlePathwaySave);
  $('#entity-form').addEventListener('submit',handleEntitySave);
  $('#timeline-sort').addEventListener('change',event=>{state.timelineSort=event.target.value;renderTimeline();});
  $('#fragment-sort').addEventListener('change',event=>{state.fragmentSort=event.target.value;renderFragments();});
  $('#pathway-memory-options').addEventListener('change',updatePathwaySelectedCount);
  $('#global-search').addEventListener('input',event=>{ state.search=event.target.value; if(state.search&&state.activeView==='today') navigate('timeline'); renderAll(); });
  $('#theme-toggle').addEventListener('click',cycleTheme);
  $('#menu-button').addEventListener('click',openSidebar);
  $('#sidebar-close').addEventListener('click',closeSidebar);
  $('#mobile-backdrop').addEventListener('click',closeSidebar);
  $('#realtime-toggle').addEventListener('change',event=>{state.realtimeEnabled=event.target.checked;if(state.realtimeEnabled)subscribeRealtime();else if(state.realtimeChannel)supabase.removeChannel(state.realtimeChannel);});
  $('#import-file').addEventListener('change',event=>importArchive(event.target.files[0]));
  window.addEventListener('resize',resizeConstellation);
  window.addEventListener('hashchange',()=>state.mode!=='landing'&&navigate(location.hash.replace('#',''),false));
  document.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#global-search').focus();}
    if(event.key==='Escape')closeDetail();
  });

  const fileInput=$('#memory-files'), drop=$('#memory-upload-drop');
  fileInput.addEventListener('change',()=>{state.pendingFiles.push(...fileInput.files);fileInput.value='';renderUploadPreview();});
  ['dragenter','dragover'].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.add('is-dragging');}));
  ['dragleave','drop'].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.remove('is-dragging');}));
  drop.addEventListener('drop',event=>{state.pendingFiles.push(...event.dataTransfer.files);renderUploadPreview();});

  const canvas=$('#constellation-canvas');
  canvas.addEventListener('pointerdown',event=>{const c=state.constellation;c.dragging=true;c.moved=false;c.lastX=event.clientX;c.lastY=event.clientY;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{const c=state.constellation;if(!c.dragging)return;const dx=event.clientX-c.lastX,dy=event.clientY-c.lastY;if(Math.abs(dx)+Math.abs(dy)>2)c.moved=true;c.offsetX+=dx;c.offsetY+=dy;c.lastX=event.clientX;c.lastY=event.clientY;});
  canvas.addEventListener('pointerup',event=>{const c=state.constellation;c.dragging=false;if(!c.moved){const point=constellationPoint(event);const node=c.nodes.find(node=>Math.hypot(node.x-point.x,node.y-point.y)<node.r+8/c.scale);if(node)openMemoryDetail(node.memory.id);}});
  canvas.addEventListener('wheel',event=>{event.preventDefault();const c=state.constellation;c.scale=Math.max(.45,Math.min(2.5,c.scale*(event.deltaY>0?.9:1.1)));},{passive:false});
}

async function init() {
  $('#copyright-year').textContent = new Date().getFullYear();
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  setupEvents();
  setupRevealAnimations();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(console.warn);

  const { data:{ session } } = await supabase.auth.getSession();
  if (session?.user) {
    state.user=session.user;
    $('#auth-modal').open && $('#auth-modal').close();
    await enterApp('supabase');
  } else showLanding();

  supabase.auth.onAuthStateChange(async (event,session) => {
    if (session?.user && state.user?.id !== session.user.id) {
      state.user=session.user;
      if ($('#auth-modal').open) $('#auth-modal').close();
      await enterApp('supabase');
    } else if (event==='SIGNED_OUT' && state.mode==='supabase') showLanding();
  });
}

function setupRevealAnimations() {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);} }),{threshold:.12});
  $$('.reveal').forEach(el=>observer.observe(el));
}

init().catch(error => {
  console.error(error);
  toast('Memories could not start',friendlyError(error),'error');
  showLanding();
});
