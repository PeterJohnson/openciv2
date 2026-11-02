from pathlib import Path
import ast, hashlib, json, re
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'build/atlas-review/generated/other'
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'thunks.h').write_text('')

def extract(text,name):
 p=re.compile(r'^([A-Za-z_][\w:* \t]*?\s*\*?'+r'(?<![\w:])'+re.escape(name)+r'\([^;{}]*\)\s*\{)',re.M)
 matches=list(p.finditer(text))
 if len(matches)!=1: raise ValueError((name,len(matches)))
 m=matches[0];depth=1
 for t in re.finditer(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[{}]',text[m.end():]):
  if t.group()=='{':depth+=1
  elif t.group()=='}':depth-=1
  if depth==0:return text[m.start():m.end()+t.end()],text.count('\n',0,m.start())+1
 raise ValueError('Unclosed '+name)
selection={'src/auto/pedia.cpp': ['PediaWindow::'+n for n in '''create create_list_buttons create_advance_buttons create_detail_buttons draw_frame fill_background update_controls draw_item_list draw_list_icon draw_list_terrain_icon copy_list_item_name draw_advance_page draw_advance_requires draw_advance_children draw_advance_improvements draw_advance_units draw_advance_civ_facts draw_advance_tree draw_tree_stub draw_unit_page append_unit_fact draw_improvement_page draw_improvement draw_terrain_page draw_terrain_special_bonus draw_terrain_improve_rows draw_terrain_transform_column'''.split()]}
parts=[]; functions=[]
selection['src/auto/pedia.cpp'] += ['PediaWindow::load_improvement_text','PediaWindow::add_link']
selection['src/auto/window.cpp']=['Dialog::'+n for n in '''init_defaults construct init set_font set_title_font set_list_font set_columns set_list_rows set_current_pane set_listbox line_height button_width_for set_title set_width set_height set_position add_line add_option add_checkbox_option add_button set_default_choice find_option set_text_color draw_text_shadowed draw_text_line has_text_lines draw_wrapped_text option_group_index option_at column_of_option layout_sprites layout_list_pane layout_buttons layout_place_window compute_layout draw_option_cell draw_option_text draw_option draw_option_list create_radio_group create_checkboxes create_buttons fill_rect_bg render draw_text_default_font option_icon_width edit_row_height'''.split()]
selection['src/auto/window.cpp'] += ['Dialog::'+n for n in 'dialog_option_row_height dialog_list_row_height find_sprite uses_alt_text_color'.split()]
selection['src/auto/pedia.cpp'] += ['PediaWindow::'+n for n in 'update_describe_button clear_index_keys load_indexes load_advance_index load_improvement_index load_wonder_index load_unit_index load_government_index load_terrain_index load_concept_index sort_list'.split()]
selection['src/auto/window.cpp'] += ['Dialog::'+n for n in 'load_text load_text_ex load_text_section load_section_keyword load_game_section add_edit_field set_list_indent set_option_draw_fn'.split()]
selection['src/auto/window.cpp'] += ['FrameWindow::'+n for n in 'create layout draw_caption draw_frame_borders update_timer_text append_turn_status'.split()]
selection['src/auto/window.cpp'] += ['PictureWindow::open','Dialog::create_list_scrollbar','Dialog::count_group_options','Dialog::load_game_text','Dialog::add_sprite']
selection['src/auto/reports.cpp']=['PictureWindow::advisor_add_close_button','casualty_timeline_show','powergraph_show','historian_report_show','casualty_timeline_draw','credits_draw_scroll','DestroyedCivsWindow::draw_entry','DestroyedCivsWindow::draw_portrait','CouncilWindow::draw_background','CouncilWindow::create_buttons','CouncilWindow::draw_speech']
selection['src/auto/city.cpp']=['TaxRateDialog::paint','TaxRateDialog::calc_totals','city_button_change_add_options','city_text_append_build_turns']
selection['src/auto/mapview.cpp']=['minimap_calc_layout','minimap_tile_to_screen','minimap_tile_color','minimap_draw_view_rect','minimap_redraw']
selection['src/auto/game.cpp']=['status_draw_info','status_draw_civ_color','status_draw_end_of_turn','status_draw_cursor_loc','status_append_unit_orders','status_draw_active_unit','status_draw_tile_info','status_draw_stack_unit','status_draw_unit_panel','status_redraw']
selection['src/auto/city.cpp'] += ['TaxRateDialog::run','taxrate_balance']
selection['src/auto/civ.cpp']=['civ_choose_research_dialog','research_option_draw_advance']
selection['src/auto/reports.cpp'] += ['foreign_minister_show','foreign_minister_draw_civ_city']
# Leaf text and rectangle helpers execute unchanged too.
for f in (ROOT/'src').rglob('*.cpp'):
    t=f.read_text(encoding='utf8')
    for name in 'rect_set rect_set_xywh gfx_zoom_scale str_trim pedia_find_terrain_index str_append_comma str_append_colon str_append_period str_append_lparen str_append_rparen rect_inflate dialog_set_colors dialog_set_list_colors DibSurface::pedia_draw_tree_connector rect_width rect_height rect_deflate text_clear text_append text_append_label text_append_space text_append_colon text_append_lparen text_append_rparen text_append_string_id text_append_int text_append_comma text_append_period str_clear str_append_space label_string city_change_draw_option_icon city_shields_after_change city_production_category city_split_trade city_count_specialists city_specialist_type civ_research_cost civ_improvement_upkeep city_population_units tile_owner tile_city_owner tile_unit_owner unit_stack_first unit_stack_validate unit_max_hp unit_hp_remaining civ_total_population wonder_get_city civ_spaceship_launched status_calc_font_sizes status_wnd_repaint map_in_bounds map_wrap_x tile_visible_to tile_is_ocean tile_landmass tile_improvements tile_terrain tile_resource tile_has_hut city_at city_has_improvement civ_has_wonder wonder_is_expired civ_max_tax_rate diplo_attitude_level unit_next_in_stack unit_home_city_name unit_stack_sum tile_first_unit unit_max_moves text_append_population str_append_population civ_population civ_can_build_unit city_can_build_improvement civ_can_build_wonder PictureWindow::blit PictureWindow::blit_at str_append_long bit_index_split Dialog::load_text_noflags Dialog::column_of_index Button::create_with_callback civ_has_advance game_turn_to_year str_append_year str_append_percent str_concat str_append_gold int_clamp_c rect_offset int_clamp text_append_year text_append_percent text_append_gold text_append_str text_read_section_line text_next_token text_next_int str_parse_int_prefixed str_parse_hex str_parse_binary text_expand_vars text_set_string_arg text_set_string_arg_b text_set_number_arg text_set_label_arg dlg_checks_clear dlg_check_set dlg_check_get dlg_check_set_bool'.split():
        try: body,line=extract(t,name)
        except (ValueError,StopIteration): continue
        selection.setdefault(str(f.relative_to(ROOT)).replace('\\','/'),[]).append(name)
for file,names in selection.items():
    text=(ROOT/file).read_text(encoding='utf8')
    for name in names:
        body,line=extract(text,name)
        parts.append(f'#line {line} "{file}"\n{body}\n')
        functions.append(dict(file=file,name=name,line=line,sha256=hashlib.sha256(body.encode()).hexdigest()))
(OUT/'other-bodies.inc').write_text('\n'.join(parts),encoding='utf8')
files=set(selection)|{'src/data/gamedata.cpp','src/include/civ2types.h','src/include/civ2classes.h','data/native/fonts.bin','src/auto/controls.cpp','src/platform/controls.c','src/platform/scroll_theme.h','src/game/fixups.cpp'}
sourceHashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in sorted(files)}
assert len({f['name'] for f in functions})==len(functions)
(OUT/'extraction.json').write_text(json.dumps(dict(repository='richardpenman-civ2',functions=functions,sourceHashes=sourceHashes,bodyPolicy='Unchanged LF-normalized C++ bodies with source #line mappings; original class layouts, MSVC x86.'),indent=2),encoding='utf8')
print(f'Extracted {len(functions)} unchanged other-window functions')
g=(ROOT/'src/data/gamedata.cpp').read_text(encoding='utf8')
(OUT/'other-data.inc').write_text(g.split('void gamedata_init(void)')[0],encoding='utf8')
