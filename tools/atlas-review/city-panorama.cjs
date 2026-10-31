const C = require('./common.cjs');
const metadataFile = C.path.join(C.pack, 'city/panorama/layout.json');
const cache = new Map();

async function artwork(id) {
    if (!cache.has(id)) {
        const file = C.asset(id),
              {data, info} =
                  await C.sharp(file).trim({threshold : 8}).png().toBuffer({resolveWithObject : true});
        cache.set(id, {data, width : info.width, height : info.height, file : C.find(id).file});
    }
    return cache.get(id);
}

async function layout(trace, scene) {
    const meta = C.read(metadataFile), site = meta.sites[scene.site], W = 2560, H = 960;
    const objects = [];
    for (let index = 0; index < trace.commands.length; index++) {
        const c = trace.commands[index];
        if (c.asset.startsWith('lot/'))
            continue;
        const [family, id, variant] = c.asset.split('/'), isHouse = family === 'house',
                           artId =
                               isHouse
                                   ? `city-details.industrial-${variant}`
                                   : C.entries
                                         .find(e => e.mapping?.kind ===
                                                        (family === 'wonder' ? 'wonder' : 'improvement') &&
                                                    e.mapping.index === +id)
                                         ?.id;
        if (!artId)
            throw Error('Missing panorama artwork ' + c.asset);
        const spec = isHouse ? meta.houses[id] : meta.buildings[artId], art = await artwork(artId);
        if (!spec)
            throw Error('Missing relative size for ' + artId);
        objects.push({
            sourceIndex : index,
            sourceAsset : c.asset,
            artId,
            file : art.file,
            units : spec.width,
            family,
            wall : c.asset === 'building/8',
            priority : family === 'wonder' ? 3
                       : isHouse           ? 1
                                           : 2,
            preferredX : (.06 + (c.x + c.width / 2) / 1280 * .87) * W,
            preferredBase : (.21 + (c.y + c.height) / 480 * .70) * H,
            aspect : art.height / art.width
        });
    }
    const gate = objects.find(o => o.wall), gridWidth = 640, cover = new Float32Array(gridWidth * 240),
          masks = new Map();
    const maskFor = async (o, b) => {
        const w = Math.max(1, Math.round(b.width / 4)), h = Math.max(1, Math.round(b.height / 4)),
              key = `${o.artId}/${w}/${h}`;
        if (!masks.has(key))
            masks.set(key, await C.raw((await artwork(o.artId)).data, w, h));
        return masks.get(key);
    };
    const coverage = (im, bx, by, paint = false) => {
        const x = Math.round(bx / 4), y = Math.round(by / 4);
        let total = 0, covered = 0;
        for (let sy = 0; sy < im.height; sy++)
            for (let sx = 0; sx < im.width; sx++) {
                const dx = x + sx, dy = y + sy;
                if (dx < 0 || dy < 0 || dx >= gridWidth || dy >= 240)
                    continue;
                const a = im.data[(sy * im.width + sx) * 4 + 3] / 255, j = dy * gridWidth + dx;
                total += a;
                covered += a * cover[j];
                if (paint)
                    cover[j] = a + cover[j] * (1 - a);
            }
        return total ? covered / total : 0;
    };
    const boxAt = (o, cx, base) => {
        const depth = .76 + .24 * (base / H), width = Math.round(meta.houseWidth * o.units * depth),
              height = Math.round(width * o.aspect);
        return {
            x : Math.round(cx - width / 2),
            y : Math.round(base - height),
            width,
            height,
            centerX : Math.round(cx),
            baseY : Math.round(base),
            depth
        };
    };
    if (gate) {
        Object.assign(gate, boxAt(gate, site.gate[0] * W, site.gate[1] * H));
        coverage(await maskFor(gate, gate), gate.x, gate.y, true);
        coverage(await C.raw(Buffer.from(wallSVG(scene.site, 'front')), 640, 240), 0, 0, true);
    }
    // Reserve landmark space first; source slots remain placement preferences.
    // Actual drawing later uses ground-contact depth, never allocation order.
    for (const o of objects.filter(o => !o.wall)
             .sort((a, b) => b.priority - a.priority || b.units - a.units || a.sourceIndex - b.sourceIndex)) {
        const waterSite = scene.site === 'coastal' &&
                          [ 'building/28', 'building/30', 'building/31', 'building/34', 'wonder/3' ].includes(
                              o.sourceAsset);
        const bounds = waterSite ? site.waterfront : site.land;
        const candidates = [ [ o.preferredX, o.preferredBase ] ];
        for (let y = bounds[1]; y <= bounds[3] + 1e-6; y += .035)
            for (let x = bounds[0]; x <= bounds[2] + 1e-6; x += .024)
                candidates.push([ x * W, y * H ]);
        let best = null;
        for (const [cx, base] of candidates) {
            if (cx < bounds[0] * W || cx > bounds[2] * W || base < bounds[1] * H || base > bounds[3] * H)
                continue;
            const b = boxAt(o, cx, base);
            if (b.x < 30 || b.x + b.width > W - 30 || b.y < 25 || b.baseY > H - 20)
                continue;
            const collisions = Math.max(0, coverage(await maskFor(o, b), b.x, b.y) - .03) ** 2,
                  displacement = ((cx - o.preferredX) / W) ** 2 + ((base - o.preferredBase) / H) ** 2,
                  score = collisions * 40 + displacement;
            if (!best || score < best.score)
                best = {...b, score};
        }
        if (!best)
            throw Error('No panorama placement for ' + o.sourceAsset);
        Object.assign(o, best);
        coverage(await maskFor(o, o), o.x, o.y, true);
    }
    const ordered =
        objects.filter(o => !o.wall)
            .sort((a, b) => a.baseY - b.baseY || a.centerX - b.centerX || a.sourceIndex - b.sourceIndex);
    if (gate)
        ordered.push(gate);
    return {
        width : W,
        height : H,
        site : scene.site,
        policy : meta.version,
        objects : ordered,
        walls : !!gate
    };
}

function wallSVG(siteName, part) {
    const meta = C.read(metadataFile), site = meta.sites[siteName], W = 2560, H = 960,
          points = site.perimeter.map(([ x, y ]) => [x * W, y * H]),
          gate = [ site.gate[0] * W, site.gate[1] * H ],
          gap = meta.houseWidth * meta.buildings['buildings.city-walls'].width * .36;
    const paths =
        part === 'rear' ? [ [ points[0], points[1] ], [ points[1], points[2] ], [ points[2], points[3] ] ] : [
            [ points[0], [ gate[0] - gap, gate[1] - 5 ] ], [ [ gate[0] + gap, gate[1] - 5 ], points[3] ]
        ];
    const stone = C.fs.readFileSync(C.path.join(C.pack, 'map/materials/stone.png')).toString('base64'),
          body = [];
    for (const [a, b] of paths) {
        const height = part === 'rear' ? 58 : 66, dx = b[0] - a[0], dy = b[1] - a[1],
              length = Math.hypot(dx, dy),
              path = `M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${b[0]} ${b[1] - height}L${a[0]} ${a[1] - height}Z`;
        body.push(
            `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="#29372b" stroke-width="16" opacity=".18"/>`,
            `<path d="${path}" fill="url(#stone)" stroke="#75674b" stroke-width="2"/>`,
            `<path d="${path}" fill="#b69a65" opacity=".38"/>`,
            `<path d="M${a[0]} ${a[1] - height}L${b[0]} ${
                b[1] - height}" stroke="#d1bc8b" stroke-width="7"/>`);
        for (let row = 1; row < 4; row++) {
            const z = height * row / 4;
            body.push(`<path d="M${a[0]} ${a[1] - z}L${b[0]} ${
                b[1] - z}" stroke="#786b51" stroke-width="1.2" opacity=".32"/>`);
            const joints = Math.ceil(length / 42);
            for (let j = 0; j < joints; j++) {
                const t = (j + (row % 2 ? .5 : 0)) / joints;
                if (t > 1)
                    continue;
                const x = a[0] + dx * t, y = a[1] + dy * t - z;
                body.push(`<path d="M${x} ${y}V${
                    y - height / 4}" stroke="#786b51" stroke-width="1" opacity=".28"/>`);
            }
        }
        const count = Math.ceil(length / 23);
        for (let i = 0; i < count; i++) {
            const t = i / count, q = (i + .55) / count, x = a[0] + dx * t, y = a[1] + dy * t - height,
                  ex = a[0] + dx * q, ey = a[1] + dy * q - height;
            body.push(`<path d="M${x} ${y}L${ex} ${ey}L${ex} ${ey - 10}L${x} ${
                y - 10}Z" fill="url(#stone)" stroke="#c1a778" stroke-width="2"/>`);
        }
    }
    return C.svg(
        W, H, body.join(''),
        `<pattern id="stone" width="180" height="180" patternUnits="userSpaceOnUse"><image width="180" height="180" href="data:image/png;base64,${
            stone}"/></pattern>`);
}

async function render(trace, scene) {
    const plan = await layout(trace, scene),
          dst = await C.raw(C.path.join(C.pack, `backgrounds/city-${scene.site}-native.png`), plan.width,
                            plan.height);
    const wall = async part => C.blit(dst, await C.raw(Buffer.from(wallSVG(scene.site, part))), 0, 0);
    if (plan.walls)
        await wall('rear');
    for (const o of plan.objects) {
        if (o.wall)
            await wall('front');
        const a = await artwork(o.artId);
        C.blit(dst, await C.raw(a.data, o.width, o.height), o.x, o.y);
    }
    return {buffer : await C.png(dst), plan};
}

async function build() {
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json')),
          manifest = C.read(C.path.join(C.pack, 'manifest.json')), plans = {};
    manifest.entries = manifest.entries.filter(e => !e.id.startsWith('city-panorama.wall-'));
    for (const s of scenes.filter(s => s.mode === 'city')) {
        for (const part of ['rear', 'front']) {
            const source = wallSVG(s.site, part), file = `city/panorama/walls/${s.site}-${part}.png`,
                  vector = file.replace('.png', '.svg'),
                  bytes = await C.sharp(Buffer.from(source)).png().toBuffer();
            C.write(C.path.join(C.pack, file), bytes);
            C.write(C.path.join(C.pack, vector), source);
            manifest.entries.push({
                id : `city-panorama.wall-${s.site}-${part}`,
                file,
                vector,
                width : 2560,
                height : 960,
                kind : 'vector',
                category : 'city / panorama',
                sha256 : C.sha(bytes),
                sourceSha256 : C.sha(Buffer.from(source)),
                source :
                    {generator : 'tools/atlas-review/city-panorama.cjs', material : 'map/materials/stone.png'}
            });
        }
        const result = await render(C.read(C.path.join(C.pack, `review/traces/${s.id}.json`)), s);
        C.write(C.path.join(C.pack, s.proposed), result.buffer);
        plans[s.id] = result.plan;
        if (s.exports4k?.proposed)
            C.write(C.path.join(C.pack, s.exports4k.proposed),
                    await C.sharp(result.buffer)
                        .resize(3840, 2160, {fit : 'contain', background : '#152322'})
                        .png()
                        .toBuffer());
        console.log(s.id, result.plan.objects.length, 'source-selected objects at relative scale');
    }
    C.json(C.path.join(C.pack, 'manifest.json'), manifest);
    C.json(C.path.join(C.pack, 'review/city-panorama-plans.json'), plans);
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    layout,
    render,
    build,
    wallSVG
};
