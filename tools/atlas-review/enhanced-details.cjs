// Enhanced layouts consume the same retained source traces as the baseline scenes.
// These finite adapters reflow content; they do not calculate game state.
const C = require('./common.cjs'), F = require('./font.cjs');
const Design = require('./report-design.cjs'), Reports = require('./report-render.cjs');
const NativeOther = require('./native-other.cjs'), E = require('./economy.cjs');
const rules = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/catalog.json'));
const changedScenes = [
    'pedia-advances', 'pedia-advance', 'pedia-tree', 'pedia-terrain', 'foreign-minister',
    'destroyed-civilizations', 'status-panel', 'tax-rates', 'dialog-research', 'dialog-production'
];
function source(id) { return C.read(C.path.join(C.pack, 'review/traces/other-' + id + '.json')); }
function texts(id) {
    const t = source(id), seen = new Set();
    return t.commands.filter((c, i) => {
        if (!['text', 'wrapped'].includes(c.op))
            return false;
        const next = t.commands[i + 1];
        if (next?.op === c.op && next.text === c.text && Math.abs(next.x - c.x) <= 2 &&
            Math.abs(next.y - c.y) <= 2)
            return false;
        const key = [ c.text, c.x, c.y ].join('|');
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function one(id, predicate) {
    const found = texts(id).filter(predicate);
    if (found.length !== 1)
        throw Error(`${id}: expected one source text, got ${found.length}`);
    return found[0];
}
function binding(key) {
    return {old : NativeOther.file(key, true), new : NativeOther.file(key, false)};
}
function advance(name) {
    const id = rules.CIVILIZE.findIndex(r => r[0] === name);
    if (id < 0)
        throw Error('Unknown advance ' + name);
    const row = rules.CIVILIZE[id], slot = +row[6] * 4 + +row[5];
    return {
        old : Reports.sprite(200 + slot, true),
        new : Design.knowledgeFile(name),
        advanceId : id
    };
}
function buttons(s, exact = false) {
    const controls = source(s.id).commands.filter(c => c.op === 'button');
    s.commands = s.commands.filter(c => c.op !== 'button');
    if (exact)
        for (const c of controls)
            s.add('button', {
                text : c.text,
                x : c.x,
                y : c.y,
                width : c.width,
                height : c.height,
                disabled : c.color === 128
            });
    else {
        s.footer(controls.map(c => c.text));
        s.commands.filter(c => c.op === 'button')
            .forEach((c, i) => c.disabled = controls[i].color === 128);
    }
}
function label(s, c, x, y, size, width, options = {}) {
    s.text(c.text.trim(), x, y, size, width, {sourceText : c.text, ...options});
}
function annotate(s) {
    s.note =
        'Enhanced reflow of the same extracted source content and saved-state fixture as the original/HD views; no game renderer changes.';
    s.sourceTrace = 'review/traces/other-' + s.id + '.json';
    s.sourceTraceSha256 = C.sha(C.fs.readFileSync(C.path.join(C.pack, s.sourceTrace)));
    return s;
}
function choices(id) {
    const t = source(id), lines = texts(id);
    return lines.filter(c => c.x === 88 && c.y > 30).map(c => {
        const icon = t.commands.find(q => q.op === 'sprite' &&
                                          /^(advance|unit|improvement)\//.test(q.text) &&
                                          Math.abs(q.y - c.y) < 10);
        if (!icon)
            throw Error('Missing source option icon: ' + c.text);
        return {
            label : c,
            icon,
            detail : lines.find(q => q.y === c.y && q.x > 88),
            selected : c.color === 41
        };
    });
}
function forest(s) {
    const id = s.id, all = texts(id);
    s.text('Forest', 50, 7, 24, 540, {center : true, bold : true});
    s.image(binding('terrain/3'), 18, 56, 128, 64);
    s.image(binding('feature/forest/0'), 18, 56, 128, 64);
    const rows = all.filter(c => c.x === 20 && c.y >= 124);
    const names = [
        'Movement cost', 'Defense bonus', 'Food', 'Shields', 'Trade', 'Irrigation',
        'Turns to irrigate', 'Mining', 'Turns to mine'
    ];
    rows.forEach((c, i) => {
        const value = one(id, q => q.x === 210 && q.y === c.y), y = 126 + i * 24;
        s.text(names[i] + ':', 18, y, 17, 196, {sourceText : c.text});
        label(s, value, 222, y, 17, 84, {link : value.color === 85});
        const role = [ 'food', 'production', 'trade' ][i - 2];
        if (role)
            s.image(binding('economy/' + role), 262, y + 2, 18, 18);
    });
    s.box(318, 122, 302, 220, 'card');
    const right = all.filter(c => c.x >= 310 && c.y >= 124);
    const short = {'Effect of Engineer Transformation: ' : 'Engineer transformation:'};
    right.forEach((c, i) => s.text(short[c.text] || c.text.trim(), 330 + (c.x >= 330 ? 12 : 0),
                                   131 + i * 27, 17, c.x >= 330 ? 266 : 278,
                                   {sourceText : c.text, link : c.color === 85}));
    annotate(s);
}
function advancePage(s) {
    s.text('Railroad', 55, 7, 24, 530, {center : true, bold : true});
    s.image(advance('Railroad'), 22, 56, 70, 48);
    s.text('Prerequisites', 110, 53, 18, 500);
    for (const [name, x] of [[ 'Steam Engine', 112 ], [ 'Bridge Building', 354 ]]) {
        s.image(advance(name), x, 79, 40, 30);
        s.text(name, x + 48, 83, 17, 200, {link : true});
    }
    s.box(18, 130, 604, 88, 'card');
    s.text('Allows', 30, 139, 18, 570);
    s.image(advance('Industrialization'), 30, 171, 38, 30);
    s.text('Industrialization', 76, 173, 17, 225, {link : true});
    s.text('with', 302, 173, 17, 52);
    s.image(advance('Banking'), 355, 171, 32, 30);
    s.text('Banking', 397, 173, 17, 200, {link : true});
    // The source uses improvement 57, i.e. wonder 18 (Darwin), not Theatre.
    s.image(binding('improvement/57'), 30, 244, 90, 62);
    s.text("Darwin's Voyage", 140, 261, 21, 450, {link : true});
    annotate(s);
}
function foreign(Scene) {
    const id = 'foreign-minister',
          s = new Scene(id, 'Foreign Minister', 680, 320, 'foreign').heading();
    const summary = one(id, c => c.text.startsWith('Sire,'));
    s.box(12, 52, 656, 43, 'card');
    label(s, summary, 24, 64, 16, 632, {center : true});
    const contacts = texts(id).filter(c => c.x === 88);
    contacts.forEach((c, i) => {
        const y = 111 + i * 95, split = c.text.indexOf(' (');
        if (split < 0)
            throw Error('Unrecognized Foreign Minister contact');
        s.box(12, y, 656, 84, c.color === 41 ? 'selection' : 'row');
        const glyph = source(id).commands.filter(c => c.op === 'city')[i];
        if (glyph)
            s.add('native-glyph',
                  {command : {...glyph, x : 26, y : y + 12, width : 80, height : 60}});
        s.text(c.text.slice(0, split), 123, y + 12, 20, 530, {sourceText : c.text});
        s.text(c.text.slice(split + 2, -1), 123, y + 45, 17, 530);
    });
    buttons(s);
    return annotate(s);
}
function status(Scene) {
    const id = 'status-panel', s = new Scene(id, 'Status', 320, 370, 'status').heading();
    const all = texts(id), header = all.filter(c => c.y >= 36 && c.y <= 72);
    header.forEach((c, i) => label(s, c, 18, 50 + i * 25, 17, 284));
    s.image(binding('flask/1'), 263, 83, 28, 28);
    s.box(10, 136, 300, 224);
    label(s, one(id, c => c.text === 'Moving Units'), 20, 146, 18, 280,
          {center : true, bold : true});
    const glyph = source(id).commands.find(c => c.op === 'unit');
    if (!glyph)
        throw Error('Status trace has no active unit');
    s.add('native-glyph', {command : {...glyph, x : 20, y : 184, width : 80, height : 60}});
    all.filter(c => c.x === 92).forEach((c, i) => label(s, c, 112, 184 + i * 26, 17, 192));
    all.filter(c => c.x === 18 && c.y >= 187)
        .forEach((c, i) => label(s, c, 22, 278 + i * 29, 18, 278));
    return annotate(s);
}
function destroyed(Scene) {
    const id = 'destroyed-civilizations',
          s = new Scene(id, 'Destroyed Civilizations', 640, 480, 'endgame');
    s.add('background',
          {key : 'mk.dll/10000', replacement : 'backgrounds/defeat-ruins-native.png'});
    s.box(192, 42, 257, 305, 'scrim');
    s.image(
        {old : Reports.extra.bindings['mk.dll/220'].file, new : 'sprites/advisors/advisor-00.png'},
        208, 57, 225, 275, {crop : [ 1, 1, 225, 275 ]});
    s.box(167, 356, 306, 103, 'scrim');
    const text = one(id, c => c.op === 'wrapped').text, split = text.indexOf(':');
    s.text(text.slice(0, split), 177, 369, 24, 286,
           {center : true, bold : true, sourceText : text});
    s.text(text.slice(split + 1).trim(), 177, 414, 17, 286, {center : true});
    return annotate(s);
}
function tax(Scene) {
    const id = 'tax-rates', t = source(id),
          s = new Scene(id, 'Tax Rates', t.width, t.height, 'tax').heading();
    s.commands.find(c => c.op === 'text').text = texts(id).find(c => c.y < 10).text;
    s.commands.find(c => c.op === 'text').size = 20;
    for (const [prefix, y] of [[ 'Government:', 52 ], [ 'Total Income:', 98 ],
                               [ 'Discoveries:', 126 ]])
        label(s, one(id, c => c.text.startsWith(prefix)), 16, y, 19, 584, {center : true});
    s.text('Lock', 549, 175, 15, 56, {center : true});
    ['gold', 'science', 'luxury'].forEach((role, i) => {
        const prefix = [ 'Taxes:', 'Science:', 'Luxuries:' ][i],
              c = one(id, c => c.text.startsWith(prefix));
        const value = Number(c.text.match(/(\d+)%/)[1]), y = 180 + i * 62;
        const width = F.width(c.text, F.get(0, 19, 0)), start = Math.round((520 - width - 32) / 2);
        s.image({old : Reports.local.bindings['economy/' + role].file, new : E.file(role)}, start,
                y, 24, 24, {taxRole : role});
        label(s, c, start + 32, y + 1, 19, width + 4);
        s.text('0%', 24, y + 3, 17, 45);
        s.text('100%', 464, y + 3, 17, 60);
        s.add('slider', {x : 24, y : y + 28, width : 496, height : 23, value, role});
        const checkbox = t.commands.filter(c => c.op === 'checkbox')[i];
        s.add('checkbox',
              {x : 561, y : y + 28, width : 20, height : 20, checked : !!checkbox.color});
    });
    buttons(s, true);
    return annotate(s);
}
function research(Scene) {
    const id = 'dialog-research',
          s = new Scene(id, 'What shall we research?', 550, 430, 'research').heading();
    choices(id).forEach((row, i) => {
        const y = 52 + i * 46;
        s.box(12, y, 526, 44, row.selected ? 'selection' : 'row');
        s.image(advance(row.label.text), 24, y + 4, 46, 34);
        label(s, row.label, 86, y + 11, 21, 435);
    });
    buttons(s);
    return annotate(s);
}
function production(Scene) {
    const id = 'dialog-production',
          s = new Scene(id, texts(id).find(c => c.y < 10).text, 760, 640, 'choice').heading();
    s.text('Production', 82, 48, 17, 300);
    s.text('Turns', 385, 48, 17, 72, {center : true});
    s.text('Attack / Defense / Move', 467, 48, 15, 196, {center : true});
    s.text('HP / FP', 675, 48, 15, 72, {center : true});
    choices(id).forEach((row, i) => {
        const y = 76 + i * 32,
              stats = row.detail?.text.match(/^\((\d+) Turns(?:, ADM: ([\d/]+) HP: ([\d/]+))?\)$/);
        if (!stats)
            throw Error('Unrecognized production stats: ' + row.detail?.text);
        s.box(12, y, 736, 31, row.selected ? 'selection' : i % 2 ? 'row' : 'panel');
        s.image(binding(row.icon.text), 20, y, 48, 30);
        label(s, row.label, 82, y + 5, 17, 296);
        s.text(stats[1], 385, y + 5, 17, 72, {center : true, sourceText : row.detail.text});
        if (stats[2])
            s.text(stats[2], 467, y + 5, 17, 196, {center : true});
        if (stats[3])
            s.text(stats[3], 675, y + 5, 17, 72, {center : true});
    });
    buttons(s);
    return annotate(s);
}
module.exports = {
    source,
    texts,
    choices,
    advance,
    binding,
    buttons,
    forest,
    advancePage,
    foreign,
    status,
    destroyed,
    tax,
    research,
    production,
    changedScenes
};
