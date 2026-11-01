const C = require('./common.cjs');
const assert = require('node:assert/strict');

async function main() {
    for (let q = 0; q < 4; q++)
        for (let mask = 0; mask < 8; mask++) {
            const im = await C.raw(C.path.join(C.pack, `compatibility/coast/${q}/${mask}.png`));
            assert.deepEqual([ im.width, im.height ], [ 256, 128 ]);
        }
    const samples = [];
    for (const [stage, d] of [[ 'current', 1 ], [ 'hd', 2 ]]) {
        const im = await C.raw(C.path.join(C.pack, `review/images/saved-close-${stage}.png`));
        const pixel = (x, y) => [...im.data.subarray(((y * d) * im.width + x * d) * 4,
                                                     ((y * d) * im.width + x * d) * 4 + 3)];
        const tip = pixel(576, 124), inland = pixel(576, 108);
        assert(tip[0] > tip[2] + 35, 'Fuller shoreline cut through the desert tile');
        const water = pixel(576, 144);
        assert(water[2] > water[0] + 20, 'Fuller apron filled the neighboring ocean');
        assert(inland[0] > inland[2] + 35, 'Corner rounding removed the inland desert');
        samples.push({stage, protectedTipRGB : tip, inlandRGB : inland, waterRGB : water});
    }
    const marker = await C.raw(C.path.join(C.pack, 'compatibility/resource/shield.png'));
    let count = 0, left = 512, top = 256, right = 0, bottom = 0, rgb = [ 0, 0, 0 ];
    for (let y = 0; y < marker.height; y++)
        for (let x = 0; x < marker.width; x++) {
            const i = (y * marker.width + x) * 4;
            if (marker.data[i + 3] > 128) {
                count++;
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
                for (let k = 0; k < 3; k++)
                    rgb[k] += marker.data[i + k];
            }
        }
    const mean = rgb.map(c => c / count), width = right - left + 1, height = bottom - top + 1;
    assert(height >= 80 && height <= 90 && width >= 60 && width <= 75,
           'Terrain marker should be about 11 logical pixels tall');
    assert(mean[2] < mean[0] - 20 && mean[2] < mean[1] - 20,
           'Terrain marker should be muted olive/bronze, not blue');
    assert(Math.abs((left + right + 1) / 2 - 256) < 2 && Math.abs((top + bottom + 1) / 2 - 128) < 2,
           'Marker lost tile-center registration');
    const economy = C.fs.readFileSync(C.path.join(C.pack, 'interface/economy/production.png'));
    const entry =
        C.read(C.path.join(C.pack, 'manifest.json')).entries.find(e => e.id === 'economy.production');
    assert.equal(C.sha(economy), entry.sha256, 'City production art changed');
    C.json(C.path.join(C.pack, 'review/map-finishing-validation.json'), {
        status : 'pass',
        coastQuarters : 32,
        coastlineChecks : "coast-audit-validation.json",
        newcastle : samples,
        terrainMarker : {
            opaquePixels : count,
            bounds : [ left, top, width, height ],
            meanRGB : mean.map(Math.round),
            cityProductionSha256 : entry.sha256
        },
        limits :
            'Rendered native/HD Newcastle land apron and terrain-marker checks. Full saved-map coverage, topology, zoom and mouth checks are in coast-audit-validation.json. Source draw commands and logical boxes are unchanged.'
    });
    console.log('PASS 32 coast quarter boxes, protected Newcastle cape and muted centered marker');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
