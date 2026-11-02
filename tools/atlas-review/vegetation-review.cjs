// Four-stage composed scene crops; no extracted original sprites are published.
const C = require('./common.cjs'), V = require('./terrain-vegetation.cjs');
const stages = [
    [ 'original', 'Original' ], [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
    [ 'proposed', 'HD + cohesion' ]
];

async function build() {
    const scenes =
        C.read(C.path.join(C.pack, 'review/land-borders.json')).scenes.filter(s => s.tileWidth === 128);
    const rows = [];
    for (const family of ['desert', 'forest']) {
        let best;
        for (const s of scenes) {
            if (family === 'desert' && s.id !== 'dry-128')
                continue;
            const trace = C.engine('map', C.path.join(C.pack, s.fixture));
            const commands = trace.commands.filter(
                c => family === 'desert' ? c.asset === 'terrain/0' : c.asset.startsWith('feature/forest/'));
            for (const c of commands) {
                const width = 384, height = 192,
                      left =
                          Math.max(0, Math.min(s.camera.cols * 128 - width, c.x + c.width / 2 - width / 2)),
                      top =
                          Math.max(0, Math.min(s.camera.rows * 32 - height, c.y + c.height / 2 - height / 2));
                const contained = commands.filter(
                    n => n.x + n.width / 2 >= left + 16 && n.x + n.width / 2 <= left + width - 16 &&
                         n.y + n.height / 2 >= top + 16 && n.y + n.height / 2 <= top + height - 16);
                const evergreen = contained
                                      .filter(n => family === 'forest' &&
                                                   V.forestVariant(+n.asset.split('/')[2]) >= 2)
                                      .length,
                      broadleaf = contained.length - evergreen;
                const score = family === 'forest' ? Math.min(2, evergreen) * 40 +
                                                        Math.min(2, broadleaf) * 40 + contained.length
                                                  : contained.length;
                if (!best || score > best.score)
                    best = {
                        family,
                        score,
                        scene : s.id,
                        left,
                        top,
                        width,
                        height,
                        evergreen,
                        broadleaf,
                        images : Object.fromEntries(stages.map(([ k ]) => [k, s[k]]))
                    };
            }
        }
        if (!best || family === 'forest' && (!best.evergreen || !best.broadleaf))
            throw Error('Missing mixed forest review');
        rows.push(best);
    }
    const out = C.clear(2048, 688, [ 23, 35, 34, 255 ]);
    for (const [r, row] of rows.entries()) {
        const title = row.family === 'desert'
                          ? 'Desert · cactus silhouettes on sandy ground'
                          : 'Forest · denser green broadleaf crowns and pointed evergreens';
        C.blit(out,
               await C.raw(Buffer.from(
                   C.svg(2048, 40,
                         `<text x="16" y="28" fill="#e5d6b5" font-family="sans-serif" font-size="22">${
                             title}</text>`))),
               0, r * 344);
        for (const [col, [ stage, label ]] of stages.entries()) {
            const d = [ 'hd', 'proposed' ].includes(stage) ? 2 : 1;
            C.blit(out,
                   await C.raw(Buffer.from(
                       C.svg(512, 32,
                             `<text x="16" y="23" fill="#b7c6b5" font-family="sans-serif" font-size="18">${
                                 label}</text>`))),
                   col * 512, r * 344 + 40);
            const b = await C.sharp(C.path.join(C.pack, row.images[stage]))
                          .extract({
                              left : row.left * d,
                              top : row.top * d,
                              width : row.width * d,
                              height : row.height * d
                          })
                          .resize(512, 256, {kernel : d === 1 ? 'nearest' : 'lanczos3'})
                          .png()
                          .toBuffer();
            C.blit(out, await C.raw(b), col * 512, r * 344 + 80);
        }
    }
    const bytes = await C.png(out);
    C.write(C.path.join(C.pack, 'review/terrain-vegetation.png'), bytes);
    C.json(C.path.join(C.pack, 'review/terrain-vegetation.json'), {
        rows,
        sha256 : C.sha(bytes),
        scope : 'Crops of four-stage composed real-save scenes, including review-only original artwork.'
    });
    console.log('Desert / forest comparison built', rows.map(r => ({
                                                                 scene : r.scene,
                                                                 crop : [ r.left, r.top, r.width, r.height ],
                                                                 evergreen : r.evergreen,
                                                                 broadleaf : r.broadleaf
                                                             })));
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1
    });
module.exports = {build};
