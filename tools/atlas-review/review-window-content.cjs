const C = require('./common.cjs'), F = require('./font.cjs'), D = require('./enhanced-details.cjs');
const assert = require('node:assert/strict'), {spawnSync} = require('node:child_process');
const Reports = require('./report-render.cjs');
const before = '16f21181';
const esc = s =>
    String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function prior(file) {
    const r = spawnSync('git', [ 'show', before + ':assets/atlas-hd/' + file ],
                        {cwd : C.root, maxBuffer : 32 * 1024 * 1024});
    assert.equal(r.status, 0, r.stderr.toString());
    return r.stdout;
}
async function build() {
    const layouts =
        C.read(C.path.join(C.pack, 'review/fixtures/other-windows/enhanced-layouts.json'));
    const scenes = C.read(C.path.join(C.pack, 'review/other-windows/scenes.json'));
    let preservedBaselines = 0, preservedEnhanced = 0;
    for (const scene of scenes) {
        for (const mode of ['original', 'current', 'hd']) {
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, scene[mode]))),
                         C.sha(prior(scene[mode])), scene.id + ' ' + mode);
            preservedBaselines++;
        }
        if (!D.changedScenes.includes(scene.id)) {
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, scene.proposed))),
                         C.sha(prior(scene.proposed)), scene.id + ' unchanged enhanced');
            preservedEnhanced++;
        }
    }
    const results = [];
    for (const id of D.changedScenes) {
        const s = layouts.find(s => s.id === id), source = D.source(id), sourceText = D.texts(id);
        const drawn = s.commands.filter(c => c.op === 'text');
        assert.deepEqual(
            s.commands.filter(c => c.op === 'button').map(c => [c.text, !!c.disabled]),
            source.commands.filter(c => c.op === 'button').map(c => [c.text, c.color === 128]),
            id + ' actions and order');
        for (const c of drawn) {
            const font = F.get(0, c.size, c.bold ? 1 : 0);
            assert(F.width(c.text, font) <= c.width, id + ': clipped ' + c.text);
            assert(c.x >= 0 && c.y >= 0 && c.x + c.width <= s.width &&
                       c.y + font.cellHeight <= s.height,
                   id + ': text outside canvas');
        }
        const renderedSource = new Set(drawn.map(c => (c.sourceText || c.text).trim()));
        if ([
                'pedia-terrain', 'foreign-minister', 'status-panel', 'destroyed-civilizations'
            ].includes(id))
            for (const c of sourceText)
                assert(renderedSource.has(c.text.trim()), id + ': missing ' + c.text);
        if (id === 'tax-rates') {
            for (const c of sourceText.filter(c => c.y > 10))
                assert(renderedSource.has(c.text.trim()), 'Tax content: ' + c.text);
            const sliders = s.commands.filter(c => c.op === 'slider');
            assert.deepEqual(sliders.map(c => c.value), [ 40, 60, 0 ]);
            const icons = s.commands.filter(c => c.taxRole);
            assert.equal(icons.length, 3);
            icons.forEach((icon, i) => {
                const text =
                    drawn.find(c => c.text.startsWith([ 'Taxes:', 'Science:', 'Luxuries:' ][i]));
                assert(icon.x + icon.width <= text.x && Math.abs(icon.y - text.y) <= 2);
                assert(icon.y + icon.height <= sliders[i].y, 'Tax icon clears slider');
            });
        }
        if ([ 'dialog-research', 'dialog-production' ].includes(id)) {
            const choices = D.choices(id);
            assert.equal(choices.length, id === 'dialog-research' ? 7 : 16);
            for (const row of choices) {
                assert(renderedSource.has(row.label.text.trim()),
                       'Missing option ' + row.label.text);
                if (row.detail) {
                    const values =
                        row.detail.text.match(/^\((\d+) Turns(?:, ADM: ([\d/]+) HP: ([\d/]+))?\)$/);
                    assert(renderedSource.has(row.detail.text));
                    const line = drawn.find(c => c.text === row.label.text.trim());
                    for (const value of values.slice(1).filter(Boolean))
                        assert(drawn.some(c => c.y === line.y && c.text === value),
                               row.label.text + ': missing stat ' + value);
                }
            }
        }
        if (id === 'destroyed-civilizations') {
            const boxes = s.commands.filter(c => c.kind === 'scrim');
            assert.equal(boxes.length, 2);
            for (const c of s.commands.filter(c => c.op === 'text' || c.op === 'image')) {
                const height = c.height || F.get(0, c.size, c.bold ? 1 : 0).cellHeight;
                assert(boxes.some(b => c.x >= b.x && c.y >= b.y && c.x + c.width <= b.x + b.width &&
                                       c.y + height <= b.y + b.height),
                       'Destruction content needs dark backing');
            }
        }
        for (const c of s.commands.filter(c => c.binding?.advanceId !== undefined)) {
            const name = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/catalog.json'))
                             .CIVILIZE[c.binding.advanceId][0];
            assert.equal(c.binding.new, D.advance(name).new, id + ' consistent advance art');
        }
        for (const c of s.commands.filter(c => c.op === 'native-glyph')) {
            const native =
                source.commands.find(q => q.op === c.command.op && q.text === c.command.text);
            assert(native && native.color === c.command.color, id + ' same saved glyph and flags');
            const fixture = C.path.join(C.root, 'build/atlas-review/generated/other',
                                        'other-enhanced-' + id + '-replacement.txt');
            process.env.ATLAS_CONFIG = 'Release';
            const a = Reports.run('atlas-engine.exe', [ 'report-glyphs', fixture ]);
            process.env.ATLAS_CONFIG = 'Debug';
            assert.deepEqual(Reports.run('atlas-engine.exe', [ 'report-glyphs', fixture ]), a,
                             id + ' glyph D/R');
            delete process.env.ATLAS_CONFIG;
        }
        results.push({
            id,
            sourceTraceSha256 : C.sha(
                C.fs.readFileSync(C.path.join(C.pack, 'review/traces/other-' + id + '.json'))),
            buttons : s.commands.filter(c => c.op === 'button').map(c => c.text),
            textFits : true
        });
    }
    C.json(C.path.join(C.pack, 'review/other-windows/content-validation.json'), {
        status : 'pass',
        beforeCommit : before,
        preservedBaselines,
        preservedEnhanced,
        researchChoices : 7,
        productionChoices : 16,
        sourceTextAndControlChecks : results,
        scope :
            'Finite enhanced scene content/layout validation against extracted traces; no interactive-runtime parity claim.'
    });
    const blocks =
        D.changedScenes
            .map(id => {
                const s = scenes.find(s => s.id === id);
                return `<section id="${id}"><h2>${esc(s.title)}</h2><div class="grid">${
                        [[ 'original', 'Original artwork / extracted source' ],
                         [ 'proposed', 'Enhanced / restored source content' ]]
                            .map(([ mode, label ]) =>
                                     `<figure><figcaption>${label}</figcaption><a href="../../${
                                         s[mode]}"><img src="../../${s[mode]}" alt="${
                                         esc(s.title)} ${mode}"></a></figure>`)
                            .join('')}</div></section>`;
            })
            .join('\n');
    C.write(
        C.path.join(C.pack, 'review/other-windows/content-refinements.html'),
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Enhanced window content</title><style>body{background:#162e28;color:#ede3c8;font:16px/1.6 system-ui;margin:0}main{max-width:1700px;margin:auto;padding:28px}a{color:#dfc489}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}img{width:100%;height:auto}section{padding:22px 0;border-top:1px solid #566f5a}p{max-width:1100px}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><main><h1>Enhanced window content</h1><p><a href="index.html">All four variants</a> Â· <a href="content-validation.json">Content and preservation checks</a> Â· <a href="../../OTHER-WINDOWS.md">Source boundaries and rebuild</a></p><p>Shared advance illustrations now appear in Civilopedia and research selection. Forest restores transformation, resources and worker turns. Foreign Minister restores our power/reputation and the source actions. Status uses the saved active unit and all its source information. Tax labels and icons align, with actual 40/60/0 allocations and calculated totals. Production includes all sixteen source choices, build times, unit statistics and Auto / Help / OK. The destruction screen has dark portrait and text panels, with the source date.</p><p>All 105 original/native/HD baseline images and 25 unrelated enhanced images are byte-for-byte unchanged. Enhanced layouts remain standalone proposals, not integrated game windows. The Civilopedia tree remains a focused immediate-prerequisite/successor diagram.</p>${
            blocks}</main></html>`);
    console.log(`Enhanced content: ${results.length} scenes; ${preservedBaselines} baseline and ${
        preservedEnhanced} unrelated enhanced images preserved.`);
}
if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {build};
