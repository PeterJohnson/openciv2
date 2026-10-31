// 8-bit DIB glyph replay, matching src/platform/text.c (CIV2_WINE_TEXT unset).
// Original-art replay only. Replacement typography lives in typography.cjs.
const C = require('./common.cjs');
const bytes = C.fs.readFileSync(C.path.join(C.root, 'data/native/fonts.bin'));
if (bytes.subarray(0, 8).toString() !== 'C2FONTS2')
    throw Error('Font bank signature');
const fonts = new Map();
let offset = 12;
for (let i = 0; i < bytes.readUInt32LE(8); i++) {
    const face = bytes[offset], height = bytes[offset + 1];
    const style = (bytes.readUInt16LE(offset + 2) >= 600 ? 1 : 0) | (bytes[offset + 4] ? 2 : 0);
    const cellHeight = bytes.readInt32LE(offset + 8), glyphs = [];
    offset += 52;
    for (let c = 0; c < 256; c++) {
        const g = {
            advance : bytes.readInt16LE(offset + 2),
            measured : bytes.readInt16LE(offset),
            x : bytes.readInt8(offset + 4),
            y : bytes.readInt8(offset + 5),
            w : bytes[offset + 6],
            h : bytes[offset + 7]
        };
        offset += 8;
        g.stride = Math.ceil(g.w / 8);
        g.mask = bytes.subarray(offset, offset + g.stride * g.h);
        offset += g.mask.length;
        glyphs.push(g);
    }
    fonts.set(`${face}/${height}/${style}`, {face, height, style, cellHeight, glyphs});
}
if (offset !== bytes.length)
    throw Error('Font bank length');

function get(face = 0, height = 11, style = 0) {
    const f = fonts.get(`${face}/${Math.max(6, Math.min(48, height))}/${style}`);
    if (!f)
        throw Error(`Native font ${face}/${height}/${style}`);
    return f;
}

function width(text, font) {
    return [...Buffer.from(text, 'latin1') ].reduce((n, c) => n + font.glyphs[c].advance, 0);
}

function draw(dst, command, density, color) {
    const f = get(command.face, command.fontHeight, command.style);
    const rgba = [...color.match(/[a-f\d]{2}/gi).map(s => parseInt(s, 16)), 255 ];
    let pen = command.x;
    const clip = command.clip || [ 0, 0, dst.width / density, dst.height / density ];
    for (const code of Buffer.from(command.text, 'latin1')) {
        const g = f.glyphs[code];
        for (let y = 0; y < g.h; y++)
            for (let x = 0; x < g.w; x++) {
                if (!(g.mask[y * g.stride + (x >> 3)] & (0x80 >> (x & 7))))
                    continue;
                const dx = pen + g.x + x, dy = command.y + g.y + y;
                if (dx < clip[0] || dy < clip[1] || dx >= clip[2] || dy >= clip[3])
                    continue;
                for (let sy = 0; sy < density; sy++)
                    for (let sx = 0; sx < density; sx++) {
                        const px = dx * density + sx, py = dy * density + sy;
                        if (px >= 0 && px < dst.width && py >= 0 && py < dst.height)
                            dst.data.set(rgba, (py * dst.width + px) * 4);
                    }
            }
        pen += g.advance;
    }
    return pen;
}

module.exports = {
    get,
    width,
    draw,
    sha256 : C.sha(bytes)
};
