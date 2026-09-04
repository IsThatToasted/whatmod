# CountLab — GitHub Pages Card Counting Course

A static, dependency-free blackjack card-counting education and practice app designed to live at `whatmod.com/count`.

## Features
- 12-module Hi-Lo course with lessons, quizzes, progress, and completion state
- Running-count speed drill
- True-count conversion drill
- Card-cancellation drill
- Multi-deck shoe simulator with configurable decks, penetration, and dealing speed
- Reference tables and professional skill benchmarks
- Final certification exam
- LocalStorage progress, streak, accuracy, and best-speed tracking
- PWA manifest + offline cache
- Responsive desktop/mobile UI

## Deploy at `whatmod.com/count`
Copy the contents of this folder into the `/count` directory of your GitHub Pages repository and push.

Example repository layout:

```
/
  index.html
  /count
    index.html
    styles.css
    app.js
    manifest.json
    sw.js
    icon.svg
```

The project uses only relative paths, so it works correctly from `/count/`.

## Important educational note
Blackjack rules and index numbers vary by game rules and counting system. CountLab is designed as a training simulator and math course, not a guarantee of profit. Casinos may also restrict or refuse play at their discretion.
