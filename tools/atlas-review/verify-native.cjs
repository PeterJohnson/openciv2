const C = require('./common.cjs'), F = require('./font.cjs'), W = require('./windows.cjs');
const assert = require('node:assert/strict');

async function main() {
    const font = F.get(0, 11, 0), samples = [
        [ 'III', 12 ], [ 'WWW', 33 ], [ 'NAVIGATION', 75 ], [ 'MEDICINE', 61 ], [ 'ELECTRICITY', 79 ]
    ];
    assert.equal(font.cellHeight, 13);
    for (const [s, w] of samples)
        assert.equal(F.width(s, font), w);
    // Variable-width reference glyphs must obey identical logical clipping at both densities.
    const sample =
        {text : 'Wim 18', x : 2, y : 1, face : 0, fontHeight : 11, style : 0, clip : [ 4, 3, 35, 12 ]};
    const a = C.clear(40, 18), b = C.clear(80, 36);
    F.draw(a, sample, 1, '#ffcc66');
    F.draw(b, sample, 2, '#ffcc66');
    let ink = 0;
    for (let y = 0; y < 18; y++)
        for (let x = 0; x < 40; x++) {
            const pixel = [...a.data.subarray((y * 40 + x) * 4, (y * 40 + x + 1) * 4) ];
            if (pixel[3]) {
                ink++;
                assert(x >= 4 && x < 35 && y >= 3 && y < 12);
            }
            for (let dy = 0; dy < 2; dy++)
                for (let dx = 0; dx < 2; dx++)
                    assert.deepEqual([...b.data.subarray(((y * 2 + dy) * 80 + x * 2 + dx) * 4,
                                                         ((y * 2 + dy) * 80 + x * 2 + dx + 1) * 4) ],
                                     pixel);
        }
    assert(ink > 20);
    const edge = C.path.join(C.root, 'build/atlas-review/native-font-edge.txt');
    C.write(edge, '3 14 2 6\n2\n39 0 2\n12 1 1\n');
    const wrap = W.windowEngine('diplomacy', edge);
    assert.deepEqual(wrap, W.windowEngine('diplomacy', edge, 'Debug'));
    const lines = wrap.commands.filter(c => c.asset === 'native-text');
    assert.equal(lines.length, 8, 'Two source lines, shadow+foreground, for each advance');
    assert(lines.every(c => c.face === 0 && c.fontHeight === 11 && c.style === 0));
    assert(lines.some(c => c.text === 'IRON'));
    assert(lines.some(c => c.text.includes('WORK')));
    const diplo = W.windowEngine('diplomacy', C.path.join(C.pack, 'review/fixtures/diplomacy.txt'));
    assert.equal(diplo.commands.filter(c => c.asset === 'native-text').length, 12);
    assert(diplo.commands.some(c => c.asset === 'native-text' && c.text.endsWith('...')));
    assert(!diplo.commands.some(c => /ASTERIAN|KNOWLEDGE|MILITARY/.test(c.text)));
    const city = W.windowEngine('city-window', C.path.join(C.pack, 'review/fixtures/city-window.txt'));
    assert(city.commands.some(c => c.asset === 'native-fill' && c.y === 75));
    assert(city.commands.some(c => c.asset === 'native-fill' && c.y === 116));
    assert(city.commands.some(c => c.asset === 'native-fill' && c.y === 140));
    assert(city.commands.some(c => c.asset === 'native-fill' && c.y === 181));
    assert(!city.commands.some(c => c.asset === 'adapter-resource-map'));
    const enhanced = W.windowEngine('city-window', C.path.join(C.pack, 'review/fixtures/city-window.txt'),
                                    'Release', true);
    assert(enhanced.commands.some(c => c.asset === 'adapter-resource-map'));
    assert(!enhanced.commands.some(c => c.asset === 'native-text'));
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    for (const s of scenes.filter(s => s.mode === 'map' && s.saveBased)) {
        const t = C.read(C.path.join(C.pack, `review/traces/${s.id}.json`));
        assert(t.commands.some(c => c.asset === 'text' && c.text.length > 2), 'Saved city names emitted');
    }
    const title = C.read(C.path.join(C.pack, 'review/traces/city-coastal.json'))
                      .commands.filter(c => c.asset === 'text');
    assert.equal(title.length, 2);
    assert(title.every(c => c.face === 0 && c.fontHeight === 36 && c.style === 1));
    const result = {
        status : 'pass',
        target :
            'Native indexed font path, default drawing advances; content fixtures, not full runtime pixel parity',
        fontBankSha256 : F.sha256,
        metrics : samples,
        clippedInkPixels : ink,
        originalDensityPixelsCompared : 40 * 18 * 4,
        twoLineKnowledgeDraws : lines.length,
        nativeKnowledgeDraws : 12,
        nativeEconomyBarY : [ 75, 116, 140, 181 ],
        separateEnhancedTrace : true,
        savedCityNameScenes : 3,
        panoramaTitlePasses : 2
    };
    C.json(C.path.join(C.pack, 'review/native-validation.json'), result);
    console.log(
        'PASS native fonts, clipping/density, source label wrapping, economic bars, names, titles and enhanced separation');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
