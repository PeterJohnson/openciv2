#!/usr/bin/env python3
"""Replay all 16 map zooms at each HD density, without original graphics."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', type=Path, required=True)
    parser.add_argument('--exe', type=Path, default=ROOT/'build/OpenCiv2.exe' if os.name == 'nt' else ROOT/'build/OpenCiv2')
    parser.add_argument('--densities', type=int, nargs='+', choices=range(1,5), default=[1,2,3,4])
    args = parser.parse_args()
    files = {p.name.lower(): p for p in args.game.iterdir() if p.is_file()}
    for name in ('game.txt','rules.txt','labels.txt','he_auto.sav'):
        if name not in files:parser.error(f'--game needs {name}')
    work = Path(tempfile.mkdtemp(prefix='hd-zoom-', dir=ROOT/'build'))
    print('Results:', work, flush=True)

    def run(density):
        out = work/f'density-{density}';out.mkdir()
        game = out/'game';game.mkdir()
        for p in files.values():
            if p.suffix.lower() in ('.txt','.sav'):shutil.copyfile(p,game/p.name)
        shutil.copyfile(ROOT/'harness/CIV2.DAT',game/'CIV2.DAT')
        (game/'CIV.INI').write_text((ROOT/'harness/CIV.INI').read_text()+
                                  f'\n[OpenCiv2]\nOriginalGraphics=0\nGraphicsDensity={density}\n')
        env = dict(os.environ)
        for key in ('CIV2_CLASSIC','CIV2_DATA','CIV2_GAME','CIV2_TEST_NATIVE','CIV2_TEST_EXTRAS','CIV2_NORMAL_DESKTOP'):
            env.pop(key,None)
        env.update(CIV2_TEST_HD='1',CIV2_TEST_FIXES='1',CIV2_TEST_FULL='1024x768',CIV2_SEED='7',
                   CIV2_SCRIPT=str(ROOT/'harness/hd/zoom.txt'),CIV2_SHOT_DIR=str(out),
                   CIV2_HOOK_LOG=str(out/'hooks.log'),SDL_VIDEODRIVER='dummy',SDL_AUDIODRIVER='dummy')
        if os.name != 'nt':env['CIV2_DATA']=str(ROOT/'build/data')
        with (out/'output.log').open('wb') as log:
            subprocess.run([str(args.exe.resolve()),str(game)],env=env,stdout=log,
                           stderr=subprocess.STDOUT,timeout=240,check=True)
        hooks=(out/'hooks.log').read_text()
        assert 'script finished' in hooks and 'no function' not in hooks, out
        assert f'density {density}; original image loading disabled' in hooks
        maps=set();status=None
        preview=Image.new('RGB',(1280,1056),'#202622');draw=ImageDraw.Draw(preview)
        for i in range(16):
            with Image.open(out/f'zoom-{i:02d}.bmp') as raw:
                assert raw.size == (1024*density,768*density)
                im=raw.convert('RGB')
                region=im.crop(tuple(v*density for v in (10,76,750,748)))
                maps.add(hashlib.sha256(region.tobytes()).digest())
                # The stable status header must not rescale or be overwritten.
                # The lower pane legitimately follows the current map selection.
                pane=im.crop(tuple(v*density for v in (774,248,1014,306))).tobytes()
                if status is None:status=pane
                else:assert pane == status, (density,i-7,'map zoom changed status header')
                region.thumbnail((312,236))
                x,y=(i%4)*320,(i//4)*264
                preview.paste(region,(x,y+24));draw.text((x+6,y+5),f'Zoom {i-7:+d} / density {density}',fill='white')
        assert len(maps)==16, (density,'not all zoom levels rendered',len(maps))
        preview.save(out/'overview.png')
        print(f'Density {density}: all 16 zooms rendered; status header unchanged.',flush=True)

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(run,args.densities))


if __name__ == '__main__':
    main()
