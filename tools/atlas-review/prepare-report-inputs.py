"""Prepare review fixtures and ignored original art; never alter installed inputs."""
import argparse, hashlib, importlib.util, io, json, re, struct
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
PACK=ROOT/'assets/atlas-hd'
def sha(data):return hashlib.sha256(data).hexdigest()
def section(text,name):
    block=text.split('@'+name+'\n',1)[1].split('\n@',1)[0]
    return [line.split(';')[0].strip() for line in block.splitlines()
            if line.split(';')[0].strip() and not line.lstrip().startswith(':')]
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game',type=Path,required=True)
    parser.add_argument('--save',type=Path,required=True)
    args=parser.parse_args()
    world=json.loads((PACK/'review/fixtures/saved-world.json').read_text())
    data=args.save.read_bytes()
    assert sha(data)==world['provenance']['saveSha256'],'Use the retained 1788 comparison save'
    label_lines=(args.game/'Labels.txt').read_text(encoding='cp1252').split('@LABELS\n',1)[1].splitlines()
    labels=[line.strip() for line in label_lines[1:1+int(label_lines[0])]]
    rules=(args.game/'Rules.txt').read_text(encoding='cp1252')
    q=lambda s:json.dumps(s,ensure_ascii=True)
    lines=[f'label {i} {q(s)}' for i,s in enumerate(labels)]
    leaders=[s.split(',') for s in section(rules,'LEADERS')]
    def at(name):
        s=world['provenance']['sections'][name]
        b=data[s['offset']:s['offset']+s['length']]
        assert sha(b)==s['sha256']
        return b
    names=at('civ_names');civs=at('civs')
    def z(b):return b.split(b'\0')[0].decode('cp1252')
    facts=[]
    for c in range(1,8):
        record=civs[c*1428:(c+1)*1428];n=names[c*242:(c+1)*242]
        tribe=struct.unpack_from('<h',record,6)[0];leader=[s.strip() for s in leaders[tribe]]
        government=record[21]
        name=z(n[26:50]) or leader[5]
        adjective=z(n[50:74]) or leader[6]
        person=z(n[2:26]) or leader[0]
        title=z(n[74+government*24:98+government*24]) or ['Chief','Emperor','King','Comrade','Consul','Consul','President'][government]
        pop=sum(t['size']*(t['size']+1)//2 for t in world['cities'] if t['owner']==c)
        era=2
        lines.append(f'civ {c} {era} {government} {struct.unpack_from("<i",record,2)[0]} {struct.unpack_from("<h",record,10)[0]} 420 {pop} {q(name)} {q(adjective)} {q(person)} {q(title)}')
        facts.append(dict(id=c,name=name,adjective=adjective,leader=person,title=title,era=era,populationUnits=pop))
    for i,line in enumerate(section(rules,'CIVILIZE')):
        row=[s.strip() for s in line.split(',')]
        lines.append(f'advance {i} {int(row[-1]) if row[-1].isdigit() else i%5} {q(row[0])}')
    for i,line in enumerate(section(rules,'UNITS')):
        r=[s.strip() for s in line.split(',')]
        number=lambda n:int(re.match(r'-?\d+',r[n])[0])
        lines.append(f'unit-type {i} {number(5)} {number(6)} {number(3)*3} {number(7)*10} {number(8)} {number(9)} {number(2)} 0 0 0 {q(r[0])}')

    for i,line in enumerate(section(rules,'UNITS')):
        r=[s.strip() for s in line.split(',')]
        lines.append(f'unit-extra {i} {int(r[10])} {int(r[13],2)}')
    for i,line in enumerate(section(rules,'IMPROVE')):
        r=[s.strip() for s in line.split(',')]
        lines.append(f'improvement {i} {int(r[1])} {int(r[2])} {q(r[0])}')
    for name in ['game','civs','cities','units','map_header','tiles']:
        lines.append(f'raw {name} {at(name).hex()}')
    lines.append('view 6')
    for i,(name,civ,score,rating) in enumerate([('Elizabeth','English',1620,132),('Hammurabi','Babylonians',1415,116),('Catherine','Russians',1290,108),('Caesar','Romans',1164,97),('Frederick','Germans',1030,85)]):
        lines.append(f'fame {i} {score} {rating} 2020 {q(name)} {q(civ)}')
    gameText=(args.game/'Game.txt').read_text(encoding='cp1252')
    for key in ['MALEFAME','FEMALEFAME','WONDERS']:
        for value in section(gameText,key):lines.append(f'section {q(key)} {q(value)}')
    fixtures=PACK/'review/fixtures/other-windows';fixtures.mkdir(parents=True,exist_ok=True)
    (fixtures/'reports.txt').write_text('\n'.join(lines)+'\n',encoding='utf8',newline='\n')
    (fixtures/'inputs.json').write_text(json.dumps(dict(saveSha256=sha(data),saveBasename=args.save.name,
        source='Retained 1788 save records; city economic caches are supplied to the drawing boundary. Research cost, score summary and hall-of-fame entries are explicit review fixtures, not a gameplay simulation.',
        supplied=dict(researchCost=420,score=dict(citizens=142,wonders=100,peace=30,barbarianBonus=25,total=297),hallOfFame='Five declared comparison entries'),
        civilizations=facts),indent=2)+'\n')
    spec=importlib.util.spec_from_file_location('original',ROOT/'tools/atlas-review/original-assets.py')
    original=importlib.util.module_from_spec(spec);spec.loader.exec_module(original)
    out=PACK/'review/original-local/other-windows';out.mkdir(parents=True,exist_ok=True)
    bindings={};sourceHashes={}
    for name,ids in [('tiles.dll',list(range(50,60))+[65,66,85,86,90,95]),('mk.dll',[200,201,202,203,204,205,206])]:
        payload=(args.game/name).read_bytes();sourceHashes[name]=sha(payload)
        for key,bytes_ in original.resources(args.game/name):
            if key[1] not in ids or not bytes_.startswith(b'GIF'):continue
            im=Image.open(io.BytesIO(bytes_));file=out/(name+'-'+str(key[1])+'.png')
            im.convert('RGBA').save(file)
            pal=im.getpalette();colors={str((i+10)%256):'#'+''.join(f'{v:02x}' for v in pal[3*i:3*i+3]) for i in range(256)}
            bindings[name+'/'+str(key[1])]=dict(file=file.relative_to(PACK).as_posix(),width=im.width,height=im.height,palette=colors)
    icons=Image.open(args.game/'ICONS.GIF')
    def icon(key,x,y,w,h):
        im=icons.crop((x,y,x+w,y+h));rgba=im.convert('RGBA')
        rgba.putalpha(Image.frombytes('L',im.size,bytes(0 if p in (253,255) else 255 for p in im.tobytes())))
        file=out/(key+'.png');rgba.save(file)
        bindings[key]=dict(file=file.relative_to(PACK).as_posix(),width=w,height=h)
    for i in range(28):icon('wonder-'+str(i),343+(i%7)*37,106+(i//7)*21,36,20)
    for category in range(5):
        for era in range(4):icon('advance-'+str(category*4+era),343+category*37,211+era*21,36,20)
    sourceHashes['ICONS.GIF']=sha((args.game/'ICONS.GIF').read_bytes())
    (out/'bindings.json').write_text(json.dumps(dict(bindings=bindings,sourceHashes=sourceHashes),indent=2)+'\n')
    print(f'Prepared 1788 report fixture, {len(labels)} label bindings and {len(bindings)} local original backgrounds')
if __name__=='__main__':main()
