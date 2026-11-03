// Refresh only previews that consume the sixteen native river/mouth sprites.
const C = require('./common.cjs'), R = require('./render.cjs');
const assert = require('node:assert/strict'), {spawnSync} = require('node:child_process');
const Module = require('node:module');
const before = '66f8560d';
function prior(file) {
    const r = spawnSync('git', [ 'show', before + ':' + file ],
                        {cwd : C.root, maxBuffer : 128 * 1024 * 1024});
    if (r.status)
        throw Error(r.stderr.toString());
    return r.stdout;
}
async function update(scenes, audit = false) {
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings,
          updated = [];
    for (const s of scenes.filter(s => s.mode === 'map' && s.fixture)) {
        const t = C.engine('map', C.path.join(C.pack, s.fixture));
        if (!t.commands.some(c => /^(river|mouth)\//.test(c.asset)))
            continue;
        assert.deepEqual(t, C.engine('map', C.path.join(C.pack, s.fixture), 'Debug'),
                         s.id + ' source D/R');
        if (!audit)
            assert.deepEqual(t, C.read(C.path.join(C.pack, 'review/traces/' + s.id + '.json')));
        for (const mode of ['current', 'hd']) {
            const bytes = await R.baseline(
                t, s, bindings, {density : mode === 'hd' ? 2 : 1, native : mode === 'current'});
            C.write(C.path.join(C.pack, s[mode]), bytes);
            if (s.exports4k?.[mode])
                C.write(C.path.join(C.pack, s.exports4k[mode]),
                        await C.sharp(bytes)
                            .resize(3840, 2160, {
                                fit : 'contain',
                                background : '#152322',
                                kernel : mode === 'current' ? 'nearest' : 'lanczos3'
                            })
                            .png()
                            .toBuffer());
        }
        updated.push(s.id);
        console.log((audit ? 'Survey: ' : 'Map: ') + s.id);
    }
    return updated;
}
async function review() {
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const audit = C.read(C.path.join(C.pack, 'review/coast-audit.json'));
    const district = scenes.find(s => s.id === 'district'),
          mouth = audit.scenes.find(s => s.id === 'mouth-128');
    const oldArt = new Module(C.path.join(__dirname, 'art-before.cjs'));
    oldArt.filename = C.path.join(__dirname, 'art-before.cjs');
    oldArt.paths = Module._nodeModulePaths(__dirname);
    oldArt._compile(prior('tools/atlas-review/art.cjs').toString(), oldArt.filename);
    const unchangedEnhancedCurves = [];
    for (let mask = 0; mask < 16; mask++)
        for (const origin of [[ 7, 11 ], [ 40, 23 ], [ 8, 0 ]]) {
            assert.deepEqual(C.art.riverCurve(mask, origin),
                             oldArt.exports.riverCurve(mask, origin));
            unchangedEnhancedCurves.push([ mask, origin ]);
        }
    const bends = [ 3, 12 ].map(mask => {
        const measure = art => {
            const p = art.riverCurve(mask, null, 256)[0].points;
            return Math.max(...p.map(q => Math.abs(q[0] - p[0][0])));
        };
        const was = measure(oldArt.exports), now = measure(C.art);
        assert(now < was * .6,
               'Alternating corner masks should not return towards every tile centre');
        return {mask, beforeExcursion : was, afterExcursion : now};
    });
    let preserved = 0;
    const originals = C.read(C.path.join(C.pack, 'review/original-scenes/renders.json'));
    for (const s of [...scenes, ...audit.scenes])
        for (const mode of ['original', 'proposed']) {
            const file =
                mode === 'original' ? (s.original || originals[s.id]?.original) : s.proposed;
            if (!file)
                continue;
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, file))),
                         C.sha(prior('assets/atlas-hd/' + file)), file);
            preserved++;
        }
    const rows = [
        {
            s : district,
            title : 'District: repeated corner chain / 128px logical tiles',
            left : 540,
            top : 12,
            width : 256,
            height : 384
        },
        {
            s : mouth,
            title : 'Saved game: river bends and mouth / 128px logical tiles',
            left : Math.max(0, (139 - mouth.camera.ox) * 64 - 128),
            top : Math.max(0, (13 - mouth.camera.oy) * 32 - 192),
            width : 256,
            height : 384
        }
    ];
    const board = C.clear(1536, rows.length * 850, [ 23, 35, 34, 255 ]);
    const caption = async (text, x, y, w, size) =>
        C.blit(board,
               await C.raw(Buffer.from(
                   C.svg(w, 36,
                         `<text x="12" y="26" fill="#eadbb9" font-family="sans-serif" font-size="${
                             size}">${text}</text>`))),
               x, y);
    for (const [i, row] of rows.entries()) {
        await caption(row.title, 0, i * 850, 1536, 23);
        const original = row.s.original || originals[row.s.id].original;
        const variants = [
            [ 'Original game art', C.fs.readFileSync(C.path.join(C.pack, original)), 1 ],
            [ 'Previous HD river', prior('assets/atlas-hd/' + row.s.hd), 2 ],
            [ 'Updated HD river', C.fs.readFileSync(C.path.join(C.pack, row.s.hd)), 2 ]
        ];
        for (const [col, [ title, input, d ]] of variants.entries()) {
            await caption(title, col * 512, i * 850 + 36, 512, 20);
            const bytes = await C.sharp(input)
                              .extract({
                                  left : row.left * d,
                                  top : row.top * d,
                                  width : row.width * d,
                                  height : row.height * d
                              })
                              .resize(512, 768, {kernel : d === 1 ? 'nearest' : 'lanczos3'})
                              .png()
                              .toBuffer();
            C.blit(board, await C.raw(bytes), col * 512, i * 850 + 76);
        }
    }
    C.write(C.path.join(C.pack, 'review/river-course.png'), await C.png(board));
    C.json(C.path.join(C.pack, 'review/river-course-validation.json'), {
        status : 'pass',
        beforeCommit : before,
        nativeBends : bends,
        unchangedEnhancedCurveCases : unchangedEnhancedCurves.length,
        originalAndEnhancedImagesPreserved : preserved,
        scope :
            'Native/HD sprite artwork only. Source masks, tile ports, draw commands, game code and enhanced world-space curves are unchanged. Sixteen masks still repeat under the original renderer.'
    });
    C.write(
        C.path.join(C.pack, 'review/river-course.html'),
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Natural river course</title><style>body{background:#172322;color:#eadbb9;font:16px/1.6 system-ui;margin:24px}main{max-width:1536px;margin:auto}a{color:#bed3ba}img{width:100%;height:auto}p{max-width:1050px}</style><main><h1>Native and HD river artwork</h1><p><a href="../index.html">Four-stage gallery</a> · <a href="river-course-validation.json">Course and preservation checks</a> · <a href="river-validation.json">Native joins</a> · <a href="river-fractal.png">Riverbanks at two zooms</a></p><p>Alternating corner tiles previously pulled the river towards each tile centre, producing a repeated sawtooth. Shallower asymmetric curves reduce that excursion, while irregular widths, bank relief and a shallow-water fringe soften the channel. Logical ports and radial endpoint tangents remain fixed across all sixteen masks. This changes artwork, not source rendering rules or the separately proposed world-space river geometry. The original renderer still repeats the same masks; it cannot vary a long river independently of tile topology.</p><img src="river-course.png" alt="Original artwork, previous HD river and updated HD river in the district and saved-map mouth"></main></html>`);
    console.log('River course:', JSON.stringify(bends), preserved,
                'original/enhanced images preserved');
}
async function main() {
    if (!process.argv.includes('--review-only')) {
        await update(C.read(C.path.join(C.pack, 'review/scenes.json')));
        const audit = C.read(C.path.join(C.pack, 'review/coast-audit.json'));
        await update(audit.scenes, true);
        await require('./coast-audit-plates.cjs').build(audit);
    }
    await review();
}
if (require.main === module)
    main().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {review};
