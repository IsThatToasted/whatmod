<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="WhatMod is a moderator toolkit built for Whatnot mods: quick messages, notes, hotkeys, giveaways, analytics, and stream workflow tools." />
  <meta property="og:title" content="WhatMod — Built for Mods. By Mods." />
  <meta property="og:description" content="Moderator tools for Whatnot mods. Protect, manage, moderate, and analyze live shopping streams." />
  <meta property="og:image" content="assets/cover.png" />
  <title>WhatMod | Moderator Tools for Whatnot Mods</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="noise"></div>
  <header class="site-header" id="top">
    <nav class="nav container">
      <a href="#top" class="brand" aria-label="WhatMod home">
        <span class="brand-mark">W</span>
        <span>What<span>Mod</span></span>
      </a>
      <button class="menu-toggle" aria-label="Open menu" aria-expanded="false">☰</button>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#workflow">Workflow</a>
        <a href="#editions">Editions</a>
        <a href="#faq">FAQ</a>
        <a class="nav-cta" href="#download">Get WhatMod</a>
      </div>
    </nav>
  </header>

  <main>
    <section class="hero container">
      <div class="hero-copy reveal">
        <p class="eyebrow">Built for mods. By mods.</p>
        <h1>Moderate faster, cleaner, and smarter with WhatMod.</h1>
        <p class="hero-text">WhatMod gives Whatnot moderators a polished command center for quick chat messages, giveaways, notes, hotkeys, browser controls, and stream-ready workflows.</p>
        <div class="hero-actions">
          <a class="button primary" href="#download">Download / License</a>
          <a class="button ghost" href="#features">Explore Features</a>
        </div>
        <div class="stats" aria-label="WhatMod highlights">
          <div><strong>1-click</strong><span>chat cards</span></div>
          <div><strong>Auto</strong><span>saved configs</span></div>
          <div><strong>Pro</strong><span>mod workflow</span></div>
        </div>
      </div>
      <div class="hero-card reveal delay-1">
        <img src="assets/cover.png" alt="WhatMod cover graphic" />
      </div>
    </section>

    <section class="strip">
      <div class="container strip-grid">
        <span>Protect</span><span>Manage</span><span>Moderate</span><span>Analyze</span>
      </div>
    </section>

    <section class="section container" id="features">
      <div class="section-heading reveal">
        <p class="eyebrow">Everything a serious mod needs</p>
        <h2>One toolkit for the moments that matter live.</h2>
        <p>From routine welcomes to giveaway chaos, WhatMod keeps your best responses and tools ready before chat gets away from you.</p>
      </div>
      <div class="feature-grid">
        <article class="feature-card reveal"><div class="icon">💬</div><h3>Quick Message Banks</h3><p>Pre-made mod messages organized into tabs for announcements, sizing, giveaways, rules, shoes, and more.</p></article>
        <article class="feature-card reveal"><div class="icon">⚡</div><h3>One-Click Send</h3><p>Short card view and edit view make it simple to copy or send the exact message you need instantly.</p></article>
        <article class="feature-card reveal"><div class="icon">📝</div><h3>Live Notes</h3><p>Track general notes, giveaway notes, and unique stream occurrences without leaving your workflow.</p></article>
        <article class="feature-card reveal"><div class="icon">⌨️</div><h3>Custom Hotkeys</h3><p>Assign rapid-fire actions for repetitive mod moments and keep both hands in the action.</p></article>
        <article class="feature-card reveal"><div class="icon">🧩</div><h3>Persistent Configs</h3><p>Autosave your setup, message banks, tabs, and preferences with JSON-based local configuration.</p></article>
        <article class="feature-card reveal"><div class="icon">🛡️</div><h3>License Ready</h3><p>Built with activation and update flows so WhatMod can grow from private tool into real software.</p></article>
      </div>
    </section>

    <section class="section showcase" id="workflow">
      <div class="container two-col">
        <div class="mock-app reveal">
          <div class="mock-top"><span></span><span></span><span></span></div>
          <div class="mock-tabs"><button>Mod Messages</button><button>Giveaways</button><button>Sneakers</button></div>
          <div class="mock-card"><strong>Welcome Message</strong><p>Welcome in! Tap follow, bookmark the show, and ask any questions in chat.</p><span>Send Now</span></div>
          <div class="mock-card"><strong>Giveaway Reminder</strong><p>Make sure you are following and eligible before entering the giveaway.</p><span>Copy</span></div>
          <div class="mock-note"><b>Stream Notes</b><p>Buyer asked about size 10.5 restock. Mention during next shoe run.</p></div>
        </div>
        <div class="section-heading left reveal delay-1">
          <p class="eyebrow">Designed around live pressure</p>
          <h2>Less tab hunting. More stream control.</h2>
          <p>WhatMod turns scattered scripts, notes, and browser actions into a single operator panel. Mods can stay focused on chat, seller support, and keeping the room clean.</p>
          <ul class="check-list">
            <li>Launch or reconnect browser controls</li>
            <li>Switch between compact cards and full edit mode</li>
            <li>Keep stream notes separated by context</li>
            <li>Build specialized tabs for different seller categories</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section container" id="editions">
      <div class="section-heading reveal">
        <p class="eyebrow">Ready for different streams</p>
        <h2>Core, Pro, and Sneaker-ready workflows.</h2>
      </div>
      <div class="pricing-grid">
        <article class="price-card reveal"><h3>WhatMod Core</h3><p>For basic mod message organization.</p><ul><li>Message cards</li><li>Category tabs</li><li>Copy workflow</li></ul></article>
        <article class="price-card featured reveal"><span class="badge">Most Complete</span><h3>WhatMod Pro</h3><p>For active mods who need speed and customization.</p><ul><li>Hotkeys</li><li>Notes system</li><li>Persistent configs</li><li>Browser tools</li></ul></article>
        <article class="price-card reveal"><h3>Sneaker Edition</h3><p>Purpose-built cards for shoe sellers and sizing-heavy streams.</p><ul><li>Size cards</li><li>Shoe message bank</li><li>Giveaway prompts</li></ul></article>
      </div>
    </section>

    <section class="section dark-panel container" id="download">
      <div class="cta reveal">
        <p class="eyebrow">Launch your mod command center</p>
        <h2>Bring WhatMod to your next show.</h2>
        <p>Replace this section with your GitHub release, Gumroad, Stripe checkout, Discord invite, or license activation link.</p>
        <div class="hero-actions center">
          <a class="button primary" href="https://github.com/" target="_blank" rel="noreferrer">View on GitHub</a>
          <a class="button ghost" href="mailto:you@example.com">Contact for Access</a>
        </div>
      </div>
    </section>

    <section class="section container faq" id="faq">
      <div class="section-heading reveal"><p class="eyebrow">Questions</p><h2>FAQ</h2></div>
      <details class="reveal"><summary>Is WhatMod official Whatnot software?</summary><p>No. WhatMod is an independent moderator utility. Update this copy if your relationship or permissions change.</p></details>
      <details class="reveal"><summary>Can I customize the messages?</summary><p>Yes. The site showcases editable message banks, custom tabs, and persistent local configs.</p></details>
      <details class="reveal"><summary>Can I host this site on GitHub Pages?</summary><p>Yes. Upload these files to a repository, enable GitHub Pages, and set the branch to deploy from the root folder.</p></details>
    </section>
  </main>

  <footer class="footer">
    <div class="container footer-inner">
      <p>© <span id="year"></span> WhatMod. Built for mods. By mods.</p>
      <a href="#top">Back to top ↑</a>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>
