from pathlib import Path
import json,re,ast,importlib.util,argparse,hashlib
R=Path(__file__).resolve().parents[2]; O=R/'build/atlas-review/generated/other'
O.mkdir(parents=True,exist_ok=True)
ap=argparse.ArgumentParser();ap.add_argument('--game',type=Path,required=True);ap.add_argument('--save',type=Path,required=True);args=ap.parse_args();G=args.game
spec=importlib.util.spec_from_file_location('r',R/'tools/atlas-review/prepare-report-inputs.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
c=json.loads((R/'assets/atlas-hd/review/fixtures/other-windows/catalog.json').read_text())
q=lambda s:json.dumps(s,ensure_ascii=True)
g=(R/'src/data/gamedata.cpp').read_text(encoding='utf8')
# The static abbreviations are source data, not RULES.TXT column labels.
raw=re.search(r'static const char advances_init\[\] = (".*");',g)[1]
b=ast.literal_eval(raw).encode('latin1')
abbr={b[n*16:n*16+4].split(b'\0')[0].decode():n for n in range(100)}
abbr.update({'nil':-1,'no':-2})
out=[]
label_lines=(G/'Labels.txt').read_text(encoding='cp1252').split('@LABELS\n',1)[1].splitlines()
labels=[s.strip() for s in label_lines[1:1+int(label_lines[0])]]
for i,s in enumerate(labels):out.append(f'pool[{i}]={q(s)}; label_table.string_ids[{i}]={i};')
for i,r in enumerate(c['CIVILIZE']):
 out.append(f'pool[{2000+i}]={q(r[0])}; advances[{i}].name={2000+i}; advances[{i}].preq[0]={abbr[r[3]]}; advances[{i}].preq[1]={abbr[r[4]]}; advances[{i}].epoch={r[5]}; advances[{i}].category={r[6]};')
for i,r in enumerate(c['UNITS']):
 r=[re.sub(r'^(-?\d+)[^0-9].*$',r'\1',s) for s in r]
 out.append(f'pool[{2200+i}]={q(r[0])}; unit_types[{i}].name={2200+i};')
 for field,v in [('obsolete_by',abbr[r[1]]),('role',r[11]),('domain',r[2]),('move',int(r[3])*3),('attack',r[5]),('defense',r[6]),('hit_points',int(r[7])*10),('firepower',r[8]),('cost',r[9]),('hold',r[10]),('prerequisite',abbr[r[12]]),('flags',int(r[13],2))]:out.append(f'unit_types[{i}].{field}={v};')
for i,r in enumerate(c['IMPROVE']):
 out.append(f'pool[{2400+i}]={q(r[0])}; improvements[{i}].name={2400+i}; improvements[{i}].cost={r[1]}; improvements[{i}].upkeep={r[2]}; improvements[{i}].preq={abbr[r[3]]};')
ta=['Drt','Pln','Grs','For','Hil','Mtn','Tun','Gla','Swa','Jun','Oce']
for i,r in enumerate(c['TERRAIN']):
 out.append(f'pool[{2600+i}]={q(r[0])}; terrain_types[{i}].name={2600+i};')
 for field,v in [('move_cost',r[1]),('defense',r[2]),('food',r[3]),('shields',r[4]),('trade',r[5])]:out.append(f'terrain_types[{i}].{field}={v};')
 if i<11:
  for field,v in [('irrigate_to',r[6]),('mine_to',r[10]),('transform_to',r[14])]:out.append(f'terrain_types[{i}].{field}={ta.index(v) if v in ta else (-2 if v=="yes" else -1)};')
  for field,v in [('irrigate_bonus',r[7]),('irrigate_turns',r[8]),('mine_bonus',r[11]),('mine_turns',r[12])]:out.append(f'terrain_types[{i}].{field}={v};')
for file in ['PEDIA.TXT','GAME.TXT','LABELS.TXT','DESCRIBE.TXT','CREDITS.TXT']:
 lines=[]
 for physical in (G/file).read_text(encoding='cp1252').splitlines():
  lines.extend(physical[i:i+254] for i in range(0,len(physical)+1,254))
 out.append(f'textFiles[{q(file)}]={{{",".join(q(s) for s in lines)}}};')
for line in (R/'assets/atlas-hd/review/fixtures/other-windows/reports.txt').read_text(encoding='utf8').splitlines():
 if line.startswith('raw '):
  _,key,h=line.split();out.append(f'rawInputs[{q(key)}]={q(h)};')
for i in range(100):out.append(f'advances[{i}].enabled={1 if i<89 else 0};')
for i,name in enumerate(['Anarchy','Despotism','Monarchy','Communism','Fundamentalism','Republic','Democracy']):
 out.append(f'pool[{2800+i}]={q(name)}; government_names[{i}]={2800+i};')
for f in json.loads((R/'assets/atlas-hd/review/fixtures/other-windows/inputs.json').read_text())['civilizations']:
 for name,key in [('civNames','name'),('civAdjectives','adjective'),('civLeaders','leader'),('civTitles','title')]:out.append(f'{name}[{f["id"]}]={q(f[key])};')
for i,row in enumerate(m.section((G/'RULES.TXT').read_text(encoding='cp1252'),'ATTITUDES')):
 out.append(f'pool[{2900+i}]={q(row.split(",")[0].strip())};attitude_names[{i}]={2900+i};')
for i,row in enumerate(m.section((G/'RULES.TXT').read_text(encoding='cp1252'),'ENDWONDER')):
 out.append(f'wonder_expires[{i}]={abbr[row.split(",")[0].strip()]};')
# Only the current player's remembered improvement plane is needed by these panels.
world=json.loads((R/'assets/atlas-hd/review/fixtures/saved-world.json').read_text())
save=args.save.read_bytes()
sec=world['provenance']['sections']['known6'];out.append(f'rawInputs["known6"]={q(save[sec["offset"]:sec["offset"]+sec["length"]].hex())};')
assert __import__('hashlib').sha256(save).hexdigest()==world['provenance']['saveSha256']
citysec=world['provenance']['sections']['cities']; offset=citysec['offset']+citysec['length']+63+4+48
out.append(f'rawInputs["power_history"]={q(save[offset:offset+1200].hex())};')
anchors=(R/'assets/atlas-hd/review/original-local/anchors.txt').read_text().splitlines()[-8:]
for i,line in enumerate(anchors):
 a=list(map(int,line.split()));out.append(f'civ_primary_colors_block.civ_colors[{i}].primary={a[0]};civ_primary_colors_block.civ_colors[{i}].mid={a[1]};civ_primary_colors_block.civ_colors[{i}].secondary={a[2]};')
# Power history follows the cities in this version of the save (game_load).
out.append('cosmic.tech_paradigm=10;cosmic.fund_max_science=5;cosmic.fund_science_loss=50;cosmic.shield_box_rows=10; cosmic.road_move_mult=3;')
(O/'inputs.inc').write_text('\n'.join(out),encoding='utf8')

# Local-only control and status media; never publish these standalone crops.
import io
from PIL import Image
spec=importlib.util.spec_from_file_location('art',R/'tools/atlas-review/original-assets.py');art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
local=R/'assets/atlas-hd/review/original-local/other-windows';local.mkdir(parents=True,exist_ok=True)
for key,b in art.resources(G/'civ2.exe'):
 if key[0]==2 and key[1] in range(301,307):
  im=Image.open(io.BytesIO(b)).crop((0,7,32,27));rgba=im.convert('RGBA');rgba.putalpha(Image.frombytes('L',im.size,bytes(0 if p==6 else 255 for p in im.tobytes())));rgba.save(local/f'control-{key[1]}.png')
im=Image.open(G/'ICONS.GIF')
for i in range(4):
 crop=im.crop((49+15*i,290,63+15*i,304));rgba=crop.convert('RGBA');rgba.putalpha(Image.frombytes('L',crop.size,bytes(0 if p in (253,255) else 255 for p in crop.tobytes())));rgba.save(local/f'flask-{i}.png')
# Caption close button and tiled border are registered in gfx_load_icons.
for key,rect in [('caption-close',(1,389,17,405)),('window-border',(199,322,263,354))]:
 crop=im.crop(rect);crop.convert('RGBA').save(local/(key+'.png'))
meta=dict(saveSha256=hashlib.sha256(save).hexdigest(),localInputHashes={f:hashlib.sha256((G/f).read_bytes()).hexdigest() for f in ['LABELS.TXT','GAME.TXT','PEDIA.TXT','DESCRIBE.TXT','CREDITS.TXT','RULES.TXT','ICONS.GIF','tiles.dll','civ2.exe']},labels=len(labels),powerHistoryOffset=offset,powerHistoryLength=1200,known6=sec)
(O/'inputs.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8')
print('Prepared local original media/text, rules, and retained save inputs for source extraction')


diplo=next(b for key,b in art.resources(G/'tiles.dll') if key[1]==86 and b.startswith(b'GIF'))
crop=Image.open(io.BytesIO(diplo)).crop((398,134,462,198));rgba=crop.convert('RGBA');rgba.putalpha(Image.frombytes('L',crop.size,bytes(0 if p in (253,255) else 255 for p in crop.tobytes())));rgba.save(local/'popup-info.png')
