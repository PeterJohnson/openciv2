// Authored background plates for unchanged native window content geometry.
const C = require('./common.cjs');
const governments =
    [ 'anarchy', 'despotism', 'monarchy', 'communism', 'fundamentalism', 'republic', 'democracy' ];
const prefix = 'interface/native-backgrounds/';
const cityRegions = [
    [ 'citizens', 0, 0, 436, 61 ], [ 'resource-map', 0, 61, 436, 153 ], [ 'food', 436, 0, 200, 167 ],
    [ 'production', 436, 167, 200, 189 ], [ 'controls', 436, 356, 200, 65 ],
    [ 'supported-units', 0, 212, 192, 78 ], [ 'improvements', 0, 290, 192, 131 ],
    [ 'information', 192, 212, 244, 209 ]
];
const rect = (x, y, w, h, fill, extra = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

function frame(x, y, w, h) {
    return rect(x + .5, y + .5, w - 1, h - 1, 'none', 'stroke="#aa9568" stroke-width="1"') +
           `<path d="M${x + 2} ${y + h - 2}V${y + 2}H${
               x + w - 2}" fill="none" stroke="#d3c395" stroke-opacity=".42" stroke-width=".6"/>`;
}

const image = (file, w, h) =>
    `<image width="${w}" height="${h}" preserveAspectRatio="none" href="data:image/png;base64,${
        C.fs.readFileSync(C.path.join(C.pack, file)).toString('base64')}"/>`;
const defs = `<defs>
<linearGradient id="cloth" x2="0" y2="1"><stop stop-color="#35443a"/><stop offset="1" stop-color="#24362e"/></linearGradient>
<linearGradient id="food" x2="0" y2="1"><stop stop-color="#1b3527"/><stop offset="1" stop-color="#344d31"/></linearGradient>
<linearGradient id="production" x2="0" y2="1"><stop stop-color="#1e303c"/><stop offset="1" stop-color="#374c59"/></linearGradient>
<linearGradient id="plaque" x2="0" y2="1"><stop stop-color="#e2dbc3"/><stop offset="1" stop-color="#bab79e"/></linearGradient>
<pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 .5H6M0 3.5H6" stroke="#ebdcb3" stroke-width=".35" opacity=".06"/><path d="M1 0V6M4 0V6" stroke="#020e0b" stroke-width=".4" opacity=".10"/></pattern>
</defs>`;

function city() {
    let body = defs + rect(0, 0, 636, 421, '#1a2d29');
    body += rect(0, 0, 436, 61, 'url(#cloth)') + rect(0, 0, 436, 45, '#475449') +
            rect(0, 0, 436, 45, 'url(#grain)');
    // Header band stays below the source citizen rows, including crowded fixtures.
    body += rect(0, 45, 436, 16, '#25382f');
    body += rect(0, 61, 198, 151, '#1d342b') + rect(0, 61, 198, 151, 'url(#grain)');
    body += rect(198, 61, 238, 39, '#273b2b') + rect(198, 100, 238, 74, '#3a3526') +
            rect(198, 174, 238, 38, '#243744');
    body += rect(436, 0, 200, 167, 'url(#food)') + rect(436, 167, 200, 189, 'url(#production)');
    body += rect(0, 212, 192, 78, '#73796b') + rect(192, 212, 244, 209, '#73796b');
    body += rect(0, 212, 436, 21, '#2e4034');
    body += rect(0, 290, 192, 131, '#343e34') + rect(0, 287, 192, 18, '#26392e');
    for (let i = 0; i < 9; i++)
        body += rect(4, 305 + i * 12, 169, 12, i % 2 ? '#ffffff04' : '#00000008');
    body += rect(436, 356, 200, 65, '#2e3f3c') + rect(436, 356, 200, 65, 'url(#grain)');
    // Dividers occupy gaps between fixed source regions, not the dynamic bar/text spans.
    body +=
        `<path d="M198 61V212M198 100H436M198 174H436M0 211.5H436M191.5 212V421M0 287H192M435.5 0V421M436 166.5H636M436 355.5H636" fill="none" stroke="#b6a074" stroke-width=".75"/>`;
    body += frame(2, 63, 193, 147) + frame(1, 1, 634, 419);
    return {
        w : 636,
        h : 421,
        body,
        regions : cityRegions.map(([ id, x, y, width, height ]) => ({id, x, y, width, height})),
        inputs : []
    };
}

function diplomacy(government) {
    const source = `backgrounds/diplomacy-${government}-native.png`;
    let body = defs + image(source, 640, 480) + rect(0, 0, 640, 480, '#101e19', 'opacity=".18"');
    body += rect(201, 49, 239, 290, '#1c2b26', 'opacity=".92"') + frame(201, 49, 239, 290);
    body += rect(207, 55, 227, 278, 'url(#plaque)') + frame(207, 55, 227, 278);
    for (const x of [34, 474]) {
        body += rect(x, 118, 132, 211, '#23362f', 'opacity=".98"') + rect(x, 118, 132, 211, 'url(#grain)') +
                frame(x, 118, 132, 211);
        for (let row = 0; row < 6; row++) {
            const y = 128 + row * 31;
            body += rect(x + 8, y, 116, 32, '#655b41') + rect(x + 9, y + 1, 114, 30, 'url(#plaque)');
        }
    }
    return {
        w : 640,
        h : 480,
        body,
        inputs : [ source ],
        regions : [
            {id : 'leader', x : 208, y : 57, width : 225, height : 275},
            ...[45, 485].flatMap((x, column) => Array.from(
                                     {length : 6}, (_, row) => ({
                                                       id : `${column ? 'knowledge' : 'military'}-${row}`,
                                                       x,
                                                       y : 130 + row * 31,
                                                       width : 108,
                                                       height : 30
                                                   })))
        ]
    };
}

function spacecraft() {
    const source = 'backgrounds/space-yard-native.png';
    let body = defs + image(source, 640, 480);
    body += rect(0, 0, 640, 35, '#101e26', 'opacity=".93"');
    body += rect(3, 32, 224, 235, '#10212a', 'opacity=".94"') + frame(3, 32, 224, 235);
    body += rect(0, 449, 640, 31, '#10212a', 'opacity=".94"');
    body += `<path d="M0 34.5H640M0 449.5H640" stroke="#8d9a8d" stroke-width=".75" opacity=".8"/>`;
    return {
        w : 640,
        h : 480,
        body,
        inputs : [ source ],
        regions : [
            {id : 'title', x : 0, y : 0, width : 640, height : 40},
            {id : 'statistics', x : 10, y : 32, width : 212, height : 229},
            {id : 'ship-composite', x : 175, y : 99, width : 457, height : 304},
            {id : 'success', x : 0, y : 449, width : 640, height : 30}
        ]
    };
}

function file(mode, government = 0) {
    return prefix +
           (mode === 'city-window' ? 'city'
            : mode === 'diplomacy' ? 'diplomacy-' + governments[government]
                                   : 'spacecraft') +
           '.png';
}

async function build() {
    const plates = [
        [ 'city', city() ], ...governments.map(g => ['diplomacy-' + g, diplomacy(g)]),
        [ 'spacecraft', spacecraft() ]
    ];
    const entries = [], records = [];
    for (const [id, p] of plates) {
        const vector = prefix + id + '.svg', name = prefix + id + '.png', source = C.svg(p.w, p.h, p.body);
        C.write(C.path.join(C.pack, vector), source);
        const bytes = await C.sharp(Buffer.from(source), {density : 288}).png().toBuffer();
        C.write(C.path.join(C.pack, name), bytes);
        entries.push({
            id : 'native-backgrounds.' + id,
            label : id.replaceAll('-', ' ') + ' native background',
            kind : 'interface',
            category : 'window backgrounds',
            description :
                'Background-only subdivision aligned to source window rectangles; original and enhanced variants stay separate.',
            file : name,
            vector,
            width : p.w * 4,
            height : p.h * 4,
            sha256 : C.sha(bytes),
            sourceSha256 : C.sha(Buffer.from(source))
        });
        records.push({
            id,
            file : name,
            vector,
            logicalSize : [ p.w, p.h ],
            regions : p.regions,
            inputs :
                p.inputs.map(file => ({file, sha256 : C.sha(C.fs.readFileSync(C.path.join(C.pack, file)))}))
        });
        console.log('Native background:', id);
    }
    const manifest = C.read(C.path.join(C.pack, 'manifest.json'));
    manifest.entries = manifest.entries.filter(e => !e.id.startsWith('native-backgrounds.')).concat(entries);
    C.json(C.path.join(C.pack, 'manifest.json'), manifest);
    const coverage = C.read(C.path.join(C.pack, 'coverage.json'));
    for (const r of coverage.resources) {
        if (r.role === 'government audience room') {
            const preferred = file('diplomacy', r.source.id - 200);
            r.replacements = [ preferred, ...r.replacements.filter(p => p !== preferred) ];
        } else if (r.role === 'spaceship assembly background') {
            const preferred = file('spaceship');
            r.replacements = [ preferred, ...r.replacements.filter(p => p !== preferred) ];
        }
    }
    const cityRole = coverage.external.find(r => r.source === 'CITY.GIF');
    const cityFile = file('city-window');
    cityRole.replacements = [ cityFile, ...cityRole.replacements.filter(p => p !== cityFile) ];
    C.json(C.path.join(C.pack, 'coverage.json'), coverage);
    C.json(C.path.join(C.pack, prefix + 'layout.json'), {
        schemaVersion : 1,
        renderDensity : 4,
        sourceReferences : [
            'src/auto/city.cpp:11921-11948', 'src/auto/city.cpp:15133-15148',
            'src/auto/diplomacy.cpp:4629-4740', 'src/auto/diplomacy.cpp:4905-5010',
            'src/auto/spaceship.cpp:541-712'
        ],
        policy :
            'New vector panel geometry and unchanged Atlas painted backgrounds. No original-game pixels or decorative patterns used. Foreground coordinates, text colors and source commands are unchanged. No baked text.',
        plates : records
    });
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    file,
    build,
    cityRegions,
    governments
};
