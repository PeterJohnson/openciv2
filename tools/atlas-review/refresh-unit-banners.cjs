const C = require('./common.cjs'), R = require('./render.cjs');

async function review() {
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const originals = C.read(C.path.join(C.pack, 'review/original-scenes/renders.json'));
    const sheet = C.clear(2048, 1152, [ 23, 35, 34, 255 ]);
    const examples = [
        [ 'saved-region', 'unit/37', 'Saved-game destroyer' ], [ 'district', 'unit/35', 'Frigate' ],
        [ 'district', 'unit/1', 'Engineers · linked stack' ]
    ];
    for (const [row, [ id, unit, title ]] of examples.entries()) {
        const s = scenes.find(s => s.id === id), trace = C.engine('objects', C.path.join(C.pack, s.fixture));
        const c = trace.commands.find(c => c.asset === unit);
        const left = Math.max(0, c.x - c.width / 4), top = Math.max(0, c.y - c.width / 8);
        const width = Math.min(c.width * 1.5, trace.width - left),
              height = Math.min(c.height * 1.4, trace.height - top);
        for (const [col, [ stage, label ]] of [[ 'original', 'Original game art' ],
                                               [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
                                               [ 'proposed', 'Enhanced' ]]
                 .entries()) {
            const d = [ 'original', 'current' ].includes(stage) ? 1 : 2;
            const file = stage === 'original' ? originals[id].original : s[stage];
            const crop =
                await C.sharp(C.path.join(C.pack, file))
                    .extract({
                        left : Math.round(left * d),
                        top : Math.round(top * d),
                        width : Math.round(width * d),
                        height : Math.round(height * d)
                    })
                    .resize(
                        496, 332,
                        {fit : 'contain', background : '#172322', kernel : d === 1 ? 'nearest' : 'lanczos3'})
                    .png()
                    .toBuffer();
            C.blit(sheet, await C.raw(crop), col * 512 + 8, row * 384 + 44);
            const heading =
                C.svg(512, 40,
                      `<text x="12" y="26" fill="#e5d6b5" font-family="sans-serif" font-size="18">${
                          title} · ${label}</text>`);
            C.blit(sheet, await C.raw(Buffer.from(heading)), col * 512, row * 384);
        }
    }
    C.write(C.path.join(C.pack, 'review/unit-banners.png'), await C.png(sheet));
}

async function main() {
    if (!process.argv.includes('--review-only')) {
        const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
        const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
        await C.art.loadMaterials(C.path.join(C.pack, 'map'));
        for (const s of scenes.filter(s => s.mode === 'map')) {
            const trace = C.engine('map', C.path.join(C.pack, s.fixture));
            C.json(C.path.join(C.pack, `review/traces/${s.id}.json`), trace);
            if (!trace.commands.some(c => c.asset === 'shield'))
                continue;
            const world =
                C.read(C.path.join(C.pack, `review/fixtures/${s.saveBased ? 'saved-world' : 'world'}.json`));
            for (const stage of ['current', 'hd', ...(s.tileWidth >= 48 ? [ 'proposed' ] : [])]) {
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
            console.log('Updated unit banners:', s.id);
        }
    }
    await review();
}

if (require.main === module)
    main().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {review};
