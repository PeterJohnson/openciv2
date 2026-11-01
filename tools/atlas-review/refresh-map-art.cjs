// Rebuild the selected map library in place, using existing authored material textures.
const C = require('./common.cjs'), Finishing = require('./map-finishing.cjs');

async function main() {
    await C.art.loadMaterials(C.path.join(C.pack, 'map'));
    C.art.setVariations(false);
    const m = C.read(C.path.join(C.pack, 'manifest.json'));
    const texture = C.fs.readFileSync(C.path.join(C.pack, 'map/materials/road.png')).toString('base64');
    let count = 0, riversChanged = false;
    for (const e of m.entries) {
        let bytes;
        if (process.argv.includes('--coasts-only') && !e.id.startsWith('map.coast.'))
            continue;
        if (process.argv.includes('--rivers-only') && !e.id.startsWith('map.networks.river-'))
            continue;
        if (e.id.startsWith('map.networks.river-')) {
            const readTexture = name =>
                C.fs.readFileSync(C.path.join(C.pack, `map/materials/${name}.png`)).toString('base64');
            const source =
                C.art.river(e.mask, readTexture('ocean'), readTexture('sand'), readTexture('grassland'));
            C.write(C.path.join(C.pack, e.vector), source);
            e.sourceSha256 = C.sha(Buffer.from(source));
            bytes = await C.sharp(Buffer.from(source)).png().toBuffer();
        } else if (e.id.startsWith('map.networks.road-') || e.id.startsWith('map.networks.rail-')) {
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
        if (e.family === 'river') {
            C.write(C.path.join(C.pack, 'compatibility/river/' + e.mask + '.png'),
                    await C.sharp(bytes)
                        .extract({left : 32, top : 32, width : 512, height : 256})
                        .png()
                        .toBuffer());
            riversChanged = true;
        }
        if (++count % 64 === 0)
            console.log(count, 'map sprites updated');
    }
    if (riversChanged)
        for (let q = 0; q < 4; q++)
            C.write(C.path.join(C.pack, 'compatibility/mouth/' + q + '.png'),
                    await Finishing.mouth(q, C.fs.readFileSync(C.path.join(C.pack, 'compatibility/river/' +
                                                                                       (1 << q) + '.png'))));
    C.json(C.path.join(C.pack, 'manifest.json'), m);
    C.json(C.path.join(C.pack, 'map/readability.json'), {
        version : 1,
        source : 'tools/atlas-review/art.cjs; shoreline.cjs; map-finishing.cjs; bindings.cjs; render.cjs',
        coast : {
            sampling : 'rounded lobes with broad asymmetric coves, headlands and six scales of erosion',
            contour :
                'minimum rounded radius protects land corners; broader smooth inward joins soften lakes; radial relief retains connected land and ocean access',
            detailFiltering :
                'native PNG resampling; enhanced subpixel octaves fade with projected tile width',
            cornerIdentity : 'pure land/water preserved',
            beach : 'patchy exposed sand/rock, broad shallows and intermittent subdued foam',
            nativeCorners :
                'Smoothly protected forest/field footprint inside unchanged quarter diamonds; shared tile texture phase; no water overhang; dither 12 stays blank'
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
        river : {
            path : 'irregular cubic meanders, fixed connected endpoints and tangents',
            banks :
                'asymmetric eroded edges, wider width range, subdued gravel and vegetation; 1.5px authored port overlap',
            proposed :
                'world-space width and bank variation, extended sampling bounds, shoreline water blending'
        },
        resources : {
            frame : [ 512, 256 ],
            anchor : [ 256, 128 ],
            oceanFill : .72,
            landFill : .58,
            terrainProduction : {
                file : 'map/markers/grassland-production.png',
                fill : .34,
                palette : 'muted olive/bronze; city production remains blue'
            }
        },
        badges : {
            nativeFrame : [ 12, 20 ],
            proposedScale : 1.35,
            stack : 'flat faction face; native repeated shields; proposal adds separation and + marker',
            unitAndCityFrames : 'unchanged'
        }
    });
    console.log('Updated', count, 'canonical map sprites');
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
