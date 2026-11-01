// Source content layout; original bitmap and replacement smooth fonts are explicit modes.
// Enhanced window compositions live separately in windows.cjs.
const C = require('./common.cjs'), Font = require('./font.cjs'), E = require('./economy.cjs');
const Typography = require('./typography.cjs');
const Backgrounds = require('./native-backgrounds.cjs');
const Citizens = require('./citizens.cjs'), Knowledge = require('./knowledge.cjs'),
      Military = require('./military.cjs');
const units = [ 'riflemen', 'engineers', 'cavalry' ];
const buildings =
    [ 'palace', 'barracks', 'granary', 'temple', 'marketplace', 'library', 'courthouse', 'city-walls' ];
const nativeRoles = {
    ...E.nativeRoles,
    20 : 'trade',
    21 : 'luxury',
    22 : 'science',
    23 : 'food',
    24 : 'food',
    25 : 'production',
    26 : 'production',
    27 : 'trade'
};
// Authored equivalents of semantic palette colors, kept separate from local original palettes.
const colors = {
    10 : '#000000',
    11 : '#e52d25',
    18 : '#31483c',
    19 : '#312f2b',
    26 : '#f4eee1',
    29 : '#ffffff',
    37 : '#372e42',
    41 : '#e4dba0',
    42 : '#83ad46',
    44 : '#a7ca60',
    45 : '#496a27',
    46 : '#a7ce6b',
    48 : '#71973b',
    57 : '#373426',
    84 : '#8aadc4',
    92 : '#90bdcd',
    94 : '#b6cadd',
    98 : '#4b3430',
    118 : '#d9bb5e',
    121 : '#b09b53',
    124 : '#d4c084',
    249 : '#81aeb2',
    250 : '#a8d3c1',
    251 : '#daba62',
    254 : '#dcebd2'
};
const palette = n => colors[n] || '#d4c39b';

function fill(p, x, y, w, h, color) {
    const rgb = color.match(/[a-f\d]{2}/gi).map(s => parseInt(s, 16));
    C.blit(p.dst, C.clear(Math.max(0, w * p.d), Math.max(0, h * p.d), [...rgb, 255 ]), x * p.d, y * p.d);
}

async function text(
    p, s, x, y,
    {face = 1, size = 12, style = 1, color = 124, shadow = -1, align = 'left', width = 0, height = 0, clip} =
        {}) {
    const f = Font.get(face, size, style), w = Font.width(s, f);
    if (align === 'center')
        x += Math.trunc((width - w) / 2);
    if (height)
        y += Math.trunc((height - f.cellHeight) / 2);
    const c = {text : s, x, y, face, fontHeight : size, style, clip};
    if (shadow >= 0)
        await Typography.draw(p.dst, {...c, x : x + 1, y : y + 1}, p.d, p.palette(shadow), p.originalText);
    await Typography.draw(p.dst, c, p.d, p.palette(color), p.originalText);
}

async function button(p, label, x, y, w, h = 24) {
    // Raised button with source control bounds and the selected typography mode.
    fill(p, x, y, w, h, '#c0c0c0');
    fill(p, x, y, w, 1, '#ffffff');
    fill(p, x, y, 1, h, '#ffffff');
    fill(p, x + w - 1, y, 1, h, '#000000');
    fill(p, x, y + h - 1, w, 1, '#000000');
    fill(p, x + w - 2, y + 1, 1, h - 2, '#808080');
    fill(p, x + 1, y + h - 2, w - 2, 1, '#808080');
    await text(p, label, x + 2, y + 2, {
        color : 10,
        align : 'center',
        width : w - 4,
        height : h - 4,
        clip : [ x + 2, y + 2, x + w - 2, y + h - 2 ]
    });
}

async function icon(p, c, original) {
    const id = +c.asset.split('/')[1];
    if (original) {
        const b = original.bindings[c.asset];
        if (!b)
            throw Error('Native original icon ' + c.asset);
        await p.image(b.file, c.x, c.y, c.width, c.height, {contain : false, silhouette : !!c.shade});
    } else if (id >= 100 && id < 144) {
        if (c.shade) {
            const input =
                await C.fit(C.path.join(C.pack, Citizens.binding(id).file), c.width * p.d, c.height * p.d, 1);
            const bitmap = await C.raw(input, c.width * p.d, c.height * p.d);
            for (let i = 0; i < bitmap.data.length; i += 4)
                bitmap.data[i] = bitmap.data[i + 1] = bitmap.data[i + 2] = 0;
            C.blit(p.dst, bitmap, c.x * p.d, c.y * p.d);
        } else
            await Citizens.draw(p, id, c.x, c.y, c.width, c.height, false);
    } else if (id >= 200)
        await p.image(`sprites/buildings/${buildings[id - 201] || 'library'}.png`, c.x, c.y, c.width,
                      c.height);
    else if (nativeRoles[id])
        await p.image(E.file(nativeRoles[id]), c.x, c.y, c.width, c.height,
                      {contain : nativeRoles[id] === 'food'});
    else if (id === 14)
        await p.image('sprites/citizens/industrial-unhappy.png', c.x, c.y, c.width, c.height);
    else
        throw Error('Native icon ' + id);
}

async function city(trace, scene, p, original, resourceMap) {
    await p.image(original ? 'backgrounds/parchment-native.png' : Backgrounds.file('city-window'), 0, 0, 636,
                  421, {contain : false});
    for (const c of trace.commands) {
        const {x, y, width : w, height : h} = c;
        if (c.asset === 'native-text')
            await Typography.draw(p.dst, c, p.d, p.palette(c.color), p.originalText);
        else if (c.asset === 'native-fill')
            fill(p, x, y, w, h, p.palette(c.color));
        else if (c.asset === 'bevel') {
            fill(p, x, y, w, 1, p.palette(c.sx));
            fill(p, x, y, 1, h, p.palette(c.sx));
            fill(p, x, y + h - 1, w, 1, p.palette(c.sy));
            fill(p, x + w - 1, y, 1, h, p.palette(c.sy));
        } else if (c.asset === 'line')
            fill(p, x, y, w, h, p.palette(c.color));
        else if (c.asset.startsWith('icon/'))
            await icon(p, c, original);
        else if (c.asset.startsWith('unit/'))
            await p.image(`sprites/units/${units[+c.asset.split('/')[1]]}.png`, x, y, w, h);
        else if (c.asset === 'native-resource-terrain') {
            const args = [ 'resource-terrain', C.path.join(C.pack, scene.fixture) ];
            if (original)
                args.push(C.path.join(C.pack, 'review/original-local/anchors.txt'));
            const run = require('node:child_process')
                            .spawnSync(C.path.join(C.root, 'build/atlas-review/Release/atlas-engine.exe'),
                                       args, {encoding : 'utf8'});
            if (run.status !== 0)
                throw Error(run.stderr);
            const terrain = JSON.parse(run.stdout),
                  bindings = original?.bindings ||
                             C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
            const b =
                await require('./render.cjs')
                    .baseline(terrain, {mode : 'resource-terrain'}, bindings,
                              {density : p.d, native : p.d === 1, transparent : true, palette : p.palette});
            C.blit(p.dst, await C.raw(b), x * p.d, y * p.d);
            for (const t of terrain.commands)
                if (bindings[t.asset])
                    p.ops.push({
                        file : bindings[t.asset].file,
                        x : x + t.x,
                        y : y + t.y,
                        width : t.width,
                        height : t.height
                    });
        } else if (c.asset === 'adapter-present') {
            // Source draw_units_present, single-row branch for the supplied three-unit stack.
            await text(p, 'Units Present', 197, 217, {width : 233, align : 'center', shadow : 18});
            for (let i = 0; i < 3; i++) {
                await p.image(`sprites/units/${units[i]}.png`, 194 + i * 48, 234, 48, 36);
                await text(p, 'AST', 194 + i * 48, 270,
                           {width : 48, align : 'center', color : 10, shadow : 26});
            }
            // The finite fixture has no Trade advance/routes and no pollution.
        }
    }
    // CityWindow::create_controls/create_change_button/create_exit_button, view_scale=2.
    await button(p, 'Buy', 442, 181, 68);
    await button(p, 'Change', 557, 181, 68);
    await button(p, '^', 437, 364, 21);
    await button(p, 'v', 437, 389, 21);
    for (const [label, x, y] of [[ 'Info', 459, 364 ], [ 'Map', 517, 364 ], [ 'Rename', 575, 364 ],
                                 [ 'Happy', 459, 389 ], [ 'View', 517, 389 ], [ 'Exit', 575, 389 ]])
        await button(p, label, x, y, 57);
    // Native 17px system scrollbar at source content bounds; eight improvements, no scroll needed.
    fill(p, 174, 291, 17, 129, '#c0c0c0');
    await button(p, '^', 174, 291, 17, 17);
    await button(p, 'v', 174, 403, 17, 17);
}

async function diplomacy(trace, p, original) {
    const bg = trace.commands.find(c => c.asset === 'background');
    await p.image(original ? original.bindings['background/diplomacy'].file
                           : Backgrounds.file('diplomacy', bg.resource - 200),
                  0, 0, 640, 480, {contain : false});
    for (const [i, c] of trace.commands.entries()) {
        if (c.asset === 'native-text')
            await Typography.draw(p.dst, c, p.d, p.palette(c.color), p.originalText);
        else if (c.asset === 'resource') {
            let file, w = c.width;
            if (original)
                file = original.bindings[`window/diplomacy/${i}`].file;
            else if (c.resource >= 220 && c.resource <= 263)
                file = `sprites/leaders/leader-${String(c.resource - 220).padStart(2, '0')}.png`;
            else if (c.resource === 215) {
                file = c.sy === 156 ? Military.categoryFile(c) : Knowledge.categoryFile(c);
                if (c.sy !== 156)
                    w = 42;
            } else
                throw Error('Diplomacy crop ' + c.resource);
            await p.image(file, c.x, c.y, w, c.height, {contain : !original});
        }
    }
}

async function ship(trace, scene, p, original) {
    await p.image(original ? original.bindings['ship-background'].file : Backgrounds.file('spaceship'), 0, 0,
                  640, 480, {contain : false});
    // render_ship copies the assembled 457x304 DIB to (175,99).
    const opStart = p.ops.length;
    const target = C.clear(457 * p.d, 304 * p.d), save = p.dst;
    p.dst = target;
    for (const [i, c] of trace.commands.entries())
        if (c.asset === 'resource' && c.target === -100) {
            if (original)
                await p.image(original.bindings[`window/${scene.id}/${i}`].file, c.x, c.y, c.width, c.height,
                              {contain : false});
            else {
                const kind = ({
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
                })[c.resource];
                if (!kind) {
                    const a = c.x, b = c.y, w = c.width, h = c.height;
                    await p.vector(`<path d="M${a + 8} ${b + h * .75}L${a + w * .82} ${b + 8}L${a + w - 8} ${
                        b + h * .30}L${a + w * .22} ${b + h - 8}ZM${a + w * .18} ${b + h * .56}L${
                        a + w * .42} ${b + h * .70}M${a + w * .39} ${b + h * .38}L${a + w * .64} ${
                        b + h * .49}M${a + w * .61} ${b + h * .20}L${a + w * .85} ${
                        b + h * .31}" fill="none" stroke="#bac7af" stroke-width="4"/>`);
                    continue;
                }
                await p.image(
                    `sprites/spaceship/${kind}.png`, c.x, c.y, c.width, c.height,
                    {contain : false, opacity : [ 442, 481, 456, 489, 471 ].includes(c.resource) ? .35 : 1});
            }
        }
    for (let i = opStart; i < p.ops.length; i++) {
        p.ops[i].x += 175;
        p.ops[i].y += 99;
    }
    p.dst = save;
    C.blit(p.dst, target, 175 * p.d, 99 * p.d);
    // Completed typewriter state: exact native font/line height and colon color transition.
    await text(p, 'A.S.S. Aster (Asterian)', 0, 0,
               {face : 0, size : 24, style : 1, color : 250, align : 'center', width : 639, height : 40});
    const names = [ 'Structural', 'Propulsion', 'Fuel', 'Habitation', 'Life Support', 'Solar Panel' ];
    const lines = names.map((n, i) => `${n}: ${scene.counts[i]}`).concat([
        `Population: ${scene.counts[3]}0,000`, 'Support: 100%', 'Energy: 100%', 'Mass: 19,600 tons',
        'Fuel: 100%', 'Flight Time: 15.0 years'
    ]);
    const f = Font.get(0, 16, 1);
    for (const [i, line] of lines.entries()) {
        let x = 10, y = 40 + i * f.cellHeight - Math.trunc(f.cellHeight / 2), value = false;
        for (const ch of line) {
            await text(p, ch, x, y, {face : 0, size : 16, style : 1, color : value ? 254 : 249});
            x += Font.width(ch, f);
            if (ch === ':')
                value = true;
        }
    }
    await text(p, 'Prob. of Success:  100%', 0, 449, {
        face : 0,
        size : 20,
        style : 1,
        color : 250,
        shadow : 10,
        align : 'center',
        width : 639,
        height : 30
    });
    if (original) {
        await p.image(original.bindings['ship-close'].file, 501, 417, 52, 36, {contain : false});
        await p.image(original.bindings['ship-launch'].file, 559, 417, 67, 36, {contain : false});
        await text(p, 'OK', 501, 417,
                   {face : 0, size : 16, style : 1, color : 139, align : 'center', width : 52, height : 36});
        await text(p, 'Launch', 559, 417,
                   {face : 0, size : 16, style : 1, color : 198, align : 'center', width : 67, height : 36});
    } else {
        await button(p, 'OK', 501, 417, 52, 36);
        await button(p, 'Launch', 559, 417, 67, 36);
    }
}

async function render(trace, scene, p, original, resourceMap) {
    p.originalText = !!original;
    p.palette = original ? (n => original.palette[String(n & 255)]) : palette;
    if (scene.mode === 'city-window')
        await city(trace, scene, p, original, resourceMap);
    else if (scene.mode === 'diplomacy')
        await diplomacy(trace, p, original);
    else
        await ship(trace, scene, p, original);
    return {buffer : await p.finish(), ops : p.ops};
}

module.exports = {
    render,
    palette,
    text,
    fill
};
