const assert = require('node:assert/strict');
const C = require('./common.cjs');
const R = require('./render.cjs');
const {windowEngine} = require('./windows.cjs');
const E = require('./economy.cjs');

async function main() {
    const results = [];
    const pass = (name, count) => {
        results.push({name, count, status : 'pass'});
        console.log('PASS', name, count ?? '');
    };
    const extraction = C.read(C.path.join(C.pack, 'review/engine-extraction.json'));
    for (const [file, hash] of Object.entries(extraction.sourceHashes))
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.root, file))), hash, file);
    assert.equal(extraction.functions.length, 50);
    pass('Source hashes and 50 unchanged extracted function bodies', 50);
    const windows = C.read(C.path.join(C.pack, 'review/window-extraction.json'));
    assert.equal(windows.functions.length, 30);
    for (const [file, hash] of Object.entries(windows.sourceHashes))
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.root, file))), hash, file);
    pass('Window source hashes and 30 unchanged extracted function bodies', 30);
    const file = C.path.join(C.pack, 'review/fixtures/close.txt'), debug = C.engine('audit', file, 'Debug'),
          release = C.engine('audit', file, 'Release');
    assert.deepEqual(debug, release);
    const groups = [];
    let current;
    for (const c of release.commands) {
        if (c.asset.startsWith('case-')) {
            current = {...c, commands : []};
            groups.push(current);
        } else
            current.commands.push(c);
    }
    for (const g of groups) {
        const a = g.commands.map(c => c.asset);
        if (g.asset === 'case-road') {
            const family = g.y ? 'rail' : 'road', expected = g.x ? Array.from({length : 8}, (_, i) => i)
                                                                       .filter(i => g.x & (1 << i))
                                                                       .map(i => family + '/' + (i + 1))
                                                                 : [ family + '/0' ];
            assert.deepEqual(a, expected);
        } else if (g.asset === 'case-coast') {
            const expected = [];
            for (let q = 0; q < 4; q++) {
                const dirs = [ (q * 2 + 6) % 8, (q * 2 + 7) % 8, q * 2 ];
                let m = 0;
                dirs.forEach((d, i) => {
                    if (g.x & (1 << d))
                        m |= 1 << i;
                });
                expected.push(`coast/${q}/${m}`);
            }
            assert.deepEqual(a, expected);
        } else if (g.asset === 'case-zoom') {
            assert.equal(a.some(x => x.startsWith('road/')), g.x > -4);
            assert.equal(a.includes('improvement/irrigation'), g.x > -4);
            assert.equal(a.some(x => x.startsWith('river/')), g.x > -7);
            const terrain = g.commands.find(c => c.asset === 'terrain/2');
            assert.equal(terrain.width, (g.x + 8) * 8);
            assert.equal(terrain.height, (g.x + 8) * 4);
        } else if (g.asset === 'case-known')
            assert.deepEqual(a, [ g.x === 1 ? 'road/0' : 'road/1' ]);
        else if (g.asset === 'case-city')
            assert.deepEqual(a, [ 'rail/1' ]);
    }
    pass('Debug/Release topology, remembered state, city endpoints and zoom audit', groups.length);
    const scenes = C.read(C.path.join(C.pack, 'review/scenes.json'));
    let traced = 0;
    for (const s of scenes.filter(s => s.fixture)) {
        const f = C.path.join(C.pack, s.fixture), engine = s.windowEngine ? windowEngine : C.engine,
              a = engine(s.mode, f, 'Debug'), b = engine(s.mode, f, 'Release');
        assert.deepEqual(a, b, s.id);
        assert.deepEqual(b, C.read(C.path.join(C.pack, `review/traces/${s.id}.json`)), s.id + ' saved trace');
        if (s.mode === 'map' && !s.saveBased)
            assert(!b.commands.some(c => c.asset === 'unit/0'), 'Empty fixtures must not draw settlers');
        traced++;
    }
    pass('Saved scene traces equal fresh Debug and Release output', traced);
    let objectCount = 0;
    for (const s of scenes.filter(s => s.mode === 'map' && s.tileWidth >= 48)) {
        const f = C.path.join(C.pack, s.fixture), native = C.engine('map', f),
              objects = C.engine('objects', f);
        assert.deepEqual(objects, C.engine('objects', f, 'Debug'), s.id + ' object D/R');
        const core = c => /^(unit|city)\//.test(c.asset) && c.x + c.width > 0 && c.y + c.height > 0 &&
                          c.x < native.width && c.y < native.height;
        assert.deepEqual(objects.commands.filter(core), native.commands.filter(core),
                         s.id + ' unchanged unit/city selection, anchors and dimensions');
        objectCount += objects.commands.filter(core).length;
        C.json(C.path.join(C.pack, `review/traces/${s.id}-objects.json`), objects);
    }
    assert(objectCount > 0);
    pass('Detailed map object commands preserve native sprite size, placement and selection', objectCount);
    const plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json'));
    for (const s of scenes.filter(s => s.windowEngine)) {
        assert.deepEqual(plans[s.id + '-current'], plans[s.id + '-hd'],
                         s.id + ' legacy/HD logical asset rectangles');
        for (const stage of ['current', 'hd', 'proposed'])
            for (const op of plans[s.id + '-' + stage]) {
                assert(C.fs.existsSync(C.path.join(C.pack, op.file)), op.file);
                assert(op.width > 0 && op.height > 0);
            }
    }
    pass('Window HD-only preserves every bound artwork rectangle', scenes.filter(s => s.windowEngine).length);
    for (const s of scenes.filter(s => s.mode === 'city-window')) {
        for (const stage of ['current', 'hd', 'proposed']) {
            const ops = plans[s.id + '-' + stage];
            for (const role of E.roles)
                assert(ops.some(op => op.file === E.file(role)), s.id + stage + role);
            assert(!ops.some(op => /sprites\/resources\/(grassland-shield|gold)\.png/.test(op.file)),
                   'Production and coins must not use mixed grassland or gold-ore sprites');
        }
        const commands = C.read(C.path.join(C.pack, `review/traces/${s.id}.json`)).commands;
        const start = commands.findIndex(c => c.asset === 'native-resource-terrain') + 1;
        const end = commands.findIndex((c, i) => i >= start && c.asset === 'panel');
        const yields = commands.slice(start, end);
        const expected = [ 0, 0, 0 ];
        for (const line of E.yieldFixture.trim().split('\n')) {
            const [worked, ...amount] = line.split(' ').map(Number);
            if (worked)
                amount.forEach((n, i) => expected[i] += n);
        }
        for (let i = 0; i < 3; i++) {
            const commands = yields.filter(c => c.asset === `icon/${11 + i}`);
            assert.equal(commands.length, expected[i], s.id + ' native tile yield multiplicity');
            assert(commands.every(c => c.width === 10 && c.height === 10));
        }
    }
    pass('All six economy roles and exact native 10px worked-tile yield counts', 2);
    const saved = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json'));
    assert.equal(saved.tiles.length, saved.width / 2 * saved.height);
    assert.equal(saved.provenance.year, 1788);
    assert.equal(saved.cities.length, 69);
    assert.equal(saved.units.length, 223);
    assert.equal(saved.provenance.inputRecordCounts.units, 290);
    assert.equal(new Set(saved.tiles.map(t => t.t & 15)).size, 11);
    assert.equal(scenes.filter(s => s.saveBased).length, 3);
    for (const [file, hash] of Object.entries(saved.provenance.sourceHashes))
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.root, file))), hash, file);
    const lookup = R.lookup(saved);
    assert.equal(lookup(-2, 10), lookup(saved.width - 2, 10),
                 'Proposed ground wraps the saved cylindrical world');
    pass(
        'Real-save dimensions, live records, source hashes and all-tile native resource checks in both builds',
        saved.tiles.length);
    const originals = C.read(C.path.join(C.pack, 'review/original-scenes/renders.json'));
    assert.deepEqual(Object.keys(originals).sort(), scenes.map(s => s.id).sort());
    for (const s of scenes) {
        const r = originals[s.id];
        assert.equal(r.original, `review/original-scenes/images/${s.id}.png`);
        const bytes = C.fs.readFileSync(C.path.join(C.pack, r.original)),
              size = await C.sharp(bytes).metadata();
        assert.equal(C.sha(bytes), r.sha256, s.id + ' original render');
        assert.deepEqual([ size.width, size.height ], s.currentSize, s.id + ' original dimensions');
        assert.deepEqual(r.originalSize, s.currentSize);
        if (r.export4k) {
            assert.equal(r.export4k, `review/original-scenes/4k/${s.id}.png`);
            const bytes4k = C.fs.readFileSync(C.path.join(C.pack, r.export4k)),
                  size4k = await C.sharp(bytes4k).metadata();
            assert.equal(C.sha(bytes4k), r.export4kSha256);
            assert.deepEqual([ size4k.width, size4k.height ], [ 3840, 2160 ]);
        }
    }
    pass('Committed original-art scene renders, dimensions and hashes', scenes.length);
    const m = C.read(C.path.join(C.pack, 'manifest.json'));
    assert(!m.entries.some(e => e.file.startsWith('review/original-')),
           'Original renders are not replacement assets');
    for (const e of m.entries) {
        assert(C.fs.existsSync(C.path.join(C.pack, e.file)), e.file);
        if (e.sha256)
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, e.file))), e.sha256, e.id);
        if (e.vector && e.sourceSha256)
            assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, e.vector))), e.sourceSha256,
                         e.id + ' SVG');
        if (e.source?.master)
            assert(C.fs.existsSync(C.path.join(C.pack, e.source.master)), e.source.master);
    }
    pass('Canonical asset paths, recorded hashes and master references', m.entries.length);
    const supporting = C.read(C.path.join(C.pack, 'supporting.json')).entries;
    for (const e of supporting)
        assert.equal(C.sha(C.fs.readFileSync(C.path.join(C.pack, e.file))), e.sha256, e.file);
    pass('Overview icon and mip hashes', supporting.length);
    let refs = 0;
    const coverage = C.read(C.path.join(C.pack, 'coverage.json'));

    function walk(o) {
        if (!o || typeof o !== 'object')
            return;
        for (const [k, v] of Object.entries(o)) {
            if (k === 'replacements') {
                for (const p of v) {
                    assert(C.fs.existsSync(C.path.join(C.pack, p)), p);
                    refs++;
                }
            } else
                walk(v);
        }
    }

    walk(coverage);
    pass('Inventory replacement references', refs);
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    for (const [name, b] of Object.entries(bindings)) {
        const meta = await C.sharp(C.path.join(C.pack, b.file)).metadata();
        assert.equal(meta.format, 'png', name);
        assert(meta.width > 0 && meta.height > 0);
    }
    pass('PNG compatibility bindings', Object.keys(bindings).length);
    for (const s of scenes)
        for (const k of ['current', 'hd', 'proposed']) {
            const meta = await C.sharp(C.path.join(C.pack, s[k])).metadata();
            assert.deepEqual([ meta.width, meta.height ], s[k + 'Size'], s.id + k);
        }
    pass('Three replacement-stage review image dimensions', scenes.length * 3);
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    C.art.setVariations(true);
    const world = C.read(C.path.join(C.pack, 'review/fixtures/world.json')), get = R.lookup(world);
    // Changing hidden terrain/improvements must not alter proposed visible ground/topology.
    const hidden = world.tiles.find(t => !t.v),
          before = R.groundPixel(get, hidden.x - .25, hidden.y - .25, 16);
    const old = {...hidden};
    hidden.t = 5;
    hidden.f = 255;
    hidden.k = 255;
    assert.deepEqual(R.groundPixel(get, hidden.x - .25, hidden.y - .25, 16), before);
    Object.assign(hidden, old);
    const t = {x : 100, y : 20, f : 16, k : 16, v : 1, c : -1};
    const n = {x : 101, y : 19, f : 48, k : 48, v : 0, c : -1};
    assert.equal(R.topology((x, y) => x === 101 && y === 19 ? n : undefined, t).rail, 0);
    assert.equal(R.topology((x, y) => x === 101 && y === 19 ? n : undefined, t).road, 0);
    pass('Proposed ground and network visibility isolation', 2);
    for (let mask = 0; mask < 256; mask++)
        assert.equal(C.gameToArtMask(mask),
                     Array.from({length : 8}, (_, i) => (mask & (1 << i)) ? 1 << ((i + 1) % 8) : 0)
                         .reduce((a, b) => a | b, 0));
    pass('NE-first engine to N-first authoring mask conversion', 256);
    C.json(C.path.join(C.pack, 'review/validation.json'), {
        status : 'pass',
        checks : results,
        limits : [
            'Renderer command selection, geometry and order are sourced; legacy palette blitting and game window typography are adapter boundaries.',
            'Fixtures are supplied state, not initialized gameplay or a full runtime regression.',
            'No frame-rate claim: image generation timings include CPU offline authoring.'
        ]
    });
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
