const C = require('./common.cjs'), R = require('./render.cjs'), A = require('./coast-audit.cjs'),
      M = require('./map-finishing.cjs'), S = require('./shoreline.cjs'),
      assert = require('node:assert/strict');
const maskFor =
    (bits, q) => [(q * 2 + 6) % 8, (q * 2 + 7) % 8, q * 2].reduce((m, d, i) => m | ((bits >> d & 1) << i), 0);
const water = t => (t.t & 15) === 10;

async function main() {
    const world = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json')), get = R.lookup(world),
          report = C.read(C.path.join(C.pack, 'review/coast-audit.json'));
    assert.equal(world.tiles.length, 9000);
    assert.equal(report.saveSha256,
                 C.sha(C.fs.readFileSync(C.path.join(C.pack, 'review/fixtures/saved-world.json'))));
    let joins = 0, footprints = 0, worldCoasts = 0;
    const fullCenters = bits =>
        C.directions.flatMap(([ x, y ], d) => bits & (1 << d) ? [ [ (x + y) / 2, (y - x) / 2 ] ] : []);
    for (let bits = 0; bits < 256; bits++) {
        const full = fullCenters(bits);
        assert.equal(S.field(0, 0, full), 0, 'Ocean center filled');
        for (let q = 0; q < 4; q++) {
            const centers = M.coastCenters(q, maskFor(bits, q));
            for (let y = 0; y < 12; y++)
                for (let x = 0; x < 12; x++) {
                    const u = -.5 + (x + .5) / 24, v = -.5 + (y + .5) / 24;
                    const pos = [ [ u, v ], [ -v, u ], [ -u, -v ], [ v, -u ] ][q];
                    assert(Math.abs(S.field(...pos, centers) - S.field(...pos, full)) < 1e-9,
                           'Quarter depends on unavailable neighbors');
                    joins++;
                }
        }
        for (const c of full) {
            // A coastline must wrap the shared tile tip/edge, not cut through it.
            const tip = c.map(v => v * .5);
            assert(S.field(...tip, full) > .5, 'Exposed land corner');
            footprints++;
        }
    }
    for (const t of world.tiles) {
        if (!water(t))
            continue;
        let bits = 0;
        C.directions.forEach(([ dx, dy ], i) => {
            const n = get(t.x + dx, t.y + dy);
            if (!n || !water(n))
                bits |= 1 << i;
        });
        if (bits) {
            worldCoasts++;
            assert.equal(S.field(0, 0, fullCenters(bits)), 0);
        }
    }
    const coverage = [];
    for (const tw of [16, 24, 32, 40, 48, 56, 64, 96, 128, 256]) {
        const image = C.clear(tw, tw / 2);
        for (let q = 0; q < 4; q++) {
            const im = R.groundCoverage(
                await C.raw(C.path.join(C.pack, `compatibility/coast/${q}/0.png`), tw / 2, tw / 4));
            const off = [ [ .25, 0 ], [ .5, .125 ], [ .25, .25 ], [ 0, .125 ] ][q];
            C.blit(image, im, Math.round(off[0] * tw), Math.round(off[1] * tw));
        }
        let pixels = 0;
        for (let y = 0; y < image.height; y++)
            for (let x = 0; x < image.width; x++) {
                const inside = Math.abs((x + .5) * 2 / tw - 1) + Math.abs((y + .5) * 4 / tw - 1) < 1;
                assert.equal(image.data[(y * tw + x) * 4 + 3], inside ? 255 : 0,
                             `Ground seam at ${tw}/${x}/${y}`);
                if (inside)
                    pixels++;
            }
        coverage.push({physicalTileWidth : tw, opaquePixels : pixels});
    }
    const mouths = [];
    for (let q = 0; q < 4; q++) {
        const mouth = await C.raw(C.path.join(C.pack, `compatibility/mouth/${q}.png`)),
              river = await C.raw(C.path.join(C.pack, `compatibility/river/${1 << q}.png`)),
              e = C.art.riverUV(C.art.ends[1 + q * 2]);
        let preserved = 0, removed = 0;
        for (let y = 0; y < 256; y++)
            for (let x = 0; x < 512; x++) {
                const u = (y + .5 - 128) / 256 + (x + .5 - 256) / 512,
                      v = (y + .5 - 128) / 256 - (x + .5 - 256) / 512,
                      t = (u * e[0] + v * e[1]) / (e[0] ** 2 + e[1] ** 2), i = (y * 512 + x) * 4;
                if (t >= .68) {
                    assert.deepEqual(mouth.data.subarray(i, i + 4), river.data.subarray(i, i + 4));
                    if (river.data[i + 3])
                        preserved++;
                }
                if (t <= .15) {
                    assert.equal(mouth.data[i + 3], 0);
                    if (river.data[i + 3])
                        removed++;
                }
            }
        assert(preserved > 0 && removed > 0);
        mouths.push({direction : q, unchangedJoinPixels : preserved, fadedSeawardPixels : removed});
    }
    const sceneChecks = [];
    for (const scene of report.scenes) {
        const fixture = C.path.join(C.pack, scene.fixture), trace = C.engine('map', fixture),
              debug = C.engine('map', fixture, 'Debug'), original = A.nativeTrace(fixture);
        assert.deepEqual(debug, trace);
        assert.deepEqual(A.nativeTrace(fixture, 'Debug'), original);
        assert.equal(C.sha(Buffer.from(JSON.stringify(trace))), scene.traceSha256);
        assert.equal(C.sha(Buffer.from(JSON.stringify(original))), scene.originalTraceSha256);
        assert.equal(scene.coastCommands > 0, scene.tileWidth >= 48, 'Original detail cutoff');
        let tileCoverage = null;
        if (scene.fullWorld) {
            const tw = scene.tileWidth;
            const covered = new Set(
                trace.commands.filter(c => c.asset.startsWith('terrain/') || c.asset.startsWith('coast/0/'))
                    .map(c => (2 * (c.x - (c.asset.startsWith('coast/') ? tw / 4 : 0)) / tw + 1) + ',' +
                              (4 * c.y / tw + 1)));
            for (const t of world.tiles)
                assert(covered.has(t.x + ',' + t.y), 'Saved tile omitted from whole-world trace');
            tileCoverage = world.tiles.length;
        }
        const sizes = {};
        for (const stage of ['original', 'current', 'hd', 'proposed']) {
            const file = C.path.join(C.pack, scene[stage]), meta = await C.sharp(file).metadata(),
                  d = [ 'hd', 'proposed' ].includes(stage) ? 2 : 1;
            assert.equal(meta.width, scene.camera.cols * scene.tileWidth * d);
            assert.equal(meta.height, scene.camera.rows * scene.tileWidth * d / 4);
            sizes[stage] = {
                width : meta.width,
                height : meta.height,
                sha256 : C.sha(C.fs.readFileSync(file))
            };
        }
        sceneChecks.push({
            id : scene.id,
            fullWorld : !!scene.fullWorld,
            savedTilesRendered : tileCoverage,
            coastCommands : scene.coastCommands,
            images : sizes
        });
    }
    assert.equal(report.scenes.filter(s => s.fullWorld).length, 4);
    const html = C.fs.readFileSync(C.path.join(C.pack, 'review/coast-audit.html'), 'utf8');
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
        new Function(match[1]);
    for (const file of ['coast-islands-lakes.png', 'coast-forest-mouths.png', 'coast-contours.png',
                        'forest-borders.png'])
        assert(C.fs.existsSync(C.path.join(C.pack, 'review', file)));
    const results = {
        status : 'pass',
        save : report.counts,
        fullWorldZooms : [ 16, 32, 48, 64 ],
        closeZooms : [ 64, 128 ],
        nativeCoastNeighborhoods : 256,
        quarterFieldSamples : joins,
        protectedBoundaryPoints : footprints,
        savedOceanCoastTiles : worldCoasts,
        opaqueGroundCoverage : coverage,
        mouths,
        scenes : sceneChecks,
        limits :
            'Finite saved-map and exhaustive native 8-neighbor topology checks; visual inspection of the full-world overviews and named close scenes. Native 16/32px zooms intentionally retain source square tiles. No game source modified.'
    };
    C.json(C.path.join(C.pack, 'review/coast-audit-validation.json'), results);
    console.log(
        'PASS coastline survey',
        JSON.stringify({world : report.counts, joins, footprints, worldCoasts, scenes : sceneChecks.length}));
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1
});
