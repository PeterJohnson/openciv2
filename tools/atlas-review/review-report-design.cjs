const C = require('./common.cjs'), D = require('./report-design.cjs'), F = require('./font.cjs');
const {Painter} = require('./windows.cjs'), assert = require('node:assert/strict'),
      {spawnSync} = require('node:child_process');
const before = '2be877c9';
function git(file) {
    const r = spawnSync('git', [ 'show', before + ':' + file ],
                        {cwd : C.root, maxBuffer : 32 * 1024 * 1024});
    if (r.status)
        throw Error(r.stderr.toString());
    return r.stdout;
}
const esc = s =>
    String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
async function build() {
    const scenes = C.read(C.path.join(C.pack, 'review/other-windows/scenes.json'));
    const plates = C.read(C.path.join(C.pack, 'interface/reports/layout.json'));
    const knowledge = new Map(), checks = [], intentionalOriginalChanges = [];
    for (const s of scenes.filter(s => s.mode === 'report')) {
        const trace = C.read(C.path.join(C.pack, 'review/traces/other-' + s.id.slice(7) + '.json'));
        const old =
            JSON.parse(git('assets/atlas-hd/review/traces/other-' + s.id.slice(7) + '.json'));
        if ([ 'report-science', 'report-intelligence' ].includes(s.id)) {
            assert.equal(trace.commands.length, old.commands.length);
            let changes = 0;
            trace.commands.forEach((c, i) => {
                const a = old.commands[i];
                if (JSON.stringify(c) === JSON.stringify(a))
                    return;
                assert.equal(c.asset, 'sprite');
                assert(+c.text >= 200 && +c.text < 220);
                assert.equal(Math.floor((+c.text - 200) / 4), Math.floor((+a.text - 200) / 4));
                assert.deepEqual({...c, text : a.text}, a);
                changes++;
            });
            intentionalOriginalChanges.push({scene : s.id, eraIconCorrections : changes});
        } else
            assert.deepEqual(trace, old, s.id + ' source commands unchanged');
        for (const item of D.knowledgePlan(trace))
            knowledge.set(item.id, {
                id : item.id,
                name : item.name,
                file : item.file,
                sha256 : C.sha(C.fs.readFileSync(C.path.join(C.pack, item.file)))
            });
        for (const variant of ['original', 'current', 'hd', 'proposed']) {
            if (variant === 'original' && !['report-science', 'report-intelligence'].includes(s.id))
                assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, s.original))),
                             C.sha(git('assets/atlas-hd/' + s.original)),
                             s.id + ' original preservation');
        }
        for (const p of plates.plates.filter(p => p.id === s.id)) {
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, p.file))), p.sha256);
            for (const row of p.regions.filter(r => r.kind === 'staggered-row')) {
                assert(row.textY >= row.band[1] &&
                           row.textY + row.textHeight <= row.band[1] + row.band[3],
                       row.name + ' band');
                assert(row.connector[2] === row.band[0]);
                assert(row.connector[0] >= row.icon[0] &&
                       row.connector[0] <= row.icon[0] + row.icon[2]);
                assert(row.connector[1] >= row.icon[1] &&
                       row.connector[1] <= row.icon[1] + row.icon[3]);
            }
        }
        if (s.id === 'report-losses')
            for (const c of D.foreground(trace).filter(c => /^\d+$/.test(c.text))) {
                const improved = D.enhanceText(c, s.id),
                      width = F.width(c.text, F.get(c.face, c.fontHeight, c.style));
                if (c.x === 256)
                    assert(improved.x >= 246 && improved.x + width <= 294,
                           'Primary count fits bracket');
                assert(improved.x >= improved.clip[0] && improved.x + width <= improved.clip[2]);
            }
        if (s.id === 'report-top-cities')
            for (const c of trace.commands.filter(c => c.asset === 'sprite' && +c.text >= 100 &&
                                                       +c.text < 128)) {
                const improved = D.enlargeWonder(c, trace, s.id);
                assert(improved.width > c.width && improved.height > c.height);
                const frame = trace.commands.find(f => f.asset === 'frame' && c.y >= f.y &&
                                                       c.y < f.y + f.height);
                assert(improved.x >= frame.x &&
                       improved.x + improved.width <= frame.x + frame.width);
                assert(improved.y >= frame.y &&
                       improved.y + improved.height <= frame.y + frame.height);
            }
        checks.push({
            scene : s.id,
            headerHeight : D.headerHeight(s.id),
            connectedRows : D.rows(trace, s.id).length,
            advanceRows : D.advanceRows(trace).length
        });
    }
    const pedia = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/enhanced-layouts.json'))
                      .filter(s => s.id.startsWith('pedia-'));
    for (const s of pedia) {
        const source = C.read(C.path.join(C.pack, 'review/traces/other-' + s.id + '.json'));
        assert.deepEqual(s.commands.filter(c => c.op === 'button')
                             .map(c => [c.text, c.x, c.y, c.width, c.height, !!c.disabled]),
                         source.commands.filter(c => c.op === 'button')
                             .map(c => [c.text, c.x, c.y, c.width, c.height, c.color === 128]),
                         s.id + ' source actions');
    }
    const enhanced =
        C.read(C.path.join(C.pack, 'review/fixtures/other-windows/enhanced-layouts.json'));
    const rules =
        C.read(C.path.join(C.pack, 'review/fixtures/other-windows/catalog.json')).CIVILIZE;
    for (const s of enhanced)
        for (const c of s.commands.filter(c => c.binding?.advanceId !== undefined)) {
            const id = c.binding.advanceId, name = rules[id][0], file = c.binding.new;
            assert.equal(file, D.knowledgeFile(name));
            knowledge.set(
                id, {id, name, file, sha256 : C.sha(C.fs.readFileSync(C.path.join(C.pack, file)))});
        }
    const items = [...knowledge.values() ].sort((a, b) => a.name.localeCompare(b.name));
    assert.equal(new Set(items.map(i => i.sha256)).size, items.length,
                 'Individual knowledge illustrations');
    assert.equal(
        C.sha(C.fs.readFileSync(C.path.join(C.pack, D.file('report-top-cities', false)))),
        C.sha(C.fs.readFileSync(C.path.join(C.pack, D.file('report-hall-of-fame', false)))),
        'Shared resource 57 native plate');
    for (const id of ['report-city-status', 'report-attitude', 'report-trade']) {
        const a = plates.plates.find(p => p.id === id && !p.enhanced && p.phase === 0),
              b = plates.plates.find(p => p.id === id && !p.enhanced && p.phase === 1);
        assert.equal(a.regions.length, b.regions.length);
        a.regions.forEach((r, i) => {
            assert.equal(r.x + b.regions[i].x, 68);
            assert.deepEqual(r.band, b.regions[i].band);
        });
    }
    C.json(C.path.join(C.pack, 'interface/reports/knowledge.json'), {
        scope :
            'Individual illustrations shared by the saved Science/Intelligence reports, enhanced Civilopedia and research selection; existing independently authored Atlas art. Other advances are not silently assigned repeated fallback symbols.',
        source :
            'src/auto/reports.cpp intel_draw_advances: original selection is category * 4 + epoch. Enhanced trace association validates exact rule name, category/epoch and source label-to-sprite offset.',
        advances : items
    });
    const p = new Painter(1440, 70 + Math.ceil(items.length / 8) * 140, 1);
    await p.text('Shared advance illustrations: reports, Civilopedia & research', 18, 12, 1400, 25);
    for (const [i, a] of items.entries()) {
        const x = (i % 8) * 180, y = 70 + Math.floor(i / 8) * 140;
        await p.image(a.file, x + 44, y + 4, 92, 80);
        await p.text(a.name, x + 4, y + 96, 172, 13, '#ecdbb4', 'middle');
    }
    C.write(C.path.join(C.pack, 'review/other-windows/advance-illustrations.png'),
            await p.finish());
    C.json(C.path.join(C.pack, 'review/other-windows/presentation-validation.json'), {
        status : 'pass',
        beforeCommit : before,
        gameSourceChanged : false,
        backgroundPlates : plates.plates.length,
        advanceIllustrations : items.length,
        originalChanges : intentionalOriginalChanges,
        originalOtherReportsPreserved : true,
        sourceMatchedCivilopediaButtons : pedia.map(s => s.id),
        pairedCityScrollPhases : 3,
        casualtyBracketContainsCounts : true,
        topCityWondersEnlargedWithinRows : true,
        reports : checks
    });
    const blocks =
        scenes.filter(s => s.mode === 'report')
            .map(
                s => `<section id="${s.id}"><h2>${
                    esc(s.title)}</h2><div class="grid"><figure><figcaption>HD only · same source layout</figcaption><img src="../../${
                    s.hd}" alt="${
                    esc(s.title)} HD"></figure><figure><figcaption>Enhanced</figcaption><img src="../../${
                    s.proposed}" alt="${esc(s.title)} enhanced"></figure></div><p><a href="../../${
                    D.file(s.id, false)}">Native-compatible background PNG</a> · <a href="../../${
                    D.file(s.id, true)}">Enhanced background PNG</a></p></section>`)
            .join('\n');
    C.write(
        C.path.join(C.pack, 'review/other-windows/report-refinements.html'),
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report layout refinements</title><style>body{background:#162e28;color:#ede3c8;font:16px/1.6 system-ui;margin:0}main{max-width:1600px;margin:auto;padding:28px}a{color:#dfc489}h1,h2{font-family:Georgia,serif}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}img{width:100%;height:auto}section{padding:22px 0;border-top:1px solid #566f5a}p{max-width:1100px}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><main><h1>Report layout refinements</h1><p><a href="index.html">All four variants</a> · <a href="presentation-validation.json">Validation</a> · <a href="../../OTHER-WINDOWS.md">Source and integration limits</a></p><p>Banding follows the source text rows and joins each staggered city/unit illustration. Header depth follows each report. The enhanced military views add readable headings; casualties count losses by civilization. Top Cities enlarges wonders within their existing rows. Civilopedia buttons now retain the source page’s actions and disabled state.</p><p>The original engine reuses 20 era/category icons. Its standalone report fixture now supplies the missing era field. Enhanced reports, Civilopedia and research selection share ${
            items
                .length} individually selected illustrations. Original and HD-only still follow the source icon selection.</p><img src="advance-illustrations.png" alt="Individual advance illustrations"><p>City, Attitude and Trade patterns are also available as background-only PNGs. Scrolling an odd number of rows flips the source icon columns, so those need <a href="../../interface/reports/layout.json">matching even/odd plates</a>. Selecting the phase, handling arbitrary sizes/fonts, and separating shared report resources requires a small renderer/loader change. No game code was changed here.</p>${
            blocks}</main></html>`);
    console.log(`Report design: ${plates.plates.length} plates, ${
        items
            .length} distinct advance illustrations, seven source-matched Civilopedia control sets.`);
}
if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {build};
