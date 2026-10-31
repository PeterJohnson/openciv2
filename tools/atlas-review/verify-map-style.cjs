const C = require('./common.cjs');
const R = require('./render.cjs');
const assert = require('node:assert/strict');

async function main() {
    let endpoints = 0;
    for (let i = 0; i < 8; i++)
        for (let mask = 1; mask < 256; mask++)
            if (mask & (1 << i)) {
                const arms = C.art.roadCurve(mask), reference = C.art.roadCurve(1 << i)[0];
                const arm =
                    arms.find(a => a.points.at(-1).every((v, k) => Math.abs(v - C.art.ends[i][k]) < 1e-6));
                assert(arm, 'Road has a stable endpoint');
                assert.deepEqual(arm.points, reference.points, 'Road arm changes shape at a junction');
                const n = C.art.ends[i], deviation = Math.max(...arm.points.map(
                                             p => Math.abs(p[0] * n[1] - p[1] * n[0]) / Math.hypot(...n)));
                assert(deviation > 10, 'Road must visibly bend away from rail centerline');
                endpoints++;
            }
    const center = C.art.shoreField;
    for (const mask of [0, 15])
        for (const [u, v] of [[ .1, .2 ], [ .5, .5 ], [ 13.2, 9.7 ]])
            assert.equal(center(u, v, Array.from({length : 4}, () => ({land : mask ? 1 : 0}))), mask ? 1 : 0);
    // The same shared edge evaluated from its adjacent corner neighborhoods.
    let joins = 0;
    for (let mask = 0; mask < 64; mask++)
        for (let i = 0; i <= 20; i++) {
            const values = Array.from({length : 6}, (_, j) => (mask >> j) & 1),
                  land = arr => arr.map(k => ({land : values[k]}));
            const a = center(1 - 1e-8, i / 21, land([ 0, 1, 4, 3 ])),
                  b = center(1 + 1e-8, i / 21, land([ 1, 2, 5, 4 ]));
            assert(Math.abs(a - b) < 1e-6, 'Shoreline discontinuity at cell boundary');
            joins++;
        }
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    for (const id of ['resource/20', 'resource/21']) {
        const im = await C.raw(C.path.join(C.pack, bindings[id].file));
        let left = im.width, right = -1, top = im.height, bottom = -1;
        for (let y = 0; y < im.height; y++)
            for (let x = 0; x < im.width; x++)
                if (im.data[(y * im.width + x) * 4 + 3] > 32) {
                    left = Math.min(left, x);
                    right = Math.max(right, x);
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y);
                }
        assert(Math.abs((left + right + 1) / 2 - im.width / 2) < 8, id + ' horizontal center');
        assert(Math.abs((top + bottom + 1) / 2 - im.height / 2) < 8, id + ' vertical center');
        assert(bottom - top > im.height * .5, id + ' readable ocean resource size');
    }
    let objects = 0, stacks = 0;
    for (const s of C.read(C.path.join(C.pack, 'review/scenes.json'))
             .filter(s => s.mode === 'map' && s.tileWidth >= 48)) {
        const trace = C.engine('objects', C.path.join(C.pack, s.fixture)), enhanced = R.readableBadges(trace),
              core = c => /^(unit|city)\//.test(c.asset);
        assert.deepEqual(trace.commands.filter(core), enhanced.commands.filter(core),
                         s.id + ' unchanged unit/city frames');
        objects += trace.commands.filter(core).length;
        const nativeShields = trace.commands.filter(c => c.asset === 'shield'),
              large = enhanced.commands.filter(c => c.asset === 'shield');
        assert.equal(nativeShields.length, large.length);
        for (let i = 0; i < large.length; i++)
            assert(large[i].width >= nativeShields[i].width * 1.3, 'Badge enlargement');
        stacks += enhanced.commands.filter(c => c.asset === 'text' && c.text === '+').length;
    }
    assert(stacks > 0, 'A real linked stack must appear in the review');
    const result = {
        roadMaskEndpointCases : endpoints,
        shorelineBoundarySamples : joins,
        centeredOceanResources : 2,
        preservedUnitCityCommands : objects,
        visibleStackMarkers : stacks
    };
    C.json(C.path.join(C.pack, 'review/map-readability-validation.json'), result);
    console.log('Map readability checks passed', result);
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
