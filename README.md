# WhatMod Landing Page

A static, GitHub Pages-friendly landing page for `whatmod.com`.

## Files
- `index.html` — page structure
- `styles.css` — all visual styling and animation
- `projects.js` — **the only file you normally edit when adding/removing projects**
- `app.js` — renders project cards, filters, animations, and Surprise Me

## Add a project
Open `projects.js`, copy an existing object, then change:

```js
{
  title: "New Thing",
  path: "/new-thing/",
  category: "Tools",
  icon: "✦",
  accent: "#ff8db7",
  accent2: "#8ed7ff",
  description: "A short description.",
  tags: ["Tool", "Web"],
  status: "New",
  featured: false
}
```

The page automatically updates:
- project card
- project count
- category filters
- random project / Surprise Me behavior

## Deploying at whatmod.com root
These files are intended for the repository/root directory that GitHub Pages serves as `whatmod.com/`.

Your existing `/trivia/`, `/track/`, `/ride/`, `/portfolio/`, and other directories should remain untouched. Replacing only the root `index.html` and adding these landing assets will not remove those directories.

Note: your current root page is serving the ScooterCast/Ride app. Since the Ride app is also available at `/ride/`, keep the `/ride/` directory intact when replacing the root page.
