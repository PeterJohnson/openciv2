const C = require('./common.cjs');
const R = require('./render.cjs');
const F = require('./fixtures.cjs');
const assert = require('node:assert/strict');

async function main() {
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const tiles = new Map();
    let endpointCases = 0, samples = 0, pairs = 0;
    for (let mask = 0; mask < 16; mask++) {
        const e = C.entries.find(e => e.family === 'river' && e.mask === mask),
              bytes = C.fs.readFileSync(C.path.join(C.pack, e.file));
        tiles.set(mask, await C.raw(bytes));
        const crop =
            await C.sharp(bytes).extract({left : 32, top : 32, width : 512, height : 256}).raw().toBuffer(),
              native = await C.sharp(C.path.join(C.pack, bindings[`river/${mask}`].file)).raw().toBuffer();
        assert.deepEqual(crop, native, `Native river ${mask} must use the canonical artwork`);
        for (const origin of [null, [ 7, 11 ], [ 40, 23 ]]) {
            const routes = C.art.riverCurve(mask, origin);
            for (let d = 0; d < 4; d++)
                if (mask & (1 << d)) {
                    const end = C.art.ends[1 + d * 2];
                    assert(routes.some(r => [r.points[0], r.points.at(-1)].some(
                                           p => p.every((v, i) => Math.abs(v - end[i]) < 1e-8))),
                           `River endpoint ${mask}/${d}`);
                    endpointCases++;
                }
        }
    }
    for (let d = 0; d < 4; d++)
        for (const extra of [0, 5, 15])
            for (const reverse of [false, true]) {
                const image = C.clear(1024, 640), e = C.art.ends[1 + d * 2],
                      a = {mask : (1 << d) | extra, x : 512, y : 320},
                      b = {mask : (1 << ((d + 2) % 4)) | extra, x : 512 + e[0] * 2, y : 320 + e[1] * 2};
                for (const t of reverse ? [ b, a ] : [ a, b ])
                    C.blit(image, tiles.get(t.mask), t.x - 288, t.y - 160);
                const n = e.map(v => v / Math.hypot(...e));
                for (let step = -6; step <= 6; step++) {
                    const x = Math.round(512 + e[0] + n[0] * step), y = Math.round(320 + e[1] + n[1] * step),
                          p = (y * image.width + x) * 4, [ r, g, b, alpha ] = image.data.subarray(p, p + 4);
                    assert(alpha > 240 && g > r * 1.05 && b > r * 1.1,
                           `River water seam ${d}/${extra}/${reverse}/${step}`);
                    samples++;
                }
                pairs++;
            }
    const widths = Array.from({length : 80}, (_, i) => C.art.riverWidth(i * .17, i * .11));
    assert(Math.max(...widths) - Math.min(...widths) > .015, 'River width should vary naturally');
    const w = F.world(16, 16);
    for (const t of w.tiles)
        t.t = 2;
    F.set(w, 6, 6, {t : 130});
    F.set(w, 7, 7, {t : 130});
    F.set(w, 8, 8, {v : 0});
    const before = R.riverSegments(w, R.lookup(w));
    F.set(w, 8, 8, {t : 130});
    assert.deepEqual(R.riverSegments(w, R.lookup(w)), before, 'Hidden river must not create a connection');
    const result = {
        nativeBindingsMatchCanonical : 16,
        fixedEndpointCases : endpointCases,
        pairedDrawOrderCases : pairs,
        continuousWaterSamples : samples,
        widthRange : [ Math.min(...widths), Math.max(...widths) ],
        hiddenStateIsolation : true
    };
    C.json(C.path.join(C.pack, 'review/river-validation.json'), result);
    console.log('River checks passed', result);
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
