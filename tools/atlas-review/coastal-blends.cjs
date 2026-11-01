// Art-only ocean-neighbor slot 12: graded, deterministic patches instead of an inset rim.
const C = require('./common.cjs');
const S = require('./shoreline.cjs');
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
};

function coverage(u, v) {
    const inward = 1 - 2 * Math.max(Math.abs(u - .5), Math.abs(v - .5));
    if (inward < 0 || inward >= .44)
        return 0;
    // Warped low-frequency patches give way to finer clustered flecks.
    const wx = u + .13 * (S.noise(u * 4 + 12, v * 4 - 9, 4) - .5);
    const wy = v + .13 * (S.noise(u * 4 - 7, v * 4 + 23, 4) - .5);
    const fbm = (S.noise(wx * 5 + 17, wy * 5 - 9, 5) - .5) * .84 +
                (S.noise(wx * 13 + 3, wy * 13 + 21, 13) - .5) * .50 +
                (S.noise(wx * 37 - 14, wy * 37 + 8, 37) - .5) * .26 +
                (S.noise(wx * 97 + 41, wy * 97 - 3, 97) - .5) * .14;
    const depth = clamp((inward - .012) / .428);
    const base = 1 - smooth(depth);
    const envelope = 4 * base * (1 - base);
    const grain = clamp(
        (.65 * S.noise(wx * 83 + 7, wy * 83 - 41, 83) + .35 * S.noise(wx * 31 - 13, wy * 31 + 11, 31) - .30) /
        .40);
    const probability = clamp(base + fbm * envelope * 1.6);
    const patches = smooth((probability - grain + .08) / .16);
    // Retain a narrow fully covered join to the shared coastal apron, and
    // retire every fleck before the cactus/material core.
    const edge = 1 - smooth((inward - .03) / .065), core = 1 - smooth((inward - .36) / .08);
    return Math.max(edge, (.12 * base + .88 * patches) * core);
}

async function quarter(q) {
    await C.art.loadMaterials(C.pack + '/map');
    const out = C.clear(256, 128), x0 = q < 2 ? 256 : 0, y0 = ((q + 1) & 3) < 2 ? 0 : 128;
    const land = Array.from({length : 4}, () => ({land : 1, material : 'grassland'}));
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 256; x++) {
            const X = x + x0, Y = y + y0, u = (Y + .5) / 256 + (X + .5 - 256) / 512,
                  v = (Y + .5) / 256 - (X + .5 - 256) / 512;
            const a = coverage(u, v);
            if (!a)
                continue;
            const rgb = C.art.surface(u, v, land, 'sand', [], 128, {field : 1, periodic : true});
            out.data.set([...rgb, Math.round(a * 255) ], (y * 256 + x) * 4);
        }
    return C.png(out);
}

module.exports = {
    coverage,
    quarter
};
