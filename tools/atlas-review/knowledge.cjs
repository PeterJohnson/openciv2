const C = require('./common.cjs');
const assert = require('node:assert/strict');
const eras = [ 'ancient', 'medieval', 'industrial', 'modern' ];
// Actual AdvanceId values and RULES.TXT category numbers; depths are supplied
// review values that retain the existing six-row display order, not research simulation.
const advances = [
    {
        id : 6,
        constant : 'ADV_BANKING',
        name : 'Banking',
        category : 1,
        depth : 1,
        file : 'interface/economy/gold.png',
        symbol : 'Antique gold coin'
    },
    {
        id : 25,
        constant : 'ADV_ENGINEERING',
        name : 'Engineering',
        category : 4,
        depth : 2,
        file : 'sprites/advances/economy-industrial.png',
        symbol : 'Steam governor'
    },
    {
        id : 50,
        constant : 'ADV_MEDICINE',
        name : 'Medicine',
        category : 1,
        depth : 3,
        file : 'sprites/knowledge/medicine.png',
        symbol : 'Apothecary mortar, herbs and bandage'
    },
    {
        id : 57,
        constant : 'ADV_NAVIGATION',
        name : 'Navigation',
        category : 1,
        depth : 4,
        file : 'sprites/advances/science-medieval.png',
        symbol : 'Brass astrolabe'
    },
    {
        id : 61,
        constant : 'ADV_PHYSICS',
        name : 'Physics',
        category : 3,
        depth : 5,
        file : 'sprites/advances/science-modern.png',
        symbol : 'Atom model'
    },
    {
        id : 23,
        constant : 'ADV_ELECTRICITY',
        name : 'Electricity',
        category : 4,
        depth : 6,
        file : 'sprites/knowledge/electricity.png',
        symbol : 'Copper induction coil and spark'
    }
];
const categories = [ 'Military', 'Economic', 'Social', 'Academic', 'Applied' ];
const sourceRows = [ 32, 63, 94, 1, 125 ];
const fixtureText =
    advances.length + '\n' + advances.map(a => `${a.id} ${a.category} ${a.depth}`).join('\n') + '\n';

function advance(id) {
    const a = advances.find(a => a.id === id);
    if (!a)
        throw Error('No supplied knowledge binding for advance ' + id);
    return a;
}

function categoryFile(command) {
    const category = sourceRows.indexOf(command.sy), era = eras[(command.sx - 1) / 109];
    if (category < 0 || !era)
        throw Error('Unknown diplomacy category crop');
    return category === 4
               ? `sprites/diplomacy/exploration-${era}.png`
               : `sprites/advances/${['military', 'economy', 'society', 'science'][category]}-${era}.png`;
}

function build() {
    C.json(C.path.join(C.pack, 'interface/knowledge/bindings.json'), {
        source : [ 'src/auto/diplomacy.cpp:4778-4779,4981-5004', 'src/include/enums.h:93-116' ],
        categorySource :
            'RULES.TXT @CIVILIZE numeric categories: Banking/Medicine/Navigation=1, Physics=3, Engineering/Electricity=4',
        categoryNames : categories,
        categoryCropRows : sourceRows,
        eras,
        advances,
        limits :
            'Six supplied advances with actual IDs/categories and fixture-only ranking depths. Original/native/HD use era/category icons; enhanced selects per-advance art. No game source change.'
    });
}

async function review(W) {
    const trace = W.windowEngine('diplomacy', C.path.join(C.pack, 'review/fixtures/diplomacy.txt'));
    assert.deepEqual(
        trace, W.windowEngine('diplomacy', C.path.join(C.pack, 'review/fixtures/diplomacy.txt'), 'Debug'));
    const rows = trace.commands.filter(c => c.asset === 'resource' && c.resource === 215 && c.sy !== 156),
          labels = trace.commands.filter(c => c.asset === 'tech-label'), expected = [...advances ].reverse(),
          plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json')),
          enums = C.fs.readFileSync(C.path.join(C.root, 'src/include/enums.h'), 'utf8');
    assert.deepEqual(labels.map(c => +c.text), [ 23, 61, 57, 50, 25, 6 ]);
    assert.equal(rows.length, 6);
    for (const [i, c] of rows.entries()) {
        const a = expected[i];
        assert.equal(+c.text, a.id, 'Icon keeps the selected advance identity');
        assert.equal(c.sy, sourceRows[a.category], 'Actual source category row');
        assert(new RegExp(`\\b${a.constant}\\s*=\\s*${a.id}\\b`).test(enums), 'Actual enum ID: ' + a.name);
        assert(C.fs.existsSync(C.path.join(C.pack, a.file)), a.file);
    }
    assert.equal(new Set(expected.map(a => C.sha(C.fs.readFileSync(C.path.join(C.pack, a.file))))).size, 6);
    for (const stage of ['current', 'hd', 'proposed']) {
        const known = new Set([...rows.map(categoryFile), ...advances.map(a => a.file) ]),
              icons = plans[`diplomacy-${stage}`].filter(o => known.has(o.file));
        assert.deepEqual(icons.map(o => o.file),
                         stage === 'proposed' ? expected.map(a => a.file) : rows.map(categoryFile));
        icons.forEach((o, i) => {
            assert.equal(o.y, rows[i].y);
            assert(o.x + o.width <= (stage === 'proposed' ? 515 : labels[i].x), 'Icon clear of label');
        });
    }
    for (let era = 0; era < 4; era++)
        for (const sy of sourceRows)
            assert(C.fs.existsSync(C.path.join(C.pack, categoryFile({sx : era * 109 + 1, sy}))),
                   'Complete era/category bindings');
    const edge = C.path.join(C.root, 'build/atlas-review/knowledge-edge.txt');
    let invalidFixturesRejected = 0;
    for (const config of ['Debug', 'Release']) {
        C.write(edge, '3 14 2 6\n0\n');
        const empty = W.windowEngine('diplomacy', edge, config);
        assert(!empty.commands.some(c => c.asset === 'tech-label' ||
                                         (c.asset === 'resource' && c.resource === 215 && c.sy !== 156)),
               'No knowledge rows without advances');
        for (const input of ['3 14 2 6\n1\n6 5 1\n', '3 14 2 6\n2\n6 1 1\n6 1 2\n']) {
            C.write(edge, input);
            assert.throws(() => W.windowEngine('diplomacy', edge, config), /advance fixture domain/);
            invalidFixturesRejected++;
        }
    }
    const p = new W.Painter(1080, 240, 1);
    await p.text('Knowledge · six advance-specific icons', 16, 8, 1040, 22);
    await p.text('Large artwork and the enhanced window’s 27×27 logical icon size', 16, 38, 1040, 13);
    for (const [i, a] of advances.entries()) {
        const x = i * 180;
        await p.image(a.file, x + 36, 70, 96, 96);
        await p.image(a.file, x + 70, 176, 27, 27);
        await p.text(a.name, x + 3, 212, 174, 13, '#ead6a2', 'middle');
    }
    C.write(C.path.join(C.pack, 'review/knowledge-icons.png'), await p.finish());
    C.json(C.path.join(C.pack, 'review/knowledge-validation.json'), {
        status : 'pass',
        emptyAdvanceSets : 2,
        invalidFixturesRejected,
        actualAdvanceIds : expected.map(a => a.id),
        sourceCategories : expected.map(a => a.category),
        eraCategoryBindings : 20,
        distinctEnhancedIcons : 6,
        stageBindings : 3,
        debugReleaseEqual : true,
        iconIdentity :
            'Resource draw commands retain their advance ID; association does not depend on label text or row position.'
    });
    console.log(
        'Knowledge review passed: six distinct advance icons, 20 era/category bindings and three replacement stages');
}

module.exports = {
    advances,
    fixtureText,
    advance,
    categoryFile,
    build,
    review
};
if (require.main === module)
    review(require('./windows.cjs')).catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
