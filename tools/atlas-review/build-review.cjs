const C = require('./common.cjs');
const {buildFixtures} = require('./fixtures.cjs');
const {variationAssets, buildBindings} = require('./bindings.cjs');
const R = require('./render.cjs');

async function main() {
    await require('./forest-floor.cjs').build();
    const {w, scenes} = buildFixtures();
    const variation = await variationAssets();
    const traces = scenes.map(s => C.engine(s.mode, C.path.join(C.pack, s.fixture)));
    let bindings;
    if (process.argv.includes('--reuse-bindings'))
        bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    else
        bindings = await buildBindings(traces);
    await require('./terrain-blends.cjs').build();
    await R.supportingArt();
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    const records = [];
    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i], trace = traces[i], start = Date.now();
        C.json(C.path.join(C.pack, `review/traces/${scene.id}.json`), trace);
        const current = await R.baseline(trace, scene, bindings);
        const hd = await R.baseline(trace, scene, bindings, {density : 2, native : false});
        const proposed = scene.mode === 'map'    ? await R.proposedMap(w, scene, trace, bindings)
                         : scene.mode === 'city' ? await R.proposedCity(trace, scene, bindings)
                                                 : await R.proposedThrone(scene);
        const a = `review/images/${scene.id}-current.png`, b = `review/images/${scene.id}-proposed.png`,
              h = `review/images/${scene.id}-hd.png`;
        C.write(C.path.join(C.pack, a), current);
        C.write(C.path.join(C.pack, b), proposed);
        C.write(C.path.join(C.pack, h), hd);
        const ma = await C.sharp(current).metadata(), mb = await C.sharp(proposed).metadata();
        records.push({
            ...scene,
            current : a,
            hd : h,
            proposed : b,
            currentSize : [ ma.width, ma.height ],
            hdSize : [ ma.width * 2, ma.height * 2 ],
            proposedSize : [ mb.width, mb.height ],
            commandCount : trace.commands.length,
            buildMilliseconds : Date.now() - start
        });
        console.log(scene.id, trace.commands.length, 'commands', Date.now() - start, 'ms');
    }
    const m = C.read(C.path.join(C.pack, 'manifest.json'));
    m.entries = m.entries.filter(e => !e.id.startsWith('map.variations.')).concat(variation);
    for (const e of m.entries)
        if (e.source?.file?.startsWith('masters/')) {
            e.source.master = 'authoring/' + e.source.file;
            delete e.source.file;
        }
    C.json(C.path.join(C.pack, 'manifest.json'), m);
    C.json(C.path.join(C.pack, 'review/scenes.json'), records);
    C.fs.copyFileSync(C.path.join(C.root, 'build/atlas-review/generated/extraction.json'),
                      C.path.join(C.pack, 'review/engine-extraction.json'));
    console.log('Review built');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
