const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./fixtures.cjs');
const assert = require('node:assert/strict');

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
        cases : results,
        limits :
            'Checks replacement naval anchor clearance and native shield-before-unit composition at two map zooms and both preview densities. Enhanced stacks and city-label avoidance are covered by the existing map-style and city-label checks. Static fixture validation, not interactive gameplay qualification.'
    });
    console.log('PASS flat banner face and', results.length, 'naval banner visibility cases');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
