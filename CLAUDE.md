# Portfolio of Saad Bin Waqas

One-page site with two benches, switched by the pull cord. Dark: a workbench at
night, everything a line drawing until the lamp (the cursor) finds it. Light: the
blue cutting mat with cardboard letters and the ceiling light on. They are two
looks, not inverted colours. One line (the robot's track) ties the page together,
and cats are everywhere. Keep to that world.

## Content first

All copy and settings are in `content/site.json`; photos in `public/media/`.
Most requests ("add this event", "here are new drone photos") only need that
file. `src/content.ts` has the types, defaults and blank entries.

- Facts only. Nothing in the copy is invented; if something is unknown, leave
  the field empty (empty fields are hidden) rather than guessing.
- First person, plain sentences, sentence case, no hype. Losses are stated as
  losses; that is part of the voice.
- `log.events[].importance`: 3 headline pass, 2 card, 1 one line.
- No faces in photos or clips: crop them out. Crop certificates to the heading.
- Clips: silent, under ten seconds, mp4 plus a WebP cover with the same name in
  `public/media/clips`; in content, an image with `video` set plays instead.
- `chimera.open: false` shows the sealed crate instead of the story.
- Extra sections: add to `custom` and put the same `id` in `layout`.
- New photos: resize to 1600 px max, WebP, strip EXIF (the Studio does this).
- `Recources/` (raw material) is git-ignored on purpose.

## Code

- `npm run dev`, `npm run studio`, `npm run build` (typecheck + build).
- Live at https://saadbinwaqas949.github.io/portfolio/ (GitHub Pages). Every push
  to `main` publishes in about two minutes; `base: './'` keeps paths relative.
- 100 px = 1 unit, mat at z = 0, so 3D lines up with the DOM. A "stage" is a
  Three.js group tied to a DOM element (`useStage`, `src/world/World.ts`).
  Stages are built lazily as they come near the viewport.
- `data-pin` marks a tall section with a sticky child; the mat stops scrolling
  while it is pinned. `data-track` / `data-track-s` hold the line follower's
  waypoints (wide / narrow screens).
- Letters: `<Letters text style depth />` puts extruded glyphs on real DOM text.
- Drawings: `bake()` in `src/world/kit.ts` adds each model's edges as glowing
  strokes that fade where the lamp falls. Use `strokes` / `outline` for the rest.
- Themes: `src/lib/theme.ts` (`onTheme`, `isLight`). Dark is the default CSS,
  `light.css` holds the blue values, `theme.css` the rest. Check both.
- Cats: `<Kitty pose coat />`, `<CatPilot />`, 3D `makeKitten` in
  `src/world/models/kitten.ts`. Styles in `cats.css`.
- Barlow 500/600 are unhinted copies in `src/fonts`: hinting hid the dot of the i.
- New machines are in `src/world/models/extra.ts`; styles for the dark theme's
  newer sections are in `src/styles/night.css`.
- One-shot entrances use `onceInView`, not ScrollTrigger (layout cost).
- Phones scroll natively. Never add a non-passive touch or wheel listener (Lenis
  gets no touch events; Draggable is registered only via `dragKit()`).
- Per-frame code reads layout through `watchRect` / `rectOf` (measured once at
  the top of the frame) and only writes after that. No 3D transforms on things
  that repeat (print shadows): each one becomes a GPU layer on a phone.
- Pinned section heights go through `pinH(vh)`; phones get a shorter hold.
- Never toggle `castShadow` at runtime: it recompiles every shader.
- Prints follow the photo's own shape (sizes come from `virtual:media-sizes`,
  `tools/media-plugin.ts`). `focus: "top" | "bottom"` picks what a crop keeps.
- Let GSAP own `transform`: centre animated elements with margins, not the CSS
  `translate` property, and never give everything a tiny `transition-duration`.
- Matte surfaces use Lambert, only metals and glossy plastics use Standard.
- The Studio's forms come from `studio/schema.ts`; add a field there when you
  add one to the content.
- Check 1440x900, 390x844, reduced motion and the Studio preview after changes.
