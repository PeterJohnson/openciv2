// Standalone art-review boundary. Source renderer bodies are included unchanged.
// Supplied fixture state replaces the game loop; draw commands replace the legacy DIB backend.
#pragma once
#include <algorithm>
#include <cassert>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
using i8 = signed char;
using u8 = unsigned char;
using byte = unsigned char;
using i16 = short;
using u16 = unsigned short;
using i32 = int;
using u32 = unsigned int;
using uint = unsigned int;
using iptr = int;
using uptr = unsigned int;
using float10 = long double;
static_assert(sizeof(void*) == 4, "Review renderer must use MSVC x86");
#include "enums.h"

struct RECT {
    int left, top, right, bottom;
};
struct DibSurface;

struct Sprite {
    int id = 0, w = 64, h = 32;
    u8 reserved[48]{};
    iptr draw(iptr, iptr, i32, i32);
    iptr draw_silhouette(iptr, iptr, i32, i32, i32);
    void blit_to_surface(int*, DibSurface*, uint, int, int);
    void blit_silhouette_to_surface(int*, DibSurface*, uint, int, int, int);
    void grab_from_surface(iptr, uint, int, int, int, int);

    void replace_color(int, int) {}
};

static_assert(sizeof(Sprite) == 0x3c, "Source sprite-array strides");

struct DibSurface {
    int resource = 0;

    int load_gif_resource(int id, int, int, iptr) {
        resource = id;
        return 1;
    }

    void release() {}

    void create(int, int) {}

    void replace_color(iptr, int, int);
    void draw_text(iptr, const char*, int, int, int);
};

struct GameFont {
    int text_width(const char*);
    int font_cached_height();
    void set(int, int) {};
};

struct {
    GameFont map_label_font;
} status_window_block;

struct {
    int width = 128, height = 128, seed = 17;
} map;

struct {
    int rules = RULE_FLAT_WORLD | RULE_NORMAL_COMBAT;
    int multiplayer = 0;
    int game_options = 0;
    int num_cities = 0;
    int reveal_map = 0;
    int game_flags = 0;
    int active_unit = 0;
    int human_players = 2;
    int difficulty = 3;
    int wonder_city[28];
} game;

struct {
    int flags[4]{};
} scenario;

struct {
    int unit_active = 0, unit_phase = 0;
} blink;

struct {
    int defender = -1, origin_stack_unit = -1, defender_x = -1, defender_y = -1, origin_x = -1, origin_y = -1;
} combat_anim;

struct {
    void process_messages(int, int) {
        std::abort();
    }
} net;

struct Unit {
    int x = -1, y = -1, type = 0, owner = 1, orders = 0, flags = 0, visibility = 255, damage = 0,
        prev_in_stack = -1, next_in_stack = -1, ai_task = 0;
};

Unit unit_storage[65];
Unit* units = unit_storage + 1;

struct {
    int domain = 0, hit_points = 10;
} unit_types[64];

struct City {
    int x = 0, y = 0, owner = 1, size = 8, id = 1, known_to = 255, flags = 0;
    char revealed_size[8]{8, 8, 8, 8, 8, 8, 8, 8};
};

City cities[16];

struct {
    char throne_room[12]{};
    int tribe = 0;
} civs[8];

struct {
    int city_style = 1;
} leaders[32], civ_names[8];

struct {
    char key = '-';
} order_names[16];

int human_civ[1] = {1}, moving_units_mode = 0, map_show_hidden_terrain = 0, g_nr_seed = 17;

struct Tile {
    u8 raw[2]{2, 0};
    u8 known = 0;
    int visible = 1, resource = 0, hut = 0, city = -1, unit = -1, shield = 0;
};

std::vector<Tile> tiles;

Tile& fixture_tile(int x, int y) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height)
        throw std::runtime_error("Tile outside fixture");
    return tiles[y * map.width + x];
}

int map_in_bounds(int x, int y) {
    return x >= 0 && y >= 0 && x < map.width && y < map.height && ((x + y) & 1) == 0;
}

int tile_terrain(int x, int y) {
    return fixture_tile(x, y).raw[0] & 15;
}

iptr tile_at(int x, int y) {
    return reinterpret_cast<iptr>(fixture_tile(x, y).raw);
}

byte* known_at(int x, int y, int) {
    return &fixture_tile(x, y).known;
}

int tile_improvements(int x, int y) {
    return fixture_tile(x, y).raw[1];
}

int tile_visible_to(int x, int y, int civ) {
    return civ < 0 || fixture_tile(x, y).visible;
}

int city_at(int x, int y) {
    return map_in_bounds(x, y) ? fixture_tile(x, y).city : -1;
}

int tile_city_owner(int x, int y) {
    int c = city_at(x, y);
    return c < 0 ? -1 : cities[c].owner;
}

int tile_first_unit(int x, int y) {
    return fixture_tile(x, y).unit;
}

int unit_next_in_stack(int n) {
    return units[n].next_in_stack;
}

int unit_is_selectable(int n) {
    return n >= 0 && units[n].x >= 0;
}

int unit_stack_pick_display_unit(int n) {
    return n;
}

int tile_unit_owner(int x, int y) {
    int n = tile_first_unit(x, y);
    return n < 0 ? -1 : units[n].owner;
}

int tile_owner(int x, int y) {
    return tile_unit_owner(x, y);
}

int tile_airbase_owner(int x, int y) {
    return (tile_improvements(x, y) & 0x42) == 0x42 ? 1 : -1;
}

int tile_resource(int x, int y) {
    return fixture_tile(x, y).resource;
}

int tile_has_hut(int x, int y) {
    return fixture_tile(x, y).hut;
}

int tile_grassland_has_shield(int x, int y) {
    return fixture_tile(x, y).shield;
}

int dist_from_deltas(int x, int y) {
    return (x + y) / 2;
}

int map_distance_diag(int x, int y, int a, int b) {
    return (std::abs(x - a) + std::abs(y - b)) / 2;
}

bool improvements[16][40]{};

int city_has_improvement(int c, int i) {
    return improvements[c][i];
}

int civ_has_wonder(int, int) {
    return 0;
}

int artEra = 1;

int civ_has_advance(int, int tech) {
    return (tech == ADV_INDUSTRIALIZATION && artEra >= 2) ||
           ((tech == ADV_AUTOMOBILE || tech == ADV_ELECTRONICS) && artEra >= 3);
}

int civ_color_primary(int c) {
    return 200 + c;
}

int civ_color_mid(int c) {
    return 210 + c;
}

enum { X_SENTRY_GREY, X_WORK_COUNTER };

int extra_ui(int) {
    return 0;
}

void extras_draw_grey_sprite(Sprite*, iptr, int, int) {
    std::abort();
}

void extras_draw_work_counter(iptr, int, int, int, int) {
    std::abort();
}

struct {
    Sprite terrain_base_sprites[10];
    Sprite terrain_ocean_sprite;
} terrain_base_sprites_block;

struct {
    Sprite coast_quarter_sprites[32];
} tutorial_icon_sprite_block;

struct {
    u8 coast_quarter_land_masks[4];
} scenario_title_surface_block;

struct {
    Sprite river_mouth_sprites[4];
    Sprite tile_pick_mask_sprite;
} tile_pick_mask_sprite_block;

Sprite tile_direction_mask_sprite;

struct {
    Sprite terrain_dither_sprites[13 * 4];
    Sprite unexplored_dither_sprites[4];
} map_cursor_sprite_block;

Sprite forest_sprites[16], mountain_sprites[16], grassland_shield_sprite, hut_sprite, unexplored_tile_sprite,
    map_grid_sprite, unit_shield_sprite;

struct {
    Sprite hill_sprites[16];
} hill_sprites_block;

struct {
    Sprite land_improvement_sprites;
    Sprite farmland_sprite;
    Sprite mine_sprite;
} land_improvement_sprites_block;

struct {
    Sprite river_sprites[16];
} icon_misc_sprites_block;

struct {
    Sprite road_sprites[9], railroad_sprites[9];
    int unit_shield_x_offsets[64], unit_shield_y_offsets[64], city_label_y_offsets[48],
        city_size_box_x_offsets[48];
} road_sprites_block;

struct {
    Sprite pollution_sprite;
    Sprite unit_sprites[64];
} pollution_sprite_block;

struct {
    Sprite fortress_sprite, fortify_overlay_sprites, city_disorder_icon_sprite;
} fortify_overlay_sprites_block;

struct {
    Sprite airbase_sprites[2];
} airbase_sprites_block;

struct {
    Sprite terrain_resource_sprites[22];
} city_down_arrow_sprite_block;

struct {
    Sprite city_radius_grid_sprite;
} icons_pair_sprites_block;

struct {
    Sprite city_sprites[48];
} gfx_sheet_surface_block;

struct {
    int city_flag_x_offsets[48], city_flag_y_offsets[48];
} peace_treaty_icon_sprite_block;

struct {
    Sprite civ_flag_sprites[16];
} editor_tile_backdrop_sprite_block;

const char city_size_digit_str[] = "0", city_size_digit2_str[] = "0";
alignas(16) u8 throneTables[2048]{};
#include "engine-structures.inc"

struct ThroneRect {
    int x, y, w, h;
};

ThroneRect (*const throneroom_piece_rects)[4] = reinterpret_cast<ThroneRect (*)[4]>(throneTables);
int coast_quarter_dx_table[4] = {0, 1, 0, -1}, coast_quarter_dy_table[4] = {0, 1, 2, 1};
int gfx_zoom_scale(int, int);
void gfx_set_zoom_scale(int);
void gfx_reset_zoom_scale();
iptr map_wrap_x(iptr);
int tile_calc_coast_masks(iptr, int);
void gfx_draw_unit(iptr, iptr, uint, int, int, int, int);
void gfx_draw_city(iptr, iptr, uint, int, int, int);
int rng_set_seed(int);
float10 rng_next_unit();
int rand_range(int, int);
int scaleNum = 1, scaleDen = 1, textColor = 10, currentX = -1, currentY = -1;
std::vector<std::string> spriteNames = {"unset"};

struct Command {
    std::string name;
    int x, y, w, h, tx, ty, color;
    std::string text;
};

std::vector<Command> commands;

void record(std::string name, int x, int y, int w, int h, int color = -1, std::string text = "") {
    commands.push_back({name, x, y, w, h, currentX, currentY, color, text});
}

void gfx_set_scale_ratio(int n, int d) {
    scaleNum = n;
    scaleDen = d;
}

void win_flush_pending_msgs() {}

void gfx_fill_surface(iptr, int c) {
    record("clear", 0, 0, 0, 0, c);
}

void gfx_set_draw_target(iptr) {}

void text_set_surface(iptr) {}

void text_set_font(iptr) {}

void gfx_set_text_color_index(int c) {
    textColor = c;
}

void text_set_colors(int c, int, int, int) {
    textColor = c;
}

void gfx_select_zoom_font(int) {}

int GameFont::text_width(const char* t) {
    return int(std::strlen(t)) * std::max(3, 6 * scaleNum / scaleDen);
}

int GameFont::font_cached_height() {
    return std::max(5, 10 * scaleNum / scaleDen);
}

void gfx_draw_text(const char* t, int x, int y) {
    record("text", x, y, 0, std::max(5, 10 * scaleNum / scaleDen), textColor, t);
}

void DibSurface::draw_text(iptr, const char* t, int x, int y, int) {
    gfx_draw_text(t, x, y);
}

void DibSurface::replace_color(iptr r, int from, int to) {
    const auto* p = (RECT*)r;
    record("replace", p->left, p->top, p->right - p->left, p->bottom - p->top, to, std::to_string(from));
}

void rect_set_xywh(iptr r, int x, int y, int w, int h) {
    *(RECT*)r = {x, y, x + w, y + h};
}

void rect_offset(iptr r, int dx, int dy) {
    auto* p = (RECT*)r;
    p->left += dx;
    p->right += dx;
    p->top += dy;
    p->bottom += dy;
}

void rect_deflate(iptr r, int x, int y) {
    auto* p = (RECT*)r;
    p->left += x;
    p->right -= x;
    p->top += y;
    p->bottom -= y;
}

int rect_width(RECT* r) {
    return r->right - r->left;
}

int rect_height(RECT* r) {
    return r->bottom - r->top;
}

void gfx_fill_rect(iptr, RECT* r, int c) {
    record("rect", r->left, r->top, r->right - r->left, r->bottom - r->top, c);
}

void gfx_draw_rect_frame(iptr, RECT* r, int c) {
    record("frame", r->left, r->top, r->right - r->left, r->bottom - r->top, c);
}

int crt_toupper(int c) {
    return std::toupper(c);
}

void __itoa(int n, char* p, int) {
    std::sprintf(p, "%d", n);
}

void crt_strcpy(i8* a, const i8* b) {
    std::strcpy((char*)a, (const char*)b);
}

void crt_strcat(i8* a, const i8* b) {
    std::strcat((char*)a, (const char*)b);
}

size_t _strlen(const char* p) {
    return std::strlen(p);
}

void named(Sprite& s, const std::string& name, int w = 64, int h = 32) {
    s.id = int(spriteNames.size());
    spriteNames.push_back(name);
    s.w = w;
    s.h = h;
}

void Sprite::blit_to_surface(int* dest, DibSurface*, uint, int x, int y) {
    *reinterpret_cast<RECT*>(dest) = {x, y, x + w * scaleNum / scaleDen, y + h * scaleNum / scaleDen};
    record(spriteNames.at(id), x, y, w * scaleNum / scaleDen, h * scaleNum / scaleDen);
}

void Sprite::blit_silhouette_to_surface(int* d, DibSurface* s, uint k, int x, int y, int color) {
    blit_to_surface(d, s, k, x, y);
    commands.back().color = color;
}

void Sprite::grab_from_surface(iptr surface, uint, int x, int y, int width, int height) {
    int r = ((DibSurface*)surface)->resource;
    if (r == 300 || r == 305) {
        const u8* data = r == 300 ? (u8*)&cityview_improvement_art_x_block.cityview_improvement_art_x
                                  : (u8*)&cityview_improvement_art_x_block.cityview_wonder_art_x;
        int count = r == 300 ? 34 : 28;
        for (int i = 0; i < count; i++) {
            const auto* q = (const int*)(data + i * 16);
            if (q[0] == x && q[1] == y && q[2] == width && q[3] == height) {
                named(*this, (r == 300 ? "building/" : "wonder/") + std::to_string(i + (r == 300 ? 1 : 0)),
                      width, height);
                return;
            }
        }
        throw std::runtime_error("Unmapped city art crop");
    }
    named(*this, "palace-resource/" + std::to_string(r), width, height);
}

void surface_ctor(DibSurface* s) {
    s->resource = 0;
}

void surface_dtor(DibSurface*) {}

void sprite_init(Sprite* s) {
    *s = Sprite{};
}

void sprite_destroy(Sprite*) {}

template <class F> struct Exit {
    F f;

    ~Exit() {
        f();
    }
};

template <class F> Exit<F> on_exit(F f) {
    return {f};
}

#define JOIN2(a, b) a##b
#define JOIN(a, b) JOIN2(a, b)
#define ON_SCOPE_EXIT(x) auto JOIN(scope_, __LINE__) = on_exit([&]() { x; })

struct MapView : DibSurface {
    int zoom_u = 0, tile_width_u = 64, tile_height_u = 32, half_tile_width_u = 32, half_tile_height_u = 16;
    int origin_x_uptr = 0, origin_y_uptr = 0, margin_x_u = 0, margin_y_u = 0, client_x = 0, client_y = 0;
    int field_2fc = 5, field_304 = 4, tile_columns = 11, half_view_width = 10;
    int client_width = 640, client_height = 480, layout_width_u = 0, layout_height_u = 0,
        quarter_tile_width_u = 0, quarter_tile_height = 0, field_320 = 0, unit_sprite_height_u = 48,
        center_x_u = 0, end_x_uptr = 0, end_y_u = 0, cached_zoom = 0, tile_font_size = 0,
        tile_small_font_size = 0;
    DibSurface map_surface, overlay_surface;
    int map_surface_head = 0, overlay_surface_head = 0;
    GameFont tile_font, tile_small_font;
    void update_layout();
    void tile_to_screen(iptr, iptr, int, int);
    void draw_tile_ocean(iptr, int, int, iptr, int, int, u32, u32);
    void draw_tile_land(iptr, int, int, iptr, int, int, uint, uint, uint, u32, u32, uint*);
    void draw_tile_roads(iptr, int, int, iptr, int, int, uint);
    void draw_tile_specials(iptr, int, int, iptr, int, uint, u32, u32, u32);
    void draw_tile_unexplored_edges(iptr, int, int, iptr, int, int, iptr, u32, u32);
    void draw_tile_terrain(iptr, int, int, iptr, int, int, int, iptr);
    void draw_tile_city(i32, int, iptr, iptr);
    void draw_unit_stacked(iptr, uint, i32, i32);
    void draw_unit_blinking(iptr, i32, i32);
    void draw_stack_unit(iptr, i32, i32);
    void draw_tile_units(i32, int, int, int);
    void draw_tile(iptr, iptr, int);
    void draw_all_tiles(i32);
    i32 zoom_scale(i32);
    void apply_zoom();

    void draw_city_names(int, int, int) {} // Window-label typography is explicitly outside this fixture.
};

#pragma pack(push, 1)

struct CityViewWindow {
    union {
        u8 backing[0x1c98];

        struct {
            u8 a[0x648];
            u8 improvement_art_surface[72];
            u8 wonder_art_surface[52];
        };

        struct {
            u8 b[0x1089];
            u8 building_art_block[2203];
        };

        struct {
            u8 c[0x14ec];
            u32 slot_sprite_ptrs;
        };

        struct {
            u8 d[0x19f8];
            u8 improvement_slot_tables[660];
        };
    };

    int city_id = 0, terrain_kind = 2, slot_count = 60, wonder_slots_left = 24, improvement_slots_left = 31,
        houses_left = 10, fixed_slot_used = 0, ship_civ = 0;
    void classify_site();
    i32 layout_buildings();
    void draw_buildings();
    i32 take_wonder_slot();
    i32 take_improvement_slot();
    void place_improvement(iptr, iptr);
    void place_wonder(iptr, iptr);
    void place_large_house(iptr);
    void place_small_house(iptr);
    void place_large_empty_lot(iptr);
    void place_empty_lot(iptr);

    void redraw_scrolled() {}
};

#pragma pack(pop)
static_assert(offsetof(CityViewWindow, building_art_block) == 0x1089, "Source city storage");
static_assert(offsetof(CityViewWindow, slot_sprite_ptrs) == 0x14ec, "Source city pointers");

struct ThroneRoomWindow {
    int throne_civ = 1, throne_complete = 0, control_list = 0;
    DibSurface target;
    DibSurface* throne_surface_wnd = &target;
    i32 render();
};
