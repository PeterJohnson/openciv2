const C = require('./common.cjs'), V = require('./terrain-vegetation.cjs'),
      L = require('./terrain-blends.cjs'), assert = require('node:assert/strict');

async function main() {
    const meta = C.read(C.path.join(C.pack, 'map/vegetation.json'));
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    C.art.setVariations(false);
    const grounds = [];
    for (const e of C.entries.filter(e => /^map[.]ground[.]desert(?:-|$)/.test(e.id))) {
        const v = {land : 1, material : 'desert'}, base = await C.art.ground({
            cols : 1,
            rows : 1,
            vertices : [ [ v, v ], [ v, v ] ],
            tileWidth : 512,
            origin : e.texturePhase
        });
        const actual = await C.raw(C.path.join(C.pack, e.file));
        let changed = 0;
        for (let y = 0; y < 256; y++)
            for (let x = 0; x < 512; x++) {
                const i = (y * 512 + x) * 4, u = (y + .5) / 256 + (x + .5 - 256) / 512,
                      v = (y + .5) / 256 - (x + .5 - 256) / 512;
                assert.equal(actual.data[i + 3], base.data[i + 3], 'Ground opacity changed');
                const difference = [ 0, 1, 2 ].some(k => actual.data[i + k] !== base.data[i + k]);
                if (difference) {
                    assert.equal(L.alpha(u, v), 0, 'Vegetation leaked into feathered edge');
                    changed++;
                }
            }
        assert(changed > 1500, 'Desert decoration missing');
        const readable = [];
        for (const tw of [32, 64, 128]) {
            const a = await C.raw(C.path.join(C.pack, e.file), tw, tw / 2),
                  b = await C.raw(base.bytes, tw, tw / 2);
            let visible = 0;
            for (let i = 0; i < a.data.length; i += 4)
                if (Math.max(...[0, 1, 2].map(k => Math.abs(a.data[i + k] - b.data[i + k]))) > 20)
                    visible++;
            assert(visible >= 5, 'Cacti vanish at ' + tw + 'px');
            readable.push({tileWidth : tw, contrastingPixels : visible});
        }
        grounds.push({file : e.file, changedCorePixels : changed, readable});
    }
    assert.equal(grounds.length, 4);
    assert.equal(meta.forestSlots.length, 16);
    const styleSlots = {broadleaf : [], evergreen : []}, variants = new Set();
    for (const s of meta.forestSlots) {
        assert.equal(s.variant, V.forestVariant(s.mask));
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, s.file))), s.sha256);
        const m = await C.sharp(C.path.join(C.pack, s.file)).metadata();
        assert.equal(m.width, 512);
        assert.equal(m.height, 256);
        styleSlots[s.style].push(s.mask);
        variants.add(s.variant);
    }
    assert.equal(variants.size, 4);
    assert.deepEqual(styleSlots.evergreen, [ 3, 8, 10 ]);
    const parityCounts = [ 0, 0, 0, 0 ];
    for (let y = 0; y < 16; y++)
        for (let x = y & 1; x < 16; x += 2)
            parityCounts[V.worldVariant(x, y)]++;
    assert(parityCounts.every(n => n > 0), 'Staggered map coordinates collapse variation');
    const world = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json')),
          savedCounts = [ 0, 0, 0, 0 ];
    for (const t of world.tiles)
        if ((t.t & 15) === 3)
            savedCounts[V.worldVariant(t.x, t.y)]++;
    assert(savedCounts.every(n => n > 0));
    for (const id of ['features.desert-cacti', 'features.forest-2', 'features.forest-3']) {
        const e = C.find(id), a = await C.raw(C.path.join(C.pack, e.file));
        assert(a.width > 512 && a.height > 512, 'Retain high-resolution source detail');
        assert(a.data.some((n, i) => i % 4 === 3 && n === 0), 'Transparent cutout required');
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, e.file))), e.sha256);
    }
    const review = C.read(C.path.join(C.pack, 'review/terrain-vegetation.json'));
    assert.equal(review.sha256,
                 C.sha(C.fs.readFileSync(C.path.join(C.pack, 'review/terrain-vegetation.png'))));
    const report = {
        status : 'pass',
        grounds,
        nativeForestStyles : styleSlots,
        staggeredLatticeVariantCounts : parityCounts,
        savedForestVariantCounts : savedCounts,
        limits :
            'Artwork bounds, native sprite bindings, downscaled contrast and deterministic selection checks. Recognition is also visually reviewed; no integrated game-rendering claim.'
    };
    C.json(C.path.join(C.pack, 'review/vegetation-validation.json'), report);
    console.log('PASS terrain vegetation', JSON.stringify(report));
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
