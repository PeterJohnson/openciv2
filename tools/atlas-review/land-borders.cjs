// Focused, real-save land transitions in the same four review stages.
const C = require('./common.cjs'), R = require('./render.cjs'), F = require('./fixtures.cjs');
const {nativeTrace} = require('./coast-audit.cjs');
const stages = [
    [ 'original', 'Original' ], [ 'current', 'Replacement native' ], [ 'hd', 'HD only' ],
    [ 'proposed', 'HD + cohesion' ]
];
const groups = [
    {id : 'dry', title : 'Dry country', types : [ 0, 1, 2 ]},
    {id : 'uplands', title : 'Uplands', types : [ 2, 3, 4, 5 ]},
    {id : 'cold', title : 'Cold country', types : [ 6, 7 ]},
    {id : 'wetlands', title : 'Wetlands', types : [ 2, 8, 9 ]}
];

function selectRegions(world) {
    const get = R.lookup(world);
    return groups.map(group => {
        let best;
        for (let oy = 0; oy <= world.height - 12; oy += 2)
            for (let ox = 0; ox <= world.width - 12; ox += 2) {
                const counts = Array(11).fill(0);
                let obscured = 0, edges = 0;
                for (let dy = 0; dy < 12; dy++)
                    for (let dx = dy & 1; dx < 12; dx += 2) {
                        const t = get(ox + dx, oy + dy);
                        if (!t)
                            continue;
                        const type = t.t & 15;
                        counts[type]++;
                        if (t.f & 12 || t.c >= 0 || t.u >= 0)
                            obscured++;
                        for (const [nx, ny] of [[ 1, 1 ], [ -1, 1 ]]) {
                            const n = get(t.x + nx, t.y + ny);
                            if (n && group.types.includes(type) && group.types.includes(n.t & 15) &&
                                type !== (n.t & 15))
                                edges++;
                        }
                    }
                const present = group.types.filter(t => counts[t] > 0).length;
                const score = present * 200 +
                              group.types.reduce((s, t) => s + Math.min(counts[t], 8) * 4, 0) + edges -
                              obscured * 2 - counts[10] * .5;
                if (!best || score > best.score)
                    best = {...group, score, counts, camera : {ox, oy, cols : 6, rows : 12, viewer : -1}};
            }
        if (!group.types.every(t => best.counts[t]))
            throw Error('Missing terrain group ' + group.id);
        return best;
    });
}

function page(report) {
    return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Land terrain transitions</title><style>
body{margin:24px;background:#152322;color:#e5d6b5;font:16px system-ui}a{color:#bed3ba}h1{font-size:26px}p{max-width:1100px;line-height:1.5}select{font:inherit;padding:7px;background:#263b36;color:inherit;border:1px solid #6a7b69}label{margin-right:20px}.panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.view{overflow:auto;max-height:65vh;background:#0c1617}.view img{display:block;max-width:none}h2{font-size:18px}</style>
<h1>Land borders · softer edges, distinct terrain</h1><p><a href="../index.html">Graphics review</a> · <a href="land-borders.png">Four-region comparison sheet</a> · <a href="terrain-blend-validation.json">Transition checks</a> · <a href="coast-audit.html">Complete saved world</a></p>
<p>All scenes use the real 1788 save. Replacement native and HD only retain the game's terrain selection, quarter overlays, feature sprites and draw order. Their new neighbor overlays fade irregularly from a shared half blend at the edge to untouched tile centers. The enhanced variant uses a separate world-space blend with organic transitions and distinct material cores. Coast shapes and foreground sprites are unchanged.</p>
<p>Compare the sandy, grassy, rocky, snowy and wet ground; terrain features still identify hills, mountains, forests and jungle. Original panels are composed standalone mockups using original artwork, not live screenshots. Source terrain overlays are disabled below 32 logical pixels per tile; the full-world review retains that native limitation.</p>
<label>Area / game zoom <select id="scene"></select></label><label>Display <select id="scale"><option value="fit">Fit panels</option><option value="1">100% logical pixels</option><option value="2">200% logical pixels</option></select></label><p id="note"></p><div class="panels" id="panels"></div>
<script>const report=${JSON.stringify(report).replace(/</g, '\\u003c')},stages=${
        JSON.stringify(
            stages)},sel=document.querySelector('#scene');for(const s of report.scenes)sel.add(new Option(s.title,s.id));
function show(){const s=report.scenes.find(s=>s.id===sel.value),scale=document.querySelector('#scale').value,p=document.querySelector('#panels');p.replaceChildren();document.querySelector('#note').textContent='Saved camera '+s.camera.ox+', '+s.camera.oy+' · '+s.terrain.join(', ');
for(const [stage,label]of stages){const section=document.createElement('section'),h=document.createElement('h2'),v=document.createElement('div'),im=new Image();h.textContent=label;v.className='view';im.src='../'+s[stage];im.alt=label+' '+s.title;im.style.width=scale==='fit'?'100%':s.camera.cols*s.tileWidth*Number(scale)+'px';v.append(im);section.append(h,v);p.append(section)}
let syncing=false;for(const v of document.querySelectorAll('.view'))v.onscroll=()=>{if(syncing)return;syncing=true;for(const o of document.querySelectorAll('.view'))if(o!==v){o.scrollLeft=v.scrollLeft;o.scrollTop=v.scrollTop}requestAnimationFrame(()=>syncing=false)};}
sel.value='dry-128';sel.onchange=show;document.querySelector('#scale').onchange=show;show();</script></html>`;
}

async function plate(report) {
    const out = C.clear(2048, 1408, [ 23, 35, 34, 255 ]);
    for (const [row, s] of report.scenes.filter(s => s.tileWidth === 128).entries()) {
        C.blit(out,
               await C.raw(Buffer.from(
                   C.svg(2048, 40,
                         `<text x="16" y="28" fill="#e5d6b5" font-family="sans-serif" font-size="22">${
                             s.title}</text>`))),
               0, row * 352);
        for (const [col, [ stage, label ]] of stages.entries()) {
            C.blit(out,
                   await C.raw(Buffer.from(
                       C.svg(512, 32,
                             `<text x="16" y="23" fill="#b7c6b5" font-family="sans-serif" font-size="18">${
                                 label}</text>`))),
                   col * 512, row * 352 + 40);
            C.blit(out,
                   await C.raw(C.path.join(C.pack, s[stage]), 512, 256, col < 2 ? 'nearest' : 'lanczos3'),
                   col * 512, row * 352 + 80);
        }
    }
    C.write(C.path.join(C.pack, 'review/land-borders.png'), await C.png(out));
}

async function main() {
    const world = C.read(C.path.join(C.pack, 'review/fixtures/saved-world.json')),
          regions = selectRegions(world);
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json')).bindings;
    const original = C.read(C.path.join(C.pack, 'review/original-local/bindings.json'));
    const report = {
        saveSha256 : C.sha(C.fs.readFileSync(C.path.join(C.pack, 'review/fixtures/saved-world.json'))),
        regions,
        scenes : []
    };
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    for (const region of regions)
        for (const tileWidth of [64, 128]) {
            const s = {
                id : region.id + '-' + tileWidth,
                title : region.title + ' · ' + tileWidth + 'px tiles',
                mode : 'map',
                tileWidth,
                camera : {...region.camera, zoom : tileWidth / 8 - 8},
                terrain : region.counts.flatMap((n, i) => n ? [ C.terrainNames[i] ] : [])
            };
            s.fixture = 'review/fixtures/land-borders/' + s.id + '.txt';
            C.write(C.path.join(C.pack, s.fixture), F.serialize(world, s.camera));
            const trace = C.engine('map', C.path.join(C.pack, s.fixture)),
                  ot = nativeTrace(C.path.join(C.pack, s.fixture));
            s.traceSha256 = C.sha(Buffer.from(JSON.stringify(trace)));
            s.originalTraceSha256 = C.sha(Buffer.from(JSON.stringify(ot)));
            for (const [stage] of stages) {
                s[stage] = stage === 'original' ? 'review/original-scenes/land-borders/' + s.id + '.png'
                                                : 'review/land-borders/' + s.id + '-' + stage + '.png';
                const bytes =
                    stage === 'original'
                        ? await R.baseline(
                              ot, s, original.bindings,
                              {originalText : true, palette : n => original.palette[String(n & 255)]})
                    : stage === 'proposed'
                        ? await R.proposedMap(world, s, trace, bindings)
                        : await R.baseline(
                              trace, s, bindings,
                              {density : stage === 'current' ? 1 : 2, native : stage === 'current'});
                C.write(C.path.join(C.pack, s[stage]), bytes);
            }
            report.scenes.push(s);
            console.log('Land review', s.id, s.terrain.join(', '));
        }
    C.json(C.path.join(C.pack, 'review/land-borders.json'), report);
    C.write(C.path.join(C.pack, 'review/land-borders.html'), page(report));
    await plate(report);
}

if (require.main === module)
    main().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {selectRegions};
