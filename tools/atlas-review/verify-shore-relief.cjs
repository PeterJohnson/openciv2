const C = require('./common.cjs'), S = require('./shoreline.cjs'), assert = require('node:assert/strict');

async function main() {
    const profile = [];
    for (const v of [0, .125, .25, .375, .5, .625, .75, .875])
        for (let i = 0; i <= 256; i++) {
            const u = i / 256, r = S.radius(u, v);
            profile.push(r);
            assert(r >= .625 && r <= .78, 'Shore relief lost its protected land/water bounds');
            assert(Math.abs(r - S.radius(u + 1, v - 1)) < 1e-10, 'Native relief jumps at tile repeat');
        }
    const range = Math.max(...profile) - Math.min(...profile);
    assert(range > .035, 'Native shoreline remains too uniform');
    let wrapChecks = 0;
    for (const width of [128, 150])
        for (let i = 0; i < 128; i++) {
            const u = i * .37 + 2.3, v = i * .19 - 4.7;
            assert(Math.abs(S.radius(u, v, true, width) -
                            S.radius(u + width / 2, v - width / 2, true, width)) < 1e-10,
                   'World-wrap relief seam');
            wrapChecks++;
        }
    const a = S.radius(7.37, 9.41, true, 150), b = S.radius(8.37, 9.41, true, 150);
    assert(Math.abs(a - b) > .001, 'Enhanced coast repeats independently on each tile');
    const width = 128, height = 64, N = width * height;
    let waterComponents = 0, landComponents = 0, pixels = 0;
    const offsets = [ [ -1, -1 ], [ 0, -1 ], [ 1, -1 ], [ -1, 0 ], [ 1, 0 ], [ -1, 1 ], [ 0, 1 ], [ 1, 1 ] ];
    for (let mask = 0; mask < 256; mask++) {
        const centers =
            C.directions.flatMap(([ x, y ], i) => mask & (1 << i) ? [ [ (x + y) / 2, (y - x) / 2 ] ] : []);
        const type = new Int8Array(N);
        type.fill(-1);
        const visited = new Uint8Array(N);
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
                const u = (y + .5 - height / 2) / height + (x + .5 - width / 2) / width,
                      v = (y + .5 - height / 2) / height - (x + .5 - width / 2) / width;
                if (Math.abs(u) > .5 || Math.abs(v) > .5)
                    continue;
                type[y * width + x] = S.field(u, v, centers) > .5 ? 1 : 0;
                pixels++;
            }
        const center = (height / 2) * width + width / 2;
        assert.equal(type[center], 0, 'Ocean center filled');
        for (let start = 0; start < N; start++) {
            if (type[start] < 0 || visited[start])
                continue;
            const queue = [ start ], kind = type[start];
            visited[start] = 1;
            let touchesEdge = false, containsCenter = false;
            for (let index = 0; index < queue.length; index++) {
                const at = queue[index], x = at % width, y = Math.floor(at / width);
                containsCenter ||= at === center;
                for (const [dx, dy] of offsets) {
                    const nx = x + dx, ny = y + dy, n = ny * width + nx;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height || type[n] < 0) {
                        touchesEdge = true;
                        continue;
                    }
                    if (!visited[n] && type[n] === kind) {
                        visited[n] = 1;
                        queue.push(n);
                    }
                }
            }
            if (kind) {
                assert(touchesEdge, `Detached land speck in coast mask ${mask}`);
                landComponents++;
            } else {
                assert(containsCenter, `Disconnected water pocket in coast mask ${mask}`);
                waterComponents++;
            }
        }
    }
    C.json(C.path.join(C.pack, 'review/shore-relief-validation.json'), {
        status : 'pass',
        nativeProfileRange : range,
        profileSamples : profile.length,
        nativeNeighborhoods : 256,
        classedPixels : pixels,
        connectedWaterComponents : waterComponents,
        landComponentsTouchingNeighbors : landComponents,
        worldWrapChecks : wrapChecks,
        limits :
            'Finite geometry and wrap checks; visual review determines the artistic result. Native topology, source zoom cutoffs and all foreground sprite footprints remain unchanged.'
    });
    console.log('PASS shore relief, connected water/land contours, native repeat and world wrap',
                {range, waterComponents, landComponents, pixels, wrapChecks});
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1
});
