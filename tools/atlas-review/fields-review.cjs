// Rebuild field-dependent map previews and the four-stage Carlisle/Gloucester comparison.
const C = require('./common.cjs'), R = require('./render.cjs'), B = require('./bindings.cjs');

async function comparison() {
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const s = scenes.find(s => s.id === 'saved-close');
    const original = C.read(C.path.join(C.pack, 'review/original-scenes/renders.json'))[s.id];
    const canvas = C.clear(2048, 960, [ 23, 35, 34, 255 ]);
    const stages = [
        [ 'original', 'Original artwork · 2×' ], [ 'current', 'Replacement native · 2×' ],
        [ 'hd', 'HD only' ], [ 'proposed', 'HD + cohesion' ]
    ];
    const names = [
        'Carlisle · source selects neighboring irrigation beneath the city',
        'Gloucester · source selects no fields beneath the city'
    ];
    for (let row = 0; row < 2; row++) {
        const top = row * 480;
        C.blit(canvas,
               await C.raw(Buffer.from(
                   C.svg(2048, 48,
                         `<text x="20" y="31" fill="#e5d6b5" font-family="sans-serif" font-size="23">${
                             names[row]}</text>`))),
               0, top);
        for (let col = 0; col < stages.length; col++) {
            const [stage, title] = stages[col], density = col < 2 ? 1 : 2;
            const file = stage === 'original' ? original.original : s[stage];
            const crop = {
                left : (row ? 704 : 832) * density,
                top : (row ? 512 : 256) * density,
                width : 256 * density,
                height : 192 * density
            };
            const input = await C.sharp(C.path.join(C.pack, file))
                              .extract(crop)
                              .resize(512, 384, {kernel : col < 2 ? 'nearest' : 'lanczos3'})
                              .png()
                              .toBuffer();
            C.blit(canvas, await C.raw(input), col * 512, top + 88);
            C.blit(canvas,
                   await C.raw(Buffer.from(
                       C.svg(512, 40,
                             `<text x="16" y="27" fill="#c2cfca" font-family="sans-serif" font-size="20">${
                                 title}</text>`))),
                   col * 512, top + 48);
        }
    }
    C.write(C.path.join(C.pack, 'review/irrigation-cities.png'), await C.png(canvas));
}

async function main() {
    for (const name of ['irrigation', 'farmland'])
        C.write(C.path.join(C.pack, `compatibility/improvement/${name}.png`), await B.fieldBitmap(name));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    if (!process.argv.includes('--review-only'))
        for (const s of scenes.filter(s => s.mode === 'map' &&
                                           (!process.argv.includes('--skip-saved') || !s.saveBased))) {
            const trace = C.engine('map', C.path.join(C.pack, s.fixture));
            if (!R.fieldCommands(trace, s.tileWidth).length)
                continue;
            const world =
                C.read(C.path.join(C.pack, `review/fixtures/${s.saveBased ? 'saved-world' : 'world'}.json`));
            for (const stage of ['current', 'hd', 'proposed']) {
                const buffer =
                    stage === 'proposed'
                        ? await R.proposedMap(world, s, trace, bindings)
                        : await R.baseline(
                              trace, s, bindings,
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
            console.log('Fields refreshed:', s.id);
        }
    await comparison();
    console.log('Carlisle/Gloucester comparison built from four composed scenes.');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
