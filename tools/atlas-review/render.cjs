const C = require('./common.cjs');
const {fs, path, pack, sharp, svg, art, raw, clear, blit, png, asset, fit} = C;
const cache = new Map();
const faction = [ '#e6dfc3', '#d66b57', '#63b194', '#9e87ca', '#6e9ed0', '#d8bd60', '#dc994d', '#b7c7ce' ];
const factionMid = [ '#898779', '#79372f', '#2d6b55', '#51426e', '#34587e', '#7c6b31', '#85532b', '#596f7c' ];
const color = n => n === 261             ? '#010506'
                   : n === 262           ? '#010607'
                   : n >= 200 && n < 208 ? faction[n - 200]
                   : n >= 210 && n < 218 ? factionMid[n - 210]
                                         : ({
                                               10 : '#101919',
                                               15 : '#161e1c',
                                               16 : '#202a27',
                                               29 : '#fff5d8',
                                               42 : '#74be55',
                                               122 : '#d9bc48',
                                               106 : '#d55745'
                                           })[n] ||
                                               '#d6c697';

const hex = c => c.match(/[a-f\d]{2}/gi).map(x => parseInt(x, 16));

async function cached(key, f) {
    if (!cache.has(key))
        cache.set(key, await f());
    return cache.get(key);
}

async function sprite(name, w, h, bindings, native = false) {
    const b = bindings[name];
    if (!b)
        throw Error('Unbound renderer sprite ' + name);
    return cached(`${b.file}:${name}:${w}:${h}:${native}`, async () => {
        let input = path.join(pack, b.file);
        if (native)
            input = await sharp(input).resize(b.nativeWidth, b.nativeHeight, {fit : 'fill'}).png().toBuffer();
        return raw(input, w, h, native ? 'nearest' : 'lanczos3');
    });
}

function rect(dst, c, palette = color) {
    const rgb = hex(palette(c.color));
    for (let y = Math.max(0, c.y); y < Math.min(dst.height, c.y + c.height); y++)
        for (let x = Math.max(0, c.x); x < Math.min(dst.width, c.x + c.width); x++) {
            if (c.asset === 'frame' && x !== c.x && y !== c.y && x !== c.x + c.width - 1 &&
                y !== c.y + c.height - 1)
                continue;
            dst.data.set([...rgb, 255 ], (y * dst.width + x) * 4);
        }
}

async function baseline(
    trace, scene, bindings,
    {density = 1, native = true, transparent = false, palette = color, background = null} = {}) {
    const W = trace.width * density, H = trace.height * density;
    let dst = clear(W, H, transparent ? [ 0, 0, 0, 0 ] : [ 12, 22, 23, 255 ]);
    if (background)
        dst = await raw(background, W, H, 'nearest');
    else if (scene.mode === 'city')
        dst = await raw(path.join(pack, `backgrounds/city-${scene.site}-native.png`), W, H);
    if (!background && scene.mode === 'throne')
        dst = await raw(path.join(pack, 'backgrounds/palace-room-native.png'), W, H);
    let unitBadge = false;
    for (const command of trace.commands) {
        if (command.asset === 'shield')
            unitBadge = true;
        if (/^(unit|city)\//.test(command.asset))
            unitBadge = false;
        const c = {
            ...command,
            x : command.x * density,
            y : command.y * density,
            width : command.width * density,
            height : command.height * density
        };
        if (c.asset === 'clear') {
            dst = clear(W, H, [...hex(palette(c.color)), 255 ]);
            continue;
        }
        if (c.asset === 'replace') {
            const from = hex(palette(+c.text)), to = hex(palette(c.color));
            for (let y = Math.max(0, c.y); y < Math.min(dst.height, c.y + c.height); y++)
                for (let x = Math.max(0, c.x); x < Math.min(dst.width, c.x + c.width); x++) {
                    const i = (y * dst.width + x) * 4;
                    if (from.every((v, k) => v === dst.data[i + k]))
                        for (let k = 0; k < 3; k++)
                            dst.data[i + k] = to[k];
                }
            continue;
        }
        if (c.asset === 'rect' || c.asset === 'frame') {
            rect(dst, c, palette);
            continue;
        }
        if (c.asset === 'text') {
            const h = Math.max(5, c.height), w = Math.max(8, Math.ceil(h * c.text.length));
            const p =
                await raw(Buffer.from(svg(w, h + 3,
                                          `<text x="0" y="${h * .83}" font-family="monospace" font-size="${
                                              h}" fill="${palette(c.color)}">${c.text}</text>`)));
            blit(dst, p, c.x - (unitBadge ? w / 2 : 0), c.y - (unitBadge ? h / 2 : 0));
            continue;
        }
        if (c.width <= 0 || c.height <= 0)
            continue;
        let p = await sprite(c.asset, c.width, c.height, bindings, native);
        if (c.color >= 0) {
            p = {...p, data : Buffer.from(p.data)};
            const rgb = hex(palette(c.color));
            for (let i = 0; i < p.data.length; i += 4)
                for (let k = 0; k < 3; k++)
                    p.data[i + k] = rgb[k];
        }
        blit(dst, p, c.x, c.y);
    }
    return png(dst);
}

function lookup(w) {
    const m = new Map(w.tiles.map(t => [t.x + ',' + t.y, t]));
    return (x, y) => m.get((w.wrap ? (x % w.width + w.width) % w.width : x) + ',' + y);
}

function topology(get, t, viewer = 1) {
    const f = viewer < 1 ? t.f : t.k, hasRail = !!(f & 32) || t.c >= 0;
    let road = 0, rail = 0, count = 0;
    if (!(f & 16) && t.c < 0)
        return {road, rail, roadPresent : false, railPresent : false};
    C.directions.forEach(([ dx, dy ], i) => {
        const n = get(t.x + dx, t.y + dy);
        if (!n || !n.v)
            return;
        const nf = viewer < 1 ? n.f : n.k;
        if (nf & 18) {
            count++;
            if (!hasRail || !(nf & 34))
                road |= 1 << i;
        }
        if (hasRail && (nf & 34))
            rail |= 1 << i;
    });
    return {
        road,
        rail,
        roadPresent : !!road || (!hasRail && !count && t.c < 0),
        railPresent : hasRail && (!!rail || t.c < 0)
    };
}

function riverSegments(w, get) {
    const buckets = new Map();
    for (const t of w.tiles)
        if (t.v && (t.t & 128)) {
            let mask = 0;
            C.directions.forEach(([ dx, dy ], i) => {
                if (i % 2)
                    return;
                const n = get(t.x + dx, t.y + dy);
                if (n?.v && ((n.t & 128) || (n.t & 15) === 10))
                    mask |= 1 << i;
            });
            const U = (t.x + t.y) / 2, V = (t.y - t.x) / 2;
            for (const r of art.curve(C.gameToArtMask(mask))) {
                const points = r.points.map(([ x, y ]) => [U + x / 512 + y / 256, V - x / 512 + y / 256]);
                for (let i = 1; i < points.length; i++) {
                    const segment = {a : points[i - 1], b : points[i], width : .055};
                    for (let y = Math.floor(V) - 1; y <= Math.floor(V) + 1; y++)
                        for (let x = Math.floor(U) - 1; x <= Math.floor(U) + 1; x++) {
                            const key = x + ',' + y;
                            if (!buckets.has(key))
                                buckets.set(key, []);
                            buckets.get(key).push(segment);
                        }
                }
            }
        }
    return buckets;
}

function groundPixel(get, wx, wy, lod = 64, rivers = null) {
    const u = (wx + wy) / 2, v = (wy - wx) / 2, cu = Math.floor(u), cv = Math.floor(v);
    const nearest = get(Math.round(u) - Math.round(v), Math.round(u) + Math.round(v));
    if (!nearest || !nearest.v)
        return [ 12, 22, 23 ];
    const cells = [ [ cu, cv ], [ cu + 1, cv ], [ cu + 1, cv + 1 ], [ cu, cv + 1 ] ].map(
        ([ a, b ]) => get(a - b, a + b));
    const corners = cells.map(t => {
        t = t?.v ? t : nearest;
        return {land : (t.t & 15) === 10 ? 0 : 1, material : C.terrainNames[t.t & 15]};
    });
    return art.surface(u, v, corners, 'sand', rivers?.get(cu + ',' + cv) || [], lod);
}

// Change only status graphics, never the unit/city sprite frame or selection.
// A native stack emits four shields (back/shadow/front/shadow); a single emits two.
function readableBadges(trace) {
    const commands = [];
    let pending = [];
    for (const c of trace.commands) {
        if (c.asset === 'shield' || pending.length) {
            if (!c.asset.startsWith('unit/')) {
                pending.push(c);
                continue;
            }
            const shields = pending.filter(p => p.asset === 'shield'), front = shields.at(-1), scale = 1.35;
            if (!front)
                throw Error('Unit badge group without a shield');
            const stacked = shields.length > 2, back = stacked ? shields[1] : null;
            const rearEnd = stacked ? pending.indexOf(shields.at(-2)) : 0;
            const badge = pending.map((p, i) => {
                let x = front.x + (p.x - front.x) * scale;
                // Widen the visible rear card beyond the native four-pixel offset.
                if (back && i < rearEnd)
                    x += (back.x - front.x) * .5;
                return {
                    ...p,
                    x : Math.round(x),
                    y : Math.round(front.y + (p.y - front.y) * scale),
                    width : Math.round(p.width * scale),
                    height : Math.round(p.height * scale)
                };
            });
            commands.push(c, ...badge);
            if (stacked)
                commands.push({
                    asset : 'text',
                    x : Math.round(front.x + front.width * 1.60),
                    y : Math.round(front.y + front.height * .25),
                    width : 0,
                    height : Math.max(9, Math.round(front.width * .60)),
                    color : 29,
                    text : '+'
                });
            pending = [];
        } else
            commands.push(c);
    }
    commands.push(...pending);
    return {...trace, commands};
}

async function proposedMap(w, scene, trace, bindings, density = 2) {
    const {ox, oy, cols, rows, viewer = 1} = scene.camera, logicalTw = scene.tileWidth,
                                        tw = logicalTw * density, W = cols * tw, H = rows * tw / 4;
    const dst = clear(W, H), get = lookup(w), rivers = riverSegments(w, get),
          lod = Math.max(16, Math.min(256, 2 ** Math.floor(Math.log2(tw / 2))));
    art.setVariations(true);
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
            dst.data.set(
                [...groundPixel(get, 2 * (x + .5) / tw + ox, 4 * (y + .5) / tw + oy, lod, rivers), 255 ],
                (y * W + x) * 4);
    const visible = w.tiles
                        .filter(t => t.v && t.x >= ox - 2 && t.x < ox + cols * 2 + 2 && t.y >= oy - 2 &&
                                     t.y < oy + rows + 2)
                        .sort((a, b) => a.y - b.y || a.x - b.x);
    const pos = t => [(t.x - ox) * tw / 2, (t.y - oy) * tw / 4];
    const draw = async (name, t, width, height, dy = 0) => {
        const [x, y] = pos(t);
        const im = await sprite(name, Math.round(width), Math.round(height), bindings);
        blit(dst, im, x - width / 2, y - height + tw * .18 + dy);
    };
    // Rivers, fields and corridor underlays precede tall objects. Ground is already complete.
    for (const t of visible) {
        const [x, y] = pos(t), f = viewer < 1 ? t.f : t.k;
        if (logicalTw >= 64 && (f & 12) === 4)
            await draw('improvement/irrigation', t, tw * .88, tw * .44);
        if (logicalTw >= 64 && (f & 12) === 12)
            await draw('improvement/farmland', t, tw * .88, tw * .44);
    }
    const roadTex = fs.readFileSync(path.join(pack, 'map/materials/road.png')).toString('base64');
    // Paint every rail bed before any steel so neighboring tiles cannot erase
    // each other's track at boundaries or geometric crossings.
    for (const [family, layer] of [[ 'road', 'all' ], ...((logicalTw < 48) ? [ [ 'rail', 'all' ] ] : [
                                       [ 'rail', 'bed' ], [ 'rail', 'sleepers' ], [ 'rail', 'metal' ]
                                   ])])
        for (const t of visible) {
            const topo = topology(get, t, viewer);
            if (!topo[family + 'Present'])
                continue;
            const mask = C.gameToArtMask(topo[family]), [ x, y ] = pos(t);
            if (logicalTw < 48) {
                const ends = art.ends.filter((_, i) => mask & (1 << i)),
                      body = ends.length ? ends.map(e => `M32 16L${32 + e[0] / 8} ${16 + e[1] / 8}`).join('')
                                         : 'M29 14.5L35 17.5';
                const p = await cached(
                    `lodline:${family}:${mask}:${tw}`,
                    () => raw(Buffer.from(svg(64, 32,
                                              `<path d="${body}" fill="none" stroke="${
                                                  family === 'rail' ? '#bdcbd0' : '#ad7745'}" stroke-width="${
                                                  64 / logicalTw * (family === 'rail' ? 1.4 : 1)}"/>`)),
                              tw, tw / 2));
                blit(dst, p, x - tw / 2, y - tw / 4);
            } else {
                const variant = ((t.x * 13 + t.y * 7) >>> 0) % 4;
                const p = await cached(
                    `network:${family}:${layer}:${mask}:${tw}:${variant}`,
                    () => raw(Buffer.from(art.infrastructure(family, mask, roadTex, variant, layer)),
                              tw * 1.125, tw * .625));
                blit(dst, p, x - tw * .5625, y - tw * .3125);
            }
        }
    for (const t of visible) {
        const [x, y] = pos(t), f = viewer < 1 ? t.f : t.k, terrain = t.t & 15;
        if (logicalTw >= 48 && [ 3, 4, 5, 9 ].includes(terrain)) {
            const family = {3 : 'forest', 4 : 'hills', 5 : 'mountains', 9 : 'jungle'}[terrain],
                  variant = ((t.x * 17 + t.y * 31) >>> 0) % 4;
            const size = tw * (terrain === 5 ? .72 : .58), h = size * .72;
            const p = await cached(`feature:${family}:${variant}:${tw}`,
                                   async () => raw(await fit(asset(`features.${family}-${variant}`),
                                                             Math.round(size), Math.round(h), 1)));
            // Reserve the transport centerline by moving vegetation into the northern half.
            blit(dst, p, x - p.width / 2, y - p.height + (f & 48 ? -tw * .12 : tw * .10));
        }
        if (logicalTw >= 64) {
            if ((f & 12) === 8)
                await draw('improvement/mine', t, tw * .50, tw * .30, -tw * .1);
            if (f & 128)
                await draw('improvement/pollution', t, tw * .60, tw * .30);
            if ((f & 66) === 64)
                await draw('improvement/fortress', t, tw * .60, tw * .45);
            if ((f & 66) === 66)
                await draw('improvement/airbase', t, tw * .75, tw * .56);
            if (terrain === 2 && t.s)
                await draw('resource/shield', t, tw, tw / 2);
            if (t.h)
                await draw('improvement/village', t, tw * .50, tw * .30);
            if (t.r) {
                const p = await sprite('resource/' + (terrain * 2 + t.r - 1), tw, tw / 2, bindings);
                blit(dst, p, x - tw / 2, y - tw / 4);
            }
        }
        if (t.c >= 0 || t.u >= 0) {
            if (logicalTw < 48) {
                const type = t.c >= 0 ? 'city' : 'unit', size = (type === 'city' ? 12 : 9) * density;
                const p = await cached(`icon:${type}:${density}`,
                                       () => raw(path.join(pack, `map/lod/${type}.png`), size, size));
                blit(dst, p, x - p.width / 2, y - p.height / 2);
            }
        }
    }
    if (logicalTw >= 48) {
        const objects = C.engine('objects', path.join(pack, scene.fixture));
        const layer = await baseline(readableBadges(objects), {mode : 'objects'}, bindings,
                                     {density, native : false, transparent : true});
        blit(dst, await raw(layer), 0, 0);
    }

    return png(dst);
}

async function proposedCity(trace, scene, bindings) {
    const factor = 2, W = 2560, H = 960,
          dst = await raw(path.join(pack, `backgrounds/city-${scene.site}-native.png`), W, H);
    for (const c of trace.commands) {
        if (c.asset.startsWith('lot/'))
            continue;
        // Preserve the source-selected building and slot order; map its base into a site art-safe area.
        const cx = (c.x + c.width / 2) / 1280, cy = (c.y + c.height) / 480;
        const px = (.06 + cx * .87) * W, py = (.21 + cy * .70) * H;
        const depth = .68 + cy * .34, w = c.width * factor * .88 * depth, h = c.height * factor * .88 * depth;
        const p = await sprite(c.asset, Math.round(w), Math.round(h), bindings);
        blit(dst, p, px - p.width / 2, py - p.height);
    }
    return png(dst);
}

async function proposedThrone(scene) {
    const W = 1280, H = 960, dst = await raw(path.join(pack, 'backgrounds/palace-room-native.png'), W, H);
    const levels = scene.levels;
    const draw = async (family, l, cx, base, w, h) => {
        const p =
            await raw(await fit(asset(`palace.${family}-${l}`), Math.round(w * W), Math.round(h * H), 1));
        blit(dst, p, cx * W - p.width / 2, base * H - p.height);
    };
    // Explicit scene anchors and back-to-front layers: all furnishings share the same floor.
    await draw('ceiling-medallion', levels[7], .5, .19, .18, .16);
    await draw('arch', levels[0], .5, .69, .70, .57);
    await draw('tapestry', levels[4], .5, .57, .22, .36);
    await draw('columns', levels[3], .22, .77, .21, .55);
    await draw('columns', levels[3], .78, .77, .21, .55);
    await draw('rug', levels[1], .5, .96, .50, .35);
    await draw('dais', levels[2], .5, .84, .44, .27);
    await draw('throne', levels[6], .5, .77, .22, .34);
    await draw('brazier', levels[5], .26, .88, .13, .25);
    await draw('brazier', levels[5], .74, .88, .13, .25);
    if (scene.bonus) {
        for (let i = 0; i < 7; i++)
            if (scene.bonus & (1 << i)) {
                const p = await raw(await fit(asset('palace.bonus-' + i), 128, 120, .90));
                blit(dst, p, 96 + i * 156, 768);
            }
    }
    return png(dst);
}

async function supportingArt() {
    for (
        const [name, body] of Object.entries({
            city :
                '<path d="M8 27V11L13 7L18 11V4H25V27ZM3 27H30M21 12H29V27" fill="#d6bd7d" stroke="#263b38" stroke-width="2"/>',
            unit : '<path d="M7 5H25V20L16 29L7 20Z" fill="#d6bd7d" stroke="#263b38" stroke-width="2"/>',
            mine : '<path d="M5 25L26 5M4 9Q15 0 28 12" fill="none" stroke="#d6bd7d" stroke-width="5"/>'
        })) {
        const source = svg(32, 32, body);
        C.write(path.join(pack, `map/lod/${name}.svg`), source);
        C.write(path.join(pack, `map/lod/${name}.png`), await sharp(Buffer.from(source)).png().toBuffer());
    }
}

module.exports = {
    baseline,
    proposedMap,
    proposedCity,
    proposedThrone,
    supportingArt,
    topology,
    lookup,
    groundPixel,
    riverSegments,
    readableBadges
};
