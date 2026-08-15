# SafeSurf — Internet Safety Quiz

A static, kid-friendly Internet Safety Quiz designed for GitHub Pages.

## What it includes

- 20 one-at-a-time scenario cards
- Animated progress and card transitions
- Age-aware question selection (ages 6–17)
- Optional sex selection with only subtle, non-stereotyped branching
- Non-obvious answer choices designed to measure real judgment
- Private, client-side scoring only
- 1–100 safety score with animated speedometer gauge
- Category strengths and practice areas
- Responsive/mobile-friendly UI
- Reduced-motion accessibility support
- No database, analytics, cookies, or answer persistence

## Run locally

Open `index.html` directly, or serve the folder with any static server.

Example:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## GitHub Pages

This repo includes `.github/workflows/pages.yml` for automatic Pages deployment from the `main` branch.

1. Push these files to a GitHub repository.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`.

## Privacy note

This version intentionally does not save quiz responses. Results vanish on refresh/restart. That is safer for a child-focused prototype and avoids collecting age/sex/behavioral data without a clear parent/guardian data policy.

## Scoring

Each scenario answer has an internal 1–5 judgment score. The final raw score is normalized to 1–100. Scoring is not shown during the quiz, and the answer order is randomized for each question.

The final readiness language is intentionally framed around **independent use vs. adult guidance**, rather than claiming a quiz can determine whether a child should have internet access at all.
