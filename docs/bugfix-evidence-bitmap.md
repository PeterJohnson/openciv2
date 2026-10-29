# BMP undefined-state fixes

These two fixes follow the "Memory errors of the original" policy in [BUGS.md](BUGS.md):
enabled in every mode, including classic, replays and network games. They do not change
game rules, the save format or network messages. `BF-*` below are identifiers from
Peter Johnson's independent reconstruction's bugfix ledger, not new OpenCiv2 `B*` IDs.

| Finding | Original and current site | Evidence and correction |
| --- | --- | --- |
| BF-011 | `0046fbf3`, `gfx_save_bmp_640x480` | The original loop at `0046fcd9..0046fd0e` initializes only B/G/R; fixed colors and the palette callback also write only those three components. `0046fec3` writes all 1,024 bytes. Initialize the fourth, reserved byte of each entry to zero. RGB, headers and pixels retain their existing producers. An original Windows export contained 48 nonzero reserved bytes; those accidental stack bytes are deliberately not reproduced. |
| BF-073 | `0046f460`, `gfx_load_bmp_640x480` | The RLE8 branch starts at `pixel_ptr(0,height-1)`, but the sole X initializer (`0046f729`) belongs to the uncompressed branch. A first delta reaches `0046f9e8` using an unwritten X. Initialize X to zero at RLE8 entry, matching the initial pointer. |

The current source still contains both defects at base `17842e4497c5a6d3d5be9245cf080ce0dde535fc`.
The RLE change deliberately retains the decoder's vertical-first delta and its existing
cursor behavior at end-of-line. This is not a general rewrite or validation of RLE input;
output bounds and truncated packets remain a separate tranche.

Run the focused regression with a 32-bit C++ compiler:

```sh
CXX='g++ -m32' python3 tests/source_probe.py tests/bitmap_undefined_test.cpp
# Or, in an x86 Visual Studio developer shell:
set CXX=cl
python tests/source_probe.py tests/bitmap_undefined_test.cpp
```

The runner extracts the unchanged production function definitions, compiles them against
the project's types and small stdio/palette/surface providers, and executes debug and
optimized builds. It tests a first delta, an ordinary encoded run, all 256 reserved bytes
with default and supplied palettes, and retained RGB/pixel output. This is executable
source-level coverage; it does not run the window system, full application or replay suite.
