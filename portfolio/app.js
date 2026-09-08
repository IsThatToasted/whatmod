// EDIT YOUR PROJECTS HERE.
// Add screenshots by placing files in /portfolio/assets/ and setting image: "assets/your-file.png".
const projects = [
  {
    name: "WhatMod",
    role: "Reseller & livestream productivity platform",
    description: "A collection of tools built around real reseller workflows, including live sales tracking, chat capture, buyer activity, inventory organization, revenue visibility, exports, and performance improvements for large datasets.",
    bullets: [
      "Built browser and local productivity tools for Whatnot sellers.",
      "Designed dashboards and workflows for sales, chat, inventory, and buyer activity.",
      "Iterated on performance as data volumes increased significantly."
    ],
    tags: ["JavaScript", "Browser Tools", "Data Processing", "GitHub"],
    mark: "WM",
    image: ""
  },
  {
    name: "WeTrack",
    role: "Collaborative travel and itinerary application",
    description: "A shared trip-planning product spanning web and iOS with interactive schedules, collaborative events, packing, budgets, maps, memories, activity planning, and account-based trip access.",
    bullets: [
      "Built a responsive trip planner for desktop and mobile use.",
      "Integrated shared data, authentication, maps, planning tools, and iOS workflows.",
      "Continuously refined the interface through real usage and testing."
    ],
    tags: ["JavaScript", "Supabase", "iOS", "GitHub Pages"],
    mark: "WT",
    image: ""
  },
  {
    name: "Orbit / DROP",
    role: "Windows file and workspace management application",
    description: "A visual workspace and file-management concept focused on making local project organization faster through drag-and-drop workflows, shortcuts, smart naming, quick access, and durable update handling.",
    bullets: [
      "Built project-oriented file organization and shortcut workflows.",
      "Designed update flows intended to preserve local databases and workspace data.",
      "Added smart naming and productivity-focused interaction patterns."
    ],
    tags: ["Windows", "Desktop App", "Local Data", "Productivity"],
    mark: "OR",
    image: ""
  },
  {
    name: "Afterglow",
    role: "Social discovery and matching application",
    description: "A database-backed social product with profiles, discovery, matching, messaging, configurable profile questions, location-aware behavior, and administrative systems for evolving the experience over time.",
    bullets: [
      "Built and iterated profile, discovery, matching, and messaging systems.",
      "Worked through authentication, database-policy, storage, and sync issues.",
      "Created flexible profile and questionnaire tooling for future expansion."
    ],
    tags: ["Supabase", "Auth", "Database", "Responsive UI"],
    mark: "AG",
    image: ""
  },
  {
    name: "ScooterCast",
    role: "Native iOS ride and live-streaming application",
    description: "A native iOS project combining rider-focused screens, device location, streaming configuration, live video functionality, and modern Swift package integrations.",
    bullets: [
      "Developed with Swift and Xcode for modern iOS devices.",
      "Integrated LiveKit Swift SDK and SwiftProtobuf dependencies.",
      "Worked on ride information, device location, live preview, and streaming controls."
    ],
    tags: ["Swift", "SwiftUI", "LiveKit", "iOS 17"],
    mark: "SC",
    image: ""
  }
];

const stack = document.getElementById("projectStack");
projects.forEach((project, index) => {
  const article = document.createElement("article");
  article.className = "project reveal";
  const visual = project.image
    ? `<img src="${project.image}" alt="${project.name} project screenshot">`
    : `<div class="visual-mark">${project.mark}</div>`;
  article.innerHTML = `
    <div class="project-copy">
      <div>
        <div class="project-number">0${index + 1}</div>
        <h3>${project.name}</h3>
        <div class="project-role">${project.role}</div>
        <p class="project-desc">${project.description}</p>
        <ul class="project-bullets">${project.bullets.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div class="project-tags">${project.tags.map(tag => `<span>${tag}</span>`).join("")}</div>
    </div>
    <div class="project-visual">${visual}</div>
  `;
  stack.appendChild(article);
});

document.getElementById("year").textContent = new Date().getFullYear();

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
