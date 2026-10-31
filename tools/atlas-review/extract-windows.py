"""Compile selected real window renderers with a finite drawing/fixture boundary."""
from pathlib import Path
import runpy, json, hashlib, re
shared=runpy.run_path(str(Path(__file__).with_name('extract-engine.py')))
root,out,extract=shared['ROOT'],shared['OUT'],shared['extract']
selection={
 'src/game/bigframes.cpp':['SpaceshipWindow::render_ship_init_rows','SpaceshipWindow::render_ship_load_surfaces','SpaceshipWindow::render_ship_draw_part','SpaceshipWindow::render_ship'],
 'src/auto/diplomacy.cpp':['DiploLeaderWindow::init_main_art','DiploLeaderWindow::init_military','DiploLeaderWindow::science_rank_top_techs','DiploLeaderWindow::science_draw_tech','DiploLeaderWindow::init_science','DiploLeaderWindow::init_portrait'],
 'src/auto/city.cpp':['CityWindow::scale','CityWindow::set_scaled_rect','CityWindow::layout_rects','CityWindow::draw_citizen_row','CityWindow::draw_citizens','CityWindow::draw_resource_yields','CityWindow::draw_resource_food','CityWindow::draw_resource_shields','CityWindow::draw_resource_trade','CityWindow::draw_resource_rates','CityWindow::draw_resource_map','CityWindow::draw_food_box','CityWindow::draw_production','city_window_draw_icon_row','CityWindow::draw_all','CityWindow::draw_info_panel','CityWindow::draw_supported_units','CityWindow::draw_improvements'],
 'src/auto/window.cpp':['ui_calc_item_spacing'],
 'src/auto/graphics.cpp':['sprite_draw_spaced_row'],
}
parts=[];functions=[];files={}
for file,names in selection.items():
 raw=(root/file).read_bytes();files[file]=hashlib.sha256(raw).hexdigest()
 text=raw.decode('utf8').replace('\r\n','\n')
 for name in names:
  body,line=extract(text,name)
  parts.append(('#define draw_resource_map draw_resource_map_native\n' if name=='CityWindow::draw_resource_map' else '')+f'#line {line} "{file}"\n{body}\n'+('#undef draw_resource_map\n' if name=='CityWindow::draw_resource_map' else ''))
  functions.append(dict(name=name,file=file,line=line,sha256=hashlib.sha256(body.encode()).hexdigest()))
(out/'window-bodies.inc').write_text('\n'.join(parts),encoding='utf8',newline='\n')
g=(root/'src/data/gamedata.cpp').read_text(encoding='utf8')
tables=[re.search(r'static const char dir_dy_table_block_init\[\] = "(?:\\.|[^"\\])*";',g).group()]
for axis in ['x','y']:
 tables.append(re.search(r'i8 city_resmap_draw_d'+axis+r'_table\[24\] = \{[^}]*\};',g).group())
(out/'window-yield-tables.inc').write_text('\n'.join(tables),encoding='utf8',newline='\n')
files['src/data/gamedata.cpp']=hashlib.sha256((root/'src/data/gamedata.cpp').read_bytes()).hexdigest()
files['data/native/fonts.bin']=hashlib.sha256((root/'data/native/fonts.bin').read_bytes()).hexdigest()
files['src/platform/text.c']=hashlib.sha256((root/'src/platform/text.c').read_bytes()).hexdigest()
(out/'window-extraction.json').write_text(json.dumps(dict(repository='richardpenman-civ2',functions=functions,sourceHashes=files,bodyPolicy='unchanged text, LF normalized, with #line source mapping'),indent=2)+'\n',encoding='utf8',newline='\n')
print(f'Extracted {len(functions)} unchanged window renderer bodies')

import struct
b=(root/'data/native/fonts.bin').read_bytes(); assert b[:8]==b'C2FONTS2'
pos=12; fonts=[]
for _ in range(struct.unpack_from('<I',b,8)[0]):
 face,h,weight,italic=struct.unpack_from('<BBHB',b,pos)
 cell=struct.unpack_from('<i',b,pos+8)[0];pos+=52;adv=[]
 for ch in range(256):
  a,d,x,y,w,gh=struct.unpack_from('<hhbbBB',b,pos);pos+=8+(w+7)//8*gh;adv.append(d)
 fonts.append('{'+','.join(map(str,[face,h,(weight>=600)+2*bool(italic),cell]))+',{'+','.join(map(str,adv))+'}}')
assert pos==len(b)
(out/'font-metrics.inc').write_text('struct ReviewFontMetrics { int face,height,style,cellHeight; short advance[256]; };\nstatic const ReviewFontMetrics reviewFonts[]={\n'+',\n'.join(fonts)+'\n};\n')
