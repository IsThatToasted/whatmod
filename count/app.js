const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED = new Set(['♥','♦']);
const hiLo = r => ['2','3','4','5','6'].includes(r) ? 1 : ['10','J','Q','K','A'].includes(r) ? -1 : 0;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

const lessons = [
  {
    id:'orientation',n:1,title:'How Counting Actually Works',time:'12 min',level:'Foundation',
    summary:'Separate myth from math. Learn what card counting tracks, what it does not predict, and why remaining-card composition matters.',
    body:`
      <p>Card counting is a <strong>composition-tracking system</strong>. You are not trying to predict the next card. You are estimating whether the undealt cards contain a higher-than-normal concentration of tens and aces or a higher-than-normal concentration of small cards.</p>
      <h2>The core idea</h2>
      <p>Small cards generally help the dealer complete weak hands. Tens and aces create more blackjacks, more strong player doubles, and more dealer bust pressure in certain situations. A balanced count converts visible cards into a compact running score.</p>
      <div class="callout">Think of the count as a continuously updated summary of the cards that have left the shoe—not a prediction engine.</div>
      <h2>Three skills you will build</h2>
      <ul><li><strong>Running count:</strong> update the count without hesitation.</li><li><strong>Deck estimation:</strong> estimate how many decks remain.</li><li><strong>True count:</strong> normalize the running count by remaining decks.</li></ul>
      <h2>Professional standard</h2>
      <p>A strong counter can keep a correct running count while normal table events occur, estimate remaining decks consistently, convert to true count quickly, and preserve basic-strategy accuracy. Speed is useful only after accuracy is automatic.</p>
      <div class="callout warn">This course is educational. Rules, casino policies, and local law differ by jurisdiction. Counting is not a guarantee of profit, and casinos can refuse service or restrict play.</div>`,
    quiz:{q:'What is the count primarily estimating?',opts:['The exact identity of the next card','The composition of the undealt cards','The dealer’s hidden card','The probability that a shuffle is random'],a:1,why:'A count summarizes the composition of cards remaining in the shoe.'}
  },
  {
    id:'hilo',n:2,title:'The Hi-Lo Tag System',time:'16 min',level:'Foundation',
    summary:'Memorize the +1 / 0 / −1 tags and learn to process exposed cards in groups rather than one at a time.',
    body:`<p>Hi-Lo is a balanced level-one counting system. Every exposed rank receives one of three values.</p>
      <table class="rule-table"><thead><tr><th>Ranks</th><th>Tag</th><th>Meaning</th></tr></thead><tbody>
      <tr><td>2, 3, 4, 5, 6</td><td><span class="pill">+1</span></td><td>Removing a low card makes the remaining shoe slightly richer in high cards.</td></tr>
      <tr><td>7, 8, 9</td><td><span class="pill">0</span></td><td>Neutral in the Hi-Lo system.</td></tr>
      <tr><td>10, J, Q, K, A</td><td><span class="pill">−1</span></td><td>Removing a high card makes the remaining shoe slightly poorer in high cards.</td></tr></tbody></table>
      <h2>Cancellation is faster than counting</h2><p>Train your eyes to cancel +1 and −1 cards instantly. A 5 and a king together contribute zero. A 4, 6, queen, ace contributes zero. This reduces mental workload dramatically.</p>
      <h2>Balanced means reset</h2><p>A full deck contains equal positive and negative tag totals, so a properly counted full shoe finishes at zero. That makes error-checking possible during practice.</p>`,
    quiz:{q:'What is the Hi-Lo value of A, 8, 4, K, 6?',opts:['+2','0','−1','+1'],a:1,why:'A (−1) + 8 (0) + 4 (+1) + K (−1) + 6 (+1) = 0.'}
  },
  {
    id:'running',n:3,title:'Running Count Mechanics',time:'18 min',level:'Foundation',
    summary:'Build a reliable running count, use cancellation, and eliminate the most common mental accounting errors.',
    body:`<p>The running count starts at zero immediately after a verified shuffle. Every visible card updates it. The technical challenge is not arithmetic; it is maintaining state continuously without skipping or double-counting cards.</p>
      <h2>Best processing order</h2><ul><li>Scan the complete exposed layout.</li><li>Cancel opposite tags visually.</li><li>Count the leftover low or high cards.</li><li>Update the running total once.</li></ul>
      <div class="callout">Instead of saying “plus one, minus one, zero, plus one…” internally, train yourself to see net groups: <strong>+2, 0, −1</strong>.</div>
      <h2>Error control</h2><p>If you lose the count during training, stop and reconstruct from the visible sequence. In actual play, never invent a number. A guessed count can be worse than no count because it creates false confidence.</p>`,
    quiz:{q:'What is the strongest way to process a crowded layout?',opts:['Count every card aloud','Group and cancel opposite tags before updating','Ignore neutral cards and restart each round','Convert every card directly to true count'],a:1,why:'Grouping and cancellation reduce the number of mental operations.'}
  },
  {
    id:'decks',n:4,title:'Deck Estimation',time:'20 min',level:'Core Skill',
    summary:'Estimate quarter- and half-deck increments so the running count can be normalized correctly.',
    body:`<p>A running count of +6 means very different things with five decks remaining versus one deck remaining. Deck estimation tells you the denominator for the true-count conversion.</p>
      <h2>Calibration method</h2><p>Practice visually against known stacks: one deck, half deck, quarter deck, then combinations such as 1.5 and 2.5 decks. When training a six-deck shoe, repeatedly pause and estimate before revealing the exact remainder.</p>
      <h2>Reasonable precision</h2><p>Beginners should first become consistent to the nearest half deck. Advanced training can tighten to quarter-deck resolution in shallow parts of the shoe, where estimation error has more impact.</p>
      <div class="callout warn">False precision is not useful. A repeatable half-deck estimate is better than a random quarter-deck guess.</div>`,
    quiz:{q:'Why does deck estimation matter?',opts:['It predicts the cut card','It converts the running count into a density-based true count','It changes the Hi-Lo tag values','It determines the dealer’s hole card'],a:1,why:'The true count normalizes the running count by the estimated decks remaining.'}
  },
  {
    id:'truecount',n:5,title:'True Count Conversion',time:'24 min',level:'Core Skill',
    summary:'Turn running count into high-card density using consistent division and a defined rounding convention.',
    body:`<p>The basic relationship is:</p><div class="callout"><strong>True Count = Running Count ÷ Estimated Decks Remaining</strong></div>
      <p>Example: RC +8 with 4 decks remaining gives TC +2. RC −3 with 1.5 decks remaining gives TC −2.</p>
      <h2>Choose a rounding convention</h2><p>Index systems often assume a particular conversion method. Common training conventions include flooring, truncating toward zero, or using exact/nearest values. The important professional habit is consistency with the index set you actually study.</p>
      <h2>Fast mental division</h2><ul><li>4 decks: divide by 4.</li><li>2 decks: divide by 2.</li><li>1 deck: RC ≈ TC.</li><li>0.5 deck: TC ≈ RC × 2.</li></ul>
      <p>The drill section deliberately mixes positive and negative numbers because many counting mistakes appear only below zero.</p>`,
    quiz:{q:'RC +9 with 3 decks remaining is approximately what true count?',opts:['+1','+2','+3','+6'],a:2,why:'+9 ÷ 3 = +3.'}
  },
  {
    id:'basic',n:6,title:'Basic Strategy as the Baseline',time:'22 min',level:'Core Skill',
    summary:'Understand why counting sits on top of rule-specific basic strategy rather than replacing it.',
    body:`<p>Counting is not a substitute for basic strategy. Basic strategy is the default decision framework for the game’s rules; count-based indices modify a limited subset of decisions when the remaining-card composition shifts enough.</p>
      <h2>Rule sensitivity</h2><p>Dealer H17 versus S17, double rules, surrender availability, deck count, and other rules can change the correct baseline. A professional workflow is therefore: identify the game rules → use the matching strategy → apply only the relevant count deviations.</p>
      <div class="callout">If basic-strategy accuracy is not essentially automatic, adding a count usually makes total decision accuracy worse.</div>
      <h2>Training target</h2><p>Before progressing to deviation work, aim for near-perfect strategy decisions under timed practice while simultaneously keeping an accurate count.</p>`,
    quiz:{q:'What should count-based decisions be built on top of?',opts:['Intuition','A rule-matched basic strategy','The previous hand result','A betting progression'],a:1,why:'The count modifies a rule-specific basic-strategy baseline.'}
  },
  {
    id:'indices',n:7,title:'Index Numbers & Deviations',time:'28 min',level:'Advanced',
    summary:'Learn what an index means, how thresholds work, and why exact values depend on rules and the system used.',
    body:`<p>An index is a true-count threshold where a play changes from its basic-strategy action to a count-sensitive alternative. For example, one famous Hi-Lo benchmark is the 16 vs 10 decision near a true count of zero in many common index sets.</p>
      <h2>Threshold logic</h2><p>If an index says “stand at TC ≥ 0,” the decision changes only when your chosen true-count conversion reaches that threshold. The mathematics assumes a specific ruleset, counting system, and index-generation method.</p>
      <h2>High-value learning order</h2><p>Rather than memorizing dozens of marginal plays at once, advanced students typically learn the most impactful departures first, then expand. This app teaches the mechanics and gives a compact reference set, but you should verify any production index set against the exact rules you intend to model.</p>
      <div class="callout warn">Index values are not universally interchangeable. Rule set, surrender, H17/S17, deck count, and rounding method can matter.</div>`,
    quiz:{q:'What does an index number represent?',opts:['A guaranteed profitable hand','A true-count threshold where a decision changes','The number of decks in the shoe','The house edge for every rule set'],a:1,why:'An index is a threshold used to trigger a strategy departure.'}
  },
  {
    id:'insurance',n:8,title:'Insurance as a Count Problem',time:'18 min',level:'Advanced',
    summary:'Understand the special role of high-card density in insurance decisions without relying on intuition.',
    body:`<p>Insurance is fundamentally a question about the density of ten-value cards among the unseen cards. Because the dealer shows an ace, the player is effectively evaluating whether the hole card is a ten-value card often enough to justify the offered price.</p>
      <h2>Why counters study it</h2><p>Unlike many playing decisions, insurance reacts strongly to the concentration of tens. Hi-Lo index sets commonly place the insurance threshold around TC +3, but the exact benchmark should be tied to the system and rules being studied.</p>
      <div class="callout">The lesson is conceptual: insurance should be treated as a composition-dependent decision, not a hunch.</div>`,
    quiz:{q:'Why is insurance especially count-sensitive?',opts:['It depends heavily on the density of ten-value cards','It depends only on aces already dealt','It always has the same value','It changes the payout for blackjack'],a:0,why:'Insurance is essentially a wager on whether the dealer’s hole card is ten-valued.'}
  },
  {
    id:'simultaneous',n:9,title:'Dual-Task Performance',time:'25 min',level:'Advanced',
    summary:'Keep the count while making decisions, handling chips, conversation, and natural visual interruptions.',
    body:`<p>The leap from isolated drills to table-grade performance is a dual-task problem. Your counting process must consume little enough working memory that strategic decisions remain accurate.</p>
      <h2>Layered progression</h2><ul><li>Count single cards.</li><li>Count full layouts.</li><li>Count while answering simple strategy prompts.</li><li>Count with changing deal speed.</li><li>Count with short interruptions and resume from memory.</li></ul>
      <h2>Do not chase speed too early</h2><p>Automaticity comes from error-free repetitions. A 20-second deck with errors is not stronger than a 35-second deck at 100% accuracy.</p>`,
    quiz:{q:'What should happen before aggressively training speed?',opts:['Accuracy should become stable','You should memorize shuffle patterns','You should stop using basic strategy','You should increase deck count'],a:0,why:'Fast errors are still errors; automatic accuracy is the foundation.'}
  },
  {
    id:'shoe',n:10,title:'Full-Shoe Control',time:'30 min',level:'Advanced',
    summary:'Maintain count integrity from shuffle to cut card and audit yourself with balanced-shoe checks.',
    body:`<p>A balanced count offers an important training audit: if you deal every card in a complete shoe and tag every card correctly, the final running count is zero.</p>
      <h2>Penetration</h2><p>Penetration describes how much of the shoe is dealt before the cut card stops play. Deeper penetration means fewer unseen cards remain near the end, making a given running imbalance more concentrated. The shoe trainer lets you model different penetration levels.</p>
      <h2>Recovery protocol</h2><p>If you are interrupted, preserve the last verified running count first. Resume only when you know which cards have and have not been incorporated. Training should reward count integrity, not pretending continuity.</p>`,
    quiz:{q:'A correctly counted complete balanced Hi-Lo shoe should finish at:',opts:['+1','−1','0','The number of decks'],a:2,why:'Hi-Lo is balanced, so a complete deck or shoe nets to zero.'}
  },
  {
    id:'variance',n:11,title:'Variance, Risk & Expectations',time:'24 min',level:'Professional',
    summary:'Learn why short-term results are noisy and why mathematical edge does not eliminate losing sessions.',
    body:`<p>Blackjack outcomes are highly variable. Even when a model indicates a favorable expectation under specific conditions, short-run results can diverge dramatically from that expectation.</p>
      <h2>Expected value vs. result</h2><p>Expected value is a long-run average across repeated trials. Variance describes how widely actual outcomes spread around that average. A positive expectation never means the next hand, hour, or trip must be profitable.</p>
      <h2>Risk discipline</h2><p>Professional analysis separates skill accuracy from money outcomes. During training, judge yourself by count accuracy, true-count accuracy, strategy accuracy, and error rate—not by whether a simulated hand happened to win.</p>
      <div class="callout warn">Never treat card counting as guaranteed income. Real-money gambling carries substantial financial risk.</div>`,
    quiz:{q:'What does a positive expected value guarantee?',opts:['A winning session','A winning next hand','Nothing about a specific short-term result','No drawdowns'],a:2,why:'Expectation is a long-run average and does not guarantee a short-term result.'}
  },
  {
    id:'assessment',n:12,title:'Professional Training Protocol',time:'20 min',level:'Professional',
    summary:'Use measurable standards, deliberate practice, and error logs to turn isolated skills into repeatable performance.',
    body:`<p>Improvement accelerates when every practice session has a measurable target. “Practice counting” is vague. “Complete five single-deck runs with zero errors, average under 35 seconds” is measurable.</p>
      <h2>Suggested skill gates</h2><ul><li>Hi-Lo tags: instant recognition.</li><li>Single-deck count: zero errors across repeated runs.</li><li>True-count conversion: ≥95% accuracy in timed sets.</li><li>Deck estimation: consistent to the trained increment.</li><li>Full shoe: no count-loss events.</li><li>Decision overlay: maintain strategy accuracy while counting.</li></ul>
      <h2>Error log</h2><p>Classify every miss: tag error, skipped card, double-counted card, sign error, deck-estimation error, division error, or decision error. Fix the category—not just the individual question.</p>
      <div class="callout">The certification exam in this app is a training benchmark, not a professional license or casino credential.</div>`,
    quiz:{q:'Which practice goal is most useful?',opts:['“Get better at counting”','“Practice sometime this week”','“Complete five error-free deck runs under a defined time target”','“Win a simulated session”'],a:2,why:'A measurable skill goal creates objective feedback and repeatable training.'}
  }
];

const state = JSON.parse(localStorage.getItem('countlabState')||'null') || {
  completed:[], quizPassed:[], drillCorrect:0, drillTotal:0, bestDeckTime:null, streak:0, lastVisit:null, examBest:0
};
function save(){localStorage.setItem('countlabState',JSON.stringify(state));updateGlobalUI()}
function updateStreak(){
  const today=new Date().toISOString().slice(0,10); if(state.lastVisit===today)return;
  if(state.lastVisit){const prev=new Date(state.lastVisit+'T12:00:00');const now=new Date(today+'T12:00:00');const d=Math.round((now-prev)/86400000);state.streak=d===1?(state.streak||0)+1:1}else state.streak=1;
  state.lastVisit=today; save();
}
function progressPct(){return Math.round((state.completed.length/lessons.length)*100)}
function levelName(){const p=progressPct();return p>=100?'Certified Track':p>=75?'Professional':p>=45?'Advanced':p>=20?'Core Skill':'Foundation'}
function updateGlobalUI(){
  const p=progressPct(); $('#sidebarProgress').style.width=p+'%';$('#sidebarPct').textContent=p+'%';$('#sidebarLevel').textContent=levelName();$('#streakCount').textContent=state.streak||0;
}
function setView(name){
  $$('.view').forEach(v=>v.classList.remove('active'));$('#view-'+name).classList.add('active');
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  $('#crumbTitle').textContent=({dashboard:'Dashboard',course:'Course',drills:'Drills',shoe:'Shoe Trainer',exam:'Certification',reference:'Reference'})[name]||name;
  $('#sidebar').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'});
  if(name==='dashboard')renderDashboard();if(name==='course')renderCourse();if(name==='drills')renderDrills();if(name==='shoe')renderShoe();if(name==='exam')renderExam();if(name==='reference')renderReference();
}

function renderDashboard(){
  const v=$('#view-dashboard'),p=progressPct(),acc=state.drillTotal?Math.round(state.drillCorrect/state.drillTotal*100):0;
  const next=lessons.find(l=>!state.completed.includes(l.id))||lessons[lessons.length-1];
  v.innerHTML=`
    <div class="hero">
      <div class="hero-card"><div class="eyebrow">Professional blackjack math training</div><h1>Master the count.<br/>Prove the skill.</h1><p>Build Hi-Lo from first principles, then train running count, true count, deck estimation, full-shoe endurance and decision thresholds in a measurable practice environment.</p><div class="hero-actions"><button class="primary" id="continueBtn">${p? 'Continue course':'Start course'}</button><button class="secondary" data-go="shoe">Open shoe trainer</button></div></div>
      <div class="stats-card"><div><div class="eyebrow">Course completion</div><div class="donut-wrap"><div class="donut" style="--p:${p}"><div class="donut-center"><b>${p}%</b><small>${state.completed.length}/${lessons.length} modules</small></div></div></div></div><div class="metric-row"><div class="metric"><b>${acc}%</b><span>Drill accuracy</span></div><div class="metric"><b>${state.bestDeckTime?state.bestDeckTime.toFixed(1)+'s':'—'}</b><span>Best deck</span></div><div class="metric"><b>${state.examBest||0}%</b><span>Exam best</span></div></div></div>
    </div>
    <div class="section-title"><div><h2>Continue learning</h2><p>Your next recommended module</p></div><span class="tag green">${next.level}</span></div>
    <div class="card clickable" id="nextLesson"><div class="icon">${next.n.toString().padStart(2,'0')}</div><h3>${next.title}</h3><p>${next.summary}</p><div class="tag-row"><span class="tag">${next.time}</span><span class="tag">Module ${next.n} of ${lessons.length}</span></div></div>
    <div class="section-title"><div><h2>Training lab</h2><p>Turn theory into automatic execution</p></div></div>
    <div class="grid four">
      ${trainCards().map(x=>`<div class="card clickable" data-drill="${x.id}"><div class="icon">${x.icon}</div><h3>${x.title}</h3><p>${x.desc}</p><div class="tag-row"><span class="tag">${x.tag}</span></div></div>`).join('')}
    </div>
    <div class="section-title"><div><h2>Skill benchmarks</h2><p>Use accuracy-first targets</p></div></div>
    <div class="grid three">
      <div class="card"><h3>Foundation</h3><p>Instant Hi-Lo tags, clean cancellation, and repeated single-deck counts with no arithmetic errors.</p><div class="tag-row"><span class="tag green">Accuracy first</span></div></div>
      <div class="card"><h3>Advanced</h3><p>Fast true-count conversion, consistent deck estimation, and full-shoe count integrity under variable deal speed.</p><div class="tag-row"><span class="tag">Dual task</span></div></div>
      <div class="card"><h3>Professional track</h3><p>Maintain counting accuracy while applying rule-matched strategy and verified index thresholds.</p><div class="tag-row"><span class="tag warn">Rules matter</span></div></div>
    </div>`;
  $('#continueBtn').onclick=()=>openLesson(next.id);$('#nextLesson').onclick=()=>openLesson(next.id);
  v.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
  v.querySelectorAll('[data-drill]').forEach(c=>c.onclick=()=>{setView('drills');setTimeout(()=>startDrill(c.dataset.drill),20)});
}

function renderCourse(){
  const v=$('#view-course');v.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>CountLab curriculum</h2><p>12 modules from mechanics to professional practice structure</p></div><span class="tag green">${progressPct()}% complete</span></div><div class="lesson-list">${lessons.map(l=>{const done=state.completed.includes(l.id);return `<div class="lesson-row ${done?'done':''}" data-lesson="${l.id}"><div class="lesson-num">${done?'✓':l.n}</div><div><div class="lesson-title">${l.title}</div><div class="lesson-meta">${l.level} • ${l.time} — ${l.summary}</div></div><div class="lesson-progress"><span>${done?'Completed':'Open lesson'}</span><i class="status-dot ${done?'done':''}"></i></div></div>`}).join('')}</div>`;
  v.querySelectorAll('[data-lesson]').forEach(r=>r.onclick=()=>openLesson(r.dataset.lesson));
}
function openLesson(id){
  const l=lessons.find(x=>x.id===id); if(!l)return; setView('course'); const v=$('#view-course');
  v.innerHTML=`<div class="lesson-content"><button class="ghost small" id="backCourse">← Curriculum</button><div class="eyebrow" style="margin-top:24px">Module ${l.n} • ${l.level} • ${l.time}</div><h1>${l.title}</h1><p>${l.summary}</p>${l.body}<div class="card" style="margin-top:30px"><div class="eyebrow">Knowledge check</div><h2 style="margin-top:8px">${l.quiz.q}</h2><div id="lessonQuiz">${l.quiz.opts.map((o,i)=>`<button class="quiz-option" data-qopt="${i}">${o}</button>`).join('')}</div><div id="quizExplain" class="feedback"></div><button class="primary" id="completeLesson" style="margin-top:14px" disabled>Complete module</button></div></div>`;
  $('#backCourse').onclick=renderCourse;
  v.querySelectorAll('[data-qopt]').forEach(btn=>btn.onclick=()=>{
    const i=+btn.dataset.qopt;v.querySelectorAll('[data-qopt]').forEach(b=>b.disabled=true);btn.classList.add(i===l.quiz.a?'correct':'wrong');
    if(i!==l.quiz.a)v.querySelector(`[data-qopt="${l.quiz.a}"]`).classList.add('correct');
    $('#quizExplain').textContent=(i===l.quiz.a?'Correct. ':'Review: ')+l.quiz.why;$('#quizExplain').className='feedback '+(i===l.quiz.a?'good':'bad');
    $('#completeLesson').disabled=false;if(i===l.quiz.a&&!state.quizPassed.includes(id)){state.quizPassed.push(id);save()}
  });
  $('#completeLesson').onclick=()=>{if(!state.completed.includes(id))state.completed.push(id);save();toast('Module completed');const next=lessons.find(x=>x.n===l.n+1);next?openLesson(next.id):setView('exam')};
}

function trainCards(){return [
  {id:'running',icon:'±',title:'Running Count Sprint',desc:'Process single cards at speed and enter the final Hi-Lo running count.',tag:'Speed + accuracy'},
  {id:'true',icon:'÷',title:'True Count Lab',desc:'Convert randomized running counts using changing deck estimates.',tag:'Mental division'},
  {id:'cancel',icon:'⇄',title:'Cancellation Grid',desc:'Read multi-card groups and reduce them to one net Hi-Lo value.',tag:'Visual grouping'},
  {id:'deck',icon:'▤',title:'52-Card Deck Run',desc:'Count an entire shuffled deck. Finish at zero and benchmark time.',tag:'Integrity check'}
]}
let drill=null;
let drillKeyHandler=null;
function renderDrills(){
  const v=$('#view-drills');v.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Training drills</h2><p>Choose a skill, then build speed only after accuracy is stable</p></div></div><div class="grid four">${trainCards().map(x=>`<div class="card clickable" data-drill="${x.id}"><div class="icon">${x.icon}</div><h3>${x.title}</h3><p>${x.desc}</p><div class="tag-row"><span class="tag">${x.tag}</span></div></div>`).join('')}</div><div id="drillMount" style="margin-top:16px"></div>`;v.querySelectorAll('[data-drill]').forEach(c=>c.onclick=()=>startDrill(c.dataset.drill));
}
function drillShell(title,desc){return `<div class="section-title"><div><h2>${title}</h2><p>${desc}</p></div><button class="ghost small" id="stopDrill">Stop</button></div><div class="drill-stage"><div class="card trainer-card" id="trainerMain"></div><div class="score-stack"><div class="score-tile"><small>Correct</small><b id="dCorrect">0</b></div><div class="score-tile"><small>Attempts</small><b id="dTotal">0</b></div><div class="score-tile"><small>Accuracy</small><b id="dAcc">—</b></div><div class="card"><h3>Keyboard</h3><p><span class="kbd">Enter</span> submit / next<br/><span class="kbd">Space</span> reveal next card in deck run.</p></div></div></div>`}
function startDrill(type){
  if(drillKeyHandler){document.removeEventListener('keydown',drillKeyHandler);drillKeyHandler=null}
  if(!$('#drillMount'))renderDrills();const m=$('#drillMount');let title='',desc='';
  if(type==='running'){title='Running Count Sprint';desc='Count a rapid sequence of individual cards.'}
  if(type==='true'){title='True Count Lab';desc='Convert RC ÷ decks remaining. Answers use nearest integer in this drill.'}
  if(type==='cancel'){title='Cancellation Grid';desc='Net each group before touching the answer field.'}
  if(type==='deck'){title='52-Card Deck Run';desc='Count one complete shuffled deck. Final count should be zero.'}
  m.innerHTML=drillShell(title,desc);$('#stopDrill').onclick=()=>m.innerHTML='';
  drill={type,correct:0,total:0}; if(type==='deck')startDeckRun(); else nextDrillQuestion();
}
function updateDrillScore(){const a=drill.total?Math.round(drill.correct/drill.total*100):0;$('#dCorrect').textContent=drill.correct;$('#dTotal').textContent=drill.total;$('#dAcc').textContent=drill.total?a+'%':'—'}
function cardHTML(card,mini=false){return `<div class="${mini?'mini-card':'playing-card'} ${RED.has(card.s)?'red':''}"><div class="corner">${card.r}<br/>${card.s}</div><div class="suit">${card.s}</div><div class="corner bottom">${card.r}<br/>${card.s}</div></div>`}
function randCard(){return {r:RANKS[Math.floor(Math.random()*RANKS.length)],s:SUITS[Math.floor(Math.random()*SUITS.length)]}}
function nextDrillQuestion(){
  const main=$('#trainerMain');if(!main)return;
  if(drill.type==='running'){
    const len=8+Math.floor(Math.random()*13),cards=Array.from({length:len},randCard),ans=cards.reduce((s,c)=>s+hiLo(c.r),0);
    main.innerHTML=`<div class="eyebrow">${len} card sequence</div><div class="dealt-cards" style="justify-content:center;margin-top:18px">${cards.map(c=>cardHTML(c,true)).join('')}</div><div class="answer-box"><input class="input" id="drillAnswer" type="number" placeholder="RC"/><button class="primary" id="drillSubmit">Check</button></div><div id="drillFeedback" class="feedback"></div>`;bindAnswer(ans,'Running count');
  } else if(drill.type==='true'){
    const decks=[.5,1,1.5,2,2.5,3,4,5][Math.floor(Math.random()*8)],rc=Math.floor(Math.random()*25)-12,ans=Math.round(rc/decks);
    main.innerHTML=`<div class="eyebrow">True count conversion</div><h1 style="font-size:72px;margin:12px 0">${rc>0?'+':''}${rc}</h1><p>Running count with <strong>${decks}</strong> decks remaining</p><div class="answer-box"><input class="input" id="drillAnswer" type="number" placeholder="TC"/><button class="primary" id="drillSubmit">Check</button></div><div id="drillFeedback" class="feedback"></div>`;bindAnswer(ans,'Nearest-integer true count');
  } else {
    const len=4+Math.floor(Math.random()*7),cards=Array.from({length:len},randCard),ans=cards.reduce((s,c)=>s+hiLo(c.r),0);
    main.innerHTML=`<div class="eyebrow">Cancellation group</div><div class="dealt-cards" style="justify-content:center;margin-top:18px">${cards.map(c=>cardHTML(c,true)).join('')}</div><p>Reduce the group to one net Hi-Lo value.</p><div class="answer-box"><input class="input" id="drillAnswer" type="number" placeholder="Net"/><button class="primary" id="drillSubmit">Check</button></div><div id="drillFeedback" class="feedback"></div>`;bindAnswer(ans,'Net count');
  }
}
function bindAnswer(ans,label){
  const input=$('#drillAnswer'),btn=$('#drillSubmit');input.focus();let checked=false;
  const submit=()=>{if(!checked){if(input.value==='')return;const val=+input.value,ok=val===ans;drill.total++;state.drillTotal++;if(ok){drill.correct++;state.drillCorrect++}save();updateDrillScore();$('#drillFeedback').textContent=ok?'Correct.':`${label}: ${ans>0?'+':''}${ans}`;$('#drillFeedback').className='feedback '+(ok?'good':'bad');btn.textContent='Next';checked=true}else nextDrillQuestion()};
  btn.onclick=submit;input.onkeydown=e=>{if(e.key==='Enter')submit()};
}
function startDeckRun(){
  const deck=shuffle(SUITS.flatMap(s=>RANKS.map(r=>({r,s}))));let i=0,rc=0,start=performance.now();const main=$('#trainerMain');
  const show=()=>{if(i>=deck.length){const t=(performance.now()-start)/1000;const ok=rc===0;drill.total++;state.drillTotal++;if(ok){drill.correct++;state.drillCorrect++;if(!state.bestDeckTime||t<state.bestDeckTime)state.bestDeckTime=t}save();updateDrillScore();main.innerHTML=`<div class="eyebrow">Deck complete</div><h1 style="font-size:70px;margin:10px 0">${rc>0?'+':''}${rc}</h1><p>${ok?'Perfect count integrity.':'The deck should finish at zero.'}</p><div class="tag-row" style="justify-content:center"><span class="tag green">${t.toFixed(1)} seconds</span></div><button class="primary" id="againDeck" style="margin-top:20px">Run another deck</button>`;$('#againDeck').onclick=startDeckRun;return}
      const c=deck[i++];rc+=hiLo(c.r);main.innerHTML=`<div class="eyebrow">Card ${i} / 52</div>${cardHTML(c)}<p>Keep the running count mentally.</p><button class="primary" id="nextCard">Next card</button>`;$('#nextCard').onclick=show;};show();
  drillKeyHandler=e=>{if(e.code==='Space'&&$('#nextCard')){e.preventDefault();show()}};document.addEventListener('keydown',drillKeyHandler);setTimeout(()=>{const stop=$('#stopDrill');if(stop)stop.addEventListener('click',()=>{if(drillKeyHandler){document.removeEventListener('keydown',drillKeyHandler);drillKeyHandler=null}},{once:true})},0)
}

let shoeState=null,shoeTimer=null;
function renderShoe(){
  const v=$('#view-shoe');v.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Full-shoe simulator</h2><p>Configurable multi-deck practice with running and true-count auditing</p></div><span class="tag warn">Training mode</span></div>
  <div class="shoe-layout"><div class="table-surface"><div id="dealtCards" class="dealt-cards"></div></div><div class="shoe-panel">
    <div class="control-card"><h3>Shoe setup</h3><label class="label">Decks</label><select class="select" id="shoeDecks" style="width:100%"><option>1</option><option>2</option><option selected>6</option><option>8</option></select><label class="label" style="margin-top:12px">Penetration</label><select class="select" id="shoePen" style="width:100%"><option value="0.65">65%</option><option value="0.75" selected>75%</option><option value="0.8">80%</option><option value="0.85">85%</option><option value="0.9">90%</option></select><div class="pair" style="margin-top:12px"><button class="primary" id="newShoe">New shoe</button><button class="secondary" id="dealCard" disabled>Deal</button></div></div>
    <div class="control-card"><h3>Count check</h3><div class="pair"><div><label class="label">Your RC</label><input class="input" id="shoeRC" type="number" style="width:100%"/></div><div><label class="label">Your TC</label><input class="input" id="shoeTC" type="number" style="width:100%"/></div></div><button class="ghost" id="checkShoe" style="width:100%;margin-top:10px">Check count</button><div id="shoeFeedback" class="feedback"></div></div>
    <div class="control-card"><h3>Shoe telemetry</h3><div class="metric-row" style="grid-template-columns:1fr 1fr"><div class="metric"><b id="cardsSeen">0</b><span>Cards seen</span></div><div class="metric"><b id="decksRemain">—</b><span>Decks remain</span></div></div><div class="metric-row" style="grid-template-columns:1fr 1fr"><div class="metric"><b id="shoePct">0%</b><span>Penetration</span></div><div class="metric"><b id="auditCount">••</b><span>True RC</span></div></div></div>
    <div class="control-card"><h3>Auto deal</h3><label class="label">Delay</label><select class="select" id="dealSpeed" style="width:100%"><option value="1500">1.5 sec</option><option value="900" selected>0.9 sec</option><option value="500">0.5 sec</option><option value="250">0.25 sec</option></select><button class="secondary" id="autoDeal" style="width:100%;margin-top:10px" disabled>Start auto deal</button></div>
  </div></div>`;
  $('#newShoe').onclick=createShoe;$('#dealCard').onclick=dealOne;$('#checkShoe').onclick=checkShoeCount;$('#autoDeal').onclick=toggleAutoDeal;
}
function createShoe(){
  stopAutoDeal();const decks=+$('#shoeDecks').value,pen=+$('#shoePen').value,cards=shuffle(Array.from({length:decks},()=>SUITS.flatMap(s=>RANKS.map(r=>({r,s})))).flat());
  shoeState={decks,pen,cards,index:0,rc:0,limit:Math.floor(cards.length*pen)};$('#dealtCards').innerHTML='';$('#dealCard').disabled=false;$('#autoDeal').disabled=false;$('#autoDeal').textContent='Start auto deal';updateShoeTelemetry();toast(`${decks}-deck shoe ready`)
}
function dealOne(){
  if(!shoeState)return;if(shoeState.index>=shoeState.limit){stopAutoDeal();toast('Cut card reached');$('#dealCard').disabled=true;return}
  const c=shoeState.cards[shoeState.index++];shoeState.rc+=hiLo(c.r);const el=document.createElement('div');el.innerHTML=cardHTML(c,true);$('#dealtCards').appendChild(el.firstChild);
  if($('#dealtCards').children.length>30)$('#dealtCards').removeChild($('#dealtCards').firstChild);updateShoeTelemetry();
}
function updateShoeTelemetry(){if(!shoeState)return;const rem=(shoeState.cards.length-shoeState.index)/52,p=shoeState.index/shoeState.cards.length*100;$('#cardsSeen').textContent=shoeState.index;$('#decksRemain').textContent=rem.toFixed(2);$('#shoePct').textContent=p.toFixed(0)+'%';$('#auditCount').textContent='••';}
function checkShoeCount(){if(!shoeState)return;const rem=Math.max((shoeState.cards.length-shoeState.index)/52,.25),tc=Math.round(shoeState.rc/rem),ur=$('#shoeRC').value,ut=$('#shoeTC').value;const okR=ur!==''&&+ur===shoeState.rc,okT=ut!==''&&+ut===tc;$('#auditCount').textContent=(shoeState.rc>0?'+':'')+shoeState.rc;$('#shoeFeedback').textContent=`Actual RC ${shoeState.rc>0?'+':''}${shoeState.rc} • nearest-integer TC ${tc>0?'+':''}${tc} — ${okR&&okT?'both correct':'review your estimate'}`;$('#shoeFeedback').className='feedback '+(okR&&okT?'good':'bad');}
function toggleAutoDeal(){if(shoeTimer){stopAutoDeal();return}if(!shoeState)return;$('#autoDeal').textContent='Stop auto deal';const tick=()=>{dealOne();if(shoeState&&shoeState.index<shoeState.limit)shoeTimer=setTimeout(tick,+$('#dealSpeed').value);else stopAutoDeal()};tick()}
function stopAutoDeal(){if(shoeTimer)clearTimeout(shoeTimer);shoeTimer=null;const b=$('#autoDeal');if(b)b.textContent='Start auto deal'}

const examQuestions=[
  ['Hi-Lo tags 2 through 6 as…',['−1','0','+1','+2'],2],
  ['A running count of +8 with 4 decks remaining corresponds to…',['TC +1','TC +2','TC +4','TC +8'],1],
  ['Why is a true count used?',['To normalize the running count for cards remaining','To identify the next card','To count only aces','To replace basic strategy'],0],
  ['A balanced Hi-Lo count should end a full deck at…',['+4','−4','0','Depends on suit'],2],
  ['Which ranks are neutral in Hi-Lo?',['7, 8, 9','2, 3, 4','10, J, Q','Aces only'],0],
  ['What is the best first priority in speed training?',['Maximum deal speed','Error-free accuracy','Bet sizing','Memorizing previous outcomes'],1],
  ['Deck estimation is primarily needed for…',['True-count conversion','Suit counting','Shuffle prediction','Dealer tells'],0],
  ['Positive expectation means…',['The next hand must win','Every session must win','Long-run average can be positive without short-run guarantees','Variance disappears'],2],
  ['Count deviations should be applied to…',['Any strategy chart','A rule-matched baseline and verified index set','The last hand result','A progressive system'],1],
  ['A 5 and K together contribute…',['+2','−2','0','+1'],2],
  ['If you lose track of the count in training, the best response is…',['Guess','Continue from a convenient number','Stop and reconstruct or restart','Double the previous count'],2],
  ['Insurance is especially sensitive to…',['Ten-value card density','Suit distribution','Number of red cards','Previous dealer busts'],0]
];
function renderExam(){
  const v=$('#view-exam');v.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>CountLab certification assessment</h2><p>12-question knowledge benchmark. Pass target: 90%.</p></div><span class="tag green">Best ${state.examBest||0}%</span></div><div class="card"><div class="callout warn">This is an in-app training benchmark, not a gambling credential, license, or guarantee of real-world results.</div><form id="examForm">${examQuestions.map((q,qi)=>`<div class="exam-question"><h3>${qi+1}. ${q[0]}</h3>${q[1].map((o,oi)=>`<label class="quiz-option" style="display:block"><input type="radio" name="q${qi}" value="${oi}"/> ${o}</label>`).join('')}</div>`).join('')}<button class="primary" type="submit">Grade assessment</button></form><div id="examResult"></div></div>`;
  $('#examForm').onsubmit=e=>{e.preventDefault();let correct=0;examQuestions.forEach((q,i)=>{const x=new FormData(e.target).get('q'+i);if(x!==null&&+x===q[2])correct++});const pct=Math.round(correct/examQuestions.length*100);state.examBest=Math.max(state.examBest||0,pct);save();$('#examResult').innerHTML=`<div class="card" style="margin-top:18px"><div class="eyebrow">Result</div><h2 style="font-size:42px;margin:6px 0">${pct}%</h2><p>${correct}/${examQuestions.length} correct. ${pct>=90?'Passed the CountLab knowledge benchmark.':'Review missed concepts and retake after targeted practice.'}</p></div>`;window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})}
}

function renderReference(){
  $('#view-reference').innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Reference desk</h2><p>Fast recall for the core mechanics used throughout CountLab</p></div></div>
  <div class="grid three"><div class="card"><div class="eyebrow">Hi-Lo positive</div><h2>2 • 3 • 4 • 5 • 6</h2><p>Each exposed card contributes <strong>+1</strong>.</p></div><div class="card"><div class="eyebrow">Hi-Lo neutral</div><h2>7 • 8 • 9</h2><p>Each exposed card contributes <strong>0</strong>.</p></div><div class="card"><div class="eyebrow">Hi-Lo negative</div><h2>10 • J • Q • K • A</h2><p>Each exposed card contributes <strong>−1</strong>.</p></div></div>
  <div class="section-title"><div><h2>True-count math</h2><p>Normalize the running count by the estimated decks remaining</p></div></div><div class="card"><div class="callout"><strong>TC = RC ÷ decks remaining</strong></div><table class="rule-table"><thead><tr><th>Running count</th><th>Decks remaining</th><th>Exact TC</th></tr></thead><tbody><tr><td>+8</td><td>4</td><td>+2</td></tr><tr><td>+6</td><td>2</td><td>+3</td></tr><tr><td>−3</td><td>1.5</td><td>−2</td></tr><tr><td>+2</td><td>0.5</td><td>+4</td></tr></tbody></table></div>
  <div class="section-title"><div><h2>Common Hi-Lo index examples</h2><p>Illustrative thresholds often seen in common index sets; verify against the exact rules and index source you study</p></div></div>
  <div class="card"><table class="rule-table"><thead><tr><th>Decision</th><th>Common reference index</th><th>Training interpretation</th></tr></thead><tbody>
    <tr><td>Insurance</td><td>+3</td><td>Composition-sensitive ten-density benchmark.</td></tr>
    <tr><td>16 vs 10</td><td>0</td><td>Classic threshold example.</td></tr>
    <tr><td>15 vs 10</td><td>+4</td><td>Higher threshold than 16 vs 10.</td></tr>
    <tr><td>12 vs 3</td><td>+2</td><td>Illustrates low-positive departure threshold.</td></tr>
    <tr><td>12 vs 2</td><td>+3</td><td>Another common threshold example.</td></tr>
  </tbody></table><div class="callout warn">These are training references, not a universal strategy table. Index values can differ with rules, system, surrender availability, and true-count conversion convention.</div></div>
  <div class="section-title"><div><h2>Practice standards</h2><p>Objective targets beat vague practice</p></div></div><div class="grid three"><div class="card"><h3>Deck integrity</h3><p>Repeated full-deck counts that finish exactly at zero with no skipped or duplicated cards.</p></div><div class="card"><h3>Conversion accuracy</h3><p>Target at least 95% timed true-count conversion accuracy before increasing cognitive load.</p></div><div class="card"><h3>Error taxonomy</h3><p>Track tag, skip, double-count, sign, deck-estimation, division, and decision errors separately.</p></div></div>`
}

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),1800)}

$$('.nav-item').forEach(n=>n.onclick=()=>setView(n.dataset.view));
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
$('#quickDrillBtn').onclick=()=>{setView('drills');setTimeout(()=>startDrill('running'),20)};
$('#resetProgress').onclick=()=>{if(confirm('Reset all local CountLab progress and drill stats?')){localStorage.removeItem('countlabState');location.reload()}};
updateStreak();updateGlobalUI();renderDashboard();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
