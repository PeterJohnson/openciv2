"""Compile selected, unchanged production functions against small test providers.

No game files or SDL are needed. Use a 32-bit C++ compiler: CXX='g++ -m32'
(default), or CXX=cl in an x86 Visual Studio developer shell. Both debug and
optimized builds run. The fixture names the functions it needs with // SOURCE
lines; extraction fails if a name is absent or ambiguous. Production headers
provide the serialized types; providers replace only the surrounding services.
"""
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def extract(source, name):
    matches = list(re.finditer(r'^.*\b' + re.escape(name) + r'\([^;]*?\)\s*\n\s*\{', source, re.M))
    if len(matches) != 1:
        raise ValueError(f'{name}: expected one definition, got {len(matches)}')
    start = matches[0].start()
    body = source.index('{', matches[0].start())
    tokens = re.finditer(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[{}]', source[body:])
    depth = 0
    for token in tokens:
        if token[0] == '{':
            depth += 1
        elif token[0] == '}':
            depth -= 1
            if depth == 0:
                return source[start:body + token.end()] + '\n'
    raise ValueError(f'{name}: unterminated definition')


def main():
    fixture = Path(sys.argv[1]).resolve()
    source = fixture.read_text(encoding='utf-8')
    functions = []
    for path, name in re.findall(r'^// SOURCE (\S+) (\S+)$', source, re.M):
        functions.append(extract((ROOT / path).read_text(encoding='utf-8'), name))
    if not functions:
        raise ValueError('fixture must select production functions')
    cxx = shlex.split(os.environ.get('CXX', 'g++ -m32'), posix=os.name != 'nt')
    msvc = Path(cxx[0]).stem.lower() == 'cl'
    with tempfile.TemporaryDirectory(prefix='civ2-source-test-') as temp:
        out = Path(temp)
        (out / 'production.inc').write_text('\n'.join(functions), encoding='utf-8')
        (out / 'test_runtime.h').write_text('''#ifdef _MSC_VER
#include <cstdlib>
#include <crtdbg.h>
#include <rtcapi.h>
static int __cdecl source_test_rtc_error(int, const char *, int, const char *, const char *, ...) {
    std::exit(86);
}
struct SourceTestRuntime {
    SourceTestRuntime() {
        _set_error_mode(_OUT_TO_STDERR);
        _set_abort_behavior(0, _WRITE_ABORT_MSG | _CALL_REPORTFAULT);
#ifdef __MSVC_RUNTIME_CHECKS
        _RTC_SetErrorFunc(source_test_rtc_error);
#endif
    }
} source_test_runtime;
#endif
''', encoding='utf-8')
        for mode in ['debug', 'optimized']:
            exe = out / ('probe.exe' if os.name == 'nt' else 'probe')
            if msvc:
                flags = ['/nologo', '/std:c++17', '/EHsc', '/W3', '/GS', '/D_CRT_SECURE_NO_WARNINGS',
                         '/I' + str(out), '/I' + str(ROOT / 'src/include'), '/I' + str(ROOT / 'src/platform'),
                         '/FI' + str(out / 'test_runtime.h'),
                         '/Fe:' + str(exe), '/Fo:' + str(out / 'probe.obj')]
                flags += ['/Od', '/RTC1'] if mode == 'debug' else ['/O2']
            else:
                flags = ['-std=c++17', '-fsigned-char', '-I' + str(out), '-I' + str(ROOT / 'src/include'),
                         '-I' + str(ROOT / 'src/platform'), '-o', str(exe), '-Wall', '-Wextra']
                flags += ['-O0', '-ftrivial-auto-var-init=pattern'] if mode == 'debug' else ['-O2']
                flags += shlex.split(os.environ.get('SOURCE_TEST_FLAGS', ''))
            subprocess.run([*cxx, *flags, str(fixture)], check=True, cwd=out, timeout=60)
            subprocess.run([str(exe)], check=True, cwd=out, timeout=30)
            print(f'{fixture.name}: {mode} passed', flush=True)


if __name__ == '__main__':
    main()
