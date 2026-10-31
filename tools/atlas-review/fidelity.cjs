const C = require('./common.cjs');
const assert = require('node:assert/strict');

const evidence = [
    [
        'src/auto/diplomacy.cpp', 4766,
        'science_draw_tech now executes unchanged, including measured fitting, colors and two-line layout.'
    ],
    [
        'src/auto/graphics.cpp', 7886,
        'Font face/height/style selection uses the repository reference metrics.'
    ],
    [
        'src/platform/text.c', 245, 'The chosen indexed path uses drawing advances with CIV2_WINE_TEXT unset.'
    ],
    [
        'tools/atlas-review/font.cjs', 1,
        'Native bitmap replay uses the reference glyph masks, bearings and clip rectangles.'
    ],
    [
        'tools/atlas-review/native-windows.cjs', 1,
        'Original and HD-only windows share this native-content backend; enhanced remains separate.'
    ],
    [ 'src/auto/city.cpp', 12699, 'The four resource bar helpers and their parent now execute unchanged.' ],
    [
        'src/auto/city.cpp', 12524,
        'The city resource terrain dispatcher now executes with source map tile drawing.'
    ],
    [ 'src/auto/city.cpp', 16965, 'Native city control coordinates are taken from create_controls.' ],
    [
        'src/auto/mapview.cpp', 2234,
        'draw_city_names now executes, with real saved-city names and native metrics.'
    ],
    [
        'src/auto/city.cpp', 4809,
        'Panorama title boundary follows the source title band, font, alignment and two palette passes.'
    ],
    [
        'src/auto/spaceship.cpp', 630,
        'Spacecraft static completed typing follows the source font, line spacing and colors.'
    ],
    [ 'src/game/unwind.cpp', 191, 'Original spacecraft buttons use the source crops and native labels.' ],
    [
        'tools/atlas-review/verify-native.cjs', 1,
        'Focused native typography/layout checks supplement source-body and D/R validation.'
    ]
];
const scenes = [
    {
        id : 'diplomacy',
        title : 'Diplomacy audience',
        reference : 'docs/screenshots/diplomacy.png',
        mockup : 'assets/atlas-hd/review/original-scenes/images/diplomacy.png',
        provenance :
            'Repository README identifies this as a native OpenCiv2 runtime screenshot. Different leader, era, government, technology list and power rank from the mockup.',
        findings : [
            "Corrected: reference Times glyphs, source measured fitting/truncation, shadow passes and era colors replace the generic SVG labels.",
            "Corrected: invented envoy, government and column captions were removed from native/original and HD-only.",
            "Static audience only. Herald movies are absent from the installed input set; leader, era, research and rank differ from the runtime screenshot."
        ],
        crops : [ [ 479, 128, 124, 189 ], [ 479, 128, 124, 189 ] ],
        focus :
            'Knowledge labels: different technologies/eras, so inspect typography and wrapping rather than subtracting pixels.'
    },
    {
        id : 'city',
        title : 'City management window',
        reference : 'docs/screenshots/city.png',
        mockup : 'assets/atlas-hd/review/original-scenes/images/city-window.png',
        provenance :
            'Runtime screenshot is the full desktop/window at 1024x768. The mockup is a 636x421 content fixture at view_scale=2. Population, yields, improvements and units differ.',
        findings : [
            "Corrected: reference Arial metrics, palette text colors and shadows; native food, trade/distribution and shield bars now execute unchanged.",
            "Corrected: resource terrain uses the source dispatcher and neighbor joins. Buy/Change and the bottom controls use native scale-2 coordinates.",
            "Content rectangle only: platform window chrome is excluded. The runtime screenshot uses a larger scale and different city state; present units and control painting retain explicit finite backends."
        ],
        crops : [ [ 337, 174, 351, 243 ], [ 202, 61, 233, 145 ] ],
        focus :
            'Economy panel: source-scale screenshots are deliberately not rescaled to suggest identical geometry.'
    },
    {
        id : 'panorama',
        title : 'City panorama',
        reference : 'docs/screenshots/city-view.png',
        mockup : 'assets/atlas-hd/review/original-scenes/images/city-coastal.png',
        provenance :
            'Runtime screenshot is London, June 1940, in a 1024x479 viewport. The mockup is a synthetic 1280x480 coastal composition with a different building set.',
        findings : [
            "Corrected: city name/year title with source Times 36 bold, title band and two palette passes.",
            "Synthetic Asteria 1788 has a different viewport, camera and building inventory from London 1940. Those inputs must be aligned before pixel comparison."
        ],
        crops : [ [ 260, 0, 510, 60 ], [ 385, 0, 510, 60 ] ],
        focus : 'Title band: restored; city, date and viewport remain different supplied inputs.'
    },
    {
        id : 'map',
        title : 'Map view',
        reference : 'docs/screenshots/europe-1940.png',
        mockup : 'assets/atlas-hd/review/original-scenes/images/saved-close.png',
        provenance :
            'Runtime screenshot is the June 1940 scenario with full UI. The mockup uses the real 1788 save, a different viewport/zoom, and deliberately disables fog.',
        findings : [
            "Corrected: extracted city-name drawing uses real saved-city names. Unit/city badge text now uses source zoom fonts and reference glyph metrics.",
            "The 1788 save and camera differ from the June 1940 screenshot. Full application chrome, minimap and status panels are outside the map-content crop."
        ]
    }
];

function fontMeasurements() {
    const input = 'data/native/fonts.bin', b = C.fs.readFileSync(C.path.join(C.root, input));
    assert.equal(b.subarray(0, 8).toString(), 'C2FONTS2');
    const count = b.readUInt32LE(8), samples = [];
    let offset = 12;
    for (let i = 0; i < count; i++) {
        const face = b[offset], height = b[offset + 1], weight = b.readUInt16LE(offset + 2),
              italic = b[offset + 4];
        const cellHeight = b.readInt32LE(offset + 8), ascent = b.readInt32LE(offset + 12);
        offset += 52;
        const glyphs = [];
        for (let c = 0; c < 256; c++) {
            glyphs.push([ b.readInt16LE(offset), b.readInt16LE(offset + 2) ]);
            const width = b[offset + 6], h = b[offset + 7];
            offset += 8 + Math.ceil(width / 8) * h;
        }
        if (face === 0 && height === 11 && weight === 400 && italic === 0)
            for (const text of ['III', 'WWW', 'NAVIGATION', 'MEDICINE', 'ELECTRICITY']) {
                const bytes = Buffer.from(text, 'ascii');
                samples.push({
                    text,
                    face : 'Times New Roman reference',
                    height,
                    cellHeight,
                    ascent,
                    referenceMeasure : [...bytes ].reduce((n, c) => n + glyphs[c][0], 0),
                    referenceDraw : [...bytes ].reduce((n, c) => n + glyphs[c][1], 0),
                    mapShimAt1x : text.length * 6
                });
            }
    }
    assert.equal(offset, b.length);
    assert.equal(samples.length, 5);
    return {
        file : input,
        sha256 : C.sha(b),
        records : count,
        samples,
        limits :
            'Metrics from the port’s Wine-reference bitmap bank, not a fresh Windows GDI measurement. Map-shim values illustrate its fixed-width approximation; they are not the diplomacy SVG renderer’s measured output.'
    };
}

async function build() {
    const fonts = fontMeasurements(), rows = [];
    for (const s of scenes) {
        const r = {...s};
        for (const key of ['reference', 'mockup']) {
            const file = C.path.join(C.root, s[key]), bytes = C.fs.readFileSync(file),
                  m = await C.sharp(bytes).metadata();
            r[key + 'Info'] = {width : m.width, height : m.height, sha256 : C.sha(bytes)};
        }
        if (s.crops)
            s.crops.forEach(([ x, y, w, h ], i) => {
                const m = r[(i ? 'mockup' : 'reference') + 'Info'];
                assert(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= m.width && y + h <= m.height,
                       s.id + ' crop');
            });
        rows.push(r);
    }
    const sourceEvidence = evidence.map(([ file, line, fact ]) => {
        const bytes = C.fs.readFileSync(C.path.join(C.root, file));
        assert(line <= bytes.toString().split('\n').length, file);
        return {file, line, fact, sha256 : C.sha(bytes)};
    });
    const data = {
        status : 'native text/layout corrections applied; runtime pixel equivalence remains unverified',
        references :
            'Four checked-in native OpenCiv2 runtime screenshots, identified in repository README.md. They are not newly captured original-executable screenshots.',
        freshOriginalCapture :
            'Not obtained: computer-use app approval timed out when launching an isolated copy of the installed executable. No live screenshot or runtime-parity claim is made.',
        comparison :
            'Unpaired states/viewports. No whole-image pixel-difference score or pass/fail parity threshold.',
        rows,
        fonts,
        sourceEvidence,
        remainingScenes : [
            {
                id : 'spacecraft',
                status : 'source audit only; no runtime screenshot in docs/screenshots',
                finding :
                    'Native assembly crop order executes. Source-derived title, text, status and controls now use reference glyphs; statistics remain fixture inputs.'
            },
            {
                id : 'throne',
                status : 'source audit only; no runtime screenshot in docs/screenshots',
                finding :
                    'Resource order/crops execute for supplied furnishing values; runtime camera, stage state and compositing equality remain unverified.'
            }
        ]
    };
    C.json(C.path.join(C.pack, 'review/fidelity.json'), data);
    const e = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    const link = (p, line) => '../../../' + p + (line ? '#L' + line : '');
    const table = fonts.samples
                      .map(r => `<tr><td>${r.text}</td><td>${r.referenceMeasure}</td><td>${
                               r.referenceDraw}</td><td>${r.mapShimAt1x}</td></tr>`)
                      .join('');
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Runtime fidelity · Atlas HD</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#101c1c;color:#eee5cf;font:16px/1.55 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:28px}h1,h2{font-family:Georgia,serif}h1{font-size:38px;margin:10px 0}h2{margin-top:32px}a{color:#e2c485}p{max-width:1050px}.notice{padding:14px 18px;background:#2f3025;border-left:4px solid #d9b877}.controls{display:flex;gap:24px;flex-wrap:wrap;margin:25px 0}label{display:grid;gap:6px}select{padding:8px;background:#263d38;color:inherit;border:1px solid #65776a;font:inherit}button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #d9b877}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.panel{min-width:0;background:#182b28;border:1px solid #536454;border-radius:5px}h3{font-size:16px;margin:12px 16px}.viewport{overflow:auto;max-height:720px;background:#080e0f}img{display:block;image-rendering:pixelated}img.fit{width:100%;height:auto}canvas{display:block;image-rendering:pixelated}.caption{font-size:13px;color:#bcc8b7;margin:10px 16px}li{margin:8px 0;max-width:1100px}table{border-collapse:collapse;width:100%;max-width:1000px}th,td{padding:9px;border:1px solid #536454;text-align:left;font-size:14px}.muted{color:#bac6b6}code{color:#edce91}details{margin:22px 0;border:1px solid #536454;padding:14px}summary{cursor:pointer}#focus[hidden]{display:none}@media(max-width:800px){.pair{grid-template-columns:1fr}main{padding:16px}h1{font-size:30px}}</style>
<main><a href="../index.html">← Graphics review</a><h1>Native rendering corrections applied</h1><p>Original and HD-only scenes now use the repository font bank, source knowledge fitting, native city economy bars and resource terrain, map city names and panorama titles. Enhanced compositions retain their separate renderer. The comparisons below show the corrected original-art scenes.</p>
<p class="notice">References below are existing <strong>native OpenCiv2 screenshots</strong> from the repository, not fresh captures of the installed original executable. Saves, era, viewport and scale are not aligned. This is a visual/source audit; no pixel-parity score is claimed. The live original-game launch hit an app-approval timeout.</p>
<div class="controls"><label>Scene<select id="scene">${
        rows.map((r, i) => `<option value="${i}">${e(r.title)}</option>`)
            .join(
                '')}</select></label><label>Image scale<select id="zoom"><option value="fit">Fit each panel</option><option value="1">100% · one image pixel per CSS pixel</option><option value="2">200% · nearest-neighbor</option><option value="4">400% · nearest-neighbor</option></select></label></div>
<p id="provenance" class="muted"></p><div class="pair">${
            ['reference', 'mockup']
                .map(k => `<section class="panel"><h3>${
                         k === 'reference'
                             ? 'Runtime screenshot'
                             : 'Current original-art mockup'}</h3><div class="viewport"><img id="${
                         k}" alt=""></div><p class="caption" id="${k}Caption"></p></section>`)
                .join('')}</div><ul id="findings"></ul>
<section id="focus"><h2>Detail at 200%</h2><p id="focusCaption" class="muted"></p><div class="pair">${
            ['reference', 'mockup']
                .map(k => `<section class="panel"><h3>${
                         k === 'reference' ? 'Runtime detail'
                                           : 'Mockup detail'}</h3><div class="viewport"><canvas id="${
                         k}Crop"></canvas></div></section>`)
                .join('')}</div></section>
<h2>Reference font metrics now used</h2><p>The source diplomacy font is face 0 (Times New Roman), height 11. Its 13-pixel cell and 10-pixel ascent come from the reference font bank. Native text now uses these glyph masks and drawing advances. The old fixed-width estimate is retained below only to explain the discrepancy that was corrected.</p><table><thead><tr><th>String</th><th>Reference measured width</th><th>Reference drawing advance</th><th>Previous shim estimate at 1×</th></tr></thead><tbody>${
        table}</tbody></table><p class="muted">${
        e(fonts
              .limits)} Widths are pixels, not a pixel-diff result. Even selecting the same family name is insufficient without the matching font data, baseline, clipping, shadow, palette and antialiasing path.</p>
<h2>What is not visually verified yet</h2><p>Spacecraft and throne-room scenes have source-trace checks but no matching runtime screenshot here. Spacecraft typography and controls now follow source geometry with declared fixture statistics. A clean Debug/Release trace comparison proves repeatability of the standalone harness, not equality to the game's finished framebuffer.</p>
<h2>Validation and remaining scope</h2><p><a href="native-validation.json">Native validation</a> covers measured widths, source two-line labels, clipped glyphs at both densities, native economy bar positions, saved names and title passes. Original and HD-only share logical layouts. City content excludes application title/border chrome; control painting and finite present-unit state remain explicit adapters.</p><p>A runtime pixel gate still requires identical save/state, camera, content rectangle, font mode and capture frame. No fresh live capture was obtained. Herald animation and unpaired spacecraft/throne scenes remain visually unverified.</p>
<details><summary>Source evidence</summary><ul>${
        sourceEvidence
            .map(r => `<li><a href="${link(r.file, r.line)}">${e(r.file)}:${r.line}</a> — ${e(r.fact)}</li>`)
            .join(
                '')}</ul><p><a href="fidelity.json">Image dimensions, hashes, font measurements and evidence index</a> · <a href="../FIDELITY-AUDIT.md">Audit and repair scope</a></p></details></main>
<script>const rows=${
        JSON.stringify(rows).replaceAll('<', '\\u003c')};const el=id=>document.getElementById(id);let epoch=0;
function scale(){for(const k of ['reference','mockup']){const img=el(k),z=el('zoom').value;img.className=z==='fit'?'fit':'';img.style.width=z==='fit'?'':img.naturalWidth*Number(z)+'px';}}
function show(){const id=++epoch,r=rows[Number(el('scene').value)];el('provenance').textContent=r.provenance;el('findings').replaceChildren();for(const t of r.findings){const li=document.createElement('li');li.textContent=t;el('findings').append(li);}el('focus').hidden=!r.crops;el('focusCaption').textContent=r.focus||'';for(const [i,k] of ['reference','mockup'].entries()){const img=el(k),m=r[k+'Info'];el(k+'Caption').textContent=m.width+' × '+m.height+' · '+r[k];img.alt=r.title+' — '+(i?'original-art mockup':'runtime screenshot');img.onload=()=>{if(id!==epoch)return;scale();if(r.crops){const [x,y,w,h]=r.crops[i],canvas=el(k+'Crop');canvas.width=w*2;canvas.height=h*2;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(img,x,y,w,h,0,0,w*2,h*2);}};img.src='../../../'+r[k];}}
el('scene').onchange=show;el('zoom').onchange=scale;show();</script></html>`;
    C.write(C.path.join(C.pack, 'review/fidelity.html'), html);
    // Validate every local reference and compile the offline script before delivery.
    for (const m of html.matchAll(/href="([^"#]+)(?:#[^"]*)?"/g)) {
        const href = m[1].split('#')[0];
        assert(C.fs.existsSync(C.path.resolve(C.pack, 'review', href)), 'Missing link: ' + href);
    }
    new (require('node:vm').Script)(html.match(/<script>([\s\S]*)<\/script>/)[1]);
    console.log(
        'Fidelity audit built: 4 runtime/mockup pairs, 3 bounded detail pairs, 5 font measurements, 13 source references. Pixel parity not claimed.');
}

build().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
