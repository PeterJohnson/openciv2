// Replay unchanged report bodies. Original pixels are used only in composed review scenes.
const C = require('./common.cjs'), R = require('./render.cjs');
const {Painter} = require('./windows.cjs'), T = require('./typography.cjs');
const Citizens = require('./citizens.cjs'), Native = require('./native-windows.cjs');
const {spawnSync} = require('node:child_process');
const Design = require('./report-design.cjs');
const local = C.read(C.path.join(C.pack, 'review/original-local/bindings.json'));
const extra = C.read(C.path.join(C.pack, 'review/original-local/other-windows/bindings.json'));
const compat = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
const anchors = C.fs.readFileSync(C.path.join(C.pack, 'review/original-local/anchors.txt'), 'utf8')
                    .trim()
                    .split(/\r?\n/)
                    .slice(-8)
                    .map(s => s.split(/\s+/).map(Number));
const eras = [ 'ancient', 'medieval', 'industrial', 'modern' ];
const modes = [
    'city-status', 'attitude', 'trade', 'science', 'defense', 'losses', 'intelligence', 'wonders',
    'top-cities', 'demographics', 'score', 'hall-of-fame'
];
const titles = [
    'City Status', 'Attitude Advisor', 'Trade Advisor', 'Science Advisor', 'Defense Minister',
    'Military Casualties', 'Intelligence Report', 'Wonders of the World', 'Top Five Cities',
    'Demographics', 'Civilization Score', 'Hall of Fame'
];
const palette = n => n >= 200 && n < 218
                         ? local.palette[anchors[(n >= 210 ? n - 210 : n - 200)][n >= 210 ? 2 : 0]]
                         : Native.palette(n);

function run(exe, args) {
    const r = spawnSync(
        C.path.join(C.root, 'build/atlas-review', process.env.ATLAS_CONFIG || 'Release', exe), args,
        {encoding : 'utf8', maxBuffer : 64 * 1024 * 1024});
    if (r.error || r.status)
        throw Error(r.error || r.stderr);
    return JSON.parse(r.stdout);
}

function sprite(id, original) {
    if (id < 44)
        return original ? local.bindings['icon/' + (100 + id)].file
                        : Citizens.binding(100 + id).file;
    if (id < 128)
        return original
                   ? extra.bindings['wonder-' + (id - 100)].file
                   : C.entries
                         .find(e => e.mapping?.kind === 'wonder' && e.mapping.index === id - 100)
                         .file;
    if (id < 220) {
        const i = id - 200, cat = Math.floor(i / 4);
        return original ? extra.bindings['advance-' + i].file
               : cat === 4
                   ? `sprites/diplomacy/exploration-${eras[i % 4]}.png`
                   : `sprites/advances/${['military', 'economy', 'society', 'science'][cat]}-${
                         eras[i % 4]}.png`;
    }
    const role = [ 'gold', 'science', 'food', 'production', 'trade' ][id - 300];
    if (!role)
        throw Error('Unbound report sprite ' + id);
    return original ? local.bindings['economy/' + role].file : require('./economy.cjs').file(role);
}

function glyphs(trace, original, id) {
    const list = trace.commands.filter(c => c.asset.endsWith('-glyph'));
    if (!list.length)
        return [];
    const base = C.fs.readFileSync(C.path.join(C.pack, 'review/fixtures/saved-close.txt'), 'utf8');
    const lines = list.map(c => `GLYPH ${c.asset === 'unit-glyph' ? 1 : 0} ${c.text} ${c.height} ${
                               c.x} ${c.y} ${c.width}`);
    const fixture = C.path.join(C.root, 'build/atlas-review/generated',
                                `report-${id}-${original ? 'original' : 'replacement'}.txt`);
    C.write(fixture, base.trim() + '\n' + lines.join('\n') + '\n');
    const full = run('atlas-engine.exe', [
        'report-glyphs', fixture,
        ...(original ? [ C.path.join(C.pack, 'review/original-local/anchors.txt') ] : [])
    ]);
    const groups = [];
    for (const c of full.commands) {
        if (c.asset === 'glyph-start')
            groups.push([]);
        else
            groups.at(-1).push(c);
    }
    return groups;
}

async function plate(p, trace, enhanced, id) {
    await p.image(Design.file(id, enhanced), 0, 0, trace.width, trace.height, {contain : false});
}

async function button(p, c, original, enhanced) {
    await p.box(c.x, c.y, c.width, c.height,
                original   ? '#c0c0c0'
                : enhanced ? '#3e5849'
                           : '#8e9984',
                original ? '#ffffff' : '#b7a67a', enhanced ? 2 : 0);
    const oldPalette = p.palette;
    if (c.disabled)
        p.palette = () => '#89998b';
    await Native.text(p, c.text, c.x + 2, c.y + 2, {
        face : 1,
        size : 12,
        style : 1,
        color : enhanced ? 26 : 10,
        align : 'center',
        width : c.width - 4,
        height : c.height - 4
    });
    p.palette = oldPalette;
}

async function render(trace, mode, id, groups) {
    const original = mode === 'original', enhanced = mode === 'proposed',
          d = [ 'original', 'current' ].includes(mode) ? 1 : 2;
    const p = new Painter(trace.width, trace.height, d);
    p.originalText = original;
    const bg =
        extra.bindings['tiles.dll/' + trace.commands.find(c => c.asset === 'background').text];
    p.palette = n =>
        original ? (n >= 200 && n < 218 ? palette(n) : local.palette[n & 255]) : palette(n);
    const knowledge = enhanced ? Design.knowledgePlan(trace) : [];
    let glyphIndex = 0;
    for (let i = 0; i < trace.commands.length; i++) {
        const c = trace.commands[i];
        if (c.asset === 'background') {
            if (original) {
                const b =
                    await C.sharp(C.path.join(C.pack, bg.file))
                        .extract({left : 0, top : 0, width : trace.width, height : trace.height})
                        .png()
                        .toBuffer();
                C.blit(p.dst, await C.raw(b), 0, 0);
            } else {
                await plate(p, trace, enhanced, id);
                if (enhanced && id === 'report-defense') {
                    await p.text('A/D/M', 236, 67, 53, 11);
                    await p.text('HP/FP', 288, 67, 35, 10);
                    await p.text('Active', 323, 65, 60, 13);
                    await p.text('Building', 384, 65, 65, 13);
                    await p.text('Abilities', 454, 65, 125, 13);
                }
                if (enhanced && id === 'report-losses') {
                    for (const col of Design.lossColumns())
                        await p.text(col.label, col.x, 67, col.width, 10, '#e5cd8f', 'middle');
                }
            }
        } else if (c.asset === 'text') {
            const next = trace.commands[i + 1];
            const isShadow = next?.asset === 'text' && next.text === c.text &&
                             Math.abs(next.x - c.x) <= 2 && Math.abs(next.y - c.y) <= 2;
            if (enhanced && isShadow)
                continue;
            const color = original         ? p.palette(c.color)
                          : isShadow       ? '#263c32'
                          : c.color >= 200 ? '#e5c374'
                                           : '#fff2cc';
            const command = enhanced ? Design.enhanceText(c, id) : c;
            await T.draw(p.dst, command, d, color, original);
        } else if (c.asset === 'sprite') {
            const specific = knowledge.find(k => k.sprite === c);
            const file = specific ? specific.file : sprite(+c.text, original);
            const item = enhanced ? Design.enlargeWonder(c, trace, id) : c;
            const b = original ? await C.raw(C.path.join(C.pack, file), item.width, item.height,
                                             'nearest')
                               : await C.raw(await C.fit(C.path.join(C.pack, file), item.width * d,
                                                         item.height * d, 1));
            C.blit(p.dst, b, item.x * d, item.y * d);
        } else if (c.asset.endsWith('-glyph')) {
            const b = await R.baseline(
                {width : trace.width, height : trace.height, commands : groups[glyphIndex++]},
                {mode : 'report'}, original ? local.bindings : compat, {
                    density : d,
                    native : d === 1,
                    transparent : true,
                    originalText : original,
                    ...(original ? {palette : n => local.palette[n & 255]} : {})
                });
            C.blit(p.dst, await C.raw(b), 0, 0);
        } else if (c.asset === 'fill')
            Native.fill(p, c.x, c.y, c.width, c.height, p.palette(c.color));
        else if (c.asset === 'frame') {
            const rect = enhanced && id === 'report-losses' ? {...c, x : 246, width : 48} : c;
            await p.vector(
                `<rect x=".5" y=".5" width="${rect.width - 1}" height="${
                    rect.height -
                    1}" fill="none" stroke="${original ? p.palette(c.color) : enhanced ? '#809078' : '#b6a476'}"/>`,
                rect.x, rect.y, rect.width, rect.height);
        } else if (c.asset === 'button')
            await button(p, c, original, enhanced);
        else if (c.asset === 'scrollbar') {
            await p.box(c.x, c.y, c.width, c.height, original ? '#c0c0c0' : '#364f43', '#c6b98c');
            await p.box(c.x + 2, c.y + 17, c.width - 4, Math.max(18, c.height / 4),
                        original ? '#eeeeee' : '#a5ad8c', '#dad5bb');
        } else
            throw Error('Unreplayed command ' + c.asset);
    }
    return p.finish();
}

async function build(nativeOnly = false) {
    const scenes = [];
    const traces = Object.fromEntries(modes.map(
        mode => ['report-' + mode,
                 run('atlas-reports.exe',
                     [ mode, C.path.join(C.pack, 'review/fixtures/other-windows/reports.txt') ])]));
    await Design.buildPlates(traces);
    for (let i = 0; i < modes.length; i++) {
        const mode = modes[i], id = 'report-' + mode;
        const trace = traces[id];
        C.json(C.path.join(C.pack, 'review/traces/other-' + mode + '.json'), trace);
        const originalGlyphs = glyphs(trace, true, id), newGlyphs = glyphs(trace, false, id);
        const s = {
            id,
            title : titles[i],
            mode : 'report',
            note :
                'Extracted report drawing with the 1788 save and declared calculation fixtures. Native/HD use source-aligned background plates. Enhanced adds row-to-icon connections, individual knowledge illustrations and labeled military columns.'
        };
        for (const variant of ['original', 'current', 'hd', 'proposed']) {
            const file = variant === 'original'
                             ? `review/original-scenes/images/${id}.png`
                             : `review/other-windows/images/${id}-${variant}.png`;
            if (!(nativeOnly && variant === 'proposed'))
                C.write(C.path.join(C.pack, file),
                        await render(trace, variant, id,
                                     variant === 'original' ? originalGlyphs : newGlyphs));
            s[variant] = file;
            s[variant + 'Size'] = [
                trace.width * (variant === 'hd' || variant === 'proposed' ? 2 : 1),
                trace.height * (variant === 'hd' || variant === 'proposed' ? 2 : 1)
            ];
        }
        scenes.push(s);
        console.log('Rendered ' + id);
    }
    C.json(C.path.join(C.pack, 'review/other-windows/report-scenes.json'), scenes);
    C.json(C.path.join(C.pack, 'review/report-extraction.json'),
           C.read(C.path.join(C.root, 'build/atlas-review/generated/report-extraction.json')));
    return scenes;
}

module.exports = {
    build,
    render,
    run,
    sprite,
    button,
    local,
    extra,
    palette
};
if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
