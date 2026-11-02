// Static review adapters for the remaining window families. See OTHER-WINDOWS.md:
// these preserve documented source geometry but do not execute the UI event loop.
const C = require('./common.cjs'), F = require('./font.cjs'), T = require('./typography.cjs');
const {Painter} = require('./windows.cjs'), Reports = require('./report-render.cjs');
const E = require('./economy.cjs'), Native = require('./native-windows.cjs');
const data = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/catalog.json'));
const saved = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json'));
const facts = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/inputs.json'));
const original = Reports.local.bindings, extra = Reports.extra.bindings;
const compatibility = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
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
        'src/auto/reports.cpp', 'DestroyedCivsWindow::create; draw_entry; draw_portrait; credits_draw_scroll'
    ],
    status : [ 'src/auto/game.cpp', 'status_draw_info; status_draw_unit_panel; status_redraw' ],
    world : [
        'src/auto/mapview.cpp',
        'minimap_calc_layout; minimap_tile_to_screen; minimap_tile_color; minimap_draw_view_rect; minimap_redraw'
    ],
    tax : [ 'src/auto/city.cpp', 'TaxRateDialog::run; redraw' ],
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
const improvement = i => ({old : original['icon/' + (200 + i)].file, new : mapped('improvement', i)});
const advance = i => {
    const r = data.CIVILIZE[i], v = Number(r[6]) * 4 + Number(r[5]);
    return {old : Reports.sprite(200 + v, true), new : Reports.sprite(200 + v, false)};
};
const terrain = i => ({old : original['terrain/' + i].file, new : compatibility['terrain/' + i].file});

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
        const list = data.CIVILIZE.map((r, i) => ({r, i}))
                         .filter(q => !q.r[0].startsWith('User'))
                         .sort((a, b) => a.r[0].localeCompare(b.r[0]))
                         .slice(0, 18);
        for (let j = 0; j < 18; j++) {
            const col = Math.floor(j / 9), row = j % 9, x = 14 + col * 310, y = 52 + row * 33;
            if (j === 0)
                s.box(x, y, 306, 33, 'selection');
            s.image(advance(list[j].i), x + 1, y + 1, 54, 30);
            s.text(list[j].r[0], x + 60, y + 5, 21, 244, {clip : true});
        }
        s.footer([ 'Cancel', 'Help', 'Advances' ]);
    } else if (kind === 'advance' || kind === 'tree') {
        const index = data.CIVILIZE.findIndex(r => r[0] === 'Railroad');
        s.text('Railroad', 55, 7, 24, 530, {center : true, bold : true});
        if (kind === 'advance') {
            s.image(advance(index), 18, 57, 36, 20);
            s.text('Requires: Steam Engine + Bridge Building', 62, 54, 21, 554);
            s.text('Allows:', 18, 85, 21);
            s.text('Industrialization', 107, 85, 21, 505, {link : true});
            s.image(wonder(13), 110, 119, 72, 40);
            s.text("Darwin's Voyage", 194, 125, 21, 415, {link : true});
            s.text('Engineers can connect cities with railroads.', 18, 193, 21, 600);
            s.text('Railroads improve production and movement.', 18, 222, 21, 600);
            s.text('Research the prerequisites to unlock this advance.', 18, 270, 18, 600);
        } else {
            const nodes = [
                [ 'Steam Engine', 42, 65 ], [ 'Bridge Building', 350, 65 ], [ 'Railroad', 196, 177 ],
                [ 'Industrialization', 196, 282 ]
            ];
            s.add('paths', {paths : [ 'M157 119L307 177', 'M465 119L307 177', 'M307 231V282' ]});
            for (const [name, x, y] of nodes) {
                s.box(x, y, 230, 54, name === 'Railroad' ? 'selection' : 'card');
                s.text(name, x + 6, y + 13, 21, 218, {center : true, link : true});
            }
        }
        s.footer([ 'Description', 'Advances', 'Tree', 'Close' ]);
    } else if (kind === 'unit') {
        const i = data.UNITS.findIndex(r => r[0] === 'Riflemen'), r = data.UNITS[i];
        s.text('Riflemen', 50, 7, 24, 540, {center : true, bold : true});
        s.image(unit(i), 18, 55, 128, 96);
        s.text('Requires: Conscription', 220, 96, 21, 400, {link : true});
        const rows = [
            [ 'Cost', 40, 'production' ], [ 'Attack', parseInt(r[5]) ], [ 'Defense', parseInt(r[6]) ],
            [ 'Hit Points', parseInt(r[7]) ], [ 'Firepower', parseInt(r[8]) ], [ 'Movement', parseInt(r[3]) ]
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
              i = data.IMPROVE.findIndex(r => r[0].replace(/^The /, '') === name), r = data.IMPROVE[i];
        s.text(name, 50, 7, 24, 540, {center : true, bold : true});
        s.image(isWonder ? wonder(0) : improvement(i), 18, 56, 72, 40);
        const rows =
            [ [ 'Requires', isWonder ? 'Masonry' : 'Writing' ], [ 'Cost', +r[1] * 10 ], [ 'Upkeep', r[2] ] ];
        rows.forEach(([ label, v ], j) => {
            s.text(label + ':', 18, 110 + j * 29, 21, 164);
            s.text(String(v), 188, 110 + j * 29, 21, 330, {link : j === 0});
            if (j > 0)
                s.image(economy(j === 1 ? 'production' : 'gold'), 235, 117 + j * 29, 14, 14);
        });
        s.text(isWonder ? 'Provides a Granary in every city.' : 'Increases science production in this city.',
               18, 225, 21, 604);
        s.text(isWonder ? 'A major achievement of the ancient world.'
                        : 'A place to preserve knowledge and train scholars.',
               18, 259, 21, 604);
        s.footer([ 'Description', isWonder ? 'Wonders' : 'Improvements', 'Close' ]);
    } else {
        s.text('Forest', 50, 7, 24, 540, {center : true, bold : true});
        s.image(terrain(3), 18, 56, 128, 64);
        s.image({old : original['feature/forest/0'].file, new : compatibility['feature/forest/0'].file}, 18,
                56, 128, 64);
        const rows = [
            [ 'Food', 1, 'food' ], [ 'Shields', 2, 'production' ], [ 'Trade', 0, 'trade' ],
            [ 'Movement cost', 2 ], [ 'Defense bonus', '50%' ]
        ];
        rows.forEach(([ label, v, role ], j) => {
            s.text(label + ':', 18, 149 + j * 31, 21, 200);
            s.text(String(v), 220, 149 + j * 31, 21, 70);
            if (role)
                s.image(economy(role), 253, 155 + j * 31, 14, 14);
        });
        s.text('Irrigation: to Plains', 326, 149, 18, 292);
        s.text('Mining: no effect', 326, 180, 18, 292);
        s.text('Road: faster movement', 326, 211, 18, 292);
        s.footer([ 'Description', 'Terrain', 'Close' ]);
    }
    return s;
}

function power() {
    const s = new Scene('powergraph', 'Powergraph', 600, 425, 'power');
    s.add('background', {key : 'tiles.dll/51', replacement : 'backgrounds/history-gallery-native.png'});
    s.box(8, 2, 584, 366, 'graph');
    s.add('graph', {x : 8, y : 2, width : 584, height : 366});
    for (let i = 0; i < 7; i++)
        s.text(facts.civilizations[i].name, 10, 3 + i * 14, 14, 150, {faction : i + 1, bold : true});
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
        s.image({old : null, new : `sprites/advisors/advisor-${String(10 + i).padStart(2, '0')}.png`},
                5 + i * 94, 26, 90, 122, {media : true});
        s.button(roles[i], 11 + i * 94, 149, 75, 22);
    }
    s.box(4, 177, 466, 91);
    s.text('Science: Our libraries need greater support.', 12, 187, 16, 450);
    s.text('Consider increasing the science allocation.', 12, 216, 16, 450);
    s.button('Close', 4, 274, 466, 24);
    s.note =
        'Five 90 × 122 advisor slots and native button/speech geometry. Original council AVI files are absent locally: black slots show the unfilled source frame, not original advisor portraits. Replacement uses still portraits; enhanced adds an active-advisor cue.';
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

function status() {
    const s = new Scene('status-panel', 'Status', 320, 440, 'status').heading();
    s.text('8,740,000 people', 12, 44, 16, 260);
    s.text('A.D. 1788', 12, 66, 16, 260);
    s.text('1,438 gold   3.1.6', 12, 88, 16, 260);
    s.image(economy('science'), 242, 70, 28, 28);
    s.box(6, 122, 308, 277);
    s.text('London', 16, 130, 18, 288, {bold : true});
    s.text('Grassland (Road, Irrigation)', 16, 158, 14, 288);
    s.text('Riflemen (Veteran)', 92, 196, 16, 215);
    s.text('Home: London', 92, 221, 16, 215);
    s.text('Fortified', 92, 246, 16, 215);
    const i = data.UNITS.findIndex(r => r[0] === 'Riflemen');
    s.image(unit(i), 17, 190, 64, 48);
    s.image(unit(i), 17, 270, 64, 48);
    s.text('Riflemen', 92, 276, 16, 215);
    s.text('Home: Coventry', 92, 301, 16, 215);
    s.text('No orders', 92, 326, 16, 215);
    s.text('End of Turn', 12, 405, 18, 296, {center : true, bold : true});
    return s;
}

function foreign() {
    const s = new Scene('foreign-minister', 'Foreign Minister', 480, 320, 'foreign').heading();
    for (let i = 0; i < 5; i++) {
        const c = facts.civilizations[i], y = 54 + i * 43;
        s.box(10, y, 460, 40, i === 1 ? 'selection' : 'row');
        s.text(c.adjective, 26, y + 4, 18, 170, {faction : c.id});
        s.text([ 'Peace', 'No contact', 'War', 'Peace', 'Alliance' ][i], 220, y + 4, 18, 230);
        s.text(c.leader, 26, y + 24, 12, 420);
    }
    s.footer([ 'Intelligence', 'Advisors', 'Close' ]);
    return s;
}

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
    const s = new Scene('casualty-timeline', 'Defense Minister: Casualty Timeline', 600, 400, 'casualties');
    s.add('background', {key : 'tiles.dll/51', replacement : 'backgrounds/history-gallery-native.png'});
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

function destroyed() {
    const s = new Scene('destroyed-civilizations', 'Destroyed Civilizations', 640, 480, 'endgame');
    s.add('background', {key : 'mk.dll/10000', replacement : 'backgrounds/defeat-ruins-native.png'});
    s.image({old : extra['mk.dll/220'].file, new : 'sprites/advisors/advisor-00.png'}, 208, 57, 225, 275,
            {crop : [ 1, 1, 225, 275 ]});
    s.text('The Romans', 193, 371, 24, 255, {center : true, bold : true});
    s.text('Destroyed: A.D. 1750', 193, 410, 16, 255, {center : true});
    return s;
}

function credits() {
    const s = new Scene('credits', 'Credits', 600, 400, 'endgame');
    s.add('background', {key : 'credits', replacement : 'backgrounds/history-gallery-native.png'});
    const lines = [
        'CIVILIZATION II', 'A game of exploration and civilization', '', 'Design and Programming',
        'Art and Animation', 'Music and Sound', 'Quality Assurance', '', 'Thank you for playing'
    ];
    lines.forEach((t, i) =>
                      s.text(t, 2, 22 + i * 35, i === 0 ? 26 : 21, 596, {center : true, bold : i === 0}));
    s.footer();
    return s;
}

function tax() {
    const s = new Scene('tax-rates', 'Tax Rates', 400, 256, 'tax');
    s.add('background', {key : 'tiles.dll/65', replacement : 'backgrounds/research-library-native.png'});
    s.text('Government: Monarchy   Max Rate: 70%', 10, 6, 14, 340, {center : true});
    s.text('Income: 124   Cost: 46', 10, 40, 14, 340, {center : true});
    s.text('Discoveries: 6 turns', 10, 57, 14, 340, {center : true});
    [[ 'Tax', 30, 'gold' ], [ 'Science', 60, 'science' ], [ 'Luxuries', 10, 'luxury' ]].forEach(
        ([ name, value, role ], i) => {
            const y = 91 + i * 40;
            s.text('0%', 10, y, 14, 40);
            s.text('100%', 310, y, 14, 40);
            s.text(`${name}: ${value}%`, 45, y, 14, 264, {center : true});
            s.add('slider', {x : 10, y : y + 17, width : 340, height : 16, value, role});
            s.add('checkbox', {x : 364, y : y + 17, width : 16, height : 16, checked : i === 1});
        });
    s.text('Lock', 357, 91, 12, 38);
    s.button('OK', 2, 230, 396, 24);
    return s;
}

function dialog(kind) {
    const isOptions = kind === 'options', isSetup = kind === 'setup', isResearch = kind === 'research',
          isProduction = kind === 'production';
    const w = isOptions ? 480 : isSetup ? 360 : isResearch ? 430 : isProduction ? 430 : 400;
    const h = isOptions ? 410 : isSetup ? 360 : isResearch ? 360 : isProduction ? 340 : 220;
    const title = {
        options : 'Game Options',
        setup : 'Civilization II',
        research : 'What shall we research?',
        production : 'London: Change Production',
        confirmation : 'Quit Civilization II?',
        information : 'City Improvement Complete'
    }[kind];
    const s = new Scene('dialog-' + kind, title, w, h,
                        isOptions    ? 'options'
                        : isSetup    ? 'setup'
                        : isResearch ? 'research'
                                     : 'choice')
                  .heading();
    if (isOptions) {
        const options = data.dialogs.GAMEOPTIONS.filter(t => t && !t.startsWith('@') && !t.startsWith(';'));
        options.forEach((t, i) => {
            const y = 51 + i * 28;
            s.add('checkbox',
                  {x : 17, y : y + 3, width : 16, height : 16, checked : [ 0, 1, 3, 4, 7 ].includes(i)});
            s.text(t, 43, y, 16, w - 55);
        });
        s.footer([ 'OK', 'Cancel' ]);
    } else if (isSetup) {
        const options = data.dialogs.MAINMENU.filter(t => t && !t.startsWith('@') && !t.startsWith(';'));
        options.forEach((t, i) => {
            if (i === 0)
                s.box(12, 50 + i * 32, w - 24, 31, 'selection');
            s.text(t, 28, 54 + i * 32, 18, w - 56);
        });
        s.footer([ 'OK', 'Cancel' ]);
    } else if (isResearch) {
        const names = [ 'Railroad', 'Economics', 'Electricity', 'Sanitation', 'Steel', 'Tactics' ];
        names.forEach((name, i) => {
            const n = data.CIVILIZE.findIndex(r => r[0] === name), y = 55 + i * 42;
            if (i === 0)
                s.box(10, y, w - 20, 40, 'selection');
            s.image(advance(n), 22, y + 8, 36, 20);
            s.text(name, 75, y + 5, 21, w - 90);
        });
        s.footer([ 'OK', 'Goal', 'Help' ]);
    } else if (isProduction) {
        [[ 'Riflemen', 'unit', data.UNITS.findIndex(r => r[0] === 'Riflemen') ],
         [ 'Cannon', 'unit', data.UNITS.findIndex(r => r[0] === 'Cannon') ], [ 'Library', 'improve', 6 ],
         [ 'Marketplace', 'improve', 5 ], [ 'City Walls', 'improve', 8 ]]
            .forEach(([ name, type, i ], row) => {
                const y = 52 + row * 48;
                if (row === 2)
                    s.box(10, y, w - 20, 46, 'selection');
                s.image(type === 'unit' ? unit(i) : improvement(i), 16, y, 64, 40);
                s.text(name, 90, y + 11, 21, w - 105);
            });
        s.footer([ 'OK', 'Help', 'Cancel' ]);
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
        ...['advances', 'advance', 'tree', 'unit', 'improvement', 'wonder', 'terrain'].map(pedia), power(),
        council(), foreign(), historian(), timeline(), destroyed(), credits(), status(), world(), tax(),
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
                    await box({x : 3, y : 3, width : s.width - 6, height : s.height - 39, kind : 'panel'});
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
                await T.draw(p.dst, {...command, x : command.x + 1, y : c.y + 1}, d, '#ddd7c4', true);
            if (!o && s.family === 'endgame')
                await T.draw(p.dst, {...command, x : command.x + 1, y : command.y + 1}, d, '#132420', false);
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
                    input =
                        await C.sharp(input)
                            .extract(
                                {left : c.crop[0], top : c.crop[1], width : c.crop[2], height : c.crop[3]})
                            .png()
                            .toBuffer();
                C.blit(p.dst, await C.raw(input, c.width, c.height, 'nearest'), c.x, c.y);
            } else
                await p.image(file, c.x, c.y, c.width, c.height);
            if (e && c.media && c.x === 99)
                await p.vector(`<rect x="1" y="1" width="${c.width - 2}" height="${
                                   c.height - 2}" fill="none" stroke="#e3c070" stroke-width="2"/>`,
                               c.x, c.y, c.width, c.height);
        } else if (c.op === 'button')
            await Reports.button(p, c, o, e);
        else if (c.op === 'checkbox') {
            await p.box(c.x, c.y, c.width, c.height, o ? '#ffffff' : e ? '#243e33' : '#eeead2', edge, 1);
            if (c.checked)
                await p.vector(`<path d="M3 8L7 12L13 3" fill="none" stroke="${
                                   o   ? '#000000'
                                   : e ? '#e7ce8f'
                                       : '#314d36'}" stroke-width="2"/>`,
                               c.x, c.y, c.width, c.height);
        } else if (c.op === 'slider') {
            await p.box(c.x, c.y, c.width, c.height, o ? '#c0c0c0' : '#8a9c85', edge);
            if (e) {
                await p.box(c.x + 2, c.y + 3, (c.width - 4) * c.value / 100, c.height - 6, '#d2b367',
                            '#d2b367');
                await p.image(E.file(c.role), c.x + 3, c.y - 19, 16, 16);
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
                C.blit(im, C.clear((e ? 3 : 4) * d, 2 * d, [...rgb, 255 ]), city.x * 2 * d, city.y * 2 * d);
            }
            C.blit(p.dst, im, c.x * d, c.y * d);
            await p.vector('<rect x="109" y="74" width="55" height="40" fill="none" stroke="#f4e2a6"/>', c.x,
                           c.y, c.width, c.height);
        } else if (c.op === 'graph') {
            let body = '';
            for (let x = 0; x < 584; x += 50)
                body += `<path d="M${x} 0V366" stroke="${e ? '#47615a' : '#222222'}" stroke-width="1"/>`;
            for (let civ = 1; civ < 8; civ++) {
                const points = [];
                for (let n = 0; n < 120; n++) {
                    const value =
                        Math.max(0, Math.min(350, n * (.9 + civ * .19) + Math.sin(n * .14 + civ) * civ * 3));
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
            mode : 'other-window',
            source : sources[s.family],
            note :
                s.note ||
                    'Static source-guided review adapter: native geometry and declared display fixture; shared placement for original, native replacement and HD. Enhanced uses independent contrast, hierarchy and control cues. See OTHER-WINDOWS.md for fidelity boundaries.'
        };
        for (const variant of ['original', 'current', 'hd', 'proposed']) {
            const file = variant === 'original' ? `review/original-scenes/images/${s.id}.png`
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
    C.json(C.path.join(C.pack, 'review/other-windows/static-scenes.json'), catalog);
    C.json(C.path.join(C.pack, 'review/fixtures/other-windows/static-layouts.json'), specs);
    const sourceHashes = Object.fromEntries([...new Set(Object.values(sources).map(v => v[0])) ].map(
        f => [f, C.sha(C.fs.readFileSync(C.path.join(C.root, f)))]));
    C.json(C.path.join(C.pack, 'review/other-windows/source-adapters.json'), {
        policy :
            'Source-guided static adapters; not compiled original function bodies or verified runtime screenshots.',
        sources,
        sourceHashes,
        fixtures :
            'Declared report/civilopedia/dialog values; powergraph and casualty history are illustrative, not recovered from the save.',
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
