/* True-color backing surfaces for the indexed game. The indexed planes remain
 * available for legacy color queries; every transfer preserves the HD plane.
 * Only the presentation density changes, never game geometry or input. */
#include "hd.h"
#include "plat.h"
#define STBI_ONLY_PNG
#define STBI_NO_STDIO
#define STBI_MAX_DIMENSIONS 16384
#define STB_IMAGE_IMPLEMENTATION
#include "../third_party/stb_image/stb_image.h"

int hd_enabled, hd_density = 1;
typedef struct {
    char key[160];
    uint32_t w, h, offset, length, indices;
    unsigned char *indexed, *rgba;
    int pw, ph;
    int cx, cy, cw, ch; /* dynamic crop, in source logical coordinates */
    uint64_t used;
} Image;
static Image *images;
static unsigned count;
static unsigned catalog_count;
static FILE *pack;
static uint64_t tick, cache_bytes;
static unsigned char palette[768];
static uint32_t palette32[256];
static uint32_t read32(FILE *f)
{
    unsigned char b[4];
    if (fread(b, 1, 4, f) != 4)
        plat_fatal("Truncated Atlas HD pack");
    return b[0] | (uint32_t)b[1] << 8 | (uint32_t)b[2] << 16 | (uint32_t)b[3] << 24;
}

void hd_init(int classic, int test)
{
    char path[1200], magic[8];
    long size;
    unsigned i;
    hd_enabled = !classic && !test && !GetPrivateProfileIntA("OpenCiv2", "OriginalGraphics", 0, "CIV.INI");
    /* Reference replays remain original by default. Explicit HD replays exercise
       the same executable and platform layer as interactive play. */
    if (getenv("CIV2_TEST_HD"))
        hd_enabled = !classic && atoi(getenv("CIV2_TEST_HD")) != 0 &&
                     !GetPrivateProfileIntA("OpenCiv2", "OriginalGraphics", 0, "CIV.INI");
    if (!hd_enabled)
        return;
    snprintf(path, sizeof path, "%s/atlas-hd.pack", plat_data_dir);
    pack = fopen(path, "rb");
    if (!pack)
        plat_fatal("Atlas HD graphics missing: %s. Rebuild/package the graphics, or set [OpenCiv2] "
                   "OriginalGraphics=1 in CIV.INI.",
                   path);
    fseek(pack, 0, SEEK_END);
    size = ftell(pack);
    rewind(pack);
    if (fread(magic, 1, 8, pack) != 8 || memcmp(magic, "C2ATLAS1", 8))
        plat_fatal("Invalid Atlas HD pack");
    count = read32(pack);
    if (count > 8192 || size < 780 + (long)count * 180)
        plat_fatal("Invalid Atlas HD index");
    if (fread(palette, 1, 768, pack) != 768)
        plat_fatal("Invalid Atlas HD palette");
    for (i = 0; i < 256; i++)
        palette32[i] = 0xff000000u | palette[i * 3] << 16 | palette[i * 3 + 1] << 8 | palette[i * 3 + 2];
    catalog_count = count;
    images = calloc(8192, sizeof *images);
    if (!images)
        plat_fatal("Out of memory loading Atlas HD index");
    for (i = 0; i < count; i++) {
        Image *a = images + i;
        if (fread(a->key, 1, 160, pack) != 160 || !memchr(a->key, 0, 160))
            plat_fatal("Invalid Atlas HD key");
        a->w = read32(pack);
        a->h = read32(pack);
        a->offset = read32(pack);
        a->length = read32(pack);
        a->indices = read32(pack);
        if ((i && strcmp(images[i - 1].key, a->key) >= 0) || !a->w || !a->h || a->w > 4096 || a->h > 4096 ||
            a->offset > (uint32_t)size || a->length > (uint32_t)size - a->offset ||
            a->indices > (uint32_t)size || (a->indices && a->w * a->h > (uint32_t)size - a->indices))
            plat_fatal("Invalid Atlas HD entry: %s", a->key);
    }
    hd_density = GetPrivateProfileIntA("OpenCiv2", "GraphicsDensity", 2, "CIV.INI");
    if (hd_density < 1)
        hd_density = 1;
    if (hd_density > 4)
        hd_density = 4;
    plat_log("Atlas HD: %u bindings, density %d; original image loading disabled\n", count, hd_density);
}

int hd_find(const char *key)
{
    unsigned lo = 0, hi = catalog_count;
    while (lo < hi) {
        unsigned mid = lo + (hi - lo) / 2;
        int c = strcmp(key, images[mid].key);
        if (!c)
            return mid + 1;
        if (c < 0)
            hi = mid;
        else
            lo = mid + 1;
    }
    return 0;
}
void hd_size(int id, int *w, int *h)
{
    int valid = id > 0 && id <= (int)count;
    *w = valid ? images[id - 1].w : 0;
    *h = valid ? images[id - 1].h : 0;
}
const unsigned char *hd_palette(void) { return palette; }
const unsigned char *hd_indices(int id)
{
    Image *a;
    if (!id || id > (int)count)
        return NULL;
    a = images + id - 1;
    if (!a->indices)
        return NULL;
    if (!a->indexed) {
        a->indexed = malloc(a->w * a->h);
        if (!a->indexed)
            plat_fatal("Out of memory loading Atlas HD sheet");
        fseek(pack, a->indices, SEEK_SET);
        if (fread(a->indexed, 1, a->w * a->h, pack) != a->w * a->h)
            plat_fatal("Truncated Atlas HD sheet");
    }
    return a->indexed;
}
static Image *decode(int id)
{
    Image *a;
    unsigned i;
    unsigned char *png;
    int channels;
    if (!id || id > (int)count)
        return NULL;
    a = images + id - 1;
    a->used = ++tick;
    if (a->rgba)
        return a;
    /* Bound the decoded-image cache; sprite handles refer to entries, not
       borrowed decoder storage, so eviction cannot invalidate live sprites. */
    while (cache_bytes > 96u * 1024 * 1024) {
        Image *old = NULL;
        for (i = 0; i < count; i++)
            if (images[i].rgba && (!old || images[i].used < old->used))
                old = images + i;
        if (!old)
            break;
        cache_bytes -= (uint64_t)old->pw * old->ph * 4;
        free(old->rgba);
        old->rgba = NULL;
    }
    png = malloc(a->length);
    if (!png)
        plat_fatal("Out of memory decoding Atlas HD image");
    fseek(pack, a->offset, SEEK_SET);
    if (fread(png, 1, a->length, pack) != a->length)
        plat_fatal("Truncated Atlas HD image");
    a->rgba = stbi_load_from_memory(png, a->length, &a->pw, &a->ph, &channels, 4);
    free(png);
    if (!a->rgba)
        plat_fatal("Invalid Atlas HD PNG: %s", a->key);
    if (a->cw) {
        int x = a->cx * a->pw / a->w, y = a->cy * a->ph / a->h;
        int w = a->cw * a->pw / a->w, h = a->ch * a->ph / a->h, j;
        unsigned char *cut;
        if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > a->pw || y + h > a->ph)
            plat_fatal("Atlas crop outside image: %s", a->key);
        cut = malloc((size_t)w * h * 4);
        if (!cut)
            plat_fatal("Out of memory cropping Atlas image");
        for (j = 0; j < h; j++)
            memcpy(cut + j * w * 4, a->rgba + ((y + j) * a->pw + x) * 4, w * 4);
        free(a->rgba);
        a->rgba = cut;
        a->pw = w;
        a->ph = h;
    }
    cache_bytes += (uint64_t)a->pw * a->ph * 4;
    return a;
}
int hd_file(const char *name)
{
    char key[180], base[128];
    const char *p = name, *s;
    size_t i;
    for (s = name; *s; s++)
        if (*s == '/' || *s == '\\')
            p = s + 1;
    snprintf(base, sizeof base, "%s", p);
    for (i = 0; base[i]; i++) {
        base[i] = tolower((unsigned char)base[i]);
        if (base[i] == '.') {
            base[i] = 0;
            break;
        }
    }
    snprintf(key, sizeof key, "file/%s", base);
    return hd_find(key);
}
int hd_virtual_file(const char *name)
{
    const char *p = name, *s;
    static const char *const modules[] = {"tiles.dll", "intro.dll", "cv.dll",      "pv.dll",
                                          "mk.dll",    "ss.dll",    "civ2art.dll", "wonder.dll"};
    unsigned i;
    if (!hd_enabled)
        return 0;
    for (s = name; *s; s++)
        if (*s == '/' || *s == '\\')
            p = s + 1;
    for (i = 0; i < sizeof modules / sizeof modules[0]; i++)
        if (!strcasecmp(p, modules[i]))
            return 1;
    return hd_file(p) != 0;
}
const unsigned char *hd_rgba(int id, int *w, int *h)
{
    Image *a = decode(id);
    *w = a ? a->pw : 0;
    *h = a ? a->ph : 0;
    return a ? a->rgba : NULL;
}
/* Resource ids are disambiguated by the current resource-library stack by
   hd_resource(), implemented beside the game's resource loader. */
int hd_crop(int id, int x, int y, int w, int h)
{
    char key[220];
    unsigned i;
    int found;
    if (!id)
        return 0;
    snprintf(key, sizeof key, "crop/%s/%d,%d,%d,%d", images[id - 1].key, x, y, w, h);
    found = hd_find(key);
    if (found)
        return found;
    for (i = catalog_count; i < count; i++)
        if (!strcmp(images[i].key, key))
            return i + 1;
    if (count >= 8192 || strlen(key) >= 160)
        plat_fatal("Too many Atlas crops");
    images[count] = images[id - 1];
    snprintf(images[count].key, 160, "%s", key);
    images[count].rgba = NULL;
    images[count].indexed = NULL;
    images[count].cx = x;
    images[count].cy = y;
    images[count].cw = w;
    images[count].ch = h;
    plat_log("Atlas crop: %s\n", key);
    return ++count;
}

static uint32_t legacy(Bitmap *b, int x, int y)
{
    COLORREF c = surf_get(b, x, y);
    return 0xff000000u | GetRValue(c) << 16 | GetGValue(c) << 8 | GetBValue(c);
}
static uint32_t raw_pixel(Bitmap *b, int x, int y)
{
    const unsigned char *p = bmp_row(b, y);
    if (b->bpp == 8)
        return p[x];
    if (b->bpp == 32)
        return ((const uint32_t *)p)[x];
    return legacy(b, x, y);
}
static void block(Bitmap *b, int x, int y, uint32_t c)
{
    int i, j, d = hd_density, pitch = b->w * d;
    for (j = 0; j < d; j++)
        for (i = 0; i < d; i++)
            b->hd[(y * d + j) * pitch + x * d + i] = c;
}
void hd_sync(Bitmap *b)
{
    int x, y;
    if (!hd_enabled || !b)
        return;
    if (!b->hd) {
        b->hd = malloc((size_t)b->w * b->h * hd_density * hd_density * 4);
        b->hd_before = malloc((size_t)b->w * b->h * 4);
        if (!b->hd || !b->hd_before)
            plat_fatal("Out of memory allocating HD surface");
        for (y = 0; y < b->h; y++)
            for (x = 0; x < b->w; x++) {
                b->hd_before[y * b->w + x] = raw_pixel(b, x, y);
                block(b, x, y, legacy(b, x, y));
            }
    } else
        for (y = 0; y < b->h; y++)
            for (x = 0; x < b->w; x++) {
                uint32_t v = raw_pixel(b, x, y);
                if (v != b->hd_before[y * b->w + x]) {
                    b->hd_image = 0;
                    b->hd_before[y * b->w + x] = v;
                    block(b, x, y, legacy(b, x, y));
                }
            }
}
void hd_bitmap_destroy(Bitmap *b)
{
    free(b->hd);
    free(b->hd_before);
}
void hd_bitmap_commit(Bitmap *b)
{
    int x, y;
    if (!b || !b->hd)
        return;
    for (y = 0; y < b->h; y++)
        for (x = 0; x < b->w; x++)
            b->hd_before[y * b->w + x] = raw_pixel(b, x, y);
}
void hd_commit(void *bits) { hd_bitmap_commit(bmp_of_bits(bits)); }
void hd_commit_rect(void *bits, int x, int y, int w, int h)
{
    Bitmap *b = bmp_of_bits(bits);
    int i, j;
    if (!b || !b->hd)
        return;
    for (j = y < 0 ? 0 : y; j < y + h && j < b->h; j++)
        for (i = x < 0 ? 0 : x; i < x + w && i < b->w; i++)
            b->hd_before[j * b->w + i] = raw_pixel(b, i, j);
}
void hd_changed(void *bits, int x, int y, int w, int h)
{
    if (hd_enabled)
        hd_bitmap_changed(bmp_of_bits(bits), x, y, w, h);
}
void hd_bitmap_changed(Bitmap *b, int x, int y, int w, int h)
{
    int i, j;
    if (!hd_enabled || !b || !b->hd)
        return;
    b->hd_image = 0;
    for (j = y < 0 ? 0 : y; j < y + h && j < b->h; j++)
        for (i = x < 0 ? 0 : x; i < x + w && i < b->w; i++) {
            block(b, i, j, legacy(b, i, j));
            b->hd_before[j * b->w + i] = raw_pixel(b, i, j);
        }
}
void hd_pixel(Bitmap *b, int x, int y, uint32_t rgb)
{
    if (!hd_enabled || !b->hd || x < 0 || y < 0 || x >= b->w || y >= b->h)
        return;
    b->hd_image = 0;
    block(b, x, y, 0xff000000u | rgb);
    b->hd_before[y * b->w + x] = raw_pixel(b, x, y);
}
void hd_attach(void *bits, int id)
{
    Bitmap *b = bmp_of_bits(bits);
    size_t i, n;
    if (!b)
        return;
    hd_sync(b);
    n = (size_t)b->w * b->h * hd_density * hd_density;
    for (i = 0; i < n; i++)
        b->hd[i] = 0xff263934u;
    hd_draw(bits, id, 0, 0, b->w, b->h, 0, 0, b->w, b->h, -1);
    b->hd_image = id;
}
int hd_source(void *bits)
{
    Bitmap *b = bmp_of_bits(bits);
    return b ? b->hd_image : 0;
}
static uint32_t blend(uint32_t dst, unsigned r, unsigned g, unsigned b, unsigned a)
{
    unsigned ia = 255 - a;
    return 0xff000000u | ((r + ((dst >> 16) & 255) * ia + 127) / 255) << 16 |
           ((g + ((dst >> 8) & 255) * ia + 127) / 255) << 8 | (b + (dst & 255) * ia + 127) / 255;
}
void hd_draw(void *bits, int id, int x, int y, int w, int h, int l, int t, int r, int bot, int tint)
{
    hd_draw_bitmap(bmp_of_bits(bits), id, x, y, w, h, l, t, r, bot, tint);
}
static void paint(Bitmap *b, Image *a, int x, int y, int w, int h, int l, int t, int r, int bot, int tint)
{
    int px, py, d = hd_density;
    if (!b || !a || w <= 0 || h <= 0)
        return;
    if (!b->hd)
        hd_sync(b);
    b->hd_image = 0;
    if (l < x)
        l = x;
    if (t < y)
        t = y;
    if (r > x + w)
        r = x + w;
    if (bot > y + h)
        bot = y + h;
    if (l < 0)
        l = 0;
    if (t < 0)
        t = 0;
    if (r > b->w)
        r = b->w;
    if (bot > b->h)
        bot = b->h;
    /* Bilinear filtering in premultiplied color space: RGB never leaks from
       transparent texels. Tint affects color independently of alpha coverage. */
    for (py = t * d; py < bot * d; py++)
        for (px = l * d; px < r * d; px++) {
            double u = ((px - x * d) + .5) * a->pw / (w * d) - .5,
                   v = ((py - y * d) + .5) * a->ph / (h * d) - .5;
            int xx = (int)floor(u), yy = (int)floor(v), i, j;
            double fx = u - xx, fy = v - yy, rr = 0, gg = 0, bb = 0, aa = 0;
            for (j = 0; j < 2; j++)
                for (i = 0; i < 2; i++) {
                    int sx = xx + i, sy = yy + j;
                    const unsigned char *p;
                    double k = (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
                    if (sx < 0)
                        sx = 0;
                    if (sy < 0)
                        sy = 0;
                    if (sx >= a->pw)
                        sx = a->pw - 1;
                    if (sy >= a->ph)
                        sy = a->ph - 1;
                    p = a->rgba + 4 * (sy * a->pw + sx);
                    aa += k * p[3];
                    rr += k * p[0] * p[3];
                    gg += k * p[1] * p[3];
                    bb += k * p[2] * p[3];
                }
            if (tint >= 0) {
                uint32_t c = palette32[tint & 255];
                rr = ((c >> 16) & 255) * aa;
                gg = ((c >> 8) & 255) * aa;
                bb = (c & 255) * aa;
            }
            b->hd[py * b->w * d + px] = blend(b->hd[py * b->w * d + px], (unsigned)(rr + .5),
                                              (unsigned)(gg + .5), (unsigned)(bb + .5), (unsigned)(aa + .5));
        }
}
void hd_draw_bitmap(Bitmap *b, int id, int x, int y, int w, int h, int l, int t, int r, int bot, int tint)
{
    paint(b, decode(id), x, y, w, h, l, t, r, bot, tint);
}
void hd_transfer(Bitmap *dst, Bitmap *src, int x, int y, int w, int h, int sx, int sy, int sw, int sh, int l,
                 int t, int r, int bot)
{
    int px, py, d = hd_density;
    uint32_t *copy = NULL, *pixels;
    if (!hd_enabled || !dst || !src || w <= 0 || h <= 0 || sw <= 0 || sh <= 0)
        return;
    hd_sync(src);
    if (dst != src)
        hd_sync(dst);
    dst->hd_image = 0;
    pixels = src->hd;
    if (dst == src) {
        size_t n = (size_t)src->w * src->h * d * d * 4;
        copy = malloc(n);
        if (!copy)
            plat_fatal("Out of memory copying HD surface");
        memcpy(copy, pixels, n);
        pixels = copy;
    }
    if (l < x)
        l = x;
    if (t < y)
        t = y;
    if (r > x + w)
        r = x + w;
    if (bot > y + h)
        bot = y + h;
    if (l < 0)
        l = 0;
    if (t < 0)
        t = 0;
    if (r > dst->w)
        r = dst->w;
    if (bot > dst->h)
        bot = dst->h;
    for (py = t * d; py < bot * d; py++)
        for (px = l * d; px < r * d; px++) {
            int ax = sx * d + (int)((int64_t)(px - x * d) * sw / w),
                ay = sy * d + (int)((int64_t)(py - y * d) * sh / h);
            if (ax >= 0 && ay >= 0 && ax < src->w * d && ay < src->h * d)
                dst->hd[py * dst->w * d + px] = pixels[ay * src->w * d + ax];
        }
    free(copy);
}
void hd_copy(void *dst, void *src, int x, int y, int sx, int sy, int w, int h)
{
    if (hd_enabled)
        hd_transfer(bmp_of_bits(dst), bmp_of_bits(src), x, y, w, h, sx, sy, w, h, x, y, x + w, y + h);
}
const uint32_t *hd_pixels(Bitmap *b)
{
    hd_sync(b);
    return b->hd;
}

typedef struct SpriteImage {
    const void *sprite;
    int image, tint;
    Image snapshot;
    struct SpriteImage *next;
} SpriteImage;
static SpriteImage *sprites;
static SpriteImage *sprite_image(const void *s)
{
    SpriteImage *p;
    for (p = sprites; p; p = p->next)
        if (p->sprite == s)
            return p;
    return NULL;
}
int hd_sprite_image(const void *s)
{
    SpriteImage *p = sprite_image(s);
    return p ? p->image : 0;
}
void hd_sprite_forget(const void *s)
{
    SpriteImage **p = &sprites;
    while (*p) {
        if ((*p)->sprite == s) {
            SpriteImage *old = *p;
            *p = old->next;
            free(old->snapshot.rgba);
            free(old);
            return;
        }
        p = &(*p)->next;
    }
}
void hd_sprite_capture(const void *s, void *bits, int x, int y, int w, int h, int key)
{
    Bitmap *b = bmp_of_bits(bits);
    int id = hd_source(bits), crop = hd_crop(id, x, y, w, h), px, py, d = hd_density;
    SpriteImage *p;
    hd_sprite_forget(s);
    if (!b)
        return;
    p = calloc(1, sizeof *p);
    if (!p)
        plat_fatal("Out of memory capturing Atlas sprite");
    p->sprite = s;
    p->image = crop;
    p->tint = -1;
    p->next = sprites;
    sprites = p;
    if (crop)
        return;
    hd_sync(b);
    p->snapshot.w = w;
    p->snapshot.h = h;
    p->snapshot.pw = w * d;
    p->snapshot.ph = h * d;
    p->snapshot.rgba = malloc((size_t)w * h * d * d * 4);
    if (!p->snapshot.rgba)
        plat_fatal("Out of memory capturing Atlas surface");
    if (key == -1)
        key = raw_pixel(b, x, y);
    for (py = 0; py < h * d; py++)
        for (px = 0; px < w * d; px++) {
            uint32_t c = b->hd[(y * d + py) * b->w * d + x * d + px];
            unsigned char *q = p->snapshot.rgba + (py * w * d + px) * 4;
            q[0] = c >> 16;
            q[1] = c >> 8;
            q[2] = c;
            q[3] = (key >= 0 && raw_pixel(b, x + px / d, y + py / d) == (unsigned)key) ? 0 : 255;
        }
}
int hd_sprite_draw(const void *s, void *bits, int x, int y, int w, int h, int l, int t, int r, int b,
                   int tint)
{
    SpriteImage *p = sprite_image(s);
    if (!p)
        return 0;
    paint(bmp_of_bits(bits), p->image ? decode(p->image) : &p->snapshot, x, y, w, h, l, t, r, b,
          tint < 0 ? p->tint : tint);
    return 1;
}
void hd_sprite_tint(const void *s, int old_color, int new_color)
{
    SpriteImage *p = sprite_image(s);
    if (p && old_color == 8)
        p->tint = new_color;
}
void hd_sprite_copy(const void *dst, const void *src)
{
    SpriteImage *p = sprite_image(src), *q;
    if (!p || dst == src)
        return;
    q = malloc(sizeof *q);
    if (!q)
        plat_fatal("Out of memory cloning Atlas sprite");
    *q = *p;
    if (p->snapshot.rgba) {
        size_t n = (size_t)p->snapshot.pw * p->snapshot.ph * 4;
        q->snapshot.rgba = malloc(n);
        if (!q->snapshot.rgba)
            plat_fatal("Out of memory cloning Atlas pixels");
        memcpy(q->snapshot.rgba, p->snapshot.rgba, n);
    }
    hd_sprite_forget(dst);
    q->sprite = dst;
    q->next = sprites;
    sprites = q;
}
void hd_sprite_bind(const void *s, const char *key)
{
    int id = hd_find(key);
    SpriteImage *p;
    if (!id)
        plat_fatal("Missing Atlas sprite: %s", key);
    hd_sprite_forget(s);
    p = calloc(1, sizeof *p);
    p->sprite = s;
    p->image = id;
    p->tint = -1;
    p->next = sprites;
    sprites = p;
}
