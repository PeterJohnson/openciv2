"""Import v44 normal .sav map state; never reads an image or writes to the save.

Usage: python tools/atlas-review/import-save.py save.sav RULES.TXT
Subsequent builds use the checked-in JSON and need neither original input.
"""
from pathlib import Path
import hashlib, json, re, struct, sys

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/atlas-hd/review/fixtures/saved-world.json'
def digest(b): return hashlib.sha256(b).hexdigest()
def parse(data, rules):
    if data[:8]!=b'CIVILIZE' or struct.unpack_from('<H',data,10)[0]!=44:
        raise ValueError('Only the observed v44 normal saved-game layout is supported')
    pos=12
    sections={}
    def take(name,n):
        nonlocal pos
        if n<0 or pos+n>len(data): raise ValueError('Truncated '+name)
        value=data[pos:pos+n]; pos+=n
        sections[name]={'offset':pos-n,'length':n,'sha256':digest(value)}
        return value
    game=take('game',0x14a); names=take('civ_names',0x790); civs=take('civs',0x2ca0)
    word=lambda b,n:struct.unpack_from('<h',b,n)[0]
    uint=lambda b,n:struct.unpack_from('<I',b,n)[0]
    if word(game,8)&0x80: raise ValueError('Scenario layouts are not supported')
    nu,nc=struct.unpack_from('<hh',game,46)
    if not (0<=nu<=2048 and 0<=nc<=256): raise ValueError('Record counts')
    width,height,area,flat,seed,qw,qh=struct.unpack('<hhhHHhh',take('map_header',14))
    if not (4<=width<=256 and width%2==0 and 4<=height<=256 and area==width//2*height
            and qw==(width+3)//4 and qh==(height+3)//4): raise ValueError('Map dimensions')
    known=[take('known'+str(c),area) for c in range(1,8)]
    tile_bytes=take('tiles',area*6)
    take('coarse',qw*qh*2);take('landmass',0x400)
    ub=take('units',nu*32); cb=take('cities',nc*88)
    def section(name):
        lines=rules.decode('cp1252').split('@'+name+'\n',1)[1].split('\n@',1)[0].splitlines()
        return [[s.strip() for s in line.split(';')[0].split(',')]
                for line in lines if line.strip() and not line.lstrip().startswith((';', ':'))]
    unit_rules=section('UNITS'); leader_rules=section('LEADERS')
    types=[{'domain':int(r[2]),'hp':10*int(re.match(r'\d+',r[7])[0])} for r in unit_rules]
    if len(types)!=62 or not 1<=len(leader_rules)<=32: raise ValueError('Expected standard unit/leader tables')
    records=[]; units=[]; cities=[]
    # All-map art review is explicit: terrain and records untouched, fog disabled.
    records.append('STATE '+ ' '.join(map(str,[seed,word(game,0)&65535,game[32],game[35],game[27],word(game,22)])))
    for i,r in enumerate(types): records.append(f'TYPE {i} {r["domain"]} {r["hp"]}')
    for i in range(8):
        c=civs[i*0x594:(i+1)*0x594]; tribe=word(c,6); style=word(names,i*0xf2)
        if not(0<=tribe<len(leader_rules) and -1<=style<=3): raise ValueError('City style domain')
        records.append('CIV '+' '.join(map(str,[i,tribe,int(leader_rules[tribe][4]),style,*c[0x58:0x65]])))
    for i in range(nc):
        b=cb[i*88:(i+1)*88]
        if not uint(b,84): continue
        x,y=struct.unpack_from('<hh',b);owner,size=b[8],b[9]
        if not(0<=x<width and 0<=y<height and not((x+y)&1) and owner<8 and 1<=size<=127): raise ValueError('City record')
        city={'index':i,'x':x,'y':y,'owner':owner,'size':size,'name':b[32:48].split(b'\0')[0].decode('cp1252')}
        cities.append(city)
        records.append('CITY '+' '.join(map(str,[i,x,y,owner,size,uint(b,4),b[12],*b[13:21],*b[52:57]])))
    for i in range(nu):
        b=ub[i*32:(i+1)*32]
        if not uint(b,26): continue
        x,y=struct.unpack_from('<hh',b);typ,owner=b[6],b[7]
        if not(0<=x<width and 0<=y<height and not((x+y)&1) and typ<len(types) and owner<8): raise ValueError('Unit record')
        prev,nxt=struct.unpack_from('<hh',b,22)
        u={'index':i,'x':x,'y':y,'type':typ,'owner':owner,'prev':prev,'next':nxt}
        units.append(u)
        records.append('UNIT '+' '.join(map(str,[i,x,y,typ,owner,word(b,4)&65535,b[9],b[10],struct.unpack_from('<b',b,15)[0],prev,nxt,b[12]])))
    for i in range(28): records.append(f'WONDER {i} {word(game,0xfe+2*i)}')
    by_id={u['index']:u for u in units}; heads={}
    for u in units:
        if u['next'] != -1:
            nxt=by_id.get(u['next'])
            if not nxt or nxt['prev']!=u['index'] or (nxt['x'],nxt['y'])!=(u['x'],u['y']):
                raise ValueError('Broken forward stack link')
        seen=set(); v=u
        while v['prev']!=-1:
            if v['index'] in seen or v['prev'] not in by_id: raise ValueError('Broken stack')
            seen.add(v['index']);prev=by_id[v['prev']]
            if prev['next']!=v['index'] or (prev['x'],prev['y'])!=(u['x'],u['y']): raise ValueError('Stack link mismatch')
            v=prev
        k=(u['x'],u['y'])
        if k in heads and heads[k]!=v['index']: raise ValueError('Multiple stack heads')
        heads[k]=v['index']
    city_at={(c['x'],c['y']):c['index'] for c in cities}
    tiles=[]
    for n in range(area):
        y=n//(width//2);x=(n%(width//2))*2+(y&1)
        t,f,radius,landmass,visibility,owner=tile_bytes[n*6:n*6+6]
        if (t&15)>10: raise ValueError('Terrain domain')
        u=(x+y)//2;v=x-u; key=(u&3)+4*(v&3);pattern=((x+y)>>3)*11+(v>>2)*13+seed
        resource=0
        if not(t&64) and t&15!=2 and key==pattern&15:
            bit=1<<((seed>>4)&3);resource=2 if (bit&u)==(bit&v) else 1
        hut=int(t&15!=10 and owner>>4==15 and key==(pattern+8)&31)
        tiles.append(dict(x=x,y=y,t=t,f=f,k=known[max(1,game[27])-1][n],v=1,r=resource,h=hut,
                          c=city_at.get((x,y),-1),u=heads.get((x,y),-1),s=int(((-u-x)&2)==0),owner=owner>>4))
    stats={name:sum(bool(t['f']&bit) for t in tiles) for name,bit in [('road',16),('rail',32),('irrigation',4),('mine',8)]}
    stats.update(tiles=area,cities=len(cities),units=len(units),specials=sum(t['r']>0 for t in tiles),terrainKinds=len({t['t']&15 for t in tiles}))
    return dict(width=width,height=height,wrap=not flat,tiles=tiles,records=records,cities=cities,units=units,
                provenance=dict(formatVersion=44,year=word(game,18),turn=word(game,16),saveSha256=digest(data),rulesSha256=digest(rules),sections=sections,
                inputRecordCounts=dict(units=nu,cities=nc),statistics=stats,view='All-map art review; fog deliberately disabled in every comparison stage',
                sources=['tools/xdnet/savecmp.py','src/include/civ2types.h','src/auto/game.cpp:2499–2740','src/auto/map.cpp:6853–6947,7151–7240','src/auto/civ.cpp:1166']))

if __name__=='__main__':
    save,rules=map(Path,sys.argv[1:3]);data=save.read_bytes();rule_bytes=rules.read_bytes().replace(b'\r\n',b'\n')
    world=parse(data,rule_bytes);world['provenance']['saveBasename']=save.name
    world['provenance']['rulesSha256']=digest(rules.read_bytes())
    world['provenance']['sourceHashes']={f:digest((ROOT/f).read_bytes()) for f in ['src/include/civ2types.h','src/auto/game.cpp','src/auto/map.cpp','src/auto/civ.cpp','tools/xdnet/savecmp.py']}
    OUT.write_text(json.dumps(world,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    assert save.read_bytes()==data
    print(json.dumps(world['provenance']['statistics']), 'year',world['provenance']['year'])
