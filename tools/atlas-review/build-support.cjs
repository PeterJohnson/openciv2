const C = require('./common.cjs');
const F = require('./fixtures.cjs');
const R = require('./render.cjs');

async function supportingIndex() {
    const records = [];
    for (const dir of ['map/lod', 'map/variations/mips'])
        for (const name of C.fs.readdirSync(C.path.join(C.pack, dir)).sort()) {
            if (!name.endsWith('.png'))
                continue;
            const file = dir + '/' + name, bytes = C.fs.readFileSync(C.path.join(C.pack, file)),
                  meta = await C.sharp(bytes).metadata();
            records.push({file, width : meta.width, height : meta.height, sha256 : C.sha(bytes)});
        }
    C.json(C.path.join(C.pack, 'supporting.json'),
           {description : 'Overview icons and prebaked material mip levels', entries : records});
    C.json(C.path.join(C.pack, 'review/toolchain.json'), {
        node : process.version,
        platform : process.platform,
        arch : process.arch,
        sharp : C.sharp.versions,
        renderer : 'MSVC x86; Debug /Od /RTC1 /MDd and Release /O2 /MD'
    });
}

async function main() {
    await supportingIndex();
    if (process.argv.includes('--index-only'))
        return;
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'))
                       .filter(s => !['transport', 'repetition'].includes(s.id));
    const cases = [
        [ 'Isolated', 0 ], [ 'Connected pair', 1 ], [ 'Bend', 5 ], [ 'Crossing', 170 ],
        [ 'Mixed road / rail', 85 ]
    ];
    const plates = Object.fromEntries(
        [ 'current', 'hd', 'proposed' ].map(k => [k, C.clear(2560, 640, [ 23, 35, 34, 255 ])]));
    for (let row = 0; row < 2; row++)
        for (let col = 0; col < cases.length; col++) {
            const [label, mask] = cases[col], w = F.world(16, 16);
            for (const t of w.tiles)
                t.t = 2;
            F.set(w, 6, 6, {f : row ? 48 : 16});
            C.directions.forEach(([ dx, dy ], i) => {
                if (mask & (1 << i))
                    F.set(w, 6 + dx, 6 + dy, {f : col === 4 ? (i % 4 === 0 ? 16 : 48) : row ? 48 : 16});
            });
            const scene = {
                mode : 'map',
                camera : {ox : 2, oy : 2, cols : 4, rows : 8, zoom : 0},
                tileWidth : 64
            };
            const file = C.path.join(C.pack, `review/fixtures/transport-${row}-${col}.txt`);
            scene.fixture = `review/fixtures/transport-${row}-${col}.txt`;
            C.write(file, F.serialize(w, scene.camera));
            const trace = C.engine('map', file);
            C.json(C.path.join(C.pack, `review/traces/transport-${row}-${col}.json`), trace);
            const outputs = {
                current : await R.baseline(trace, scene, bindings),
                hd : await R.baseline(trace, scene, bindings, {density : 2, native : false}),
                proposed : await R.proposedMap(w, scene, trace, bindings)
            };
            const labelPNG = await C.raw(Buffer.from(
                C.svg(512, 64,
                      `<text x="20" y="41" fill="#e1d5b6" font-family="sans-serif" font-size="25">${
                          row ? 'Rail' : 'Road'} · ${label}</text>`)));
            for (const k of Object.keys(plates)) {
                C.blit(plates[k], labelPNG, col * 512, row * 320);
                C.blit(plates[k], await C.raw(outputs[k], 512, 256, k === 'current' ? 'nearest' : 'lanczos3'),
                       col * 512, row * 320 + 64);
            }
        }
    const transport = {
        id : 'transport',
        title : 'Transport · isolated, pair, bend, crossing and mixed networks',
        mode : 'plate'
    };
    for (const [k, v] of Object.entries(plates)) {
        transport[k] = `review/images/transport-${k}.png`;
        transport[k + 'Size'] = [ v.width, v.height ];
        C.write(C.path.join(C.pack, transport[k]), await C.png(v));
    }
    scenes.splice(2, 0, transport);
    const w = F.world(40, 40);
    for (const t of w.tiles)
        t.t = 2;
    const s = {
        id : 'repetition',
        title : 'Terrain repetition · fixed tiles to stable world variation',
        mode : 'map',
        camera : {ox : 2, oy : 2, cols : 8, rows : 16, zoom : 8},
        tileWidth : 128,
        fixture : 'review/fixtures/repetition.txt'
    };
    C.write(C.path.join(C.pack, s.fixture), F.serialize(w, s.camera));
    const trace = C.engine('map', C.path.join(C.pack, s.fixture));
    C.json(C.path.join(C.pack, 'review/traces/repetition.json'), trace);
    const outputs = {
        current : await R.baseline(trace, s, bindings),
        hd : await R.baseline(trace, s, bindings, {density : 2, native : false}),
        proposed : await R.proposedMap(w, s, trace, bindings)
    };
    for (const [k, b] of Object.entries(outputs)) {
        s[k] = `review/images/repetition-${k}.png`;
        const m = await C.sharp(b).metadata();
        s[k + 'Size'] = [ m.width, m.height ];
        C.write(C.path.join(C.pack, s[k]), b);
    }
    scenes.splice(4, 0, s);
    // 4K review boards preserve aspect ratio. Upsampling is explicitly labelled in the page/docs.
    for (const id of ['close', 'coast', 'city-coastal', 'throne-complete']) {
        const s = scenes.find(s => s.id === id);
        s.exports4k = {};
        for (const k of ['current', 'hd', 'proposed']) {
            const out = `review/4k/${id}-${k}.png`;
            const b = await C.sharp(C.path.join(C.pack, s[k]))
                          .resize(3840, 2160, {
                              fit : 'contain',
                              background : '#152322',
                              kernel : k === 'current' ? 'nearest' : 'lanczos3'
                          })
                          .png()
                          .toBuffer();
            C.write(C.path.join(C.pack, out), b);
            s.exports4k[k] = out;
        }
    }
    C.json(C.path.join(C.pack, 'review/scenes.json'), scenes);
    console.log('Transport, repetition and 12 4K review exports built');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
