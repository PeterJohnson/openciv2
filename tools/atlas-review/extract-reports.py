"""Extract additional, unchanged report rendering bodies from this checkout."""
from pathlib import Path
import ast, hashlib, json, re, struct

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'build/atlas-review/generated'
OUT.mkdir(parents=True, exist_ok=True)
# Reuse the balanced C++ extractor without running another extraction campaign.
module = ast.parse((ROOT / 'tools/atlas-review/extract-engine.py').read_text())
node = next(n for n in module.body if isinstance(n, ast.FunctionDef) and n.name == 'extract')
exec(compile(ast.Module(body=[node], type_ignores=[]), '<shared extractor>', 'exec'))
SELECTION = {
    'src/auto/window.cpp': ['ui_calc_item_spacing'],
    'src/auto/graphics.cpp': ['sprite_draw_spaced_row'],
    'src/auto/reports.cpp': [
        'advisor_draw_city_citizens', 'attitude_advisor_draw',
        'defense_append_ability_label', 'defense_draw_unit_stats', 'defense_draw_unit_losses',
        'defense_minister_draw', 'intel_draw_civ_heading', 'intel_draw_civ_facts',
        'intel_draw_contacts', 'intel_draw_advances', 'intel_report_draw',
        'top_cities_draw', 'demographics_draw_rank', 'demographics_gather',
        'demographics_row_label', 'demographics_next_row', 'demographics_draw', 'hall_of_fame_draw',
    ],
    'src/auto/civ.cpp': ['civ_city_style_era', 'science_advisor_draw', 'civ_score_draw_citizens', 'civ_score_draw_wonders',
                         'civ_score_draw_objectives', 'civ_score_draw_total', 'civ_score_window_draw'],
    'src/auto/city.cpp': ['trade_advisor_draw_left_cell', 'trade_advisor_draw_right_cell',
                         'trade_advisor_draw', 'city_status_draw', 'wonders_report_draw'],
}
parts, functions, source_hashes = [], [], {}
for file, names in SELECTION.items():
    raw = (ROOT/file).read_bytes()
    source_hashes[file] = hashlib.sha256(raw).hexdigest()
    text = raw.decode().replace('\r\n', '\n')
    for name in names:
        body, line = extract(text, name)
        parts.append(f'#line {line} "{file}"\n{body}\n')
        functions.append(dict(name=name, file=file, line=line,
                              sha256=hashlib.sha256(body.encode()).hexdigest()))
for file in ['src/include/civ2types.h','src/data/gamedata.cpp','data/native/fonts.bin']:
    source_hashes[file] = hashlib.sha256((ROOT/file).read_bytes()).hexdigest()
(OUT/'report-bodies.inc').write_text('\n'.join(parts), encoding='utf8', newline='\n')
(OUT/'report-extraction.json').write_text(json.dumps(dict(
    repository='richardpenman-civ2', functions=functions, sourceHashes=source_hashes,
    bodyPolicy='Unchanged C++ bodies, LF normalized, source-mapped with #line'), indent=2)+'\n')
joined = '\n'.join(parts)
requirements = dict(
    objects={v: sorted(set(re.findall(r'\b'+v+r'(?:\[[^\]]+\])?\.([A-Za-z_]\w*)', joined)))
            for v in sorted(set(re.findall(r'\b([A-Za-z_]\w*)\.', joined)))},
    fields={v: sorted(set(re.findall(r'\b'+v+r'(?:\[[^\]]+\])?\.([A-Za-z_]\w*)', joined)))
            for v in ['advisor_state','cities','civs','game','unit_types','units','city_calc']},
    calls=sorted(set(re.findall(r'\b([A-Za-z_]\w*)\(', joined)))
)
(OUT/'report-requirements.json').write_text(json.dumps(requirements, indent=2)+'\n')
gamedata = (ROOT/'src/data/gamedata.cpp').read_text(encoding='utf8')
strings = []
for name in sorted(set(re.findall(r'\bstr_[A-Za-z_0-9]+\b(?!\s*\()', joined))):
    match = re.search(r'(?:char|i8|u8)\s+'+re.escape(name)+r'\[(\d+)\]\s*=\s*((?:"(?:\\.|[^"\\])*"|\{[^}]*\}));', gamedata)
    if not match:
        raise ValueError('Missing native string: '+name)
    strings.append(f'char {name}[{match[1]}] = {match[2]};')
(OUT/'report-strings.inc').write_text('\n'.join(strings)+'\n')
data = (ROOT/'data/native/fonts.bin').read_bytes()
pos = 12
leading = []
for i in range(struct.unpack_from('<I',data,8)[0]):
    face,height,weight,italic = struct.unpack_from('<BBHB',data,pos)
    cell = struct.unpack_from('<i',data,pos+8)[0]
    external = struct.unpack_from('<i',data,pos+24)[0]
    leading.append([face,height,(weight>=600)+2*bool(italic),cell+external])
    pos += 52
    for c in range(256):
        width,gh = data[pos+6:pos+8]
        pos += 8+(width+7)//8*gh
assert pos == len(data)
(OUT/'report-font-leading.inc').write_text('static const int reportFontLeading[][4] = {\n'+
    ',\n'.join('{'+','.join(map(str,row))+'}' for row in leading)+'\n};\n')
print(f'Extracted {len(functions)} unchanged report renderer bodies')
