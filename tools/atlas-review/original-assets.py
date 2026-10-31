"""Build ignored, local-only original-art bindings from an installed Civ II copy.
No DLL is loaded or executed. Crop geometry comes from src/auto/graphics.cpp,
city.cpp/unit.cpp registration scans, and the unchanged native renderer traces.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / 'assets/atlas-hd'
OUT = PACK / 'review/original-local'


def resources(path):
    """Read PE resource bytes; never load the module as executable code."""
    data = path.read_bytes()
    def unpack(fmt, at):
        size = struct.calcsize(fmt)
        if at < 0 or at + size > len(data):
            raise ValueError(f'Invalid PE range: {path.name}')
        return struct.unpack_from(fmt, data, at)
    u16 = lambda at: unpack('<H', at)[0]
    u32 = lambda at: unpack('<I', at)[0]
    pe = u32(60)
    if data[:2] != b'MZ' or data[pe:pe+4] != b'PE\0\0':
        raise ValueError('Expected PE file')
    opt = pe + 24
    sects = opt + u16(pe + 20)
    def offset(rva):
        for i in range(u16(pe + 6)):
            vsize, va, size, raw = unpack('<IIII', sects + i * 40 + 8)
            if va <= rva < va + max(size, vsize):
                return raw + rva - va
        raise ValueError('Invalid resource RVA')
    base = offset(u32(opt + (96 if u16(opt) == 267 else 112) + 16))
    def walk(rel, ids=()):
        if len(ids) > 3:
            raise ValueError('Invalid resource tree')
        p = base + rel
        for i in range(u16(p + 12) + u16(p + 14)):
            name, child = unpack('<II', p + 16 + i * 8)
            if name & 0x80000000:
                q = base + (name & 0x7fffffff)
                name = data[q+2:q+2+u16(q)*2].decode('utf-16le')
            key = ids + (name,)
            if child & 0x80000000:
                yield from walk(child & 0x7fffffff, key)
            else:
                rva, size = unpack('<II', base + child)
                at = offset(rva)
                if at + size > len(data):
                    raise ValueError('Truncated resource')
                yield key, data[at:at+size]
    yield from walk(0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', default=os.environ.get('CIV2_GAME'))
    args = parser.parse_args()
    if not args.game:
        parser.error('Supply --game PATH or CIV2_GAME for your installed original game')
    game = Path(args.game).resolve()
    OUT.mkdir(parents=True, exist_ok=True)
    images, source_hashes, bindings = {}, {}, {}
    for name in ['TERRAIN1.GIF', 'TERRAIN2.GIF', 'UNITS.GIF', 'CITIES.GIF', 'ICONS.GIF', 'PEOPLE.GIF', 'CITY.GIF', 'cv.dll', 'pv.dll', 'mk.dll', 'ss.dll']:
        path = game / name
        source_hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        if name.endswith('.GIF'):
            images[name] = Image.open(path).copy()
        else:
            for key, data in resources(path):
                if key[0] == 'GIFS' and data.startswith(b'GIF'):
                    images[f'{name}/{key[1]}'] = Image.open(io.BytesIO(data)).copy()
    def save(name, im, source, rect=None, transparent=True):
        if rect:
            x, y, w, h = rect
            if min(x, y) < 0 or min(w, h) <= 0 or x+w > im.width or y+h > im.height:
                raise ValueError(f'Crop outside {source}: {rect}, {im.size}')
            im = im.crop((x, y, x+w, y+h))
        rgba = im.convert('RGBA')
        if transparent:
            if im.mode != 'P':
                raise ValueError(f'Expected indexed original: {source}')
            # GIF decoder adds 10 with byte wrapping: raw 253/255 become keys 7/9.
            rgba.putalpha(Image.frombytes('L', im.size, bytes(0 if i in (253, 255) else 255 for i in im.tobytes())))
        file = OUT / 'bindings' / (name + '.png')
        file.parent.mkdir(parents=True, exist_ok=True)
        rgba.save(file)
        bindings[name] = dict(file=file.relative_to(PACK).as_posix(), nativeWidth=im.width, nativeHeight=im.height, source=source, rect=rect, sha256=hashlib.sha256(file.read_bytes()).hexdigest())
    def crop(name, source, x, y, w=64, h=32, transparent=True):
        save(name, images[source], source, [x,y,w,h], transparent)
    t1, t2 = 'TERRAIN1.GIF', 'TERRAIN2.GIF'
    for t in range(11):
        crop(f'terrain/{t}', t1, 1, 1+33*t)
        for special in range(2):
            crop(f'resource/{t*2+special}', t1, 131+65*special, 1+33*t)
    for name,y in [('irrigation',100),('farmland',133),('mine',166),('pollution',199),('village',265)]:
        crop('improvement/'+name,t1,456,y)
    crop('resource/shield',t1,456,232)
    crop('fog/full',t1,131,447)
    for i in range(9):
        crop(f'road/{i}',t1,1+65*i,364)
        crop(f'rail/{i}',t1,1+65*i,397)
    mask = images[t1].crop((1,447,65,479))
    for t in range(13):
        rect = (1,1+33*t,65,33+33*t) if t<11 else (131 if t==11 else 196,447,195 if t==11 else 260,479)
        im = images[t1].crop(rect)
        # Alternate-key draw: raw 0 (runtime 10) leaves the base; other mask
        # pixels replace it, including transparent pixels. Preserve indexed output.
        im.putdata([base if m==0 else (253 if m==255 else m) for base,m in zip(im.tobytes(),mask.tobytes())])
        for q,(x,y) in enumerate([(32,0),(32,16),(0,16),(0,0)]):
            save(f'dither/{t}/{q}',im,t1,[x,y,32,16])
            if t==11: save(f'fog/{q}',im,t1,[x,y,32,16])
    for i in range(16):
        for name,dy in [('river',0),('feature/forest',66),('feature/mountains',132),('feature/hills',198)]:
            crop(f'{name}/{i}',t2,1+65*(i%8),67+33*(i//8)+dy)
    for q in range(4):
        crop(f'mouth/{q}',t2,1+65*q,331)
        for m in range(8):
            dx,dy=[(0,0),(33,34),(0,17),(0,34)][q]
            crop(f'coast/{q}/{m}',t2,1+66*m+dx,429+dy,32,16)
    anchors=[]
    def scan(im,x,y,w,h,index,xoffset=0,yoffset=0):
        xs=[i+xoffset for i in range(w) if im.getpixel((x+i,y-1))==index]
        ys=[i+yoffset for i in range(h) if im.getpixel((x-1,y+i))==index]
        return [xs[-1] if xs else 0,ys[-1] if ys else 0]
    for i in range(63):
        x,y=1+65*(i%9),1+49*(i//9)
        crop(f'unit/{i}','UNITS.GIF',x,y,64,48)
        anchors.append(scan(images['UNITS.GIF'],x,y,64,48,250))
    crop('shield','UNITS.GIF',586,1,12,20)
    for style in range(6):
        for size in range(4):
            for wall in range(2):
                x,y=(334 if wall else 1)+65*size,39+49*style
                crop(f'city/{style*8+size*2+wall}','CITIES.GIF',x,y,64,48)
                anchors.append(scan(images['CITIES.GIF'],x,y,64,48,250,-1,-15)+scan(images['CITIES.GIF'],x,y,64,48,249))
    for i in range(8):
        x=1+15*i
        crop(f'flag/{i}','CITIES.GIF',x,425,14,22)
        crop(f'flag/{i}/dark','CITIES.GIF',x,448,14,22)
        anchors.append([(images['CITIES.GIF'].getpixel((x+dx,429))+10)%256 for dx in (3,6)])
    for name,x in [('fortified',143),('fortress',208),('airbase',273),('airbase-occupied',338)]:
        crop('improvement/'+name,'CITIES.GIF',x,423,64,48)
    crop('grid','ICONS.GIF',199,289)
    crop('grid/radius','ICONS.GIF',248,430)
    crop('improvement/disorder','ICONS.GIF',166,223,30,30)
    for role,x,y in [('food',1,305),('production',16,305),('trade',31,305),('gold',16,320),('luxury',1,320),('science',31,320)]:
        crop('economy/'+role,'ICONS.GIF',x,y,14,14)
    for id,role in [(1,'food'),(2,'production'),(3,'gold')]: bindings[f'icon/{id}']=bindings['economy/'+role]
    for id in range(11,15): crop(f'icon/{id}','ICONS.GIF',49+11*(id-11),334,10,10)
    for i in range(44): crop(f'icon/{100+i}','PEOPLE.GIF',2+28*(i%11),6+31*(i//11),27,30)
    for i in range(38): crop(f'icon/{201+i}','ICONS.GIF',343+37*(i%8),1+21*(i//8),36,20)
    crop('city-background','CITY.GIF',0,0,636,421,False)
    save('ship-background',images['ss.dll/499'],'ss.dll/499',transparent=False)
    crop('panel-texture','ICONS.GIF',298,190,32,32,False)
    for i in range(4):
        for size,xstep,y,h,w in [('large',159,1,114,158),('small',124,346,82,123)]:
            crop(f'lot/{size}/{i}','cv.dll/310',1+xstep*i,y,w,h)
            crop(f'house/{size}/{i}','cv.dll/310',1+xstep*i,231 if size=='large' else 512,w,h)
    # Actual native sprite crop rectangles and original registration points.
    (OUT/'anchors.txt').write_text('\n'.join(' '.join(map(str,a)) for a in anchors)+'\n')
    scenes=json.loads((PACK/'review/scenes.json').read_text(encoding='utf-8'))
    for s in scenes:
        if s['mode']=='plate':
            fixtures=[(f'transport-{r}-{c}','map',f'review/fixtures/transport-{r}-{c}.txt') for r in range(2) for c in range(5)]
        elif not s.get('windowEngine'):
            fixtures=[(s['id'],s['mode'],s['fixture'])]
        else: fixtures=[]
        for id,mode,file in fixtures:
            args=[str(ROOT/'build/atlas-review/Release/atlas-engine.exe'),mode,str(PACK/file),str(OUT/'anchors.txt')]
            result=subprocess.run(args,check=True,capture_output=True,text=True)
            trace=json.loads(result.stdout)
            tracefile=OUT/'traces'/f'{id}.json';tracefile.parent.mkdir(exist_ok=True)
            tracefile.write_text(json.dumps(trace,indent=2)+'\n')
            for name,(resource,x,y,w,h) in trace['sourceCrops'].items():
                crop(name,f'{"cv" if mode=="city" else "pv"}.dll/{resource}',x,y,w,h)
            if trace['originalBackground']:
                resource=trace['originalBackground'];source=f'{"cv" if mode=="city" else "pv"}.dll/{resource}'
                save(f'background/{id}',images[source],source,transparent=False)
        if s.get('windowEngine'):
            trace=json.loads((PACK/f'review/traces/{s["id"]}.json').read_text(encoding='utf-8'))
            dll='mk' if s['mode']=='diplomacy' else 'ss'
            if s['mode']=='diplomacy':
                bgid=next(c['resource'] for c in trace['commands'] if c['asset']=='background')
                portrait=next(c['resource'] for c in trace['commands'] if c['asset']=='resource' and 220<=c['resource']<=261)
                palette=images[f'mk.dll/{bgid}'].getpalette()[:]
                palette[:32*3]=images['TERRAIN1.GIF'].getpalette()[:32*3]
                portraitpal=images[f'mk.dll/{portrait}'].getpalette()
                palette[32*3:96*3]=portraitpal[32*3:96*3]
                # init_main_art remaps runtime index 145 (GIF 135) to leader civ's primary.
                citiespal=images['CITIES.GIF'].getpalette()
                civindex=images['CITIES.GIF'].getpixel((1+15*2+3,429))
                palette[135*3:136*3]=citiespal[civindex*3:(civindex+1)*3]
                for key in [f'mk.dll/{bgid}',f'mk.dll/{portrait}','mk.dll/215']:
                    images[key].putpalette(palette)

            for i,c in enumerate(trace['commands']):
                if c['asset']=='background':
                    source=f'{dll}.dll/{c["resource"]}'
                    save(f'background/{s["id"]}',images[source],source,transparent=False)
                if c['asset']=='resource' and c['resource']>0:
                    crop(f'window/{s["id"]}/{i}',f'{dll}.dll/{c["resource"]}',c['sx'],c['sy'],c['width'],c['height'])
    palette=images['TERRAIN1.GIF'].getpalette()
    # Runtime pixel = (GIF index + 10) mod 256, including shield placeholders 261/262.
    colors={str((i+10)%256):'#'+''.join(f'{v:02x}' for v in palette[3*i:3*i+3]) for i in range(256)}
    # Shield placeholders are special low palette slots from the unit sheet.
    unitpal=images['UNITS.GIF'].getpalette()
    for i in (251,252): colors[str((i+10)%256)]='#'+''.join(f'{v:02x}' for v in unitpal[3*i:3*i+3])
    result=dict(description='Local original-game pixel derivatives; excluded from redistribution',sources=source_hashes,bindings=bindings,palette=colors)
    (OUT/'bindings.json').write_text(json.dumps(result,indent=2)+'\n')
    for name,digest in source_hashes.items():
        if hashlib.sha256((game/name).read_bytes()).hexdigest()!=digest: raise ValueError('Source changed')
    print(f'{len(bindings)} local original bindings; {len(source_hashes)} source inputs unchanged')

if __name__=='__main__':
    main()
