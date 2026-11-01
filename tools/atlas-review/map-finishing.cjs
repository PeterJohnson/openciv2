// Native coast finishing and a quiet terrain-only production marker.
const C = require('./common.cjs');
const markerFile = 'map/markers/grassland-production.png';
const markerVector = 'map/markers/grassland-production.svg';
const smooth = (a, b, n) => {
    const t = Math.max(0, Math.min(1, (n - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

const Shore = require('./shoreline.cjs');

function coastCenters(q, mask) {
    return [ (q * 2 + 6) % 8, (q * 2 + 7) % 8, q * 2 ].flatMap((d, i) => {
        if (!(mask & (1 << i)))
            return [];
        const [x, y] = C.directions[d];
        return [ [ (x + y) / 2, (y - x) / 2 ] ];
    });
}

async function coastQuarter(q, mask) {
    const out = C.clear(256, 128), offset = [ [ 128, 0 ], [ 256, 64 ], [ 128, 128 ], [ 0, 64 ] ][q];
    const centers = coastCenters(q, mask),
          land = Array.from({length : 4}, () => ({land : 1, material : 'grassland'}));
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 256; x++) {
            const a = (y + .5) / 128 + (x + .5 - 128) / 256, b = (y + .5) / 128 - (x + .5 - 128) / 256;
            if (a < 0 || a >= 1 || b < 0 || b >= 1)
                continue;
            const u = (y + .5 + offset[1] - 128) / 256 + (x + .5 + offset[0] - 256) / 512;
            const v = (y + .5 + offset[1] - 128) / 256 - (x + .5 + offset[0] - 256) / 512;
            const rgb = C.art.surface(u + .5, v + .5, land, 'sand', [], 128,
                                      {field : Shore.field(u, v, centers), periodic : true});
            out.data.set([...rgb, 255 ], (y * 256 + x) * 4);
        }
    return C.png(out);
}

async function oceanTile() {
    const out = C.clear(512, 256), water = Array.from({length : 4}, () => ({land : 0}));
    for (let y = 0; y < 256; y++)
        for (let x = 0; x < 512; x++) {
            const u = (y + .5) / 256 + (x + .5 - 256) / 512, v = (y + .5) / 256 - (x + .5 - 256) / 512;
            if (u < 0 || u >= 1 || v < 0 || v >= 1)
                continue;
            out.data.set([...C.art.surface(u, v, water, 'sand', [], 128, {periodic : true}), 255 ],
                         (y * 512 + x) * 4);
        }
    return C.png(out);
}

async function mouth(q, bytes) {
    const out = await C.raw(bytes), end = C.art.riverUV(C.art.ends[1 + q * 2]);
    for (let y = 0; y < out.height; y++)
        for (let x = 0; x < out.width; x++) {
            const u = (y + .5 - 128) / 256 + (x + .5 - 256) / 512,
                  v = (y + .5 - 128) / 256 - (x + .5 - 256) / 512;
            const t = (u * end[0] + v * end[1]) / (end[0] ** 2 + end[1] ** 2);
            const i = (y * out.width + x) * 4 + 3;
            out.data[i] = Math.round(out.data[i] * smooth(.28, .68, t));
        }
    return C.png(out);
}

function markerSource() {
    return C.svg(
        64, 64,
        '<path d="M10 8L32 4L54 8V31Q52 48 32 60Q12 48 10 31Z" fill="#898a63" stroke="#4b553b" stroke-width="3"/>' +
            '<path d="M17 14L32 11L47 14V30Q45 42 32 51Q19 42 17 30Z" fill="#a6a17c"/>' +
            '<path d="M32 12V51Q45 42 47 30V14Z" fill="#747d55"/>');
}

async function buildMarker() {
    const source = markerSource(),
          bytes = await C.sharp(Buffer.from(source)).resize(256, 256).png().toBuffer();
    C.write(C.path.join(C.pack, markerVector), source);
    C.write(C.path.join(C.pack, markerFile), bytes);
    const manifest = C.read(C.path.join(C.pack, 'manifest.json'));
    manifest.entries = manifest.entries.filter(e => e.id !== 'map.markers.grassland-production');
    manifest.entries.push({
        id : 'map.markers.grassland-production',
        label : 'Grassland production marker',
        kind : 'map',
        category : 'map / markers',
        file : markerFile,
        vector : markerVector,
        description :
            'Muted olive and bronze terrain shield; reduced on-map footprint. City economy symbols remain blue.',
        width : 256,
        height : 256,
        sha256 : C.sha(bytes),
        sourceSha256 : C.sha(Buffer.from(source))
    });
    C.json(C.path.join(C.pack, 'manifest.json'), manifest);
}

async function build() {
    await buildMarker();
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    C.art.setVariations(false);
    for (let q = 0; q < 4; q++)
        for (let mask = 0; mask < 8; mask++)
            C.write(C.path.join(C.pack, `compatibility/coast/${q}/${mask}.png`), await coastQuarter(q, mask));
    C.write(C.path.join(C.pack, 'compatibility/terrain/10.png'), await oceanTile());
    for (let q = 0; q < 4; q++)
        C.write(C.path.join(C.pack, `compatibility/mouth/${q}.png`),
                await mouth(q, C.fs.readFileSync(C.path.join(C.pack, `compatibility/river/${1 << q}.png`))));
    const input = await C.sharp(C.path.join(C.pack, markerFile))
                      .trim({threshold : 8})
                      .resize(Math.round(512 * .34), Math.round(256 * .34), {fit : 'inside'})
                      .png()
                      .toBuffer();
    const p = await C.raw(input), out = C.clear(512, 256);
    C.blit(out, p, Math.round((512 - p.width) / 2), Math.round((256 - p.height) / 2));
    C.write(C.path.join(C.pack, 'compatibility/resource/shield.png'), await C.png(out));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json'));
    bindings.bindings['resource/shield'].source = markerFile;
    C.json(C.path.join(C.pack, 'compatibility/bindings.json'), bindings);
    console.log('Built 32 native coast quarters and the terrain production marker');
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    coastQuarter,
    coastCenters,
    oceanTile,
    mouth,
    markerFile,
    buildMarker,
    build
};
