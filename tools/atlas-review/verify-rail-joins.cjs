const C = require('./common.cjs');
const assert = require('node:assert/strict');

function checkSteel(image, center, direction, reach, label) {
    const size = Math.hypot(...direction), tangent = direction.map(v => v / size),
          normal = [ -tangent[1], tangent[0] ];
    let count = 0;
    for (const side of [-1, 1])
        for (let t = -reach; t <= reach; t++) {
            const x = center[0] + t * tangent[0] + normal[0] * side * 6,
                  y = center[1] + t * tangent[1] + normal[1] * side * 6;
            let steel = 0;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const p = (Math.floor(y + dy) * image.width + Math.floor(x + dx)) * 4;
                    steel =
                        Math.max(steel, Math.min(...image.data.subarray(p, p + 3)) * image.data[p + 3] / 255);
                }
            assert(steel >= 170, `${label}: steel interrupted at ${t}, side ${side}`);
            count++;
        }
    return count;
}

async function main() {
    const texture = C.fs.readFileSync(C.path.join(C.pack, 'map/materials/road.png')).toString('base64'),
          bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    let samples = 0, nativeCases = 0, pairedCases = 0, endpointCases = 0;
    // These raster checks failed at 102 steel samples before the center-cap fix.
    // Use the exported compatibility PNGs, in both source draw orders.
    for (let d = 0; d < 4; d++)
        for (const reverse of [false, true]) {
            const image = C.clear(512, 256), dirs = reverse ? [ d + 4, d ] : [ d, d + 4 ];
            for (const bit of dirs) {
                const id = `rail/${bit || 8}`;
                C.blit(image, await C.raw(C.path.join(C.pack, bindings[id].file)), 0, 0);
            }
            samples += checkSteel(image, [ 256, 128 ], C.art.ends[d], 60, `native ${d}/${reverse}`);
            nativeCases++;
        }
    const cache = new Map();
    const sprite = async (mask, layer) => {
        const key = `${mask}/${layer}`;
        if (!cache.has(key))
            cache.set(key, await C.raw(Buffer.from(C.art.infrastructure('rail', mask, texture, 0, layer))));
        return cache.get(key);
    };
    for (let d = 0; d < 8; d++)
        for (const extra of [0, 17, 85, 255])
            for (const reverse of [false, true]) {
                const image = C.clear(1536, 1024), end = C.art.ends[d],
                      a = {center : [ 768, 512 ], mask : extra | (1 << d)}, b = {
                          center : [ 768 + end[0] * 2, 512 + end[1] * 2 ],
                          mask : extra | (1 << ((d + 4) % 8))
                      };
                for (const layer of ['bed', 'sleepers', 'metal'])
                    for (const t of reverse ? [ b, a ] : [ a, b ])
                        C.blit(image, await sprite(t.mask, layer), t.center[0] - 288, t.center[1] - 160);
                samples += checkSteel(image, [ 768 + end[0], 512 + end[1] ], end, 20,
                                      `boundary ${d}/${extra}/${reverse}`);
                pairedCases++;
            }
    // Every mask must reach every requested edge. Multi-arm routes must pass
    // through the junction instead of terminating as disconnected radial stubs.
    for (let mask = 1; mask < 256; mask++) {
        const routes = C.art.railCurve(mask);
        for (let d = 0; d < 8; d++)
            if (mask & (1 << d)) {
                const e = C.art.ends[d], len = Math.hypot(...e), expected = e.map(v => v + v / len);
                assert(routes.some(r => [r.points[0], r.points.at(-1)].some(
                                       p => p.every((v, i) => Math.abs(v - expected[i]) < 1e-6))),
                       `Missing rail edge ${mask}/${d}`);
                endpointCases++;
            }
        if ((mask & (mask - 1)) !== 0)
            assert(routes.every(r => r.boundary.every(Boolean)), 'Internal rail terminus in junction');
    }
    const result = {
        nativeStraightJoins : nativeCases,
        pairedBoundaryCases : pairedCases,
        continuousSteelSamples : samples,
        maskEndpointCases : endpointCases
    };
    C.json(C.path.join(C.pack, 'review/rail-connectivity-validation.json'), result);
    console.log('Rail connectivity checks passed', result);
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
