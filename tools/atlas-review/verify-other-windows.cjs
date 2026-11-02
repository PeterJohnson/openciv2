const assert = require('node:assert/strict'), {spawnSync} = require('node:child_process');
const C = require('./common.cjs'), Reports = require('./report-render.cjs');

async function main() {
    const scenes = C.read(C.path.join(C.pack, 'review/other-windows/scenes.json'));
    assert.equal(scenes.length, 35);
    assert.equal(new Set(scenes.map(s => s.id)).size, 35);
    const fixture = C.path.join(C.pack, 'review/fixtures/other-windows/reports.txt');
    const checks = [], images = [];
    for (const s of scenes) {
        for (const variant of ['original', 'current', 'hd', 'proposed']) {
            const bytes = C.fs.readFileSync(C.path.join(C.pack, s[variant])),
                  meta = await C.sharp(bytes).metadata();
            assert.deepEqual([ meta.width, meta.height ], s[variant + 'Size']);
            assert(!s[variant].includes('original-local'));
            if (variant === 'original')
                assert(s[variant].startsWith('review/original-scenes/'));
            images.push({
                scene : s.id,
                variant,
                file : s[variant],
                width : meta.width,
                height : meta.height,
                sha256 : C.sha(bytes)
            });
        }
        assert.deepEqual(s.hdSize, s.currentSize.map(v => v * 2));
        assert.deepEqual(s.originalSize, s.currentSize);
        if (s.mode === 'report') {
            const mode = s.id.replace('report-', '');
            process.env.ATLAS_CONFIG = 'Release';
            const release = Reports.run('atlas-reports.exe', [ mode, fixture ]);
            process.env.ATLAS_CONFIG = 'Debug';
            const debug = Reports.run('atlas-reports.exe', [ mode, fixture ]);
            assert.deepEqual(debug, release, mode + ' D/R');
            assert.deepEqual(release, C.read(C.path.join(C.pack, 'review/traces/other-' + mode + '.json')));
            const buttons = release.commands.filter(c => c.asset === 'button');
            assert.equal(buttons.length,
                         [ 'science', 'trade', 'defense', 'losses', 'intelligence' ].includes(mode) ? 2 : 1);
            assert(release.commands.some(c => c.asset === 'text' && c.text.trim()));
            checks.push({
                mode,
                commands : release.commands.length,
                debugReleaseEqual : true,
                buttons : buttons.map(c => c.text)
            });
            for (const variant of ['original', 'replacement']) {
                const file =
                    C.path.join(C.root, 'build/atlas-review/generated', `report-${s.id}-${variant}.txt`);
                if (!C.fs.existsSync(file))
                    continue;
                const args = [
                    'report-glyphs', file,
                    ...(variant === 'original' ? [ C.path.join(C.pack, 'review/original-local/anchors.txt') ]
                                               : [])
                ];
                process.env.ATLAS_CONFIG = 'Release';
                const a = Reports.run('atlas-engine.exe', args);
                process.env.ATLAS_CONFIG = 'Debug';
                const b = Reports.run('atlas-engine.exe', args);
                assert.deepEqual(a, b);
            }
        }
    }
    delete process.env.ATLAS_CONFIG;
    for (const file of ['review/report-extraction.json', 'review/other-windows/source-adapters.json']) {
        const meta = C.read(C.path.join(C.pack, file));
        for (const [path, sha] of Object.entries(meta.sourceHashes))
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.root, path))), sha, path);
    }
    assert.equal(C.read(C.path.join(C.pack, 'review/report-extraction.json')).functions.length, 32);
    const bad = spawnSync(C.path.join(C.root, 'build/atlas-review/Release/atlas-reports.exe'),
                          [ 'not-a-report', fixture ], {encoding : 'utf8'});
    assert.notEqual(bad.status, 0);
    const spec = C.read(C.path.join(C.pack, 'review/fixtures/other-windows/static-layouts.json'));
    for (const s of spec) {
        const row = scenes.find(row => row.id === s.id);
        const native = await C.raw(C.path.join(C.pack, row.original));
        for (const c of s.commands.filter(c => c.op === 'button')) {
            assert([ c.x, c.y, c.width, c.height ].every(Number.isInteger),
                   'Native controls must use whole pixels');
            for (let y = c.y + 3; y < c.y + c.height - 3; y++)
                for (let x = c.x + 3; x < c.x + c.width - 3; x++) {
                    const i = (y * native.width + x) * 4;
                    assert(native.data[i] === native.data[i + 1] && native.data[i] === native.data[i + 2],
                           s.id + ' colored native button fringe');
                }
        }
        assert(s.commands.some(c => c.op === 'text' && c.text));
        for (const c of s.commands) {
            if ([ 'image', 'button', 'checkbox', 'slider', 'world' ].includes(c.op)) {
                assert(c.x >= 0 && c.y >= 0 && c.x + c.width <= s.width && c.y + c.height <= s.height,
                       `${s.id}/${c.op} out of bounds`);
            }
            if (c.op === 'image') {
                assert(C.fs.existsSync(C.path.join(C.pack, c.binding.new)), s.id);
                assert(c.binding.old || s.id === 'high-council', 'Undeclared missing original media');
                assert(!c.binding.new.includes('original-local'));
            }
        }
    }
    const sourceDiff =
        spawnSync('git', [ 'diff', '--name-only', 'HEAD', '--', 'src' ], {cwd : C.root, encoding : 'utf8'});
    assert.equal(sourceDiff.status, 0);
    assert.equal(sourceDiff.stdout.trim(), '', 'Game source must remain unchanged');
    const tracked = spawnSync('git', [ 'ls-files', 'assets/atlas-hd/review/original-local' ],
                              {cwd : C.root, encoding : 'utf8'});
    assert.equal(tracked.stdout.trim(), '', 'Original input sheets must stay local');
    C.json(C.path.join(C.pack, 'review/other-windows/validation.json'), {
        scenes : 35,
        images : 140,
        reportBodies : 32,
        sourceUnchanged : true,
        debugRelease : checks,
        sourceHashesMatch : true,
        nativeHdSharedLayout : true,
        nativeButtonsUseWholePixelsAndGrayscaleText : true,
        originalMediaBoundary :
            'Council AVI portraits absent; explicitly empty original slots. Static adapters have not been qualified against runtime captures.',
        outputs : images
    });
    console.log(
        'Additional windows: 35 scenes / 140 images; report and sprite D/R traces match; source unchanged.');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
