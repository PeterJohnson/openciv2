// Rebuild the selected map library in place, using existing authored material textures.
const C = require('./common.cjs');

async function main() {
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    C.art.setVariations(false);
    const m = C.read(C.path.join(C.pack, 'manifest.json'));
    const texture = C.fs.readFileSync(C.path.join(C.pack, 'map/materials/road.png')).toString('base64');
    let count = 0;
    for (const e of m.entries) {
        let bytes;
        if (e.id.startsWith('map.networks.road-') || e.id.startsWith('map.networks.rail-')) {
            const source = C.art.infrastructure(e.family, e.mask, texture);
            C.write(C.path.join(C.pack, e.vector), source);
            e.sourceSha256 = C.sha(Buffer.from(source));
            bytes = await C.sharp(Buffer.from(source)).png().toBuffer();
        } else if (e.id.startsWith('map.coast.') && !process.argv.includes('--networks-only')) {
            const corners = Array.from(
                {length : 4}, (_, i) => ({land : e.cornerMask & (1 << i) ? 1 : 0, material : e.terrain}));
            bytes = (await C.art.ground({
                        cols : 1,
                        rows : 1,
                        vertices : [ [ corners[0], corners[1] ], [ corners[3], corners[2] ] ],
                        tileWidth : 512,
                        shore : e.shore,
                        origin : e.texturePhase
                    })).bytes;
        } else
            continue;
        C.write(C.path.join(C.pack, e.file), bytes);
        e.sha256 = C.sha(bytes);
        if (++count % 64 === 0)
            console.log(count, 'map sprites updated');
    }
    C.json(C.path.join(C.pack, 'manifest.json'), m);
    C.json(C.path.join(C.pack, 'map/readability.json'), {
        version : 1,
        source : 'tools/atlas-review/art.cjs; bindings.cjs; render.cjs',
        coast : {
            sampling : 'smooth land weights; fixed world-space erosion at three scales',
            cornerIdentity : 'pure land/water preserved',
            beach : 'variable narrow sand/rock edge; broken subdued foam'
        },
        road : {
            color : 'warm ochre',
            path : 'winding half-arms with fixed endpoints and tangents',
            isolation : 'short rounded winding track'
        },
        rail : {
            color : 'cool dark ballast with light steel and transverse sleepers',
            path : 'straight approaches; continuous through routes with short junction bends',
            nativeArms : 'flush center cuts; no false dead-end caps',
            proposedPasses : [ 'bed', 'sleepers', 'metal' ]
        },
        resources : {frame : [ 512, 256 ], anchor : [ 256, 128 ], oceanFill : .72, landFill : .58},
        badges : {
            nativeFrame : [ 12, 20 ],
            proposedScale : 1.35,
            stack : 'native repeated shields; proposal adds separation and + marker',
            unitAndCityFrames : 'unchanged'
        }
    });
    console.log('Updated', count, 'canonical map sprites');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
