# Atlas HD provenance

This delivery consolidates the art selected through `codex/atlas-hd-graphics`
commit `2fe6f3f`, with a new material-variation master and standalone render aids.
[authoring/selection.json](authoring/selection.json) records the selected origins.
Previous alternatives remain in Git history; they are not competing runtime packs
in this branch. Source masters can contain neighboring subjects that were not
selected into the catalog.

Painted artwork was created with the built-in `image_gen` tool from written
subject descriptions. Earlier repair edits referenced only artwork generated for
this collection. No original-game or Freeciv image was supplied, copied, traced,
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
Five `interface/economy/` symbols are original SVG geometry from
`economy.cjs`; food retains the existing painted `sprites/resources/wheat.png`. `docs/screenshots/city.png` was visually inspected to verify
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
input to the standalone build or preview pipeline.

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
