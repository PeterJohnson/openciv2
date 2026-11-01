// Native coast finishing and a quiet terrain-only production marker.
const C = require('./common.cjs');
const markerFile = 'map/markers/grassland-production.png';
const markerVector = 'map/markers/grassland-production.svg';
const smooth = (a, b, n) => {
    const t = Math.max(0, Math.min(1, (n - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

async function coastQuarter(q, mask) {
    // Keep the source quarter/mask selection and all pixels inside its diamond.
    // Only the previously blank corners gain a curved, feathered water overhang.
    // This reaches the exposed tip of a neighboring land tile without a generic
    // dither-12 water stamp, which would cut holes beside enclosed lakes.
    const vals = [ 0, 0, 0, 0 ];
    vals[q] = (mask & 2) && (mask & 5) ? 1 : 0;
    vals[(q + 1) % 4] = mask & 4 ? 1 : 0;
    vals[(q + 3) % 4] = mask & 1 ? 1 : 0;
    const corners = vals.map(land => ({land, material : 'grassland'})), out = C.clear(256, 128);
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 256; x++) {
            const u = (y + .5) / 128 + (x + .5 - 128) / 256;
            const v = (y + .5) / 128 - (x + .5 - 128) / 256;
            const outside = Math.max(-u, -v, u - 1, v - 1, 0);
            let alpha = 255, cu = u, cv = v, field = 0;
            if (outside > 0) {
                if (!mask)
                    continue;
                cu = Math.max(.000001, Math.min(.999999, u));
                cv = Math.max(.000001, Math.min(.999999, v));
                const a = C.art.shoreField(cu, cv, corners);
                field = a + (1 - a) * smooth(0, .42, outside);
                alpha = Math.round(255 * (1 - smooth(.46, .54, field)));
            }
            if (alpha) {
                let rgb = C.art.surface(u, v, outside ? corners.map(c => ({...c, land : 0})) : corners,
                                        'sand', [], 128);
                if (outside) {
                    const shallow = .34 * smooth(.29, .49, field);
                    rgb = rgb.map((c, k) => Math.round(c * (1 - shallow) + [ 57, 114, 118 ][k] * shallow));
                }
                out.data.set([...rgb, alpha ], (y * 256 + x) * 4);
            }
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
    markerFile,
    buildMarker,
    build
};
