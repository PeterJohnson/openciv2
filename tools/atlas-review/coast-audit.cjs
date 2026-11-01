// Saved-world survey: composed original scenes remain separate from replacement assets.
const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./fixtures.cjs');
const {spawnSync} = require('node:child_process');
const stages = [
    [ 'original', 'Original' ], [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
    [ 'proposed', 'HD + cohesion' ]
];

function survey(w) {
    const get = R.lookup(w), water = t => (t.t & 15) === 10, key = t => `${t.x},${t.y}`, seen = new Set(),
          components = [];
    for (const t of w.tiles) {
        if (seen.has(key(t)))
            continue;
        const cells = [ t ];
        seen.add(key(t));
        for (let n = 0; n < cells.length; n++)
            for (const d of C.directions.filter((_, i) => !(i % 2))) {
                const next = get(cells[n].x + d[0], cells[n].y + d[1]);
                if (next && water(next) === water(t) && !seen.has(key(next))) {
                    seen.add(key(next));
                    cells.push(next);
                }
            }
        components.push({water : water(t), size : cells.length, cells});
    }
    const land = components.filter(c => !c.water).sort((a, b) => b.size - a.size),
          sea = components.filter(c => c.water).sort((a, b) => b.size - a.size);
    const coast = w.tiles.filter(t => !water(t) &&
                                      C.directions.some(d => water(get(t.x + d[0], t.y + d[1]) || {t : 0})));
    const mouths = w.tiles.filter(
        t => water(t) &&
             C.directions.filter((_, i) => !(i % 2)).some(d => get(t.x + d[0], t.y + d[1])?.t & 128));
    const safe = t => t.x > 10 && t.x < w.width - 10 && t.y > 10 && t.y < w.height - 10;
    const choose = (a, f) => a.find(t => safe(t) && (!f || f(t))) || a[0];
    const island =
        land.slice(1).filter(c => c.size <= 20 && c.cells.some(safe)).sort((a, b) => a.size - b.size);
    const lakes = sea.slice(1).filter(c => c.cells.some(safe)).sort((a, b) => a.size - b.size);
    const cases = [
        {id : 'newcastle', title : 'Newcastle · desert, fields and forest', x : 128, y : 76},
        ...island.slice(0, 1).map(c => ({
                                      id : 'island',
                                      title : `Small island · ${c.size} land cell${c.size === 1 ? '' : 's'}`,
                                      ...choose(c.cells)
                                  })),
        ...island.filter(c => c.size > 1)
            .slice(-1)
            .map(c => ({id : 'islands', title : `Island shore · ${c.size} land cells`, ...choose(c.cells)})),
        ...lakes.slice(0, 1).map(c => ({
                                     id : 'lake',
                                     title : `Enclosed lake · ${c.size} water cell${c.size === 1 ? '' : 's'}`,
                                     ...choose(c.cells)
                                 })),
        ...lakes.filter(c => c.size > 1)
            .slice(0, 1)
            .map(c => ({id : 'lakes', title : `Joined lake · ${c.size} water cells`, ...choose(c.cells)})),
        {id : 'mouth', title : 'River mouth and neighboring coast', ...choose(mouths)}, {
            id : 'forest',
            title : 'Forest coast and cultivated land',
            ...choose(coast,
                      t => (t.t & 15) === 3 && C.directions.some(d => get(t.x + d[0], t.y + d[1])?.f & 4))
        },
        {id : 'wrap', title : 'Eastern map seam · wrapped neighbors', x : 148, y : 60}
    ];
    return {
        counts : {
            tiles : w.tiles.length,
            landComponents : land.map(c => c.size),
            waterComponents : sea.map(c => c.size),
            coastalLand : coast.length,
            coastalForest : coast.filter(t => (t.t & 15) === 3).length,
            coastalFields : coast.filter(t => t.f & 4).length,
            riverMouthTiles : mouths.length
        },
        cases
    };
}

function definitions(w, report) {
    const out = [ 16, 32, 48, 64 ].map(
        tw => ({
            id : `world-${tw}`,
            title : `Complete saved world · ${tw}px tiles`,
            mode : 'map',
            tileWidth : tw,
            camera : {ox : 0, oy : 0, cols : 75, rows : 120, zoom : tw / 8 - 8, viewer : -1},
            fullWorld : true
        }));
    for (const spot of report.cases)
        for (const tw of [64, 128]) {
            const ox = spot.id === 'wrap'
                           ? 134
                           : Math.max(0, Math.min(w.width - 16, Math.floor((spot.x - 8) / 2) * 2));
            const oy = Math.max(0, Math.min(w.height - 16, Math.floor((spot.y - 8) / 2) * 2));
            out.push({
                id : `${spot.id}-${tw}`,
                title : `${spot.title} · ${tw}px tiles`,
                mode : 'map',
                tileWidth : tw,
                center : [ spot.x, spot.y ],
                camera : {ox, oy, cols : 8, rows : 16, zoom : tw / 8 - 8, viewer : -1}
            });
        }
    return out;
}

function nativeTrace(fixture, config = 'Release') {
    const r = spawnSync(C.path.join(C.root, `build/atlas-review/${config}/atlas-engine.exe`),
                        [ 'map', fixture, C.path.join(C.pack, 'review/original-local/anchors.txt') ],
                        {encoding : 'utf8', maxBuffer : 64 * 1024 * 1024});
    if (r.status !== 0)
        throw Error(r.stderr || r.status);
    return JSON.parse(r.stdout);
}

function page(report) {
    const data = JSON.stringify(report).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Saved-world coastline review</title><style>
body{margin:24px;background:#152322;color:#e5d6b5;font:16px system-ui}a{color:#bed3ba}h1{font-size:24px}select,button{font:inherit;padding:7px;background:#263b36;color:inherit;border:1px solid #6a7b69}label{margin-right:16px}#panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.view{overflow:auto;max-height:68vh;background:#0c1617}.view img{display:block;max-width:none}h2{font-size:18px}p{max-width:1100px;line-height:1.5}small{color:#a9b8af}</style>
<h1>Saved-world coastlines · full map and close inspections</h1><p><a href="../index.html">Graphics review</a> · <a href="coast-audit-validation.json">Coverage and seam checks</a> · <a href="shore-relief-validation.json">Contour connectivity and variation checks</a> · <a href="coast-contours.png">Shoreline close-ups</a> · <a href="forest-borders.png">Forest border close-ups</a> · <a href="coast-islands-lakes.png">Island / lake contact sheet</a> · <a href="coast-forest-mouths.png">Forest / mouth contact sheet</a></p>
<p>All 9,000 saved cells are rendered at 16, 32, 48 and 64 logical pixels per tile. Selected islands, lakes, river mouths, forest/irrigation and the wrapped map edge also have 128px close views. Source camera, visibility and draw commands are shared by original, replacement native and HD only. The enhanced proposal remains separate.</p>
<p>The varied shorelines add asymmetric coves, headlands and eroded edges around a protected land footprint. Native variation joins across tiles; enhanced variation joins across the wrapped world. Native coast quarters are deliberately disabled by the game at 16/32px; those two baseline zooms retain square terrain tiles. The enhanced view retains shore contours at every zoom. Original panels are composed mockups from local game art, not live screenshots.</p>
<label>Area / game zoom <select id="scene"></select></label><label>Display <select id="scale"><option value="fit">Fit panels</option><option value="1">100% logical pixels</option><option value="2">200% logical pixels</option></select></label><p id="note"></p><div id="panels"></div>
<script>const report=${data},stages=${
        JSON.stringify(stages)},sel=document.querySelector('#scene'),panels=document.querySelector('#panels');
for(const s of report.scenes)sel.add(new Option(s.title,s.id));
function show(){const s=report.scenes.find(s=>s.id===sel.value),scale=document.querySelector('#scale').value;panels.innerHTML='';document.querySelector('#note').textContent='Camera '+s.camera.ox+', '+s.camera.oy+' · '+s.tileWidth+' logical pixels per tile'+(s.center?' · inspected location '+s.center.join(', '):' · complete world');
for(const [stage,label]of stages){const section=document.createElement('section'),h=document.createElement('h2'),v=document.createElement('div'),im=new Image();h.textContent=label;v.className='view';im.src='../'+s[stage];im.alt=label+' '+s.title;im.style.width=scale==='fit'?'100%':s.camera.cols*s.tileWidth*Number(scale)+'px';v.append(im);section.append(h,v);panels.append(section)}
let syncing=false;for(const v of document.querySelectorAll('.view'))v.onscroll=()=>{if(syncing)return;syncing=true;for(const other of document.querySelectorAll('.view'))if(other!==v){other.scrollLeft=v.scrollLeft;other.scrollTop=v.scrollTop;}requestAnimationFrame(()=>syncing=false);};}
sel.value='newcastle-128';sel.onchange=show;document.querySelector('#scale').onchange=show;show();</script></html>`;
}

async function main() {
    const w = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json')), report = survey(w);
    report.scenes = definitions(w, report);
    report.saveSha256 = C.sha(C.fs.readFileSync(C.path.join(C.pack, 'review/fixtures/saved-world.json')));
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const original = C.read(C.path.join(C.pack, 'review/original-local/bindings.json'));
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    for (const s of report.scenes) {
        s.fixture = `review/fixtures/coast-audit/${s.id}.txt`;
        C.write(C.path.join(C.pack, s.fixture), F.serialize(w, s.camera));
        const t = C.engine('map', C.path.join(C.pack, s.fixture));
        const ot = nativeTrace(C.path.join(C.pack, s.fixture));
        s.commandCount = t.commands.length;
        s.coastCommands = t.commands.filter(c => c.asset.startsWith('coast/')).length;
        s.traceSha256 = C.sha(Buffer.from(JSON.stringify(t)));
        s.originalTraceSha256 = C.sha(Buffer.from(JSON.stringify(ot)));
        for (const [stage] of stages) {
            const file = stage === 'original' ? `review/original-scenes/coast-audit/${s.id}.png`
                                              : `review/coast-audit/${s.id}-${stage}.png`;
            s[stage] = file;
            if (process.argv.includes('--skip-original') && stage === 'original') {
                if (!C.fs.existsSync(C.path.join(C.pack, file)))
                    throw Error('Missing original comparison ' + s.id);
                continue;
            }
            if (process.argv.includes('--page-only') ||
                (process.argv.includes('--replacement-only') && [ 'original', 'proposed' ].includes(stage)))
                continue;
            const b =
                stage === 'original'
                    ? await R.baseline(
                          ot, s, original.bindings,
                          {originalText : true, palette : n => original.palette[String(n & 255)]})
                : stage === 'proposed'
                    ? await R.proposedMap(w, s, t, bindings)
                    : await R.baseline(t, s, bindings,
                                       {density : stage === 'current' ? 1 : 2, native : stage === 'current'});
            C.write(C.path.join(C.pack, file), b);
            console.log('Coast survey', s.id, stage, Math.round(b.length / 1024) + ' KiB');
        }
    }
    await require('./coast-audit-plates.cjs').build(report);
    C.json(C.path.join(C.pack, 'review/coast-audit.json'), report);
    C.write(C.path.join(C.pack, 'review/coast-audit.html'), page(report));
}

if (require.main === module)
    main().catch(e => {
        console.error(e);
        process.exitCode = 1
    });
module.exports = {
    survey,
    definitions,
    nativeTrace
};
