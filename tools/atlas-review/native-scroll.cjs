// Device raster boundary: geometry and theme samples from
// src/platform/controls.c (scroll_geom, scroll_track, scroll_part, part_index)
// and scroll_theme.h. Original-art output uses the running game's theme;
// replacements retain their palette.
const C = require('./common.cjs');
const source = C.fs.readFileSync(C.path.join(C.root, 'src/platform/scroll_theme.h'), 'utf8');
const parts = Object.fromEntries([
    ...source.matchAll(/static const unsigned char (sb_\w+)\[289\] = \{([\s\S]*?)\};/g)
].map(m => [m[1], [...m[2].matchAll(/0x([a-f\d]+)/g) ].map(n => parseInt(n[1], 16))]));
const muldiv = (a, b, c) => Math.round(a * b / c);
function partIndex(k, n) {
    if (k < 3)
        return k;
    if (k >= n - 3)
        return 17 - (n - k);
    return Math.max(3, Math.min(13, k - Math.trunc((n - 17 + 1) / 2)));
}
function paint(c, fill, original) {
    const vertical = c.height > c.width, len = vertical ? c.height : c.width;
    const page = Number(c.text) || 0, min = c.fontHeight, max = c.style, pos = c.face;
    const disabled = c.color === 128;
    let arrow = 17, thumb = 17, at = 0;
    if (len <= 38) {
        arrow = len > 4 ? Math.trunc((len - 4) / 2) : 0;
        thumb = 0;
    } else {
        if (page && max >= min)
            thumb = Math.max(8, muldiv(len - 34, page, max - min + 1));
        const pixels = len - 34 - thumb, end = max - (page > 1 ? page - 1 : 0);
        if (pixels < 0 || disabled)
            thumb = 0;
        else
            at = min >= end ? 17 : 17 + muldiv(pixels, pos - min, end - min);
    }
    const gray = value => {
        if (original)
            return '#' + value.toString(16).padStart(2, '0').repeat(3);
        const t = value / 255;
        return '#' +
               [ Math.round(58 + 150 * t), Math.round(73 + 145 * t), Math.round(60 + 126 * t) ]
                   .map(v => v.toString(16).padStart(2, '0'))
                   .join('');
    };
    for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++)
            fill(c.x + x, c.y + y, 1, 1, gray((x + y) & 1 ? 255 : 245));
    function part(key, x, y, w, h, lo = 0, hi = len) {
        const pixels = parts['sb_' + key];
        if (!pixels || pixels.length !== 289)
            throw Error('Missing source scrollbar theme ' + key);
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                const k = vertical ? y + j : x + i;
                if (k >= lo && k < hi)
                    fill(c.x + x + i, c.y + y + j, 1, 1,
                         gray(pixels[17 * partIndex(j, h) + partIndex(i, w)]));
            }
    }
    if (thumb) {
        if (vertical)
            part('vthumb', 0, at, c.width, thumb);
        else
            part('hthumb', at, 0, thumb, c.height);
    }
    const off = disabled ? '_off' : '';
    if (arrow) {
        if (vertical) {
            part('up' + off, 0, 0, c.width, 17, 0, arrow);
            part('down' + off, 0, len - 17, c.width, 17, len - arrow, len);
        } else {
            part('left' + off, 0, 0, 17, c.height, 0, arrow);
            part('right' + off, len - 17, 0, 17, c.height, len - arrow, len);
        }
    }
}
module.exports = {paint};
