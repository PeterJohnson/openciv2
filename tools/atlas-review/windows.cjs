const C = require('./common.cjs');
const E = require('./economy.cjs');
const Citizens = require('./citizens.cjs');
const {spawnSync} = require('node:child_process');
const {fs, path, pack, sharp, svg, raw, clear, blit, png, fit} = C;
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const governments =
    [ 'anarchy', 'despotism', 'monarchy', 'communism', 'fundamentalism', 'republic', 'democracy' ];
const techNames = {
    12 : 'Banking',
    13 : 'Engineering',
    14 : 'Medicine',
    15 : 'Navigation',
    16 : 'Physics',
    17 : 'Electricity'
};
const buildingNames =
    [ 'Palace', 'Barracks', 'Granary', 'Temple', 'Marketplace', 'Library', 'Courthouse', 'City walls' ];
const buildingFiles =
    [ 'palace', 'barracks', 'granary', 'temple', 'marketplace', 'library', 'courthouse', 'city-walls' ];
const fixtureUnits = [ 'riflemen', 'engineers', 'cavalry' ];
const sources = {
    diplomacy : 'src/auto/diplomacy.cpp:4629–5047',
    spaceship : 'src/game/bigframes.cpp:587–1563; src/auto/spaceship.cpp:541–712,867–944',
    'city-window' :
        'src/auto/city.cpp:12165–12430,13485–13803,13817–14085,14087–14205,14448–14695,15101–15149'
};

function windowEngine(mode, file, config = 'Release') {
    const r = spawnSync(path.join(C.root, 'build/atlas-review', config, 'atlas-windows.exe'), [ mode, file ],
                        {encoding : 'utf8', maxBuffer : 32 * 1024 * 1024});
    if (r.error || r.status !== 0)
        throw Error(r.error || r.stderr || `Native window exit ${r.status}`);
    return JSON.parse(r.stdout);
}

class Painter {
    constructor(w, h, density) {
        this.w = w;
        this.h = h;
        this.d = density;
        this.dst = clear(w * density, h * density, [ 19, 32, 32, 255 ]);
        this.ops = [];
    }

    async vector(body, x = 0, y = 0, w = this.w, h = this.h) {
        blit(this.dst, await raw(Buffer.from(svg(w, h, body)), w * this.d, h * this.d), x * this.d,
             y * this.d);
    }

    async box(x, y, w, h, fill = '#263e3b', stroke = '#8f8864', radius = 0) {
        await this.vector(`<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${radius}" fill="${
                              fill}" stroke="${stroke}"/>`,
                          x, y, w, h);
    }

    async text(s, x, y, w, size = 12, color = '#e9dfbe', align = 'start') {
        await this.vector(`<text x="${align === 'middle' ? w / 2 : 1}" y="${
                              size}" font-family="Noto Sans,DejaVu Sans,sans-serif" font-size="${
                              size}" text-anchor="${align}" fill="${color}">${escape(s)}</text>`,
                          x, y, w, size * 1.45);
    }

    async image(file, x, y, w, h, {contain = true, opacity = 1} = {}) {
        this.ops.push({file : file.replaceAll('\\', '/'), x, y, width : w, height : h});
        let input = contain ? await fit(path.join(pack, file), Math.max(1, Math.round(w * this.d)),
                                        Math.max(1, Math.round(h * this.d)), 1)
                            : path.join(pack, file);
        let p = await raw(input, w * this.d, h * this.d);
        if (opacity !== 1) {
            p = {...p, data : Buffer.from(p.data)};
            for (let i = 3; i < p.data.length; i += 4)
                p.data[i] = Math.round(p.data[i] * opacity);
        }
        blit(this.dst, p, x * this.d, y * this.d);
    }

    async button(label, x, y, w, h = 25) {
        await this.box(x, y, w, h, '#394e45', '#b6a36d', 2);
        await this.text(label, x, y + 5, w, 11, '#f0e2b8', 'middle');
    }

    async finish() {
        return png(this.dst);
    }
}

async function windowAssets() {
    const items = {
        'panel' : [
            256, 128,
            '<rect x="1" y="1" width="254" height="126" rx="7" fill="#203835" fill-opacity=".94" stroke="#aa9562" stroke-width="2"/>'
        ],
        'inset' : [
            256, 128,
            '<rect x="1" y="1" width="254" height="126" rx="3" fill="#132726" stroke="#677e6d" stroke-width="2"/>'
        ],
        'food-meter' : [
            320, 28,
            '<rect x="1" y="1" width="318" height="26" rx="4" fill="#152a24" stroke="#819565"/><rect x="4" y="4" width="192" height="20" rx="2" fill="#a3b66d"/><path d="M160 1V27" stroke="#eedba4" stroke-width="2"/>'
        ],
        'production-meter' : [
            320, 28,
            '<rect x="1" y="1" width="318" height="26" rx="4" fill="#14272a" stroke="#7b9797"/><rect x="4" y="4" width="140" height="20" rx="2" fill="#80a6ac"/>'
        ],
        'attachment-empty' : [
            96, 64,
            '<path d="M8 18L48 2L88 18V46L48 62L8 46Z" fill="#233d3b" fill-opacity=".35" stroke="#91a8a0" stroke-width="2" stroke-dasharray="6 4"/><path d="M8 18L48 35L88 18M48 35V62" fill="none" stroke="#91a8a0"/>'
        ],
        'ship-connector' : [
            128, 64,
            '<path d="M8 49L120 15" stroke="#263b3c" stroke-width="12"/><path d="M8 46L120 12" stroke="#d0c7a6" stroke-width="5"/><path d="M9 51L121 17" stroke="#5b7775" stroke-width="4"/>'
        ],
        'window-action' : [
            192, 48,
            '<rect x="1" y="1" width="190" height="46" rx="4" fill="#405b4d" stroke="#d8bb7b" stroke-width="2"/><path d="M7 7H185" stroke="#839b7a"/>'
        ]
    };
    const entries = [];
    for (const [id, [ w, h, body ]] of Object.entries(items)) {
        const vector = `interface/windows/${id}.svg`, file = `interface/windows/${id}.png`,
              source = svg(w, h, body);
        C.write(path.join(pack, vector), source);
        const b = await sharp(Buffer.from(source)).png().toBuffer();
        C.write(path.join(pack, file), b);
        entries.push({
            id : 'windows.' + id,
            label : id.replaceAll('-', ' '),
            description : 'Authored 2D window composition component; proposed engine metadata',
            category : 'window components',
            kind : 'interface',
            file,
            vector,
            width : w,
            height : h,
            sha256 : C.sha(b),
            sourceSha256 : C.sha(Buffer.from(source))
        });
    }
    const manifest = C.read(path.join(pack, 'manifest.json'));
    manifest.entries = manifest.entries.filter(e => !e.id.startsWith('windows.')).concat(entries);
    C.json(path.join(pack, 'manifest.json'), manifest);
}

async function diplomacy(trace, proposed, density) {
    const p = new Painter(640, 480, density), bg = trace.commands.find(c => c.asset === 'background');
    await p.image(`backgrounds/diplomacy-${governments[bg.resource - 200]}-native.png`, 0, 0, 640, 480,
                  {contain : false});
    if (proposed) {
        for (const [x, w] of [[ 24, 144 ], [ 472, 144 ]]) {
            await p.image('interface/windows/panel.png', x, 107, w, 251, {contain : false});
            await p.vector(`<path d="M${x + 9} 126H${x + w - 9}" stroke="#788975"/>`);
        }
        await p.box(184, 41, 272, 314, '#20322d99', '#c8ab73', 5);
    }
    await p.text('ASTERIAN ENVOY', 184, 16, 272, 17, '#f0dfb2', 'middle');
    await p.text(governments[bg.resource - 200].toUpperCase(), 184, 337, 272, 13, '#e7cf98', 'middle');
    await p.text('MILITARY', 35, 108, 130, 12, '#f0dfb2', 'middle');
    await p.text('KNOWLEDGE', 477, 108, 130, 12, '#f0dfb2', 'middle');
    for (const c of trace.commands) {
        if (c.asset === 'tech-label') {
            const name = techNames[+c.text] || `Advance ${c.text}`;
            await p.text(proposed ? name : name.slice(0, 8).toUpperCase(), proposed ? 515 : c.x,
                         proposed ? c.y + 1 : c.y, proposed ? 92 : c.width, proposed ? 11 : 9);
        } else if (c.asset === 'resource') {
            if (c.resource >= 220 && c.resource <= 263) {
                await p.image(`sprites/leaders/leader-${String(c.resource - 220).padStart(2, '0')}.png`, c.x,
                              c.y, c.width, c.height);
            } else if (c.resource === 215) {
                const military = c.sy === 156;
                const f = military ? 'sprites/units/riflemen.png' : 'sprites/advances/' + [
                    'science', 'engineering', 'navigation', 'medicine', 'writing'
                ][Math.floor((c.sy - 1) / 31)] + '.png';
                // Category labels/art are supplied fixture bindings; no original MK.DLL pixels.
                const file = fs.existsSync(path.join(pack, f))
                                 ? f
                                 : (military ? 'sprites/units/riflemen.png'
                                             : 'sprites/diplomacy/exploration-industrial.png');
                if (proposed)
                    await p.image(file, military ? c.x + 3 : 483, c.y, military ? 40 : 27, 27);
                else
                    await p.image(file, c.x, c.y, military ? c.width : 42, c.height);
                if (proposed && military)
                    await p.text('Regiment', c.x + 48, c.y + 8, 77, 10, '#d8d9bc');
            }
        }
    }
    // No invented dialogue choices: this fixture exercises the static leader audience.
    return {buffer : await p.finish(), ops : p.ops};
}

const shipKind = r => ({
    441 : 'propulsion',
    442 : 'propulsion',
    480 : 'life-support',
    481 : 'life-support',
    455 : 'fuel',
    456 : 'fuel',
    490 : 'solar',
    489 : 'solar',
    470 : 'habitation',
    471 : 'habitation',
    491 : 'structural-cross'
})[r];

function shipEmpty(r) {
    return [ 442, 481, 456, 489, 471 ].includes(r);
}

async function ship(trace, scene, proposed, density) {
    const p = new Painter(640, 480, density);
    await p.image('backgrounds/space-yard-native.png', 0, 0, 640, 480, {contain : false});
    await p.box(0, 0, 640, 38, '#162d2bf2', '#ab9765');
    await p.text('ASTERIAN STARSHIP', 12, 9, 616, 20, '#f1dfb4', 'middle');
    await p.box(4, 39, 166, 368, proposed ? '#18322df0' : '#18322dc0', '#718775', 3);
    const names = [ 'Structural', 'Propulsion', 'Fuel', 'Habitation', 'Life support', 'Solar' ];
    for (let i = 0; i < 6; i++) {
        const y = proposed ? 61 + i * 42 : 43 + i * 22;
        await p.text(names[i], 12, y, 141, proposed ? 12 : 13);
        if (proposed) {
            await p.box(12, y + 20, 132, 5, '#112522', '#415e52');
            await p.box(12, y + 20, Math.max(2, 132 * scene.counts[i] / [ 39, 8, 8, 4, 4, 4 ][i]), 5,
                        '#bac183', '#bac183');
            await p.text(`${scene.counts[i]} / ${[39, 8, 8, 4, 4, 4][i]}`, 107, y, 55, 10);
        } else
            await p.text(String(scene.counts[i]), 144, y, 22, 13);
    }
    if (!proposed) {
        for (const [i, s] of [`Population: ${scene.counts[3] * 10},000`, 'Support: 100%', 'Energy: 100%',
                              'Mass: 19,600 t', 'Fuel: 100%', 'Flight: 15.0 years']
                 .entries())
            await p.text(s, 12, 194 + i * 22, 154, 11);
    } else {
        await p.text('Launch readiness', 12, 332, 145, 12);
        await p.text('All systems operational', 12, 356, 145, 10, '#c9dba2');
        await p.text('Flight: 15.0 years', 12, 382, 145, 11, '#aabeb0');
    }
    if (proposed)
        await p.box(175, 55, 457, 348, '#10292eaa', '#668b87', 4);
    const parts = trace.commands.filter(c => c.asset === 'resource' && c.target === -100);
    // Attachment ports come from the actual selected crop rectangles. The proposal
    // adds explicit connecting geometry beneath them; content/counts remain source-selected.
    if (proposed) {
        await p.text('ASSEMBLY BAYS', 192, 67, 416, 12, '#bed2c1', 'middle');
        const layout = shipLayout();
        for (let lane = 0; lane < 4; lane++) {
            const y = 126 + lane * 72;
            const built = scene.counts[0] >= Math.min(39, (lane + 1) * 10);
            await p.vector(`<g opacity="${built ? 1 : .35}"><path d="M213 ${y}H589M405 ${y - 36}V${
                y + 36}" fill="none" stroke="#233b3b" stroke-width="10"/><path d="M213 ${y - 1}H589M405 ${
                y - 36}V${y + 36}" fill="none" stroke="#b0c0aa" stroke-width="3" ${
                built ? '' : 'stroke-dasharray="5 5"'}/></g>`);
        }
        for (const slot of layout.slots) {
            const count = scene.counts[layout.countOrder.indexOf(slot.kind)], built = slot.index < count;
            const file = built ? slot.asset : 'interface/windows/attachment-empty.png';
            await p.image(file, slot.x, slot.y, slot.width, slot.height, {opacity : built ? 1 : .5});
        }
    } else {
        const layer = new Painter(457, 304, density);
        layer.dst = clear(457 * density, 304 * density);
        for (const c of parts) {
            const x = c.x, y = c.y, kind = shipKind(c.resource);
            if (!kind) {
                // Selected structural resource: authored replacement truss inside its exact native frame.
                {
                    const a = x, b = y, w = c.width, h = c.height;
                    await layer.vector(`<path d="M${a + 8} ${b + h * .75}L${a + w * .82} ${b + 8}L${
                        a + w - 8} ${b + h * .30}L${a + w * .22} ${b + h - 8}ZM${a + w * .18} ${
                        b + h * .56}L${a + w * .42} ${b + h * .70}M${a + w * .39} ${b + h * .38}L${
                        a + w * .64} ${b + h * .49}M${a + w * .61} ${b + h * .20}L${a + w * .85} ${
                        b + h * .31}" fill="none" stroke="#bac7af" stroke-width="4"/>`);
                }
                continue;
            }
            const file = shipEmpty(c.resource) ? 'interface/windows/attachment-empty.png'
                                               : `sprites/spaceship/${kind}.png`;
            await layer.image(file, x, y, c.width, c.height, {opacity : shipEmpty(c.resource) ? .62 : 1});
        }
        blit(p.dst, layer.dst, 175 * density, 99 * density);
        p.ops.push(...layer.ops.map(op => ({...op, x : op.x + 175, y : op.y + 99})));
    }
    await p.button('Close', 501, 417, 52, 36);
    await p.button(scene.ready ? 'Launch' : 'Not ready', 559, 417, 67, 36);
    if (proposed) {
        await p.box(4, 412, 486, 40, '#18322df0', '#718775', 2);
        await p.text(`Population: ${scene.counts[3] * 10},000 · Support: 100% · Energy: 100%`, 12, 416, 470,
                     11);
        await p.text('Mass: 19,600 t · Fuel: 100% · Flight: 15.0 years', 12, 433, 470, 10);
    }
    await p.text(scene.ready ? 'Launch success: 100%' : 'Review fixture · incomplete spacecraft', 3, 454, 634,
                 14, '#dce2ba', 'middle');
    return {buffer : await p.finish(), ops : p.ops};
}

function shipLayout() {
    const countOrder = [ 'structural', 'propulsion', 'fuel', 'habitation', 'life-support', 'solar' ];
    const slots = [];
    for (let lane = 0; lane < 4; lane++) {
        const y = 102 + lane * 72;
        for (const [kind, index, x, w,
                    h] of [[ 'propulsion', lane * 2, 197, 41, 36 ],
                           [ 'propulsion', lane * 2 + 1, 238, 41, 36 ], [ 'fuel', lane * 2, 284, 48, 36 ],
                           [ 'fuel', lane * 2 + 1, 333, 48, 36 ], [ 'solar', lane, 386, 59, 45 ],
                           [ 'habitation', lane, 450, 63, 40 ], [ 'life-support', lane, 521, 65, 40 ]])
            slots.push({
                kind,
                index,
                asset : `sprites/spaceship/${kind}.png`,
                x,
                y,
                width : w,
                height : h,
                anchor : 'center-port',
                layer : 'module'
            });
    }
    return {
        canvas : [ 640, 480 ],
        background : 'backgrounds/space-yard-native.png',
        countOrder,
        maxCounts : [ 39, 8, 8, 4, 4, 4 ],
        policy :
            'Proposed one-sprite-per-component layout, distinct from native split-crop rows. Structural counts govern truss readiness, not 39 separate ornaments.',
        source : 'src/game/bigframes.cpp:587–1563; counts supplied by the same review fixture',
        slots
    };
}

async function resourceMap(p, x, y, original = null) {
    // create_controls at city.cpp:17053 selects zoom -2 for view_scale=2.
    // draw_resource_map supplies (5+3*24,11+4*12); the source tables order 21 cells.
    const dx = [ -1, 1, -2, 0, 2, -3, -1, 1, 3, -2, 0, 2, -3, -1, 1, 3, -2, 0, 2, -1, 1 ];
    const dy = [ -3, -3, -2, -2, -2, -1, -1, -1, -1, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3 ];
    const bindings = original?.bindings || C.read(path.join(pack, 'compatibility/bindings.json')).bindings;
    for (let i = 0; i < 21; i++) {
        const px = x + 77 + dx[i] * 24, py = y + 59 + dy[i] * 12;
        await p.image(bindings['terrain/' + (i % 7 === 0 ? 4 : 2)].file, px, py, 48, 24, {contain : false});
        if (i === 10)
            await p.image(bindings['city/14'].file, px, py - 12, 48, 36, {contain : false});
    }
}

async function city(trace, scene, proposed, density, original = null) {
    const p = original?.painter || new Painter(636, 421, density), citizenCues = [];
    await p.image('backgrounds/parchment-native.png', 0, 0, 636, 421, {contain : false});
    await p.box(0, 0, 636, 421, proposed ? '#233c36ee' : '#2e413bdd', '#a28d60');
    for (const c of trace.commands) {
        const {x, y, width : w, height : h} = c;
        if (c.asset === 'panel') {
            await p.box(x, y, w, h, '#20362dcc', proposed ? '#a39468' : '#647664', proposed ? 3 : 0);
        } else if (c.asset === 'bevel') {
            if (!proposed)
                await p.box(x, y, w, h, '#172c27', '#a5a479');
        } else if (c.asset === 'line') {
            if (!proposed)
                await p.vector(`<path d="M${x} ${y}h${w}" stroke="#d8c583"/>`);
        } else if (c.asset === 'text' || c.asset === 'text-left') {
            await p.text(c.text, x, y, w,
                         c.asset === 'text-left' ? 10
                         : proposed              ? 12
                                                 : 11,
                         '#ead6a2', c.asset === 'text-left' ? 'start' : 'middle');
        } else if (c.asset.startsWith('unit/')) {
            await p.image(`sprites/units/${fixtureUnits[+c.asset.split('/')[1]]}.png`, x, y, w, h);
        } else if (c.asset.startsWith('icon/')) {
            const id = +c.asset.split('/')[1];
            if (c.shade && !original)
                continue;
            if (original) {
                await p.image(original.bindings['icon/' + id].file, x, y, w, h,
                              {contain : false, opacity : c.shade ? .28 : 1});
                continue;
            }
            if (id >= 100 && id < 144) {
                await Citizens.draw(p, id, x, y, w, h, false);
                if (proposed)
                    citizenCues.push({id, x, y, w, h});
            } else if (id >= 200)
                await p.image(`sprites/buildings/${buildingFiles[id - 201] || 'library'}.png`, x, y, w, h);
            else if (E.nativeRoles[id] && (!proposed || id >= 3 || w <= 10))
                await p.image(E.file(E.nativeRoles[id]), x, y, w, h,
                              {contain : E.nativeRoles[id] !== 'food' ? false : true});
            else if (id === 14)
                await p.image('sprites/citizens/industrial-unhappy.png', x, y, w, h);
        } else if (c.asset === 'adapter-resource-map') {
            await p.box(x, y, w, h, '#1b332ccc', '#6b816b');
            await resourceMap(p, x, y, original);
            await p.text('City resources', x + 7, y + 121, 188, 11, '#e9d9aa', 'middle');
            const labels = [ 'Food', 'Shields', 'Trade', 'Taxes', 'Luxury', 'Science' ];
            const roles = [ 'food', 'production', 'trade', 'gold', 'luxury', 'science' ];
            const amounts = [ '28  +4', '16  +12', '24', '10', '4', '10' ];
            for (let i = 0; i < 6; i++) {
                await p.text(labels[i], x + 213, y + 7 + i * 22, 92, 11);
                if (proposed) {
                    await p.image(E.file(roles[i]), x + 282, y + 7 + i * 22, 14, 14, {contain : false});
                    await p.box(x + 299, y + 10 + i * 22, 68, 7, '#132e28', '#506b58');
                    await p.box(x + 299, y + 10 + i * 22, [ 61, 43, 52, 33, 14, 33 ][i], 7,
                                i === 0 ? '#a9bc7a' : '#9ab9a9', '#9ab9a9');
                } else
                    for (let j = 0; j < [ 9, 7, 8, 5, 2, 5 ][i]; j++)
                        await p.image(E.file(roles[i]), x + 297 + j * 9, y + 7 + i * 22, 13, 13);
                await p.text(amounts[i], x + 379, y + 7 + i * 22, 55, 11);
            }
        } else if (c.asset === 'adapter-supported') {
            await p.box(x, y, w, h, '#20362dcc', '#6b816b');
            await p.text('Supported units', x + 7, y + 4, w - 14, 11, '#ead6a2', 'middle');
            for (let i = 0; i < 3; i++)
                await p.image(`sprites/units/${fixtureUnits[i]}.png`, x + 11 + i * 53, y + 23, 40, 30);
            if (proposed)
                await p.text('Upkeep: 3 shields', x + 7, y + 61, w - 14, 9, '#afc6ab', 'middle');
        } else if (c.asset === 'adapter-improvements') {
            await p.box(x, y, w, h, '#20362dcc', '#6b816b');
            await p.text('Improvements', x, y, w, 11, '#ead6a2', 'middle');
            for (let i = 0; i < 8; i++) {
                await p.image(`sprites/buildings/${buildingFiles[i]}.png`, x + 8, y + 17 + i * 12, 18, 10);
                await p.text(buildingNames[i], x + 32, y + 15 + i * 12, 133, 10);
            }
        } else if (c.asset === 'adapter-present') {
            await p.text('Units present', 192, 219, 244, 11, '#ead6a2', 'middle');
            for (let i = 0; i < 3; i++) {
                await p.image(`sprites/units/${fixtureUnits[i]}.png`, 194 + i * 48, 234, 48, 36);
                await p.text('AST', 194 + i * 48, 270, 48, 9, '#c1cdb2', 'middle');
            }
            await p.text('Supply: silk, wool, wine', 204, 326, 222, 11);
            await p.text('Demand: coal, gold, cloth', 204, 349, 222, 11);
            if (proposed)
                await p.text('Select a unit for orders', 204, 386, 222, 10, '#b3c7b7', 'middle');
        } else if (c.asset === 'adapter-buttons') {
            await p.box(x, y, w, h, '#20362dcc', '#6b816b');
            await p.button('Buy', x + 8, y + 8, 80, 22);
            await p.button('Change', x + 98, y + 8, 94, 22);
            await p.button('Exit city', x + 8, y + 36, 184, 22);
        }
    }
    if (proposed) {
        const food = scene.food, capacity = (scene.population + 1) * 10, shields = scene.shields;
        await p.image(E.file('food'), 521, 169, 22, 22);
        await p.image(E.file('production'), 521, 363, 22, 22, {contain : false});
        await p.text(`${food} / ${capacity} food`, 449, 41, 174, 14, '#d7e3b7', 'middle');
        await p.box(451, 73, 167, 18, '#132c25', '#8da578', 3);
        await p.box(453, 75, Math.max(2, 163 * food / capacity), 14, '#a7bb7d', '#a7bb7d', 2);
        await p.vector('<path d="M534 72V92" stroke="#f3dba3" stroke-width="2"/>');
        await p.text('Granary · half retained', 449, 104, 174, 11, '#c8d4ac', 'middle');
        await p.text('Surplus +4 food / turn', 449, 132, 174, 11, '#c8d4ac', 'middle');
        await p.text(`${shields} / 120 shields`, 449, 228, 174, 14, '#c0dbd6', 'middle');
        await p.box(451, 260, 167, 18, '#152b2b', '#81a39e', 3);
        await p.box(453, 262, Math.max(2, 163 * shields / 120), 14, '#88aeaa', '#88aeaa', 2);
        await p.text(`Library · ${Math.ceil((120 - shields) / 12)} turns`, 449, 298, 174, 12, '#d5ddbe',
                     'middle');
        await p.text('Surplus +12 shields / turn', 449, 328, 174, 10, '#b6c9b9', 'middle');
    }
    // Native overlap can cover a portrait's lower-right edge. Draw all cues
    // after the entire row so later citizens cannot hide earlier mood markers.
    for (const c of citizenCues)
        await Citizens.badge(p, c.id, c.x, c.y, c.w, c.h);
    return {buffer : await p.finish(), ops : p.ops};
}

const sceneDefs = [
    {
        id : 'diplomacy',
        mode : 'diplomacy',
        title : 'Diplomacy · leader portrait and intelligence columns',
        fixtureText : '3 14 2 6\n'
    },
    {
        id : 'spacecraft-assembly',
        mode : 'spaceship',
        title : 'Spacecraft · incomplete assembly and empty attachments',
        fixtureText : '25 25 6 4 6 4 2 1 2 1 2 1\n',
        counts : [ 25, 4, 4, 1, 1, 1 ],
        ready : true
    },
    {
        id : 'spacecraft-complete',
        mode : 'spaceship',
        title : 'Spacecraft · completed assembly and launch status',
        fixtureText : '39 39 8 8 8 8 4 4 4 4 4 4\n',
        counts : [ 39, 8, 8, 4, 4, 4 ],
        ready : true
    },
    {
        id : 'city-window',
        mode : 'city-window',
        title : 'City window · citizens, yields, production and improvements',
        fixtureText : '12 79 53 3 3 3\n',
        citizenEra : 2,
        angry : 1,
        population : 12,
        food : 79,
        shields : 53
    },
    {
        id : 'city-window-crowded',
        mode : 'city-window',
        title : 'City window · crowded citizens and nearly full stockpiles',
        fixtureText : '28 260 107 10 6 3\n',
        citizenEra : 3,
        angry : 2,
        population : 28,
        food : 260,
        shields : 107
    }
];

async function buildWindows() {
    await windowAssets();
    await E.build();
    await Citizens.buildAssets();
    C.json(path.join(pack, 'space-layout.json'), shipLayout());
    const scenes =
        C.read(path.join(pack, 'review/scenes.json')).filter(s => !sceneDefs.some(d => d.id === s.id));
    const plans = {};
    for (const def of sceneDefs) {
        const s = {
            ...def,
            fixture : `review/fixtures/${def.id}.txt`,
            windowEngine : true,
            source : sources[def.mode]
        };
        C.write(path.join(pack, s.fixture),
                s.fixtureText + (s.mode === 'city-window'
                                     ? E.yieldFixture + `citizens ${s.citizenEra} ${s.angry}\n`
                                     : ''));
        delete s.fixtureText;
        const trace = windowEngine(s.mode, path.join(pack, s.fixture));
        C.json(path.join(pack, `review/traces/${s.id}.json`), trace);
        for (const stage of ['current', 'hd', 'proposed']) {
            const proposed = stage === 'proposed', d = stage === 'current' ? 1 : 2;
            const result = s.mode === 'diplomacy'   ? await diplomacy(trace, proposed, d)
                           : s.mode === 'spaceship' ? await ship(trace, s, proposed, d)
                                                    : await city(trace, s, proposed, d);
            const file = `review/images/${s.id}-${stage}.png`;
            C.write(path.join(pack, file), result.buffer);
            s[stage] = file;
            s[stage + 'Size'] = [ trace.width * d, trace.height * d ];
            plans[s.id + '-' + stage] = result.ops;
        }
        s.note =
            'Native source layout and selected draw algorithms; supplied artwork, text metrics and marked panel adapters. See window audit for exact scope.';
        s.commandCount = trace.commands.length;
        scenes.push(s);
        console.log(s.id, trace.commands.length, 'native commands');
    }
    C.json(path.join(pack, 'review/window-draw-plans.json'), plans);
    C.json(path.join(pack, 'review/scenes.json'), scenes);
    await Citizens.review(module.exports);
    fs.copyFileSync(path.join(C.root, 'build/atlas-review/generated/window-extraction.json'),
                    path.join(pack, 'review/window-extraction.json'));
}

if (require.main === module)
    buildWindows().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    buildWindows,
    windowEngine,
    sceneDefs,
    Painter,
    city
};
