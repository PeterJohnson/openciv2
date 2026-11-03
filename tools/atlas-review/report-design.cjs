// Source-aligned report backgrounds and isolated enhanced presentation choices.
// The first three stages retain every foreground command from atlas-reports.exe.
const C = require('./common.cjs');
const F = require('./font.cjs');
const catalog = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/catalog.json'));
const prefix = 'interface/reports/';
const changedEnhanced = [
    ...['city-status', 'attitude', 'trade', 'science', 'defense', 'losses', 'intelligence',
        'wonders', 'top-cities', 'demographics', 'score', 'hall-of-fame']
        .map(s => 'report-' + s),
    ...['advances', 'advance', 'tree', 'unit', 'improvement', 'wonder', 'terrain'].map(
        s => 'pedia-' + s)
];
function foreground(trace) {
    return trace.commands.filter((c, i) => c.asset === 'text' &&
                                           !(trace.commands[i + 1]?.asset === 'text' &&
                                             trace.commands[i + 1].text === c.text &&
                                             Math.abs(trace.commands[i + 1].x - c.x) <= 2 &&
                                             Math.abs(trace.commands[i + 1].y - c.y) <= 2));
}
function advanceRows(trace) {
    const text = foreground(trace);
    return trace.commands.filter(c => c.asset === 'sprite' && +c.text >= 200 && +c.text < 220)
        .map(sprite => {
            const label = text.find(t => t.x === sprite.x + 38 && t.y === sprite.y + 2);
            if (!label)
                throw Error('Advance sprite without source label');
            const id = catalog.CIVILIZE.findIndex(r => r[0] === label.text);
            if (id < 0)
                throw Error('Unknown source advance ' + label.text);
            const rule = catalog.CIVILIZE[id];
            if (+sprite.text !== 200 + Number(rule[6]) * 4 + Number(rule[5]))
                throw Error('Advance category mismatch');
            return {sprite, label, id, name : label.text};
        });
}
function rows(trace, id) {
    const labels = foreground(trace),
          glyphs = trace.commands.filter(c => c.asset.endsWith('-glyph'));
    if ([
            'report-city-status', 'report-attitude', 'report-trade', 'report-defense',
            'report-losses'
        ].includes(id))
        return glyphs.map(g => {
            const label = labels.find(t => t.x === 140 && t.y >= g.y && t.y < g.y + 24);
            if (!label)
                throw Error('Glyph without matching source row');
            return {
                name : label.text,
                x : g.x,
                y : g.y,
                textY : label.y,
                textHeight : label.height,
                step : id === 'report-attitude' ? 32 : 24
            };
        });
    return [];
}
function headerHeight(id) {
    return {
        'report-wonders' : 42,
        'report-top-cities' : 28,
        'report-demographics' : 28,
        'report-score' : 41,
        'report-hall-of-fame' : 24,
        'report-intelligence' : 50
    }[id] ||
           66;
}
function background(trace, id, enhanced, phase = 0) {
    const w = trace.width, h = trace.height,
          head = (!enhanced && [ 'report-top-cities', 'report-hall-of-fame' ].includes(id))
                     ? 24
                     : headerHeight(id),
          end = 374;
    const colors = enhanced ? [ '#1b342f', '#2d4940' ] : [ '#465d50', '#536b5b' ];
    const edge = enhanced ? '#8f926c' : '#94a282';
    let body = `<rect width="${w}" height="${h}" fill="${colors[0]}"/><rect x="2" y="2" width="${
        w - 4}" height="${head - 2}" fill="${enhanced ? '#263f36' : '#526757'}"/><path d="M2 ${
        head}H${w - 2}" stroke="${edge}"/>`;
    const band = (x, y, width, height, color) =>
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}"/>`;
    const rowPlans = rows(trace, id).map(r => ({...r, x : phase ? 68 - r.x : r.x})),
          advance = advanceRows(trace);
    const regions = [];
    if (rowPlans.length) {
        const right = trace.commands.find(c => c.asset === 'scrollbar')?.x || w - 2;
        const cards = [];
        for (const [i, r] of rowPlans.entries()) {
            const y = r.textY - Math.floor((r.step - r.textHeight) / 2),
                  center = r.textY + r.textHeight / 2, color = colors[i % 2];
            body += band(138, y, right - 138, r.step, color);
            // The city/unit silhouettes retain their 64x48 footprint. A 32px-high
            // island leaves a corridor between same-column sprites for the link.
            const start = r.x + 60, cy = r.y + 24;
            body += `<path d="M${start} ${cy}L138 ${center}" stroke="${
                color}" stroke-width="14" stroke-linecap="round"/>`;
            cards.push(`<rect x="${r.x + 1}" y="${r.y + 8}" width="62" height="32" rx="5" fill="${
                color}"/>`);
            regions.push({
                kind : 'staggered-row',
                ...r,
                band : [ 138, y, right - 138, r.step ],
                icon : [ r.x + 1, r.y + 8, 62, 32 ],
                connector : [ start, cy, 138, center ]
            });
        }
        body += cards.join('');
    } else if (advance.length) {
        const ys = [...new Set(advance.map(a => a.sprite.y)) ].sort((a, b) => a - b);
        for (const [i, y] of ys.entries()) {
            body += band(2, y, w - 4, 22, colors[i % 2]);
            regions.push({
                kind : 'advance-row',
                y,
                height : 22,
                names : advance.filter(a => a.sprite.y === y).map(a => a.name)
            });
        }
    } else if (id === 'report-hall-of-fame' && enhanced) {
        for (let i = 0; i < 5; i++)
            body += band(2, 25 + i * 54, w - 4, 54, colors[i % 2]);
    } else if (id === 'report-demographics') {
        const ys =
            [...new Set(foreground(trace).filter(t => t.x === 2 && t.y >= 33).map(t => t.y)) ];
        ys.forEach((y, i) => body += band(2, y - 2, w - 4, 25, colors[i % 2]));
    } else if (id === 'report-top-cities' && enhanced) {
        trace.commands.filter(c => c.asset === 'frame')
            .forEach((c, i) => body += band(c.x, c.y, c.width, c.height, colors[i % 2]));
    } else if (id === 'report-wonders') {
        trace.commands.filter(c => c.asset === 'frame')
            .forEach((c, i) => body += band(c.x, c.y, c.width, c.height, colors[i % 2]));
    }
    body += `<path d="M2 ${end - 2}H${w - 2}" stroke="${edge}"/><rect x=".5" y=".5" width="${
        w - 1}" height="${h - 1}" fill="none" stroke="${edge}"/>`;
    return {body, regions, headerHeight : head};
}
function file(id, enhanced) { return prefix + id + (enhanced ? '-enhanced' : '-native') + '.png'; }
async function buildPlates(traces) {
    const entries = [], plates = [];
    for (const [id, trace] of Object.entries(traces))
        for (const enhanced of [false, true])
            for (const phase of !enhanced &&
                         [ 'report-city-status', 'report-attitude', 'report-trade' ].includes(id)
                     ? [ 0, 1 ]
                     : [ 0 ]) {
                const plan = background(trace, id, enhanced, phase),
                      png = file(id, enhanced).replace('.png', phase ? '-odd-scroll.png' : '.png'),
                      vector = png.replace('.png', '.svg');
                const source = C.svg(trace.width, trace.height, plan.body),
                      bytes = await C.sharp(Buffer.from(source), {density : 288}).png().toBuffer();
                C.write(C.path.join(C.pack, vector), source);
                C.write(C.path.join(C.pack, png), bytes);
                entries.push({
                    id : 'report-backgrounds.' + id + (enhanced ? '.enhanced' : '.native') +
                             (phase ? '.odd-scroll' : ''),
                    label : id + ' report background',
                    kind : 'interface',
                    category : 'window backgrounds',
                    description :
                        'Independent source-aligned background, without baked text or original-game pixels.',
                    file : png,
                    vector,
                    width : trace.width * 4,
                    height : trace.height * 4,
                    sha256 : C.sha(bytes),
                    sourceSha256 : C.sha(Buffer.from(source))
                });
                plates.push({
                    id,
                    enhanced,
                    phase,
                    file : png,
                    vector,
                    headerHeight : plan.headerHeight,
                    regions : plan.regions,
                    sha256 : C.sha(bytes)
                });
            }
    const manifest = C.read(C.path.join(C.pack, 'manifest.json'));
    manifest.entries =
        manifest.entries.filter(e => !e.id.startsWith('report-backgrounds.')).concat(entries);
    C.json(C.path.join(C.pack, 'manifest.json'), manifest);
    C.json(C.path.join(C.pack, prefix + 'layout.json'), {
        density : 4,
        source : 'src/auto/reports.cpp',
        plates,
        compatibility :
            'The native PNG plates can replace report backgrounds at the same logical size. No foreground positions change. Staggered rows repeat at the source row height. City/attitude/trade include even/odd scroll-phase alternatives: the game chooses icon columns from the absolute row index, so one fixed plate cannot track an odd scroll. Selecting the matching plate needs a small loader/render change; the supplied first-page mockups use phase zero. Runtime resizing, alternate fonts or different pagination require matching plates or dynamic bands; do not scale a fixed plate independently of its text.',
        sharedSourceResource :
            'Top Cities and Hall of Fame use tiles.dll/57 and deliberately have identical native plates. Enhanced plates differ. Defense/casualties share resource 51 with other history views, so applying their patterned plates globally needs per-window background selection; their preview plates are not a universal resource replacement.'
    });
}

const mapped = (kind, index) =>
    C.entries.find(e => e.mapping?.kind === kind && e.mapping.index === index).file;
// Individually selected existing Atlas illustrations, not recolored category icons.
const knowledge = {
    'Alphabet' : [ 'improvement', 6 ],
    'Astronomy' : [ 'wonder', 11 ],
    'Banking' : 'interface/economy/gold.png',
    'Bridge Building' : [ 'improvement', 9 ],
    'Bronze Working' : [ 'unit', 3 ],
    'Ceremonial Burial' : [ 'improvement', 4 ],
    'Chemistry' : 'interface/economy/science.png',
    'Chivalry' : [ 'unit', 19 ],
    'Code of Laws' : [ 'improvement', 7 ],
    'Communism' : [ 'wonder', 21 ],
    'Conscription' : [ 'unit', 11 ],
    'Construction' : [ 'improvement', 14 ],
    'Currency' : [ 'improvement', 5 ],
    'Democracy' : [ 'wonder', 19 ],
    'Economics' : [ 'improvement', 22 ],
    'Electricity' : 'sprites/knowledge/electricity.png',
    'Engineering' : [ 'unit', 1 ],
    'Explosives' : [ 'unit', 24 ],
    'Feudalism' : [ 'unit', 6 ],
    'Gunpowder' : [ 'unit', 7 ],
    'Horseback Riding' : [ 'unit', 15 ],
    'Industrialization' : [ 'improvement', 15 ],
    'Invention' : [ 'wonder', 14 ],
    'Iron Working' : [ 'unit', 5 ],
    'Literacy' : [ 'wonder', 4 ],
    'Map Making' : [ 'unit', 33 ],
    'Masonry' : [ 'wonder', 0 ],
    'Mathematics' : 'sprites/advances/science-ancient.png',
    'Monarchy' : [ 'improvement', 1 ],
    'Monotheism' : [ 'improvement', 11 ],
    'Mysticism' : [ 'wonder', 5 ],
    'Navigation' : 'sprites/advances/science-medieval.png',
    'Philosophy' : 'sprites/advances/society-ancient.png',
    'Polytheism' : [ 'wonder', 2 ],
    'Pottery' : [ 'improvement', 3 ],
    'The Republic' : [ 'wonder', 24 ],
    'Seafaring' : [ 'unit', 32 ],
    'Trade' : [ 'unit', 48 ],
    'Warrior Code' : [ 'unit', 4 ],
    'The Wheel' : [ 'unit', 16 ]
};
function knowledgeFile(name) {
    const item = knowledge[name];
    if (!item)
        throw Error('Missing individual advance illustration: ' + name);
    return typeof item === 'string' ? item : mapped(...item);
}
function knowledgePlan(trace) {
    return advanceRows(trace).map(
        a => ({id : a.id, name : a.name, file : knowledgeFile(a.name), sprite : a.sprite}));
}
function lossColumns() {
    const facts =
        C.read(C.path.join(C.pack, 'review/fixtures/other-windows/inputs.json')).civilizations;
    return [ 6, 1, 2, 3, 4, 5, 7 ].map(
        (civ, i) => ({
            civ,
            name : facts.find(c => c.id === civ).name,
            label : [ 'English', 'Celts', 'Babyl.', 'French', 'Egypt.', 'Amer.', 'Sioux' ][i],
            sourceX : 256 + i * 30,
            x : 248 + i * 48,
            width : 44
        }));
}
function enhanceText(c, id) {
    if (id === 'report-defense' && c.x >= 323 && c.x < 449)
        return {
            ...c,
            text : c.text.replace(/ active$/, '').replace(/ in prod$/, ''),
            clip : [ c.x, c.y, c.x + (c.x < 384 ? 60 : 65), c.y + c.height + 3 ],
            fontHeight : 14
        };
    if (id === 'report-losses' && /^\d+$/.test(c.text)) {
        const col = lossColumns().find(q => q.sourceX === c.x);
        if (!col)
            throw Error('Unmapped casualty column');
        const width = F.width(c.text, F.get(c.face, c.fontHeight, c.style));
        return {
            ...c,
            x : col.x + Math.floor((col.width - width) / 2),
            clip : [ col.x, c.y, col.x + col.width, c.y + c.height + 3 ]
        };
    }
    return c;
}
function enlargeWonder(c, trace, id) {
    if (id !== 'report-top-cities' || c.asset !== 'sprite' || +c.text < 100 || +c.text >= 128)
        return c;
    const peers = trace.commands.filter(q => q.asset === 'sprite' && +q.text >= 100 &&
                                             +q.text < 128 && q.y === c.y);
    const i = peers.indexOf(c), step = Math.min(50, Math.floor((trace.width - 337) / peers.length));
    return {...c, x : 333 + i * step, y : c.y - 11, width : step - 2, height : 34};
}
module.exports = {
    foreground,
    advanceRows,
    rows,
    headerHeight,
    file,
    buildPlates,
    knowledgePlan,
    knowledgeFile,
    lossColumns,
    enhanceText,
    enlargeWonder,
    changedEnhanced
};
