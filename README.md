# Saad Bin Waqas, portfolio

One page, laid out as a workbench. Pull the cord to switch between two benches:
at night everything is a line drawing that turns real where the lamp falls; by
day it is a blue cutting mat with cardboard letters. One line runs down the whole
page with a robot on it and a kitten on the robot. Along the way: a cat pilot
whose goggles play real flight footage, a 5-inch quad that takes off, explodes
and lands again, a video receiver full of short clips, a wind tunnel with a race
car in it, a sumo ring you can fight in, seven robots doing their jobs, a vehicle
that is a car, a boat, a plane and a quadcopter, a handheld that plays
cartridges, and a lot of cats. All of it is built in code.

![Preview](public/og.jpg)

## Edit it

Double-click **`Edit Portfolio.bat`**. The Studio opens in the browser with a
form on the left and the live page on the right.

- **Click the page to edit.** Click any text or photo and its field opens.
- **Add something** creates an event, drone, robot, game, project, course,
  link or a whole new section.
- **Photos**: drag them from the desktop onto a field, paste them, or pick from
  the library. They are resized and their location data is removed.
- **Clips**: press *Add a clip* on any photo and choose a short video. It plays
  silently in place of the photo, and a cover picture is made for it.
- **Page order** moves, hides and renames sections.
- **Save** (Ctrl+S) writes to this computer. **Undo** and **Older versions** go back.
- **Publish** commits and pushes to GitHub.

Everything lives in one file, [`content/site.json`](content/site.json), with
pictures in [`public/media`](public/media). Editing that file by hand works too.

### Event size

Each event has a size. *Headline* events hang on a lanyard with photos and a
medal, *cards* sit in a grid, and *one line* events go in the list underneath.

### Chimera

**Open the crate** in the Studio switches between a sealed box and the full
story: the four modes, the numbers, the chapters and the pictures.

### Raw material

`Recources/` holds the original photos, videos, certificates and CVs, sorted into
folders. It is never uploaded. Only cropped, resized copies in `public/media` are.

## Run it

Needs Node 20 or newer.

```
npm install
npm run dev       # the site,   http://localhost:5180
npm run studio    # the editor, http://localhost:5180/studio/
npm run build     # production files in dist/
```

## Put it online

The included GitHub Action builds on every push to `main`. To publish with
GitHub Pages, open the repository's **Settings > Pages** and set **Source** to
**GitHub Actions**. After that, the Studio's Publish button updates the live
site. Put the live address in the Studio under *Search and sharing* so link
previews work.

## How it is built

| Folder | What is in it |
| --- | --- |
| `content/` | All the words and settings |
| `public/media/` | Photos and screenshots |
| `src/sections/` | One file per section of the page |
| `src/world/` | The 3D bench: mat, lamp, letters, track |
| `src/world/models/` | Drone, robots, plane, medal, chips, all built from code |
| `src/world/stages/` | What each model does in its section |
| `src/components/` | Portrait, cat, header, loader, cursor, photo prints |
| `studio/`, `tools/` | The editor and its local server (never part of the live site) |

React, three.js, GSAP and Lenis, built with Vite. Typefaces: Dela Gothic One,
Barlow, Shantell Sans and Jersey 10.

It respects reduced-motion settings, works with a keyboard, falls back to a
flat version without WebGL, and lowers its own quality on slower machines.
