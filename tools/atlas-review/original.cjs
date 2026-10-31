// Fourth review stage: composed original-art scenes from local inputs and the same native fixtures.
// Deliberately absent from the replacement-art manifest and compatibility bank.
const C = require('./common.cjs');
const R = require('./render.cjs');
const W = require('./windows.cjs');
const E = require('./economy.cjs');
const {spawnSync} = require('node:child_process');
const local = 'review/original-local/';
const rendered = 'review/original-scenes/';
const meta = C.read(C.path.join(C.pack, local, 'bindings.json'));
const bindings = meta.bindings;
const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
const used = new Set();

function file(name) {
    const b = bindings[name];
    if (!b)
        throw Error('Missing original binding: ' + name);
    used.add(name);
    return b.file;
}

function nativeTrace(id) {
    return C.read(C.path.join(C.pack, local, 'traces', id + '.json'));
}

// Bind the shared native-content backend to original icons/backdrops. No generated
// artwork fallback: every image request must resolve to an original binding.
const aliases = new Map();
for (const role of E.roles)
    aliases.set(E.file(role), 'economy/' + role);
for (const e of C.entries) {
    if (e.mapping?.kind === 'unit')
        aliases.set(e.file, 'unit/' + e.mapping.index);
}
const buildingFiles =
    [ 'palace', 'barracks', 'granary', 'temple', 'marketplace', 'library', 'courthouse', 'city-walls' ];
buildingFiles.forEach((id, i) => aliases.set('sprites/buildings/' + id + '.png', 'icon/' + (201 + i)));
aliases.set('backgrounds/parchment-native.png', 'city-background');

class OriginalPainter extends W.Painter {
    constructor(w, h, city = false) {
        super(w, h, 1);
        this.city = city;
    }

    async image(input, x, y, w, h, options = {}) {
        const original = aliases.has(input) ? file(aliases.get(input)) : input;
        if (!original.startsWith(local))
            throw Error('Non-original art request: ' + input);
        const binding = Object.keys(bindings).find(k => bindings[k].file === original);
        if (!binding)
            throw Error('Unregistered original art: ' + input);
        used.add(binding);
        this.ops.push({file : original, x, y, width : w, height : h});
        const p = await C.raw(C.path.join(C.pack, original), w, h, 'nearest');
        if (options.silhouette) {
            for (let i = 0; i < p.data.length; i += 4) {
                // Source shaded citizen pass is a dark silhouette behind its regular sprite.
                p.data[i] = p.data[i + 1] = p.data[i + 2] = 0;
            }
        }
        C.blit(this.dst, p, x, y);
    }

    async text() {
        throw Error('Original native text must use the reference glyph backend');
    }
}

async function windowScene(s) {
    const trace = C.read(C.path.join(C.pack, `review/traces/${s.id}.json`));
    const p = new OriginalPainter(trace.width, trace.height, s.mode === 'city-window');
    return require('./native-windows.cjs')
        .render(trace, s, p, {
            painter : p,
            bindings,
            palette : meta.windowPalettes[s.mode === 'city-window' ? 'city'
                                          : s.mode === 'spaceship' ? 'spaceship'
                                                                   : 'diplomacy']
        },
                W.resourceMap);
}

async function mapOrView(s, id = s.id) {
    const trace = nativeTrace(id);
    for (const c of trace.commands) {
        if (!['clear', 'replace', 'rect', 'frame', 'text'].includes(c.asset) && c.width > 0 && c.height > 0)
            file(c.asset);
    }
    return R.baseline(trace, s, bindings, {
        palette : n => meta.palette[String(n & 255)],
        background : trace.originalBackground ? C.path.join(C.pack, file('background/' + id)) : null
    });
}

async function transport() {
    const plate = C.clear(2560, 640, [ 23, 35, 34, 255 ]);
    const labels = [ 'Isolated', 'Connected pair', 'Bend', 'Crossing', 'Mixed road / rail' ];
    for (let row = 0; row < 2; row++)
        for (let col = 0; col < 5; col++) {
            const png = await mapOrView({mode : 'map'}, `transport-${row}-${col}`);
            const title = await C.raw(Buffer.from(
                C.svg(512, 64,
                      `<text x="20" y="41" fill="#e1d5b6" font-family="sans-serif" font-size="25">${
                          row ? 'Rail' : 'Road'} · ${labels[col]}</text>`)));
            C.blit(plate, title, col * 512, row * 320);
            C.blit(plate, await C.raw(png, 512, 256, 'nearest'), col * 512, row * 320 + 64);
        }
    return C.png(plate);
}

async function main() {
    const records = {}, plans = {};
    for (const s of scenes) {
        const result = s.windowEngine
                           ? await windowScene(s)
                           : {buffer : s.mode === 'plate' ? await transport() : await mapOrView(s)};
        const name = rendered + `images/${s.id}.png`;
        C.write(C.path.join(C.pack, name), result.buffer);
        const m = await C.sharp(result.buffer).metadata();
        if (m.width !== s.currentSize[0] || m.height !== s.currentSize[1])
            throw Error('Original comparison geometry: ' + s.id);
        records[s.id] = {
            original : name,
            originalSize : [ m.width, m.height ],
            sha256 : C.sha(result.buffer)
        };
        if (result.ops)
            plans[s.id] = result.ops;
        if (s.exports4k) {
            const file = rendered + `4k/${s.id}.png`;
            C.write(C.path.join(C.pack, file),
                    await C.sharp(result.buffer)
                        .resize(3840, 2160, {fit : 'contain', kernel : 'nearest', background : '#101c1c'})
                        .png()
                        .toBuffer());
            records[s.id].export4k = file;
            records[s.id].export4kSha256 = C.sha(C.fs.readFileSync(C.path.join(C.pack, file)));
        }
        console.log(s.id, m.width + 'x' + m.height);
    }
    for (const [name, b] of Object.entries(bindings)) {
        if (C.sha(C.fs.readFileSync(C.path.join(C.pack, b.file))) !== b.sha256)
            throw Error('Original binding hash: ' + name);
    }
    // Original map/city/throne D/R parity, including sheet registration offsets.
    let parity = 0;
    for (const name of C.fs.readdirSync(C.path.join(C.pack, local, 'traces'))) {
        const id = name.replace(/\.json$/, ''), trace = nativeTrace(id);
        const r = spawnSync(C.path.join(C.root, 'build/atlas-review/Debug/atlas-engine.exe'),
                            [
                                trace.mode, C.path.join(C.pack, 'review/fixtures', id + '.txt'),
                                C.path.join(C.pack, local, 'anchors.txt')
                            ],
                            {encoding : 'utf8', maxBuffer : 64 * 1024 * 1024});
        if (r.status !== 0 || JSON.stringify(JSON.parse(r.stdout)) !== JSON.stringify(trace))
            throw Error('Original Debug/Release mismatch: ' + id + ' ' + r.stderr);
        parity++;
    }
    C.json(C.path.join(C.pack, local, 'window-draw-plans.json'), plans);
    C.json(C.path.join(C.pack, local, 'verification.json'), {
        scenes : Object.keys(records).length,
        exports4k : Object.values(records).filter(r => r.export4k).length,
        originalBindingsUsed : used.size,
        bindingsHashed : Object.keys(bindings).length,
        nativeDebugReleaseTraces : parity,
        sourceHashes : meta.sources
    });
    C.json(C.path.join(C.pack, rendered, 'renders.json'), records);
    C.write(C.path.join(C.pack, rendered, 'data.js'),
            'window.ATLAS_ORIGINAL_REVIEW=' + JSON.stringify(records) + ';\n');
    console.log('Verified', Object.keys(records).length, 'original scenes;', parity, 'native D/R traces;',
                used.size, 'original bindings used.');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
