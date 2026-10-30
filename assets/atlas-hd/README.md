# Atlas HD

Open [the offline review gallery](index.html). Start with **Legacy → HD only**,
then switch to **HD only → HD + cohesion**. No server or original game data is
required to view the checked-in previews.

This is one selected library on `codex/atlas-hd-unified-review`, based on
`bd89036`. Earlier iterations remain on `codex/atlas-hd-graphics` at `2fe6f3f`.
The new branch contains no game source or loader changes.

## Contents

| Collection | Selected assets | Purpose |
| --- | ---: | --- |
| Painted sprites | 575 | Units, cities, buildings, wonders, resources, citizens, advisors, leaders, diplomacy, palace, effects, spaceship and setup art |
| Backgrounds | 22 | City sites, throne room, council, diplomacy, space, events and interface scenes |
| Interface assets | 498 | Authored SVGs and PNGs: controls, cursors, badges, masks, symbols and palette-dependent variations |
| Map assets | 1,117 | Ground, coast states, road/rail/river masks, shadows, materials and 16 new texture variations |
| Renderer bindings | 404 | Derived PNG adapters for the exact native boxes exercised by the review fixtures |

The 2,212 primary entries are indexed in [manifest.json](manifest.json).
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

## Three rendering stages

1. **Legacy resolution:** source-selected commands, new art reduced to native
   sprite boxes, source zoom scaling and nearest-neighbor enlargement.
2. **HD only:** the identical command trace, with larger RGBA images and a 2×
   display-density backing surface. Layout, road arms, coast quarters, source
   ordering, visibility and zoom gates stay the same. This is the expected first
   engine upgrade, simulated by the review backend.
3. **HD + cohesion:** a separate art-side prototype adds shared network geometry,
   world-space materials and river/coast sampling, quieter overview detail,
   object anchors and site-aware scene placement.

There are 19 scene comparisons: district, close and tactical map views, transport
matrix, coast, terrain repetition, region, full world, three city panoramas, three
throne stages, diplomacy, two spacecraft states and two city management windows.
Detailed map views retain the native unit/city frame size, anchor and badges; only
overview views substitute markers. The city management window is separate from
the panorama. See the [window audit](RENDERER-AUDIT.md#window-renderer-extension)
for native bodies versus explicit panel and typography adapters.
The close camera spans ten full tile widths by ten full tile heights (200 cells
on the staggered lattice). The whole-world fixture has 8,192 valid cells in a
128×128 coordinate domain. Twelve 3840×2160 review exports are available for
the close map, coast, coastal city and complete throne room, at all three stages.
These exports preserve aspect ratio and can resample the native art; they do not
claim additional native 4K detail.

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
