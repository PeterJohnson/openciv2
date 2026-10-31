// PNG bindings for the extracted renderer. These are explicit review adapters, not runtime loaders.
const C = require('./common.cjs');
const {fs, path, pack, art, sharp, svg, asset, entries, raw, clear, blit, png, fit} = C;
const bank = new Map();
const bindingIndex = {};

async function save(name, bytes, w = 64, h = 32, source = null) {
    bytes = await sharp(bytes).png().toBuffer();
    const file = 'compatibility/' + name + '.png';
    C.write(path.join(pack, file), bytes);
    bindingIndex[name] = {file, nativeWidth : w, nativeHeight : h, source};
    bank.set(name, bytes);
}

function entryFor(kind, index) {
    const e = entries.find(e => e.mapping?.kind === kind && e.mapping.index === index);
    if (!e)
        throw Error(`No ${kind} ${index}`);
    return path.join(pack, e.file);
}

async function bitmap(name, w, h, source, fill = .90) {
    await save(name, await fit(source, w * 8, h * 8, fill), w, h,
               path.relative(pack, source).replaceAll('\\', '/'));
}

async function centered(name, source, fill) {
    const w = 512, h = 256;
    const input = await sharp(source)
                      .trim({threshold : 8})
                      .resize(Math.round(w * fill), Math.round(h * fill), {fit : 'inside'})
                      .png()
                      .toBuffer();
    const p = await raw(input), out = clear(w, h);
    blit(out, p, Math.round((w - p.width) / 2), Math.round((h - p.height) / 2));
    await save(name, await png(out), 64, 32, path.relative(pack, source).replaceAll('\\', '/'));
}

async function variationAssets() {
    const file = path.join(pack, 'authoring/masters/surface-variations.png');
    const meta = await sharp(file).metadata(), records = [];
    for (const [row, name] of ['grassland', 'plains', 'desert', 'ocean'].entries())
        for (let col = 0; col < 4; col++) {
            const left = Math.floor(col * meta.width / 4) + 10, top = Math.floor(row * meta.height / 4) + 10;
            const width = Math.floor((col + 1) * meta.width / 4) - left - 10,
                  height = Math.floor((row + 1) * meta.height / 4) - top - 10;
            const bytes = await sharp(file).extract({left, top, width, height}).png().toBuffer();
            const p = `map/variations/${name}-${col}.png`;
            C.write(path.join(pack, p), bytes);
            records.push({
                id : `map.variations.${name}-${col}`,
                kind : 'map',
                category : 'map / variations',
                file : p,
                width,
                height,
                sha256 : C.sha(bytes),
                source :
                    {master : 'authoring/masters/surface-variations.png', rect : {left, top, width, height}}
            });
            for (const size of [16, 32, 64, 128]) {
                const mip = `map/variations/mips/${name}-${col}-${size}.png`;
                C.write(path.join(pack, mip), await sharp(bytes).resize(size, size).png().toBuffer());
            }
        }
    return records;
}

async function buildBindings(traces) {
    await art.loadMaterials(path.join(pack, 'map'));
    for (let t = 0; t < 11; t++)
        await save(`terrain/${t}`,
                   fs.readFileSync(path.join(pack, 'map/ground', C.terrainNames[t] + '.png')));
    for (let q = 0; q < 4; q++)
        for (let mask = 0; mask < 8; mask++) {
            const vals = [ 0, 0, 0, 0 ];
            vals[q] = (mask & 2) && (mask & 5) ? 1 : 0;
            vals[(q + 1) % 4] = mask & 4 ? 1 : 0;
            vals[(q + 3) % 4] = mask & 1 ? 1 : 0;
            const im = clear(256, 128);
            for (let y = 0; y < 128; y++)
                for (let x = 0; x < 256; x++) {
                    const u = (y + .5) / 128 + (x + .5 - 128) / 256,
                          v = (y + .5) / 128 - (x + .5 - 128) / 256;
                    if (u < 0 || u >= 1 || v < 0 || v >= 1)
                        continue;
                    const rgb = art.surface(u, v, vals.map(land => ({land, material : 'grassland'})), 'sand',
                                            [], 128);
                    im.data.set([...rgb, 255 ], (y * 256 + x) * 4);
                }
            await save(`coast/${q}/${mask}`, await png(im), 32, 16);
        }
    // Ordered stippling retains the legacy quadrant topology with newly authored alpha.
    for (let t = 0; t < 13; t++)
        for (let q = 0; q < 4; q++) {
            const material = C.terrainNames[t] || 'grassland';
            const tile = await raw(path.join(pack, 'map/ground', material + '.png'), 512, 256);
            const im = clear(256, 128), x0 = q < 2 ? 256 : 0, y0 = ((q + 1) & 3) < 2 ? 0 : 128;
            for (let y = 0; y < 128; y++)
                for (let x = 0; x < 256; x++) {
                    const si = ((y + y0) * 512 + x + x0) * 4, di = (y * 256 + x) * 4;
                    im.data.set(tile.data.subarray(si, si + 4), di);
                    if (t === 11)
                        im.data.set([ 12, 22, 23, im.data[di + 3] ], di);
                    const outward = Math.abs((x + x0 - 256) / 256) + Math.abs((y + y0 - 128) / 128);
                    const threshold =
                        [ 0, .5, .75, .25 ][(Math.floor(x / 8) & 1) + 2 * (Math.floor(y / 8) & 1)];
                    if (outward < .60 + threshold * .40)
                        im.data[di + 3] = 0;
                }
            if (t === 12)
                im.data.fill(0); // Authored blank edge: no desert/grass wedge beside ocean.
            await save(`dither/${t}/${q}`, await png(im), 32, 16);
        }
    const roadTex = fs.readFileSync(path.join(pack, 'map/materials/road.png')).toString('base64');
    for (const family of ['road', 'rail'])
        for (let i = 0; i < 9; i++) {
            const mask = i ? 1 << (i % 8) : 0; // Engine arm 1 is NE; authoring bit 0 is N.
            const b = await sharp(Buffer.from(art.infrastructure(family, mask, roadTex, 0, 'all', true)))
                          .png()
                          .toBuffer();
            await save(
                `${family}/${i}`,
                await sharp(b).extract({left : 32, top : 32, width : 512, height : 256}).png().toBuffer());
        }
    for (let i = 0; i < 16; i++) {
        const file = path.join(pack, `map/networks/river/${i.toString(16).padStart(2, '0')}.png`);
        // Resolve the canonical river bank by family/mask, including its authored bank textures.
        const e = entries.find(e => e.family === 'river' && e.mask === i);
        const input = e ? path.join(pack, e.file) : file;
        if (fs.existsSync(input))
            await save(`river/${i}`, await sharp(input)
                                         .extract({left : 32, top : 32, width : 512, height : 256})
                                         .png()
                                         .toBuffer());
        else {
            const water = fs.readFileSync(path.join(pack, 'map/materials/ocean.png')).toString('base64'),
                  sand = fs.readFileSync(path.join(pack, 'map/materials/sand.png')).toString('base64');
            await save(`river/${i}`, await sharp(Buffer.from(art.river(i, water, sand)))
                                         .extract({left : 32, top : 32, width : 512, height : 256})
                                         .png()
                                         .toBuffer());
        }
    }
    for (let q = 0; q < 4; q++) {
        await save(`mouth/${q}`, bank.get(`river/${1 << q}`));
        await save(`fog/${q}`,
                   Buffer.from(svg(256, 128, '<path d="M128 0L256 64L128 128L0 64Z" fill="#0b1516"/>')), 32,
                   16);
    }
    for (const family of ['forest', 'hills', 'mountains'])
        for (let i = 0; i < 16; i++)
            await bitmap(`feature/${family}/${i}`, 64, 32, asset(`features.${family}-${i % 4}`));
    for (const name of ['irrigation', 'farmland', 'mine', 'pollution', 'village', 'fortress', 'airbase'])
        await bitmap(`improvement/${name}`, 64, [ 'fortress', 'airbase' ].includes(name) ? 48 : 32,
                     asset('map-overlays.' + name), name === 'irrigation' || name === 'farmland' ? .96 : .80);
    await save('improvement/airbase-occupied', bank.get('improvement/airbase'), 64, 48);
    await save(
        'improvement/fortified',
        Buffer.from(svg(
            512, 384,
            '<path d="M70 230L256 140L442 230L256 320Z" fill="none" stroke="#a99b78" stroke-width="20"/>')),
        64, 48);
    await save('improvement/disorder',
               Buffer.from(svg(512, 384, '<text x="220" y="210" font-size="120" fill="#e4ad54">!</text>')),
               64, 48);
    for (let n = 0; n < 64; n++) {
        const e = entries.find(e => e.mapping?.kind === 'unit' && e.mapping.index === n) ||
                  entries.find(e => e.id === (n === 62 ? 'units.scout-alt' : 'units.merchant-alt'));
        await bitmap('unit/' + n, 64, 48, path.join(pack, e.file), .88);
    }
    for (let n = 0; n < 48; n++) {
        const e =
            entries.find(e => e.mapping?.kind === 'city' && e.mapping.style === Math.floor(n / 8) &&
                              e.mapping.size === Math.floor((n % 8) / 2) && e.mapping.walled === !!(n % 2));
        await bitmap('city/' + n, 64, 48, path.join(pack, e.file), .92);
    }
    for (let n = 0; n < 22; n++) {
        // Source array is terrain*2+special-1; catalog slots are terrain+11*(special-1).
        const slot = Math.floor(n / 2) + 11 * (n % 2),
              e = entries.find(e => e.mapping?.terrainSpecialSlots?.includes(slot));
        await centered('resource/' + n, path.join(pack, e.file), n >= 20 ? .72 : .58);
    }
    await centered('resource/shield', asset('economy.production'), .45);
    await save('fog/full',
               Buffer.from(svg(512, 256, '<path d="M256 0L512 128L256 256L0 128Z" fill="#0b1516"/>')));
    for (const name of ['grid', 'grid/radius'])
        await save(
            name,
            Buffer.from(svg(
                512, 256,
                '<path d="M256 0L512 128L256 256L0 128Z" fill="none" stroke="#47504a" stroke-width="2"/>')));
    await save(
        'shield',
        Buffer.from(svg(
            96, 160,
            '<path d="M4 4H92V106L48 156L4 106Z" fill="#010607" stroke="#17201d" stroke-width="8"/><path d="M12 8H28V105L48 140L20 119L12 109Z" fill="#010506"/><path d="M8 8V104L48 150L88 104V8" fill="none" stroke="#eadfc2" stroke-width="3"/>')),
        12, 20);
    for (let i = 0; i < 8; i++)
        await save(
            'flag/' + i,
            Buffer.from(svg(64, 128,
                            '<path d="M8 128V6H60V48H8" fill="#bca46c" stroke="#1e2927" stroke-width="6"/>')),
            8, 16);
    for (const trace of traces)
        if (trace.mode === 'city')
            for (const c of trace.commands) {
                if (bank.has(c.asset))
                    continue;
                const [family, id, variant] = c.asset.split('/');
                if (family === 'building' || family === 'wonder')
                    await bitmap(c.asset, c.width, c.height,
                                 entryFor(family === 'building' ? 'improvement' : 'wonder', +id), .96);
                else if (family === 'house')
                    await bitmap(c.asset, c.width, c.height, asset(`city-details.industrial-${variant}`),
                                 .88);
                else if (family === 'lot')
                    await save(
                        c.asset,
                        Buffer.from(
                            svg(c.width * 8, c.height * 8,
                                `<ellipse cx="${c.width * 4}" cy="${c.height * 7}" rx="${
                                    c.width * 2.6}" ry="${c.height * .45}" fill="#67764f" opacity=".22"/>`)),
                        c.width, c.height);
                else
                    throw Error('City binding ' + c.asset);
            }
    // Legacy throne slots impose very different rectangles. Fit the selected new pieces into
    // those exact boxes; the paired proposal shows the recommended explicit-anchor layout.
    const palaceFamilies =
        [ 'arch', 'rug', 'dais', 'columns', 'tapestry', 'brazier', 'throne', 'ceiling-medallion' ];
    for (const trace of traces)
        if (trace.mode === 'throne')
            for (const c of trace.commands) {
                if (bank.has(c.asset))
                    continue;
                const id = +c.asset.split('/')[1];
                let file;
                let slot = -1;
                if (id >= 160)
                    file = asset('palace.bonus-' + (id - 160));
                else {
                    slot = Math.floor((id - 105) / 5);
                    const level = (id - 105) % 5 + 1;
                    file = asset(`palace.${palaceFamilies[slot]}-${level}`);
                }
                const scale = 4, im = clear(c.width * scale, c.height * scale);
                const add = async (cx, base, w, h) => {
                    w = Math.min(w, c.width);
                    h = Math.min(h, c.height);
                    const p = await raw(await fit(file, Math.round(w * scale), Math.round(h * scale), .96));
                    const x = Math.max(0, Math.min(im.width - p.width, (cx - c.x) * scale - p.width / 2)),
                          y = Math.max(0, Math.min(im.height - p.height, (base - c.y) * scale - p.height));
                    blit(im, p, x, y);
                };
                if (slot === 0)
                    await add(320, 315, 250, 290);
                else if (slot === 1)
                    await add(320, 460, 370, 170);
                else if (slot === 2)
                    await add(310, 350, 210, 45);
                else if (slot === 3) {
                    await add(125, 298, 115, 245);
                    await add(515, 298, 115, 245);
                } else if (slot === 4)
                    await add(302, 260, 120, 195);
                else if (slot === 5) {
                    await add(180, 313, 65, 100);
                    await add(460, 313, 65, 100);
                } else if (slot === 6)
                    await add(302, 304, 100, 140);
                else if (slot === 7)
                    await add(320, 70, 90, 65);
                else {
                    const i = id - 160;
                    await add(i % 2 ? c.x + c.width * .8 : c.x + c.width * .2, c.y + c.height,
                              Math.min(70, c.width * .28), Math.min(65, c.height));
                }
                await save(c.asset, await png(im), c.width, c.height,
                           path.relative(pack, file).replaceAll('\\', '/'));
            }
    C.json(path.join(pack, 'compatibility/bindings.json'), {
        schemaVersion : 1,
        description : 'Review PNG adapter. Native boxes, new alpha pixels; not a production loader.',
        directionOrder : [ 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N' ],
        unitShieldAnchor : [ 48, 4 ],
        cityFlagAnchor : [ 48, 4 ],
        citySizeBoxAnchor : [ 27, 36 ],
        bindings : bindingIndex
    });
    return bindingIndex;
}

module.exports = {
    variationAssets,
    buildBindings
};
