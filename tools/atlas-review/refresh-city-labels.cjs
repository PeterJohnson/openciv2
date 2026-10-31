// Refresh map comparisons affected by city anchors and label placement only.
const C = require('./common.cjs'), R = require('./render.cjs');

async function main() {
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const plansFile = C.path.join(C.pack, 'review/city-label-layouts.json');
    const plans = C.fs.existsSync(plansFile) ? C.read(plansFile) : {};
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    for (const s of scenes.filter(s => s.mode === 'map' &&
                                       (!process.argv.includes('--saved-only') || s.saveBased))) {
        const trace = C.engine('map', C.path.join(C.pack, s.fixture));
        C.json(C.path.join(C.pack, `review/traces/${s.id}.json`), trace);
        const labels = await R.mapLabels(s);
        plans[s.id] = labels.plan;
        if (!trace.commands.some(c => c.asset.startsWith('city/')))
            continue;
        const w =
            C.read(C.path.join(C.pack, `review/fixtures/${s.saveBased ? 'saved-world' : 'world'}.json`));
        for (const stage of ['current', 'hd', 'proposed']) {
            const buffer =
                stage === 'proposed'
                    ? await R.proposedMap(w, s, trace, bindings)
                    : await R.baseline(trace, s, bindings,
                                       {density : stage === 'current' ? 1 : 2, native : stage === 'current'});
            C.write(C.path.join(C.pack, s[stage]), buffer);
            if (s.exports4k?.[stage])
                C.write(C.path.join(C.pack, s.exports4k[stage]),
                        await C.sharp(buffer)
                            .resize(3840, 2160, {
                                fit : 'contain',
                                background : '#152322',
                                kernel : stage === 'current' ? 'nearest' : 'lanczos3'
                            })
                            .png()
                            .toBuffer());
        }
        s.commandCount = trace.commands.length;
        console.log(s.id, labels.plan.items.filter(i => i.kind === 'city-size').length, 'size badges',
                    labels.plan.items.filter(i => i.dx || i.dy).length, 'labels repositioned');
    }
    C.json(C.path.join(C.pack, 'review/city-label-layouts.json'), plans);
    C.json(C.path.join(C.pack, 'review/scenes.json'), scenes);
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
