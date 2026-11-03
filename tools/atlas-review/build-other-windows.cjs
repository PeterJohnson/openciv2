const C = require('./common.cjs');
const Reports = require('./report-render.cjs'), Other = require('./native-other.cjs');
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

async function build() {
    if (!process.argv.includes('--gallery-only')) {
        await Reports.build(true);
        await Other.build();
    }
    const scenes = [ 'report', 'native' ].flatMap(
        kind => C.read(C.path.join(C.pack, `review/other-windows/${kind}-scenes.json`)));
    C.json(C.path.join(C.pack, 'review/other-windows/scenes.json'), scenes);
    const labels = {
        original : 'Original game artwork',
        current : 'Replacement at native resolution',
        hd : 'HD only',
        proposed : 'HD + additional cohesion'
    };
    const body =
        scenes
            .map(s => `<section id="${s.id}"><h2><a href="../../index.html#${s.id}">${
                     esc(s.title)}</a></h2><p>${esc(s.note)}</p><div class="grid">${
                     Object.entries(labels)
                         .map(([ mode, title ]) => `<figure><figcaption>${title}</figcaption><a href="../../${
                                  s[mode]}"><img loading="lazy" src="../../${s[mode]}" alt="${
                                  esc(s.title)} â€” ${title}"></a></figure>`)
                         .join('')}</div></section>`)
            .join('\n');
    C.write(
        C.path.join(C.pack, 'review/other-windows/index.html'),
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas HD Â· additional game windows</title><style>body{margin:0;background:#142523;color:#e9e0c5;font:16px/1.55 system-ui,sans-serif}main{max-width:1800px;margin:auto;padding:30px}h1,h2{font-family:Georgia,serif}h1{font-size:42px}a{color:#e0c584}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}section{padding:20px 0;border-top:1px solid #4c6557}figure{margin:0;background:#253c35;border:1px solid #4c6557}figcaption{padding:10px;font-size:14px}img{display:block;width:100%;height:auto}p{max-width:1100px}.note{border-left:3px solid #d2b678;padding:15px;background:#253c35}@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.grid{grid-template-columns:1fr}}</style><main><h1>Additional game windows</h1><p>35 scenes, each in all four comparison stages. <a href="../../index.html">Main gallery</a> Â· <a href="../../OTHER-WINDOWS.md">Source coverage, rebuild instructions and fidelity boundaries</a></p><p class="note">All baseline scenes execute extracted C++ rendering functions from this repository. Original, native replacement and HD share the source geometry. Enhanced proposals remain separate. <a href="runtime-audit.html">Compare with actual game execution captures</a> · <a href="report-refinements.html">Report refinements</a> · <a href="content-refinements.html">Enhanced window content and controls</a>. Council video portraits are unavailable in the local original installation, so that original-art panel shows empty media slots. The replacement library uses independent artwork.</p>${
            body}</main></html>`);
    require('./build-gallery.cjs');
    console.log(`Integrated ${scenes.length} additional windows / ${scenes.length * 4} renders`);
}

module.exports = {build};
if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
