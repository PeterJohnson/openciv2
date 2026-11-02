// Authored desert vegetation and four distinct forest groves.
const C = require('./common.cjs');
const cactusFile = 'sprites/features/desert-cacti.png';
const cactusBox = {
    left : 218,
    top : 76,
    width : 76,
    height : 104
};
// The original forest bank has pointed conifers in these three neighbor-mask slots.
const forestVariant = mask => ({3 : 2, 8 : 3, 10 : 2})[mask] ?? ((mask ^ (mask >> 1)) & 1);
// x/y have matching parity. Convert to tile-lattice coordinates before selecting four variants.
const worldVariant = (x, y) => ((((x + y) / 2) * 17 + ((y - x) / 2) * 31) >>> 0) % 4;

// The fuller pine fringe needs one native pixel of ground clearance.
// This is packing within the existing 64x32 frame, not a source draw offset.
const forestInset = variant => variant === 3 ? 8 : 0;

async function forestBitmap(source, variant) {
    const fitted = await C.fit(source, 512, 256, .90);
    if (!forestInset(variant))
        return fitted;
    const out = C.clear(512, 256);
    C.blit(out, await C.raw(fitted), 0, -forestInset(variant));
    return C.png(out);
}

async function cropMaster(master) {
    const image = await C.raw(C.path.join(C.pack, master));
    let left = image.width, top = image.height, right = -1, bottom = -1;
    for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++)
            if (image.data[(y * image.width + x) * 4 + 3] > 8) {
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
            }
    if (right < left)
        throw Error('Empty generated master ' + master);
    // Ignore nearly invisible outer alpha specks when defining the sprite frame.
    const rect = {left, top, width : right - left + 1, height : bottom - top + 1};
    return {rect, bytes : await C.sharp(C.path.join(C.pack, master)).extract(rect).png().toBuffer()};
}

async function desertGround(phase = [ 0, 0 ]) {
    const v = {land : 1, material : 'desert'};
    const ground = await C.art.ground(
        {cols : 1, rows : 1, vertices : [ [ v, v ], [ v, v ] ], tileWidth : 512, origin : phase});
    const dst = {data : ground.data, width : ground.width, height : ground.height};
    const cacti =
        await C.raw(await C.fit(C.path.join(C.pack, cactusFile), cactusBox.width, cactusBox.height, 1));
    C.blit(dst, cacti, cactusBox.left, cactusBox.top);
    return C.png(dst);
}

async function build() {
    const manifest = C.read(C.path.join(C.pack, 'manifest.json'));
    const sources = [
        {
            id : 'features.desert-cacti',
            file : cactusFile,
            master : 'authoring/masters/desert-cacti.png',
            label : 'Desert cacti',
            description :
                'Sparse saguaro, column and barrel cacti with dry scrub; ordinary desert terrain detail.'
        },
        {
            id : 'features.forest-0',
            file : 'sprites/features/forest-0.png',
            master : 'authoring/masters/forest-broadleaf-dense.png',
            label : 'Forest · dense broadleaf',
            description :
                'Overlapping rounded crowns, deeper green canopy shadows and softly irregular undergrowth.'
        },
        {
            id : 'features.forest-1',
            file : 'sprites/features/forest-1.png',
            master : 'authoring/masters/forest-birch-dense.png',
            label : 'Forest · leafy birch grove',
            description : 'Fuller green foliage with pale birch trunks and staggered rounded crowns.'
        },
        {
            id : 'features.forest-2',
            file : 'sprites/features/forest-2.png',
            master : 'authoring/masters/forest-conifers-dense.png',
            label : 'Forest · dense evergreens',
            description : 'Dense overlapping spruce crowns, deep green shadows and mottled needle litter.'
        },
        {
            id : 'features.forest-3',
            file : 'sprites/features/forest-3.png',
            master : 'authoring/masters/forest-conifers-open.png',
            label : 'Forest · open pines',
            description :
                'Asymmetric green pine grove with layered saplings, visible trunks and an open upper silhouette.'
        }
    ];
    for (const s of sources) {
        const {bytes, rect} = await cropMaster(s.master), raw = await C.raw(bytes);
        C.write(C.path.join(C.pack, s.file), bytes);
        const entry = {
            ...manifest.entries.find(e => e.id === s.id),
            id : s.id,
            label : s.label,
            description : s.description,
            kind : 'sprite',
            category : 'features',
            file : s.file,
            width : raw.width,
            height : raw.height,
            sha256 : C.sha(bytes),
            source : {master : s.master, rect, prompts : 'authoring/terrain-vegetation.json'},
            suggestedAnchor : 'bottom-center',
            anchorPixels : [ Math.floor(raw.width / 2), raw.height - 1 ]
        };
        // Legacy atlas-crop alpha counts do not describe the regenerated master.
        delete entry.alpha;
        const index = manifest.entries.findIndex(e => e.id === s.id);
        if (index < 0)
            manifest.entries.push(entry);
        else
            manifest.entries[index] = entry;
    }
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    C.art.setVariations(false);
    for (const e of manifest.entries.filter(e => /^map[.]ground[.]desert(?:-|$)/.test(e.id))) {
        const bytes = await desertGround(e.texturePhase);
        C.write(C.path.join(C.pack, e.file), bytes);
        e.sha256 = C.sha(bytes);
        e.description =
            'Warm sandy ground with a small cactus cluster inside the protected material core; blended perimeter unchanged.';
        e.vegetation = 'map/vegetation.json';
    }
    const index = C.read(C.path.join(C.pack, 'compatibility/bindings.json'));
    const desert = 'map/ground/desert.png';
    C.fs.copyFileSync(C.path.join(C.pack, desert), C.path.join(C.pack, index.bindings['terrain/0'].file));
    index.bindings['terrain/0'].source = desert;
    const slots = [];
    for (let mask = 0; mask < 16; mask++) {
        const variant = forestVariant(mask), source = 'sprites/features/forest-' + variant + '.png',
              entry = index.bindings['feature/forest/' + mask];
        const bytes = await forestBitmap(C.path.join(C.pack, source), variant);
        C.write(C.path.join(C.pack, entry.file), bytes);
        entry.source = source;
        slots.push({
            mask,
            variant,
            packedOffset : [ 0, -forestInset(variant) / 8 ],
            style : variant < 2 ? 'broadleaf' : 'evergreen',
            file : entry.file,
            sha256 : C.sha(bytes)
        });
    }
    index.vegetation = 'map/vegetation.json';
    C.json(C.path.join(C.pack, 'compatibility/bindings.json'), index);
    C.json(C.path.join(C.pack, 'manifest.json'), manifest);
    C.json(C.path.join(C.pack, 'map/vegetation.json'), {
        version : 1,
        authoring : 'tools/atlas-review/terrain-vegetation.cjs',
        source :
            'src/auto/mapview.cpp:1549 draw_tile_land; src/auto/graphics.cpp:601 gfx_load_terrain_sprites',
        native :
            'Desert cacti are part of the base sprite. Source still selects the sixteen forest masks; replacement conifers occupy slots 3, 8 and 10, matching the original bank silhouettes.',
        enhanced :
            'Four stable lattice-selected forest variants. Separate cacti at 48px and above, below fields/roads and omitted on cultivated or river desert.',
        forestArtwork :
            'Four high-resolution groves with denser overlapping crowns and deeper green canopy shadows; source-selected sprite boxes and grassy edge blending remain unchanged; pine variant 3 is packed one logical pixel higher to protect the coastal fringe.',
        cactus : {file : cactusFile, nativeBox : cactusBox},
        forestSlots : slots
    });
    console.log(
        'Built desert cacti, four dense forest variants, four desert grounds and sixteen native forest bindings');
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    cactusFile,
    cactusBox,
    forestVariant,
    forestInset,
    forestBitmap,
    worldVariant,
    desertGround,
    build
};
