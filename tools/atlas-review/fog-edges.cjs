// Directional alpha masks for MapView::draw_tile_unexplored_edges.
// The four native 32x16 slots are quadrants of a 64x32 tile, not small
// diamonds.
const C = require('./common.cjs');
const color = [ 11, 21, 22 ];
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => x * x * (3 - 2 * x);

function opacity(x, y) {
    const sum = x + y;
    if (sum > 1)
        return 0;
    if (sum <= 0 || x <= 0 || y <= 0)
        return 0;
    // Fade only inward, so unknown terrain remains completely concealed.
    // Ease the fade at internal quarter seams to avoid rectangular cuts.
    const width = .52 * Math.pow(Math.sin(Math.PI * x / sum), .75);
    return 1 - smooth(clamp((1 - sum) / width));
}

async function quarter(q) {
    const out = C.clear(256, 128);
    for (let y = 0; y < out.height; y++)
        for (let x = 0; x < out.width; x++) {
            const px = (x + .5) / out.width, py = (y + .5) / out.height;
            const awayX = q < 2 ? px : 1 - px;
            const awayY = ((q + 1) & 3) < 2 ? 1 - py : py;
            out.data.set([...color, Math.round(255 * opacity(awayX, awayY)) ], (y * out.width + x) * 4);
        }
    return C.png(out);
}

async function build() {
    for (let q = 0; q < 4; q++) {
        const bytes = await quarter(q);
        C.write(C.path.join(C.pack, `compatibility/fog/${q}.png`), bytes);
        C.write(C.path.join(C.pack, `compatibility/dither/11/${q}.png`), bytes);
    }
}

module.exports = {
    color,
    opacity,
    quarter,
    build
};
