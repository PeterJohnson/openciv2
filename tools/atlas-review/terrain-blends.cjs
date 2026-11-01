// Terrain transitions share edge color while preserving each tile's material core.
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => x * x * (3 - 2 * x);
const fract = x => x - Math.floor(x);

function noise(u, v, frequency) {
    const x = u * frequency, y = v * frequency, ix = Math.floor(x), iy = Math.floor(y);
    const a = smooth(fract(x)), b = smooth(fract(y));
    const hash = (i, j) => {
        i = (i % frequency + frequency) % frequency;
        j = (j % frequency + frequency) % frequency;
        return fract(Math.sin(i * 127.1 + j * 311.7 + 29.3) * 43758.5453);
    };
    return (1 - b) * ((1 - a) * hash(ix, iy) + a * hash(ix + 1, iy)) +
           b * ((1 - a) * hash(ix, iy + 1) + a * hash(ix + 1, iy + 1));
}

function variation(u, v) {
    return (noise(u + .13, v + .29, 3) - .5) * .11 + (noise(u + .41, v - .17, 9) - .5) * .045;
}

function alpha(u, v) {
    const inward = 1 - 2 * Math.max(Math.abs(u - .5), Math.abs(v - .5));
    if (inward < 0)
        return 0;
    const t = clamp(inward / .44);
    // Zero perturbation at the shared edge keeps the blend symmetric at one half.
    return .5 * (1 - smooth(clamp(t + variation(u, v) * Math.sin(Math.PI * t))));
}

function weights(u, v) {
    const fu = fract(u), fv = fract(v), n = variation(u, v);
    const a = smooth(clamp((fu + n * 4 * fu * (1 - fu) - .26) / .48));
    const b = smooth(clamp((fv + variation(v + .37, u - .19) * 4 * fv * (1 - fv) - .26) / .48));
    return [ (1 - a) * (1 - b), a * (1 - b), a * b, (1 - a) * b ];
}

async function dither(terrain, q, bytes) {
    const C = require('./common.cjs'), tile = await C.raw(bytes), out = C.clear(256, 128);
    const x0 = q < 2 ? 256 : 0, y0 = ((q + 1) & 3) < 2 ? 0 : 128;
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 256; x++) {
            const X = x + x0, Y = y + y0, si = (Y * 512 + X) * 4, di = (y * 256 + x) * 4;
            out.data.set(tile.data.subarray(si, si + 4), di);
            if (terrain < 10) {
                const u = (Y + .5) / 256 + (X + .5 - 256) / 512, v = (Y + .5) / 256 - (X + .5 - 256) / 512;
                out.data[di + 3] = Math.round(out.data[di + 3] * alpha(u, v));
            } else {
                // Preserve the existing ocean/unknown/fog slots, including blank coastal dither 12.
                if (terrain === 11)
                    out.data.set([ 12, 22, 23, out.data[di + 3] ], di);
                const outward = Math.abs((X - 256) / 256) + Math.abs((Y - 128) / 128);
                const threshold = [ 0, .5, .75, .25 ][(Math.floor(x / 8) & 1) + 2 * (Math.floor(y / 8) & 1)];
                if (outward < .60 + threshold * .40)
                    out.data[di + 3] = 0;
            }
        }
    if (terrain === 12)
        out.data.fill(0);
    return C.png(out);
}

async function build() {
    const C = require('./common.cjs'), index = C.read(C.path.join(C.pack, 'compatibility/bindings.json'));
    const entries = [];
    for (let t = 0; t < 10; t++) {
        const source = 'map/ground/' + C.terrainNames[t] + '.png',
              input = C.fs.readFileSync(C.path.join(C.pack, source));
        for (let q = 0; q < 4; q++) {
            const key = 'dither/' + t + '/' + q, file = index.bindings[key].file,
                  bytes = await dither(t, q, input);
            C.write(C.path.join(C.pack, file), bytes);
            index.bindings[key].source = source;
            entries.push({terrain : C.terrainNames[t], quadrant : q, file, source, sha256 : C.sha(bytes)});
        }
    }
    index.terrainTransitions = 'map/terrain-transitions.json';
    C.json(C.path.join(C.pack, 'compatibility/bindings.json'), index);
    C.json(C.path.join(C.pack, 'map/terrain-transitions.json'), {
        version : 1,
        authoring : 'tools/atlas-review/terrain-blends.cjs',
        native :
            'Source neighbor selection and quarter boxes; irregular feather to a half blend at the shared edge; untouched material cores.',
        enhanced :
            'Narrow world-space transitions with periodic organic variation and distinct material cores.',
        unchanged : 'Ground PNGs, coast geometry, foreground art, draw order and native zoom cutoffs.',
        entries
    });
    console.log('Built 40 land-transition quarter PNGs');
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    alpha,
    weights,
    dither,
    build
};
