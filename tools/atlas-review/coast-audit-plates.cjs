const C = require('./common.cjs');

async function build(report) {
    const stages = [
        [ 'original', 'Original' ], [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
        [ 'proposed', 'HD + cohesion' ]
    ];
    for (const [board, ids] of [[ 'islands-lakes', [ 'island', 'islands', 'lake', 'lakes' ] ],
                                [ 'forest-mouths', [ 'newcastle', 'forest', 'mouth', 'wrap' ] ]]) {
        const image = C.clear(1536, 1024, [ 23, 35, 34, 255 ]);
        for (let row = 0; row < 4; row++) {
            const s = report.scenes.find(s => s.id === ids[row] + '-128');
            C.blit(image,
                   await C.raw(Buffer.from(
                       C.svg(1536, 32,
                             `<text x="12" y="23" fill="#e5d6b5" font-family="sans-serif" font-size="18">${
                                 s.title}</text>`))),
                   0, row * 256);
            for (const [col, [ stage, label ]] of stages.entries()) {
                C.blit(image,
                       await C.raw(Buffer.from(C.svg(
                           384, 30,
                           `<text x="12" y="21" fill="#b7c6b5" font-family="sans-serif" font-size="16">${
                               label}</text>`))),
                       col * 384, row * 256 + 32);
                C.blit(image, await C.raw(C.path.join(C.pack, s[stage]), 384, 192), col * 384,
                       row * 256 + 64);
            }
        }
        C.write(C.path.join(C.pack, `review/coast-${board}.png`), await C.png(image));
    }
    await contourDetails(report, stages);
    await contourDetails(report, stages,
                         [
                             [ 'islands', 'Forest edge meeting grassland and coast', 61, 99 ],
                             [ 'forest', 'Woodland beside cultivated land', 16, 13 ],
                             [ 'mouth', 'Wooded river mouth', 139, 13 ]
                         ],
                         'forest-borders');
}

async function contourDetails(report, stages,
                              rows =
                                  [
                                      [ 'newcastle', 'Desert and cultivated coast', 129, 74 ],
                                      [ 'islands', 'Forested island', 61, 99 ],
                                      [ 'mouth', 'River mouth', 139, 13 ],
                                      [ 'islands', 'Headland detail / 2x logical magnification', 61, 98, 256 ]
                                  ],
                              output = 'coast-contours') {
    const image = C.clear(2048, rows.length * 320, [ 23, 35, 34, 255 ]);
    for (const [row, [ id, title, x, y, cropWidth = 512 ]] of rows.entries()) {
        const scene = report.scenes.find(s => s.id === id + '-128');
        const left = Math.max(
            0, Math.min(scene.camera.cols * 128 - cropWidth, (x - scene.camera.ox) * 64 - cropWidth / 2));
        const top = Math.max(
            0, Math.min(scene.camera.rows * 32 - cropWidth / 2, (y - scene.camera.oy) * 32 - cropWidth / 4));
        C.blit(image,
               await C.raw(Buffer.from(
                   C.svg(2048, 32,
                         '<text x="12" y="23" fill="#e5d6b5" font-family="sans-serif" font-size="20">' +
                             title + '</text>'))),
               0, row * 320);
        for (const [col, [ stage, label ]] of stages.entries()) {
            C.blit(image,
                   await C.raw(Buffer.from(
                       C.svg(512, 32,
                             '<text x="12" y="23" fill="#b7c6b5" font-family="sans-serif" font-size="18">' +
                                 label + '</text>'))),
                   col * 512, row * 320 + 32);
            const d = [ 'hd', 'proposed' ].includes(stage) ? 2 : 1;
            const png =
                await C.sharp(C.path.join(C.pack, scene[stage]))
                    .extract(
                        {left : left * d, top : top * d, width : cropWidth * d, height : cropWidth * d / 2})
                    .resize(512, 256, {kernel : d === 1 ? 'nearest' : 'lanczos3'})
                    .png()
                    .toBuffer();
            C.blit(image, await C.raw(png), col * 512, row * 320 + 64);
        }
    }
    C.write(C.path.join(C.pack, 'review', output + '.png'), await C.png(image));
}

module.exports = {build};
