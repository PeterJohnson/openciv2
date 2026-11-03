// Enhanced proposals only. Current-engine variants execute native-other.cjs.
const C = require('./common.cjs'), F = require('./font.cjs'), T = require('./typography.cjs');
const {Painter} = require('./windows.cjs'), Reports = require('./report-render.cjs');
const E = require('./economy.cjs'), Native = require('./native-windows.cjs');
const Details = require('./enhanced-details.cjs'), NativeOther = require('./native-other.cjs');
const MapRender = require('./render.cjs');
const data = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/catalog.json'));
const saved = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json'));
const facts = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/inputs.json'));
const original = Reports.local.bindings, extra = Reports.extra.bindings;
const compatibility = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
const esc = s =>
    String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const sources = {
    pedia : [
        'src/auto/pedia.cpp',
        'PediaWindow::create; draw_frame; draw_item_list; draw_advance_page; draw_advance_tree; draw_unit_page; draw_improvement_page; draw_terrain_page'
    ],
    council : [
        'src/auto/reports.cpp',
        'CouncilWindow::init; draw_background; create_buttons; draw_advisor_frames; draw_speech'
    ],
    power : [ 'src/auto/reports.cpp', 'powergraph_show' ],
    foreign : [ 'src/auto/reports.cpp', 'foreign_minister_show; historian_report_show' ],
    casualties : [ 'src/auto/reports.cpp', 'casualty_timeline_draw' ],
    endgame : [
        'src/auto/reports.cpp',
        'DestroyedCivsWindow::create; draw_entry; draw_portrait; credits_draw_scroll'
    ],
    status : [ 'src/auto/game.cpp', 'status_draw_info; status_draw_unit_panel; status_redraw' ],
    world : [
        'src/auto/mapview.cpp',
        'minimap_calc_layout; minimap_tile_to_screen; minimap_tile_color; minimap_draw_view_rect; minimap_redraw'
    ],
    tax : [ 'src/auto/city.cpp', 'TaxRateDialog::run; paint; calc_totals' ],
    research : [ 'src/auto/civ.cpp', 'civ_choose_research_dialog; research_option_draw_advance' ],
    options : [ 'src/auto/window.cpp', 'menu_game_options; Dialog layout and drawing helpers' ],
    setup : [ 'src/auto/game.cpp', 'game_main_menu_loop; SetupPicWindow' ],
    choice : [ 'src/auto/window.cpp', 'Dialog option, checkbox, button and text drawing helpers' ]
};
const mapped = (kind, index) => {
    const e = C.entries.find(e => e.mapping?.kind === kind && e.mapping.index === index);
    if (!e)
        throw Error(`Missing ${kind}/${index}`);
    return e.file;
};
const economy = role => ({old : original['economy/' + role].file, new : E.file(role)});
const unit = i => ({old : original['unit/' + i].file, new : mapped('unit', i)});
const wonder = i => ({old : extra['wonder-' + i].file, new : mapped('wonder', i)});
const improvement = i =>
    ({old : original['icon/' + (200 + i)].file, new : mapped('improvement', i)});
const advance = i => Details.advance(data.CIVILIZE[i][0]);

class Scene {
    constructor(id, title, w, h, family) {
        Object.assign(this, {id, title, width : w, height : h, family, commands : []});
    }

    add(op, o) {
        this.commands.push({op, ...o});
        return this;
    }

    text(text, x, y, size = 18, width = this.width - x - 12, options = {}) {
        return this.add('text', {text, x, y, size, width, ...options});
    }

    box(x, y, width, height, kind = 'panel') {
        return this.add('box', {x, y, width, height, kind});
    }

    image(binding, x, y, width, height, options = {}) {
        return this.add('image', {binding, x, y, width, height, ...options});
    }

    button(text, x, y, width, height = 25) {
        return this.add('button', {
            text,
            x : Math.round(x),
            y : Math.round(y),
            width : Math.floor(width),
            height : Math.floor(height)
        });
    }

    heading() {
        this.box(0, 0, this.width, this.height, 'background');
        this.box(2, 2, this.width - 4, 38, 'heading');
        this.text(this.title, 12, 5, 24, this.width - 24, {center : true, bold : true});
        return this;
    }

    footer(labels = [ 'Close' ]) {
        const width = (this.width - 12) / labels.length;
        labels.forEach((s, i) => this.button(s, 6 + i * width, this.height - 32, width - 3, 26));
        return this;
    }
}

function pedia(kind) {
    const s = new Scene('pedia-' + kind, 'Civilopedia', 640, 400, 'pedia').heading();
    s.commands = s.commands.filter(c => c.op !== 'text');
    s.title = 'Civilopedia: ' + ({
                  advances : 'Advance Index',
                  advance : 'Railroad',
                  tree : 'Advance Tree',
                  unit : 'Riflemen',
                  improvement : 'Library',
                  wonder : 'Pyramids',
                  terrain : 'Forest'
              }[kind]);
    s.box(8, 48, 624, 310);
    if (kind === 'advances') {
        s.text('Civilization Advances', 50, 7, 24, 540, {center : true, bold : true});
        const list =
            Details.texts(s.id)
                .filter(c => c.y >= 49 && [ 68, 378 ].includes(c.x))
                .map(c => ({r : [ c.text ], i : data.CIVILIZE.findIndex(r => r[0] === c.text)}));
        for (let j = 0; j < 18; j++) {
            const col = Math.floor(j / 9), row = j % 9, x = 14 + col * 310, y = 52 + row * 33;
            if (j === 0)
                s.box(x, y, 306, 33, 'selection');
            s.image(advance(list[j].i), x + 1, y + 1, 54, 30);
            s.text(list[j].r[0], x + 60, y + 5, 21, 244, {clip : true});
        }
        s.footer([ 'Cancel', 'Help', 'Advances' ]);
    } else if (kind === 'advance' || kind === 'tree') {
        s.text('Railroad', 55, 7, 24, 530, {center : true, bold : true});
        if (kind === 'advance') {
            // Detail content and individual artwork follow the source's Railroad page.
            s.commands = s.commands.filter(c => !(c.op === 'text' && c.text === 'Railroad'));
            Details.advancePage(s);
        } else {
            const nodes = [
                [ 'Steam Engine', 42, 65 ], [ 'Bridge Building', 350, 65 ],
                [ 'Railroad', 196, 177 ], [ 'Industrialization', 196, 282 ]
            ];
            s.add('paths', {paths : [ 'M157 119L307 177', 'M465 119L307 177', 'M307 231V282' ]});
            for (const [name, x, y] of nodes) {
                s.box(x, y, 230, 54, name === 'Railroad' ? 'selection' : 'card');
                s.image(Details.advance(name), x + 6, y + 10, 38, 32);
                s.text(name, x + 51, y + 17, 17, 173, {link : true});
            }
        }
        s.footer([ 'Description', 'Advances', 'Tree', 'Close' ]);
    } else if (kind === 'unit') {
        const i = data.UNITS.findIndex(r => r[0] === 'Riflemen'), r = data.UNITS[i];
        s.text('Riflemen', 50, 7, 24, 540, {center : true, bold : true});
        s.image(unit(i), 18, 55, 128, 96);
        s.text('Requires: Conscription', 220, 96, 21, 400, {link : true});
        const rows = [
            [ 'Cost', 40, 'production' ], [ 'Attack', parseInt(r[5]) ],
            [ 'Defense', parseInt(r[6]) ], [ 'Hit Points', parseInt(r[7]) ],
            [ 'Firepower', parseInt(r[8]) ], [ 'Movement', parseInt(r[3]) ]
        ];
        rows.forEach(([ label, value, role ], j) => {
            s.text(label + ':', 18, 165 + j * 27, 21, 170);
            s.text(String(value), 237, 165 + j * 27, 21, 60);
            if (role)
                s.image(economy(role), 268, 171 + j * 27, 14, 14);
        });
        s.text('Infantry with rifles.', 330, 178, 18, 288);
        s.text('Strong on defense.', 330, 207, 18, 288);
        s.footer([ 'Description', 'Units', 'Close' ]);
    } else if (kind === 'improvement' || kind === 'wonder') {
        const isWonder = kind === 'wonder', name = isWonder ? 'Pyramids' : 'Library',
              i = data.IMPROVE.findIndex(r => r[0].replace(/^The /, '') === name),
              r = data.IMPROVE[i];
        s.text(name, 50, 7, 24, 540, {center : true, bold : true});
        s.image(isWonder ? wonder(0) : improvement(i), 18, 56, 72, 40);
        const rows = [
            [ 'Requires', isWonder ? 'Masonry' : 'Writing' ], [ 'Cost', +r[1] * 10 ],
            [ 'Upkeep', r[2] ]
        ];
        rows.forEach(([ label, v ], j) => {
            s.text(label + ':', 18, 110 + j * 29, 21, 164);
            s.text(String(v), 188, 110 + j * 29, 21, 330, {link : j === 0});
            if (j > 0)
                s.image(economy(j === 1 ? 'production' : 'gold'), 235, 117 + j * 29, 14, 14);
        });
        s.text(isWonder ? 'Provides a Granary in every city.'
                        : 'Increases science production in this city.',
               18, 225, 21, 604);
        s.text(isWonder ? 'A major achievement of the ancient world.'
                        : 'A place to preserve knowledge and train scholars.',
               18, 259, 21, 604);
        s.footer([ 'Description', isWonder ? 'Wonders' : 'Improvements', 'Close' ]);
    } else {
        Details.forest(s);
    }
    // Preserve the actual page's available actions, positions and disabled state.
    // Proposal styling is independent; button semantics come from the extracted trace.
    const native = C.read(C.path.join(C.pack, 'review/traces/other-' + s.id + '.json'));
    s.commands = s.commands.filter(c => c.op !== 'button');
    for (const c of native.commands.filter(c => c.op === 'button'))
        s.add('button', {
            text : c.text,
            x : c.x,
            y : c.y,
            width : c.width,
            height : c.height,
            disabled : c.color === 128
        });
    return s;
}

function power() {
    const s = new Scene('powergraph', 'Powergraph', 600, 425, 'power');
    s.add('background',
          {key : 'tiles.dll/51', replacement : 'backgrounds/history-gallery-native.png'});
    s.box(8, 2, 584, 366, 'graph');
    s.add('graph', {x : 8, y : 2, width : 584, height : 366});
    for (let i = 0; i < 7; i++)
        s.text(facts.civilizations[i].name, 10, 3 + i * 14, 14, 150,
               {faction : i + 1, bold : true});
    ['4000 B.C.', '1500 B.C.', 'A.D. 1', 'A.D. 1000', 'A.D. 1788'].forEach(
        (t, i) => s.text(t, 8 + i * 116, 372, 12, 116));
    s.button('Close', 2, 400, 596, 23);
    return s;
}

function council() {
    const s = new Scene('high-council', 'English High Council', 474, 302, 'council').heading();
    s.commands[1].height = 22;
    s.commands[2].size = 16;
    s.commands[2].y = 2;
    const roles = [ 'Military', 'Science', 'Trade', 'Foreign', 'Attitude' ];
    for (let i = 0; i < 5; i++) {
        s.box(4 + i * 94, 25, 92, 124, 'portrait');
        s.image(
            {old : null, new : `sprites/advisors/advisor-${String(10 + i).padStart(2, '0')}.png`},
            5 + i * 94, 26, 90, 122, {media : true});
        s.button(roles[i], 11 + i * 94, 149, 75, 22);
    }
    s.box(4, 177, 466, 91);
    s.text('Science: Our libraries need greater support.', 12, 187, 16, 450);
    s.text('Consider increasing the science allocation.', 12, 216, 16, 450);
    s.button('Close', 4, 274, 466, 24);
    s.note =
        'Five 90 Ã— 122 advisor slots and native button/speech geometry. Original council AVI files are absent locally: black slots show the unfilled source frame, not original advisor portraits. Replacement uses still portraits; enhanced adds an active-advisor cue.';
    return s;
}

function world() {
    const s = new Scene('world-map', 'World Map', 304, 264, 'world').heading();
    s.commands[1].height = 20;
    s.commands[2].size = 14;
    s.commands[2].y = 1;
    s.add('world', {x : 2, y : 22, width : 300, height : 240});
    return s;
}

function status() { return Details.status(Scene); }

function foreign() { return Details.foreign(Scene); }

function historian() {
    const s = new Scene('historian', 'The Historian Reports', 480, 320, 'foreign').heading();
    s.text('The most powerful civilizations of the world', 18, 53, 18, 444, {center : true});
    ['English', 'Babylonians', 'Germans', 'Russians', 'Romans'].forEach((t, i) => {
        s.box(22, 90 + i * 34, 436, 32, 'row');
        s.text(`${i + 1}. ${t}`, 42, 94 + i * 34, 18, 396);
    });
    s.footer();
    return s;
}

function timeline() {
    const s = new Scene('casualty-timeline', 'Defense Minister: Casualty Timeline', 600, 400,
                        'casualties');
    s.add('background',
          {key : 'tiles.dll/51', replacement : 'backgrounds/history-gallery-native.png'});
    s.text(s.title, 2, 2, 18, 596, {center : true});
    s.text('Kingdom of the English', 2, 23, 18, 596, {center : true});
    s.text('King Henry VIII: A.D. 1788', 2, 44, 18, 596, {center : true});
    ['Knights', 'Crusaders', 'Cannon', 'Riflemen', 'Frigate', 'Engineers'].forEach((name, j) => {
        const i = data.UNITS.findIndex(r => r[0] === name), y = 70 + j * 24;
        s.image(unit(i), 2 + (j % 2) * 64, y, 64, 48);
        s.text(name, 140, y + 17, 14, 96, {clip : true, bold : true});
        s.text('A.D. ' + (1786 - j * 2), 236, y + 17, 14, 76, {clip : true, bold : true});
        s.text('(42, 38) near London', 312, y + 17, 14, 170, {clip : true, bold : true});
        s.text('Babylonians', 482, y + 17, 14, 100, {clip : true, bold : true});
    });
    s.footer();
    return s;
}

function destroyed() { return Details.destroyed(Scene); }

function credits() {
    const s = new Scene('credits', 'Credits', 600, 400, 'endgame');
    s.add('background', {key : 'credits', replacement : 'backgrounds/history-gallery-native.png'});
    const lines = [
        'CIVILIZATION II', 'A game of exploration and civilization', '', 'Design and Programming',
        'Art and Animation', 'Music and Sound', 'Quality Assurance', '', 'Thank you for playing'
    ];
    lines.forEach((t, i) => s.text(t, 2, 22 + i * 35, i === 0 ? 26 : 21, 596,
                                   {center : true, bold : i === 0}));
    s.footer();
    return s;
}

function tax() { return Details.tax(Scene); }

function dialog(kind) {
    if (kind === 'research')
        return Details.research(Scene);
    if (kind === 'production')
        return Details.production(Scene);
    const isOptions = kind === 'options', isSetup = kind === 'setup';
    const w = isOptions ? 480 : isSetup ? 360 : 400;
    const h = isOptions ? 410 : isSetup ? 360 : 220;
    const title = {
        options : 'Game Options',
        setup : 'Civilization II',
        confirmation : 'Quit Civilization II?',
        information : 'City Improvement Complete'
    }[kind];
    const s = new Scene('dialog-' + kind, title, w, h,
                        isOptions ? 'options' : isSetup ? 'setup' : 'choice')
                  .heading();
    if (isOptions) {
        const options =
            data.dialogs.GAMEOPTIONS.filter(t => t && !t.startsWith('@') && !t.startsWith(';'));
        options.forEach((t, i) => {
            const y = 51 + i * 28;
            s.add('checkbox', {
                x : 17,
                y : y + 3,
                width : 16,
                height : 16,
                checked : [ 0, 1, 3, 4, 7 ].includes(i)
            });
            s.text(t, 43, y, 16, w - 55);
        });
        s.footer([ 'OK', 'Cancel' ]);
    } else if (isSetup) {
        const options =
            data.dialogs.MAINMENU.filter(t => t && !t.startsWith('@') && !t.startsWith(';'));
        options.forEach((t, i) => {
            if (i === 0)
                s.box(12, 50 + i * 32, w - 24, 31, 'selection');
            s.text(t, 28, 54 + i * 32, 18, w - 56);
        });
        s.footer([ 'OK', 'Cancel' ]);
    } else if (kind === 'confirmation') {
        s.text('Do you really want to quit?', 20, 68, 21, 360, {center : true});
        s.text('Any unsaved progress will be lost.', 20, 105, 16, 360, {center : true});
        s.footer([ 'Yes', 'No' ]);
    } else {
        s.image(improvement(6), 24, 68, 72, 40);
        s.text('London completed a Library.', 114, 65, 16, 272);
        s.text('Choose what to build next.', 114, 102, 14, 272);
        s.footer([ 'Zoom to City', 'Continue' ]);
    }
    return s;
}

function scenes() {
    return [
        ...['advances', 'advance', 'tree', 'unit', 'improvement', 'wonder', 'terrain'].map(pedia),
        power(), council(), foreign(), historian(), timeline(), destroyed(), credits(), status(),
        world(), tax(),
        ...['research', 'production', 'options', 'setup', 'confirmation', 'information'].map(dialog)
    ];
}

async function render(s, variant) {
    const o = variant === 'original', e = variant === 'proposed',
          d = [ 'original', 'current' ].includes(variant) ? 1 : 2;
    const p = new Painter(s.width, s.height, d);
    p.originalText = o;
    p.palette = n => o ? Reports.local.palette[n & 255] : Native.palette(n);
    const ink = e ? '#efe6cb' : '#24352e', edge = e ? '#9b946b' : '#8d8467';
    const texture = await C.raw(C.path.join(C.pack, original['panel-texture'].file));

    async function box(c) {
        const colors = {
            background : e ? '#172e2c' : '#c4bfa2',
            heading : e ? '#314b40' : '#a9ae91',
            panel : e ? '#263e37' : '#d5cbb0',
            card : e ? '#385248' : '#c2c7aa',
            selection : e ? '#4d6552' : '#a8b3a1',
            row : e ? '#213b34' : '#cbc6ab',
            portrait : '#000000',
            scrim : '#10251f',
            graph : e ? '#152d2c' : '#5e6e65'
        };
        if (o && c.kind === 'graph') {
            await p.vector(`<rect x=".5" y=".5" width="${c.width - 1}" height="${
                               c.height - 1}" fill="none" stroke="#000000"/>`,
                           c.x, c.y, c.width, c.height);
            return;
        }
        await p.box(c.x, c.y, c.width, c.height, colors[c.kind] || colors.panel, edge,
                    e && c.kind === 'card' ? 3 : 0);
        if (o && [ 'background', 'panel', 'card' ].includes(c.kind)) {
            for (let y = 0; y < c.height; y += texture.height)
                for (let x = 0; x < c.width; x += texture.width) {
                    const tw = Math.min(texture.width, c.width - x),
                          th = Math.min(texture.height, c.height - y), b = C.clear(tw, th);
                    for (let r = 0; r < th; r++)
                        texture.data.copy(b.data, r * tw * 4, r * texture.width * 4,
                                          (r * texture.width + tw) * 4);
                    C.blit(p.dst, b, c.x + x, c.y + y);
                }
        }
        if (o && c.kind === 'heading')
            await p.box(c.x, c.y, c.width, c.height, '#808080', '#ffffff');
        if (o && c.kind === 'selection')
            await p.box(c.x, c.y, c.width, c.height, '#b3b3b3', '#888888');
    }

    for (const c of s.commands) {
        if (c.op === 'box')
            await box(c);
        else if (c.op === 'background') {
            if (o) {
                const b = extra[c.key];
                if (!b)
                    throw Error(c.key);
                const crop = await C.sharp(C.path.join(C.pack, b.file))
                                 .extract({
                                     left : 0,
                                     top : 0,
                                     width : Math.min(s.width, b.width),
                                     height : Math.min(s.height, b.height)
                                 })
                                 .png()
                                 .toBuffer();
                C.blit(p.dst, await C.raw(crop), 0, 0);
            } else {
                await p.image(c.replacement, 0, 0, s.width, s.height,
                              {contain : false, opacity : s.family === 'endgame' ? 1 : .3});
                if (s.family !== 'endgame')
                    await box({
                        x : 3,
                        y : 3,
                        width : s.width - 6,
                        height : s.height - 39,
                        kind : 'panel'
                    });
            }
        } else if (c.op === 'text') {
            const f = F.get(0, c.size, c.bold ? 1 : 0), width = F.width(c.text, f),
                  x = c.center ? c.x + (c.width - width) / 2 : c.x;
            const command = {
                text : c.text,
                x : Math.round(x),
                y : c.y,
                face : 0,
                fontHeight : c.size,
                style : c.bold ? 1 : 0,
                clip : [ c.x, c.y, c.x + c.width, Math.min(s.height, c.y + f.cellHeight + 5) ]
            };
            const color = s.id === 'credits' || (!o && s.family === 'endgame') ? '#fff0cb'
                          : c.faction ? Reports.palette(200 + c.faction)
                          : o         ? '#101010'
                          : c.link    ? (e ? '#d5bf7c' : '#31597a')
                                      : ink;
            if (o)
                await T.draw(p.dst, {...command, x : command.x + 1, y : c.y + 1}, d, '#ddd7c4',
                             true);
            if (!o && s.family === 'endgame')
                await T.draw(p.dst, {...command, x : command.x + 1, y : command.y + 1}, d,
                             '#132420', false);
            await T.draw(p.dst, command, d, color, o);
        } else if (c.op === 'image') {
            const file = o ? c.binding.old : c.binding.new;
            if (!file) {
                if (!c.media)
                    throw Error('Missing original binding');
                continue;
            }
            if (o) {
                let input = C.path.join(C.pack, file);
                if (c.crop)
                    input = await C.sharp(input)
                                .extract({
                                    left : c.crop[0],
                                    top : c.crop[1],
                                    width : c.crop[2],
                                    height : c.crop[3]
                                })
                                .png()
                                .toBuffer();
                C.blit(p.dst, await C.raw(input, c.width, c.height, 'nearest'), c.x, c.y);
            } else
                await p.image(file, c.x, c.y, c.width, c.height);
            if (e && c.media && c.x === 99)
                await p.vector(`<rect x="1" y="1" width="${c.width - 2}" height="${
                                   c.height - 2}" fill="none" stroke="#e3c070" stroke-width="2"/>`,
                               c.x, c.y, c.width, c.height);
        } else if (c.op === 'native-glyph') {
            const trace = {width : s.width, height : s.height, commands : [ c.command ]};
            const groups = await NativeOther.glyphs(trace, false, 'enhanced-' + s.id);
            const bytes = await MapRender.baseline(
                {width : s.width, height : s.height, commands : groups[0]}, {mode : 'report'},
                compatibility,
                {density : d, native : false, transparent : true, originalText : false});
            C.blit(p.dst, await C.raw(bytes), 0, 0);
        } else if (c.op === 'button')
            await Reports.button(p, c, o, e);
        else if (c.op === 'checkbox') {
            await p.box(c.x, c.y, c.width, c.height,
                        o   ? '#ffffff'
                        : e ? '#243e33'
                            : '#eeead2',
                        edge, 1);
            if (c.checked)
                await p.vector(`<path d="M3 8L7 12L13 3" fill="none" stroke="${
                                   o   ? '#000000'
                                   : e ? '#e7ce8f'
                                       : '#314d36'}" stroke-width="2"/>`,
                               c.x, c.y, c.width, c.height);
        } else if (c.op === 'slider') {
            await p.box(c.x, c.y, c.width, c.height, o ? '#c0c0c0' : '#8a9c85', edge);
            if (e && c.value > 0) {
                await p.box(c.x + 2, c.y + 3, (c.width - 4) * c.value / 100, c.height - 6,
                            '#d2b367', '#d2b367');
            }
            await p.box(c.x + Math.round((c.width - 16) * c.value / 100), c.y, 16, c.height,
                        o ? '#eeeeee' : '#e0d6b1', edge);
        } else if (c.op === 'paths') {
            await p.vector(c.paths
                               .map(d => `<path d="${d}" fill="none" stroke="${
                                        e ? '#ccb77f' : '#68775b'}" stroke-width="${e ? 2 : 1}"/>`)
                               .join(''));
        } else if (c.op === 'world') {
            const colors = o ? {sea : Reports.local.palette[93], land : Reports.local.palette[48]}
                             : {sea : '#274e60', land : '#70916b'};
            const im = C.clear(c.width * d, c.height * d);
            for (const t of saved.tiles) {
                const x = t.x, y = t.y, terrain = t.t & 15;
                const color = terrain === 10 ? colors.sea : colors.land;
                const rgb = color.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16));
                C.blit(im, C.clear(4 * d, 2 * d, [...rgb, 255 ]), x * 2 * d, y * 2 * d);
            }
            for (const city of saved.cities) {
                const color = Reports.palette(210 + city.owner),
                      rgb = color.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16));
                C.blit(im, C.clear((e ? 3 : 4) * d, 2 * d, [...rgb, 255 ]), city.x * 2 * d,
                       city.y * 2 * d);
            }
            C.blit(p.dst, im, c.x * d, c.y * d);
            await p.vector(
                '<rect x="109" y="74" width="55" height="40" fill="none" stroke="#f4e2a6"/>', c.x,
                c.y, c.width, c.height);
        } else if (c.op === 'graph') {
            let body = '';
            for (let x = 0; x < 584; x += 50)
                body += `<path d="M${x} 0V366" stroke="${
                    e ? '#47615a' : '#222222'}" stroke-width="1"/>`;
            for (let civ = 1; civ < 8; civ++) {
                const points = [];
                for (let n = 0; n < 120; n++) {
                    const value = Math.max(
                        0, Math.min(350, n * (.9 + civ * .19) + Math.sin(n * .14 + civ) * civ * 3));
                    points.push(`${n * 4},${366 - Math.trunc(value)}`);
                }
                body += `<polyline points="${points.join(' ')}" fill="none" stroke="${
                    Reports.palette(200 + civ)}" stroke-width="${e ? 2 : 1}"/>`;
            }
            await p.vector(body, c.x, c.y, c.width, c.height);
        } else
            throw Error('Unknown static window operation ' + c.op);
    }
    return p.finish();
}

async function build() {
    const catalog = [], specs = scenes();
    for (const s of specs) {
        const row = {
            id : s.id,
            title : s.title,
            mode : 'enhanced-proposal',
            source : sources[s.family],
            note :
                s.note ||
                    'Independent enhanced presentation proposal with illustrative values; not current-engine execution. See OTHER-WINDOWS.md for boundaries.'
        };
        for (const variant of ['proposed']) {
            const file = variant === 'original'
                             ? `review/original-scenes/images/${s.id}.png`
                             : `review/other-windows/images/${s.id}-${variant}.png`;
            C.write(C.path.join(C.pack, file), await render(s, variant));
            row[variant] = file;
            row[variant + 'Size'] = [
                s.width * (variant === 'hd' || variant === 'proposed' ? 2 : 1),
                s.height * (variant === 'hd' || variant === 'proposed' ? 2 : 1)
            ];
        }
        catalog.push(row);
        console.log('Rendered ' + s.id);
    }
    const nativeRows = C.read(C.path.join(C.pack, 'review/other-windows/native-scenes.json'));
    for (const row of nativeRows) {
        const enhanced = catalog.find(s => s.id === row.id);
        row.proposed = enhanced.proposed;
        row.proposedSize = enhanced.proposedSize;
    }
    C.json(C.path.join(C.pack, 'review/other-windows/native-scenes.json'), nativeRows);
    C.json(C.path.join(C.pack, 'review/other-windows/enhanced-scenes.json'), catalog);
    C.json(C.path.join(C.pack, 'review/fixtures/other-windows/enhanced-layouts.json'), specs);
    const sourceHashes =
        Object.fromEntries([...new Set(Object.values(sources).map(v => v[0])) ].map(
            f => [f, C.sha(C.fs.readFileSync(C.path.join(C.root, f)))]));
    C.json(C.path.join(C.pack, 'review/other-windows/enhanced-sources.json'), {
        policy :
            'Independent enhanced presentation proposals only; current-engine baselines use other-window-extraction.json.',
        sources,
        sourceHashes,
        fixtures :
            'Enhanced Forest, Foreign Minister, status, tax, research, production and destruction content comes from retained extracted traces. Other illustrative proposals, including powergraph and casualty history, keep their documented boundaries.',
        missingOriginalMedia : Reports.extra.missingMedia
    });
    return catalog;
}

module.exports = {
    build,
    render,
    scenes,
    sources
};
if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
