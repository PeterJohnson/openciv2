// Repaint existing window fixtures with the selected economy artwork; preserve source layout.
const C = require('./common.cjs'), E = require('./economy.cjs'), W = require('./windows.cjs');
const Native = require('./native-windows.cjs'), Reports = require('./report-render.cjs');
const Other = require('./native-other.cjs'), Enhanced = require('./other-windows.cjs');
const Design = require('./report-design.cjs'), assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const before = '8fd6e21d';
const changedFiles = new Set([ 'science', 'luxury' ].map(E.file));

function prior(file) {
    const r = spawnSync('git', [ 'show', before + ':assets/atlas-hd/' + file ],
                        {cwd : C.root, maxBuffer : 64 * 1024 * 1024});
    assert.equal(r.status, 0, r.stderr.toString());
    return r.stdout;
}

async function main() {
    const changedImages = [];
    const save = (s, mode, bytes) => {
        const file = s[mode], was = C.sha(prior(file)), now = C.sha(bytes);
        C.write(C.path.join(C.pack, file), bytes);
        if (was !== now)
            changedImages.push({scene : s.id, variant : mode, file, beforeSha256 : was, sha256 : now});
        console.log(s.id, mode, was === now ? 'unchanged' : 'updated');
    };
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    const plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json'));
    for (const s of scenes.filter(s => s.mode === 'city-window')) {
        const trace = W.windowEngine(s.mode, C.path.join(C.pack, s.fixture));
        assert.deepEqual(trace, C.read(C.path.join(C.pack, 'review/traces/' + s.id + '.json')));
        for (const mode of ['current', 'hd', 'proposed']) {
            const d = mode === 'current' ? 1 : 2;
            const result =
                mode === 'proposed'
                    ? await W.city(C.read(C.path.join(C.pack, 'review/traces/' + s.id + '-enhanced.json')), s,
                                   true, d)
                    : await Native.render(trace, s, new W.Painter(trace.width, trace.height, d), null,
                                          W.resourceMap);
            assert.deepEqual(result.ops, plans[s.id + '-' + mode],
                             s.id + ' ' + mode + ' unchanged artwork rectangles');
            save(s, mode, result.buffer);
        }
    }
    const otherScenes = C.read(C.path.join(C.pack, 'review/other-windows/scenes.json'));
    const layouts = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/enhanced-layouts.json'));
    for (const s of otherScenes) {
        const report = s.mode === 'report';
        const trace =
            C.read(C.path.join(C.pack, 'review/traces/other-' + (report ? s.id.slice(7) : s.id) + '.json'));
        if (report) {
            const nativeUses = trace.commands.some(c => c.asset === 'sprite' && c.text === '301');
            const enhancedUses =
                nativeUses || Design.knowledgePlan(trace).some(i => changedFiles.has(i.file));
            if (!enhancedUses)
                continue;
            const glyphs = Reports.glyphs(trace, false, s.id);
            for (const mode of ['current', 'hd', 'proposed']) {
                if (mode !== 'proposed' && !nativeUses)
                    continue;
                save(s, mode, await Reports.render(trace, mode, s.id, glyphs));
            }
        } else {
            const nativeUses =
                trace.commands.some(c => c.op === 'sprite' && (/^flask\//.test(c.text) ||
                                                               /^economy\/(science|luxury)$/.test(c.text)));
            if (nativeUses)
                for (const mode of ['current', 'hd'])
                    save(s, mode, await Other.render(trace, mode, s.id));
            const layout = layouts.find(x => x.id === s.id);
            if (layout.commands.some(c => c.op === 'image' && changedFiles.has(c.binding.new)))
                save(s, 'proposed', await Enhanced.render(layout, 'proposed'));
        }
    }
    // The gem is an exact catalog reuse; generated flask alpha is retained.
    assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, E.file('luxury')))),
                 C.sha(C.fs.readFileSync(C.path.join(C.pack, 'sprites/ui/luxury.png'))));
    const provenance = C.read(C.path.join(C.pack, 'authoring/economy-painted.json'));
    for (const item of [...provenance.inputs, ...provenance.outputs]) {
        const bytes = C.fs.readFileSync(C.path.join(C.pack, item.file)),
              meta = await C.sharp(bytes).metadata();
        assert(meta.hasAlpha, item.file + ' transparency');
        Object.assign(item, {width : meta.width, height : meta.height, sha256 : C.sha(bytes)});
    }
    C.json(C.path.join(C.pack, 'authoring/economy-painted.json'), provenance);
    let preserved = 0;
    const originals = C.read(C.path.join(C.pack, 'review/original-scenes/renders.json'));
    for (const s of [...scenes, ...otherScenes]) {
        const file = s.original || originals[s.id]?.original;
        if (!file)
            continue;
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, file))), C.sha(prior(file)), file);
        preserved++;
    }
    C.json(C.path.join(C.pack, 'review/painted-economy-validation.json'), {
        status : 'pass',
        beforeCommit : before,
        originalScenesPreserved : preserved,
        cityDrawPlansUnchanged : 6,
        luxuryMatchesCatalog : true,
        changedImages,
        scope :
            'Economy image substitution only. Existing source traces, icon frames, fonts, layout and game source stay unchanged. Enhanced compositions remain separate.'
    });
    console.log('Painted economy:', changedImages.length, 'updated images;', preserved,
                'originals preserved');
}

if (require.main === module)
    main().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
