// Refresh native/current and HD-only comparisons without touching enhanced images.
const C = require('./common.cjs');
const R = require('./render.cjs');
const W = require('./windows.cjs');
const Native = require('./native-windows.cjs');

async function main() {
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json'));
    for (const s of scenes.filter(s => s.fixture)) {
        const engine = s.windowEngine ? W.windowEngine : C.engine;
        const trace = engine(s.mode, C.path.join(C.pack, s.fixture));
        C.json(C.path.join(C.pack, `review/traces/${s.id}.json`), trace);
        for (const stage of ['current', 'hd']) {
            const density = stage === 'current' ? 1 : 2;
            let buffer;
            if (s.windowEngine) {
                const result = await Native.render(
                    trace, s, new W.Painter(trace.width, trace.height, density), null, W.resourceMap);
                buffer = result.buffer;
                plans[s.id + '-' + stage] = result.ops;
            } else {
                buffer = await R.baseline(trace, s, bindings, {density, native : stage === 'current'});
            }
            C.write(C.path.join(C.pack, s[stage]), buffer);
            s[stage + 'Size'] = [ trace.width * density, trace.height * density ];
            if (s.exports4k) {
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
        }
        s.commandCount = trace.commands.length;
        console.log('Native + HD:', s.id);
    }
    C.json(C.path.join(C.pack, 'review/window-draw-plans.json'), plans);
    C.json(C.path.join(C.pack, 'review/scenes.json'), scenes);
    for (const [source, destination] of [[ 'extraction.json', 'engine-extraction.json' ],
                                         [ 'window-extraction.json', 'window-extraction.json' ]]) {
        C.fs.copyFileSync(C.path.join(C.root, 'build/atlas-review/generated', source),
                          C.path.join(C.pack, 'review', destination));
    }
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
