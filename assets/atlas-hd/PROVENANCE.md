# Atlas HD provenance

This delivery consolidates the art selected through `codex/atlas-hd-graphics`
commit `2fe6f3f`, with a new material-variation master and standalone render aids.
[authoring/selection.json](authoring/selection.json) records the selected origins.
Previous alternatives remain in Git history; they are not competing runtime packs
in this branch. Source masters can contain neighboring subjects that were not
selected into the catalog.

Painted artwork was created with the built-in `image_gen` tool from written
subject descriptions. Earlier repair edits referenced only artwork generated for
this collection. For the replacement artwork, no original-game or Freeciv image was supplied, copied, traced,
recolored, enlarged or incorporated. Code and image-resource header metadata
were inspected for roles, IDs, dimensions and composition contracts only.

[authoring/prompts.json](authoring/prompts.json) retains selected generation and
repair records. [authoring/surface-variations.json](authoring/surface-variations.json)
records the additional four-by-four low-contrast material master. The new master
is retained alongside the earlier masters. Native sprite crops are preserved;
compatibility frames and mockups resize and composite those crops deliberately.

Functional graphics are authored SVG geometry with corresponding PNG renders.
The seven components in `interface/windows/` are authored in `windows.cjs`;
window composites reuse retained portraits, backgrounds, units and module art.
Four `interface/economy/` symbols are original SVG geometry from
`economy.cjs`; food retains the existing painted `sprites/resources/wheat.png`.
The antique `interface/economy/gold.png` is a retained transparent image generated
with built-in `image_gen`, referencing only the prior authored coin and the
painted wheat for style. Its profile and ornament are invented. The
[coin generation record](authoring/economy-gold.json) preserves the full prompt
and reference roles. Rebuilds reuse these exact pixels. `docs/screenshots/city.png` was visually inspected to verify
semantic roles; none of its pixels or shapes were traced or reused.
The real-save maps import gameplay data from `he_a1788.sav` and numeric rule
fields, with hashes retained in the fixture. No save file, original rules file
or image input is included; the renderer still comes from this repository.
The spacecraft truss/attachment drawing is new vector geometry. No source-game
window screenshot or resource bitmap was used as a pixel input.
The retained SVGs are editable sources. `tools/atlas-review/art.cjs` defines the
shared terrain and transport geometry. The standalone adapter adds coast
quarters, dither masks, logical sprite frames and three small overview icons.
The new material variants have explicit crops and mip PNGs. No game image is an
input to the replacement-art build or its three preview stages.

Native dimensions and hashes are recorded in the catalog. The 3840×2160 exports
are presentation resamples; they do not create additional native detail. Source
renderer fixtures are not captures from the original game or an integrated build.

## Fonts and distribution

The three retained font families came from the official Google Fonts repository
and keep their unmodified SIL Open Font License 1.1 notices:

- [Noto Sans](fonts/notosans/OFL.txt)
- [Noto Serif](fonts/notoserif/OFL.txt)
- [Noto Sans Mono](fonts/notosansmono/OFL.txt)

[Font provenance](fonts/provenance.json) pins upstream revisions, URLs, sizes and
hashes. No Freeciv artwork was imported, so no Freeciv asset dependency is added.
The repository's license is unchanged. This record does not choose a new public
distribution license on the owner's behalf. Preserve generation records and the
applicable font notices with future distributions.

The originality statement describes the recorded inputs and authoring process;
it is not an exhaustive visual comparison against all existing works. Historical
subjects are newly illustrated. Existing game data, audio, video and arbitrary
scenario/expansion artwork remain outside this graphics delivery.

## Original-art scene comparisons

The fourth stage reads the user's original GIF sheets and GIF resources inside
CV.DLL, PV.DLL, MK.DLL and SS.DLL. Source sheets, extracted sprite crops, bindings,
traces and citizen contact sheets remain in the ignored `review/original-local/`
directory. The user authorized checking in only the composed in-game scene
mockups: 22 comparison renders and four 4K exports now live in
`review/original-scenes/`, with a render-only gallery index and hashes.

These original-game derivatives remain excluded from the Atlas HD asset manifest,
coverage bank, replacement bindings and replacement license. No original pixels
have been incorporated into the replacement library. An installed game is needed
to rebuild the comparisons, but not to view the committed renders. The local
binding index records source SHA-256 hashes, resource IDs, crop rectangles and
output hashes. These previews are trace replays with documented adapters, not
original-game screen captures.

## Map readability revision

The revised coast and road/rail banks are generated from the existing authored
material textures and procedural geometry in `tools/atlas-review/art.cjs`.
The fuller coast footprint is authored geometry in `shoreline.cjs` and
`map-finishing.cjs`, using the retained ocean texture. The muted map production symbol derives from the
project's own authored production SVG, with a separate color palette and size.
The original-art previews were inspected for readability and composition; no
original pixels, shapes or textures were traced, sampled or incorporated into
the replacement library. Resource changes center the retained generated sprites.
Faction shield geometry/colors are authored in the replacement binding/backend.
The flat banner face is authored in `unit-banners.cjs`; naval anchor metadata is
measured against the replacement alpha silhouettes. No ship artwork is repainted,
resized or derived from original pixels for this change.
The 35% badge enlargement and stack-marker layout belong only to the standalone
cohesion proposal, with the source unit/city frames preserved.

City panorama curtain walls are authored SVG geometry from `city-panorama.cjs`,
textured with the retained `map/materials/stone.png`. Their six PNG renders add no
external imagery. Buildings and wonders reuse the canonical painted sprites
with explicit relative-size metadata. The enhanced frontal gate at
`city/panorama/gate.png` is a built-in image_gen edit of our existing painted gate,
with our coastal proposal as orientation/style context. No original-game or
Freeciv imagery was supplied. [The authoring record](authoring/city-gate.json)
contains the complete prompt, input revision/hashes and unchanged generated
output hash. Its alpha is preserved. The earlier angled gate remains the
native/HD-only asset; the enhanced assembly uses explicit tower attachment points.

Citizen selection reuses the retained `citizen-pairs-01/02` and `citizens-01/02`
painted masters and extracted sprites. No new generated portraits are introduced.
The seven mood/profession cues are authored SVG geometry in `citizens.cjs`.
Original citizen contact-sheet pixels appear only in ignored local review output;
none are sampled into the replacement portraits or cue graphics.

The diplomacy power indicator reuses the four existing military category
sprites. Its six-segment scale is authored UI geometry. No new raster artwork
is generated; no original weapon pixels are incorporated. The English power
labels and rank selection are documented from the foreign-minister source and
the installed `LABELS.TXT`, independently of the replacement artwork.

The Medicine and Electricity knowledge icons in `sprites/knowledge/` were
generated with built-in image_gen using only `authoring/masters/advances-01.png`
as an authored style reference. Generated pixels and alpha are retained unchanged.
[The authoring record](authoring/knowledge.json) stores both prompts, the style
reference hash and output hashes. Banking, Engineering, Navigation and Physics
reuse existing replacement artwork. Numeric advance IDs/categories were read
from this repository's enum and the local base rules; no original artwork was
supplied to the generator or incorporated into the replacement icons.

## Flat agricultural overlays

`sprites/map-overlays/irrigation.png` and `farmland.png` are retained full-resolution
transparent outputs from the built-in `image_gen` tool. The irrigation edit used
only our previous irrigation sprite; farmland used the new irrigation image for
composition/style and our previous farmland sprite for its subject. The
[generation record](authoring/agricultural-fields.json) preserves both complete
prompts, input roles/revisions and output hashes. No original-game or Freeciv
image was supplied to either generation. Older compact garden crops remain only
as unselected subjects in the retained multi-subject master and in Git history.
Compatibility frames resize the selected new images without recoloring them.

`review/irrigation-cities.png` juxtaposes crops from the four composed in-game
saved-map scenes. Its original-art column has the same restricted reference-only
status as `review/original-scenes/`; this comparison is outside the replacement
asset manifest and replacement-art license.

## Native window background plates

The nine assets in `interface/native-backgrounds/` are authored SVG geometry
with 4× PNG exports, built by `native-backgrounds.cjs`. City panels are new vector
fills, thin borders and subtle woven patterns positioned from the repository's
source layout. Diplomacy and spacecraft plates embed the existing Atlas painted
backgrounds unchanged, then add source-aligned functional surfaces. Input hashes,
logical rectangles and source references are in `layout.json`. No original-game
pixels, decorative patterns or font imagery were used in these plates, and no
new image-generation request was needed. The original-art scene references were
inspected for functional grouping only. Enhanced variants keep their existing
paintings and foreground composition.

The full saved-world coastline survey reuses the existing authored terrain
textures. `shoreline.cjs` and `map-finishing.cjs` author rounded distance lobes,
a protected rounded tile footprint and multiscale value-noise contour relief.
A separate six-octave, domain-warped fractal layer adds close-up edge detail after
macro shaping. All noise and relief are procedural and deterministic.
The river update uses the same procedural approach in riverbanks.cjs: six
domain-warped noise octaves, densely sampled bank outlines, deterministic world
sampling and fixed native connection ports. Existing water, sediment and grass
materials supply the color; no new source images or traced river contours are used.
Patchy sand/rock/shallows, asymmetric river banks, periodic native texture
sampling and river-mouth alpha falloff reuse those authored materials;
they do not trace original art. Existing painted tree and field sprites are unchanged.
Only composed original-art scenes appear in `review/original-scenes/coast-audit/`,
under the same review-only allowance as the other original mockups. These are
not replacement sprites or runtime game screenshots.

Native land-transition coverage is authored in terrain-blends.cjs using four
scales of periodic, warped procedural noise. Only the alpha coverage of the forty
existing land-neighbor quarter PNGs changes; their material RGB comes from the
retained ground art. Tile centers, cacti, base materials and foreground sprites
are unchanged. The new native-land-edges.png sheet uses composed original-art
references only in its labeled original column, under the existing review-only
allowance; it contributes no pixels to replacement assets.

Forest-floor blending reuses the retained authored grassland and forest material
textures. `forest-floor.cjs` generates the native opaque ground diamonds and
four dither adapters; `art.cjs` uses the same grassy undergrowth and mottled leaf
litter for enhanced terrain. No original pixels are used; the tree silhouettes are supplied by the selected
feature bank. `review/forest-borders.png` contains only composed
four-stage scene crops, under the existing original-art review allowance.

General land-border blending reuses the ten retained ground PNGs without
changing their RGB within that transition step. terrain-blends.cjs authors
feathered alpha for the 40 native neighbor-quarter adapters, and supplies the
organic material weights used only by the enhanced sampler. There are no new
third-party image inputs. map/terrain-transitions.json records each adapter's
source and output hash. The new land-border comparisons use the real saved map;
original artwork appears only in composed scenes under
review/original-scenes/land-borders/ and the four-stage land-borders.png sheet,
with the same review-only allowance and license exclusions as the other scenes.


Desert cacti and two evergreen groves were created with the built-in image_gen
tool. The evergreen prompts use only our retained replacement broadleaf art as
style references; no original-game artwork was passed to image generation.
The full prompts, retained masters and selected sprite paths are recorded in
[terrain vegetation authoring](authoring/terrain-vegetation.json). Transparent
alpha is retained; outer framing ignores alpha values of 8 or less when finding
the crop bounds. No color remapping or opaque ground plate is added.

terrain-vegetation.cjs rebuilds the four desert ground phases from the existing
sand material, composes cacti inside the protected core, and updates the native
forest bindings. The original conifer-slot observation changes no source logic.
review/terrain-vegetation.png contains only composed scene crops under the same
review-only original-art allowance as the other comparison plates.

The four ocean-neighbor coastal feathers are procedurally authored by
`tools/atlas-review/coastal-blends.cjs` from the existing replacement grass
material, four scales of warped periodic noise and two finer clustered-noise
fields. The pattern is deterministic and baked into the PNGs. No original
sprite pixels are used.
