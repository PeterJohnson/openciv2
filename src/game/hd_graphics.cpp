/* The game's unchanged logical sprite and resource contracts over Atlas RGBA. */
#include "../platform/hd.h"
#include "auto_common.h"

EXTERN_C int hd_resource(int id)
{
    int image = hd_module_image((uintptr_t)err_report_ctx_block.app_hinstance, id, "gifs");
    for (unsigned i = 0; !image && i < res_dll_module_count; i++)
        image = hd_module_image((uintptr_t)err_report_ctx_block.res_dll_modules[i], id, "gifs");
    return image;
}

int hd_load_surface(DibSurface *s, int image, GamePalette *pal)
{
    int w, h;
    if (!image)
        return 0;
    hd_size(image, &w, &h);
    const unsigned char *indices = hd_indices(image);
    if (!indices)
        return 0;
    s->create(w, h);
    if (pal) {
        pal->set_rgb(0, 256, (iptr)hd_palette());
        s->set_palette((iptr)pal);
    }
    for (int y = 0; y < h; y++)
        memcpy((void *)s->pixel_ptr(0, y), indices + y * w, w);
    hd_attach((void *)s->bits, image);
    return 1;
}

int hd_encode_sprite(Sprite *s, DibSurface *surface, RECT *r, int key)
{
    int w = r->right - r->left, h = r->bottom - r->top;
    if (w <= 0 || h <= 0 || w > 4096 || h > 4096 || r->left < 0 || r->top < 0 ||
        r->right > (int)surface->pixel_width || r->bottom > (int)surface->pixel_height)
        return 0;
    s->free();
    SetRect((RECT *)&s->frame_rect, 0, 0, w, h);
    SetRect((RECT *)&s->bounds_rect, 0, 0, w, h);
    s->key_color = key >= 0 ? key : 7;
    s->offset_x = s->offset_y = 0;
    int handle = mem_handle_alloc((w + 8) * h + 8);
    unsigned char *out = (unsigned char *)mem_handle_lock(handle);
    if (!out)
        return 0;
    for (int y = 0; y < h; y++) {
        int start = 0;
        memcpy(out, &start, 4);
        memcpy(out + 4, &w, 4);
        memcpy(out + 8, (void *)surface->pixel_ptr(r->left, r->top + y), w);
        if (key >= 0 && key != 7)
            for (int x = 0; x < w; x++)
                if (out[8 + x] == 7)
                    out[8 + x] = (unsigned char)key;
        out += w + 8;
    }
    memset(out, 0, 8);
    mem_handle_unlock(handle);
    hd_sprite_capture(s, (void *)surface->bits, r->left, r->top, w, h, key);
    return handle;
}

void hd_bind_map_masks()
{
    /* These sprites are manufactured from indexed dither masks by the original
       loader. Bind the authored quarter alpha masks after that manufacturing;
       mapview.cpp, its topology, ordering and zoom gates remain unchanged. */
    for (int t = 0; t < 13; t++)
        for (int q = 0; q < 4; q++) {
            char key[64];
            snprintf(key, sizeof key, "dither/%d/%d", t, q);
            hd_sprite_bind((Sprite *)&map_cursor_sprite_block.terrain_dither_sprites + t * 4 + q, key);
        }
    for (int q = 0; q < 4; q++) {
        char key[32];
        snprintf(key, sizeof key, "fog/%d", q);
        hd_sprite_bind((Sprite *)&map_cursor_sprite_block.unexplored_dither_sprites + q, key);
    }
}
