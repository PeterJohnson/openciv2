# Standalone native-content fidelity

The original-art and HD-only mockups now share a corrected native rendering
path. Enhanced compositions use their own trace/backend and retain their
designs. No game source is changed.

[Open the runtime comparison](review/fidelity.html) or the
[four-stage graphics review](index.html). The baseline target is the target
repository's indexed DIB text path, with `CIV2_WINE_TEXT` unset. This is not a
claim of whole-frame pixel parity with a live game capture.

## Corrections

| Area | Native/original and HD-only behavior |
| --- | --- |
| Fonts | Original-art previews replay `data/native/fonts.bin`, including reference glyphs, advances, bearings and clipping. Replacement-native and HD-only previews use the smooth Noto Sans/DejaVu Sans font stack, fitted to the same source text spans, wrapping, anchors and clips. HD rasterizes the replacement font at output density. Enhanced views retain replacement typography. |
| Diplomacy | Execute unchanged `science_draw_tech` for measured fitting, truncation, two-line labels, shadows and era colors. Remove invented envoy, government and column captions. Retain source military repetition and category artwork. |
| City economy | Execute unchanged food, shields, trade, distribution and parent resource-map functions. Source spacing, bar partitions, shortages/surpluses and labels replace the six redesigned rows. |
| City resource map | Execute `draw_resource_tiles` and the map terrain renderer, including neighbor joins and the radius edge, before unchanged worked-tile yield drawing. The small city's terrain and yield values remain explicit synthetic inputs. |
| City controls | Restore Buy/Change to the production panel, the eight bottom controls, and the improvement scrollbar at the source's scale-2 coordinates. Present-unit heading, positions and home abbreviation use the source single-row branch. |
| Map | Execute `draw_city_names`, `tile_in_view`, `map_tile_in_box` and `map_x_in_span`. Saved maps now carry real city names. Zoom font selection and unit/city text use the reference metrics. Replacement size boxes use per-sprite anchors; original-art retains its own sheet markers. Enhanced size/name overlays resolve label collisions separately. Original names use the source secondary faction palette entry. |
| Panorama | Restore the source's Times 36 bold title, 40-pixel title band and two palette passes. The supplied title is “Asteria:  A.D. 1788”, matching this synthetic fixture's identity, not the London screenshot. |
| Spacecraft | Keep source assembly order/clipping. Restore source title composition, Times 24/20/16 bold fonts, typewriter line spacing and label/value colors, status band and button coordinates. Original buttons use the original resource crops with native labels. Statistics remain declared fixture values. |

`extract-engine.py` now records 50 unchanged bodies and `extract-windows.py`
records 30. `draw_resource_map` is compiled under the standalone-only symbol
`draw_resource_map_native` so the enhanced adapter remains independent; its
recorded source body is unchanged. Supplied state, bitmap replay and the
documented presentation boundaries are not included in this count.

## Native background structure

The native/HD replacement windows now use source-aligned background plates.
The city plate restores static panel divisions; diplomacy's seven government
plates put light surfaces behind its fixed dark text and icon rows. Spacecraft
gets quiet title/statistics/status backing. Only the background image binding
changes. Original artwork and enhanced compositions remain separate.
[Compare background plates](review/native-backgrounds.png) ·
[Foreground equivalence and contrast checks](review/native-background-validation.json).

## Evidence and acceptance limits

The comparison references `docs/screenshots/diplomacy.png`, `city.png`,
`city-view.png` and `europe-1940.png` in **richardpenman-civ2**. The repository
identifies them as native OpenCiv2 runtime screenshots. Their saves, eras,
populations, cameras and display scales differ from the review fixtures.
Consequently no whole-image error percentage or pixel-equivalence claim is made.

The city mockup is the 636×421 **content rectangle** at `view_scale=2`; the
reference screenshot includes application chrome at a larger scale. Full
window title/border lifecycle, interactive control states and platform-specific
scrollbar painting are not captured by this renderer. Its raised controls use
an explicit classic control backend with source geometry. Present units use a
supplied three-unit stack; the fixture has no trade routes or pollution. Unit
portraits are bound art rather than a gameplay simulation.

Diplomacy is the static audience state. The installed input set contains no
herald movies, so animation is not represented. `science_draw_tech` has a
prior-buffer branch for a multiword name whose first word is too long. The
supported named fixtures avoid that branch; additional names must supply valid
caller state or stop. Tests include safe two-line “Iron Working” and “Code of
Laws” cases, plus measured truncation of the six main fixture names.

The original-art font bank comes from the project's Wine reference environment.
Only original-art previews replay its 1-bit masks. Replacement-native and HD-only
use smooth replacement fonts while retaining the source's logical spans and
clipping; this is an intentional artwork substitution, not original-font pixel
parity. Enhanced map labels are a final pass at every detail level, including the
world view; panorama titles are drawn after buildings and walls. Their text comes
from the same source traces and fixtures as the original-art views.

No fresh executable capture was obtained: the prior computer-use launch timed
out at app approval. Spacecraft and throne-room scenes still have no paired
runtime screenshots here. A future runtime gate needs identical save/state,
camera, content rectangle, font mode and capture frame, then framebuffer pixel
comparison. Source/Debug/Release checks do not replace that gate.

## Rebuild and checks

Build both configurations with `tools/atlas-review/build-engine.ps1`. Rebuild
`build-review.cjs --reuse-bindings`, `saved-map.cjs`, `windows.cjs`, `build-support.cjs`, local original
bindings, `original.cjs`, `build-gallery.cjs` and `fidelity.cjs` in that order.
Only composed original-art scene renders are committed; extracted original
sprites, palettes and binding tables remain ignored.

`verify.cjs` checks source hashes, Debug/Release traces, native/HD artwork
rectangles, source topology and asset integrity. `verify-native.cjs` additionally
checks fixed font metrics, clipped glyphs at both densities, source two-line
knowledge drawing, economic bar coordinates, real-save labels, title passes and
the enhanced boundary. Results are in [native-validation.json](review/native-validation.json).

For subsequent native-only corrections, `node tools/atlas-review/refresh-native.cjs`
refreshes the existing native/HD images, traces and exports without writing the
enhanced PNGs. Then rebuild local originals, verification and the gallery/audit.
`verify-typography.cjs` checks original/replacement font isolation, smooth HD
rasterization, clipping, and visible label pixels in all three saved-map and
three panorama enhanced renders. Results are in
[typography-validation.json](review/typography-validation.json).
The [preservation record](review/native-preservation.json) checks every game-source
file and original-art scene PNG against the snapshot before this typography fix.
The latest population-badge check also records source/original-scene preservation in
[city-label-preservation.json](review/city-label-preservation.json). Enhanced
city-size boxes now draw in a protected final pass alongside placed city names;
the panorama/title correction remains unchanged.
