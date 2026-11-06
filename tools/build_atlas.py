#!/usr/bin/env python3
"""Build the game's self-contained Atlas pack, exclusively from replacement art.

PNG pixels retain alpha and native resolution. Indexed proxy sheets exist only
for the old color queries and sprite editor; they are never the HD draw source.
The crop contracts below follow graphics.cpp, not the review's fixture state.
Requires Pillow to rebuild; playing and compiling a prepared pack do not.
"""
import ast
import hashlib
import io
import json
import math
import re
import struct
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'assets/atlas-hd'
OUT = ROOT / 'build/data/atlas-hd.pack'
INPUTS = set()


def faction_color(im, target):
    """Recolor the red cloth of the authored flag/badge, preserving trim/ink.

    Recover the cloth's coverage in antialiased blends with the two fixed
    colors. This operates on replacement art only, before any resizing.
    """
    cloth = (164, 66, 50)
    fixed = ((221, 195, 139), (21, 46, 51))
    pixels = []
    for *rgb, alpha in im.getdata():
        best, weight = float('inf'), 0
        for other in fixed:
            v = [a-b for a, b in zip(cloth, other)]
            t = max(0, min(1, sum((a-b)*c for a, b, c in zip(rgb, other, v)) / sum(c*c for c in v)))
            error = sum((a-b-t*c)**2 for a, b, c in zip(rgb, other, v))
            if error < best:
                best, weight = error, t
        if best <= 12:
            rgb = [max(0, min(255, round(a+weight*(b-c)))) for a, b, c in zip(rgb, target, cloth)]
        pixels.append((*rgb, alpha))
    out = Image.new('RGBA', im.size)
    out.putdata(pixels)
    return out


def occupied_airbase(im, color):
    """Owner-colored aircraft over the existing replacement runway."""
    out = im.copy()
    d = ImageDraw.Draw(out)
    sx, sy = im.width/64, im.height/48
    plane = [(32,22),(34,29),(43,34),(43,36),(34,33),(34,38),
             (37,40),(37,41),(32,39),(27,41),(27,40),(30,38),
             (30,33),(21,36),(21,34),(30,29)]
    d.polygon([(round(x*sx), round(y*sy)) for x, y in plane], fill=tuple(color)+(255,))
    d.line([(round(x*sx), round(y*sy)) for x, y in plane+[plane[0]]],
           fill=(30,41,39,255), width=max(1,round(sx*.5)))
    return out


def read(name):
    INPUTS.add(str(name).replace('\\','/'))
    return json.loads((ART / name).read_text(encoding='utf-8'))


def build():
    entries = {}
    sheets = {}
    coverage = read('coverage.json')
    manifest = read('manifest.json')
    catalog = manifest['entries'] if isinstance(manifest, dict) else manifest
    bindings = read('compatibility/bindings.json')['bindings']
    # Authored semantic colors: never copied from the game's palettes.
    colors = [(r, g, b) for r in (0, 51, 102, 153, 204, 255)
              for g in (0, 51, 102, 153, 204, 255) for b in (0, 51, 102, 153, 204, 255)]
    colors += [(i, i, i) for i in range(0, 256, 7)]
    colors = (colors + [(0, 0, 0)] * 256)[:256]
    semantic = {7: '#ff00ff', 8: '#bca46c', 9: '#ff00ff', 10: '#000000',
                11: '#e52d25', 15: '#15201f', 16: '#263934', 18: '#31483c', 19: '#312f2b',
                23: '#929592', 106: '#d95145', 122: '#e7c353',
                26: '#f4eee1', 29: '#ffffff', 33: '#2b4544', 35: '#d7c6a1',
                37: '#372e42', 41: '#e4dba0', 42: '#83ad46', 44: '#a7ca60',
                45: '#496a27', 46: '#a7ce6b', 48: '#71973b', 57: '#373426',
                84: '#8aadc4', 92: '#90bdcd', 94: '#b6cadd', 98: '#4b3430',
                118: '#d9bb5e', 121: '#b09b53', 124: '#d4c084',
                249: '#81aeb2', 250: '#a8d3c1', 251: '#daba62', 254: '#dcebd2'}
    faction = ['#c73e3e', '#eee4bf', '#76b470', '#6997c9', '#e7c353', '#80c5c5', '#d49361', '#b98fc4']
    for i, c in enumerate(faction):
        semantic[208+i*3] = c
        semantic[209+i*3] = c
        semantic[210+i*3] = c
    for i, c in semantic.items():
        colors[i] = tuple(bytes.fromhex(c[1:]))
    palette = bytes(v for color in colors for v in color)
    pal = Image.new('P', (1, 1)); pal.putpalette(palette)

    def rgba(file):
        INPUTS.add(str(file).replace('\\','/'))
        return Image.open(ART / file).convert('RGBA')

    def fit(file, w, h, contain=True, density=4):
        im = rgba(file) if isinstance(file, str) else file.copy()
        size = (max(1, w*density), max(1, h*density))
        if not contain:
            return im.resize(size, Image.Resampling.LANCZOS)
        box = im.getbbox()
        if box:
            im = im.crop(box)
        im.thumbnail(size, Image.Resampling.LANCZOS)
        out = Image.new('RGBA', size)
        out.alpha_composite(im, ((size[0]-im.width)//2, (size[1]-im.height)//2))
        return out

    def add(key, im, w=None, h=None, indexed=False):
        w, h = (w or im.width), (h or im.height)
        entries[key] = [im, w, h, indexed]

    def sheet(key, w=640, h=480):
        im = Image.new('RGBA', (w, h))
        sheets[key] = im
        return im

    def crop(key, x, y, w, h, file, contain=True):
        if isinstance(file, str) and file in bindings:
            file = bindings[file]['file']
            contain = False
        im = fit(file, w, h, contain)
        add(f'crop/{key}/{x},{y},{w},{h}', im, w, h)
        if key in sheets:
            sheets[key].paste(im.resize((w, h), Image.Resampling.LANCZOS), (x, y))

    def kind(name, index):
        return next(e['file'] for e in catalog if (e.get('mapping') or {}).get('kind') == name
                    and e['mapping'].get('index') == index)

    # Map: the original tile/quarter/arm composition. No enhanced map sampler,
    # connection-mask compositor, extra overlay passes or LOD substitutions.
    t1, t2 = 'file/terrain1', 'file/terrain2'
    sheet(t1); sheet(t2)
    for t in range(11):
        crop(t1, 1, 1+33*t, 64, 32, f'terrain/{t}')
        for special in range(2):
            crop(t1, 131+65*special, 1+33*t, 64, 32, f'resource/{t*2+special}')
    for name, y in [('irrigation',100), ('farmland',133), ('mine',166), ('pollution',199), ('village',265)]:
        crop(t1,456,y,64,32,'improvement/'+name)
    crop(t1,456,232,64,32,'resource/shield')
    crop(t1,131,447,64,32,'fog/full')
    crop(t1,1,447,64,32,'interface/masks/tile.png')
    crop(t1,66,447,64,32,'interface/masks/tile.png')
    crop(t1,261,447,64,32,'interface/masks/tile.png')
    crop(t1,196,447,64,32,'interface/masks/blank.png')
    for i in range(9):
        crop(t1,1+65*i,364,64,32,f'road/{i}')
        crop(t1,1+65*i,397,64,32,f'rail/{i}')
    for i in range(16):
        for name, dy in [('river',0),('feature/forest',66),('feature/mountains',132),('feature/hills',198)]:
            crop(t2,1+65*(i%8),67+33*(i//8)+dy,64,32,f'{name}/{i}')
    for q in range(4):
        crop(t2,1+65*q,331,64,32,f'mouth/{q}')
        for m in range(8):
            dx,dy=[(0,0),(33,34),(0,17),(0,34)][q]
            crop(t2,1+66*m+dx,429+dy,32,16,f'coast/{q}/{m}')
    for key, b in bindings.items():
        add(key, rgba(b['file']), b['nativeWidth'], b['nativeHeight'])

    sheet('file/units'); sheet('file/cities')
    for i in range(63):
        crop('file/units',1+65*(i%9),1+49*(i//9),64,48,f'unit/{i}')
    crop('file/units',586,1,12,20,'shield')
    for i in range(48):
        crop('file/cities', (334 if i%2 else 1)+65*((i%8)//2),39+49*(i//8),64,48,f'city/{i}')
    for i in range(8):
        for y in [425,448]:
            crop('file/cities',1+15*i,y,14,22,f'interface/factions/flag-{i}.png')
    for name,x in [('fortified',143),('fortress',208),('airbase',273),('airbase-occupied',338)]:
        crop('file/cities',x,423,64,48,'improvement/'+name)

    # The legacy palette markers are absent from RGBA art. Supply selective
    # variants keyed by the game's live palette index; runtime tinting chooses
    # these without flattening gold poles, outlines or runway colors.
    flag = rgba('interface/factions/flag-0.png')
    badge = rgba('interface/factions/shield-0.png')
    airbase = rgba(bindings['improvement/airbase']['file'])
    add('faction/flag', fit(flag,14,22),14,22)
    for i in range(8):
        color = colors[208+i*3]
        flag_art = fit(faction_color(flag,color),14,22)
        dark_flag = fit(faction_color(flag,tuple(round(c*.65) for c in color)),14,22)
        badge_art = fit(faction_color(badge,color),64,64)
        air_art = occupied_airbase(airbase,color)
        for index in range(208+i*3,211+i*3):
            add(f'tint/faction/flag/{index}',flag_art,14,22)
            add(f'tint/crop/resource/tiles.dll/gifs/86/2,398,64,64/{index}',badge_art,64,64)
            add(f'tint/crop/file/cities/338,423,64,48/{index}',air_art,64,48)
            for slot in range(8):
                for y,art in [(425,flag_art),(448,dark_flag)]:
                    add(f'tint/crop/file/cities/{1+15*slot},{y},14,22/{index}',art,14,22)
        # Initial flag sprites also cover the flag chooser and editor. Their
        # color slots remain the original eight; map draws can select a new
        # owner color after a tribe's color is changed in a scenario.
        crop('file/cities',1+15*i,425,14,22,flag_art,False)
        crop('file/cities',1+15*i,448,14,22,dark_flag,False)
    crop('file/cities',338,423,64,48,occupied_airbase(airbase,colors[208]),False)

    icons='file/icons';sheet(icons)
    economy={}
    for role,x,y in [('food',1,305),('production',16,305),('trade',31,305),('gold',16,320),('luxury',1,320),('science',31,320)]:
        file=read('interface/economy/bindings.json')['files'][role]
        economy[role]=file
        crop(icons,x,y,14,14,file)
    for i,role in enumerate(['food','production','trade']):
        crop(icons,1+15*i,290,14,14,economy[role])
        crop(icons,49+11*i,334,10,10,economy[role])
    for i,role in enumerate(['luxury','gold','science']):
        crop(icons,49+11*i,345,10,10,economy[role])
    for i in range(4):
        crop(icons,49+15*i,290,14,14,economy['science'])
        crop(icons,49+15*i,305,14,14,'sprites/map-overlays/pollution.png')
    for i in range(38):
        crop(icons,343+37*(i%8),1+21*(i//8),36,20,kind('improvement',i+1))
    for i in range(28):
        crop(icons,343+37*(i%7),106+21*(i//7),36,20,kind('wonder',i))
    eras = ['ancient', 'medieval', 'industrial', 'modern']
    categories = ['military', 'economy', 'society', 'science', 'exploration']
    for i in range(20):
        category = categories[i//4]
        folder = 'diplomacy' if category == 'exploration' else 'advances'
        crop(icons,343+37*(i//4),211+21*(i%4),36,20,
             f'sprites/{folder}/{category}-{eras[i%4]}.png')
    for i in range(8):
        crop(icons,1+33*i,356,32,32,f'sprites/effects/explosion-{i}.png')
    crop(icons,199,289,64,32,'grid');crop(icons,248,430,64,32,'grid/radius')
    crop(icons,199,256,64,32,'interface/masks/tile.png')
    crop(icons,166,223,30,30,'improvement/disorder')
    for i,name in enumerate(['close','maximize','restore','world']):
        crop(icons,1+17*i,389,16,16,f'interface/controls/{name}-normal.png')
    for x,name in [(227,'up'),(246,'down')]:
        crop(icons,x,389,18,24,f'interface/controls/{name}-normal.png')
    crop(icons,199,322,64,32,'interface/textures/bronze.png',False)
    crop(icons,298,190,32,32,'interface/textures/parchment.png',False)
    # Remaining icon slots retain their semantic purpose, including city mood,
    # pollution and the sprite editor's marks.
    for x,y,w,h,file in [(82,334,10,10,'sprites/citizens/industrial-unhappy.png'),(82,345,10,10,'sprites/citizens/industrial-unhappy.png'),
                         (32,187,64,48,'improvement/fortified'),(67,223,32,32,'improvement/pollution')]:
        crop(icons,x,y,w,h,file)
    sheet('file/people')
    citizens=read('interface/citizens/bindings.json')['bindings']
    for i,b in enumerate(citizens):
        crop('file/people',2+28*(i%11),6+31*(i//11),27,30,b['file'])
    for i in range(11):crop('file/people',2+16*i,137,15,26,citizens[i]['file'])
    sheet('file/editorpt')
    # The editor's fixed button order follows sprite_editor_tool_click.
    editor_tools = ['cancel', 'pencil', 'brush', 'undo', 'eyedropper',
                    'terrain', 'fill', 'mirror', 'load', 'minus', 'brush',
                    'plus', 'undo', 'select', 'flag']
    for i, name in enumerate(editor_tools):
        file = f'interface/controls/{name}-normal.png'
        if not (ART/file).exists():file=f'interface/cursors/{name}.png'
        crop('file/editorpt',1+33*i,447,32,32,file)
    crop('file/editorpt',575,1,64,48,'interface/masks/blank.png')
    crop('file/editorpt',575,50,64,32,'interface/masks/tile.png')

    # All embedded visual resources receive replacements, keyed by library and
    # type. A missing binding is an error, never a fallback to the original DLL.
    resources=[]
    for r in coverage['resources']:
        s=r['source']; typ=str(s['type']).lower()
        if typ not in ['gifs','2','12','14'] or not r['replacements']:continue
        w,h=s['dimensions'] or [32,32]
        key=f'resource/{s["file"].lower()}/{typ}/{s["id"]}'
        file=r['replacements'][0]
        im=fit(file,w,h,contain=not ('background' in file or 'backdrop' in r['role'] or 'backplate' in r['role']),density=2)
        add(key,im,w,h,True)
        resources.append((key,s,r))
    # Sheet resources need each element in its actual native crop, not a single
    # illustration stretched across the entire sheet.
    for id in [85,86]:sheet(f'resource/tiles.dll/gifs/{id}')
    for i in range(11):crop('resource/tiles.dll/gifs/85',1+92*(i%6),1+73*(i//6),91,72,f'sprites/effects/nuclear-{i}.png')
    dip='resource/tiles.dll/gifs/86'
    for x,name in [(2,'despotism'),(68,'communism'),(134,'fundamentalism'),(200,'monarchy'),(266,'democracy'),(332,'republic')]:
        crop(dip,x,68,34,34,f'sprites/diplomacy/{name}.png')
    for i,name in enumerate(['ceasefire','peace','war','alliance','tutorial']):
        crop(dip,2+66*i,200,64,64,f'sprites/diplomacy/{name}.png')
    crop(dip,398,134,64,64,'interface/symbols/info.png')
    crop(dip,134,398,64,64,'interface/symbols/help.png')
    crop(dip,2,398,64,64,'interface/factions/shield-0.png')
    # City-view sheets: the rectangles are data in the reconstructed source.
    data=(ROOT/'src/data/gamedata.cpp').read_text(encoding='utf-8')
    literal=re.search(r'cityview_improvement_art_x_block_init\[\] = ("(?:\\.|[^"\\])*");',data).group(1)
    raw=ast.literal_eval('b'+literal)
    rects=list(struct.iter_unpack('<4i',raw.ljust(992,b'\0')))
    for id,offset,n,role in [(300,0,34,'improvement'),(305,34,28,'wonder')]:
        key=f'resource/cv.dll/gifs/{id}';w,h=entries[key][1:3];sheet(key,w,h)
        for i,(x,y,cw,ch) in enumerate(rects[offset:offset+n]):
            if cw and ch:crop(key,x,y,cw,ch,kind(role,i+(role=='improvement')))
    key='resource/cv.dll/gifs/310';sheet(key,640,680)
    for i in range(4):
        for w,h,step,y in [(158,114,159,231),(123,82,124,512)]:
            for yy in [y,y-h-1]:
                crop(key,1+step*i,yy,w,h,f'sprites/city-details/industrial-{i}.png')
            crop(key,1+step*i,1 if w==158 else 346,w,h,Image.new('RGBA',(w,h)))
    # Native plates keep interactive content coordinates; enhanced reports add
    # quiet text panels and section divisions without baking in fixture text.
    for name,file in [('city','interface/native-backgrounds/city.png'),('scredits','backgrounds/history-gallery-native.png')]:
        im=rgba(file);w,h=(636,421) if name=='city' else (640,480)
        add('file/'+name,fit(im,w,h,False,2),w,h,True)
    # Live window enhancements consume art and geometry, never saved trace text.
    for a in read('interface/reports/knowledge.json')['advances']:
        add('advance/'+str(a['id']),fit(a['file'],72,48),72,48)
    for a in read('interface/knowledge/bindings.json')['advances']:
        add('advance/'+str(a['id']),fit(a['file'],72,48),72,48)
    eras=['ancient','medieval','industrial','modern']
    dip='resource/mk.dll/gifs/215';sheet(dip)
    categories=['science','military','economy','society','exploration']
    for era_index,era in enumerate(eras):
        for row,category in enumerate(categories+['military']):
            file=f'sprites/{"diplomacy" if category=="exploration" else "advances"}/{category}-{era}.png'
            crop(dip,1+109*era_index,1+31*row,108,30,file)
        add('military/'+str(era_index),fit(f'sprites/advances/military-{era}.png',108,90),108,90)
    for i in range(42):
        key=f'resource/mk.dll/gifs/{220+i}'
        crop(key,1,1,225,275,f'sprites/leaders/leader-{i:02}.png')
    for resource,offset in [(210,0),(211,21)]:
        key=f'resource/mk.dll/gifs/{resource}';sheet(key,638,334)
        for i in range(21):crop(key,1+91*(i%7),1+111*(i//7),90,110,f'sprites/leaders/leader-{i+offset:02}.png')
    key='resource/ss.dll/gifs/497';sheet(key)
    for i,state in enumerate(['normal','pressed','disabled']):
        crop(key,1+53*i,1,52,36,f'interface/controls/close-{state}.png')
        crop(key,1+68*i,38,67,36,f'interface/controls/launch-{state}.png')
    for id in range(301,307):
        key=f'resource/civ2.exe/2/{id}'
        file=next(r['replacements'][0] for k,s,r in resources if k==key)
        crop(key,0,7,32,20,file)
    for p in (ART/'sprites/palace').glob('*.png'):
        im=rgba(p.relative_to(ART));box=im.getbbox()
        if box:im=im.crop(box)
        add('palace/'+p.stem,im)
    for p in (ART/'sprites/spaceship').glob('*.png'):
        add('ship/'+p.stem,fit(p.relative_to(ART).as_posix(),96,80),96,80)
    add('ship/empty',rgba('interface/windows/attachment-empty.png'),96,64)
    for role,file in economy.items():add('economy/'+role,fit(file,48,48),48,48)

    meta=read('city/panorama/layout.json')
    for p in (ART/'city/panorama/walls').glob('*.png'):
        add('city/wall-'+p.stem,rgba(p.relative_to(ART)),1280,480)
    layout=['/* Generated by tools/build_atlas.py from the versioned artwork metadata. */',
            'struct HdCityArt { const char *crop, *art; float units; int priority, waterfront, wall; };',
            'static const HdCityArt hd_city_art[] = {']
    for resource,offset,n,role in [(300,0,34,'improvement'),(305,34,28,'wonder')]:
        for i,(x,y,w,h) in enumerate(rects[offset:offset+n]):
            number=i+(role=='improvement')
            entry=next(e for e in catalog if (e.get('mapping') or {}).get('kind')==role and e['mapping'].get('index')==number)
            aid=meta['gate']['art'] if role=='improvement' and number==8 else entry['id']
            art=next(e for e in catalog if e['id']==aid)
            im=rgba(art['file']);im=im.crop(im.getbbox())
            add('city/'+aid,im)
            cropkey=f'crop/resource/cv.dll/gifs/{resource}/{x},{y},{w},{h}'
            water=(role=='improvement' and number in [28,30,31,34]) or (role=='wonder' and number==3)
            layout.append(f'{{"{cropkey}","city/{aid}",{meta["buildings"][entry["id"]]["width"]}f,{3 if role=="wonder" else 2},{int(water)},{int(role=="improvement" and number==8)}}},')
    for i in range(4):
        im=rgba(f'sprites/city-details/industrial-{i}.png');add(f'city/house-{i}',im.crop(im.getbbox()))
        for w,h,step,ys,units in [(158,114,159,[116,231],1.25),(123,82,124,[429,512],1.0)]:
            for y in ys:layout.append(f'{{"crop/resource/cv.dll/gifs/310/{1+step*i},{y},{w},{h}","city/house-{i}",{units}f,1,0,0}},')
    layout+=['};','struct HdCitySite { float land[4], water[4], gate[2], perimeter[4][2]; };','static const HdCitySite hd_city_sites[] = {']
    for site in ['coastal','river','inland']:
        m=meta['sites'][site]
        vals=[m['land'],m['waterfront'],m['gate']]+m['perimeter']
        arrays=['{'+','.join(str(v)+'f' for v in a)+'}' for a in vals]
        layout.append('{'+','.join(arrays[:3])+',{'+','.join(arrays[3:])+'}},')
    layout+=['};','struct HdShipSlot { int kind,index,x,y,w,h; const char *art; };','static const HdShipSlot hd_ship_slots[] = {']
    ship=read('space-layout.json')
    for slot in ship['slots']:
        vals=[ship['countOrder'].index(slot['kind']),slot['index'],slot['x'],slot['y'],slot['width'],slot['height']]
        layout.append('{'+','.join(map(str,vals))+',"ship/'+Path(slot['asset']).stem+'"},')
    layout+=['};','']
    header=ROOT/'src/game/hd_layouts.h';text='\n'.join(layout)
    if not header.exists() or header.read_text()!=text:header.write_text(text)

    # Finalize proxy sheets and supply registration markers as metadata-derived
    # indices, independent of RGB pixels. The source scans these exact markers.
    for key,im in sheets.items():add(key,im,im.width,im.height,True)
    native={}
    for key,(im,w,h,indexed) in entries.items():
        if not indexed:continue
        small=im.resize((w,h),Image.Resampling.LANCZOS)
        q=bytearray(small.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).tobytes())
        alpha=small.getchannel('A').tobytes()
        for i,a in enumerate(alpha):
            if a<100:q[i]=7
            elif q[i] in (7,9):q[i]=8
        native[key]=q
    def marker(key,x,y,value):
        w,h=entries[key][1:3]
        if 0<=x<w and 0<=y<h:native[key][y*w+x]=value
    # Color-coded input masks are mathematical data, not original artwork.
    # Quadrants: center, NE, SE, SW, NW; directions are NE-first clockwise.
    for y in range(32):
        for x in range(64):
            u=(x+.5-32)/32;v=(y+.5-16)/16
            q=0 if abs(u)+abs(v)<=1 else (1 if u>0 and v<0 else 2 if u>0 else 3 if v>0 else 4)
            marker(t1,66+x,447+y,10+16*q)
            direction=int(math.floor((math.atan2(v,u)+math.pi/4)/(math.pi/4)+.5))%8
            if abs(u)<.16 and abs(v)<.16:direction=8
            marker(t1,261+x,447+y,10+16*direction)
    ua=read('map/unit-anchors.json');anchors=[ua['defaultAnchor'][: ] for _ in range(64)]
    for a in ua['overrides']:anchors[a['index']]=a['anchor']
    for i,(ax,ay) in enumerate(anchors[:63]):
        x,y=1+65*(i%9),1+49*(i//9)
        marker('file/units',x+ax,y-1,4);marker('file/units',x-1,y+ay,4)
    for a in read('map/city-anchors.json')['variants']:
        i=a['index'];x,y=(334 if i%2 else 1)+65*((i%8)//2),39+49*(i//8)
        for ax,ay,v in [(49,19,4),(*a['sizeBox'],3)]:
            marker('file/cities',x+ax,y-1,v);marker('file/cities',x-1,y+ay,v)
    for i in range(8):
        for dx,v in [(3,208+3*i),(6,209+3*i)]:marker('file/cities',1+15*i+dx,429,v)
        marker('file/cities',1+15*i,423,210+3*i)
    # Write a deterministic, bounded index and deduplicated PNG/byte payloads.
    OUT.parent.mkdir(parents=True,exist_ok=True)
    names=sorted(entries);offset=780+180*len(names);payload=bytearray();index=[];dedup={}
    def blob(data):
        nonlocal offset
        digest=hashlib.sha256(data).digest()
        if digest in dedup:return dedup[digest]
        at=offset;payload.extend(data);offset+=len(data);dedup[digest]=at;return at
    for key in names:
        im,w,h,_=entries[key]
        b=io.BytesIO();im.save(b,format='PNG');png=b.getvalue()
        at=blob(png);ix=blob(native[key]) if key in native else 0
        assert len(key.encode())<160,key
        index.append(key.encode().ljust(160,b'\0')+struct.pack('<5I',w,h,at,len(png),ix))
    OUT.write_bytes(b'C2ATLAS1'+struct.pack('<I',len(names))+palette+b''.join(index)+payload)
    (OUT.parent/'atlas-bindings.json').write_text(json.dumps({k:{'width':v[1],'height':v[2]} for k,v in entries.items()},indent=2)+'\n')
    (OUT.parent/'atlas-inputs.json').write_text(json.dumps(sorted(INPUTS),indent=2)+'\n')
    print(f'Atlas HD: {len(names)} bindings, {OUT.stat().st_size//1048576} MiB -> {OUT}')


if __name__=='__main__':
    build()
