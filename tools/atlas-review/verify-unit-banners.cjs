const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./fixtures.cjs');
const assert = require('node:assert/strict');

async function filteredEdges(bindings) {
    const scene = C.read(C.path.join(C.pack, 'review/scenes.json')).find(s => s.id === 'district');
    const source = C.engine('objects', C.path.join(C.pack, scene.fixture));
    const unit = source.commands.findIndex(c => c.asset === 'unit/1');
    let front = unit - 1;
    while (source.commands[front].asset !== 'shield')
        front--;
    const commands = source.commands.slice(front, front + 3);
    const colors = [ 'e6dfc3', 'd66b57', '63b194', '9e87ca', '6e9ed0', 'd8bd60', 'dc994d', 'b7c7ce' ];
    let cases = 0, edgePixels = 0;
    for (const [owner, color] of colors.entries())
        for (const scale of [.5, 1, 1.35])
            for (const density of [1, 2]) {
                const trace = {
                    width : 64,
                    height : 80,
                    commands : commands.map(
                        c => ({
                            ...c,
                            x : 8,
                            y : 8,
                            width : Math.round(c.width * scale),
                            height : Math.round(c.height * scale),
                            color : c.asset === 'replace' ? (+c.text === 262 ? 200 : 210) + owner : c.color
                        }))
                };
                const image =
                    await C.raw(await R.baseline(trace, {mode : 'objects'}, bindings,
                                                 {density, native : density === 1, transparent : true}));
                const expected = color.match(/../g).map(v => parseInt(v, 16));
                let edge = 0;
                for (let i = 0; i < image.data.length; i += 4)
                    if (image.data[i + 3]) {
                        assert.deepEqual(
                            [...image.data.subarray(i, i + 3) ], expected,
                            'Filtered banner must retain its faction color, including partial-alpha edges');
                        if (image.data[i + 3] < 255)
                            edge++;
                    }
                assert(edge > 0, 'Exercise antialiased coverage rather than only opaque pixels');
                edgePixels += edge;
                cases++;
            }
    const originals = C.read(C.path.join(C.pack, 'review/original-local/bindings.json'));
    const originalTrace = require('./coast-audit.cjs').nativeTrace(C.path.join(C.pack, scene.fixture));
    const original =
        await R.baseline(originalTrace, scene, originals.bindings,
                         {originalText : true, palette : n => originals.palette[String(n & 255)]});
    const recorded = C.read(C.path.join(C.pack, 'review/original-scenes/renders.json'));
    assert.equal(C.sha(original), recorded[scene.id].sha256,
                 'Original-art replay must remain byte-identical');
    return {cases, edgePixels, originalScene : scene.id, originalReplayUnchanged : true};
}

async function main() {
    const meta = C.read(C.path.join(C.pack, 'map/unit-anchors.json'));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const banner = await C.raw(C.path.join(C.pack, bindings.shield.file));
    for (let y = 65; y < 100; y++)
        for (let x = 12; x < 84; x++)
            assert.deepEqual(
                [...banner.data.subarray((y * banner.width + x) * 4, (y * banner.width + x) * 4 + 4) ],
                [ 1, 6, 7, 255 ], 'Banner face must be flat without an inset strip');
    const results = [];
    for (const v of meta.overrides) {
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, v.file))), v.sha256,
                     'Unit art changed; recheck banner clearance');
        const sprite = await C.raw(C.path.join(C.pack, v.file), 512, 384);
        let maxAlpha = 0;
        for (let y = 0; y < 160; y++)
            for (let x = 0; x < 96; x++)
                maxAlpha = Math.max(maxAlpha,
                                    sprite.data[((v.anchor[1] * 8 + y) * 512 + v.anchor[0] * 8 + x) * 4 + 3]);
        assert(maxAlpha <= 8, 'Naval sprite covers banner anchor: ' + v.index);
        for (const zoom of [0, 8]) {
            const w = F.world(16, 16), camera = {ox : 2, oy : 2, cols : 7, rows : 14, zoom, viewer : -1};
            for (const t of w.tiles)
                t.t = 10;
            F.set(w, 8, 8, {u : v.index});
            const file = C.path.join(C.root, 'build/atlas-review/unit-banner-check.txt');
            C.write(file, F.serialize(w, camera));
            const trace = C.engine('objects', file);
            assert.deepEqual(trace, C.engine('objects', file, 'Debug'));
            const unitIndex = trace.commands.findIndex(c => c.asset === 'unit/' + v.index),
                  unit = trace.commands[unitIndex];
            const front = trace.commands.slice(0, unitIndex).filter(c => c.asset === 'shield').at(-1);
            assert(unit && front, 'Source must draw shield before naval unit');
            assert.equal(front.x - unit.x, v.anchor[0] * (zoom + 8) / 8);
            assert.equal(front.y - unit.y, v.anchor[1] * (zoom + 8) / 8);
            const badgeOnly = {...trace, commands : trace.commands.filter(c => !c.asset.startsWith('unit/'))};
            for (const density of [1, 2]) {
                const options = {density, native : density === 1, transparent : true};
                const full = await C.raw(await R.baseline(trace, {mode : 'objects'}, bindings, options));
                const badge = await C.raw(await R.baseline(badgeOnly, {mode : 'objects'}, bindings, options));
                let visible = 0;
                for (let i = 0; i < badge.data.length; i += 4)
                    if (badge.data[i + 3] === 255) {
                        visible++;
                        for (let k = 0; k < 4; k++)
                            assert(Math.abs(full.data[i + k] - badge.data[i + k]) <= 4,
                                   'Ship hides banner pixels');
                    }
                assert(visible > 50);
                results.push({unit : v.index, zoom, density, verifiedBannerPixels : visible});
            }
        }
    }
    C.json(C.path.join(C.pack, 'review/unit-banner-validation.json'), {
        status : 'pass',
        navalSprites : meta.overrides.length,
        filteredEdges : await filteredEdges(bindings),
        cases : results,
        limits :
            'Checks replacement naval anchor clearance and native shield-before-unit composition at two map zooms and both preview densities. Checks faction tint at all partially transparent edges for eight owners and three badge sizes, and replays the original district byte-for-byte. Enhanced stacks and city-label avoidance are covered by the existing map-style and city-label checks. Static fixture validation, not interactive gameplay qualification.'
    });
    console.log('PASS flat banner face, faction-mask edges, unchanged original replay and', results.length,
                'naval banner visibility cases');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
