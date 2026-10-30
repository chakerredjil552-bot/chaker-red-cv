# Deal hero

The homepage hero: a ring of 16 vertical video cards in plain CSS 3D, where the loader and the hero are the same scene.
React and Motion (framer-motion); no WebGL.

- `src/pose.ts` places every card. `reelPose(angle, formation, scene)` is pure and carries the whole animation;
  `src/pose.test.ts` tests it.
- `src/Loader.tsx`: the rolling counter (real asset progress), the scrambled caption, the brand word that flies into
  the header wordmark.
- `src/Wall.tsx`: the ring. Recycles 16 DOM cards over any number of reels at the back of the cylinder, plays only the
  cards facing the camera, writes styles only when they change, hit-tests hover every third frame.
- `src/DealHero.tsx`: the two motion values, `formation` and `expansion`, and everything read off them.

```
npm install
npm test        # pose unit tests
npm run build   # dist/deal-hero.js and dist/deal-hero.css, inlined into docs/index.html
```

The reels (covers, previews and the full ads) live in `docs/reels/`.
