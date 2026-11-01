const C = require('./common.cjs');
const assert = require('node:assert/strict');

async function main() {
    let corners = 0, connectedWaterPixels = 0;
    for (let q = 0; q < 4; q++)
        for (let mask = 0; mask < 8; mask++) {
            const im = await C.raw(C.path.join(C.pack, `compatibility/coast/${q}/${mask}.png`));
            assert.deepEqual([ im.width, im.height ], [ 256, 128 ], 'Native quarter box changed');
            const water = new Uint8Array(im.width * im.height), outside = new Uint8Array(water.length);
            let capPixels = 0;
            for (let y = 0; y < im.height; y++)
                for (let x = 0; x < im.width; x++) {
                    const i = y * im.width + x, k = i * 4;
                    const u = (y + .5) / 128 + (x + .5 - 128) / 256;
                    const v = (y + .5) / 128 - (x + .5 - 128) / 256;
                    outside[i] = Number(u < 0 || u >= 1 || v < 0 || v >= 1);
                    water[i] = Number(im.data[k + 3] > 128 && im.data[k + 2] > im.data[k] + 4);
                    if (outside[i] && water[i])
                        capPixels++;
                }
            // Every new water patch must connect to existing water inside the
            // quarter, rather than creating an isolated blue hole in land.
            const visited = new Uint8Array(water.length);
            for (let start = 0; start < water.length; start++) {
                if (!water[start] || visited[start])
                    continue;
                const todo = [ start ];
                visited[start] = 1;
                let inner = 0, outer = 0;
                for (let pos = 0; pos < todo.length; pos++) {
                    const i = todo[pos], x = i % im.width, y = Math.floor(i / im.width);
                    if (outside[i])
                        outer++;
                    else
                        inner++;
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx, ny = y + dy;
                            if (nx < 0 || ny < 0 || nx >= im.width || ny >= im.height)
                                continue;
                            const n = ny * im.width + nx;
                            if (water[n] && !visited[n]) {
                                visited[n] = 1;
                                todo.push(n);
                            }
                        }
                }
                if (outer > 4)
                    assert(inner > 0, `Detached coastal water in ${q}/${mask}`);
            }
            if (!mask)
                assert.equal(capPixels, 0, 'Open ocean needs no corner overhang');
            if (capPixels)
                corners++;
            connectedWaterPixels += capPixels;
        }
    assert(corners >= 16, 'Coast overhangs must cover multiple masks and all orientations');
    const samples = [];
    for (const [stage, d] of [[ 'current', 1 ], [ 'hd', 2 ]]) {
        const im = await C.raw(C.path.join(C.pack, `review/images/saved-close-${stage}.png`));
        const pixel = (x, y) => [...im.data.subarray(((y * d) * im.width + x * d) * 4,
                                                     ((y * d) * im.width + x * d) * 4 + 3)];
        const tip = pixel(576, 124), inland = pixel(576, 108);
        assert(tip[2] > tip[0] + 20 && tip[1] > tip[0] + 20, 'Newcastle desert point remains exposed');
        assert(inland[0] > inland[2] + 35, 'Corner rounding removed the inland desert');
        samples.push({stage, roundedTipRGB : tip, inlandRGB : inland});
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
        quartersWithConnectedOverhang : corners,
        connectedWaterPixels,
        newcastle : samples,
        terrainMarker : {
            opaquePixels : count,
            bounds : [ left, top, width, height ],
            meanRGB : mean.map(Math.round),
            cityProductionSha256 : entry.sha256
        },
        limits :
            'Art topology and rendered native/HD Newcastle samples; source draw commands and logical boxes are unchanged. Existing engine checks cover source mask dispatch. Enhanced shoreline geometry remains its separate proposal.'
    });
    console.log(
        'PASS 32 coast quarter boxes, connected water overhangs, Newcastle cape and muted centered marker');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
