const C = require('./common.cjs');

function world(width = 128, height = 128) {
    const tiles = [];
    for (let y = 0; y < height; y++)
        for (let x = y & 1; x < width; x += 2) {
            const field = Math.sin(x * .071) + Math.cos(y * .098) + .45 * Math.sin((x + y) * .16) +
                          .22 * Math.cos((x - y) * .3);
            let t = field < -.35   ? 10
                    : field > 1.7  ? 5
                    : field > 1.36 ? 4
                    : field > .85  ? 3
                    : y > 90       ? 0
                    : y < 15       ? 6
                                   : 2;
            tiles.push({x, y, t, f : 0, k : 0, v : 1, r : 0, h : 0, c : -1, u : -1, s : 0});
        }
    return {width, height, tiles};
}

function tile(w, x, y) {
    return w.tiles.find(t => t.x === x && t.y === y);
}

function set(w, x, y, values) {
    const t = tile(w, x, y);
    if (!t)
        throw Error('Fixture coordinate ' + x + ',' + y);
    Object.assign(t, values);
    if (values.f !== undefined && values.k === undefined)
        t.k = t.f;
}

function regionalWorld() {
    const w = world();
    // A designed 20x20 staggered-coordinate district inside the same deterministic world.
    for (let y = 24; y < 62; y++)
        for (let x = 24 + (y & 1); x < 64; x += 2) {
            const shoreline = 52 + Math.round(2 * Math.sin(y * .34));
            const t = x > shoreline ? 10 : y < 30 ? 3 : x < 30 ? 4 : (x + y) % 14 === 0 ? 1 : 2;
            set(w, x, y, {t});
        }
    for (let y = 28; y <= 49; y++)
        set(w, 36 + (y & 1), y, {t : 130});
    for (let x = 28; x <= 52; x += 2)
        set(w, x, 40, {f : 16});
    for (let y = 32; y <= 48; y++)
        set(w, 44 + (y & 1), y, {f : 48});
    for (const [x, y] of [[ 32, 34 ], [ 34, 34 ], [ 32, 36 ], [ 34, 36 ], [ 38, 38 ], [ 40, 38 ], [ 42, 38 ]])
        set(w, x, y, {f : 20, t : 2});
    set(w, 30, 40, {c : 0, f : 18});
    set(w, 44, 40, {c : 1, f : 50});
    set(w, 50, 46, {c : 2, f : 18});
    set(w, 30, 36, {f : 24, t : 4});
    set(w, 28, 38, {f : 24, t : 4});
    set(w, 38, 44, {f : 28, t : 2});
    set(w, 40, 44, {f : 28, t : 2});
    set(w, 34, 44, {u : 1});
    set(w, 42, 42, {u : 19});
    set(w, 48, 38, {u : 11});
    set(w, 56, 44, {t : 10, u : 35});
    set(w, 34, 48, {f : 16});
    set(w, 38, 48, {f : 48}); // Isolated infrastructure.
    set(w, 32, 46, {f : 64});
    set(w, 48, 44, {f : 66});
    set(w, 40, 34, {r : 1});
    // Independent coast stress region: bay, islet, channel and river mouth.
    for (let y = 70; y < 94; y++)
        for (let x = 30 + (y & 1); x < 58; x += 2) {
            let t = (x < 38 || y < 74 || y > 90) ? 2 : 10;
            if ((x - 46) ** 2 + (y - 81) ** 2 < 10)
                t = 2;
            if (x === 38 + (y & 1) && y >= 78 && y <= 84)
                t = 10;
            set(w, x, y, {t});
        }
    for (let x = 30; x <= 40; x++)
        set(w, x, 82 + (x & 1), {t : x < 38 ? 130 : 10});
    // Visibility strip: no proposed detail should reveal these cells.
    for (const t of w.tiles)
        if (t.x > 104 && t.y < 32)
            t.v = 0;
    return w;
}

function serialize(w, camera) {
    const {zoom = 8, ox = 26, oy = 30, cols = 10, rows = 20, viewer = 1, grid = 0} = camera;
    return [
        [ w.width, w.height, zoom, ox, oy, cols, rows, viewer, grid ].join(' '),
        ...w.tiles.map(t => [t.x, t.y, t.t, t.f, t.k, t.v, t.r, t.h, t.c, t.u, t.s].join(' '))
    ].join('\n') +
           '\n';
}

function buildFixtures() {
    const dir = C.path.join(C.pack, 'review/fixtures');
    const w = regionalWorld();
    C.json(C.path.join(dir, 'world.json'), w);
    const scenes = [
        {
            id : 'district',
            title : 'District · roads, rails, fields and units',
            camera : {ox : 26, oy : 30, cols : 16, rows : 24, zoom : 8},
            tileWidth : 128
        },
        {
            id : 'close',
            title : 'Close view · approximately 10 × 10 tile spans',
            camera : {ox : 28, oy : 32, cols : 10, rows : 20, zoom : 8},
            tileWidth : 128
        },
        {
            id : 'coast',
            title : 'Coast · bay, islet, narrow channel and estuary',
            camera : {ox : 30, oy : 70, cols : 14, rows : 24, zoom : 8},
            tileWidth : 128
        },
        {
            id : 'region',
            title : 'Region · simplified transport and landmarks',
            camera : {ox : 0, oy : 0, cols : 32, rows : 64, zoom : -4},
            tileWidth : 32
        },
        {
            id : 'world',
            title : 'World · all 128 × 128 staggered coordinates',
            camera : {ox : 0, oy : 0, cols : 64, rows : 128, zoom : -6},
            tileWidth : 16
        }
    ];
    for (const s of scenes) {
        s.mode = 'map';
        s.fixture = `review/fixtures/${s.id}.txt`;
        C.write(C.path.join(C.pack, s.fixture), serialize(w, s.camera));
    }
    for (const [kind, name] of ['coastal', 'river', 'inland'].entries()) {
        const id = 'city-' + name, fixture = `review/fixtures/${id}.txt`;
        C.write(C.path.join(C.pack, fixture),
                `${kind} 2 8 17\n1 2 3 4 5 7 8 12 14 16 20 28 30 31 34 100 103 110\n`);
        scenes.push({id, title : `City panorama · ${name}`, mode : 'city', site : name, fixture});
    }
    for (const [id, levels, bonus, complete] of [[ 'throne-early', [ 1, 1, 1, 1, 1, 1, 1, 1 ], 0, 0 ],
                                                 [ 'throne-mixed', [ 3, 2, 4, 2, 1, 3, 2, 4 ], 0, 0 ],
                                                 [ 'throne-complete', [ 4, 4, 4, 4, 4, 4, 4, 4 ], 127, 1 ]]) {
        const fixture = `review/fixtures/${id}.txt`;
        C.write(C.path.join(C.pack, fixture), [...levels, bonus, complete ].join(' ') + '\n');
        scenes.push({id, title : id.replaceAll('-', ' '), mode : 'throne', fixture, levels, bonus, complete});
    }
    C.json(C.path.join(dir, 'scenes.json'), scenes);
    return {w, scenes};
}

module.exports = {
    world,
    tile,
    set,
    regionalWorld,
    serialize,
    buildFixtures
};
