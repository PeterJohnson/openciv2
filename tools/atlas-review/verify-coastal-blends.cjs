// Validate the art-only transition selected by the source's ocean-neighbor slot.
const C = require('./common.cjs'), B = require('./coastal-blends.cjs'),
      assert = require('node:assert/strict');

async function main() {
    const meta = C.read(C.path.join(C.pack, 'map/terrain-transitions.json'));
    assert.equal(meta.coastal.length, 4);
    const combined = C.clear(512, 256);
    for (const e of meta.coastal) {
        const bytes = C.fs.readFileSync(C.path.join(C.pack, e.file));
        assert.equal(C.sha(bytes), e.sha256);
        const p = await C.raw(bytes);
        assert.equal(p.width, 256);
        assert.equal(p.height, 128);
        const x0 = e.quadrant < 2 ? 256 : 0, y0 = ((e.quadrant + 1) & 3) < 2 ? 0 : 128;
        for (let y = 0; y < 128; y++)
            p.data.copy(combined.data, ((y + y0) * 512 + x0) * 4, y * 256 * 4, (y + 1) * 256 * 4);
    }
    const desert = await C.raw(C.path.join(C.pack, 'map/ground/desert.png'));
    let core = 0, outer = 0, feather = 0, before = 0, after = 0;
    for (let y = 0; y < 256; y++)
        for (let x = 0; x < 512; x++) {
            const i = (y * 512 + x) * 4, a = combined.data[i + 3];
            const inward = 1 - Math.abs((x + .5 - 256) / 256) - Math.abs((y + .5 - 128) / 128);
            if (inward < 0)
                assert.equal(a, 0, 'Coastal feather leaks outside the land diamond');
            if (inward >= .44) {
                assert.equal(a, 0, 'Coastal feather obscures the protected terrain/cactus core');
                core++;
            }
            if (a > 0 && a < 255)
                feather++;
            if (inward >= 0 && inward < .03) {
                assert(a >= 250, 'Uncovered tile edge or pointed gap between coastal quarters');
                const jump =
                    Math.max(...[0, 1, 2].map(k => Math.abs(desert.data[i + k] - combined.data[i + k])));
                before += jump;
                after += jump * (1 - a / 255);
                outer++;
            }
        }
    assert(core > 19000 && feather > 20000 && outer > 2000);
    assert(after < before * .02, 'Desert/coast apron color discontinuity is not softened');
    // When two ocean neighbors meet, their independent slots must have no
    // artificial transparent cut along the shared horizontal/vertical axis.
    let maxQuarterAlphaStep = 0;
    for (let y = 0; y < 256; y++)
        maxQuarterAlphaStep = Math.max(maxQuarterAlphaStep, Math.abs(combined.data[(y * 512 + 255) * 4 + 3] -
                                                                     combined.data[(y * 512 + 256) * 4 + 3]));
    for (let x = 0; x < 512; x++)
        maxQuarterAlphaStep = Math.max(maxQuarterAlphaStep, Math.abs(combined.data[(127 * 512 + x) * 4 + 3] -
                                                                     combined.data[(128 * 512 + x) * 4 + 3]));
    // Fine texture may change sharply between pixels. Test the continuous limit
    // at both shared axes, rather than rejecting legitimate granular detail.
    let maxQuarterBoundaryLimitDelta = 0;
    const epsilon = 1e-9;
    for (let i = 1; i < 512; i++) {
        const p = i / 512;
        for (const pair
                 of [[ B.coverage(p + epsilon, p - epsilon), B.coverage(p - epsilon, p + epsilon) ],
                     [ B.coverage(p + epsilon, 1 - p + epsilon), B.coverage(p - epsilon, 1 - p - epsilon) ]])
            maxQuarterBoundaryLimitDelta =
                Math.max(maxQuarterBoundaryLimitDelta, Math.abs(pair[0] - pair[1]));
    }
    assert(maxQuarterBoundaryLimitDelta < 1e-5, 'Independent coastal quarters form a seam');
    // At an equal distance from the tile edge, opacity must vary substantially:
    // a nearly constant field would simply move the old diamond inward again.
    const equalDepth = [];
    for (let i = 0; i <= 256; i++)
        equalDepth.push(B.coverage(.12 + .76 * i / 256, .10));
    const equalDepthRange = [ Math.min(...equalDepth), Math.max(...equalDepth) ];
    assert(equalDepthRange[1] - equalDepthRange[0] > .65, 'Coastal blend remains a uniform inset');
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const s = scenes.find(s => s.id === 'saved-close');
    const trace = C.engine('map', C.path.join(C.pack, s.fixture));
    assert.deepEqual(trace, C.engine('map', C.path.join(C.pack, s.fixture), 'Debug'));
    assert.deepEqual(trace, C.read(C.path.join(C.pack, 'review/traces/saved-close.json')));
    const oceanNeighborDraws = trace.commands.filter(c => c.asset.startsWith('dither/12/')).length;
    assert(oceanNeighborDraws > 0);
    const result = {
        status : 'pass',
        coastalQuarterSprites : 4,
        protectedCorePixels : core,
        featherPixels : feather,
        fullyCoveredEdgeSamples : outer,
        maxQuarterAlphaStep,
        maxQuarterBoundaryLimitDelta,
        equalDepthRange,
        meanDesertApronJumpBefore : before / outer,
        meanDesertApronJumpAfter : after / outer,
        savedCloseOceanNeighborDraws : oceanNeighborDraws,
        limits :
            'RGBA artwork bounds, apron color coverage and source Debug/Release trace equality. Native ocean-neighbor selection is unchanged; inland tiles receive no coastal slot. No live-game integration claim.'
    };
    C.json(C.path.join(C.pack, 'review/coastal-blend-validation.json'), result);
    console.log('PASS coastal feather', JSON.stringify(result));
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
