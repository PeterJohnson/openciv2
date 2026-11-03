// Update only scenes that consume an isolated transport slot; source traces stay intact.
const C = require('./common.cjs'), R = require('./render.cjs');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const Module = require('node:module');
const before = '2a3189dc';

function prior(file) {
    const p =
        spawnSync('git', [ 'show', before + ':' + file ], {cwd : C.root, maxBuffer : 128 * 1024 * 1024});
    if (p.status)
        throw Error(p.stderr.toString());
    return p.stdout;
}

const isolated = c => /^(road|rail)\/0$/.test(c.asset);

async function update(scenes, audit = false) {
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const changed = [];
    for (const s of scenes.filter(s => s.mode === 'map' && s.fixture)) {
        const t = C.engine('map', C.path.join(C.pack, s.fixture));
        if (!t.commands.some(isolated))
            continue;
        assert.deepEqual(t, C.engine('map', C.path.join(C.pack, s.fixture), 'Debug'), s.id);
        if (!audit)
            assert.deepEqual(t, C.read(C.path.join(C.pack, 'review/traces/' + s.id + '.json')));
        const world = C.read(
            C.path.join(C.pack, `review/fixtures/${s.saveBased || audit ? 'saved-world' : 'world'}.json`));
        for (const mode of ['current', 'hd', 'proposed']) {
            // Enhanced overview uses independent line glyphs, not these sprites.
            if (mode === 'proposed' && s.tileWidth < 48)
                continue;
            const bytes =
                mode === 'proposed'
                    ? await R.proposedMap(world, s, t, bindings)
                    : await R.baseline(t, s, bindings,
                                       {density : mode === 'hd' ? 2 : 1, native : mode === 'current'});
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
            console.log(s.id, mode);
        }
        changed.push(s.id);
    }
    return changed;
}

async function review() {
    const old = new Module(C.path.join(__dirname, 'isolated-before.cjs'));
    old.filename = C.path.join(__dirname, 'isolated-before.cjs');
    old.paths = Module._nodeModulePaths(__dirname);
    old._compile(prior('tools/atlas-review/art.cjs').toString(), old.filename);
    let nonzero = 0;
    for (let mask = 1; mask < 256; mask++) {
        for (let variant = 0; variant < 4; variant++) {
            assert.deepEqual(C.art.roadCurve(mask, variant), old.exports.roadCurve(mask, variant));
            nonzero++;
        }
        for (const armOnly of [false, true]) {
            assert.deepEqual(C.art.railCurve(mask, armOnly), old.exports.railCurve(mask, armOnly));
            nonzero++;
        }
    }
    const measures = [];
    for (const family of ['road', 'rail']) {
        for (let i = 1; i <= 8; i++) {
            const file = `assets/atlas-hd/compatibility/${family}/${i}.png`;
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.root, file))), C.sha(prior(file)));
        }
        const file = `assets/atlas-hd/compatibility/${family}/0.png`;
        const current = C.fs.readFileSync(C.path.join(C.root, file)), previous = prior(file);
        const e = C.find(`map.networks.${family}-00`);
        assert.equal(C.sha(current), C.sha(await C.sharp(C.path.join(C.pack, e.file))
                                               .extract({left : 32, top : 32, width : 512, height : 256})
                                               .png()
                                               .toBuffer()));
        for (const width of [64, 128, 256]) {
            const measure = async bytes => {
                const im = await C.raw(bytes, width, width / 2);
                let area = 0, left = width, right = -1, top = width / 2, bottom = -1;
                for (let y = 0; y < im.height; y++)
                    for (let x = 0; x < im.width; x++) {
                        if (im.data[(y * im.width + x) * 4 + 3] < 64)
                            continue;
                        area++;
                        left = Math.min(left, x);
                        right = Math.max(right, x);
                        top = Math.min(top, y);
                        bottom = Math.max(bottom, y);
                        assert(Math.abs(x + .5 - width / 2) / (width / 2) +
                                       Math.abs(y + .5 - width / 4) / (width / 4) <
                                   .9,
                               family + ' isolated tips must stay clear of the tile perimeter');
                    }
                return {area, box : [ left, top, right + 1, bottom + 1 ]};
            };
            const was = await measure(previous), now = await measure(current);
            assert(now.area > was.area * 2.5, family + ' visible footprint at ' + width);
            measures.push({family, width, before : was, after : now});
        }
    }
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const originals = C.read(C.path.join(C.pack, 'review/original-scenes/renders.json'));
    let preserved = 0;
    for (const s of scenes) {
        const file = originals[s.id]?.original;
        if (!file)
            continue;
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, file))),
                     C.sha(prior('assets/atlas-hd/' + file)));
        preserved++;
    }
    const district = scenes.find(s => s.id === 'district'), tactical = scenes.find(s => s.id === 'tactical');
    const rows = [
        {s : district, family : 'road', title : '128px tiles / isolated winding crossroads'},
        {s : district, family : 'rail', title : '128px tiles / isolated railway turnout'},
        {s : tactical, family : null, title : '64px tiles / both isolated improvements'}
    ];
    const stages = [
        [ 'original', 'Original game art' ], [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
        [ 'proposed', 'HD + cohesion' ]
    ];
    const board = C.clear(1920, 3 * 304, [ 23, 35, 34, 255 ]);
    const label = async (text, x, y, width, size) =>
        C.blit(board,
               await C.raw(Buffer.from(
                   C.svg(width, 36,
                         `<text x="12" y="26" fill="#eadbb9" font-family="sans-serif" font-size="${size}">${
                             text}</text>`))),
               x, y);
    for (const [i, row] of rows.entries()) {
        const commands =
            C.read(C.path.join(C.pack, 'review/traces/' + row.s.id + '.json')).commands.filter(isolated);
        const target = commands.find(c => c.asset === row.family + '/0');
        const cx = target ? target.x + target.width / 2
                          : commands.reduce((a, c) => a + c.x + c.width / 2, 0) / commands.length;
        const cy = commands[0].y + commands[0].height / 2;
        await label(row.title, 0, i * 304, 1920, 22);
        for (const [col, [ mode, title ]] of stages.entries()) {
            const d = col < 2 ? 1 : 2,
                  file = mode === 'original' ? originals[row.s.id].original : row.s[mode];
            const crop = await C.sharp(C.path.join(C.pack, file))
                             .extract({
                                 left : Math.round(cx - 120) * d,
                                 top : Math.round(cy - 56) * d,
                                 width : 240 * d,
                                 height : 112 * d
                             })
                             .resize(480, 224, {kernel : col < 2 ? 'nearest' : 'lanczos3'})
                             .png()
                             .toBuffer();
            await label(title, col * 480, i * 304 + 36, 480, 20);
            C.blit(board, await C.raw(crop), col * 480, i * 304 + 76);
        }
    }
    C.write(C.path.join(C.pack, 'review/isolated-networks.png'), await C.png(board));
    C.json(C.path.join(C.pack, 'review/isolated-networks-validation.json'), {
        status : 'pass',
        beforeCommit : before,
        unchangedConnectedCurveCases : nonzero,
        unchangedNativeDirectionalSprites : 16,
        originalScenesPreserved : preserved,
        visibility : measures,
        scope :
            'Only zero-neighbor road/rail artwork changes. Source selection, geometry for connected masks, game code, fixtures and original-art renders are unchanged.'
    });
    C.write(
        C.path.join(C.pack, 'review/isolated-networks.html'),
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated roads and railways</title><style>body{background:#172322;color:#eadbb9;font:16px/1.6 system-ui;margin:24px}main{max-width:1920px;margin:auto}a{color:#bed3ba}img{width:100%;height:auto}p{max-width:1100px}</style><main><h1>Isolated roads and railways</h1><p><a href="../index.html">Four-stage gallery</a> · <a href="images/district-hd.png">Full HD district</a> · <a href="isolated-networks-validation.json">Visibility and preservation checks</a> · <a href="rail-connectivity-validation.json">Rail connectivity checks</a></p><p>An isolated road is now a compact winding crossroads; an isolated railway is a three-way turnout with sleepers and continuous steel. Both have larger footprints than the previous short segments and rounded terminals well inside the tile. They indicate an improvement, without claiming a connection to adjacent tiles. Connected masks and the native selection rules are unchanged. The same artwork is used in detailed enhanced views; enhanced overview line symbols remain separate.</p><p>These crops use the unchanged district and tactical fixtures. Native stages are enlarged with nearest-neighbor sampling; HD stages are shown at their rendered pixel density.</p><img src="isolated-networks.png" alt="Four-stage comparison of isolated roads and railways at 128px and 64px tile zooms"></main></html>`);
    console.log('Isolated network checks passed:', nonzero, 'connected curves preserved');
}

async function main() {
    if (!process.argv.includes('--review-only')) {
        await C.art.loadMaterials(C.path.join(C.pack, 'map'));
        await update(C.read(C.path.join(C.pack, 'review/scenes.json')));
        const audit = C.read(C.path.join(C.pack, 'review/coast-audit.json'));
        if ((await update(audit.scenes, true)).length)
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
