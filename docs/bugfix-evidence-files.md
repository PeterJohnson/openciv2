# File-loading boundary fixes

These are unconditional memory-safety corrections under [BUGS.md](BUGS.md), including
classic mode, replays and network games. No valid record layout, game rule or packet format
changes. `BF-*` identifies Peter Johnson's independent reconstruction's evidence ledger.

| Finding | Original and current site | Evidence and port decision |
| --- | --- | --- |
| BF-091 | `004732a6`, `save_read_units_cities` | Serialized signed counts reach bulk reads (`count * 32` / `count * 88`) or legacy per-record loops without a bounds check. Negative counts become huge bulk sizes; excessive positive counts cross the backing. Reject before reads and ID fixup, using **this port's** `power_graph_history_block.units[2048]` and `cities[256]`. Do not import the other reconstruction's 2,050-unit extent or change creation limits. |
| BF-111 | `005d4c5f` / `005d4f6a`, both WAV loaders | A short `fmt ` chunk leaves sample-rate/bit-depth or other copied PCM fields unwritten. A complete read shorter than 16 bytes follows the existing unsupported-format result 10; a truncated read follows result 8. Both close the file and publish no sound record. |
| BF-305 | Same WAV loaders | The original reads the declared format size into a 16-byte local; OpenCiv2 uses an 18-byte `WAVEFORMATEX`, still too small for arbitrary extensions. Read the 16 retained bytes and consume extensions in bounded 256-byte pieces. No allocation proportional to untrusted size, signed-length conversion or overwrite of neighboring locals. |

The Bonaparte scenario's `TORPEDOS.WAV` was the independent reconstruction's real-world
18-byte PCM witness. The original admitted and played it, despite writing past its local.
OpenCiv2 already accommodates 18 bytes; the fix preserves that case and additionally handles
larger extensions without overflowing `WAVEFORMATEX`. Existing rate/bit-depth checks and the
first 16 published format bytes remain unchanged; no new audio codec is inferred.

Base checked: `17842e4497c5a6d3d5be9245cf080ce0dde535fc`. Run:

```sh
CXX='g++ -m32' python3 tests/source_probe.py tests/file_bounds_test.cpp
# Or: set CXX=cl, in an x86 Visual Studio developer shell, then the Python command.
```

The probe compiles the actual three loader bodies and shared format reader with production
serialized/Win32 types and stub file/MMIO/allocation providers. Debug and optimized runs
cover negative/excess/zero/max counts in three save versions, short reads, both WAV entry
points, 0..15-byte formats, 16/18/1024-byte formats, a huge declaration with short backing,
unsupported bit depth, retained PCM fields, cleanup and absence of allocation on rejection.
It does not execute the physical audio device, full file-loading UI or replay suite.

Scope is deliberately limited to record **counts** and PCM format **extents**. City/unit
field validation, map dimensions, event counts, state-image/delta imports, BMP decoding and
unrelated sound-loader resource leaks remain separate work. A rejected load may already
have imported its game header; this does not claim an atomic whole-save transaction.
