"""Extract unchanged renderer bodies from this checkout, never from a sibling repo."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'build/atlas-review/generated'
OUT.mkdir(parents=True,exist_ok=True)
selection={
 'src/auto/mapview.cpp':['MapView::update_layout','MapView::tile_to_screen','MapView::draw_tile_ocean','MapView::draw_tile_land','MapView::draw_tile_roads','MapView::draw_tile_specials','MapView::draw_tile_unexplored_edges','MapView::draw_tile_terrain','MapView::draw_tile_city','MapView::draw_unit_stacked','MapView::draw_unit_blinking','MapView::draw_stack_unit','MapView::draw_tile_units','MapView::draw_tile','MapView::draw_all_tiles','MapView::zoom_scale','MapView::apply_zoom'],
 'src/auto/map.cpp':['tile_calc_coast_masks','map_wrap_x'],
 'src/auto/graphics.cpp':['gfx_zoom_scale','gfx_set_zoom_scale','gfx_reset_zoom_scale','Sprite::draw','Sprite::draw_silhouette','gfx_draw_unit','gfx_draw_city'],
 'src/auto/city.cpp':['CityViewWindow::classify_site','CityViewWindow::layout_buildings','CityViewWindow::draw_buildings','CityViewWindow::take_wonder_slot','CityViewWindow::take_improvement_slot','CityViewWindow::place_improvement','CityViewWindow::place_wonder','CityViewWindow::place_large_house','CityViewWindow::place_small_house','CityViewWindow::place_large_empty_lot','CityViewWindow::place_empty_lot'],
 'src/auto/reports.cpp':['ThroneRoomWindow::render'],
 'src/game/random.cpp':['rng_next_unit','rand_range'],
 'src/auto/support.cpp':['rng_set_seed']}
def extract(text,name):
 # A definition starts at column zero; calls have indentation. Permit a split return type.
 p=re.compile(r'^((?:[\w:*]+\s+){0,4}'+re.escape(name)+r'\([^;{}]*\)\s*\{)',re.M)
 matches=list(p.finditer(text))
 if len(matches)!=1:raise ValueError((name,len(matches)))
 m=matches[0];start=m.start();i=m.end();depth=1
 token=re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[{}]')
 for t in token.finditer(text,i):
  if t.group()=='{':depth+=1
  elif t.group()=='}':depth-=1
  if depth==0:return text[start:t.end()],text.count('\n',0,start)+1
 raise ValueError('Unclosed '+name)
parts=[];functions=[];files={}
for file,names in selection.items():
 raw=(ROOT/file).read_bytes();files[file]=hashlib.sha256(raw).hexdigest();text=raw.decode().replace('\r\n','\n')
 for name in names:
  body,line=extract(text,name);parts.append(f'#line {line} "{file}"\n{body}\n')
  functions.append(dict(name=name,file=file,line=line,sha256=hashlib.sha256(body.encode()).hexdigest()))
(OUT/'engine-bodies.inc').write_text('\n'.join(parts),encoding='utf8',newline='\n')
g=(ROOT/'src/data/gamedata.cpp').read_text(encoding='utf8')
tables=['diag_neighbor_bits_block','dir_dx_table_block','dir_dy_table_block','cityview_improvement_art_x_block','cityview_slot_x_table_block','throneroom_piece_rect_x_block','throneroom_piece4_rect_x_block']
decl=[];tablemeta=[]
for name in tables:
 match=re.search(r'static const char '+name+r'_init\[\] = "(?:\\.|[^"\\])*";',g)
 if not match:raise ValueError(name)
 decl.append(match.group());tablemeta.append(dict(name=name,line=g.count('\n',0,match.start())+1,sha256=hashlib.sha256(match.group().encode()).hexdigest()))
empty=re.search(r'char str_empty\[908\] = "(?:\\.|[^"\\])*";',g).group()
decl.append(empty)
(OUT/'engine-tables.inc').write_text('\n'.join(decl),encoding='utf8',newline='\n')
headers=[]
for filename,names in {'mapview':['diag_neighbor_bits_block'],'ai':['dir_dx_table_block','dir_dy_table_block'],'city':['cityview_improvement_art_x_block','cityview_slot_x_table_block'],'reports':['throneroom_piece4_rect_x_block'],'misc':['throneroom_piece_rect_x_block']}.items():
 h=(ROOT/f'src/data/state/{filename}.h').read_text()
 for name in names:
  declaration=re.search(r'struct '+name+r' \{[\s\S]*?\};',h).group()
  if name.startswith('throneroom_piece'):
   offset=256 if name=='throneroom_piece4_rect_x_block' else 0
   declaration+=f'\nstatic struct {name}& {name}=*reinterpret_cast<struct {name}*>(throneTables+{offset});\n'
  else:declaration+=f'\nstatic struct {name} {name};\n'
  headers.append(declaration)
(OUT/'engine-structures.inc').write_text('#pragma pack(push,1)\n'+'\n'.join(headers)+'\n#pragma pack(pop)\n',encoding='utf8',newline='\n')
files['src/data/gamedata.cpp']=hashlib.sha256((ROOT/'src/data/gamedata.cpp').read_bytes()).hexdigest()
(OUT/'extraction.json').write_text(json.dumps(dict(repository='richardpenman-civ2',functions=functions,tables=tablemeta,sourceHashes=files,bodyPolicy='unchanged text, LF normalized, with #line source mapping'),indent=2)+'\n',newline='\n')
print(f'Extracted {len(functions)} unchanged function bodies and {len(tables)} table initializers')
