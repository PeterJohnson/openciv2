const C = require('./common.cjs');
const R = require('./render.cjs');
const P = require('./city-panorama.cjs');
const assert = require('node:assert/strict');

async function visibility(plan) {
    const cover = new Float32Array(plan.width * plan.height), results = [];
    const apply = (im, x, y, measure = false) => {
        let total = 0, visible = 0;
        for (let sy = 0; sy < im.height; sy++)
            for (let sx = 0; sx < im.width; sx++) {
                const dx = x + sx, dy = y + sy;
                if (dx < 0 || dy < 0 || dx >= plan.width || dy >= plan.height)
                    continue;
                const a = im.data[(sy * im.width + sx) * 4 + 3] / 255, j = dy * plan.width + dx;
                if (measure) {
                    total += a;
                    visible += a * (1 - cover[j]);
                }
                cover[j] = a + cover[j] * (1 - a);
            }
        return total ? visible / total : 0;
    };
    for (const o of [...plan.objects].reverse()) {
        const bytes = await C.sharp(C.path.join(C.pack, o.file)).trim({threshold : 8}).png().toBuffer(),
              im = await C.raw(bytes, o.width, o.height), fraction = apply(im, o.x, o.y, true);
        results.push({sourceIndex : o.sourceIndex, asset : o.sourceAsset, visibleFraction : fraction});
        if (o.wall)
            apply(await C.raw(Buffer.from(P.wallSVG(plan.site, 'front'))), 0, 0);
    }
    return results;
}

async function gateJoins(plan, meta) {
    const gate = plan.objects.find(o => o.wall),
          {data, info} = await C.sharp(C.path.join(C.pack, gate.file)).trim({threshold : 8}).png().toBuffer({
              resolveWithObject : true
          }),
          sprite = await C.raw(data, gate.width, gate.height),
          walls = await C.raw(Buffer.from(P.wallSVG(plan.site, 'front'))),
          joins = P.gateAttachments(meta, meta.sites[plan.site]);
    assert.equal(gate.artId, meta.gate.art, 'Enhanced gate artwork');
    assert.equal(meta.gate.aspect, info.height / info.width, 'Port frame matches trimmed artwork');
    assert.equal(joins.left[1], joins.right[1], 'Both towers meet the wall at equal ground height');
    const alpha = (im, x, y) => im.data[(y * im.width + x) * 4 + 3] / 255;
    let checkedPixels = 0;
    for (const [side, [ x, y ]] of Object.entries(joins)) {
        // The curtain end must sit inside opaque masonry, and its contact strip
        // must remain continuous across the join rather than expose background.
        assert(alpha(sprite, x - gate.x, y - 20 - gate.y) > .95, side + ' port inside tower');
        for (let dy = -40; dy <= -12; dy++)
            for (let dx = -8; dx <= 8; dx++) {
                const a = alpha(sprite, x + dx - gate.x, y + dy - gate.y), b = alpha(walls, x + dx, y + dy);
                assert(a + b * (1 - a) > .95, side + ' gate/wall contact must not have a gap');
                checkedPixels++;
            }
    }
    return {ports : joins, checkedPixels};
}

async function main() {
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json')).filter(s => s.mode === 'city'),
          meta = C.read(C.path.join(C.pack, 'city/panorama/layout.json')),
          stored = C.read(C.path.join(C.pack, 'review/city-panorama-plans.json')),
          bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings, results = [];
    const empty = await P.render({commands : []}, scenes[0]);
    assert.equal(empty.plan.walls, false);
    assert.equal(empty.plan.objects.length, 0);
    const plain =
        await C.png(await C.raw(C.path.join(C.pack, 'backgrounds/city-coastal-native.png'), 2560, 960));
    assert.equal(C.sha(empty.buffer), C.sha(plain), 'No walls or buildings without selected content');
    const expectedDefinitions = C.entries.filter(e => ['improvement', 'wonder'].includes(e.mapping?.kind));
    assert.equal(Object.keys(meta.buildings).length, expectedDefinitions.length);
    for (const e of expectedDefinitions)
        assert(meta.buildings[e.id]?.width > 0, e.id);
    for (const s of scenes) {
        const trace = C.engine('city', C.path.join(C.pack, s.fixture)), plan = await P.layout(trace, s);
        assert.deepEqual(plan, stored[s.id], 'Stored layout must match renderer');
        assert.deepEqual(
            plan.objects.map(o => o.sourceIndex).sort((a, b) => a - b),
            trace.commands.map((c, i) => c.asset.startsWith('lot/') || c.asset === 'text' ? -1 : i)
                .filter(i => i >= 0));
        let last = -Infinity;
        for (const o of plan.objects) {
            if (!o.wall) {
                assert(o.baseY >= last, 'Ground-contact painter order');
                last = o.baseY;
            }
            assert(o.x >= 0 && o.y >= 0 && o.x + o.width <= plan.width && o.y + o.height <= plan.height,
                   'Clipped building');
            assert.equal(trace.commands[o.sourceIndex].asset, o.sourceAsset, 'Selected content changed');
        }
        const houseWidths =
                  plan.objects.filter(o => o.family === 'house').map(o => o.width).sort((a, b) => a - b),
              house = houseWidths[Math.floor(houseWidths.length / 2)],
              width = id => plan.objects.find(o => o.sourceAsset === id).width, ratios = {
                  pyramids : width('wonder/0') / house,
                  colosseum : width('building/14') / house,
                  gate : width('building/8') / house
              };
        assert(ratios.pyramids > 4.5 && ratios.colosseum > 3.5 && ratios.gate > 2.2,
               'Landmarks must be substantially larger than housing');
        const shown = await visibility(plan), hidden = shown.filter(o => o.visibleFraction < .75);
        assert.deepEqual(hidden, [], 'A selected building is mostly obscured');
        for (const id of ['wonder/0', 'building/14', 'building/8'])
            assert(shown.find(o => o.asset === id).visibleFraction > .80, id + ' visibility');
        const nativeHashes = {};
        for (const stage of ['current', 'hd']) {
            const b = await R.baseline(trace, s, bindings,
                                       {density : stage === 'current' ? 1 : 2, native : stage === 'current'}),
                  hash = C.sha(b);
            assert.equal(hash, C.sha(C.fs.readFileSync(C.path.join(C.pack, s[stage]))),
                         s.id + ' ' + stage + ' must preserve native layout');
            nativeHashes[stage] = hash;
        }
        results.push({
            scene : s.id,
            sourceSelectedObjects : plan.objects.length,
            relativeWidthRatios : ratios,
            gateJoins : await gateJoins(plan, meta),
            minimumVisibleFraction : Math.min(...shown.map(o => o.visibleFraction)),
            nativeHashes,
            visibility : shown
        });
    }
    C.json(C.path.join(C.pack, 'review/city-panorama-validation.json'),
           {sizeDefinitions : expectedDefinitions.length, emptyScenePreservesBackground : true, results});
    console.log('City panorama checks passed', results.map(r => ({
                                                               scene : r.scene,
                                                               objects : r.sourceSelectedObjects,
                                                               ratios : r.relativeWidthRatios,
                                                               minVisible : r.minimumVisibleFraction
                                                           })));
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
