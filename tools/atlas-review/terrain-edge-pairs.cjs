// A small source-rendered terrain matrix exposes edges without city/road clutter.
const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./fixtures.cjs');
const A = require('./coast-audit.cjs'), assert = require('node:assert/strict');

async function main() {
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const original = C.read(C.path.join(C.pack, 'review/original-local/bindings.json'));
    const stages = [
        [ 'original', 'Original' ], [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
        [ 'proposed', 'HD + cohesion' ]
    ];
    const out = C.clear(2048, 1280, [ 23, 35, 34, 255 ]), cases = [];
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    for (const [row, [ a, b ]] of [[ 2, 0 ], [ 2, 8 ], [ 6, 7 ], [ 1, 4 ]].entries()) {
        const world = F.world(16, 16);
        for (const t of world.tiles) {
            t.t = (t.x + t.y) / 2 < 8 ? a : b;
            t.f = t.k = 0;
            t.v = 1;
        }
        const scene = {
            mode : 'map',
            tileWidth : 128,
            camera : {ox : 4, oy : 4, cols : 4, rows : 8, zoom : 8, viewer : -1}
        };
        const fixture = 'review/fixtures/terrain-edge-pairs/' + a + '-' + b + '.txt';
        scene.fixture = fixture;
        C.write(C.path.join(C.pack, fixture), F.serialize(world, scene.camera));
        const trace = C.engine('map', C.path.join(C.pack, fixture));
        assert.deepEqual(trace, C.engine('map', C.path.join(C.pack, fixture), 'Debug'));
        const originalTrace = A.nativeTrace(C.path.join(C.pack, fixture));
        assert.deepEqual(originalTrace, A.nativeTrace(C.path.join(C.pack, fixture), 'Debug'));
        const title = C.terrainNames[a] + ' / ' + C.terrainNames[b];
        C.blit(out,
               await C.raw(Buffer.from(C.svg(2048, 32,
                                             '<text x="12" y="24" fill="#e5d6b5" font-size="20">' + title +
                                                 ' — 128px tiles</text>'))),
               0, row * 320);
        const images = {};
        for (const [col, [ stage, label ]] of stages.entries()) {
            const bytes =
                stage === 'original'
                    ? await R.baseline(
                          originalTrace, scene, original.bindings,
                          {originalText : true, palette : n => original.palette[String(n & 255)]})
                : stage === 'proposed'
                    ? await R.proposedMap(world, scene, trace, bindings)
                    : await R.baseline(trace, scene, bindings,
                                       {density : stage === 'current' ? 1 : 2, native : stage === 'current'});
            C.blit(out,
                   await C.raw(Buffer.from(C.svg(
                       512, 30, '<text x="12" y="22" fill="#b7c6b5" font-size="18">' + label + '</text>'))),
                   col * 512, row * 320 + 32);
            C.blit(out, await C.raw(bytes, 512, 256, col < 2 ? 'nearest' : 'lanczos3'), col * 512,
                   row * 320 + 64);
            images[stage] = C.sha(bytes);
        }
        cases.push({
            title,
            fixture,
            traceSha256 : C.sha(Buffer.from(JSON.stringify(trace))),
            originalTraceSha256 : C.sha(Buffer.from(JSON.stringify(originalTrace))),
            images
        });
        console.log('Native edge pair', title);
    }
    const bytes = await C.png(out);
    C.write(C.path.join(C.pack, 'review/native-land-edges.png'), bytes);
    C.json(C.path.join(C.pack, 'review/native-land-edges.json'), {
        status : 'pass',
        cases,
        sha256 : C.sha(bytes),
        scope :
            'Four supplied-state terrain pairs rendered from unchanged Debug/Release source traces. Original artwork appears only in this composed review sheet; native and HD use existing quarter slots. Enhanced rendering remains separate.'
    });
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1
});
