const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./font.cjs');
const T = require('./typography.cjs'), Native = require('./native-windows.cjs');
const assert = require('node:assert/strict');

async function checkOverlay(file, overlay) {
    const final = await C.raw(C.path.join(C.pack, file)), layer = await C.raw(overlay);
    assert.equal(final.width, layer.width);
    assert.equal(final.height, layer.height);
    let probes = 0;
    for (let i = 0; i < layer.data.length; i += 4)
        if (layer.data[i + 3] >= 250) {
            probes++;
            for (let k = 0; k < 3; k++)
                assert(Math.abs(final.data[i + k] - layer.data[i + k]) <= 6,
                       file + ': missing final text overlay at pixel ' + i / 4);
        }
    assert(probes > 30, file + ': no visible label ink');
    return probes;
}

async function main() {
    const command = {
        asset : 'text',
        text : 'City & Science',
        x : 3,
        y : 1,
        width : 0,
        height : 19,
        face : 1,
        fontHeight : 16,
        style : 1,
        color : 29,
        clip : [ 5, 3, 100, 19 ]
    };
    const trace = {width : 140, height : 28, commands : [ command ]}, scene = {mode : 'font-test'};
    const original =
        await C.raw(await R.baseline(trace, scene, {}, {transparent : true, originalText : true}));
    const reference = C.clear(140, 28);
    F.draw(reference, command, 1, '#fff5d8');
    assert.deepEqual(original.data, reference.data, 'Original uses only reference glyphs');
    const a = await C.raw(await R.baseline(trace, scene, {}, {transparent : true}));
    const b =
        await C.raw(await R.baseline(trace, scene, {}, {transparent : true, density : 2, native : false}));
    let smooth = 0, fresh = 0;
    for (let y = 0; y < b.height; y++)
        for (let x = 0; x < b.width; x++) {
            const alpha = b.data[(y * b.width + x) * 4 + 3];
            if (alpha > 0 && alpha < 255)
                smooth++;
            if (alpha)
                assert(x >= 10 && x < 200 && y >= 6 && y < 38, 'Replacement clip preserved at HD');
            if (alpha !== a.data[(Math.floor(y / 2) * a.width + Math.floor(x / 2)) * 4 + 3])
                fresh++;
        }
    assert(smooth > 100 && fresh > 100, 'HD typography must be freshly rasterized, not bitmap upscaling');
    assert.notDeepEqual(a.data, original.data, 'Replacement and original font modes stay separate');
    const p = {dst : C.clear(140, 28), d : 1, palette : () => '#fff5d8'};
    await Native.text(p, command.text, command.x, command.y,
                      {face : 1, size : 16, style : 1, clip : command.clip});
    assert.deepEqual(p.dst.data, a.data, 'Windows use the same replacement-font path');

    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json')), overlays = [];
    for (const s of scenes.filter(s => s.saveBased && s.mode === 'map')) {
        const layer = await R.mapLabels(s);
        const debug = C.engine('city-labels', C.path.join(C.pack, s.fixture), 'Debug');
        assert.deepEqual(layer.commands, debug.commands, 'Label source trace agrees in D/R');
        const native = C.read(C.path.join(C.pack, `review/traces/${s.id}.json`));
        assert.deepEqual(native.commands.slice(-layer.commands.length), layer.commands,
                         'Enhanced labels preserve source name selection and positions');
        const probes = await checkOverlay(s.proposed, layer.buffer);
        overlays.push({scene : s.id, labels : new Set(layer.commands.map(c => c.text)).size, probes});
    }
    for (const s of scenes.filter(s => s.mode === 'city')) {
        const trace = C.read(C.path.join(C.pack, `review/traces/${s.id}.json`));
        const titles = trace.commands.filter(c => c.asset === 'text'), layer = C.clear(2560, 960);
        assert.equal(titles.length, 2);
        for (const c of titles)
            await T.draw(layer, c, 2, c.color === 10 ? '#101919' : '#f4eee1');
        overlays.push({
            scene : s.id,
            title : titles[1].text,
            probes : await checkOverlay(s.proposed, await C.png(layer))
        });
    }
    C.json(C.path.join(C.pack, 'review/typography-validation.json'), {
        status : 'pass',
        replacementFamily : T.family,
        smoothHdPixels : smooth,
        freshlyRasterizedPixels : fresh,
        originalGlyphsUnchanged : true,
        replacementClipPreserved : true,
        overlays
    });
    console.log(
        'PASS original/replacement font isolation, smooth HD rasterization, clipping and six final label overlays');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
