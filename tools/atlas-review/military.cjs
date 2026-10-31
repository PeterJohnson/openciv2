const C = require('./common.cjs');
const assert = require('node:assert/strict');
const eras = [ 'ancient', 'medieval', 'industrial', 'modern' ];
const ratings = [ 'Pathetic', 'Weak', 'Inadequate', 'Moderate', 'Strong', 'Mighty', 'Supreme' ];
const art = eras.map(era => `sprites/advances/military-${era}.png`);
const on = '#d4b467', off = '#1a302e';

function categoryFile(c) {
    const era = (c.sx - 1) / 109;
    assert(c.resource === 215 && c.sy === 156 && Number.isInteger(era) && art[era],
           'Expected an era-specific military crop');
    return art[era];
}

function model(trace) {
    const {styleEra, powerRank} = trace;
    assert(Number.isInteger(styleEra) && styleEra >= 0 && styleEra < 4, 'Supplied era required');
    assert(Number.isInteger(powerRank) && powerRank >= 1 && powerRank <= 7, 'Source rank domain is 1..7');
    const rows = trace.commands.filter(c => c.asset === 'resource' && c.resource === 215 && c.sy === 156);
    assert.equal(rows.length, powerRank - 1, 'Source repeats rank minus one symbols');
    rows.forEach(c => assert.equal(categoryFile(c), art[styleEra]));
    return {
        era : eras[styleEra],
        rank : powerRank,
        label : ratings[powerRank - 1],
        file : art[styleEra],
        filled : rows.length,
        segments : 6
    };
}

// Enhanced-only presentation of the same source rank, not unit composition or a troop count.
async function enhanced(p, trace, x = 24, y = 107) {
    const m = model(trace);
    await p.text('Overall power', x + 8, y + 31, 128, 10, '#c9d1b7', 'middle');
    await p.image(m.file, x + 26, y + 59, 92, 85);
    await p.text(m.label, x + 8, y + 155, 128, 19, '#f0dfb2', 'middle');
    for (let i = 0; i < m.segments; i++)
        await p.box(x + 13 + i * 20, y + 198, 18, 8, i < m.filled ? on : off, '#8f8864', 2);
    await p.text('Relative to rivals', x + 8, y + 218, 128, 9, '#b9c5ad', 'middle');
    return m;
}

function build() {
    C.json(C.path.join(C.pack, 'interface/diplomacy/military.json'), {
        sources : [
            'src/auto/diplomacy.cpp:4670-4724', 'src/auto/civ.cpp:2993-3077', 'src/auto/reports.cpp:1576-1577'
        ],
        labels : 'Foreign minister label indices 0xe3 + rank; English LABELS.TXT lines 245-251.',
        ranks : ratings.map((label, i) => ({rank : i + 1, label, nativeSymbols : i})),
        eras : eras.map((era, i) => ({era, sourceX : i * 109 + 1, sourceY : 156, file : art[i]})),
        meaning :
            'Relative civilization power rank, not a roster, unit type, unit count or absolute combat-strength score.',
        native : 'Repeat one era-specific weapon symbol rank minus one times; no per-row labels.',
        enhanced : 'One era emblem, one overall rating label, and six segments with rank minus one filled.',
        limits :
            'Supplied fixture rank. No simulation of ranking and no change to game source. English rating label is an enhanced addition to the audience, reused from the foreign-minister report.'
    });
}

async function review(W) {
    const file = C.path.join(C.root, 'build/atlas-review/military-edge.txt');
    const gallery = new W.Painter(672, 900, 1);
    await gallery.text('Diplomacy · relative power', 16, 6, 640, 21);
    await gallery.text('Same rank as the native weapon rows; four eras, low / fixture / highest rating', 16,
                       34, 640, 11);
    let checks = 0, invalid = 0;
    for (let era = 0; era < 4; era++) {
        assert(C.fs.existsSync(C.path.join(C.pack, art[era])));
        for (let rank = 1; rank <= 7; rank++) {
            // Zero advances also exercises the no-resource-215 path at rank one.
            C.write(file, `3 14 ${era} ${rank}\n0\n`);
            const trace = W.windowEngine('diplomacy', file);
            assert.deepEqual(trace, W.windowEngine('diplomacy', file, 'Debug'));
            const rows = trace.commands.filter(c => c.asset === 'resource' && c.resource === 215);
            assert.equal(rows.length, rank - 1);
            rows.forEach((c, i) => assert.deepEqual([ c.sx, c.sy, c.x, c.y, c.width, c.height ],
                                                    [ era * 109 + 1, 156, 45, 130 + 31 * i, 108, 30 ]));
            const p = new W.Painter(144, 251, 1), texts = [], boxes = [];
            const originalText = p.text.bind(p), originalBox = p.box.bind(p);
            p.text = async (...args) => {
                texts.push(args);
                await originalText(...args);
            };
            p.box = async (...args) => {
                boxes.push(args);
                await originalBox(...args);
            };
            const m = await enhanced(p, trace, 0, 0);
            assert.equal(texts.filter(t => t[0] === ratings[rank - 1]).length, 1);
            assert(!texts.some(t => /regiment/i.test(t[0])));
            assert.equal(boxes.length, 6);
            assert.equal(boxes.filter(b => b[4] === on).length, rank - 1);
            assert.equal(p.ops.length, 1);
            assert.equal(p.ops[0].file, art[era]);
            assert.equal(m.filled, rows.length);
            for (const [s, x, y, width, size] of texts) {
                const widthEstimate = s.length * size * .65;
                assert(widthEstimate <= width && x >= 0 && x + width <= 144 && y + size * 1.45 < 251);
            }
            if ([ 1, 6, 7 ].includes(rank)) {
                const x = era * 168 + 12, y = [ 1, 6, 7 ].indexOf(rank) * 278 + 60;
                await gallery.image('interface/windows/panel.png', x, y, 144, 251, {contain : false});
                await gallery.text(eras[era].toUpperCase(), x + 8, y + 7, 128, 11, '#f0dfb2', 'middle');
                await enhanced(gallery, trace, x, y);
            }
            checks++;
        }
    }
    for (const config of ['Debug', 'Release']) {
        for (const [era, rank] of [[ 2, 0 ], [ 2, 8 ], [ -1, 6 ], [ 4, 6 ]]) {
            C.write(file, `3 14 ${era} ${rank}\n0\n`);
            assert.throws(() => W.windowEngine('diplomacy', file, config), /Diplomacy fixture domain/);
            invalid++;
        }
    }
    const plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json'));
    const main = C.read(C.path.join(C.pack, 'review/traces/diplomacy.json')), m = model(main);
    for (const stage of ['current', 'hd', 'proposed']) {
        const ops = plans['diplomacy-' + stage].filter(o => art.includes(o.file));
        assert.equal(ops.length, stage === 'proposed' ? 1 : m.filled);
        assert(ops.every(o => o.file === m.file));
        if (stage !== 'proposed')
            ops.forEach((o, i) =>
                            assert.deepEqual([ o.x, o.y, o.width, o.height ], [ 45, 130 + 31 * i, 108, 30 ]));
        assert(!plans['diplomacy-' + stage].some(o => o.file === 'sprites/units/riflemen.png'));
    }
    C.write(C.path.join(C.pack, 'review/military-ratings.png'), await gallery.finish());
    C.json(C.path.join(C.pack, 'review/military-validation.json'), {
        status : 'pass',
        eraRankCases : checks,
        debugReleaseEqual : true,
        invalidFixturesRejected : invalid,
        sourceDomain : [ 1, 7 ],
        nativeSymbolCounts : [ 0, 6 ],
        enhancedSegments : 6,
        fixture : m,
        preservedNativeRectangles : true,
        replacementStages : 3,
        limits : 'Source draw trace and supplied rank only, not full-game ranking or diplomacy execution.'
    });
    console.log(
        'Military review passed: four eras × seven ranks, native rows, enhanced rating and D/R parity');
}

module.exports = {
    categoryFile,
    model,
    enhanced,
    build,
    review
};
if (require.main === module)
    review(require('./windows.cjs')).catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
