---
"@aikitstudio/agul-react": minor
---

Effect plugins: `AGULRenderer effects={[...]}` loads optional animation libraries on demand. New subpath `@aikitstudio/agul-react/effects/motion` plays enter animations with Motion (optional peer `motion` ^14). `useEnter(region)` returns props (a CSS animation style, or a ref when a plugin driver is loaded) to spread on each item.
