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
        source :
            'tools/atlas-review/art.cjs; shoreline.cjs; riverbanks.cjs; map-finishing.cjs; bindings.cjs; render.cjs',
        coast : {
            sampling :
                'retained rounded macro contours plus six independent octaves of domain-warped fractal erosion',
            detail :
                'added after macro shaping; bounded reflection retains relief; compact intersection taper protects water connectivity',
            contour :
                'protected land corners and unchanged dry-land contour; compact symmetric shelf joins round deep-water cove tips without changing connectivity',
            detailFiltering :
                'native PNG resampling; enhanced detail fades in above 32 projected pixels; a conservative per-octave cutoff accounts for isometric foreshortening',
            cornerIdentity : 'pure land/water preserved',
            beach :
                'visible sand/rock beach, wider green-blue seaward shelf, patchy submerged sand and subdued foam',
            nativeCorners :
                'Smoothly protected forest/field footprint inside unchanged quarter diamonds; shared tile texture phase; no water overhang; dither 12 softly blends land into the existing grassy apron'
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
                'six-octave domain-warped bank relief, 257-point native outlines, subdued gravel and vegetation; fixed-width ports with 1.5px overlap',
            proposed :
                'periodic world-space width and fractal bank variation; filtered fine detail; wrapped segment neighborhoods; shared coastal-water blending'
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
