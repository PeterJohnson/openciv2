const C = require('./common.cjs'), L = require('./terrain-blends.cjs'), A = require('./coast-audit.cjs');
const assert = require('node:assert/strict');

async function main() {
    const meta = C.read(C.path.join(C.pack, 'map/terrain-transitions.json'));
    assert.equal(meta.entries.length, 40);
    let featherPixels = 0, protectedCorePixels = 0;
    for (const e of meta.entries) {
        const bytes = C.fs.readFileSync(C.path.join(C.pack, e.file)), im = await C.raw(bytes),
              base = await C.raw(C.path.join(C.pack, e.source));
        assert.equal(C.sha(bytes), e.sha256);
        assert.equal(im.width, 256);
        assert.equal(im.height, 128);
        const x0 = e.quadrant < 2 ? 256 : 0, y0 = ((e.quadrant + 1) & 3) < 2 ? 0 : 128;
        for (let y = 0; y < 128; y++)
            for (let x = 0; x < 256; x++) {
                const X = x + x0, Y = y + y0, si = (Y * 512 + X) * 4, di = (y * 256 + x) * 4,
                      a = im.data[di + 3];
                const inward = 1 - Math.abs((X + .5 - 256) / 256) - Math.abs((Y + .5 - 128) / 128);
                assert(a <= 128, 'Overlay must not replace the neighboring material at the edge');
                if (inward >= .44) {
                    assert.equal(a, 0, 'Material core obscured');
                    protectedCorePixels++;
                }
                if (inward < 0)
                    assert.equal(a, 0, 'Overlay outside tile');
                if (a) {
                    assert.deepEqual(im.data.subarray(di, di + 3), base.data.subarray(si, si + 3),
                                     'Neighbor RGB changed');
                    if (a > 8 && a < 120)
                        featherPixels++;
                }
            }
    }
    assert(featherPixels > 10000 && protectedCorePixels > 10000);
    // These slots are outside the land transition change and must remain pixel-identical.
    for (let t = 10; t < 13; t++)
        for (let q = 0; q < 4; q++) {
            const source = C.path.join(C.pack, 'map/ground/' + (C.terrainNames[t] || 'grassland') + '.png');
            const generated = await C.raw(await L.dither(t, q, C.fs.readFileSync(source)));
            const retained = await C.raw(C.path.join(C.pack, `compatibility/dither/${t}/${q}.png`));
            assert.deepEqual(generated.data, retained.data, 'Sentinel dither changed');
        }
    let weightSamples = 0;
    for (let y = -20; y <= 20; y++)
        for (let x = -20; x <= 20; x++) {
            const u = x / 19, v = y / 17, w = L.weights(u, v), wrapped = L.weights(u + 75, v - 75);
            assert(w.every(n => Number.isFinite(n) && n >= 0 && n <= 1));
            assert(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12);
            assert(w.every((n, i) => Math.abs(n - wrapped[i]) < 1e-11), 'World wrap blend changed');
            weightSamples++;
        }
    assert.deepEqual(L.weights(.1, .1), [ 1, 0, 0, 0 ], 'Core loses material identity');
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    C.art.setVariations(true);
    const corner = t => ({land : t === 10 ? 0 : 1, material : C.terrainNames[t]});
    const sample = (u, v, c) =>
        C.art.surface(u, v, c, 'sand', [], 64, {landBlend : true, wrapWidth : 150, shorePixels : 128});
    let joins = 0, maxJoinDelta = 0;
    for (const a of [0, 2, 7, 10])
        for (const b of [0, 3, 8, 10])
            for (const c of [2, 5, 9, 10]) {
                const left = [ corner(1), corner(a), corner(b), corner(6) ],
                      right = [ corner(a), corner(c), corner(4), corner(b) ];
                const top = [ corner(1), corner(6), corner(b), corner(a) ],
                      bottom = [ corner(a), corner(b), corner(c), corner(4) ];
                for (let k = 1; k < 32; k++)
                    for (const pair
                             of [[ sample(1 - 1e-8, k / 32, left), sample(1 + 1e-8, k / 32, right) ],
                                 [ sample(k / 32, 1 - 1e-8, top), sample(k / 32, 1 + 1e-8, bottom) ]]) {
                        const delta = Math.max(...pair[0].map((n, i) => Math.abs(n - pair[1][i])));
                        assert(delta <= 1, 'Material seam at independently sampled cell boundary');
                        maxJoinDelta = Math.max(maxJoinDelta, delta);
                        joins++;
                    }
            }
    let coastSamples = 0;
    for (let mask = 0; mask < 16; mask++) {
        const corners = [ 0, 7, 5, 8 ].map((t, i) => corner(mask & (1 << i) ? t : 10));
        for (let y = 0; y <= 32; y++)
            for (let x = 0; x <= 32; x++) {
                // Stay inside the cell whose corner record is supplied.
                const p = sample((x + .5) / 33, (y + .5) / 33, corners);
                assert(p.every(n => Number.isFinite(n) && n >= 0 && n <= 255));
                assert(p.reduce((a, b) => a + b, 0) > 35,
                       'Missing material support at a full coastal footprint');
                coastSamples++;
            }
    }
    const report = C.read(C.path.join(C.pack, 'review/land-borders.json')), sceneChecks = [];
    assert.equal(report.saveSha256,
                 C.sha(C.fs.readFileSync(C.path.join(C.pack, 'review/fixtures/saved-world.json'))));
    const covered =
        new Set(report.regions.flatMap(r => r.counts.flatMap((n, t) => n && t < 10 ? [ t ] : [])));
    assert.equal(covered.size, 10);
    assert.equal(report.scenes.length, 8);
    for (const s of report.scenes) {
        const fixture = C.path.join(C.pack, s.fixture), trace = C.engine('map', fixture),
              original = A.nativeTrace(fixture);
        assert.deepEqual(trace, C.engine('map', fixture, 'Debug'));
        assert.deepEqual(original, A.nativeTrace(fixture, 'Debug'));
        assert.equal(s.traceSha256, C.sha(Buffer.from(JSON.stringify(trace))));
        assert.equal(s.originalTraceSha256, C.sha(Buffer.from(JSON.stringify(original))));
        const images = {};
        for (const stage of ['original', 'current', 'hd', 'proposed']) {
            const file = C.path.join(C.pack, s[stage]), m = await C.sharp(file).metadata(),
                  d = [ 'hd', 'proposed' ].includes(stage) ? 2 : 1;
            assert.equal(m.width, s.camera.cols * s.tileWidth * d);
            assert.equal(m.height, s.camera.rows * s.tileWidth * d / 4);
            images[stage] = {width : m.width, height : m.height, sha256 : C.sha(C.fs.readFileSync(file))};
        }
        sceneChecks.push({id : s.id, images});
    }
    const html = C.fs.readFileSync(C.path.join(C.pack, 'review/land-borders.html'), 'utf8');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
        new Function(m[1]);
    const result = {
        status : 'pass',
        nativeQuarterOverlays : 40,
        featherPixels,
        protectedCorePixels,
        unchangedSentinelSlots : 12,
        weightSamples,
        independentCellBoundarySamples : joins,
        maxJoinDelta,
        coastalMaterialSamples : coastSamples,
        landTypesCovered : 10,
        logicalTileWidths : [ 64, 128 ],
        scenes : sceneChecks,
        limits :
            'Asset and standalone-render checks, including source Debug/Release traces; native detail cutoffs remain unchanged. No whole-frame live-game or integrated-HD-engine claim.'
    };
    C.json(C.path.join(C.pack, 'review/terrain-blend-validation.json'), result);
    console.log('PASS land transitions', JSON.stringify({...result, scenes : sceneChecks.length}));
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
