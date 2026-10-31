const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./fixtures.cjs');
const assert = require('node:assert/strict');
const isField = c => c.asset === 'improvement/irrigation' || c.asset === 'improvement/farmland';

function tileBox(t, s) {
    const tw = s.tileWidth;
    return {
        x : (t.x - s.camera.ox) * tw / 2 - tw / 2,
        y : (t.y - s.camera.oy) * tw / 4 - tw / 4,
        width : tw,
        height : tw / 2
    };
}

async function main() {
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const sourceCases = [];
    for (const [label, se, sw, expected] of [[ 'none', 0, 0, null ], [ 'SE irrigation', 4, 0, 'irrigation' ],
                                             [ 'SW farmland', 0, 12, 'farmland' ],
                                             [ 'mixed neighbors', 4, 12, 'farmland' ]]) {
        const w = F.world(16, 16), camera = {ox : 2, oy : 2, cols : 7, rows : 14, zoom : 0, viewer : -1};
        for (const t of w.tiles)
            t.t = 2;
        F.set(w, 8, 8, {c : 0, f : 2});
        F.set(w, 9, 9, {f : se});
        F.set(w, 7, 9, {f : sw});
        const file = C.path.join(C.root, 'build/atlas-review/field-neighbors.txt');
        C.write(file, F.serialize(w, camera));
        const trace = C.engine('map', file);
        assert.deepEqual(trace, C.engine('map', file, 'Debug'));
        const box = tileBox({x : 8, y : 8}, {tileWidth : 64, camera});
        const fields = trace.commands.filter(c => isField(c) && c.x === box.x && c.y === box.y);
        assert.deepEqual(fields.map(c => c.asset), expected ? [ 'improvement/' + expected ] : [], label);
        sourceCases.push({label, expected});
    }
    for (const s of scenes.filter(s => s.mode === 'map')) {
        const trace = C.engine('map', C.path.join(C.pack, s.fixture));
        assert.deepEqual(trace, C.engine('map', C.path.join(C.pack, s.fixture), 'Debug'));
        assert.deepEqual(R.fieldCommands(trace, s.tileWidth),
                         s.tileWidth >= 64 ? trace.commands.filter(isField) : []);
    }
    // The full-size city silhouettes are unchanged. Verify that broad field art
    // survives underneath every city variant at the 64x32 native reference size.
    const silhouetteVisibility = [];
    for (const family of ['irrigation', 'farmland']) {
        const field = await C.raw(C.path.join(C.pack, `compatibility/improvement/${family}.png`), 64, 32);
        for (let city = 0; city < 48; city++) {
            const sprite = await C.raw(C.path.join(C.pack, `compatibility/city/${city}.png`), 64, 48);
            let visible = 0;
            for (let y = 0; y < 32; y++)
                for (let x = 0; x < 64; x++) {
                    const alpha = field.data[(y * 64 + x) * 4 + 3] / 255;
                    const cover = sprite.data[((y + 16) * 64 + x) * 4 + 3] / 255;
                    if (alpha * (1 - cover) > .5)
                        visible++;
                }
            assert(visible >= 48, `${family} hidden beneath city ${city}`);
            silhouetteVisibility.push({family, city, visibleNativePixels : visible});
        }
    }
    const world = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json'));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    const savedCases = [];
    for (const s of scenes.filter(s => ['saved-close', 'saved-region'].includes(s.id))) {
        const trace = C.engine('map', C.path.join(C.pack, s.fixture));
        const carlisle = world.cities.find(c => c.name === 'Carlisle'),
              gloucester = world.cities.find(c => c.name === 'Gloucester');
        const cb = tileBox(carlisle, s), gb = tileBox(gloucester, s);
        const at = (c, b) => isField(c) && c.x === b.x && c.y === b.y;
        assert.equal(trace.commands.filter(c => at(c, cb)).length, 1);
        assert.equal(trace.commands.filter(c => at(c, gb)).length, 0);
        // Remove only Carlisle's underlying field, retaining neighboring fields,
        // roads, labels, units and cities. Compare actual committed final pixels.
        const without = {...trace, commands : trace.commands.filter(c => !at(c, cb))};
        for (const stage of ['current', 'hd', 'proposed']) {
            const d = stage === 'current' ? 1 : 2;
            const actual = await C.raw(C.path.join(C.pack, s[stage]));
            const control = await C.raw(
                stage === 'proposed'
                    ? await R.proposedMap(world, s, without, bindings)
                    : await R.baseline(without, s, bindings, {density : d, native : stage === 'current'}));
            let visible = 0;
            for (let y = cb.y * d; y < (cb.y + cb.height) * d; y++)
                for (let x = cb.x * d; x < (cb.x + cb.width) * d; x++) {
                    const i = (y * actual.width + x) * 4;
                    const delta =
                        Math.max(...[0, 1, 2].map(k => Math.abs(actual.data[i + k] - control.data[i + k])));
                    if (delta > 20)
                        visible++;
                }
            const fraction = visible / (cb.width * cb.height * d * d);
            assert(fraction > .025, `${s.id}/${stage}: field indistinguishable after scene occlusion`);
            savedCases.push({
                scene : s.id,
                stage,
                visibleFieldPixels : visible,
                fractionOfTile : Math.round(fraction * 1000) / 1000
            });
            console.log(s.id, stage, visible, 'visible field pixels');
        }
    }
    for (const s of scenes.filter(s => s.mode === 'city-window'))
        assert.equal(
            C.engine('resource-terrain', C.path.join(C.pack, s.fixture)).commands.filter(isField).length, 0,
            'City windows need a refresh if field selection changes');
    C.json(C.path.join(C.pack, 'review/field-validation.json'), {
        status : 'pass',
        sourceCases,
        silhouetteVisibility,
        savedCases,
        limits :
            'Static fixtures and isolated city silhouettes; not an arbitrary interactive occlusion guarantee. Enhanced overview widths below 64 logical pixels omit fields.'
    });
    console.log(
        'PASS native neighbor selection, field registration, 96 city/field combinations and final saved-map visibility');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
