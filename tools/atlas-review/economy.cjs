// Semantic city economy sprites. Painted food, gold, science and luxury share the catalog style.
const C = require('./common.cjs');
const roles = [ 'food', 'production', 'trade', 'gold', 'luxury', 'science' ];
const nativeRoles = {
    1 : 'food',
    2 : 'production',
    3 : 'gold',
    11 : 'food',
    12 : 'production',
    13 : 'trade'
};
const file = role => role === 'food' ? 'sprites/resources/wheat.png' : `interface/economy/${role}.png`;
// City tile-index order, from the native direction table. Supplied yields, not a simulation.
const yieldFixture =
    Array
        .from({length : 21},
              (_, i) => {
                  const amounts = [
                      [ 2, 1, 1 ], [ 1, 2, 0 ], [ 2, 0, 2 ], [ 3, 0, 0 ], [ 1, 2, 1 ], [ 2, 1, 0 ],
                      [ 1, 0, 2 ]
                  ];
                  return [ i < 8 || i === 20 ? 1 : 0, ...amounts[i % amounts.length] ].join(' ');
              })
        .join('\n') +
    '\n';
const shapes = {
    production :
        '<path d="M10 8L32 4L54 8V31Q52 48 32 60Q12 48 10 31Z" fill="#699dbb" stroke="#192f43" stroke-width="5"/><path d="M17 14L32 11L47 14V30Q45 42 32 51Q19 42 17 30Z" fill="#88bed7"/><path d="M32 12V51Q45 42 47 30V14Z" fill="#527f9e"/>',
    trade :
        '<path d="M5 14H40V5L59 23L40 40V31H5Z" fill="#e5be64" stroke="#473a27" stroke-width="3"/><path d="M59 50H24V59L5 41L24 24V33H59Z" fill="#98c3b6" stroke="#253e39" stroke-width="3"/>'
};

async function build() {
    const entries = [];
    shapes.food = '<image width="64" height="64" href="data:image/png;base64,' +
                  C.fs.readFileSync(C.path.join(C.pack, file('food'))).toString('base64') + '"/>';
    // Reuse the exact catalog gem; the science master is a painted star-free edit.
    C.fs.copyFileSync(C.path.join(C.pack, 'sprites/ui/luxury.png'), C.path.join(C.pack, file('luxury')));
    const painted = {
        gold : {
            label : 'Antique gold coin',
            description :
                'Painted hand-struck gold coin with an invented laurel-crowned profile and beaded rim; tax and improvement sale/upkeep symbol',
            source : {method : 'built-in image_gen', record : 'authoring/economy-gold.json'}
        },
        luxury : {
            label : 'Painted luxury gemstone',
            description : 'Faceted blue gemstone reused from the selected luxury UI catalog artwork',
            source : {
                method : 'catalog artwork reuse',
                file : 'sprites/ui/luxury.png',
                record : 'authoring/economy-painted.json'
            }
        },
        science : {
            label : 'Painted science flask',
            description :
                'Open glass laboratory flask with teal liquid, painted to match the science UI catalog artwork; no star or stopper',
            source : {method : 'built-in image_gen', record : 'authoring/economy-painted.json'}
        }
    };
    for (const [role, metadata] of Object.entries(painted)) {
        const bytes = C.fs.readFileSync(C.path.join(C.pack, file(role)));
        const info = await C.sharp(bytes).metadata();
        shapes[role] =
            '<image width="64" height="64" href="data:image/png;base64,' + bytes.toString('base64') + '"/>';
        entries.push({
            id : `economy.${role}`,
            ...metadata,
            category : 'economy symbols',
            kind : 'interface',
            file : file(role),
            width : info.width,
            height : info.height,
            sha256 : C.sha(bytes)
        });
    }
    for (const role of ['production', 'trade']) {
        const source = C.svg(64, 64, shapes[role]);
        const vector = `interface/economy/${role}.svg`,
              b = await C.sharp(Buffer.from(source)).resize(256, 256).png().toBuffer();
        C.write(C.path.join(C.pack, vector), source);
        C.write(C.path.join(C.pack, file(role)), b);
        entries.push({
            id : `economy.${role}`,
            label : role,
            description : `City economy ${role} symbol; also used at native 10/14 logical pixels`,
            category : 'economy symbols',
            kind : 'interface',
            file : file(role),
            vector,
            width : 256,
            height : 256,
            sha256 : C.sha(b),
            sourceSha256 : C.sha(Buffer.from(source))
        });
    }
    const m = C.read(C.path.join(C.pack, 'manifest.json'));
    const replacements = new Map(entries.map(e => [e.id, e]));
    m.entries = m.entries.map(e => replacements.get(e.id) || e);
    for (const e of entries)
        if (!m.entries.some(existing => existing.id === e.id))
            m.entries.push(e);
    C.json(C.path.join(C.pack, 'manifest.json'), m);
    C.json(C.path.join(C.pack, 'interface/economy/bindings.json'), {
        roles,
        nativeRoles,
        files : Object.fromEntries(roles.map(role => [role, file(role)])),
        source : 'src/auto/graphics.cpp:854–895; src/auto/city.cpp:12599–12699,12821–13419,14186',
        yieldFixture :
            'Supplied worked flags and food/shield/trade values; placement and overlap execute unchanged draw_resource_yields.'
    });
    // Review at native icon sizes and at HD density, not only enlarged master art.
    const body =
        roles
            .map(
                (r, i) => `<text x="${i * 150 + 8}" y="22" fill="#ead6aa" font-size="16">${r}</text><svg x="${
                    i * 150 +
                    10}" y="36" width="64" height="64" viewBox="0 0 64 64">${shapes[r]}</svg><svg x="${
                    i * 150 +
                    12}" y="122" width="14" height="14" viewBox="0 0 64 64">${shapes[r]}</svg><svg x="${
                    i * 150 +
                    50}" y="122" width="10" height="10" viewBox="0 0 64 64">${shapes[r]}</svg><svg x="${
                    i * 150 + 90}" y="116" width="28" height="28" viewBox="0 0 64 64">${shapes[r]}</svg>`)
            .join('');
    C.write(
        C.path.join(C.pack, 'review/economy-symbols.png'),
        await C.sharp(Buffer.from(C.svg(900, 160, '<rect width="900" height="160" fill="#20362d"/>' + body)))
            .png()
            .toBuffer());
}

module.exports = {
    build,
    roles,
    nativeRoles,
    file,
    yieldFixture
};
