---
"@aikitstudio/agul-react": patch
---

Fix a crash in the chat view on newer Chromium: `scrollIntoView` now returns a Promise, which React then called as an effect cleanup and unmounted the whole app.
