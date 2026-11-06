const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./fixtures.cjs');
const W = require('./windows.cjs'), N = require('./native-windows.cjs');
const assert = require('node:assert/strict'), {spawnSync} = require('node:child_process');
const dir = 'review/unexplored-edges/';

async function main() {
    await require('./fog-edges.cjs').build();
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const original = C.read(C.path.join(C.pack, 'review/original-local/bindings.json'));
    const world = F.regionalWorld();
    world.width = world.height = 64;
    world.tiles = world.tiles.filter(t => t.x < 64 && t.y < 64);
    for (const t of world.tiles) {
        t.v = +(((t.x - 41) / 12) ** 2 + ((t.y - 41) / 10) ** 2 < 1);
        if ((t.x === 40 && t.y === 40) || (t.x === 44 && t.y === 44))
            t.v = 0;
        if ((t.x === 56 && t.y === 38) || (t.x === 29 && t.y === 31))
            t.v = 1;
    }
    const rows = [];
    for (const [zoom, tileWidth] of [[ 8, 128 ], [ 0, 64 ], [ -4, 32 ], [ -6, 16 ]]) {
        const s = {
            id : 'unexplored-' + tileWidth,
            mode : 'map',
            tileWidth,
            camera : {ox : 26, oy : 28, cols : 17, rows : 28, zoom, viewer : 1}
        };
        s.fixture = dir + s.id + '.txt';
        C.write(C.path.join(C.pack, s.fixture), F.serialize(world, s.camera));
        const trace = C.engine('map', C.path.join(C.pack, s.fixture));
        assert.deepEqual(trace, C.engine('map', C.path.join(C.pack, s.fixture), 'Debug'));
        C.json(C.path.join(C.pack, dir, s.id + '-trace.json'), trace);
        const run = spawnSync(C.path.join(C.root, 'build/atlas-review/Release/atlas-engine.exe'),
                              [
                                  'map', C.path.join(C.pack, s.fixture),
                                  C.path.join(C.pack, 'review/original-local/anchors.txt')
                              ],
                              {encoding : 'utf8', maxBuffer : 64 * 1024 * 1024});
        assert.equal(run.status, 0, run.stderr);
        const outputs = {
            original :
                await R.baseline(JSON.parse(run.stdout), s, original.bindings,
                                 {originalText : true, palette : n => original.palette[String(n & 255)]}),
            current : await R.baseline(trace, s, bindings),
            hd : await R.baseline(trace, s, bindings, {density : 2, native : false}),
            proposed : await R.proposedMap(world, s, trace, bindings)
        };
        for (const [stage, bytes] of Object.entries(outputs)) {
            s[stage] = (stage === 'original' ? 'review/original-scenes/unexplored-edges/' : dir) + s.id +
                       '-' + stage + '.png';
            C.write(C.path.join(C.pack, s[stage]), bytes);
        }
        s.fogQuarters = trace.commands.filter(c => /^fog\/[0-3]$/.test(c.asset)).length;
        s.hiddenTiles = trace.commands.filter(c => c.asset === 'fog/full').length;
        rows.push(s);
        console.log(s.id, s.fogQuarters, 'edge quarters,', s.hiddenTiles, 'hidden cells');
    }
    const plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json'));
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const updated = [];
    for (const s of scenes.filter(s => s.mode === 'city-window')) {
        const trace = C.read(C.path.join(C.pack, 'review/traces/' + s.id + '.json'));
        for (const [stage, density] of [[ 'current', 1 ], [ 'hd', 2 ]]) {
            const result = await N.render(trace, s, new W.Painter(trace.width, trace.height, density), null,
                                          W.resourceMap);
            assert.deepEqual(result.ops, plans[s.id + '-' + stage]);
            C.write(C.path.join(C.pack, s[stage]), result.buffer);
            updated.push(s[stage]);
        }
    }
    // Refresh any existing map fixtures that exercise directional visibility masks.
    for (const s of scenes.filter(s => s.mode === 'map' && s.fixture)) {
        const trace = C.read(C.path.join(C.pack, 'review/traces/' + s.id + '.json'));
        if (!trace.commands.some(c => /^(fog\/[0-3]|dither\/11\/[0-3])$/.test(c.asset)))
            continue;
        const w = C.read(C.path.join(
            C.pack, 'review/fixtures/' + (s.id.startsWith('saved-') ? 'saved-world' : 'world') + '.json'));
        C.write(C.path.join(C.pack, s.proposed), await R.proposedMap(w, s, trace, bindings));
        updated.push(s.proposed);
    }
    C.json(C.path.join(C.pack, dir, 'validation.json'), {
        status : 'pass',
        source : 'src/auto/mapview.cpp:1809',
        debugReleaseCases : rows.length,
        cityDrawPlansUnchanged : 4,
        updated,
        scenes : rows,
        note :
            'Source suppresses edge quarters at zoom <= -4. Unknown tiles stay opaque at every zoom. Originals are composed review scenes only.'
    });
    const stages = [
        [ 'original', 'Original artwork' ], [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
        [ 'proposed', 'HD + cohesion' ]
    ];
    C.write(
        C.path.join(C.pack, dir, 'index.html'),
        `<!doctype html><meta charset="utf-8"><title>Unexplored boundaries</title>
<style>body{margin:24px;background:#172322;color:#e1d5b6;font:16px system-ui}a{color:#c5dca6}section{margin:36px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0}img{width:100%;background:#0b1516}figcaption{padding:8px}p{max-width:1000px}</style>
<a href="../../index.html">Atlas HD review</a><h1>Unexplored boundaries</h1><p>Directional feathering replaces solid diamond notches. Each row uses the same visibility fixture and extracted source renderer at its stated zoom. The native and HD-only stages preserve source placement and zoom gates. Hidden pockets and isolated revealed land/sea cells exercise concave and convex joins. Original artwork appears only in these composed review scenes.</p><p>The game stops drawing boundary dithers at 32px tiles and below; the native and HD-only previews retain that cutoff. The city resource map uses the same four directional sprites.</p>
${
            rows.map(s => `<section><h2>${s.tileWidth}px logical tiles</h2><div class="grid">${
                         stages
                             .map(([ stage, label ]) => `<figure><figcaption>${label}</figcaption><a href="${
                                      C.path.posix.relative(dir, s[stage])}"><img src="${
                                      C.path.posix.relative(dir, s[stage])}"></a></figure>`)
                             .join('')}</div></section>`)
                .join('')}`);
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
