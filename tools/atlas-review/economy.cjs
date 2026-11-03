// Semantic city economy sprites. All six roles share the painted catalog style.
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
const shapes = {};

async function build() {
    const entries = [];
    shapes.food = '<image width="64" height="64" href="data:image/png;base64,' +
                  C.fs.readFileSync(C.path.join(C.pack, file('food'))).toString('base64') + '"/>';
    // Reuse the exact catalog gem; the science master is a painted star-free edit.
    C.fs.copyFileSync(C.path.join(C.pack, 'sprites/ui/luxury.png'), C.path.join(C.pack, file('luxury')));
    const painted = {
        production : {
            label : 'Painted production shield',
            description :
                'Blue heater shield with a calm continuous blue-steel bevel and modeled painted face; clean rim highlights at small icon sizes',
            source : {
                method : 'built-in image_gen',
                record : 'authoring/economy-painted.json',
                role : 'production'
            }
        },
        trade : {
            label : 'Painted trade arrows',
            description :
                'Opposed gold and pale green exchange arrows with painted bevels; broad shafts and arrowheads remain readable at small sizes',
            source :
                {method : 'built-in image_gen', record : 'authoring/economy-painted.json', role : 'trade'}
        },
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
