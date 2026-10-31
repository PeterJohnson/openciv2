// Real save data, one shared camera/state per three-stage comparison.
const C = require('./common.cjs');
const F = require('./fixtures.cjs');
const R = require('./render.cjs');

function camera(w, cols, rows, zoom, coastal = false) {
    let best;
    for (let oy = 2; oy <= w.height - rows - 2; oy += 2) {
        for (let ox = 2; ox <= w.width - 2 * cols - 2; ox += 2) {
            const cells = w.tiles.filter(t => t.x >= ox + 2 && t.x < ox + cols * 2 - 2 && t.y >= oy + 2 &&
                                              t.y < oy + rows - 2);
            const n = f => cells.filter(f).length;
            const cityCount = n(t => t.c >= 0), water = n(t => (t.t & 15) === 10);
            if (cityCount < 2 || water < 10 || water > cells.length * .65)
                continue;
            const score = cityCount * 18 + Math.min(12, n(t => t.u >= 0)) * 3 +
                          Math.min(10, n(t => t.r)) * 5 + new Set(cells.map(t => t.t & 15)).size * 14 +
                          Math.min(30, n(t => t.f & 32)) + Math.min(20, n(t => (t.f & 12) === 8)) * 2 +
                          Math.min(30, n(t => t.f & 4)) + (coastal ? Math.min(70, water) : 0);
            if (!best || score > best.score)
                best = {ox, oy, cols, rows, zoom, viewer : -1, score};
        }
    }
    if (!best)
        throw Error('No sufficiently varied saved-game camera');
    delete best.score;
    return best;
}

async function build() {
    const w = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json'));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    const definitions = [
        {
            id : 'saved-close',
            title : '1788 save · cities, resources and developed landscape',
            camera : camera(w, 12, 22, 8),
            tileWidth : 128
        },
        {
            id : 'saved-region',
            title : '1788 save · regional settlement and transport',
            camera : camera(w, 22, 36, 0, true),
            tileWidth : 64
        },
        {
            id : 'saved-world',
            title : '1788 save · complete 150 × 120 world',
            camera : {ox : 0, oy : 0, cols : 75, rows : 120, zoom : -6, viewer : -1},
            tileWidth : 16
        }
    ];
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json')).filter(s => !s.saveBased);
    for (const scene of definitions) {
        scene.mode = 'map';
        scene.saveBased = true;
        scene.fixture = `review/fixtures/${scene.id}.txt`;
        scene.note =
            `Real save he_a1788.sav · 1788 · 9,000 cells, 69 cities, 223 live units (290 allocated records). All-map art review: fog disabled in all stages. Terrain, resources, improvements and object state come from the save; replacement stages use no original images.`;
        C.write(C.path.join(C.pack, scene.fixture), F.serialize(w, scene.camera));
        const trace = C.engine('map', C.path.join(C.pack, scene.fixture));
        C.json(C.path.join(C.pack, `review/traces/${scene.id}.json`), trace);
        for (const stage of ['current', 'hd', 'proposed']) {
            const b =
                stage === 'proposed'
                    ? await R.proposedMap(w, scene, trace, bindings)
                    : await R.baseline(trace, scene, bindings,
                                       {density : stage === 'current' ? 1 : 2, native : stage === 'current'});
            scene[stage] = `review/images/${scene.id}-${stage}.png`;
            C.write(C.path.join(C.pack, scene[stage]), b);
            const m = await C.sharp(b).metadata();
            scene[stage + 'Size'] = [ m.width, m.height ];
        }
        scene.commandCount = trace.commands.length;
        scenes.push(scene);
        console.log(scene.id, JSON.stringify(scene.camera), trace.commands.length, 'commands');
    }
    // Real gameplay is the default; the designed topology stress cases remain available.
    scenes.sort((a, b) => Number(!!b.saveBased) - Number(!!a.saveBased));
    C.json(C.path.join(C.pack, 'review/scenes.json'), scenes);
    C.fs.copyFileSync(C.path.join(C.root, 'build/atlas-review/generated/extraction.json'),
                      C.path.join(C.pack, 'review/engine-extraction.json'));
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    build,
    camera
};
