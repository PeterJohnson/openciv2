# Original-art mockup versus runtime fidelity

**Finding: the current original-art renders are not pixel-equivalent game
screenshots.** Fonts differ, and several panels, controls, text labels and
overlays are supplied or omitted by the standalone adapter. Extracting selected
draw routines preserves their command selection and geometry; it does not
include every caller, font/GDI operation, window control or final compositor.

[Open the visual comparison](review/fidelity.html). It includes four runtime
screenshots beside the existing mockups, three magnified detail comparisons,
and font measurements. [The evidence index](review/fidelity.json) records image
dimensions/hashes and source references. This audit changes neither game source
nor the existing scene images.

## Reference scope

The references are `docs/screenshots/diplomacy.png`, `city.png`, `city-view.png`
and `europe-1940.png` in **richardpenman-civ2**. The repository README identifies
these as screenshots of the native OpenCiv2 build. They show a running game, but
are not fresh screenshots of the installed original Windows executable.

A separate copy of the installed original game was prepared for inspection;
computer-use app approval timed out at launch. No fresh original-executable
capture was obtained. This is an explicit validation limit, not a successful
runtime comparison.

The existing reference screenshots and review fixtures have different saves,
eras, populations, research, camera positions and display scales. Their full
images cannot meaningfully be subtracted to produce a renderer-error percentage.
Observed typography, omitted content and adapter differences are reported below;
unmatched scene state is not classified as a renderer defect. Spacecraft and
throne-room parity remain visually unverified because this screenshot set has
no corresponding runtime captures.

## Confirmed differences

| Area | Runtime/source behavior | Mockup behavior | Consequence |
| --- | --- | --- | --- |
| Diplomacy typography | `init_science` selects face 0, size 11. `font_handle_create` maps face 0 to Times New Roman. `science_draw_tech` measures, wraps/truncates, shadows and uses an era palette color. | `GameFont::init` is empty; the draw helper is a stub. `OriginalPainter` uses the SVG font stack with one pale color/shadow. Knowledge names are cut to eight characters and drawn at size 9. | Different face, metrics, baseline, color, line count and truncation. |
| Diplomacy content | The runtime screenshot includes a herald/video layer and the native static art. | Static audience only; invented envoy/government/column captions are added by `original.cjs`. | The original-art scene contains text the extracted renderer did not emit and omits the animation layer. |
| City economy | Runtime has native food, trade/distribution and shield bars, source labels and controls. | Six separate resource-role rows, simplified labels, supplied terrain/unit details and a different button arrangement. | More than a font discrepancy: the original-art replay reuses a redesigned panel adapter. |
| City framing | Runtime screenshot includes title, borders, scrollbars and full controls. Source supports scaled city content. | A 636×421 content-only fixture at `view_scale=2`; no complete window lifecycle/chrome. | Viewport/scale and UI completeness must be aligned before pixel comparison. |
| Map text | Game selects fonts by zoom and draws names, badge text and full map UI. | Width is estimated as character count × six pixels at 1×; SVG monospace glyphs are drawn. `draw_city_names` is a no-op. | Both glyphs and text bounds differ; city names are absent. |
| City panorama | `CityViewWindow::draw_title` draws name/year in two colored passes. | Harness calls building layout/draw methods without the title and emits a wider synthetic panorama. | Missing title is confirmed; different building inventory and camera are unpaired state, not measured placement errors. |
| Spacecraft | Full window includes source text, stats and controls around the source assembly image. | Assembly commands execute; title, stats, font metrics and buttons are supplied. | Source evidence identifies incomplete coverage; no visual parity claim without a runtime capture. |
| Throne room | Resource order and crop selection depend on actual furnishing state and window context. | Selected source routines execute on supplied state. | Existing order checks remain useful; final-frame equality is unverified. |

The user-visible heading “Original game artwork” describes the image source,
not pixel equivalence. The gallery now links this audit prominently so the
comparison's limits are visible without opening the detailed renderer notes.

## Fonts: why changing the family name alone is insufficient

The target repository already contains `src/platform/text.c` and the
`data/native/fonts.bin` / `fonts_aa.bin` reference glyph banks. They preserve
per-character measured advances, drawing advances, bearings, baseline metrics,
clipping and separate indexed/antialiased rendering. The banks were captured
from the project's Wine reference environment; they are not proof of identical
glyphs on every Windows installation.

The audit reads the regular Times New Roman reference at height 11. Its cell
height is 13 and ascent is 10. `III` measures 12 pixels, while `WWW` measures 33;
the map shim assigns both 18 pixels at 1×. `NAVIGATION` measures 77 pixels and
has a 75-pixel drawing advance. These figures demonstrate the lost metrics;
they are not measurements of the diplomacy SVG fallback or a whole-scene diff.

The port's `CIV2_WINE_TEXT` setting deliberately selects reference measured
advances, while normal port rendering uses drawing advances. A fidelity target
must specify which behavior, font bank, antialiasing/palette path and display
scale it is matching. Merely requesting “Times New Roman” in SVG still leaves
font substitution, advance widths, hinting, clipping and shadows uncontrolled.

## Scoped correction and acceptance plan

1. **Create an identical-input baseline.** Choose one saved game and explicit
   city, leader, government/era, spacecraft state and throne state. Record camera,
   logical viewport, game zoom, display density, selected UI options, font backend
   and capture frame. Compare equal content rectangles, with window chrome
   tested separately. Freeze or separately classify the animated herald layer.
2. **Restore text fidelity.** Carry source font identity/height/style, colors,
   rectangle/alignment and clipping through the trace. Reuse the target text
   backend and glyph bank instead of SVG fallback and `strlen` estimates. Execute
   source knowledge fitting with real caller state, including the documented
   prior-buffer branch; do not invent a “correct” initial value to make a fixture
   match. Check long names, narrow letters, wide letters and two-line labels.
3. **Replace panel adapters.** Capture the actual city economy, resource map,
   present-unit and control draw paths. Add city-name and panorama-title paths.
   Remove mockup-only captions from the original and native-equivalence stages.
   Keep intentionally enhanced composition in the enhancement stage.
4. **Add a runtime pixel gate.** Require equal dimensions, aligned state and
   exact framebuffer pixels for a small set of native scenes. Retain expected
   frames, difference images and mismatched bounding boxes. Do not treat D/R
   command agreement or a source-function count as this acceptance test. Test
   HD density and enhancement behavior separately after the native match.

No game-source change is needed to conduct this audit or to improve the
standalone review backend. The next fidelity implementation should use this
repository's rendering code and platform text implementation.

## Validation of this audit

`node tools/atlas-review/fidelity.cjs` rebuilds the offline comparison and JSON
evidence. It checks all eight scene-image paths and dimensions, bounds of all
six detail crops, hashes the referenced images/source files/font bank, parses
all 688 bitmap-font records to the file boundary, checks the five measurement
samples, resolves local HTML links and compiles the viewer script. These are
artifact/evidence checks, not runtime-parity tests.
