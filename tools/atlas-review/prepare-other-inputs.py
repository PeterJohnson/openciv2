"""Read local data/media for composed scenes; no original sheets are published."""
from pathlib import Path
import argparse, hashlib, importlib.util, io, json, re
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
PACK=ROOT/'assets/atlas-hd'
spec=importlib.util.spec_from_file_location('reports',ROOT/'tools/atlas-review/prepare-report-inputs.py')
reports=importlib.util.module_from_spec(spec);spec.loader.exec_module(reports)
section=reports.section
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--game',type=Path,required=True);a=ap.parse_args()
    rules=(a.game/'RULES.TXT').read_text(encoding='cp1252')
    result={k:[[v.strip() for v in s.split(',')] for s in section(rules,k)] for k in ['CIVILIZE','UNITS','IMPROVE','TERRAIN']}
    game=(a.game/'GAME.TXT').read_text(encoding='cp1252')
    result['dialogs']={k:re.split(r'\n@[A-Z][A-Z0-9_]*\n',game.split('@'+k+'\n',1)[1],1)[0].strip().splitlines() for k in ['MAINMENU','RESEARCH','GAMEOPTIONS','OPTIONS','QUIT','FINDCITY'] if '@'+k+'\n' in game}
    result['sourceHashes']={n:hashlib.sha256((a.game/n).read_bytes()).hexdigest() for n in ['RULES.TXT','GAME.TXT']}
    (PACK/'review/fixtures/other-windows/catalog.json').write_text(json.dumps(result,indent=2)+'\n')
    spec=importlib.util.spec_from_file_location('original',ROOT/'tools/atlas-review/original-assets.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    out=PACK/'review/original-local/other-windows';data=json.loads((out/'bindings.json').read_text())
    for key,b in m.resources(a.game/'mk.dll'):
        if key[1] not in [10000,10001,220] or not b.startswith(b'GIF'):continue
        im=Image.open(io.BytesIO(b));file=out/f'mk.dll-{key[1]}.png';im.convert('RGBA').save(file)
        data['bindings'][f'mk.dll/{key[1]}']=dict(file=file.relative_to(PACK).as_posix(),width=im.width,height=im.height)
    im=Image.open(a.game/'SCREDITS.GIF');file=out/'credits.png';im.convert('RGBA').save(file)
    data['bindings']['credits']=dict(file=file.relative_to(PACK).as_posix(),width=im.width,height=im.height)
    data['sourceHashes']['SCREDITS.GIF']=hashlib.sha256((a.game/'SCREDITS.GIF').read_bytes()).hexdigest()
    data['missingMedia']=['council0.avi','council1.avi','council2.avi','winwin.avi']
    (out/'bindings.json').write_text(json.dumps(data,indent=2)+'\n')
    print('Prepared encyclopedia/dialog inputs and local endgame media')
if __name__=='__main__':main()
