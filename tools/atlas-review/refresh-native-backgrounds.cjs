const C = require('./common.cjs'), BG = require('./native-backgrounds.cjs');
const W = require('./windows.cjs'), Native = require('./native-windows.cjs');

async function review() {
    const layout = C.read(C.path.join(C.pack, 'interface/native-backgrounds/layout.json'));
    const plate = C.clear(1920, 1560, [ 23, 35, 34, 255 ]);
    for (const [i, p] of layout.plates.entries()) {
        const x = i % 3 * 640, y = Math.floor(i / 3) * 520;
        C.blit(plate, await C.raw(C.path.join(C.pack, p.file), 640, 480), x, y + 40);
        C.blit(plate,
               await C.raw(Buffer.from(
                   C.svg(640, 40,
                         `<text x="14" y="28" fill="#e4d6b5" font-family="sans-serif" font-size="21">${
                             p.id.replaceAll('-', ' ')} · native background</text>`))),
               x, y);
    }
    C.write(C.path.join(C.pack, 'review/native-backgrounds.png'), await C.png(plate));
}

async function main() {
    if (!process.argv.includes('--render-only'))
        await BG.build();
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json'));
    for (const s of scenes.filter(s => s.windowEngine)) {
        const trace = W.windowEngine(s.mode, C.path.join(C.pack, s.fixture));
        for (const stage of ['current', 'hd']) {
            const density = stage === 'current' ? 1 : 2;
            const r = await Native.render(trace, s, new W.Painter(trace.width, trace.height, density), null,
                                          W.resourceMap);
            C.write(C.path.join(C.pack, s[stage]), r.buffer);
            plans[s.id + '-' + stage] = r.ops;
        }
        console.log('Native background refresh:', s.id);
    }
    C.json(C.path.join(C.pack, 'review/window-draw-plans.json'), plans);
    await review();
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
