# Atlas HD runtime assets

This is the runtime subset of `new-graphics` at `8c1fce98`. It contains replacement
artwork, native crop bindings, layout data and authoring records. Build it with
`python tools/build_atlas.py`; see [runtime documentation](../../docs/HD-GRAPHICS.md).

The manifest and coverage inventory retain the source collection's full metadata,
including artwork not needed by this runtime. The authoritative list of files read
by a build is generated as `build/data/atlas-inputs.json`. Paired SVG sources and
authoring JSON records are retained where available. Full masters, comparison
galleries, standalone renderer tools, enhanced-map assets and original-art scene
references remain on the source branch; they are not part of the runtime package.

[PROVENANCE.md](PROVENANCE.md) preserves the collection's authoring history. Its
historical references to masters and review tools refer to that source branch.
No original-game graphics are inputs to the runtime pack builder.
