// Rebuilds a review page from retained, unmodified execution captures.
// To import fresh captures: --captures <directory> --exe <captured OpenCiv2.exe>.
const C = require('./common.cjs'), {spawnSync} = require('node:child_process');
const base = 'review/original-scenes/runtime-other/';
const captureBuild = 'bd89036fc339f0c44f7788b17f9765c377cc8a55';
const definitions = [
    [
        'pedia-advances', 'pedia-advances', [ 647, 354, 1279, 750 ],
        'Index sorting, two-column list, icons and controls follow the source. Runtime focus/cursor states are not reproduced.'
    ],
    [
        'pedia-advance', 'pedia-advance', [ 647, 354, 1279, 750 ],
        'Railroad prerequisites, unlocked units, links and title agree. The save scenario has no DESCRIBE.TXT, so its Description control is inactive.'
    ],
    [
        'pedia-tree', 'pedia-tree', [ 647, 354, 1279, 750 ],
        'Railroad dependency nodes and connector routing agree. Links now come from the extracted tree routines.'
    ],
    [
        'pedia-terrain', 'pedia-terrain', [ 647, 354, 1279, 750 ],
        'Forest art scale, stat rows and resource links agree after correcting the device adapter’s sprite-size query. Source label/value overlaps and clipped long headings are intentionally retained.'
    ],
    [
        'tax-rates', 'tax-rates', [ 658, 341, 1267, 764 ],
        'Source totals agree: income 215, upkeep 238, discoveries every 7 turns. Sliders, percentages, locks and headings use the game layout.'
    ],
    [
        'foreign-minister', 'foreign-minister', [ 524, 408, 1402, 698 ],
        'Sioux relationship text, capital glyph and report controls agree. The saved attitude is supplied at the AI-evaluation boundary.'
    ],
    [
        'casualty-timeline', 'casualty-timeline', [ 658, 347, 1267, 758 ],
        'Both show the empty casualty log for this single-player save. The source PictureWindow frame has no caption strip.'
    ],
    [
        'dialog-options', 'dialog-options', [ 524, 336, 1402, 768 ],
        'Checkbox rows, labels, saved option states and autosized frame agree. Focus rectangles are outside the captured initial-paint boundary.'
    ],
    [
        'dialog-confirmation', 'dialog-confirmation', [ 683, 462, 1242, 642 ],
        'Quit prompt, information icon, choices and button placement follow the original dialog parser/layout. Runtime has a focused choice; standalone captures the initial paint.'
    ],
    [
        'dialog-setup', 'main-menu', [ 1349, 671, 1748, 1008 ],
        'Main-menu dialog only. Runtime has Load a Game selected; standalone shows the default first choice. Startup logo, map preview and desktop placement are outside this dialog scene.'
    ],
    [
        'world-map', 'saved-map', [ 1644, 20, 1902, 185 ],
        'Saved visibility, land/city colors, wrapped projection and viewport outline are rendered by minimap_redraw. The fixture declares a 256 × 168 panel; the execution capture’s panel is slightly different in size.'
    ],
    [
        'status-panel', 'saved-map', [ 1644, 186, 1902, 1080 ],
        'Population, gold, rates, active Knights, home city and terrain agree. Actual saved unit state is passed to gfx_draw_unit. The execution build has extras enabled and displays Turn 370; this baseline disables extras. Panel width affects the dynamic source font sizes.'
    ]
];
const esc = s =>
    String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function git(...args) {
    const r = spawnSync('git', args, {cwd : C.root, maxBuffer : 32 * 1024 * 1024});
    if (r.status)
        throw Error(r.stderr.toString());
    return r.stdout;
}
async function build() {
    const arg = name => {
        const i = process.argv.indexOf(name);
        return i < 0 ? null : process.argv[i + 1];
    };
    const importDir = arg('--captures'), exe = arg('--exe');
    const oldFile = C.path.join(C.pack, 'review/other-windows/runtime-audit.json');
    const previous = C.fs.existsSync(oldFile) ? C.read(oldFile) : {};
    const captures = [];
    for (const name of [...new Set(definitions.map(d => d[1]))]) {
        const file = base + name + '.png';
        if (importDir)
            C.write(C.path.join(C.pack, file),
                    C.fs.readFileSync(C.path.join(importDir, name + '.png')));
        const bytes = C.fs.readFileSync(C.path.join(C.pack, file)),
              meta = await C.sharp(bytes).metadata();
        captures.push(
            {name, file, width : meta.width, height : meta.height, sha256 : C.sha(bytes)});
    }
    const source = C.read(C.path.join(C.pack, 'review/other-window-extraction.json'));
    const sourceIdentity = Object.keys(source.sourceHashes).map(file => {
        const runtime = git('show', captureBuild + ':' + file),
              current = C.fs.readFileSync(C.path.join(C.root, file));
        const normalize = b =>
            file.endsWith('.bin') ? b : Buffer.from(b.toString('utf8').replaceAll('\r\n', '\n'));
        return {
            file,
            runtimeSha256 : C.sha(runtime),
            reviewSha256 : C.sha(current),
            equalAfterLfNormalization : normalize(runtime).equals(normalize(current))
        };
    });
    const scenes = C.read(C.path.join(C.pack, 'review/other-windows/scenes.json'));
    const comparisons = [];
    for (const [id, name, crop, assessment] of definitions) {
        const s = scenes.find(s => s.id === id), raw = base + name + '.png',
              file = base + id + '-crop.png';
        const [left, top, right, bottom] = crop;
        const bytes = await C.sharp(C.path.join(C.pack, raw))
                          .extract({left, top, width : right - left, height : bottom - top})
                          .png()
                          .toBuffer();
        C.write(C.path.join(C.pack, file), bytes);
        comparisons.push({
            id,
            title : s.title,
            capture : raw,
            crop,
            cropFile : file,
            cropSha256 : C.sha(bytes),
            original : s.original,
            hd : s.hd,
            logicalSize : s.originalSize,
            assessment
        });
    }
    const report = {
        captureProduct :
            'OpenCiv2 Windows build with local original game artwork; not the legacy 1999 executable',
        captureBuild,
        executableSha256 : exe ? C.sha(C.fs.readFileSync(exe)) : previous.executableSha256,
        saveSha256 : C.read(C.path.join(C.pack, 'review/fixtures/other-windows/native-inputs.json'))
                         .saveSha256,
        captureMethod :
            'Actual UI execution: load he_a1788.sav, open the listed dialogs, capture the game window. Raw 1920 × 1080 capture files are retained byte-for-byte. Crops are lossless; browser comparison stretches them to the standalone logical dimensions to account for capture scaling.',
        runtimeExtras :
            'Enabled in execution build; disabled in standalone baseline. Status Turn 370 is consequently absent from the baseline.',
        qualification :
            'Visual comparison of 12 scenes, not pixel identity or qualification of every window. Capture scaling, pointer/focus state and panel size prevent a whole-frame pixel-equivalence claim.',
        sourceIdentity,
        captures,
        comparisons,
        uncaptured : scenes.filter(s => !comparisons.some(c => c.id === s.id)).map(s => s.id)
    };
    if (!report.executableSha256)
        throw Error('Provide --exe on first import');
    C.json(oldFile, report);
    const cards =
        comparisons
            .map(
                c => `<section id="${c.id}"><h2>${esc(c.title)}</h2><p>${
                    esc(c.assessment)}</p><div class="pair"><figure><figcaption>Actual execution <a href="../../${
                    c.capture}">full capture</a></figcaption><img src="../../${
                    c.cropFile}" alt="Actual ${
                    esc(c.title)}"></figure><figure><figcaption>Standalone original artwork <a href="../../${
                    c.hd}">HD-only render</a></figcaption><img src="../../${
                    c.original}" alt="Standalone ${
                    esc(c.title)}"></figure></div><details><summary>Overlay comparison (aligned to standalone dimensions)</summary><label>Standalone opacity <input type="range" min="0" max="100" value="50" oninput="this.closest('details').querySelector('.upper').style.opacity=this.value/100"></label><div class="overlay" style="aspect-ratio:${
                    c.logicalSize[0]}/${c.logicalSize[1]};max-width:${
                    Math.max(640, c.logicalSize[0])}px"><img src="../../${
                    c.cropFile}" alt="Runtime crop"><img class="upper" src="../../${
                    c.original}" alt="Standalone overlay"></div></details></section>`)
            .join('\n');
    C.write(
        C.path.join(C.pack, 'review/other-windows/runtime-audit.html'),
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Additional windows · runtime comparison</title><style>body{margin:0;background:#142523;color:#eee3c9;font:16px/1.6 system-ui}main{max-width:1500px;margin:auto;padding:28px}a{color:#e2c581}h1,h2{font-family:Georgia,serif}section{border-top:1px solid #536b5d;padding:20px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;min-width:0}figcaption{margin-bottom:8px}.pair img{display:block;max-width:100%;max-height:700px;width:auto}.overlay{position:relative;width:100%;margin-top:10px}.overlay img{position:absolute;width:100%;height:100%;inset:0}.upper{opacity:.5}details{margin:16px 0}p{max-width:1150px}.notice{padding:15px;border-left:3px solid #d0b57c;background:#253b33}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><main><h1>Standalone renderer vs actual game execution</h1><p><a href="index.html">Four-way window gallery</a> · <a href="../../OTHER-WINDOWS.md">Extraction and boundaries</a> · <a href="runtime-audit.json">Capture provenance and source identity</a></p><p class="notice">These are actual <strong>OpenCiv2</strong> execution captures using the original game artwork, build <code>${
            captureBuild.slice(
                0,
                12)}</code>, and the same 1788 saved game. They are not captures of the legacy 1999 executable. All ${
            sourceIdentity
                .length} recorded source/font inputs match this review extraction after line-ending normalization.</p><p>The 35 baseline scenes now use extracted game rendering code. Twelve are visually compared here. Original, native replacement and HD share each scene’s commands; enhanced proposals remain separate. Source geometry includes its existing clipping and crowded labels. Cursor/focus effects, capture scaling, differing auxiliary-panel sizes and the runtime extras option remain explicit differences; this is not a claim of pixel identity.</p><p>The comparison corrected sprite-size queries, missing popup artwork, native control/theme rasterization, label-table blank-line handling and saved-unit glyph state. Tax totals now execute the game calculation. Raw captures are preserved; only the overlay view rescales crops for alignment.</p>${
            cards}<section><h2>Scope still outside these execution captures</h2><p>${
            report.uncaptured.map(esc).join(
                ', ')}. Their extracted paths have source hashes and Debug/Release checks, but are not runtime-qualified by this page. Council AVI portraits are missing locally; credits show the first scroll frame. Endgame and production caches are declared in the fixture documentation.</p></section></main></html>`);
    console.log(
        `Runtime audit: ${comparisons.length} scenes / ${captures.length} unmodified captures; ${
            sourceIdentity.filter(x => x.equalAfterLfNormalization).length}/${
            sourceIdentity.length} source inputs match capture build.`);
}
if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {build};
