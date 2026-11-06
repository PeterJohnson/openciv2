/* Tests the production HD compositor with a tiny authored alpha fixture.
   No original game, window system or replacement-art collection is required. */
#include "../src/platform/hd.h"
#include "../src/platform/plat.h"
#include <assert.h>

char plat_data_dir[1024];
static Bitmap *bitmaps[8];
void plat_log(const char *fmt, ...) { (void)fmt; }
void plat_fatal(const char *fmt, ...)
{
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stderr, fmt, ap);
    va_end(ap);
    exit(2);
}
UINT WINAPI GetPrivateProfileIntA(LPCSTR section, LPCSTR key, INT value, LPCSTR file)
{
    const char *s = getenv(key);
    (void)section;
    (void)file;
    return s ? (UINT)atoi(s) : value;
}
unsigned char *bmp_row(const Bitmap *b, int y)
{
    return b->bits + (b->bottom_up ? b->h - 1 - y : y) * b->stride;
}
Bitmap *bmp_of_bits(const void *bits)
{
    int i;
    for (i = 0; i < 8; i++)
        if (bitmaps[i] && bitmaps[i]->bits == bits)
            return bitmaps[i];
    return NULL;
}
COLORREF surf_get(Bitmap *b, int x, int y)
{
    unsigned n = bmp_row(b, y)[x];
    RGBQUAD c = b->colors[n];
    return RGB(c.rgbRed, c.rgbGreen, c.rgbBlue);
}
static Bitmap *bitmap(int index, int bottom)
{
    Bitmap *b = calloc(1, sizeof *b);
    int i;
    const unsigned char *pal = hd_palette();
    b->w = 16;
    b->h = 12;
    b->stride = 16;
    b->bpp = 8;
    b->bottom_up = bottom;
    b->bits = calloc(192, 1);
    for (i = 0; i < 256; i++) {
        b->colors[i].rgbRed = pal[i * 3];
        b->colors[i].rgbGreen = pal[i * 3 + 1];
        b->colors[i].rgbBlue = pal[i * 3 + 2];
    }
    bitmaps[index] = b;
    return b;
}
int main(int argc, char **argv)
{
    Bitmap *a, *b;
    int id, w, h, d, x, y;
    uint32_t *before;
    int token = 0, clone = 0;
    assert(argc == 2);
    snprintf(plat_data_dir, sizeof plat_data_dir, "%s", argv[1]);
    hd_init(0, 0);
    if (getenv("OriginalGraphics")) {
        assert(!hd_enabled);
        puts("original mode: atlas not opened");
        return 0;
    }
    assert(hd_enabled);
    d = hd_density;
    assert(hd_virtual_file("C:/Game/WONDER.DLL"));
    assert(!hd_virtual_file("RULES.TXT"));
    id = hd_file("C:\\Game\\TEST.GIF");
    assert(id);
    hd_size(id, &w, &h);
    assert(w == 4 && h == 4);
    assert(hd_indices(id)[5] == 2);
    a = bitmap(0, 0);
    b = bitmap(1, 1);
    hd_sync(a);
    hd_draw(a->bits, id, 2, 2, 8, 8, 4, 4, 9, 9, -1);
    for (y = 0; y < 12 * d; y++)
        for (x = 0; x < 16 * d; x++) {
            uint32_t c = a->hd[y * 16 * d + x];
            if (x < 4 * d || x >= 9 * d || y < 4 * d || y >= 9 * d)
                assert(c == 0xff000000u);
            /* Transparent magenta RGB must not bleed into the green silhouette. */
            assert((c & 0xff00ffu) == 0);
        }
    assert((a->hd[6 * d * 16 * d + 6 * d] & 0xff00u) > 0);
    hd_copy(b->bits, a->bits, 0, 0, 2, 2, 10, 10);
    assert(b->hd[4 * d * 16 * d + 4 * d] == a->hd[6 * d * 16 * d + 6 * d]);
    before = malloc((size_t)16 * 12 * d * d * 4);
    memcpy(before, b->hd, (size_t)16 * 12 * d * d * 4);
    hd_copy(b->bits, b->bits, 2, 2, 0, 0, 10, 10);
    assert(b->hd[6 * d * 16 * d + 6 * d] == before[4 * d * 16 * d + 4 * d]);
    free(before);
    /* A write of the same indexed color still clears previously drawn art. */
    bmp_row(a, 6)[6] = 0;
    hd_changed(a->bits, 6, 6, 1, 1);
    for (y = 6 * d; y < 7 * d; y++)
        for (x = 6 * d; x < 7 * d; x++)
            assert(a->hd[y * 16 * d + x] == 0xff000000u);
    bmp_row(b, 0)[0] = 2;
    hd_sync(b);
    assert(b->hd[0] == 0xff00ff00u);
    hd_sprite_capture(&token, a->bits, 2, 2, 8, 8, -2);
    hd_sprite_copy(&clone, &token);
    hd_sprite_forget(&token);
    assert(hd_sprite_draw(&clone, b->bits, 0, 0, 8, 8, 0, 0, 16, 12, -1));
    hd_sprite_forget(&clone);
    assert(!hd_sprite_draw(&clone, b->bits, 0, 0, 8, 8, 0, 0, 16, 12, -1));
    /* Selective faction variants retain contrasting detail and alpha. They
       follow cloned sprites; explicit silhouettes override the variant. */
    memset(a->bits, 0, 192);
    memset(b->bits, 0, 192);
    hd_changed(a->bits, 0, 0, 16, 12);
    hd_changed(b->bits, 0, 0, 16, 12);
    assert(hd_variant(id, 2) && !hd_variant(id, 3));
    hd_draw(a->bits, hd_variant(id, 2), 0, 0, 4, 4, 0, 0, 16, 12, -1);
    hd_sprite_bind(&token, "file/test");
    hd_sprite_tint(&token, 8, 2);
    hd_sprite_copy(&clone, &token);
    hd_sprite_forget(&token);
    assert(hd_sprite_draw(&clone, b->bits, 0, 0, 4, 4, 0, 0, 16, 12, -1));
    assert(!memcmp(a->hd, b->hd, (size_t)16 * 12 * d * d * 4));
    hd_changed(a->bits, 0, 0, 16, 12);
    hd_changed(b->bits, 0, 0, 16, 12);
    hd_draw(a->bits, id, 0, 0, 4, 4, 0, 0, 16, 12, 3);
    assert(hd_sprite_draw(&clone, b->bits, 0, 0, 4, 4, 0, 0, 16, 12, 3));
    assert(!memcmp(a->hd, b->hd, (size_t)16 * 12 * d * d * 4));
    hd_sprite_tint(&clone, 8, 3);
    hd_changed(b->bits, 0, 0, 16, 12);
    assert(hd_sprite_draw(&clone, b->bits, 0, 0, 4, 4, 0, 0, 16, 12, -1));
    assert(!memcmp(a->hd, b->hd, (size_t)16 * 12 * d * d * 4));
    hd_sprite_forget(&clone);
    for (x = 0; x < 2; x++) {
        hd_bitmap_destroy(bitmaps[x]);
        free(bitmaps[x]->bits);
        free(bitmaps[x]);
    }
    printf("HD compositor: density %d passed\n", d);
    return 0;
}
