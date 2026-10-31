// Replacement typography is independent of original bitmap glyph replay.
// Keep source text spans, wrapping, anchors and clipping; rasterize the replacement
// face at the output density instead of enlarging the original 1-bit masks.
const C = require('./common.cjs'), Reference = require('./font.cjs');
const family = 'Noto Sans,DejaVu Sans,sans-serif';
const cache = new Map();
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

async function raster(command, density, color) {
    const text = command.text.trimEnd(), f = Reference.get(command.face, command.fontHeight, command.style);
    const width = Reference.width(text, f);
    if (!text || !width)
        return null;
    const key = JSON.stringify([ text, f.height, f.style, width, density, color ]);
    if (!cache.has(key)) {
        const w = Math.ceil((text.length + 2) * f.height * 1.5), h = f.cellHeight + 4;
        const svg = C.svg(w, h,
                          `<text x="0" y="${f.height}" font-family="${family}" font-size="${
                              f.height}" font-weight="${f.style & 1 ? 700 : 400}" font-style="${
                              f.style & 2 ? 'italic' : 'normal'}" fill="${color}">${escape(text)}</text>`);
        const {data, info} =
            await C.sharp(Buffer.from(svg), {density : 72 * density}).ensureAlpha().raw().toBuffer({
                resolveWithObject : true
            });
        let right = 0;
        for (let y = 0; y < info.height; y++)
            for (let x = 0; x < info.width; x++)
                if (data[(y * info.width + x) * 4 + 3])
                    right = Math.max(right, x + 1);
        if (!right)
            throw Error('Empty replacement text: ' + text);
        // Fit the run to the source advance span. This retains centered labels,
        // list origins and control geometry even though the font face changes.
        const fitted = await C.sharp(data, {raw : {width : info.width, height : info.height, channels : 4}})
                           .extract({left : 0, top : 0, width : right, height : info.height})
                           .resize(width * density, info.height, {fit : 'fill'})
                           .raw()
                           .toBuffer();
        cache.set(key, {data : fitted, width : width * density, height : info.height});
    }
    return cache.get(key);
}

async function draw(dst, command, density, color, original = false) {
    if (original)
        return Reference.draw(dst, command, density, color);
    const bitmap = await raster(command, density, color);
    if (!bitmap)
        return command.x;
    const clip = command.clip || [ 0, 0, dst.width / density, dst.height / density ];
    const x = Math.round(command.x * density), y = Math.round(command.y * density);
    const left = Math.max(0, Math.ceil(clip[0] * density) - x, -x);
    const top = Math.max(0, Math.ceil(clip[1] * density) - y, -y);
    const right = Math.min(bitmap.width, Math.ceil(clip[2] * density) - x, dst.width - x);
    const bottom = Math.min(bitmap.height, Math.ceil(clip[3] * density) - y, dst.height - y);
    if (right > left && bottom > top) {
        const cropped = C.clear(right - left, bottom - top);
        for (let row = top; row < bottom; row++)
            bitmap.data.copy(cropped.data, (row - top) * cropped.width * 4, (row * bitmap.width + left) * 4,
                             (row * bitmap.width + right) * 4);
        C.blit(dst, cropped, x + left, y + top);
    }
    return command.x +
           Reference.width(command.text, Reference.get(command.face, command.fontHeight, command.style));
}

module.exports = {
    draw,
    family
};
