const R = __dirname + '/';
const C = require(R + 'common.cjs'), T = require(R + 'typography.cjs'), F = require(R + 'font.cjs'),
      Reports = require(R + 'report-render.cjs'), {Painter} = require(R + 'windows.cjs');
const {spawnSync} = require('node:child_process');
const compat = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings,
      E = require(R + 'economy.cjs'), MapRender = require(R + 'render.cjs');
const ids =
    'pedia-advances pedia-advance pedia-tree pedia-unit pedia-improvement pedia-wonder pedia-terrain powergraph high-council foreign-minister historian casualty-timeline destroyed-civilizations credits status-panel world-map tax-rates dialog-research dialog-production dialog-options dialog-setup dialog-confirmation dialog-information'
        .split(' ');
function file(key, o) {
    if (key === 'popup-info')
        return o ? 'review/original-local/other-windows/popup-info.png' : E.file('gold');
    if (key.startsWith('advance/'))
        return Reports.sprite(200 + Number(key.split('/')[1]), o);
    if (key.startsWith('improvement/')) {
        const n = Number(key.split('/')[1]);
        if (n >= 39)
            return o ? Reports.extra.bindings['wonder-' + (n - 39)].file
                     : C.entries
                           .find(e => e.mapping?.kind === 'wonder' && e.mapping.index === n - 39)
                           .file;
        return o ? Reports.local.bindings['icon/' + (200 + n)].file
                 : C.entries.find(e => e.mapping?.kind === 'improvement' && e.mapping.index === n)
                       .file;
    }
    if ([ 'caption-close', 'window-border' ].includes(key))
        return o ? 'review/original-local/other-windows/' + key + '.png' : null;
    if (key.startsWith('flask/'))
        return o ? 'review/original-local/other-windows/flask-' + key.split('/')[1] + '.png'
                 : E.file('science');
    if (key.startsWith('economy/'))
        return o ? Reports.local.bindings[key].file : E.file(key.split('/')[1]);
    if (key === 'panel-texture' && !o)
        return null;
    const v = (o ? Reports.local.bindings : compat)[key];
    if (!v)
        throw Error('Missing binding ' + key);
    return v.file;
}
function resource(key, o) {
    if (o)
        return Reports.extra
            .bindings[key === 'credits' ? key : (+key >= 200 ? 'mk.dll/' : 'tiles.dll/') + key]
            .file;
    return key === '220'     ? 'sprites/advisors/advisor-00.png'
           : key === '10000' ? 'backgrounds/defeat-ruins-native.png'
           : key === '66'    ? 'backgrounds/research-library-native.png'
                             : 'backgrounds/history-gallery-native.png';
}
const Scroll = require('./native-scroll.cjs');
const bitmapCache = new Map();
async function bitmap(path, w, h, o) {
    const k = [ path, w, h, o ].join('|');
    if (!bitmapCache.has(k))
        bitmapCache.set(k,
                        await C.raw(C.path.join(C.pack, path), w, h, o ? 'nearest' : 'lanczos3'));
    return bitmapCache.get(k);
}
async function glyphs(t, o, id) {
    const list = t.commands.filter(c => c.op === 'city' || c.op === 'unit');
    if (!list.length)
        return [];
    const input = C.fs.readFileSync(C.path.join(C.pack, 'review/fixtures/saved-close.txt'), 'utf8');
    const lines = list.map(c => `GLYPH ${c.op === 'unit' ? 2 : 0} ${c.text} ${c.color} ${c.x} ${
                               c.y} ${Math.round(c.width / 8 - 8)}`);
    const path = C.path.join(C.root, 'build/atlas-review/generated/other',
                             `other-${id}-${o ? 'original' : 'replacement'}.txt`);
    C.write(path, input.trim() + '\n' + lines.join('\n') + '\n');
    const t2 = Reports.run('atlas-engine.exe', [
        'report-glyphs', path,
        ...(o ? [ C.path.join(C.pack, 'review/original-local/anchors.txt') ] : [])
    ]);
    const groups = [];
    for (const c of t2.commands) {
        if (c.asset === 'glyph-start')
            groups.push([]);
        else
            groups.at(-1).push(c);
    }
    return groups;
}
async function render(t, mode, id) {
    const o = mode === 'original', d = mode === 'hd' ? 2 : 1, p = new Painter(t.width, t.height, d);
    p.originalText = o;
    let glyph = 0;
    const groups = await glyphs(t, o, id);
    let clip = [ 0, 0, t.width, t.height ];
    const color = n => n === 0 ? '#000000'
                       : o     ? Reports.local.palette[n & 255]
                               : Reports.palette(n);
    function fill(x, y, w, h, col) {
        const rgba = col.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16));
        rgba.push(255);
        const l = Math.max(0, clip[0], x) * d, tt = Math.max(0, clip[1], y) * d,
              r = Math.min(t.width, clip[2], x + w) * d, b = Math.min(t.height, clip[3], y + h) * d;
        for (let yy = tt; yy < b; yy++)
            for (let xx = l; xx < r; xx++)
                p.dst.data.set(rgba, (yy * p.dst.width + xx) * 4);
    }
    function line(x, y, xx, yy, col) {
        let dx = Math.abs(xx - x), sx = x < xx ? 1 : -1, dy = -Math.abs(yy - y),
            sy = y < yy ? 1 : -1, e = dx + dy;
        for (let n = 0; n < 10000; n++) {
            fill(x, y, 1, 1, col);
            if (x === xx && y === yy)
                break;
            const e2 = e * 2;
            if (e2 >= dy) {
                e += dy;
                x += sx;
            }
            if (e2 <= dx) {
                e += dx;
                y += sy;
            }
        }
    }
    function edge(x, y, w, h, a, b) {
        line(x, y + h - 1, x, y, a);
        line(x, y, x + w - 1, y, a);
        line(x + w - 1, y, x + w - 1, y + h - 1, b);
        line(x + w - 1, y + h - 1, x, y + h - 1, b);
    }
    async function blit(im, x, y, w = im.width, h = im.height, sx = 0, sy = 0) {
        const l = Math.max(0, clip[0] * d, x), top = Math.max(0, clip[1] * d, y),
              r = Math.min(p.dst.width, clip[2] * d, x + w),
              b = Math.min(p.dst.height, clip[3] * d, y + h);
        if (r <= l || b <= top)
            return;
        const part = C.clear(r - l, b - top);
        for (let yy = top; yy < b; yy++)
            im.data.copy(part.data, (yy - top) * part.width * 4,
                         ((yy - y + sy) * im.width + l - x + sx) * 4,
                         ((yy - y + sy) * im.width + r - x + sx) * 4);
        C.blit(p.dst, part, l, top);
    }
    async function text(c, col) {
        await T.draw(p.dst, {...c, clip}, d, col, o);
    }
    function button(c) {
        fill(c.x, c.y, c.width, c.height, o ? '#c0c0c0' : '#8e9984');
        for (let k = 0; k < 2; k++)
            edge(c.x + k, c.y + k, c.width - k * 2 - 2, c.height - k * 2 - 2,
                 o ? '#ffffff' : '#d8caa3', o ? '#808080' : '#53644e');
    }
    for (const c of t.commands) {
        clip = c.clip;
        if (c.op === 'text')
            await text(c, color(c.color));
        else if (c.op === 'wrapped') {
            const font = F.get(c.face, c.fontHeight, c.style);
            let y = c.y, lineText = '';
            for (const word of c.text.split(/\s+/)) {
                const next = lineText ? lineText + ' ' + word : word;
                if (F.width(next, font) > c.width && lineText) {
                    await text({...c, text : lineText, y}, color(c.color));
                    lineText = word;
                    y += font.cellHeight;
                } else
                    lineText = next;
            }
            if (lineText)
                await text({...c, text : lineText, y}, color(c.color));
        } else if (c.op === 'sprite' || c.op === 'image') {
            if (!c.width || !c.height)
                continue;
            if (c.op === 'image' || c.text.startsWith('crop/')) {
                const [key, sx, sy, sw, sh] = c.text.replace('crop/', '').split(',');
                const f = resource(key, o);
                let im = await bitmap(f, undefined, undefined, o);
                if (o) {
                    const w = Math.min(+sw || c.width, im.width - Number(sx)),
                          h = Math.min(+sh || c.height, im.height - Number(sy));
                    if (c.op === 'sprite') {
                        im = {...im, data : Buffer.from(im.data)};
                        for (let j = 0; j < im.data.length; j += 4)
                            if (im.data[j] === 0 && im.data[j + 1] === 255 &&
                                im.data[j + 2] === 255)
                                im.data[j + 3] = 0;
                    }
                    await blit(im, c.x * d, c.y * d, w, h, +sx, +sy);
                } else {
                    if (c.op === 'sprite') {
                        im = await bitmap(f, c.width * d, c.height * d, o);
                        await blit(im, c.x * d, c.y * d);
                    } else {
                        const fullW = key === '10000' ? 640 : 600, fullH = key === '10000' ? 480
                                                                           : key === '66'  ? 384
                                                                                           : 400;
                        im = await bitmap(f, fullW * d, fullH * d, o);
                        await blit(im, c.x * d, c.y * d, Math.min(c.width, fullW - Number(sx)) * d,
                                   Math.min(c.height, fullH - Number(sy)) * d, Number(sx) * d,
                                   Number(sy) * d);
                    }
                }
            } else {
                const f = file(c.text, o);
                if (f)
                    await blit(await bitmap(f, c.width * d, c.height * d, o), c.x * d, c.y * d);
                else {
                    line(c.x + 4, c.y + 4, c.x + c.width - 5, c.y + c.height - 5, '#253a30');
                    line(c.x + c.width - 5, c.y + 4, c.x + 4, c.y + c.height - 5, '#253a30');
                }
            }
        } else if (c.op === 'city' || c.op === 'unit') {
            const b = await MapRender.baseline(
                {width : t.width, height : t.height, commands : groups[glyph++]}, {mode : 'report'},
                o ? Reports.local.bindings : compat, {
                    density : d,
                    native : d === 1,
                    transparent : true,
                    originalText : o,
                    ...(o ? {palette : n => Reports.local.palette[n & 255]} : {})
                });
            await blit(await C.raw(b), 0, 0);
        } else if (c.op === 'tile') {
            const f = file(c.text, o);
            const old = clip;
            clip = [
                Math.max(c.x, clip[0]), Math.max(c.y, clip[1]), Math.min(c.x + c.width, clip[2]),
                Math.min(c.y + c.height, clip[3])
            ];
            if (!f)
                fill(c.x, c.y, c.width, c.height,
                     c.text === 'window-border' ? '#8d9783' : '#b7bea4');
            else {
                const im = await bitmap(f, undefined, undefined, o);
                const tw = im.width, th = im.height;
                const ox = Math.abs(c.x - c.face) % tw, oy = Math.abs(c.y - c.fontHeight) % th;
                const scaled = await bitmap(f, tw * d, th * d, o);
                for (let y = c.y - oy; y < c.y + c.height; y += th)
                    for (let x = c.x - ox; x < c.x + c.width; x += tw)
                        await blit(scaled, x * d, y * d);
            }
            clip = old;
        } else if (c.op === 'fill') {
            fill(c.x, c.y, c.width, c.height, color(c.color));
            if (!o && id === 'high-council' && c.width === 90 && c.height === 122) {
                const i = Math.round((c.x - 8) / 98);
                await blit(
                    await bitmap(`sprites/advisors/advisor-${10 + i}.png`, 90 * d, 122 * d, false),
                    c.x * d, c.y * d);
            }
        } else if (c.op === 'bevel')
            edge(c.x, c.y, c.width, c.height, color(c.color), color(+c.text));
        else if (c.op === 'line')
            line(c.x, c.y, c.width, c.height, color(c.color));
        else if (c.op === 'button') {
            button(c);
            const font = F.get(c.face, c.fontHeight, c.style);
            await text({
                ...c,
                x : c.x + Math.floor((c.width - 2 - F.width(c.text, font)) / 2),
                y : c.y + Math.floor((c.height - 2 - font.cellHeight) / 2)
            },
                       c.color === 128 ? '#808080' : '#000000');
        } else if (c.op === 'scrollbar')
            Scroll.paint(c, fill, o);
        else if (c.op === 'checkbox' || c.op === 'radio') {
            const y = c.y + Math.floor((c.height - 20) / 2);
            if (o) {
                const key = (c.op === 'checkbox' ? 305 : 303) +
                            (c.op === 'checkbox' ? (c.color ? -1 : 0) : (c.color ? -1 : 0));
                await blit(
                    await bitmap('review/original-local/other-windows/control-' + key + '.png', 32,
                                 20, true),
                    c.x, y);
            } else {
                const yy = y + 2;
                fill(c.x + 7, yy, 16, 16, '#e6debe');
                edge(c.x + 7, yy, 16, 16, '#50634b', '#dae3c6');
                if (c.color) {
                    line(c.x + 10, yy + 8, c.x + 14, yy + 12, '#20382d');
                    line(c.x + 14, yy + 12, c.x + 21, yy + 4, '#20382d');
                }
            }
            const f = F.get(c.face, c.fontHeight, c.style),
                  yy = c.y + Math.floor((c.height - f.cellHeight) / 2);
            await text({...c, x : c.x + 37 + 1, y : yy + 1}, color(33));
            await text({...c, x : c.x + 37, y : yy}, color(16));
        } else
            throw Error('Unknown draw ' + c.op);
    }
    return p.finish();
}
async function build() {
    const rows = C.read(C.path.join(C.pack, 'review/other-windows/native-scenes.json'));
    for (const id of ids) {
        const trace = Reports.run('atlas-other.exe', [ id ]);
        // Keep large minimap traces reviewable: one complete draw command per line.
        C.write(C.path.join(C.pack, 'review/traces/other-' + id + '.json'),
                JSON.stringify({width:trace.width,height:trace.height}).slice(0,-1) +
                ',\n"commands":[\n' + trace.commands.map(c=>JSON.stringify(c)).join(',\n') + '\n]}\n');
        const row = rows.find(s => s.id === id);
        row.mode = 'extracted-window';
        row.note =
            'Extracted game C++ rendering, shared by original, native replacement and HD. Enhanced is a separate presentation proposal. See runtime audit for captures and fixture limits.';
        if (id === 'high-council')
            row.note +=
                ' Original council AVIs are absent; source frame has empty media slots. Replacement uses authored still portraits in those slots.';
        for (const variant of ['original', 'current', 'hd']) {
            C.write(C.path.join(C.pack, row[variant]), await render(trace, variant, id));
            row[variant + 'Size'] = [
                trace.width * (variant === 'hd' ? 2 : 1), trace.height * (variant === 'hd' ? 2 : 1)
            ];
        }
        console.log('Extracted ' + id);
    }
    C.json(C.path.join(C.pack, 'review/other-windows/native-scenes.json'), rows);
    C.json(C.path.join(C.pack, 'review/other-window-extraction.json'),
           C.read(C.path.join(C.root, 'build/atlas-review/generated/other/extraction.json')));
    C.json(C.path.join(C.pack, 'review/fixtures/other-windows/native-inputs.json'),
           C.read(C.path.join(C.root, 'build/atlas-review/generated/other/inputs.json')));
    return rows;
}
module.exports = {
    render,
    ids,
    build
};
if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exit(1);
    });
