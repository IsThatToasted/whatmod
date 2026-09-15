(() => {
  const projects = Array.isArray(window.WHATMOD_PROJECTS) ? window.WHATMOD_PROJECTS : [];
  const grid = document.getElementById('projectGrid');
  const filters = document.getElementById('filterRow');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('projectCount');
  const year = document.getElementById('year');
  let activeFilter = 'All';

  if (count) count.textContent = projects.length;
  if (year) year.textContent = new Date().getFullYear();

  const safe = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const projectHref = (path) => {
    if (!path) return '#';
    if (/^https?:\/\//i.test(path)) return path;
    return path.startsWith('/') ? path : `/${path}`;
  };

  function cardMarkup(project, index) {
    const tags = (project.tags || []).map(tag => `<span>${safe(tag)}</span>`).join('');
    const statusClass = String(project.status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `
      <article class="project-card reveal" style="--accent:${safe(project.accent || '#9c8cff')};--accent2:${safe(project.accent2 || project.accent || '#6ecbff')};--delay:${index * 55}ms">
        <a class="card-hit" href="${safe(projectHref(project.path))}" aria-label="Open ${safe(project.title)}"></a>
        <div class="card-topline">
          <span class="project-status ${safe(statusClass)}"><i></i>${safe(project.status || 'Live')}</span>
          <span class="project-path">whatmod.com${safe(project.path || '/')}</span>
        </div>
        <div class="card-visual" aria-hidden="true">
          <span class="visual-blob one"></span>
          <span class="visual-blob two"></span>
          <div class="project-icon">${safe(project.icon || '✦')}</div>
          <span class="mini-star">✦</span>
        </div>
        <div class="card-copy">
          <span class="project-category">${safe(project.category || 'Project')}</span>
          <h3>${safe(project.title || 'Untitled')}</h3>
          <p>${safe(project.description || '')}</p>
        </div>
        <div class="card-footer">
          <div class="tag-row">${tags}</div>
          <span class="open-arrow" aria-hidden="true">↗</span>
        </div>
      </article>`;
  }

  function renderProjects() {
    const filtered = activeFilter === 'All'
      ? projects
      : projects.filter(project => project.category === activeFilter);

    grid.innerHTML = filtered.map(cardMarkup).join('');
    empty.hidden = filtered.length !== 0;
    requestAnimationFrame(observeReveals);
  }

  function renderFilters() {
    const categories = ['All', ...new Set(projects.map(project => project.category).filter(Boolean))];
    filters.innerHTML = categories.map(category => `
      <button type="button" class="filter-pill${category === activeFilter ? ' active' : ''}" data-filter="${safe(category)}">
        ${safe(category)}
      </button>`).join('');

    filters.querySelectorAll('.filter-pill').forEach(button => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.filter;
        renderFilters();
        renderProjects();
      });
    });
  }

  function openRandomProject() {
    if (!projects.length) return;
    const pool = projects.filter(project => project.path);
    if (!pool.length) return;
    const project = pool[Math.floor(Math.random() * pool.length)];
    window.location.href = projectHref(project.path);
  }

  document.getElementById('surpriseButton')?.addEventListener('click', openRandomProject);
  document.getElementById('heroSurpriseButton')?.addEventListener('click', openRandomProject);

  let revealObserver;
  function observeReveals() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -30px' });
    }
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
  }

  // A tiny bit of pointer parallax on the hero playground.
  const playground = document.querySelector('.hero-playground');
  if (playground && window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    playground.addEventListener('pointermove', (event) => {
      const rect = playground.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      playground.style.setProperty('--mx', `${x * 14}px`);
      playground.style.setProperty('--my', `${y * 14}px`);
    });
    playground.addEventListener('pointerleave', () => {
      playground.style.setProperty('--mx', '0px');
      playground.style.setProperty('--my', '0px');
    });
  }

  renderFilters();
  renderProjects();
  observeReveals();
})();
