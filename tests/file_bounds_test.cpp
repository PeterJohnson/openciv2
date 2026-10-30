// SOURCE src/auto/game.cpp save_read_units_cities
// SOURCE src/auto/sound.cpp snd_read_pcm_format
// SOURCE src/auto/sound.cpp snd_wave_load_file
// SOURCE src/auto/sound.cpp snd_wave_open_stream
#include <cassert>
#include <cstdio>
#include <cstring>
#include <vector>
#include "native.h"
#include "win32_types.h"
#include "civ2types.h"
typedef unsigned int uint;
static_assert(sizeof(void *) == 4, "run with a 32-bit compiler");
static_assert(sizeof(Unit) == 32 && sizeof(City) == 88 && sizeof(WaveSource) == 188,
              "production layouts");
static GameState game;
static struct {
    Unit units[2048];
} power_graph_history_block;
static Unit *const units = power_graph_history_block.units;
static City cities[256];
static struct {
    short unit, city;
} next_ids;
static int reads, fail_read;
static size_t _fread(void *dst, size_t n, size_t count, FILE *) {
    reads++;
    if (fail_read == reads)
        return 0;
    memset(dst, 0, n * count);
    return count;
}
static struct {
    int total_buffer_bytes;
    WaveSource *sources;
} snd_wave;
static std::vector<unsigned char> fmt;
static DWORD declared_size;
static size_t fmt_pos;
static int closed, shown_error, allocated, format_reads, max_read;
static WaveSource record;
static HMMIO mmioOpenA(LPSTR, LPMMIOINFO, DWORD) { return 1; }
static MMRESULT mmioDescend(HMMIO, MMCKINFO *chunk, MMCKINFO *, UINT flags) {
    if (flags == 0x10 && chunk->ckid == 0x20746d66)
        chunk->cksize = declared_size;
    else
        chunk->cksize = 4;
    return 0;
}
static LONG mmioRead(HMMIO, HPSTR dst, LONG n) {
    assert(n >= 0);
    format_reads++;
    if (n > max_read)
        max_read = n;
    size_t count = (size_t)n < fmt.size() - fmt_pos ? (size_t)n : fmt.size() - fmt_pos;
    if (count != 0) {
        memcpy(dst, fmt.data() + fmt_pos, count);
    }
    fmt_pos += count;
    return (LONG)count;
}
static MMRESULT mmioAscend(HMMIO, MMCKINFO *, UINT) {
    assert(fmt_pos == declared_size);
    return 0;
}
static MMRESULT mmioClose(HMMIO, UINT) {
    closed++;
    return 0;
}
static MMRESULT mmioGetInfo(HMMIO, MMIOINFO *info, UINT) {
    memset(info, 0, sizeof *info);
    return 0;
}
static MMRESULT mmioAdvance(HMMIO, MMIOINFO *, UINT) { return 0; }
static HGLOBAL GlobalAlloc(UINT, size_t n) {
    assert(n == sizeof record);
    allocated++;
    return 1;
}
static void *GlobalLock(HGLOBAL) { return &record; }
static HGLOBAL GlobalFree(HGLOBAL) { return 0; }
static void snd_show_error(int code) { shown_error = code; }
static void snd_wave_stream_refill(WaveSource *) {}
#define _memset memset
#include "production.inc"
static void wave(size_t actual, DWORD declared) {
    fmt.assign(actual, 0x5a);
    declared_size = declared;
    fmt_pos = 0;
    WAVEFORMATEX pcm = {1, 1, 22050, 22050, 1, 8, 0};
    if (actual != 0) {
        memcpy(fmt.data(), &pcm, actual < 16 ? actual : 16);
    }
    closed = shown_error = allocated = format_reads = max_read = 0;
    snd_wave.sources = nullptr;
}
static int load(int which) {
    char path[] = "test.wav";
    return which ? snd_wave_open_stream(path, 0, 3) : snd_wave_load_file(path, 0, 3, nullptr);
}
int main() {
    for (int version : {0x26, 0x29, 0x2c}) {
        for (int count : {-1, 2049, 32767}) {
            game.num_units = (short)count;
            game.num_cities = 0;
            reads = 0;
            next_ids.unit = 7;
            assert(save_read_units_cities(version, 0) == 0 && reads == 0 && next_ids.unit == 7);
        }
        for (int count : {-1, 257, 32767}) {
            game.num_units = 0;
            game.num_cities = (short)count;
            reads = 0;
            next_ids.city = 9;
            assert(save_read_units_cities(version, 0) == 0 && reads == 0 && next_ids.city == 9);
        }
        game.num_units = game.num_cities = 0;
        reads = 0;
        assert(save_read_units_cities(version, 0) == 1 && reads == 0);
        game.num_units = 2048;
        game.num_cities = 256;
        reads = fail_read = 0;
        assert(save_read_units_cities(version, 0) == 1 && reads > 0);
        game.num_units = game.num_cities = 1;
        reads = 0;
        fail_read = 1;
        assert(save_read_units_cities(version, 0) == 0 && reads == 1);
        fail_read = 0;
    }
    for (int which = 0; which < 2; which++) {
        for (int n = 0; n < 16; n++) {
            wave(n, n);
            assert(load(which) == 10);
            assert(closed == 1 && shown_error == 10 && allocated == 0);
        }
        wave(7, 8);
        assert(load(which) == 8 && closed == 1 && allocated == 0 && shown_error == 0);
        for (int n : {16, 18, 1024}) {
            wave(n, n);
            assert(load(which) == 0);
            assert(fmt_pos == (size_t)n && allocated == 1);
            assert(record.samples_per_sec == 22050 && record.bits_per_sample == 8 &&
                   record.channels == 1);
            assert(max_read <= 256 && shown_error == 0 && snd_wave.sources == &record);
        }
        for (int n : {0, 8, 15, 17, 280}) {
            wave(n, n < 16 ? 16 : 1024);
            assert(load(which) == 8);
            assert(closed == 1 && allocated == 0 && shown_error == 0);
        }
        wave(16, 0xffffffffu);
        assert(load(which) == 8 && max_read <= 256 && closed == 1);
        wave(16, 16);
        fmt[14] = 16;
        assert(load(which) == 10 && closed == 1 && shown_error == 10);
    }
    puts("files: count bounds in three save versions, both WAV loaders, "
         "extensions/truncation/errors passed");
}
