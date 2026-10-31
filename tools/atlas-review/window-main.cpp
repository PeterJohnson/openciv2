// Fixture and drawing boundary for unchanged source window bodies.
// No game source is compiled with modified bodies, and no original image is loaded.
#include <algorithm>
#include <cstddef>
#include <cstring>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
using i8 = signed char;
using u8 = unsigned char;
using u16 = unsigned short;
using byte = unsigned char;
using i32 = int;
using u32 = unsigned int;
using uint = unsigned int;
using iptr = int;
using uptr = unsigned int;
using CHAR = char;
static_assert(sizeof(void*) == 4, "MSVC x86 review boundary");
#include "enums.h"
#define ON_SCOPE_EXIT(x)

struct RECT {
    int left, top, right, bottom;
};

using tagRECT = RECT;

struct Command {
    std::string asset, text;
    int x, y, w, h, resource, sx, sy, target, shade;
};

std::vector<Command> commands;
int zoom = 0;

void emit(std::string asset, int x, int y, int w, int h, std::string text = "", int resource = 0, int sx = 0,
          int sy = 0, int target = 0, int shade = 0) {
    commands.push_back({asset, text, x, y, w, h, resource, sx, sy, target, shade});
}

int gfx_zoom_scale(int n, int z) {
    return n * (z + 8) / 8;
}

void gfx_set_zoom_scale(int z) {
    zoom = z;
}

void gfx_reset_zoom_scale() {
    zoom = 0;
}

struct DibSurface {
    int resource = 0, target = 0;

    int load_gif_resource(int r, int, int, iptr) {
        resource = r;
        if (target == 1)
            emit("background", 0, 0, 640, 480, "", r);
        return 1;
    }

    void set_palette(iptr) {}

    void wnd_create_with_surface(const char*, int, int x, int y, int w, int h, iptr, iptr) {
        emit("window", x, y, w, h);
    }

    void fill(int c) {
        emit("fill", 0, 0, 640, 480, "", c);
    }
};

struct Sprite {
    int resource = 0, sx = 0, sy = 0, w = 0, h = 0, id = 0;
    char pad[36]{};

    void grab_from_surface(iptr s, int, int x, int y, int width, int height) {
        resource = ((DibSurface*)s)->resource;
        sx = x;
        sy = y;
        w = width;
        h = height;
    }

    int draw(iptr, iptr surface, int x, int y) {
        int target = surface ? ((DibSurface*)surface)->target : 0;
        emit(id ? "icon/" + std::to_string(id) : "resource", x, y, gfx_zoom_scale(w, zoom),
             gfx_zoom_scale(h, zoom), "", resource, sx, sy, target);
        return 1;
    }

    int draw_silhouette(iptr r, iptr s, int x, int y, int) {
        draw(r, s, x, y);
        commands.back().shade = 1;
        return 1;
    }
};

static_assert(sizeof(Sprite) == 60, "Source sprite strides");

void sprite_init(void* s) {
    std::memset(s, 0, sizeof(Sprite));
}

void sprite_destroy(void*) {}

void surface_ctor(DibSurface* s) {
    s->resource = 0;
    s->target = 0;
}

void surface_dtor(DibSurface*) {}

void crt_vector_ctor_iterator(void* base, int stride, int n, void (*f)(void*), void (*)(void*)) {
    for (int i = 0; i < n; i++)
        f((char*)base + stride * i);
}

void crt_vector_dtor_iterator(void*, int, int, void (*)(void*)) {}

struct GamePalette {
    void init() {}

    void destroy() {}

    void set_entry(int, int, int, int) {}

    void get_entry(int, iptr r, iptr g, iptr b) {
        *(int*)r = 180;
        *(int*)g = 160;
        *(int*)b = 100;
    }

    void get_rgb(iptr p, int, int n) {
        std::memset((void*)p, 0, n * 3);
    }

    void set_rgb(int, int, iptr) {}
};

struct GameFont {
    void init(int, int) {}

    void destroy() {}
};

struct {
    GamePalette game_palette;
} game_palette_block;

int screen_width_value = 640, screen_height_value = 480;
char str_empty_103 = 0;
int human_civ[1] = {1};

struct {
    int government = 3, leader_portrait = 0;
    byte treaties[8]{};
} civs[8];

struct {
    int power_rank[8]{}, difficulty = DIFF_CHIEFTAIN, num_units = 3, wonder_city[28];
} game;

struct {
    int tech_prereq_depth_cache[100]{};
} map_views_block;

int tech_prereq_walk_count = 0;

int civ_color_primary(uint) {
    return 0;
}

int civ_has_wonder(int, int) {
    return 0;
}

bool suppliedAdvances[100]{};
int suppliedAdvanceCategories[100]{};

int civ_has_advance(uint, int n) {
    return n >= 0 && n < 100 && suppliedAdvances[n];
}

void advance_count_prereq_depth(int) {
    throw std::runtime_error("Unsupplied tech depth");
}

void SetRect(RECT* r, int l, int t, int right, int bottom) {
    *r = {l, t, right, bottom};
}

void OffsetRect(RECT* r, int x, int y) {
    r->left += x;
    r->right += x;
    r->top += y;
    r->bottom += y;
}

struct DiploLeaderWindow {
    int leader_civ = 2, style_era = 2;
    DibSurface surface;
    GamePalette palette;
    void* leader_surface = &surface;
    void* leader_palette = &palette;
    uint init_main_art();
    i32 init_military();
    i32 init_science();
    i32 init_portrait();
    void science_rank_top_techs(int (&)[13], int&);

    // Text shaping is a backend substitution; source chooses six advances and their row positions.
    void science_draw_tech(iptr advance, GameFont&, Sprite* categories, i8* ctx, int x, int y, RECT& r, int,
                           int*, i8*, CHAR*, CHAR*, CHAR*) {
        categories[suppliedAdvanceCategories[advance]].draw((iptr)ctx, (iptr)leader_surface, x, y);
        // Preserve identity for enhanced per-advance artwork, independent of row order.
        commands.back().text = std::to_string(advance);
        emit("tech-label", r.left, r.top, r.right - r.left, r.bottom - r.top, std::to_string(advance));
    }
};

struct {
    int spaceship_wnd_part_count_list[6]{};
} editor_text_edit_block;

int actualParts[6]{};

int spaceship_part_count(i32, int kind) {
    return actualParts[kind];
}

void win_flush_pending_msgs() {}

void spaceship_wnd_draw_title(i32) {
    emit("ship-title", 0, 0, 639, 40, "Asterian Starship");
}

struct SpaceshipWindow {
    // render_ship uses these source offsets for its framebuffer and scratch sprite.
    alignas(4) char backing[0xa00]{};
    int ship_civ = 1, launch_state = 1;

    struct ShipPartRow {
        u8 kind, count, pad[2];
        i32 v[6];
    };

    struct ShipSurfaces {
        i8 *surf_part, *surf_1b9, *surf_1e0, *surf_1c7, *surf_1ea, *surf_1d6, *surf_1eb, *surf_1ba, *surf_1e1,
            *surf_1c8, *surf_1e9, *surf_1d7;
    };

    void render_ship_init_rows(ShipPartRow*);
    int render_ship_load_surfaces(ShipSurfaces&);
    void render_ship_draw_part(ShipSurfaces&, ShipPartRow*, i8*);
    i32 render_ship();

    void render_ship_construct_surfaces(ShipSurfaces& sf, int& state) {
        state = 0; // Backend lifetime state is supplied; no legacy unwind stack is modeled.
        i8** surfaces = &sf.surf_part;
        for (int i = 0; i < 12; i++)
            surface_ctor((DibSurface*)surfaces[i]);
    }

    void render_ship_free_surfaces(ShipSurfaces&, int&) {}
};

static_assert(offsetof(SpaceshipWindow, backing) == 0, "Source offset backing");

struct {
    int x = 40, y = 40, size = 12, owner = 1, food_box = 79, shield_box = 53;
    signed char building = -12;
} cities[1];

struct {
    int cost = 12;
    const char* name = "Library";
} improvements[80];

struct {
    signed char cost = 8;
    int role = 0;
} unit_types[64];

struct {
    int id = 1, home_city = 0, type = 0, flags = UNITF_COSTS_SHIELD;
} units[3];

struct {
    int specialist_count = 2, food_box_rows = 10, shield_rows = 10, happy_count = 4, unhappy_count = 2,
        angry_count = 0, settler_food_cost = 1;

    union {
        int tile_yields[3]{};

        struct {
            int tile_food, tile_shields, tile_trade;
        };
    };
} city_calc;

struct {
    Sprite citizen_sprites[44];
} road_sprites_block;

struct {
    Sprite resource_icon_sprites, shield_icon_sprite;
} war_icon_sprite_block;

struct {
    Sprite improvement_icon_sprites[80], wonder_icon_sprites[28];
} caption_close_button_sprite_block;

struct {
    Sprite gold_coin_icon_sprite;
} tax_rate_icon_sprites_block;

struct {
    Sprite small_resource_icon_sprites, small_shield_icon_sprite, small_trade_icon_sprite;
} small_resource_icon_sprites_block;

Sprite small_unhappy_icon_sprite, unhappy_suppressed_icon_sprite;

struct {
    DibSurface window;
    int improvement_list_count = 0;
} city_wnd;

struct {
    const char* string_ids[512]{};
} label_table;

struct {
    char buf[256]{};
} textbuf;

iptr gfx_draw_target = 0;

int rect_width(RECT* r) {
    return r->right - r->left;
}

int rect_height(RECT* r) {
    return r->bottom - r->top;
}

void rect_set_xywh(iptr r, int x, int y, int w, int h) {
    *(RECT*)r = {x, y, x + w, y + h};
}

void rect_offset(iptr r, int x, int y) {
    OffsetRect((RECT*)r, x, y);
}

void rect_deflate(iptr p, int x, int y) {
    auto r = (RECT*)p;
    r->left += x;
    r->right -= x;
    r->top += y;
    r->bottom -= y;
}

void rect_inflate(iptr p, int x, int y) {
    rect_deflate(p, -x, -y);
}

void text_set_colors(int, int, int, int) {}

const char* label_string(const char* p) {
    return p ? p : "Food storage";
}

void gfx_draw_text_centered(const char* p, int x, int y, int w) {
    emit("text", x, y, w, 12, p);
}

void text_clear() {
    textbuf.buf[0] = 0;
}

void text_append_label(int n) {
    std::strcpy(textbuf.buf, n == 0x193   ? "Citizens"
                             : n == 0x1bf ? "Supported units"
                             : n == 0x1c0 ? "Improvements"
                                          : "Specialists");
}

void text_append_string_id(const char* p) {
    std::strcpy(textbuf.buf, p);
}

void gfx_draw_text(const char* p, int x, int y) {
    emit("text-left", x, y, 130, 11, p);
}

int extra_ui(int) {
    return 0;
}

int extras_attitude_color(int, int c) {
    return c;
}

bool bugfix_ui() {
    return true;
}

constexpr int X_CITY_ATTITUDE = 23;
constexpr int X_SUPPORT_LIST = 11, X_SUPPORT_SORT = 16;
#include "window-yield-tables.inc"

struct {
    i8 city_tile_dx_table[48], city_tile_dy_table[48];
} dir_dy_table_block;

struct YieldFixture {
    int worked, amount[3];
} yieldFixture[21];

int map_wrap_x(int x) {
    return (x + 128) % 128;
}

int city_tile_worked(int, int n) {
    return yieldFixture[n].worked;
}

void city_calc_tile_yields(int, int n, int) {
    std::copy(yieldFixture[n].amount, yieldFixture[n].amount + 3, city_calc.tile_yields);
}
struct CityWindow;

void extras_draw_supported_units(CityWindow*, int) {
    throw std::runtime_error("Unqualified extras list");
}

// Supplied renderer input; the game derives this value from civilization advances.
int suppliedCityEra = 2;

int civ_city_style_era(int) {
    return suppliedCityEra;
}

int city_specialist_type(int, int i) {
    return i + 1;
}

int city_has_improvement(int, int n) {
    return n >= 1 && n <= 8;
}

int unit_make_dummy(int n, int) {
    return n;
}

void gfx_draw_unit(iptr, int n, int, int x, int y, int z, int) {
    emit("unit/" + std::to_string(n), x, y, gfx_zoom_scale(64, z), gfx_zoom_scale(48, z));
}

void city_draw_bevel_rect(iptr p, int, int) {
    auto r = (RECT*)p;
    emit("bevel", r->left, r->top, rect_width(r), rect_height(r));
}

void city_draw_hline(int x, int end, int y, int) {
    emit("line", x, y, end - x, 1);
}

int ui_calc_item_spacing(int, int, int, iptr, iptr);
void sprite_draw_spaced_row(iptr, iptr, int, i32, int, int, int, i32, int);
void city_window_draw_icon_row(iptr, i32, i32, i32, i32, i32, i32, i32);

struct ClickMap {
    void remove_by_id(int) {}

    void hotspot_add_rect(int, int, RECT*) {}
};

struct Scrollbar {
    void set_range(int, int) {}

    void set_page_size(int) {}

    void set_pos(int) {}
};

#define PANEL(name) int name = 0, name##_top = 0, name##_right = 0, name##_bottom = 0

struct CityWindow {
    DibSurface surface; // Generic target routing only; not the real class layout.
    int view_scale = 2, margin_x_2 = 0, client_x = 0, client_y = 0, content_offset_y = 0;
    int is_closed = 0, redraw_suspended = 0, redraw_deferred = 0, city_index = 0, info_panel_mode = 0;
    PANEL(citizens_rect);
    PANEL(resource_map_rect);
    PANEL(resource_label_rect);
    PANEL(food_box_rect);
    PANEL(production_rect);
    int button_area_rect[4]{};
    PANEL(supported_units_rect);
    PANEL(supported_units_label_rect);
    PANEL(improvements_rect);
    PANEL(improvement_list_rect);
    PANEL(info_panel_rect);
    PANEL(info_title_rect);
    ClickMap clickmap;
    int improvement_scroll_pos = 0;
    Scrollbar scrollbar;
    Scrollbar* improvements_scrollbar = &scrollbar;
    int scale(int);
    void set_scaled_rect(iptr, int, int, int, int);
    void layout_rects();
    int draw_citizen_row(int, int, i32, int, int, int);
    void draw_citizens(int, i32);
    void draw_food_box(int);
    void draw_resource_yields(int, int, int, int, int);
    void draw_production(int);
    void draw_all(i32);
    void draw_info_panel(int);

    void begin_draw(iptr p) {
        auto r = (RECT*)p;
        emit("panel", r->left, r->top, rect_width(r), rect_height(r));
    }

    void wnd_blit_surface_rect(iptr) {}

    // Unextracted panels are explicit semantic adapters, kept distinct in the trace.
    void panel(const char* name, iptr p) {
        auto r = (RECT*)p;
        emit(name, r->left, r->top, rect_width(r), rect_height(r));
    }

    void draw_resource_map(int) {
        panel("adapter-resource-map", (iptr)&resource_map_rect);
        draw_resource_yields(48, 24, 12, resource_map_rect + 77, resource_map_rect_top + 59);
    }

    void draw_button_area(int) {
        panel("adapter-buttons", (iptr)button_area_rect);
    }

    void draw_supported_units(int);
    void draw_improvements(int);

    void draw_units_present() {
        panel("adapter-present", (iptr)&info_title_rect);
    }

    void draw_support_map() {
        throw std::runtime_error("Unqualified city support-map mode");
    }

    void draw_happiness() {
        throw std::runtime_error("Unqualified city happiness mode");
    }
};

#include "window-bodies.inc"

std::string quote(const std::string& s) {
    std::string r = "\"";
    for (char c : s) {
        if (c == '"' || c == '\\')
            r += '\\';
        r += c;
    }
    return r + '"';
}

void output(const std::string& mode, int w, int h) {
    std::cout << "{\"mode\":" << quote(mode) << ",\"width\":" << w << ",\"height\":" << h
              << ",\"commands\":[";
    bool comma = false;
    for (const auto& c : commands) {
        if (comma)
            std::cout << ',';
        comma = true;
        std::cout << "{\"asset\":" << quote(c.asset) << ",\"text\":" << quote(c.text) << ",\"x\":" << c.x
                  << ",\"y\":" << c.y << ",\"width\":" << c.w << ",\"height\":" << c.h
                  << ",\"resource\":" << c.resource << ",\"sx\":" << c.sx << ",\"sy\":" << c.sy
                  << ",\"target\":" << c.target << ",\"shade\":" << c.shade << '}';
    }
    std::cout << "]}\n";
}

int main(int argc, char** argv) {
    try {
        if (argc != 3)
            throw std::runtime_error("usage: atlas-windows diplomacy|spaceship|city-window fixture.txt");
        std::ifstream in(argv[2]);
        if (!in)
            throw std::runtime_error("Missing fixture");
        std::string mode = argv[1];
        if (mode == "diplomacy") {
            DiploLeaderWindow v;
            in >> civs[2].government >> civs[2].leader_portrait >> v.style_era >> game.power_rank[2];
            if (!in || civs[2].government < 0 || civs[2].government > 6 || civs[2].leader_portrait < 0 ||
                civs[2].leader_portrait > 20 || v.style_era < 0 || v.style_era > 3 ||
                game.power_rank[2] < 1 || game.power_rank[2] > 8)
                throw std::runtime_error("Diplomacy fixture domain");
            int advanceCount = 0;
            if (!(in >> advanceCount) || advanceCount < 0 || advanceCount > 100)
                throw std::runtime_error("Diplomacy advance-count fixture domain");
            for (int i = 0; i < advanceCount; i++) {
                int id, category, depth;
                if (!(in >> id >> category >> depth) || id < 0 || id >= 100 || category < 0 || category > 4 ||
                    depth < 1 || suppliedAdvances[id])
                    throw std::runtime_error("Diplomacy advance fixture domain");
                suppliedAdvances[id] = true;
                suppliedAdvanceCategories[id] = category;
                map_views_block.tech_prereq_depth_cache[id] = depth;
            }
            v.surface.target = 1;
            v.init_main_art();
            v.init_military();
            v.init_science();
            v.init_portrait();
            output(mode, 640, 480);
        } else if (mode == "spaceship") {
            SpaceshipWindow v;
            const int maximum[] = {39, 8, 8, 4, 4, 4};
            for (int i = 0; i < 6; i++) {
                in >> editor_text_edit_block.spaceship_wnd_part_count_list[i] >> actualParts[i];
                if (!in || actualParts[i] < 0 || actualParts[i] > maximum[i] ||
                    editor_text_edit_block.spaceship_wnd_part_count_list[i] < actualParts[i] ||
                    editor_text_edit_block.spaceship_wnd_part_count_list[i] > maximum[i])
                    throw std::runtime_error("Spaceship fixture domain");
            }
            auto buffer = (DibSurface*)((iptr)&v + 0x8f4);
            buffer->resource = -100;
            buffer->target = -100;
            v.render_ship();
            output(mode, 640, 480);
        } else if (mode == "city-window") {
            CityWindow v;
            in >> cities[0].size >> cities[0].food_box >> cities[0].shield_box >> city_calc.happy_count >>
                city_calc.unhappy_count >> city_calc.specialist_count;
            if (!in || cities[0].size < 1 || cities[0].size > 40 || cities[0].food_box < 0 ||
                cities[0].food_box > (cities[0].size + 1) * 10 || cities[0].shield_box < 0 ||
                cities[0].shield_box > 120 || city_calc.specialist_count < 0 ||
                city_calc.specialist_count > 3 || city_calc.happy_count < 0 || city_calc.unhappy_count < 0 ||
                city_calc.happy_count + city_calc.unhappy_count + city_calc.specialist_count > cities[0].size)
                throw std::runtime_error("City fixture domain");
            for (int i = 0; i < 44; i++) {
                auto& s = road_sprites_block.citizen_sprites[i];
                s.id = 100 + i;
                s.w = 27;
                s.h = 30;
            }
            for (int i = 0; i < 80; i++) {
                auto& s = caption_close_button_sprite_block.improvement_icon_sprites[i];
                s.id = 200 + i;
                s.w = 36;
                s.h = 20;
            }
            const char* names[] = {"Palace",      "Barracks", "Granary",    "Temple",
                                   "Marketplace", "Library",  "Courthouse", "City walls"};
            for (int i = 1; i <= 8; i++)
                improvements[i].name = names[i - 1];
            for (int& city : game.wonder_city)
                city = -1;
            tax_rate_icon_sprites_block.gold_coin_icon_sprite.id = 3;
            tax_rate_icon_sprites_block.gold_coin_icon_sprite.w = 14;
            tax_rate_icon_sprites_block.gold_coin_icon_sprite.h = 14;
            war_icon_sprite_block.resource_icon_sprites.id = 1;
            war_icon_sprite_block.resource_icon_sprites.w = 14;
            war_icon_sprite_block.resource_icon_sprites.h = 14;
            war_icon_sprite_block.shield_icon_sprite = war_icon_sprite_block.resource_icon_sprites;
            war_icon_sprite_block.shield_icon_sprite.id = 2;
            small_resource_icon_sprites_block.small_shield_icon_sprite =
                war_icon_sprite_block.shield_icon_sprite;
            small_resource_icon_sprites_block.small_shield_icon_sprite.w = 10;
            small_resource_icon_sprites_block.small_shield_icon_sprite.h = 10;
            std::memcpy(dir_dy_table_block.city_tile_dx_table, dir_dy_table_block_init + 16, 48);
            std::memcpy(dir_dy_table_block.city_tile_dy_table, dir_dy_table_block_init + 64, 48);
            for (int i = 0; i < 21; i++) {
                auto& f = yieldFixture[i];
                in >> f.worked >> f.amount[0] >> f.amount[1] >> f.amount[2];
                if (!in || f.worked < 0 || f.worked > 1)
                    throw std::runtime_error("Worked-tile fixture required");
                for (int a : f.amount)
                    if (a < 0 || a > 6)
                        throw std::runtime_error("Yield fixture domain");
            }
            // Optional explicit review state after the 21 worked-tile rows.
            std::string option;
            if (in >> option) {
                if (option != "citizens" || !(in >> suppliedCityEra >> city_calc.angry_count) ||
                    suppliedCityEra < 0 || suppliedCityEra > 3 || city_calc.angry_count < 0 ||
                    city_calc.angry_count > city_calc.unhappy_count)
                    throw std::runtime_error("Citizen era/mood fixture domain");
            }
            Sprite* small[] = {&small_resource_icon_sprites_block.small_resource_icon_sprites,
                               &small_resource_icon_sprites_block.small_shield_icon_sprite,
                               &small_resource_icon_sprites_block.small_trade_icon_sprite};
            for (int i = 0; i < 3; i++) {
                small[i]->id = 11 + i;
                small[i]->w = 10;
                small[i]->h = 10;
            }
            small_unhappy_icon_sprite.id = 14;
            small_unhappy_icon_sprite.w = small_unhappy_icon_sprite.h = 10;
            v.layout_rects();
            v.draw_all(0);
            output(mode, 636, 421);
        } else
            throw std::runtime_error("Unknown window mode");
        return 0;
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
