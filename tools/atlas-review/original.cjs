// Fourth review stage: composed original-art scenes from local inputs and the same native fixtures.
// Deliberately absent from the replacement-art manifest and compatibility bank.
const C = require('./common.cjs');
const R = require('./render.cjs');
const W = require('./windows.cjs');
const E = require('./economy.cjs');
const Knowledge = require('./knowledge.cjs');
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

// Use the existing city panel adapter with original icons/backdrop. No generated
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
        if (options.opacity !== undefined && options.opacity < 1) {
            for (let i = 0; i < p.data.length; i += 4) {
                // Source shaded citizen pass is a dark silhouette behind its regular sprite.
                p.data[i] = p.data[i + 1] = p.data[i + 2] = 0;
                p.data[i + 3] = Math.round(p.data[i + 3] * options.opacity);
            }
        }
        C.blit(this.dst, p, x, y);
    }

    async box(x, y, w, h) {
        if (!this.city)
            await super.box(x, y, w, h, '#606060', '#b7b7a7', 0);
        // City begin_draw restores these exact regions from CITY.GIF; do not paint
        // replacement green panels over the original background.
    }

    async text(s, x, y, w, size = 12, color, align = 'start') {
        await super.text(s, x + 1, y + 1, w, size, '#101010', align);
        await super.text(s, x, y, w, size, '#f1e6ba', align);
    }

    async button(label, x, y, w, h = 25) {
        await super.box(x, y, w, h, '#909080', '#e0d9b2', 0);
        await this.text(label, x, y + 5, w, 11, null, 'middle');
    }
}

async function windowScene(s) {
    const trace = C.read(C.path.join(C.pack, `review/traces/${s.id}.json`));
    const p = new OriginalPainter(trace.width, trace.height, s.mode === 'city-window');
    if (s.mode === 'city-window')
        return W.city(trace, s, false, 1, {painter : p, bindings});
    await p.image(file(s.mode === 'spaceship' ? 'ship-background' : 'background/' + s.id), 0, 0, 640, 480);
    if (s.mode === 'diplomacy') {
        for (const [i, c] of trace.commands.entries()) {
            if (c.asset === 'resource')
                await p.image(file(`window/${s.id}/${i}`), c.x, c.y, c.width, c.height);
            else if (c.asset === 'tech-label')
                await p.text(Knowledge.advance(+c.text).name.slice(0, 8).toUpperCase(), c.x, c.y, c.width, 9);
        }
        await p.text('ASTERIAN ENVOY', 184, 16, 272, 17, null, 'middle');
        await p.text('COMMUNISM', 184, 337, 272, 13, null, 'middle');
        await p.text('MILITARY', 35, 108, 130, 12, null, 'middle');
        await p.text('KNOWLEDGE', 477, 108, 130, 12, null, 'middle');
    } else {
        // Native render_ship composites its ordered crops into a 457 x 304 DIB,
        // then copies that DIB to (175,99); clip at the offscreen bounds first.
        const layer = new OriginalPainter(457, 304);
        layer.dst = C.clear(457, 304);
        for (const [i, c] of trace.commands.entries()) {
            if (c.asset === 'resource' && c.target === -100)
                await layer.image(file(`window/${s.id}/${i}`), c.x, c.y, c.width, c.height);
        }
        C.blit(p.dst, layer.dst, 175, 99);
        p.ops.push(...layer.ops.map(o => ({...o, x : o.x + 175, y : o.y + 99})));
        await p.text('ASTERIAN STARSHIP', 12, 9, 616, 20, null, 'middle');
        const names = [ 'Structural', 'Propulsion', 'Fuel', 'Habitation', 'Life support', 'Solar' ];
        for (let i = 0; i < 6; i++) {
            await p.text(names[i], 12, 43 + i * 22, 141, 13);
            await p.text(String(s.counts[i]), 144, 43 + i * 22, 22, 13);
        }
        for (const [i, label] of [`Population: ${s.counts[3] * 10},000`, 'Support: 100%', 'Energy: 100%',
                                  'Mass: 19,600 t', 'Fuel: 100%', 'Flight: 15.0 years']
                 .entries())
            await p.text(label, 12, 194 + i * 22, 154, 11);
        await p.button('Close', 501, 417, 52, 36);
        await p.button(s.ready ? 'Launch' : 'Not ready', 559, 417, 67, 36);
        await p.text(s.ready ? 'Launch success: 100%' : 'Incomplete spacecraft', 3, 454, 634, 14, null,
                     'middle');
    }
    return {buffer : await p.finish(), ops : p.ops};
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
