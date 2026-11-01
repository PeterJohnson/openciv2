const C = require('./common.cjs'), S = require('./shoreline.cjs'), assert = require('node:assert/strict');

async function main() {
    const profile = [];
    for (const v of [0, .125, .25, .375, .5, .625, .75, .875])
        for (let i = 0; i <= 256; i++) {
            const u = i / 256, r = S.radius(u, v);
            profile.push(r);
            assert(r >= .755 && r <= .875, 'Contour relief exceeded its authored bounds');
            assert(Math.abs(r - S.radius(u + 1, v - 1)) < 1e-10, 'Native relief jumps at tile repeat');
        }
    const range = Math.max(...profile) - Math.min(...profile);
    assert(range > .035, 'Native shoreline remains too uniform');
    const detailScales = [];
    for (const pixels of [16, 32, 48, 64, 128, 256, 512]) {
        let sum = 0, max = 0, extra = 0;
        for (let i = 0; i < 1024; i++) {
            const u = i * .0713, v = i * .0327,
                  delta = S.radius(u, v, true, 150, pixels) - S.macroRadius(u, v, true, 150, pixels);
            const coarse = S.radius(u, v, true, 150, 128) - S.macroRadius(u, v, true, 150, 128);
            sum += Math.abs(delta);
            max = Math.max(max, Math.abs(delta));
            extra += (delta - coarse) ** 2;
        }
        const mean = sum / 1024, rmsVs128 = Math.sqrt(extra / 1024);
        if (pixels <= 32)
            assert.equal(max, 0, 'Overview must retain its existing macro contour');
        if (pixels >= 128)
            assert(mean > .006 && mean < .025,
                   'Close-up detail must be visible without reshaping the macro coast');
        if (pixels === 512)
            assert(rmsVs128 > .0005, 'Higher resolution must reveal additional fine detail');
        detailScales.push(
            {projectedTilePixels : pixels, meanDisplacement : mean, maxDisplacement : max, rmsVs128});
    }
    let wrapChecks = 0;
    for (const width of [128, 150])
        for (const detail of [32, 64, 128, 256, Infinity])
            for (let i = 0; i < 128; i++) {
                const u = i * .37 + 2.3, v = i * .19 - 4.7;
                assert(Math.abs(S.radius(u, v, true, width, detail) -
                                S.radius(u + width / 2, v - width / 2, true, width, detail)) < 1e-10,
                       'World-wrap relief seam');
                const ox = Math.round(u), oy = Math.round(v), angle = i * .17;
                const r = .12 + i / 128 * .19;
                const x = ox + Math.cos(angle) * r, y = oy + Math.sin(angle) * r;
                const centers = C.directions.map(([ dx, dy ]) => [ox + (dx + dy) / 2, oy + (dy - dx) / 2]);
                const shifted = centers.map(([ cx, cy ]) => [cx + width / 2, cy - width / 2]);
                assert(Math.abs(S.field(x, y, centers, true, width, detail) -
                                S.field(x + width / 2, y - width / 2, shifted, true, width, detail)) < 1e-9,
                       'Irregular cove field jumps at world wrap');
                wrapChecks++;
            }
    const a = S.radius(7.37, 9.41, true, 150), b = S.radius(8.37, 9.41, true, 150);
    assert(Math.abs(a - b) > .001, 'Enhanced coast repeats independently on each tile');
    const detailedMasks = [
        1, 2, 4, 8, 16, 32, 64, 128, 255, 254, 253, 251, 247, 239, 223, 191, 127, 85, 170, 51, 204, 15, 240
    ];
    const saved = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json'));
    const byTile = new Map(saved.tiles.map(t => [t.x + ',' + t.y, t]));
    const isolatedLakes = saved.tiles.filter(t => (t.t & 15) === 10 && C.directions.every(([ dx, dy ]) => {
        const x = (t.x + dx + saved.width) % saved.width, n = byTile.get(x + ',' + (t.y + dy));
        return n && (n.t & 15) !== 10;
    }));
    const cases = [
        ...Array.from({length : 256}, (_, mask) => ({mask, width : 128})),
        ...detailedMasks.map(mask => ({mask, width : 512})),
        ...isolatedLakes.map(t => ({mask : 255, width : 256, origin : [ (t.x + t.y) / 2, (t.y - t.x) / 2 ]}))
    ];
    let waterComponents = 0, landComponents = 0, pixels = 0;
    const offsets = [ [ -1, -1 ], [ 0, -1 ], [ 1, -1 ], [ -1, 0 ], [ 1, 0 ], [ -1, 1 ], [ 0, 1 ], [ 1, 1 ] ];
    for (const {mask, width, origin} of cases) {
        const height = width / 2, N = width * height;
        const centers =
            C.directions.flatMap(([ x, y ], i) => mask & (1 << i) ? [ [ (x + y) / 2, (y - x) / 2 ] ] : []);
        const field = origin ? (u, v) => S.field(u + origin[0], v + origin[1],
                                                 centers.map(([ x, y ]) => [x + origin[0], y + origin[1]]),
                                                 true, saved.width, width)
                             : (u, v) => S.field(u, v, centers);
        const type = new Int8Array(N);
        type.fill(-1);
        const visited = new Uint8Array(N);
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
                const u = (y + .5 - height / 2) / height + (x + .5 - width / 2) / width,
                      v = (y + .5 - height / 2) / height - (x + .5 - width / 2) / width;
                if (Math.abs(u) > .5 || Math.abs(v) > .5)
                    continue;
                type[y * width + x] = field(u, v) > .5 ? 1 : 0;
                pixels++;
            }
        const center = (height / 2) * width + width / 2;
        assert.equal(type[center], 0, 'Ocean center filled');
        for (let start = 0; start < N; start++) {
            if (type[start] < 0 || visited[start])
                continue;
            const queue = [ start ], kind = type[start];
            visited[start] = 1;
            let touchesEdge = false, touchesWaterNeighbor = false, containsCenter = false;
            for (let index = 0; index < queue.length; index++) {
                const at = queue[index], x = at % width, y = Math.floor(at / width);
                containsCenter ||= at === center;
                for (const [dx, dy] of offsets) {
                    const nx = x + dx, ny = y + dy, n = ny * width + nx;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height || type[n] < 0) {
                        touchesEdge = true;
                        // A small cove can cross the tile boundary and reconnect through
                        // an ocean neighbor. It must not be an enclosed interior speck.
                        const nu = (ny + .5 - height / 2) / height + (nx + .5 - width / 2) / width;
                        const nv = (ny + .5 - height / 2) / height - (nx + .5 - width / 2) / width;
                        if (!centers.some(([ cx, cy ]) => cx === Math.round(nu) && cy === Math.round(nv)) &&
                            field(nu, nv) <= .5)
                            touchesWaterNeighbor = true;
                        continue;
                    }
                    if (!visited[n] && type[n] === kind) {
                        visited[n] = 1;
                        queue.push(n);
                    }
                }
            }
            if (kind) {
                assert(touchesEdge, `Detached land speck in coast mask ${mask}, origin ${origin}, pixels ${
                                        queue.length}, at ${start % width},${Math.floor(start / width)}`);
                landComponents++;
            } else {
                assert(containsCenter || touchesWaterNeighbor,
                       `Disconnected water pocket in coast mask ${mask}, width ${width}, pixels ${
                           queue.length}, edge ${touchesEdge}, at ${start % width},${
                           Math.floor(start / width)}`);
                waterComponents++;
            }
        }
    }
    // Measure the water outline, rather than only its beach or depth shading.
    // Compare each radial extent to an ellipse fitted from the four axis
    // intercepts. Natural asymmetric lakes are allowed; diamond corner bulges
    // and vanishing water centers are not.
    const roundness = [];
    for (const test of [{name : 'native', origin : [ 0, 0 ], world : false},
                        ...isolatedLakes.map(t => ({
                                                 name : t.x + ',' + t.y,
                                                 origin : [ (t.x + t.y) / 2, (t.y - t.x) / 2 ],
                                                 world : true
                                             }))]) {
        const centers =
            C.directions.map(([ x, y ]) => [(x + y) / 2 + test.origin[0], (y - x) / 2 + test.origin[1]]);
        const radii = Array.from({length : 72}, (_, i) => {
            const angle = i * Math.PI / 36;
            let lo = 0, hi = .6;
            for (let j = 0; j < 20; j++) {
                const r = (lo + hi) / 2;
                const field =
                    S.field(test.origin[0] + Math.cos(angle) * r, test.origin[1] + Math.sin(angle) * r,
                            centers, test.world, saved.width, 256);
                if (field > .5)
                    hi = r;
                else
                    lo = r;
            }
            return (lo + hi) / 2;
        });
        const relativeRadii = radii.map((r, i) => {
            const angle = i * Math.PI / 36;
            const a = radii[Math.cos(angle) >= 0 ? 0 : 36];
            const b = radii[Math.sin(angle) >= 0 ? 18 : 54];
            return r * Math.hypot(Math.cos(angle) / a, Math.sin(angle) / b);
        });
        const bulge = Math.max(...relativeRadii);
        const rmsEllipseDeparture =
            Math.sqrt(relativeRadii.reduce((n, r) => n + (r - 1) ** 2, 0) / relativeRadii.length);
        const min = Math.min(...radii), max = Math.max(...radii);
        assert(bulge < 1.2, 'Pointed lake corners: ' + test.name);
        assert(min > .1, 'Rounded lake lost its water center: ' + test.name);
        roundness.push({
            tile : test.name,
            minRadius : min,
            maxRadius : max,
            maxRadiusRelativeToAxisEllipse : bulge,
            rmsEllipseDeparture
        });
    }
    // Avoid replacing the square-corner problem with uniformly elliptical ponds.
    // These bounds measure the final outline, independently of its shading.
    const meanEllipseDeparture = roundness.reduce((n, r) => n + r.rmsEllipseDeparture, 0) / roundness.length;
    assert(roundness[0].rmsEllipseDeparture > .05, 'Native lake is too uniformly elliptical');
    assert(meanEllipseDeparture > .06, 'Saved lakes lack uneven banks');
    C.json(C.path.join(C.pack, 'review/shore-relief-validation.json'), {
        status : 'pass',
        lakeRoundness : roundness,
        meanLakeEllipseDeparture : meanEllipseDeparture,
        nativeProfileRange : range,
        fractalDetailScales : detailScales,
        profileSamples : profile.length,
        nativeNeighborhoods : 256,
        highDetailMasks : detailedMasks.length,
        savedSingleTileLakes : isolatedLakes.length,
        savedLakeTileWidth : 256,
        highDetailTileWidth : 512,
        filteredPixelWidths : [ 32, 64, 128, 256 ],
        classedPixels : pixels,
        waterComponentsWithOceanAccess : waterComponents,
        landComponentsTouchingNeighbors : landComponents,
        worldWrapChecks : wrapChecks,
        worldWrapCoveFieldChecks : wrapChecks,
        limits :
            'Water components reach the tile center or an adjacent ocean tile. Finite geometry and wrap checks; visual review determines the artistic result. Native topology, source zoom cutoffs and all foreground sprite footprints remain unchanged.'
    });
    console.log('PASS shore relief, connected water/land contours, native repeat and world wrap',
                {range, waterComponents, landComponents, pixels, wrapChecks});
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1
});
