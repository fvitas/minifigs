# Minifigs

A minifigure configurator. Pick hair, head, torso and legs from real brick photos, snap them together, download the result.

Not affiliated with the LEGO Group.

## Develop

```bash
pnpm install
pnpm parts     # regenerate public/parts from assets/raw
pnpm dev
```

## Add a part

Drop a transparent, front-facing PNG into `assets/raw/<hair|head|body|pants>/`, optionally give it a name in `assets/parts.meta.json`, run `pnpm parts`.

Shop photos that show front and back side by side get `"crop": "left"` in the meta so only the front half is used.

A photo where the piece is worn by a plain red display figure gets `"keyOut": "red"` in the meta: the pipeline keys the figure out, measures its head and scales and positions the piece against ours. Photos with a black display head cannot be keyed, and pieces hanging far below the chin get cut by the hair canvas — only the Mohawk survived that batch.

A photo where the piece is worn by a plain white display figure gets `"keyOut": "white"` instead. Backdrop, figure and shadow are all light and shade into one another, so they are flood-filled away from the frame border; the flood stops at the piece's edge, and the piece is the largest blob it could not reach. The stub of neck left under the piece is trimmed away, and the piece is placed against that figure's head, whose position in the frame is fixed (`WHITE_HEAD_WIDTH`, `WHITE_CENTER_X`, `WHITE_CHIN_ROW`) because whatever is being worn hides whichever landmark you would measure. Where the shop's zoom differs, `scale`/`offsetX`/`offsetY` in the meta correct the piece, and an opening no threshold can find — the face inside the Batman cowl's mouth is in shadow, as dark as the plastic around it — is cut out by hand with `cut`, a list of rounded `[x, y, width, height]` rectangles in fractions of the photo. Pieces that are themselves light and grey come out chewed — discard those in the review picker.

### Pick parts from the shop catalogue

With `pnpm dev` running, open `http://localhost:5173/scripts/parts/picker/index.html` and swipe: `→` keep, `←` skip, `C` toggles the front-half crop (on by default), `I` shows another product photo, `Backspace` undoes, `1`–`3` switch slots. Every decision is saved to `docs/picks.json`. Then:

```sh
pnpm tsx scripts/parts/import-picks.ts docs/picks.json
pnpm parts
```

### Import the extraextrabricks catalogue

```sh
pnpm tsx scripts/parts/scrape-eeb.ts    # category listings -> docs/eeb-candidates.json
pnpm tsx scripts/parts/import-eeb.ts    # downloads and registers them; add slots to narrow it
pnpm parts
```

Both keep to the 1 request a second the shop's robots.txt asks for, and skip photos already on disk, so they are safe to re-run. Hats and hair are registered with `"keyOut": "white"`; the parts land unreviewed, for the review picker below.

### Review the built parts assembled

With `pnpm dev` running, open `http://localhost:5173/scripts/parts/review/index.html`. It stacks the real figure with the app's own geometry and steps through one slot at a time, showing only parts that have never been judged, so a torso or a pair of legs is judged in place: `→` good, `←` not good, `↑`/`↓` browse without judging, `Backspace` undo, `1`–`4` switch slots, `S` shuffles the other three slots, `E` takes the figure apart. Verdicts land in `docs/part-review.json`. Then:

```sh
pnpm tsx scripts/parts/apply-review.ts
pnpm parts
```

"Not good" sets `"exclude": true` in the meta and "good" clears it, so the raw photo stays and every verdict is reversible.

### Fit the hair, hats and masks

Hair is the one slot that is judged by how it sits rather than by good or bad. With `pnpm dev` running, open `http://localhost:5173/scripts/parts/fit/index.html`: head, torso and legs stay on one plain reference figure, and each piece takes a line of free text saying what is wrong with it — `⏎` saves and moves on, `⇧⏎` saves and stays, `↑`/`↓` move without losing the note. Notes land in `docs/hair-notes.json`; they are what the `scale`, `offsetX` and `offsetY` of that piece in `assets/parts.meta.json` get tuned from. `offsetX` is a fraction of the canvas width, `offsetY` of the hair canvas height, and `scale` is relative to the size the display head sets — so a piece keeps its fit when the head size changes.

### Erase what is left over

Some artifacts survive every threshold — a grey hairline where the display figure blurred into the wig, a speck of the stand. Those are wiped by hand: with `pnpm dev` running, open `http://localhost:5173/scripts/parts/erase/index.html`, pick a piece and drag over it. The brush slider (or `[` and `]`) sets its size, `⌘Z` undoes a stroke, `Clear piece` starts over, the background button swaps the reference figure for magenta or a checker, and holding space pans a zoomed-in view. Strokes are saved to `assets/parts.erase.json` as a brush radius and the points it walked through, in the pixels of that part's canvas — they are source, so `pnpm parts` replays them onto the freshly built PNG and the retouch survives a rebuild. Run `pnpm parts` after a session to bake them in. Changing a piece's `scale` or `offset` afterwards moves the piece out from under its strokes, so fit first, erase second.

## Deploy

The app is on Vercel; the images are not. `public/parts` is 83 MB, and serving it from the deploy
would spend Vercel's free 100 GB of transfer at roughly 3 MB a visit, so the WebP live in
[fvitas/minifig-assets](https://github.com/fvitas/minifig-assets) and are served over GitHub Pages,
which does not meter bandwidth. The build drops `dist/parts` and points every image at
`PARTS_CDN` (`src/parts/cdn.ts`); `pnpm dev` still reads `public/`, so a fresh `pnpm parts` shows up
without publishing.

```sh
pnpm parts     # rebuild the images
pnpm assets    # push the WebP and the manifest to the Pages repo
pnpm deploy    # build and ship the app
```

Publish before deploying whenever parts changed — the app fetches its manifest from Pages, so a new
part that has not been pushed does not exist as far as the deploy is concerned. Pages takes about a
minute to go live and caches for ten. The PNG masters never leave this machine: only the erase tool
reads them.
