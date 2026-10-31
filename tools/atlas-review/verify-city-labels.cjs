const C = require('./common.cjs'), R = require('./render.cjs'), L = require('./city-labels.cjs');
const assert = require('node:assert/strict');

function checkPlan(plan) {
    for (const item of plan.items) {
        const b = item.box;
        assert(b.x >= 2 && b.y >= 2 && b.x + b.width <= plan.width - 2 && b.y + b.height <= plan.height - 2,
               'Label clipped at viewport edge');
        for (const obstacle of plan.obstacles)
            assert(!L.intersects(b, obstacle), 'Label covers unit/stack tag');
    }
    for (let i = 0; i < plan.items.length; i++)
        for (let j = 0; j < i; j++)
            assert(!L.intersects(plan.items[i].box, plan.items[j].box), 'City labels overlap');
}

async function main() {
    const meta = C.read(C.path.join(C.pack, 'map/city-anchors.json'));
    assert.equal(meta.variants.length, 48);
    for (const v of meta.variants) {
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, v.file))), v.sha256,
                     'Re-author anchors after changing city art');
        assert(v.sizeBox[0] >= 0 && v.sizeBox[0] + meta.reservedBox[0] <= 64);
        assert(v.sizeBox[1] >= 0 && v.sizeBox[1] + meta.reservedBox[1] <= 48);
    }
    const sizes = new Set(meta.variants.map(v => v.sizeBox.join(',')));
    assert(sizes.size > 1, 'Per-variant metadata must replace the old universal anchor');
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json')), results = [];
    for (const s of scenes.filter(s => s.mode === 'map')) {
        const file = C.path.join(C.pack, s.fixture), raw = C.engine('city-sizes', file);
        assert.deepEqual(raw, C.engine('city-sizes', file, 'Debug'));
        const trace = C.engine('map', file), split = L.splitCityBadges(trace);
        for (const b of split.badges) {
            const index = +b.city.asset.split('/')[1], anchor = meta.variants[index].sizeBox;
            const scale = n => Math.trunc(n * (trace.zoom + 8) / 8);
            assert.equal(b.commands[0].x, b.city.x + scale(anchor[0]));
            assert.equal(b.commands[0].y, b.city.y + scale(anchor[1]));
            const after = trace.commands.indexOf(b.commands.at(-1));
            for (const c of trace.commands.slice(after + 1).filter(c => s.tileWidth >= 48 &&
                                                                        c.asset === 'shield'))
                assert(!L.intersects(b.commands[0], c, 0),
                       s.id + ': native city size hidden by a later unit shield');
        }
        // Moving overlays must never change selected unit/city sprites or their frames.
        const objects = R.readableBadges(C.engine('objects', file)), body = L.splitCityBadges(objects);
        const sprites = t =>
            t.commands.filter(c => c.asset.startsWith('city/') || c.asset.startsWith('unit/'));
        assert.deepEqual(sprites(objects), sprites(body.trace));
        const labels = await R.mapLabels(s);
        checkPlan(labels.plan);
        const final = await C.raw(C.path.join(C.pack, s.proposed)), overlay = await C.raw(labels.buffer);
        let pixels = 0;
        for (let i = 0; i < overlay.data.length; i += 4)
            if (overlay.data[i + 3] >= 250) {
                pixels++;
                for (let k = 0; k < 3; k++)
                    assert(Math.abs(final.data[i + k] - overlay.data[i + k]) <= 6,
                           s.id + ' label covered in final image');
            }
        const badges = labels.plan.items.filter(i => i.kind === 'city-size');
        if (badges.length)
            assert(pixels > 100, 'Final numeric badges absent');
        results.push({
            scene : s.id,
            nativeBadges : split.badges.length,
            enhancedBadges : badges.length,
            names : labels.plan.items.filter(i => i.kind === 'city-name').length,
            moved : labels.plan.items.filter(i => i.dx || i.dy).length,
            verifiedOverlayPixels : pixels
        });
    }
    // Force a two-digit badge, a three-digit badge, and a name into the same edge
    // region as a unit tag. None may be hidden, truncated, or silently discarded.
    const badge =
        (x, text, w) => [{asset : 'city/0', x : 0, y : 0, width : 64, height : 48, text : ''},
                         {asset : 'frame', x, y : 18, width : w, height : 16, color : 10},
                         {asset : 'rect', x : x + 1, y : 19, width : w - 2, height : 14, color : 200},
                         {asset : 'text', x : x + 2, y : 19, text, face : 1, fontHeight : 11, style : 0}];
    const source = {width : 200, height : 128, commands : [...badge(-8, '12', 21), ...badge(8, '127', 29) ]};
    const names = {
        width : 200,
        height : 128,
        commands : [ {
            asset : 'text',
            text : 'Edge City',
            x : 0,
            y : 26,
            face : 0,
            fontHeight : 12,
            style : 0,
            color : 201
        } ]
    };
    const objects = {commands : [ {asset : 'shield', x : 1, y : 15, width : 20, height : 30} ]};
    const edge = L.layout({tileWidth : 64}, source, names, objects);
    checkPlan(edge);
    assert.equal(edge.items.length, 3);
    assert.deepEqual(edge, L.layout({tileWidth : 64}, source, names, objects), 'Deterministic placement');
    assert.deepEqual(edge.items.filter(i => i.kind === 'city-size').map(i => i.commands.at(-1).text),
                     [ '12', '127' ]);
    assert.throws(
        () =>
            L.layout({tileWidth : 64}, {commands : []},
                     {...names, width : 10, height : 10, commands : names.commands.map(c => ({...c, y : 1}))},
                     objects),
        /No clear city-label position/);
    C.json(C.path.join(C.pack, 'review/city-label-validation.json'), {
        status : 'pass',
        variants : 48,
        distinctAnchors : sizes.size,
        edgeCases : [
            'two/three digits', 'unit collision', 'label collision', 'viewport edge', 'determinism',
            'bounded exhaustion'
        ],
        results
    });
    console.log(
        'PASS per-city anchors, D/R size traces, protected overlay pixels, collision-free labels and edge cases');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
