const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const art = require('./art.cjs');
const {sharp, svg} = art;
const root = path.resolve(__dirname, '../..');
const pack = path.join(root, 'assets/atlas-hd');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, value) => {
    fs.mkdirSync(path.dirname(p), {recursive : true});
    fs.writeFileSync(p, value);
};
const json = (p, value) => write(p, JSON.stringify(value, null, 2) + '\n');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = read(path.join(pack, 'manifest.json'));
const entries = manifest.entries;
const find = id => {
    const e = entries.find(e => e.id === id);
    if (!e)
        throw Error('Missing art ' + id);
    return e;
};
const asset = id => path.join(pack, find(id).file);
const terrainNames = [
    'desert', 'plains', 'grassland', 'forest', 'hills', 'mountains', 'tundra', 'glacier', 'swamp', 'jungle',
    'ocean'
];
const directions = [ [ 1, -1 ], [ 2, 0 ], [ 1, 1 ], [ 0, 2 ], [ -1, 1 ], [ -2, 0 ], [ -1, -1 ], [ 0, -2 ] ];
const gameToArtMask = m => ((m << 1) | (m >>> 7)) & 255;

function engine(mode, file, config = 'Release') {
    const exe = path.join(root, 'build/atlas-review', config, 'atlas-engine.exe');
    const r = spawnSync(exe, [ mode, file ], {encoding : 'utf8', maxBuffer : 64 * 1024 * 1024});
    if (r.error || r.status !== 0)
        throw Error(`${mode}: ${r.error || r.stderr || r.status}`);
    return JSON.parse(r.stdout);
}

const clear = (w, h, color = [ 0, 0, 0, 0 ]) => {
    const b = Buffer.alloc(w * h * 4);
    for (let i = 0; i < b.length; i += 4)
        b.set(color, i);
    return {data : b, width : w, height : h};
};

async function raw(input, w, h, kernel = 'lanczos3') {
    let s = sharp(input);
    if (w && h)
        s = s.resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {fit : 'fill', kernel});
    const {data, info} = await s.ensureAlpha().raw().toBuffer({resolveWithObject : true});
    return {data, width : info.width, height : info.height};
}

function blit(dst, src, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    for (let sy = Math.max(0, -y); sy < Math.min(src.height, dst.height - y); sy++)
        for (let sx = Math.max(0, -x); sx < Math.min(src.width, dst.width - x); sx++) {
            const si = (sy * src.width + sx) * 4, di = ((sy + y) * dst.width + sx + x) * 4,
                  a = src.data[si + 3] / 255;
            if (!a)
                continue;
            const da = dst.data[di + 3] / 255, out = a + da * (1 - a);
            for (let k = 0; k < 3; k++)
                dst.data[di + k] = Math.round((src.data[si + k] * a + dst.data[di + k] * da * (1 - a)) / out);
            dst.data[di + 3] = Math.round(out * 255);
        }
}

const png = im =>
    sharp(im.data, {raw : {width : im.width, height : im.height, channels : 4}}).png().toBuffer();

async function fit(file, w, h, fill = .90) {
    const b =
        await sharp(file)
            .resize(Math.max(1, Math.round(w * fill)), Math.max(1, Math.round(h * fill)), {fit : 'inside'})
            .png()
            .toBuffer();
    const p = await raw(b), out = clear(w, h);
    blit(out, p, (w - p.width) / 2, h - p.height - Math.max(0, Math.round(h * .025)));
    return png(out);
}

module.exports = {
    fs,
    path,
    root,
    pack,
    read,
    write,
    json,
    sha,
    art,
    sharp,
    svg,
    entries,
    find,
    asset,
    terrainNames,
    directions,
    gameToArtMask,
    engine,
    clear,
    raw,
    blit,
    png,
    fit
};
