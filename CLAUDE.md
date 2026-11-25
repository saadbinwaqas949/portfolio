# Portfolio of Saad Bin Waqas

One-page site. The concept: the page is a cutting mat, the cursor is the lamp,
objects on the mat are live 3D. Keep to that world when adding things.

## Content first

All copy and settings are in `content/site.json`; photos in `public/media/`.
Most requests ("add this event", "here are new drone photos") only need that
file. `src/content.ts` has the types, defaults and blank entries.

- Facts only. Nothing in the copy is invented; if something is unknown, leave
  the field empty (empty fields are hidden) rather than guessing.
- First person, plain sentences, sentence case, no hype. Losses are stated as
  losses; that is part of the voice.
- `log.events[].importance`: 3 headline pass, 2 card, 1 one line.
- `chimera.open: false` shows the sealed crate; set it to true once there is a
  story and photos.
- Extra sections: add to `custom` and put the same `id` in `layout`.
- New photos: resize to 1600 px max, WebP, strip EXIF (the Studio does this).
- Do not publish the phone number, the `.docx` CVs or `Portfolio.txt`; they are
  git-ignored on purpose.

## Code

- `npm run dev`, `npm run studio`, `npm run build` (typecheck + build).
- 100 px = 1 unit, mat at z = 0, so 3D lines up with the DOM. A "stage" is a
  Three.js group tied to a DOM element (`useStage`, `src/world/World.ts`).
  Stages are built lazily as they come near the viewport.
- `data-pin` marks a tall section with a sticky child; the mat stops scrolling
  while it is pinned. `data-track` / `data-track-s` hold the line follower's
  waypoints (wide / narrow screens).
- Letters: `<Letters text style depth />` puts extruded glyphs on real DOM text.
- One-shot entrances use `onceInView`, not ScrollTrigger (layout cost).
- Never toggle `castShadow` at runtime: it recompiles every shader.
- Prints follow the photo's own shape (sizes come from `virtual:media-sizes`,
  `tools/media-plugin.ts`). `focus: "top" | "bottom"` picks what a crop keeps.
- Let GSAP own `transform`: centre animated elements with margins, not the CSS
  `translate` property, and never give everything a tiny `transition-duration`.
- Matte surfaces use Lambert, only metals and glossy plastics use Standard.
- The Studio's forms come from `studio/schema.ts`; add a field there when you
  add one to the content.
- Check 1440x900, 390x844, reduced motion and the Studio preview after changes.
