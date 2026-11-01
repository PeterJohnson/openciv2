// Rebuild the forest ground and its native adapters from the retained painted materials.
const C = require('./common.cjs');

async function ground(phase = [ 0, 0 ]) {
    const out = C.clear(512, 256);
    for (let y = 0; y < 256; y++)
        for (let x = 0; x < 512; x++) {
            const u = (y + .5) / 256 + (x + .5 - 256) / 512;
            const v = (y + .5) / 256 - (x + .5 - 256) / 512;
            if (u < 0 || u >= 1 || v < 0 || v >= 1)
                continue;
            const edge = Math.min(u, v, 1 - u, 1 - v);
            const rgb = C.art.woodlandFloor(u + phase[0], v + phase[1], 256, {edge});
            out.data.set([...rgb.map(Math.round), 255 ], (y * 512 + x) * 4);
        }
    return C.png(out);
}

async function dither(q, bytes) {
    const tile = await C.raw(bytes), out = C.clear(256, 128);
    const x0 = q < 2 ? 256 : 0, y0 = ((q + 1) & 3) < 2 ? 0 : 128;
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 256; x++) {
            const si = ((y + y0) * 512 + x + x0) * 4, di = (y * 256 + x) * 4;
            out.data.set(tile.data.subarray(si, si + 4), di);
            const outward = Math.abs((x + x0 - 256) / 256) + Math.abs((y + y0 - 128) / 128);
            const threshold = [ 0, .5, .75, .25 ][(Math.floor(x / 8) & 1) + 2 * (Math.floor(y / 8) & 1)];
            if (outward < .60 + threshold * .40)
                out.data[di + 3] = 0;
        }
    return C.png(out);
}

async function build() {
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    C.art.setVariations(false);
    const manifest = C.read(C.path.join(C.pack, 'manifest.json'));
    for (const e of manifest.entries.filter(e => /^map[.]ground[.]forest(?:-|$)/.test(e.id))) {
        const bytes = await ground(e.texturePhase);
        C.write(C.path.join(C.pack, e.file), bytes);
        e.sha256 = C.sha(bytes);
        e.description =
            'Grass and undergrowth edge with mottled leaf litter concentrated beneath trees; opaque tile coverage retained.';
    }
    const bytes = C.fs.readFileSync(C.path.join(C.pack, 'map/ground/forest.png'));
    C.write(C.path.join(C.pack, 'compatibility/terrain/3.png'), bytes);
    for (let q = 0; q < 4; q++)
        C.write(C.path.join(C.pack, 'compatibility/dither/3/' + q + '.png'), await dither(q, bytes));
    C.json(C.path.join(C.pack, 'manifest.json'), manifest);
    console.log('Updated four forest grounds and five native adapters');
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    ground,
    dither,
    build
};
