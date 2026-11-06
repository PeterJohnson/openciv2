# Atlas HD runtime graphics

Atlas HD is the default for interactive play. The artwork and non-map presentation
designs come from `new-graphics` through `05d5967d`. That branch supplied standalone
renderers; this integration connects them to the running game's state and controls.

## Choosing graphics

Edit `CIV.INI` in the directory containing the game's rules:

```ini
[OpenCiv2]
OriginalGraphics=0
GraphicsDensity=2
```

`OriginalGraphics=0` selects Atlas HD (the default). `GraphicsDensity` accepts 1–4
and controls the backing resolution, independently of the window's logical size
and mouse coordinates. The default is 2. Restart after changing either option.

`OriginalGraphics=1` selects the existing indexed renderer and original resource
loaders. Keep the game's original GIF/BMP sheets, image DLLs and `civ2.exe` for
that mode. `CIV2_CLASSIC=1` also selects original graphics. Original scenario
art and sprite editing are best used in original mode: HD mode binds the base
game's replacement assets by role, including when a scenario supplies a same-named
image sheet. Changes to rules, units, saves and game logic are unaffected.

The Windows executable embeds the replacement pack and fonts. On startup it
extracts them into `data` beside the executable, validates their checksums and
updates them when necessary. Linux packages ship `data`; macOS packages place it
inside the application. A prepared installation needs no original graphics.
It still needs the original rules/text (including `GAME.TXT`, `RULES.TXT` and
`LABELS.TXT`), and original sound/music/video files for those optional media.
The existing installer can copy those from the player's installation or disc.

## Renderer scope

The map uses the original tile, coast-quarter, river, road, border, sprite and zoom
composition. `src/auto/map.cpp` is unchanged; `src/auto/mapview.cpp` only adds HD
ownership coloring to the occupied-airbase sprite. HD support
provides true-color surfaces, alpha filtering, sprite bindings, fonts, and output
density. Indexed proxy planes retain the game's color-coded picking masks and
registration-marker contracts. The enhanced map sampler, terrain edge passes,
connected overlays and zoom substitutions from the review renderer are excluded.

Unexplored boundaries use the directional feathered masks from `05d5967d`,
replacing solid diamond notches in both the world map and city resource map.
The masks fade inward without revealing hidden terrain. Their original 32×16
logical boxes and the source zoom cutoff (no edge masks at zoom −4 and below)
are preserved.

Unit shields and disorder markers use the live owner's color. City flags select
the live civilization's color rather than assuming its slot still matches its
tribe's color; dark flags retain their darker cloth. Diplomacy badges use selective
color variants that preserve gold borders and dark details. Occupied airbases
include an owner-colored aircraft over the unchanged runway artwork. The RGBA
diplomacy room displays a faction flag in place of its original palette-switched
banner. The existing indexed fills for city population boxes, map ownership,
report legends and editor color swatches already receive the civilization colors.

Palette effects also have HD equivalents. Captured sprites retain their automatic
or explicit transparency keys, interior holes and key replacements; authored
atlas sprites retain their RGBA alpha. Sleeping units use a neutral silhouette,
or detailed greyscale with `SentryHalftone`, without changing the background.
Stack shadows are dark, and the existing health thresholds select green, yellow
and red bars. Order glyphs, automation markers and fortification overlays retain
the game's existing drawing rules. Focus inversion preserves physical pixels,
and grey-backdrop transitions preserve source colors for fade-in and redraws.

At reduced sizes, atlas images are filtered over each output pixel's source
area before drawing. This preserves thin flagpoles and unit details that point
sampling could miss, without bleeding transparent RGB into their edges. The
filtered image cache follows the existing memory limit. Sprite clipping retains
the same scale and origin as an unclipped draw. Indexed fallback sprites update
only their scaled, clipped destination, and unit order glyphs stay inside their
shield's text area even when the shield is smaller than the minimum font size.

Non-map enhancements include:

- City panorama placement and depth ordering using live selected buildings,
  physical artwork proportions, waterfront regions, and front/rear city walls.
- Throne furnishings and upgrade cards tied to actual upgrade levels and the
  game's existing choice callbacks.
- Spacecraft assembly bays tied to installed parts, retaining the game's title,
  statistics and launch controls.
- Diplomacy military ratings and advance artwork; advance-specific illustrations
  in research, intelligence and Civilopedia windows, with category/era fallbacks.
- Numerical food and production meters, live report row backgrounds, clearer
  button faces, scalable text and authored interface graphics.

Panorama placement adapts the review's layout to live selected objects using
rectangle overlap scoring; it does not depend on review fixtures or consume RNG.
Diplomatic portraits are static replacement artwork; original portrait animation
is used only in original mode. There are no fixture names or statistics baked into
the live adapters.

## Building

Install Pillow 11.3.0, then use the normal `make` / `make windows` entry points,
or `python tools/build_port.py module c exe-windows`. The build generates
`build/data/atlas-hd.pack` and `src/game/hd_layouts.h` with `tools/build_atlas.py`.
No original graphics are read by that tool. `build/data/atlas-inputs.json` records
all artwork inputs; `atlas-bindings.json` lists the resulting logical dimensions.
The artwork's provenance is retained under `assets/atlas-hd`.

`python tools/build_port.py pack` includes the generated pack in the portable
source package. `CIV2_ATLAS_PREBUILT=1` uses a prepared pack without Pillow; the
release jobs transfer that pack with the generated C to every target platform.

## Verification

`python tools/test_hd.py` compiles the real compositor with the C compiler in
`CC` (default `cc`). It checks densities 1–4, transparent-edge filtering,
clipping, overlapping copies, indexed writes, sprite capture/clone lifetimes,
malformed-pack rejection and original mode without a pack.
It also checks selective color variants, cloned sprites and silhouette overrides.
Captured-sprite keys, greyscale alpha composition, reversible inversion and
non-destructive backdrop greying are covered at every density.
The compositor also checks thin-detail coverage and clipped/unclipped equality
for unit, flag and shield dimensions at every map zoom from -7 through +8.
`python tests/source_probe.py tests/hd_sprite_bounds_test.cpp` runs the actual
sprite bridge through 13,824 offset, trim, zoom and clipping cases in both debug
and optimized builds (set `CXX` to a C++ compiler).
`python tools/test_hd_factions.py` checks all eight colors in the built pack,
including flag trim, badge details, dark flags and the aircraft footprint, and
writes `build/hd-factions.png` for visual review.

The reference replay harness defaults to original graphics. `CIV2_TEST_HD=1`
enables HD for replays, while still respecting `OriginalGraphics=1` and classic
mode. `harness/hd/windows.txt` exercises live windows with a local `He_Auto.SAV`.
`python tools/test_hd_game.py --game PATH` copies rules/text and saves into an
isolated folder, excludes original graphics, runs that replay and checks its
screenshots. `--baseline EXE` additionally compares original-mode output and RNG
against a separately built `main` executable using a common replay.
`python tools/test_hd_effects.py --game PATH` additionally checks detailed sleeping
units, grey-backdrop transitions and color restoration in a new-game replay with
no original image files, plus the built pack's status and shadow colors.
`python tools/test_hd_zoom.py --game PATH` renders all 16 map zooms at densities
1–4 around Leipzig in the reference `He_Auto.SAV`, checks that the separate
status header stays unchanged, and writes an overview for each density. Its `call_sync` replay
commands wait for finite redraws to return; ordinary `call` remains reentrant
so subsequent replay input can operate modal dialogs.

Windows verification for this integration includes a built executable running
without original image files, and pixel/RNG equality with `main` in original
mode. Linux and macOS packaging are configured in CI; they were not executed
locally on the Windows development host.
