const C = require('./common.cjs'), W = require('./windows.cjs'), Native = require('./native-windows.cjs');
const assert = require('node:assert/strict');

async function foreground(scene, density) {
    const trace = W.windowEngine(scene.mode, C.path.join(C.pack, scene.fixture));

    class ForegroundPainter extends W.Painter {
        async image(file, x, y, w, h, options) {
            if (!this.backgroundSeen) {
                this.backgroundSeen = true;
                assert.deepEqual([ x, y, w, h ], [ 0, 0, this.w, this.h ]);
                this.ops.push({file : '$background', x, y, width : w, height : h});
                return;
            }
            return super.image(file, x, y, w, h, options);
        }
    }

    const p = new ForegroundPainter(trace.width, trace.height, density);
    p.dst = C.clear(trace.width * density, trace.height * density);
    const result = await Native.render(trace, scene, p, null, W.resourceMap);
    return {
        foregroundSHA256 : C.sha(result.buffer),
        logicalDrawPlanSHA256 : C.sha(Buffer.from(JSON.stringify(result.ops)))
    };
}

async function capture() {
    const records = {};
    for (const s of C.read(C.path.join(C.pack, 'review/scenes.json')).filter(s => s.windowEngine))
        for (const d of [1, 2])
            records[s.id + '-' + d] = await foreground(s, d);
    return records;
}

module.exports = {
    foreground,
    capture
};
