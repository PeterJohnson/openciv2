// Artwork for the source-selected ocean-neighbor dither slot 12.
// Match the existing coast apron at the boundary, fading only inside the land tile.
const C = require('./common.cjs');
const S = require('./shoreline.cjs');
const smooth = x => {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
};

async function quarter(q) {
    await C.art.loadMaterials(C.pack + '/map');
    const out = C.clear(256, 128), x0 = q < 2 ? 256 : 0, y0 = ((q + 1) & 3) < 2 ? 0 : 128;
    const land = Array.from({length : 4}, () => ({land : 1, material : 'grassland'}));
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 256; x++) {
            const X = x + x0, Y = y + y0, u = (Y + .5) / 256 + (X + .5 - 256) / 512,
                  v = (Y + .5) / 256 - (X + .5 - 256) / 512;
            const inward = 1 - 2 * Math.max(Math.abs(u - .5), Math.abs(v - .5));
            if (inward < 0 || inward >= .44)
                continue;
            const relief = .08 * (S.noise(u * 5 + 17, v * 5 - 9, 5) - .5) +
                           .04 * (S.noise(u * 17 + 3, v * 17 + 21, 17) - .5);
            const width = .36 + relief;
            const alpha = 1 - smooth((inward - .015) / (width - .015));
            const rgb = C.art.surface(u, v, land, 'sand', [], 128, {field : 1, periodic : true});
            out.data.set([...rgb, Math.round(alpha * 255) ], (y * 256 + x) * 4);
        }
    return C.png(out);
}

module.exports = {quarter};
