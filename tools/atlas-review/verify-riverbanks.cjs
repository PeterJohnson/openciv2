const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./fixtures.cjs');
const B = require('./riverbanks.cjs'), assert = require('node:assert/strict');

async function main() {
    const detailScales = [];
    let wrapChecks = 0;
    for (const pixels of [16, 32, 64, 128, 256, 512]) {
        let mean = 0, extra = 0, max = 0;
        for (let i = 0; i < 1024; i++) {
            const u = i * .0197, v = i * .0131, d = B.relief(u, v, pixels, 150);
            mean += Math.abs(d);
            max = Math.max(max, Math.abs(d));
            extra += (d - B.relief(u, v, 128, 150)) ** 2;
            assert(Math.abs(d - B.relief(u + 75, v - 75, pixels, 150)) < 1e-10,
                   'Bank relief must repeat across the world seam');
            assert(Math.abs(C.art.riverWidth(u, v, 150) - C.art.riverWidth(u + 75, v - 75, 150)) < 1e-10,
                   'Channel width must repeat across the world seam');
            wrapChecks += 2;
        }
        mean /= 1024;
        const rmsVs128 = Math.sqrt(extra / 1024);
        if (pixels <= 32)
            assert.equal(max, 0, 'No added bank detail at overview scale');
        if (pixels >= 128)
            assert(mean > .035 && max < .656, 'Bank relief must be visible and bounded');
        if (pixels === 512)
            assert(rmsVs128 > .005, 'Closer zoom reveals finer bank detail');
        detailScales.push({pixels, mean, max, rmsVs128});
    }

    let classedPixels = 0, connectedWaterComponents = 0;
    const sample = (buckets, u, v, pixels, width) =>
        B.field(u, v, buckets.get(Math.floor(u * 4) + ',' + Math.floor(v * 4)) || [], pixels, width);
    for (const [mask, width] of [256, 512].flatMap(
             width => Array.from({length : 16}, (_, mask) => [mask, width]))) {
        const world = F.world(16, 16);
        world.tiles.forEach(t => {
            t.t = 2;
            t.v = 1;
        });
        F.set(world, 8, 8, {t : 130});
        C.directions.filter((_, i) => !(i % 2)).forEach(([ dx, dy ], d) => {
            if (mask & (1 << d))
                F.set(world, 8 + dx, 8 + dy, {t : 130});
        });
        const buckets = R.riverSegments(world, R.lookup(world)), height = width / 2;
        const wet = new Uint8Array(width * height), seen = new Uint8Array(wet.length);
        const seeds = new Set();
        for (const r of C.art.riverCurve(mask, [ 8, 0 ], 256))
            for (const p of r.points) {
                const x = Math.floor(width / 2 + p[0] * width / 512),
                      y = Math.floor(height / 2 + p[1] * width / 512);
                if (x >= 0 && y >= 0 && x < width && y < height)
                    seeds.add(y * width + x);
            }
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
                const u = (y + .5 - height / 2) / height + (x + .5 - width / 2) / width;
                const v = (y + .5 - height / 2) / height - (x + .5 - width / 2) / width;
                if (Math.abs(u) > .5 || Math.abs(v) > .5)
                    continue;
                wet[y * width + x] = sample(buckets, u + 8, v, width, 0) < .5 ? 1 : 0;
                classedPixels++;
            }
        for (let p = 0; p < wet.length; p++) {
            if (!wet[p] || seen[p])
                continue;
            const queue = [ p ];
            seen[p] = 1;
            let touchesChannel = false;
            for (let i = 0; i < queue.length; i++) {
                const q = queue[i], x = q % width, y = Math.floor(q / width);
                touchesChannel ||= seeds.has(q);
                for (const [dx, dy] of [[ -1, -1 ], [ 0, -1 ], [ 1, -1 ], [ -1, 0 ], [ 1, 0 ], [ -1, 1 ],
                                        [ 0, 1 ], [ 1, 1 ]]) {
                    const nx = x + dx, ny = y + dy, n = ny * width + nx;
                    if (nx >= 0 && ny >= 0 && nx < width && ny < height && wet[n] && !seen[n]) {
                        seen[n] = 1;
                        queue.push(n);
                    }
                }
            }
            assert(touchesChannel, 'Detached river water pocket: mask ' + mask + ', pixels ' + queue.length);
            connectedWaterComponents++;
        }
    }

    const saved = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json'));
    const get = R.lookup(saved), buckets = R.riverSegments(saved, get);
    let savedRiverPorts = 0, savedMouthPorts = 0, centerSamples = 0, bucketBoundarySamples = 0;
    for (const t of saved.tiles) {
        if (!t.v || !(t.t & 128))
            continue;
        for (const [dx, dy] of C.directions.filter((_, i) => !(i % 2))) {
            const n = get(t.x + dx, t.y + dy);
            if (!n?.v || !((n.t & 128) || (n.t & 15) === 10))
                continue;
            const u = (t.x + t.y) / 2 + (dx + dy) / 4;
            const v = (t.y - t.x) / 2 + (dy - dx) / 4;
            for (const pixels of [32, 64, 128, 256, 512]) {
                assert.equal(sample(buckets, u, v, pixels, saved.width), 0, 'River/mouth port blocked');
                centerSamples++;
                // Compare independently bucketed samples on both sides of the shared cell edge.
                const a = Math.abs(dx + dy) ? 1e-7 : 0, b = a ? 0 : 1e-7;
                for (let offset = -.12; offset <= .12; offset += .006) {
                    const pu = u + (a ? 0 : offset), pv = v + (a ? offset : 0);
                    assert(Math.abs(sample(buckets, pu - a, pv - b, pixels, saved.width) -
                                    sample(buckets, pu + a, pv + b, pixels, saved.width)) < .0001,
                           'Bank discontinuity at shared river/mouth port');
                    bucketBoundarySamples++;
                }
            }
            if ((n.t & 15) === 10)
                savedMouthPorts++;
            else
                savedRiverPorts++;
        }
    }
    const wrapped = F.world(16, 16);
    wrapped.wrap = true;
    wrapped.tiles.forEach(t => {
        t.t = 2;
        t.v = 1;
    });
    F.set(wrapped, 0, 8, {t : 130});
    F.set(wrapped, 15, 7, {t : 130});
    const wrapBuckets = R.riverSegments(wrapped, R.lookup(wrapped));
    let wrappedRiverSamples = 0;
    for (const pixels of [32, 128, 512])
        for (let du = -.35; du <= .35; du += .01)
            for (let dv = -.15; dv <= .15; dv += .01) {
                const u = 3.5 + du, v = 4 + dv;
                assert(Math.abs(sample(wrapBuckets, u, v, pixels, 16) -
                                sample(wrapBuckets, u + 8, v - 8, pixels, 16)) < 1e-10,
                       'Wrapped river geometry and banks must match');
                wrappedRiverSamples++;
            }
    assert(savedRiverPorts > 0 && savedMouthPorts > 0);
    const report = {
        status : 'pass',
        detailScales,
        wrapChecks,
        enhancedConnectionMasksWithConnectedWater : 16,
        connectivityTileWidths : [ 256, 512 ],
        classedPixels,
        connectedWaterComponents,
        savedRiverPorts,
        savedMouthPorts,
        centerSamples,
        bucketBoundarySamples,
        wrappedRiverSamples,
        limits :
            'Finite river geometry, actual saved-map connections and native sprite checks. Visual detail is reviewed in river-fractal.png; no game renderer changes.'
    };
    C.json(C.path.join(C.pack, 'review/riverbank-validation.json'), report);
    console.log('PASS fractal riverbanks', JSON.stringify(report));
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
