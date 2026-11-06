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
HardwareGraphics=1
```

`OriginalGraphics=0` selects Atlas HD (the default). `GraphicsDensity` accepts 1–4
and controls the backing resolution, independently of the window's logical size
and mouse coordinates. The default is 2. `HardwareGraphics=1` (default) enables
the SDL GPU compositor when the renderer supports accelerated render targets and
premultiplied alpha. `HardwareGraphics=0` keeps HD artwork with the optimized CPU
compositor. Unsupported renderers and headless replays use the CPU automatically.
Restart after changing these options.

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

## GPU camera prototype

Add `GpuMapCamera=1` to `[OpenCiv2]` in `CIV.INI` and restart. This experimental
option defaults to off and requires the active SDL HD GPU compositor. CPU and
original-graphics rendering retain their existing controls and fixed zooms.
It currently applies to the main map window only.

- Wheel over the map zooms toward the pointer, including fractional trackpad
  input. The displayed scale is continuous from 1/8 to 2 times normal and does
  not snap to a legacy level when the gesture finishes.
- Left-drag or middle-drag pans after a six-logical-pixel threshold. A left
  click without dragging still selects/orders normally. Shift+left retains
  the original Go To gesture; paradrop mode retains its existing input.
- Zoom step buttons, View menu steps and X/Z use the displayed zoom. Presets
  reset to their original fixed scales. Ctrl+middle resets to normal zoom.
- Captions and the other panels stay at their normal size. Map tile picking
  and movement-direction masks inverse-transform the pointer into the same
  backing coordinates used by the GPU presentation. World wrapping stays in
  the original picker.

`src/game/map_camera.cpp` keeps camera state outside the serialized game
structures. `MapView` continues drawing at a nearby integer zoom into its live
surface, so units, flags, text, shadows, blinking and animation captures use
their existing paths. The desktop compositor scales only the map interior with
subpixel precision, preserving window occlusion and the logical desktop shadow.
No map-sized texture copy or GPU readback is added for ordinary camera frames.
Panning is coalesced at presentation time; zoom easing uses elapsed time.

This is a prototype, not the persistent viewport cache. When the requested view
leaves the backing surface or needs another source zoom, it redraws that surface
synchronously. Refreshes can still hitch. Until overscan is implemented, movement
is clamped to available coverage at map edges and minimum zoom; the pointer's
world position cannot remain fixed when those bounds intervene. The minimap
outline still describes the backing view. Saving/loading preserves the legacy
backing zoom, not the fractional camera state. Resizing and changing zoom presets
reset the camera; extra map windows retain their existing behavior.

On the i5-14500 / UHD 770 Windows host with Direct3D 11, a settled 1.63x map view
on the 1024x768 logical desktop took 2.62 ms median / 2.93 ms p95 at density 2,
and 5.05 ms / 5.80 ms at density 4. These are 31 warm desktop-composition samples
with GPU completion included. They exclude source refresh, event processing,
presentation and vsync; they do not establish a 10-15 ms interactive-frame bound.
The same density-4 view measured 4.89 ms median / 5.60 ms p95 on OpenGL, but
27.27 ms / 28.05 ms on Direct3D 9 on this host. The faster camera path therefore
does not remove the need to measure the selected backend.

`python tools/test_map_camera.py --game PATH` runs real-clock input, anchored
fractional zoom, drag picking, ordinary click selection, zoom limits/presets,
chrome clipping and composition measurements in isolated game directories at
densities 1-4. `tests/map_camera_pick_test.cpp` exercises the production picker
against independent diamond geometry, including the world seam. The SDL GPU
suite also checks fractional camera placement and clipping. `CIV2_CAMERA_TRACE=1`
adds gesture-routing diagnostics. The replay's `camera_probe` and
`camera_benchmark` commands inspect picking and measure settled composition.

## Renderer scope

The map uses the original tile, coast-quarter, river, road, border, sprite and zoom
composition. Map hooks add HD ownership coloring, redraw scheduling, and the
optional presentation camera described below. HD support
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

## SDL GPU compositor

The game still chooses the same tiles, sprites, coordinates and drawing order.
The HD platform layer stores surfaces in SDL render-target textures and performs
sprite blending, enlargement, opaque copies, window composition and presentation
on the GPU. Indexed planes remain available for legacy game queries. Windows
prefers SDL's Direct3D 11 driver; other platforms use SDL's selected driver.
`SDL_RENDER_DRIVER` can override the driver. Command batching stays enabled.

Single-player full redraws poll events about every 2 ms and present once the
redraw is complete, avoiding partial-frame composition and idle sleeps between
tiles. Multiplayer retains its existing message-pumping cadence. Deterministic
correctness replays retain their original virtual-clock polling schedule.

The minimap still evaluates the game's live visibility, ownership and blink
state. Its indexed background updates are collected into one upload, or a GPU
copy of the cached background when the resulting indices and palette match.
The viewport rectangle and caption are drawn afterward. This removes about
9,000 tiny GPU fills from a reference full redraw without caching game-state
decisions. The cache is owned by the minimap bitmap and released with it.

Disjoint colored glyphs share the destination snapshot and gamma passes;
overlapping glyphs retain sequential blending. Each affine gamma branch now
stores its RGB intercept and alpha-encoded slope in one premultiplied texture,
combining the former multiply/add pair into one blend. Colored text uses two
glyph passes instead of four, plus one snapshot and one MAX merge per batch.
This halves the colored-glyph texture count without a backend-specific shader.
Drivers without MAX blending keep the existing CPU gamma fallback.

Small immutable sprite and glyph images share a padded 4096×4096 SDL texture,
clamped to the device limit (at most 64 MiB). Adjacent quads using the same page,
destination, blend and filter form a geometry batch, up to 2,048 quads. Per-vertex
colors retain faction tinting. Geometry is clipped with the original sampling
origin; a one-texel duplicated border prevents interpolation into neighboring
images. Drawing order is preserved, including overlapping translucent sprites.
Private textures handle large images, full pages, or unsupported geometry.
Freed slots coalesce, and an empty page is released. Pending uploads are applied
before their first geometry submission and their CPU buffers are then freed;
there is no persistent full-page CPU shadow. The existing image LRU still limits
logical image storage to 128 MiB; atlas padding/free space can add up to 64 MiB of
GPU allocation beyond that logical accounting.

SDL queues must drain before changing a shared texture's sampling mode. The
D3D9 backend also needs its texture binding invalidated to refresh that sampler;
a zero-area untextured primitive does this without changing pixels. Mixed
nearest/linear rendering, including clipping and slot reuse, is regression-tested.
`CIV2_GPU_NO_ATLAS=1` disables packing and geometry batching for diagnosis while
retaining the two-pass colored-text implementation.

Desktop composition copies only
visible portions of opaque windows, maintaining the same logical backing pixels
while avoiding hidden-window overdraw. Packed indexed shadows and host-native
memory comparisons reduce CPU bookkeeping in the portable wasm2c build; ordinary
unscaled GDI copies bypass per-pixel sampler/ROP dispatch.

Premultiplied textures prevent transparent-edge color fringes. Tint, silhouette,
grayscale and text textures are cached in a separate 128 MiB LRU cache. Atlas
textures survive CPU decoded-image eviction, and one source texture serves every
enlarged size. Minification retains the CPU's alpha-aware area filter so thin
flagpoles and status details survive. Hardware blending/filtering and colored
text gamma passes have small rounding differences from the CPU reference.

Ordinary warm map redraws require no CPU readbacks on the tested D3D11 backend.
Screenshots, dynamic captures, inversion, backdrop fades, color correction and
uncommon scaled/grey surface copies retain explicit CPU transfer paths. Drivers
without the MAX blend operation use one readback per colored text string.
Texture-allocation failure falls back to CPU storage/drawing where possible.
Device-reset recovery is not implemented: lost GPU contents cause a rendering
error requiring restart, rather than silently displaying damaged surfaces.
`HardwareGraphics=0` is the troubleshooting fallback.

This also reduces first-use cache work: enlarged sprites no longer need CPU
resampling or a separate allocation for each zoom size. PNG decoding, texture
uploads and area-filtered reductions still happen on first use. A further option
is to package precomputed reductions for common zoom sizes; a bounded preload of
visible-map assets during loading could move the remaining work off the first
interactive redraw. Neither is implemented here; eagerly warming every asset and
zoom would increase startup time and evict useful entries from the bounded caches.

## Building

Install Pillow 11.3.0, then use the normal `make` / `make windows` entry points,
or `python tools/build_port.py module c exe-windows`. The build generates
`build/data/atlas-hd.pack` and `src/game/hd_layouts.h` with `tools/build_atlas.py`.
No original graphics are read by that tool. `build/data/atlas-inputs.json` records
all artwork inputs; `atlas-bindings.json` lists the resulting logical dimensions.
The artwork's provenance is retained under `assets/atlas-hd`.
The SDL backend requires SDL 2.0.18 or newer for geometry batching; the bundled
Windows toolchain uses SDL 2.30.9.

`python tools/build_port.py pack` includes the generated pack in the portable
source package. `CIV2_ATLAS_PREBUILT=1` uses a prepared pack without Pillow; the
release jobs transfer that pack with the generated C to every target platform.

## Verification

HD copies synchronize and commit only the affected logical rectangles. Window
surfaces commit directly, without relying on a GDI bitmap handle. Unscaled
transfers use overlap-safe row copies; sprite and bitmap lookups are cached.
Already resized atlas images bypass bilinear filtering, while enlarged images
reuse a bounded 64 MiB LRU cache of premultiplied samples. This preserves the
existing alpha, tint and grayscale rounding. The decoded-image/minification
cache retains its separate 96 MiB budget; very large stretches use the general
filtering path rather than evicting the map's enlarged sprites.

`python tools/benchmark_hd.py --game PATH --include-original` measures synchronous
map redraws at standard, medium-out and maximum-in zoom. It discards one warm-up
redraw per zoom and reports median and nearest-rank p95 over 21 samples
(`--samples N` changes that count). `CIV2_BENCHMARK=1` measures wall-clock
microseconds for `call_sync`; replay's virtual clock is not a performance timer.
Runs are sequential and save configuration, samples and screenshots in
`build/hd-benchmark-*`. `--gpu` uses a hidden hardware window, verifies activation,
drains earlier GPU work before timing and fences completion afterward.
`--frame` includes desktop/window composition (`CIV2_BENCHMARK_FRAME=1`), and
rejects older executables that lack that timing support. `--realtime` runs
the replay with live message-clock timing instead of accelerated virtual time.
All modes exclude presentation/vsync and are not interactive FPS measurements.
`CIV2_GPU_STATS=1` logs texture creation, draw and transfer counts at each fence.
It also reports atlas pages, live entries, geometry submissions, quads, uploads,
and batch breaks caused by page/state changes. `--no-atlas` measures the private
texture fallback independently of the reduced text passes.
Accelerated replay can amplify timer-queue traffic in older builds that polled
once per tile; use `--realtime` when investigating that effect. The completion
fence includes its synchronization/readback overhead, not just GPU execution.

On an i5-14500 / Intel UHD Graphics 770, with a 1024×768 logical desktop
and the reference save centered on Leipzig, the sprite-atlas/two-pass-text
change measured as follows. Before and after builds used the same sequential
workload and 21 warm samples per zoom. The baseline already includes the earlier
CPU, scheduling, minimap and composition optimizations.

| Density / zoom | Before redraw median | Atlas/text median | Atlas/text p95 |
| --- | ---: | ---: | ---: |
| 2 / standard | 11.55 ms | 11.57 ms | 13.50 ms |
| 2 / -3 | 14.52 ms | 12.87 ms | 14.00 ms |
| 2 / +8 | 8.91 ms | 8.34 ms | 9.12 ms |
| 4 / standard | 17.19 ms | 15.55 ms | 16.76 ms |
| 4 / -3 | 18.39 ms | 16.82 ms | 17.85 ms |
| 4 / +8 | 13.11 ms | 11.37 ms | 12.54 ms |

The first density-4 transitions at standard, -3 and +8 zoom fell from
44.62/77.75/28.67 ms to 35.69/59.11/21.84 ms. The standard view submits 2,368
packed sprite/glyph quads in 66 geometry batches; fills, private-texture copies,
text snapshots and MAX merges are additional operations. Warm redraws allocate
no image textures and upload no atlas data. The minimap can still upload when
its blinking indicator changes.

The stricter `--gpu --frame --realtime` run includes desktop composition and
live-clock message/timer activity, again with 21 warm samples:

| Density / zoom | Before frame median | Atlas/text median | Atlas/text p95 |
| --- | ---: | ---: | ---: |
| 2 / standard | 16.97 ms | 15.48 ms | 18.05 ms |
| 2 / -3 | 18.58 ms | 16.82 ms | 20.69 ms |
| 2 / +8 | 13.16 ms | 12.98 ms | 16.53 ms |
| 4 / standard | 30.84 ms | 22.80 ms | 25.97 ms |
| 4 / -3 | 33.70 ms | 30.15 ms | 32.45 ms |
| 4 / +8 | 23.46 ms | 22.39 ms | 28.06 ms |

The 10–15 ms target is not met across all densities and zooms. Redraw-only
numbers should not be used to claim that complete-frame target. Results are
specific to this scene, hardware and synchronization method; presentation/vsync
is excluded. Most per-sprite submissions are now batched, but legacy CPU work,
surface copying, GPU pixel traffic and synchronization still contribute.
Composed terrain-tile caching was tested earlier and rejected because its
first-use/zoom latency increased substantially for little density-4 benefit.

`python tools/test_hd.py` compiles the real compositor with the C compiler in
`CC` (default `cc`). It checks densities 1–4, transparent-edge filtering,
clipping, overlapping copies, indexed writes, sprite capture/clone lifetimes,
malformed-pack rejection and original mode without a pack.
It also checks selective color variants, cloned sprites and silhouette overrides.
Captured-sprite keys, greyscale alpha composition, reversible inversion and
non-destructive backdrop greying are covered at every density.
Reference pixel hashes check filtering across clipping, tint/grayscale and
cache reuse, with both the normal cache budget and a small budget exercising
eviction/fallback. Copy tests cover overlap direction, pending indexed writes
outside the copied region, and window surfaces without bitmap handles.
The compositor also checks thin-detail coverage and clipped/unclipped equality
for unit, flag and shield dimensions at every map zoom from -7 through +8.
`python tools/test_hd_gpu.py` compares the actual SDL backend with CPU pixels at
densities 1–4, including colored text gamma, source/destination clipping, overlap,
captures, inversion, input scaling, resize and thin details. It needs an
accelerated display session. Set `CC` and `SDL2_DIR` for a Windows SDL prefix;
otherwise it uses `sdl2-config`. Direct3D 11, Direct3D 9 and OpenGL passed on the
Windows host. CPU tests also verify the capability fallback without SDL.
The atlas tests compare packed sprites against private textures under clipping,
enlargement, tinting, alpha and mixed filtering. They cover a full 2,048-quad
batch, deletion of queued sources, handle reuse, and page lifetime. Add
`--small-atlas` to force page exhaustion, coalescing and private-texture fallback;
run with `CIV2_GPU_NO_ATLAS=1` to exercise the complete unpacked path.
`python tests/source_probe.py tests/hd_sprite_bounds_test.cpp` runs the actual
sprite bridge through 13,824 offset, trim, zoom and clipping cases in both debug
and optimized builds (set `CXX` to a C++ compiler).
`tests/hd_copy_bounds_test.cpp` uses the same source-probe runner to check logical
copy coordinates on top-down and bottom-up DIBs; `tests/hd_bitmap_lookup_test.cpp`
checks cached handles through deletion, reuse and storage replacement.
`tests/hd_gdi_copy_test.cpp` covers unscaled conversion and fallback paths;
`tests/hd_redraw_schedule_test.cpp` checks event-poll deadlines, nesting and
replay behavior. `tests/hd_composition_test.cpp` compares 2,000 randomized
overlapping/clipped window scenes with bottom-to-top composition, checking that
each visible pixel is copied exactly once. GPU runtime tests also compare batched
and sequential glyphs and exercise minimap restoration, changed indices and
palette edits. OpenGL's unsupported colored-text MAX blend uses the CPU fallback,
also exercised by the full game replay.
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
`--reference PATH` compares every zoom screenshot against an earlier result
directory. `--max-channel-error` and `--max-mean-error` set the acceptance limits
(defaults: 8/255 per channel and 0.15/255 scene mean). The atlas/text pass was
checked against the previous GPU build with tighter limits of 3 and 0.003.
All three replay tools accept `--gpu` for hidden hardware-window verification;
the game test additionally exercises `HardwareGraphics=0`. All 64 GPU zoom scenes
passed. The earlier scheduling/composition pass was pixel-identical to its GPU
baseline. The subsequent atlas/two-pass text changes differ by at most 3/255 per
channel and 0.0026/255 scene mean, within the existing hardware-rounding tolerance.
Compared with CPU screenshots, the largest scene mean channel difference remains
0.12/255, with no individual channel differing by more than 5/255.

Windows verification for this integration includes a built executable running
without original image files, and pixel/RNG equality with `main` in original
mode. Linux and macOS packaging are configured in CI; they were not executed
locally on the Windows development host.
