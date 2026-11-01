const C = require('./common.cjs'), W = require('./windows.cjs'), Native = require('./native-windows.cjs');
const Checks = require('./native-background-checks.cjs'), BG = require('./native-backgrounds.cjs');
const assert = require('node:assert/strict');
const luminance = rgb => rgb.map(v => {
                                v /= 255;
                                return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
                            })
                             .reduce((s, v, i) => s + v * [ .2126, .7152, .0722 ][i], 0);
const rgb = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16));

function contrast(im, box, color) {
    const ink = luminance(rgb(color)), values = [];
    for (let y = Math.ceil(box.y) + 2; y < Math.floor(box.y + box.height) - 2; y += 2)
        for (let x = Math.ceil(box.x) + 2; x < Math.floor(box.x + box.width) - 2; x += 2) {
            const i = (y * im.width + x) * 4, bg = luminance([...im.data.subarray(i, i + 3) ]);
            values.push((Math.max(ink, bg) + .05) / (Math.min(ink, bg) + .05));
        }
    assert(values.length);
    return Math.min(...values);
}

async function main() {
    const baseline = C.read(C.path.join(C.pack, 'review/native-background-baseline.json'));
    assert.deepEqual(
        await Checks.capture(), baseline.records,
        'Only the first background draw may change; all foreground pixels and logical rectangles must remain identical');
    const layout = C.read(C.path.join(C.pack, 'interface/native-backgrounds/layout.json'));
    assert.equal(layout.plates.length, 9);
    const assetChecks = [];
    for (const p of layout.plates) {
        const source = C.fs.readFileSync(C.path.join(C.pack, p.vector), 'utf8');
        assert(!/<text\b/.test(source), 'Backgrounds must not bake source labels into artwork');
        const im = await C.raw(C.path.join(C.pack, p.file));
        assert.deepEqual([ im.width, im.height ], p.logicalSize.map(n => n * 4));
        for (let i = 3; i < im.data.length; i += 4)
            assert.equal(im.data[i], 255, 'Full-window background must be opaque');
        for (const input of p.inputs)
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, input.file))), input.sha256);
        assetChecks.push({id : p.id, width : im.width, height : im.height});
    }
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const cityPlate = layout.plates.find(p => p.id === 'city'),
          cityImage = await C.raw(C.path.join(C.pack, cityPlate.file), 636, 421);
    const readability = [];
    for (const s of scenes.filter(s => s.mode === 'city-window')) {
        const trace = W.windowEngine(s.mode, C.path.join(C.pack, s.fixture));
        assert.deepEqual(trace, W.windowEngine(s.mode, C.path.join(C.pack, s.fixture), 'Debug'));
        for (const c of trace.commands.filter(c => c.asset === 'panel'))
            assert(cityPlate.regions.some(r => r.x === c.x && r.y === c.y && r.width === c.width &&
                                               r.height === c.height),
                   'Panel bounds must match source layout_rects');
        const labels =
            trace.commands.filter(c => c.asset === 'native-text' && ![10, 18, 57].includes(c.color));
        let minimum = 100;
        for (const c of labels) {
            const ratio = contrast(cityImage, c, Native.palette(c.color));
            minimum = Math.min(minimum, ratio);
            assert(ratio >= 3, `${s.id}/${c.text}: background contrast ${ratio}`);
        }
        readability.push(
            {scene : s.id, labels : labels.length, minimumBackgroundContrast : +minimum.toFixed(2)});
    }
    // Diplomacy uses three different dark foreground colors over four eras.
    // Every government plate must support the unchanged 58x20 text rectangles.
    for (const government of BG.governments) {
        const im = await C.raw(
            C.path.join(C.pack, `interface/native-backgrounds/diplomacy-${government}.png`), 640, 480);
        let minimum = 100;
        for (const color of [19, 98, 37])
            for (let row = 0; row < 6; row++) {
                const ratio = contrast(im, {x : 530, y : 136 + row * 31, width : 58, height : 20},
                                       Native.palette(color));
                minimum = Math.min(minimum, ratio);
                assert(ratio >= 5, 'Diplomacy label plaque must support all native era colors');
            }
        readability.push(
            {scene : 'diplomacy-' + government, minimumBackgroundContrast : +minimum.toFixed(2)});
    }
    const plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json'));
    for (const s of scenes.filter(s => s.windowEngine))
        for (const stage of ['current', 'hd']) {
            const first = plans[s.id + '-' + stage][0];
            assert(first.file.startsWith('interface/native-backgrounds/'));
            assert.deepEqual([ first.x, first.y, first.width, first.height ], [ 0, 0, ...s.currentSize ]);
            const enhanced = plans[s.id + '-proposed'];
            assert(!enhanced.some(p => p.file.startsWith('interface/native-backgrounds/')),
                   'Enhanced composition must stay independent');
        }
    C.json(C.path.join(C.pack, 'review/native-background-validation.json'), {
        status : 'pass',
        baselineCommit : baseline.baselineCommit,
        identicalForegroundRenders : Object.keys(baseline.records).length,
        assetChecks,
        readability,
        limits :
            'Background contrast sampled beneath fixed source text spans. These checks do not claim live-game parity, arbitrary localization fit, or removal of foreground-on-foreground overlaps.'
    });
    console.log(
        'PASS 10 unchanged foreground renders, 9 background plates, source panel bounds and native-text contrast');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
