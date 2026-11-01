// Replacement-only unit banner artwork and sprite registration metadata.
const C = require('./common.cjs');

function source() {
    return C.svg(96, 160,
                 '<path d="M4 4H92V108L48 156L4 108Z" fill="#010607" stroke="#17201d" stroke-width="8"/>');
}

async function build() {
    C.write(C.path.join(C.pack, 'compatibility/shield.png'),
            await C.sharp(Buffer.from(source())).png().toBuffer());
    const bindings = C.read(C.path.join(C.pack, 'compatibility/bindings.json'));
    const overrides = [];
    // Naval artwork rises into the old upper-right anchor. Its upper-left corner
    // is clear without shrinking the vessel or changing gfx_draw_unit's order.
    for (let index = 32; index <= 43; index++) {
        const b = bindings.bindings['unit/' + index];
        overrides.push({
            index,
            anchor : [ 2, 0 ],
            file : b.file,
            sha256 : C.sha(C.fs.readFileSync(C.path.join(C.pack, b.file)))
        });
    }
    C.json(C.path.join(C.pack, 'map/unit-anchors.json'), {
        schemaVersion : 1,
        logicalFrame : [ 64, 48 ],
        bannerFrame : [ 12, 20 ],
        defaultAnchor : [ 48, 4 ],
        policy :
            'Art registration consumed by the unchanged source renderer in every replacement stage. Naval banners use transparent upper-left clearance. Original-sheet anchors remain separate; unit sprites and draw order are unchanged.',
        overrides
    });
    delete bindings.unitShieldAnchor;
    bindings.unitShieldAnchors = 'map/unit-anchors.json';
    C.json(C.path.join(C.pack, 'compatibility/bindings.json'), bindings);
    console.log('Built flat unit banner and 12 naval sprite anchors');
}

if (require.main === module)
    build().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
module.exports = {
    source,
    build
};
