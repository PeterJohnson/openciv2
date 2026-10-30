"""Compile selected real window renderers with a finite drawing/fixture boundary."""
from pathlib import Path
import runpy, json, hashlib
shared=runpy.run_path(str(Path(__file__).with_name('extract-engine.py')))
root,out,extract=shared['ROOT'],shared['OUT'],shared['extract']
selection={
 'src/game/bigframes.cpp':['SpaceshipWindow::render_ship_init_rows','SpaceshipWindow::render_ship_load_surfaces','SpaceshipWindow::render_ship_draw_part','SpaceshipWindow::render_ship'],
 'src/auto/diplomacy.cpp':['DiploLeaderWindow::init_main_art','DiploLeaderWindow::init_military','DiploLeaderWindow::science_rank_top_techs','DiploLeaderWindow::init_science','DiploLeaderWindow::init_portrait'],
 'src/auto/city.cpp':['CityWindow::scale','CityWindow::set_scaled_rect','CityWindow::layout_rects','CityWindow::draw_citizen_row','CityWindow::draw_citizens','CityWindow::draw_food_box','CityWindow::draw_production','city_window_draw_icon_row','CityWindow::draw_all','CityWindow::draw_info_panel','CityWindow::draw_supported_units','CityWindow::draw_improvements'],
 'src/auto/window.cpp':['ui_calc_item_spacing'],
 'src/auto/graphics.cpp':['sprite_draw_spaced_row'],
}
parts=[];functions=[];files={}
for file,names in selection.items():
 raw=(root/file).read_bytes();files[file]=hashlib.sha256(raw).hexdigest()
 text=raw.decode('utf8').replace('\r\n','\n')
 for name in names:
  body,line=extract(text,name)
  parts.append(f'#line {line} "{file}"\n{body}\n')
  functions.append(dict(name=name,file=file,line=line,sha256=hashlib.sha256(body.encode()).hexdigest()))
(out/'window-bodies.inc').write_text('\n'.join(parts),encoding='utf8',newline='\n')
(out/'window-extraction.json').write_text(json.dumps(dict(repository='richardpenman-civ2',functions=functions,sourceHashes=files,bodyPolicy='unchanged text, LF normalized, with #line source mapping'),indent=2)+'\n',encoding='utf8',newline='\n')
print(f'Extracted {len(functions)} unchanged window renderer bodies')
