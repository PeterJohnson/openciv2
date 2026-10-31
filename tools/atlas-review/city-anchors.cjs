// Author per-sprite size-box metadata from replacement silhouettes only.
// Re-author explicitly with --author after changing city art; ordinary builds read the saved anchors.
const C = require('./common.cjs');
const metadata = C.path.join(C.pack, 'map/city-anchors.json');

async function main() {
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json'));
    let data;
    if (process.argv.includes('--author')) {
        const variants = [];
        for (let i = 0; i < 48; i++) {
            const b = bindings.bindings['city/' + i], im = await C.raw(C.path.join(C.pack, b.file), 64, 48);
            let mass = 0, mx = 0, my = 0;
            for (let y = 0; y < 48; y++)
                for (let x = 0; x < 64; x++) {
                    const a = im.data[(y * 64 + x) * 4 + 3] / 255;
                    mass += a;
                    mx += a * x;
                    my += a * y;
                }
            const preferred = [
                Math.max(1, Math.round(mx / mass) - 26), Math.max(16, Math.min(28, Math.round(my / mass) - 8))
            ];
            let best;
            // Keep the typical badge footprint in the 64x48 logical frame. Prefer left
            // footholds, away from the flag and unit-tag corridor on the right.
            for (let y = 14; y <= 30; y++)
                for (let x = 1; x <= 22; x++) {
                    let cover = 0;
                    for (let dy = 0; dy < 16; dy++)
                        for (let dx = 0; dx < 23; dx++)
                            cover += im.data[((y + dy) * 64 + x + dx) * 4 + 3] / 255;
                    const score = cover / (23 * 16) * .25 + Math.abs(y - preferred[1]) * .025 +
                                  Math.abs(x - preferred[0]) * .025;
                    if (!best || score < best.score)
                        best = {x, y, score};
                }
            // Real-save review: the large walled industrial city's eastern
            // badge edge touched an active unit shield. Use the upper west corner
            // to clear the fixed-pixel padding at both native and enlarged zooms.
            if (i === 39) {
                best.x = 0;
                best.y = 4;
            }
            variants.push({
                index : i,
                style : Math.floor(i / 8),
                size : Math.floor(i % 8 / 2),
                walled : !!(i % 2),
                file : b.file,
                sha256 : C.sha(C.fs.readFileSync(C.path.join(C.pack, b.file))),
                sizeBox : [ best.x, best.y ]
            });
        }
        data = {
            schemaVersion : 1,
            logicalFrame : [ 64, 48 ],
            reservedBox : [ 26, 16 ],
            policy :
                'Per-variant replacement silhouette footholds, kept above the southern frame edge and left of unit/flag tags. Original anchors remain separate.',
            variants
        };
        C.json(metadata, data);
    } else
        data = C.read(metadata);
    delete bindings.citySizeBoxAnchor;
    bindings.citySizeBoxAnchors = 'map/city-anchors.json';
    C.json(C.path.join(C.pack, 'compatibility/bindings.json'), bindings);
    const sheet = C.clear(2560, 1536, [ 26, 43, 42, 255 ]);
    for (const v of data.variants) {
        const x = (v.index % 8) * 320, y = Math.floor(v.index / 8) * 256;
        C.blit(sheet, await C.raw(C.path.join(C.pack, v.file), 256, 192), x + 32, y + 32);
        const [ax, ay] = v.sizeBox;
        const vector = C.svg(
            320, 256,
            `<text x="16" y="22" fill="#eaddba" font-family="sans-serif" font-size="16">${v.index} · size ${
                v.size + 1}${v.walled ? ' · walls' : ''} · (${ax},${ay})</text><rect x="${32 + ax * 4}" y="${
                32 +
                ay * 4}" width="68" height="60" fill="#d8bd60" stroke="#101919" stroke-width="4"/><text x="${
                40 +
                ax *
                    4}" y="${76 + ay * 4}" font-family="sans-serif" font-size="44" fill="#101919">12</text>`);
        C.blit(sheet, await C.raw(Buffer.from(vector)), x, y);
    }
    C.write(C.path.join(C.pack, 'review/city-size-anchors.png'), await C.png(sheet));
    console.log('Reviewed 48 replacement city anchors;',
                new Set(data.variants.map(v => v.sizeBox.join(','))).size, 'distinct placements');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
