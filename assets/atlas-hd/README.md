# Atlas HD

Open [the offline review gallery](index.html). Use **All four stages** to compare
original artwork, replacement art at native resolution, HD only, and HD with
additional cohesion. No server is required. The three replacement-art stages are
checked in; original-art comparisons are built locally from your installed game.

This is one selected library on `new-graphics`, based on
`bd89036`. Earlier iterations remain on `codex/atlas-hd-graphics` at `2fe6f3f`.
The graphics branch contains no game source or loader changes.

## Contents

| Collection | Selected assets | Purpose |
| --- | ---: | --- |
| Painted sprites | 575 | Units, cities, buildings, wonders, resources, citizens, advisors, leaders, diplomacy, palace, effects, spaceship and setup art |
| Backgrounds | 22 | City sites, throne room, council, diplomacy, space, events and interface scenes |
| Interface assets | 503 | Authored SVGs and PNGs: controls, cursors, badges, masks, symbols and palette-dependent variations |
| Map assets | 1,117 | Ground, coast states, road/rail/river masks, shadows, materials and 16 new texture variations |
| Renderer bindings | 404 | Derived PNG adapters for the exact native boxes exercised by the review fixtures |

The 2,217 primary entries are indexed in [manifest.json](manifest.json).
Supporting mip PNGs and overview icons live under `map/variations/mips/` and
`map/lod/`. The compatibility bank is indexed separately in
[compatibility/bindings.json](compatibility/bindings.json); it is derived from
the same selected art, not a competing art direction.

[coverage.json](coverage.json) maps the 347 inventoried embedded image resources
and 13 external image-sheet/font roles to replacement artwork. It preserves the
inventory's exclusions and runtime obligations. This demonstrates asset-role
coverage, not that the unchanged game can already run without original images.
Scenario-specific images, video, audio and third-party expansion content are not
silently included in that claim.

## Four rendering stages

1. **Original game artwork:** original image sheets and embedded resources, replayed
   at native resolution with the same fixtures and cameras. Original city/flag and
   unit/shield registration points come from their sheet markers. This is a local
   source-renderer replay, not a screenshot captured from the original executable.
2. **Replacement native resolution:** source-selected commands, new art reduced to native
   sprite boxes, source zoom scaling and nearest-neighbor enlargement.
3. **HD only:** the identical command trace, with larger RGBA images and a 2×
   display-density backing surface. Layout, road arms, coast quarters, source
   ordering, visibility and zoom gates stay the same. This is the expected first
   engine upgrade, simulated by the review backend.
4. **HD + cohesion:** a separate art-side prototype adds shared network geometry,
   world-space materials and river/coast sampling, quieter overview detail,
   object anchors and site-aware scene placement.

There are 22 scene comparisons: three real-save map views plus district, close and tactical map views, transport
matrix, coast, terrain repetition, region, full world, three city panoramas, three
throne stages, diplomacy, two spacecraft states and two city management windows.
Detailed map views retain the native unit/city frame size and anchor. The proposal
enlarges status badges separately; only overview views substitute object markers. The city management window is separate from
the panorama. See the [window audit](RENDERER-AUDIT.md#window-renderer-extension)
for native bodies versus explicit panel and typography adapters.
The close camera spans ten full tile widths by ten full tile heights (200 cells
on the staggered lattice). The whole-world fixture has 8,192 valid cells in a
128×128 coordinate domain. Twelve 3840×2160 review exports are available for
the close map, coast, coastal city and complete throne room, at the three replacement
stages. Building the original comparisons adds four corresponding 4K exports.
These exports preserve aspect ratio and can resample the native art; they do not
claim additional native 4K detail.

## City economy and real-save maps

The city window uses six distinct [economy symbols](review/economy-symbols.png):
the retained full wheat sheaf, blue production shield, opposed trade arrows, painted antique gold coin, luxury gem
and science beaker. Coins also identify the improvement-list sale/upkeep action.
The old mixed grain/shield terrain special and gold ore no longer serve as city
economy icons. Native 14-pixel rows and 10-pixel worked-tile icons share these
silhouettes. See [semantic bindings](interface/economy/bindings.json).

The first three map scenes use `he_a1788.sav`: a 150×120 staggered world with
9,000 tiles, all 11 terrain kinds, 69 cities, 223 live units (290 allocated unit
records), 597 road tiles, 282 rail tiles and 320 special-resource tiles. Close,
regional and complete-world cameras share the same imported state in every
stage. Fog is deliberately disabled for this all-map art review. The importer
preserves terrain, improvements, city sizes/styles/walls, unit types/stacks and
damage; source functions select resources and display units. No saved game or
original image file is needed to rebuild: the bounded imported state and input
hashes are retained in [saved-world.json](review/fixtures/saved-world.json).

`import-save.py SAVE RULES.TXT` is an optional read-only refresh step. It accepts
the observed version-44 normal-save layout, checks bounds and stack links, and
records the input hashes. It does not support arbitrary scenario/network/save
versions. The original save and rules file are not included in this art pack.

## Rebuild

The standalone renderer requires Windows, MSVC x86 C++ build tools, a Windows
SDK, Python 3.10+ and Node.js with `sharp`. Its build script discovers Visual Studio
with `vswhere`. Install `sharp` in a normal Node module location, or point
`ATLAS_NODE_MODULES` at a directory containing it. The tool package pins the tested
`sharp` version; use `npm install --prefix tools/atlas-review` if needed. The Codex bundled runtime is
also recognized. No original executable, GIF, BMP, DLL image or Freeciv file is
read by this pipeline.

Run from the repository root:

```powershell
./tools/atlas-review/build-engine.ps1 -Configuration Debug
./tools/atlas-review/build-engine.ps1 -Configuration Release
node tools/atlas-review/build-review.cjs
node tools/atlas-review/build-support.cjs
node tools/atlas-review/windows.cjs
node tools/atlas-review/saved-map.cjs
node tools/atlas-review/verify.cjs
node tools/atlas-review/build-gallery.cjs
```

`build-review.cjs --reuse-bindings` reuses the derived PNG bank when only the
renderer or fixtures change. Full builds recreate it. Build products and
extracted source bodies remain in ignored `build/atlas-review/`. Review images,
fixtures, hashes and traces are deliberately versioned. The primary retained
sprite files are exact native crops; the rebuild reuses them and their retained
masters instead of making a new image-generation request.

The native executable can also emit an individual command trace:

```powershell
./build/atlas-review/Release/atlas-engine.exe map assets/atlas-hd/review/fixtures/close.txt
./build/atlas-review/Release/atlas-engine.exe city assets/atlas-hd/review/fixtures/city-coastal.txt
./build/atlas-review/Release/atlas-engine.exe throne assets/atlas-hd/review/fixtures/throne-complete.txt
```

The window executable uses the same build configurations:

```powershell
./build/atlas-review/Release/atlas-windows.exe diplomacy assets/atlas-hd/review/fixtures/diplomacy.txt
./build/atlas-review/Release/atlas-windows.exe spaceship assets/atlas-hd/review/fixtures/spacecraft-assembly.txt
./build/atlas-review/Release/atlas-windows.exe city-window assets/atlas-hd/review/fixtures/city-window.txt
```

Run `windows.cjs` after the other image builders: it adds the five window scenes
to the existing scene index. It also refreshes seven editable SVG/PNG window
components, `space-layout.json`, and the recorded artwork draw plans. No dated
or alternate asset-pack directories are created.

See [renderer boundaries](RENDERER-AUDIT.md),
[scoped upgrade recommendations](RENDER-UPGRADES.md),
[validation results](review/validation.json), and [provenance](PROVENANCE.md).

## Review and integration status

The complete selected set is reviewable without the earlier packs. Integration
still needs an explicit PNG/metadata loader and the HD rendering work described
in scope 1. Compatibility bindings cover the displayed fixtures; the primary
catalog and coverage map cover the broader art roles. Gameplay initialization,
all window layouts and a complete runtime replacement-resource test remain
future integration work. No new Ghidra facts or annotations are introduced.

## Original game art comparison

Original artwork has separate rights from Atlas HD. The original stage is a
local review aid and is **not part of the replacement pack or its license**.
Its PNGs, bindings, traces and hashes live in the ignored
`review/original-local/` directory. Do not stage, package or redistribute that
directory. A fresh checkout shows a clear unavailable message for that stage
until its owner builds it from their installed game. All 22 scenes have this
fourth comparison, including both city windows, both spacecraft states, the
transport plate, and all saved-game maps.

From the repository root, with Python + Pillow, Node + sharp and MSVC x86:

```powershell
./tools/atlas-review/build-engine.ps1 -Configuration Debug
./tools/atlas-review/build-engine.ps1 -Configuration Release
python tools/atlas-review/original-assets.py --game 'C:/path/to/your/Civ2'
node tools/atlas-review/original.cjs
node tools/atlas-review/build-gallery.cjs
```

`CIV2_GAME` can supply the installed game directory instead of `--game`.
The extractor reads seven original GIF sheets plus CV/PV/MK/SS DLL image
resources without executing them. It checks crop bounds, records input/output
hashes and verifies inputs remain unchanged. The replay verifies all scene
sizes, binding hashes and original map/city/throne Debug/Release trace equality.
Rerun these commands after changing fixtures or source renderer extraction.

The original stage uses the same supplied window state and panel/text adapters
as the other stages. Original CITY.GIF provides its actual panel background;
SS resource 499 provides the spacecraft background; resource-selected portraits,
ship crops and city sprites replace the new-art bindings. Font rasterization,
city summary rows and static diplomacy text remain review adapters. Animated
heralds, gameplay execution and full native window chrome are outside this
comparison. See the [original replay audit](RENDERER-AUDIT.md#original-art-replay).

## Map readability refinements

The four-stage gallery now uses revised replacement coast and transport artwork.
Roads are warm dirt tracks with winding arms; rails retain straight approaches,
cool ballast, pale steel and transverse sleepers. Shared endpoints remain fixed
for isolated, connected and junction sprites. Canonical network and coast PNGs
and SVGs are rebuilt in place, rather than kept as alternate art packs.

Coasts use broader coves/headlands, narrower variable shore bands and subdued
broken surf. The compatibility coast bank also fixes the three-neighbor mask
and the former desert-filled blank dither slot. Fish, whales and other resource
sprites are trimmed and centered inside their logical tile frame; the proposal
no longer fits them into a second, half-size frame.

Faction shields have a larger filled silhouette within their existing native
frame, contrasting rims and distinct primary/mid colors. Health and order marks
are readable; stacked units keep the source's repeated-shield indicator. The
cohesion stage additionally enlarges status badges by 35%, separates the rear
shield, adds a plus marker for stacks, and draws those badges over the unit layer.
The actual unit and city sprites keep the source-selected dimensions and anchors.
The district fixture explicitly includes fish, whales and a linked two-unit stack;
the three 1788 save scenes still use unmodified imported gameplay state.

Rebuild the selected map library before the normal review build:

```powershell
node tools/atlas-review/refresh-map-art.cjs
node tools/atlas-review/build-review.cjs
node tools/atlas-review/build-support.cjs
node tools/atlas-review/windows.cjs
node tools/atlas-review/saved-map.cjs
node tools/atlas-review/verify.cjs
node tools/atlas-review/verify-map-style.cjs
```

Then rebuild the optional original comparisons and gallery as described above.
[Map style metadata](map/readability.json) records the artwork conventions;
[focused validation](review/map-readability-validation.json) checks road joins,
shore continuity, ocean-resource centering and preserved unit/city frames.
