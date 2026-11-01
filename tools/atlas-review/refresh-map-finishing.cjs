const C = require('./common.cjs'), R = require('./render.cjs');

async function review() {
    const scene = C.read(C.path.join(C.pack, 'review/scenes.json')).find(s => s.id === 'saved-close');
    const original = C.read(C.path.join(C.pack, 'review/original-scenes/renders.json'))[scene.id];
    const sheet = C.clear(2048, 800, [ 23, 35, 34, 255 ]);
    const crops = [
        {title : 'Newcastle · desert cape and joined shore', left : 416, top : 24, width : 256, height : 160},
        {
            title : 'Carlisle · quieter terrain production markers',
            left : 760,
            top : 232,
            width : 256,
            height : 160
        }
    ];
    const stages = [
        [ 'original', 'Original' ], [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
        [ 'proposed', 'HD + cohesion' ]
    ];
    for (const [row, crop] of crops.entries()) {
        C.blit(sheet,
               await C.raw(Buffer.from(
                   C.svg(2048, 40,
                         `<text x="16" y="28" fill="#e5d6b5" font-family="sans-serif" font-size="22">${
                             crop.title}</text>`))),
               0, row * 400);
        for (const [col, [ stage, label ]] of stages.entries()) {
            const d = col < 2 ? 1 : 2;
            const file = stage === 'original' ? original.original : scene[stage];
            const bytes = await C.sharp(C.path.join(C.pack, file))
                              .extract({
                                  left : crop.left * d,
                                  top : crop.top * d,
                                  width : crop.width * d,
                                  height : crop.height * d
                              })
                              .resize(512, 320, {kernel : col < 2 ? 'nearest' : 'lanczos3'})
                              .png()
                              .toBuffer();
            C.blit(sheet, await C.raw(bytes), col * 512, row * 400 + 72);
            C.blit(sheet,
                   await C.raw(Buffer.from(
                       C.svg(512, 32,
                             `<text x="16" y="23" fill="#b7c6b5" font-family="sans-serif" font-size="18">${
                                 label}</text>`))),
                   col * 512, row * 400 + 40);
        }
    }
    C.write(C.path.join(C.pack, 'review/map-finishing.png'), await C.png(sheet));
}

async function main() {
    if (!process.argv.includes('--review-only')) {
        await C.art.loadMaterials(C.path.join(C.pack, 'map'));
        const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
        const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
        for (const scene of scenes.filter(s => s.mode === 'map')) {
            const trace = C.engine('map', C.path.join(C.pack, scene.fixture));
            const marker = trace.commands.some(c => c.asset === 'resource/shield');
            if (!marker && !trace.commands.some(c => c.asset.startsWith('coast/')))
                continue;
            const world = C.read(
                C.path.join(C.pack, `review/fixtures/${scene.saveBased ? 'saved-world' : 'world'}.json`));
            for (const stage
                     of ['current', 'hd', ...(marker && scene.tileWidth >= 64 ? [ 'proposed' ] : [])]) {
                const buffer =
                    stage === 'proposed'
                        ? await R.proposedMap(world, scene, trace, bindings)
                        : await R.baseline(
                              trace, scene, bindings,
                              {density : stage === 'current' ? 1 : 2, native : stage === 'current'});
                C.write(C.path.join(C.pack, scene[stage]), buffer);
                if (scene.exports4k?.[stage])
                    C.write(C.path.join(C.pack, scene.exports4k[stage]),
                            await C.sharp(buffer)
                                .resize(3840, 2160, {
                                    fit : 'contain',
                                    background : '#152322',
                                    kernel : stage === 'current' ? 'nearest' : 'lanczos3'
                                })
                                .png()
                                .toBuffer());
            }
            console.log('Coast/marker refresh:', scene.id);
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
