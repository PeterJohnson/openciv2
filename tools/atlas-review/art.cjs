/** Art-side terrain and infrastructure compositor. No game/runtime dependencies. */
const fs = require('node:fs/promises');
const path = require('node:path');
let sharp;
try {
    sharp = require('sharp');
} catch {
    sharp = require(
        path.join(process.env.ATLAS_NODE_MODULES ||
                      path.join(process.env.USERPROFILE,
                                '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'),
                  'sharp'));
}
const names = [
    'grassland', 'plains', 'desert', 'forest', 'hills', 'mountains', 'tundra', 'glacier', 'swamp', 'jungle',
    'ocean', 'sand', 'stone', 'road', 'city-earth', 'city-paving'
];
const ends = [
    [ 0, -128 ], [ 128, -64 ], [ 256, 0 ], [ 128, 64 ], [ 0, 128 ], [ -128, 64 ], [ -256, 0 ], [ -128, -64 ]
];
const deltas = [ [ -1, -1 ], [ 0, -1 ], [ 1, -1 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ], [ -1, 1 ], [ -1, 0 ] ];
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const fract = x => x - Math.floor(x);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${
    h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
const stroke = (d, color, width, cap = 'round') => `<path d="${d}" fill="none" stroke="${
    color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="${cap}"/>`;
const textures = new Map();
let useVariations = false;
const setVariations = enabled => { useVariations = enabled; };

async function loadMaterials(root) {
    for (const name of names) {
        const bytes = await fs.readFile(path.join(root, 'materials', name + '.png'));
        const {data, info} = await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject : true});
        textures.set(name, {data, width : info.width, height : info.height});
        for (const size of [16, 32, 64, 128, 256]) {
            const mip = await sharp(bytes).resize(size, size).removeAlpha().raw().toBuffer();
            textures.set(name + '@' + size, {data : mip, width : size, height : size});
        }
    }
    for (const name of ['grassland', 'plains', 'desert', 'ocean']) {
        for (let i = 0; i < 4; i++) {
            const file = path.join(root, 'variations', `${name}-${i}.png`);
            try {
                const bytes = await fs.readFile(file);
                for (const size of [16, 32, 64, 128, 256]) {
                    const mip = await sharp(bytes).resize(size, size).removeAlpha().raw().toBuffer();
                    textures.set(`${name}-${i}@${size}`, {data : mip, width : size, height : size});
                }
            } catch (e) {
                if (e.code !== 'ENOENT')
                    throw e;
            }
        }
    }
}

function sample(name, u, v, lod = 256) {
    const t = textures.get(name + '@' + lod);
    if (!t)
        throw Error('Material not loaded: ' + name);
    // Mirrored periodic addressing preserves the actual edge texel at a repeat.
    const reflect = (x, n) => {
        x = ((x % (2 * n)) + 2 * n) % (2 * n);
        return x < n ? x : 2 * n - 1 - x;
    };
    const x = reflect(Math.floor(u * t.width), t.width), y = reflect(Math.floor(v * t.height), t.height),
          i = (y * t.width + x) * 3;
    let result = [ t.data[i], t.data[i + 1], t.data[i + 2] ];
    if (useVariations && lod <= 32) {
        if (!t.average) {
            t.average = [ 0, 0, 0 ];
            for (let j = 0; j < t.data.length; j += 3)
                for (let k = 0; k < 3; k++)
                    t.average[k] += t.data[j + k] / (t.width * t.height);
        }
        result = mix(t.average, result, lod === 16 ? .08 : .35);
    }
    return result;
}

function tex(name, u, v, lod = 256) {
    if (!useVariations || !textures.has(`${name}-0@${lod}`))
        return sample(name, u, v, lod);
    // Blend choices over a world-space 3-tile lattice, never independently per visible tile.
    const x = Math.floor(u / 3), y = Math.floor(v / 3), a = smooth(0, 1, fract(u / 3)),
          b = smooth(0, 1, fract(v / 3));
    const pick = (dx, dy) => sample(`${name}-${Math.floor(hash(x + dx, y + dy) * 4)}`, u, v, lod);
    return mix(mix(pick(0, 0), pick(1, 0), a), mix(pick(0, 1), pick(1, 1), a), b);
}

function distSegment(u, v, a, b) {
    const x = b[0] - a[0], y = b[1] - a[1], l = x * x + y * y,
          t = l ? clamp(((u - a[0]) * x + (v - a[1]) * y) / l) : 0;
    return Math.hypot(u - a[0] - t * x, v - a[1] - t * y);
}

// Smooth world-space noise: fixed world coordinates, independent of camera and zoom.
function noise(u, v) {
    const x = Math.floor(u), y = Math.floor(v), a = smooth(0, 1, fract(u)), b = smooth(0, 1, fract(v));
    return (1 - b) * ((1 - a) * hash(x, y) + a * hash(x + 1, y)) +
           b * ((1 - a) * hash(x, y + 1) + a * hash(x + 1, y + 1));
}

function shoreField(u, v, corners) {
    const a = smooth(0, 1, fract(u)), b = smooth(0, 1, fract(v));
    let land = corners[0].land * (1 - a) * (1 - b) + corners[1].land * a * (1 - b) + corners[2].land * a * b +
               corners[3].land * (1 - a) * b;
    // Broad coves and headlands, then smaller erosion detail. Pure land/water
    // samples stay fixed, retaining tile identity and narrow water passages.
    const perturb = (noise(u * 1.43 + 17, v * 1.43 - 9) - .5) * .31 +
                    (noise(u * 4.1 - 3, v * 4.1 + 23) - .5) * .12 + (noise(u * 11.7, v * 11.7) - .5) * .035;
    return land + perturb * 4 * land * (1 - land);
}

function surface(u, v, corners, shore = 'sand', rivers = [], lod = 256) {
    const fu = fract(u), fv = fract(v),
          weights = [ (1 - fu) * (1 - fv), fu * (1 - fv), fu * fv, (1 - fu) * fv ];
    let a = shoreField(u, v, corners), color = [ 0, 0, 0 ], landWeight = 0;
    // Inland color comes only from land corners: ocean must not tint the beach.
    for (let i = 0; i < 4; i++) {
        if (!corners[i].land)
            continue;
        const c = tex(corners[i].material || 'grassland', u, v, lod), w = weights[i];
        landWeight += w;
        for (let k = 0; k < 3; k++)
            color[k] += c[k] * w;
    }
    if (landWeight)
        color = color.map(c => c / landWeight);
    for (const r of rivers)
        a = Math.min(a, smooth(r.width * .75, r.width * 1.7, distSegment(u, v, r.a, r.b)));
    if (a <= 0)
        return tex('ocean', u, v, lod).map(Math.round);
    if (a >= 1)
        return color.map(Math.round);
    const geology = noise(u * 1.9 + 51, v * 1.9 - 18), detail = noise(u * 13.1, v * 13.1 + 6);
    let water = tex('ocean', u, v, lod);
    water = mix(water, [ 57, 114, 118 ], smooth(.29, .49, a) * .34);
    const beach = tex(shore === 'cliff' ? 'stone' : 'sand', u, v, lod);
    const bank = mix(beach, shore === 'cliff' ? [ 67, 73, 64 ] : [ 114, 112, 75 ],
                     shore === 'cliff' ? .35 : .15 + geology * .30);
    const width = shore === 'cliff' ? .085 : .035 + .075 * geology;
    const land = mix(bank, color, smooth(.515, .515 + width, a));
    let result = mix(water, land, smooth(.493, .508, a));
    const foam = (1 - smooth(.003, .016, Math.abs(a - .491))) * smooth(.35, .70, detail) * .42;
    result = mix(result, [ 206, 221, 204 ], foam);
    return result.map(x => Math.max(0, Math.min(255, Math.round(x))));
}

async function ground(
    {cols, rows, vertices, tileWidth = 512, shore = 'sand', rivers = [], origin = [ 0, 0 ]}) {
    const width = Math.round((cols + rows) * tileWidth / 2),
          height = Math.round((cols + rows) * tileWidth / 4), data = Buffer.alloc(width * height * 4);
    const lod = Math.max(16, Math.min(256, 2 ** Math.floor(Math.log2(tileWidth / 2))));
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const dx = (x + .5 - rows * tileWidth / 2) / tileWidth, dy = 2 * (y + .5) / tileWidth;
            const u = dy + dx, v = dy - dx, cu = Math.floor(u), cv = Math.floor(v);
            if (cu < 0 || cv < 0 || cu >= cols || cv >= rows)
                continue;
            const corners =
                [ vertices[cv][cu], vertices[cv][cu + 1], vertices[cv + 1][cu + 1], vertices[cv + 1][cu] ];
            const c = surface(u + origin[0], v + origin[1], corners, shore, rivers, lod),
                  i = (y * width + x) * 4;
            data[i] = c[0];
            data[i + 1] = c[1];
            data[i + 2] = c[2];
            data[i + 3] = 255;
        }
    return {
        bytes : await sharp(data, {raw : {width, height, channels : 4}}).png().toBuffer(),
        data,
        width,
        height
    };
}

const norm = p => {
    const l = Math.hypot(...p);
    return p.map(v => v / l);
};
const add = (a, b) => a.map((x, i) => x + b[i]);
const mul = (a, s) => a.map(x => x * s);

function curve(mask) {
    const dirs = ends.map((p, i) => mask & (1 << i) ? i : -1).filter(i => i >= 0);
    if (!dirs.length)
        return [ {points : [ [ -42, -21 ], [ 42, 21 ] ], boundary : [ false, false ]} ];
    if (dirs.length === 1) {
        const e = ends[dirs[0]], n = norm(e);
        return [ {points : [ mul(n, -22), add(e, mul(n, 1)) ], boundary : [ false, true ]} ];
    }
    if (dirs.length === 2) {
        const a = ends[dirs[0]], b = ends[dirs[1]], na = norm(a), nb = norm(b), r = 35;
        const pts = [ add(a, mul(na, 1)), mul(na, r) ];
        for (let k = 1; k <= 16; k++) {
            const t = k / 16;
            pts.push(add(mul(na, r * (1 - t) * (1 - t)), mul(nb, r * t * t)));
        }
        pts.push(add(b, mul(nb, 1)));
        return [ {points : pts, boundary : [ true, true ]} ];
    }
    return dirs.map(i => ({
                        points : [ [ 0, 0 ], add(ends[i], mul(norm(ends[i]), 1)) ],
                        boundary : [ false, true ],
                        junction : true
                    }));
}

// Every road arm shares its center and boundary tangents across all masks.
// Reversing an arm gives the matching half of the neighboring tile's road.
function roadCurve(mask, variant = 0) {
    const dirs = ends.map((_, i) => mask & (1 << i) ? i : -1).filter(i => i >= 0);
    const arm = i => {
        const end = ends[i], sign = i < 4 ? 1 : -1, canonical = ends[i % 4], n = norm(canonical),
              normal = [ -n[1], n[0] ];
        const amplitude = 18 + variant * 2;
        return Array.from({length : 25}, (_, k) => {
            const t = k / 24, bend = Math.sin(Math.PI * t) ** 2 *
                                     (.8 + .2 * Math.cos(Math.PI * t + variant)) * amplitude * sign;
            return add(mul(end, t), mul(normal, bend));
        });
    };
    if (!dirs.length)
        return [ {
            points : Array.from({length : 17},
                                (_, k) => {
                                    const t = k / 16;
                                    return [ -42 + 84 * t, -21 + 42 * t + Math.sin(t * Math.PI * 2) * 8 ];
                                }),
            boundary : [ false, false ]
        } ];
    return dirs.map(i => ({points : arm(i), boundary : [ false, true ], junction : dirs.length > 2}));
}

function pathData(p) {
    return p.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(3)} ${q[1].toFixed(3)}`).join('');
}

function length(p) {
    let s = 0;
    for (let i = 1; i < p.length; i++)
        s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return s;
}

function at(p, d) {
    for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= l || i === p.length - 1) {
            const n = norm([ b[0] - a[0], b[1] - a[1] ]);
            return {p : add(a, mul(n, Math.min(l, d))), n};
        }
        d -= l;
    }
}

function offset(p, dist) {
    return p.map((q, i) => {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)],
              n = norm([ b[0] - a[0], b[1] - a[1] ]);
        return [ q[0] - n[1] * dist, q[1] + n[0] * dist ];
    });
}

function infrastructure(family, mask, texture, variant = 0) {
    const
        routes = family === 'road' ? roadCurve(mask, variant) : curve(mask),
        body = [],
        defs =
            `<pattern id="grain" width="128" height="128" patternUnits="userSpaceOnUse"><image width="128" height="128" href="data:image/png;base64,${
                texture}"/></pattern>`;
    const cap = (r, color, width) =>
        r.points
            .filter((_, i) => (i === 0 && !r.boundary[0]) || (i === r.points.length - 1 && !r.boundary[1]))
            .map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${width / 2}" fill="${color}"/>`)
            .join('');
    // Only real dead ends have round caps. A round boundary cap would cover the
    // neighboring tile's rails with ballast when sprites are drawn in sequence.
    for (const [color,
                width] of [[ family === 'road' ? '#6f5134' : '#303c3e', family === 'road' ? 25 : 32 ],
                           [ family === 'road' ? '#a98956' : '#657477', family === 'road' ? 21 : 26 ],
                           [ family === 'road' ? 'url(#grain)' : '#7b8583', family === 'road' ? 15 : 18 ]]) {
        for (const r of routes)
            body.push(stroke(pathData(r.points), color, width, 'butt'), cap(r, color, width));
    }
    if (family === 'rail') {
        for (const r of routes) {
            const total = length(r.points), start = r.junction ? 25 : 9, end = total - 9,
                  count = Math.max(1, Math.round((end - start) / 16));
            for (let i = 0; i <= count; i++) {
                const {p, n} = at(r.points, start + (end - start) * i / count), normal = [ -n[1], n[0] ];
                const a = add(p, mul(normal, -12)), b = add(p, mul(normal, 12));
                body.push(
                    stroke(pathData([ a, b ]), '#342d26', 5.5, 'butt'),
                    stroke(pathData([ add(a, [ -.5, -.5 ]), add(b, [ -.5, -.5 ]) ]), '#a18c6d', 1.6, 'butt'));
            }
        }
        for (const r of routes)
            for (const side of [-1, 1]) {
                const outline = offset(r.points, side * 6), p = outline.map(q => [...q]);
                // Metal extends beyond ballast at shared boundaries so its antialiased
                // end cannot reveal the later sprite's ballast over the earlier rail.
                for (const end of [0, 1])
                    if (r.boundary[end]) {
                        const i = end ? p.length - 1 : 0, j = end ? i - 1 : 1,
                              n = norm([ p[i][0] - p[j][0], p[i][1] - p[j][1] ]);
                        p[i] = add(p[i], mul(n, 2));
                    }
                body.push(stroke(pathData(outline), '#3b4645', 4.5, 'butt'),
                          stroke(pathData(p), '#d3dfd8', 2.8, 'butt'));
            }
    }
    // Padding retains width beyond diamond vertices; consumers must not diamond-clip overlays.
    return svg(576, 320, `<g transform="translate(288 160)">${body.join('')}</g>`, defs);
}

function river(mask, waterTexture, sandTexture) {
    const selected = [ 1, 3, 5, 7 ].filter((_, i) => mask & (1 << i));
    const d = selected.length
                  ? selected.map(i => pathData([ [ 0, 0 ], add(ends[i], mul(norm(ends[i]), 2)) ])).join('')
                  : 'M-26 -13L26 13';
    const defs =
        `<pattern id="water" width="128" height="128" patternUnits="userSpaceOnUse"><image width="128" height="128" href="data:image/png;base64,${
            waterTexture}"/></pattern><pattern id="bank" width="128" height="128" patternUnits="userSpaceOnUse"><image width="128" height="128" href="data:image/png;base64,${
            sandTexture}"/></pattern>`;
    const center =
        selected.length > 1 ? '<circle r="22" fill="url(#bank)"/><circle r="17" fill="url(#water)"/>' : '';
    return svg(576, 320,
               `<g transform="translate(288 160)">${stroke(d, 'url(#bank)', 46, 'butt')}${
                   stroke(d, 'url(#water)', 34, 'butt')}${center}</g>`,
               defs);
}

module.exports = {
    sharp,
    names,
    ends,
    deltas,
    svg,
    stroke,
    loadMaterials,
    ground,
    surface,
    infrastructure,
    river,
    curve,
    roadCurve,
    shoreField,
    length,
    at,
    setVariations
};
