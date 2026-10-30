#include "engine-shim.h"
#include "engine-tables.inc"
#include "engine-bodies.inc"

void initialize() {
#define TABLE(n) std::memcpy(&n, n##_init, sizeof(n##_init) - 1)
    TABLE(diag_neighbor_bits_block);
    TABLE(dir_dx_table_block);
    TABLE(dir_dy_table_block);
    TABLE(cityview_improvement_art_x_block);
    TABLE(cityview_slot_x_table_block);
    TABLE(throneroom_piece_rect_x_block);
    TABLE(throneroom_piece4_rect_x_block);
#undef TABLE
    for (int i = 0; i < 28; i++)
        game.wonder_city[i] = -1;
    for (int i = 0; i < 10; i++)
        named(terrain_base_sprites_block.terrain_base_sprites[i], "terrain/" + std::to_string(i));
    named(terrain_base_sprites_block.terrain_ocean_sprite, "terrain/10");
    for (int m = 0; m < 8; m++)
        for (int q = 0; q < 4; q++)
            named(tutorial_icon_sprite_block.coast_quarter_sprites[m * 4 + q],
                  "coast/" + std::to_string(q) + "/" + std::to_string(m), 32, 16);
    for (int q = 0; q < 4; q++) {
        named(tile_pick_mask_sprite_block.river_mouth_sprites[q], "mouth/" + std::to_string(q));
        named(map_cursor_sprite_block.unexplored_dither_sprites[q], "fog/" + std::to_string(q), 32, 16);
    }
    for (int t = 0; t < 13; t++)
        for (int q = 0; q < 4; q++)
            named(map_cursor_sprite_block.terrain_dither_sprites[t * 4 + q],
                  "dither/" + std::to_string(t) + "/" + std::to_string(q), 32, 16);
    for (int i = 0; i < 16; i++) {
        named(forest_sprites[i], "feature/forest/" + std::to_string(i));
        named(mountain_sprites[i], "feature/mountains/" + std::to_string(i));
        named(hill_sprites_block.hill_sprites[i], "feature/hills/" + std::to_string(i));
        named(icon_misc_sprites_block.river_sprites[i], "river/" + std::to_string(i));
    }
    named(land_improvement_sprites_block.land_improvement_sprites, "improvement/irrigation");
    named(land_improvement_sprites_block.farmland_sprite, "improvement/farmland");
    named(land_improvement_sprites_block.mine_sprite, "improvement/mine");
    for (int i = 0; i < 9; i++) {
        named(road_sprites_block.road_sprites[i], "road/" + std::to_string(i));
        named(road_sprites_block.railroad_sprites[i], "rail/" + std::to_string(i));
    }
    named(grassland_shield_sprite, "resource/shield");
    named(pollution_sprite_block.pollution_sprite, "improvement/pollution");
    named(hut_sprite, "improvement/village");
    named(fortify_overlay_sprites_block.fortress_sprite, "improvement/fortress", 64, 48);
    named(fortify_overlay_sprites_block.fortify_overlay_sprites, "improvement/fortified", 64, 48);
    named(fortify_overlay_sprites_block.city_disorder_icon_sprite, "improvement/disorder", 64, 48);
    for (int i = 0; i < 2; i++)
        named(airbase_sprites_block.airbase_sprites[i],
              i ? "improvement/airbase-occupied" : "improvement/airbase", 64, 48);
    for (int i = 0; i < 22; i++)
        named(city_down_arrow_sprite_block.terrain_resource_sprites[i], "resource/" + std::to_string(i));
    named(unexplored_tile_sprite, "fog/full");
    named(map_grid_sprite, "grid");
    named(icons_pair_sprites_block.city_radius_grid_sprite, "grid/radius");
    named(unit_shield_sprite, "shield", 12, 20);
    for (int i = 0; i < 64; i++) {
        named(pollution_sprite_block.unit_sprites[i], "unit/" + std::to_string(i), 64, 48);
        road_sprites_block.unit_shield_x_offsets[i] = 48;
        road_sprites_block.unit_shield_y_offsets[i] = 4;
    }
    for (int i = 0; i < 48; i++) {
        named(gfx_sheet_surface_block.city_sprites[i], "city/" + std::to_string(i), 64, 48);
        road_sprites_block.city_label_y_offsets[i] = 36;
        road_sprites_block.city_size_box_x_offsets[i] = 27;
        peace_treaty_icon_sprite_block.city_flag_x_offsets[i] = 48;
        peace_treaty_icon_sprite_block.city_flag_y_offsets[i] = 4;
    }
    for (int i = 0; i < 16; i++)
        named(editor_tile_backdrop_sprite_block.civ_flag_sprites[i], "flag/" + std::to_string(i / 2), 8, 16);
    units[-1] = Unit{};
    units[-1].owner = 0;
    units[-1].visibility = 0; // Explicit empty-stack sentinel backing for this fixture.
}

std::string quote(const std::string& s) {
    std::string o = "\"";
    for (char c : s) {
        if (c == '"' || c == '\\')
            o += '\\';
        o += c;
    }
    return o + '"';
}

void output(int width, int height, const std::string& mode, int zoom = 0) {
    std::cout << "{\"mode\":" << quote(mode) << ",\"width\":" << width << ",\"height\":" << height
              << ",\"zoom\":" << zoom << ",\"rngFinal\":" << uint(g_nr_seed) << ",\"commands\":[";
    bool comma = false;
    for (const auto& c : commands) {
        if (comma)
            std::cout << ',';
        comma = true;
        std::cout << "{\"asset\":" << quote(c.name) << ",\"x\":" << c.x << ",\"y\":" << c.y
                  << ",\"width\":" << c.w << ",\"height\":" << c.h << ",\"color\":" << c.color
                  << ",\"text\":" << quote(c.text) << '}';
    }
    std::cout << "]}\n";
}

int main(int argc, char** argv) {
    try {
        initialize();
        if (argc < 3)
            throw std::runtime_error("usage: atlas-engine map|city|throne fixture.txt");
        std::ifstream in(argv[2]);
        if (!in)
            throw std::runtime_error("Fixture missing");
        std::string mode = argv[1];
        if (mode == "audit") {
            map.width = 16;
            map.height = 16;
            tiles.resize(256);
            MapView v;
            for (int rail = 0; rail < 2; rail++)
                for (int mask = 0; mask < 256; mask++) {
                    for (auto& t : tiles)
                        t = Tile{};
                    for (int d = 0; d < 8; d++) {
                        int dx = ((i8*)&dir_dx_table_block.dir_dx_table)[d],
                            dy = ((i8*)&dir_dy_table_block.dir_dy_table)[d];
                        auto& t = fixture_tile(8 + dx, 8 + dy);
                        t.known = (mask & (1 << d)) ? (rail ? 48 : 16) : 0;
                    }
                    record("case-road", mask, rail, 0, 0);
                    v.draw_tile_roads(0, 0, 0, 8, 8, 1, rail ? 48 : 16);
                }
            for (int mask = 0; mask < 256; mask++) {
                for (auto& t : tiles)
                    t = Tile{};
                fixture_tile(8, 8).raw[0] = 10;
                for (int d = 0; d < 8; d++) {
                    int dx = ((i8*)&dir_dx_table_block.dir_dx_table)[d],
                        dy = ((i8*)&dir_dy_table_block.dir_dy_table)[d];
                    fixture_tile(8 + dx, 8 + dy).raw[0] = (mask & (1 << d)) ? 2 : 10;
                }
                record("case-coast", mask, 0, 0, 0);
                v.draw_tile_ocean(0, 0, 0, 8, 8, 0, 32, 16);
            }
            for (int z = -7; z <= 8; z++) {
                for (auto& t : tiles)
                    t = Tile{};
                fixture_tile(8, 8).raw[0] = 130;
                fixture_tile(8, 8).known = 20;
                record("case-zoom", z, 0, 0, 0);
                v.zoom_u = z;
                v.tile_width_u = gfx_zoom_scale(64, z);
                v.tile_height_u = gfx_zoom_scale(32, z);
                v.half_tile_width_u = v.tile_width_u / 2;
                v.half_tile_height_u = v.tile_height_u / 2;
                v.draw_tile_terrain(0, 0, 0, 8, 8, 1, z, -1);
            }
            for (auto& t : tiles)
                t = Tile{};
            fixture_tile(9, 7).raw[1] = 48;
            fixture_tile(9, 7).known = 0;
            record("case-known", 1, 0, 0, 0);
            v.draw_tile_roads(0, 0, 0, 8, 8, 1, 16);
            record("case-known", -1, 0, 0, 0);
            v.draw_tile_roads(0, 0, 0, 8, 8, -1, 16);
            record("case-city", 0, 0, 0, 0);
            fixture_tile(8, 8).city = 0;
            fixture_tile(9, 7).known = 18;
            v.draw_tile_roads(0, 0, 0, 8, 8, 1, 18);
            output(0, 0, "audit");
        } else if (mode == "map") {
            MapView v;
            int cols, rows, viewer, grid;
            in >> map.width >> map.height >> v.zoom_u >> v.origin_x_uptr >> v.origin_y_uptr >> cols >> rows >>
                viewer >> grid;
            if (!in || map.width < 4 || map.height < 4 || map.width > 256 || map.height > 256 ||
                v.zoom_u < -7 || v.zoom_u > 8 || cols < 1 || cols > 128 || rows < 1 || rows > 256 ||
                viewer < -1 || viewer > 7 || ((v.origin_x_uptr + v.origin_y_uptr) & 1))
                throw std::runtime_error("Map fixture domain");
            game.game_options = grid ? OPT_MAP_GRID : 0;
            tiles.resize(map.width * map.height);
            v.tile_width_u = gfx_zoom_scale(64, v.zoom_u);
            v.tile_height_u = gfx_zoom_scale(32, v.zoom_u);
            v.half_tile_width_u = v.tile_width_u / 2;
            v.half_tile_height_u = v.tile_height_u / 2;
            v.half_view_width = cols;
            v.tile_columns = cols + 1;
            v.field_2fc = rows - 1;
            v.field_304 = 0;
            int x, y, t, flags, known, visible, res, hut, city, unit, shield;
            while (in >> x >> y >> t >> flags >> known >> visible >> res >> hut >> city >> unit >> shield) {
                if (!map_in_bounds(x, y) || (t & 15) > 10 || t < 0 || t > 138 || flags < 0 || flags > 255 ||
                    known < 0 || known > 255 || res < 0 || res > 2 || city < -1 || city >= 16 || unit < -1 ||
                    unit >= 64)
                    throw std::runtime_error("Tile fixture domain");
                auto& a = fixture_tile(x, y);
                a.raw[0] = u8(t);
                a.raw[1] = u8(flags);
                a.known = u8(known);
                a.visible = visible;
                a.resource = res;
                a.hut = hut;
                a.city = city;
                a.unit = unit;
                a.shield = shield;
                if (city >= 0) {
                    cities[city].x = x;
                    cities[city].y = y;
                    game.num_cities = std::max(game.num_cities, city + 1);
                    improvements[city][IMP_PALACE] = true;
                }
                if (unit >= 0) {
                    units[unit].x = x;
                    units[unit].y = y;
                    units[unit].type = unit;
                }
            }
            v.client_width = cols * v.tile_width_u;
            v.client_height = rows * v.half_tile_height_u;
            v.center_x_u = (v.origin_x_uptr + cols) | ((v.origin_y_uptr + (rows + 1) / 2) << 16);
            v.cached_zoom = v.zoom_u;
            v.update_layout();
            commands.clear();
            v.draw_all_tiles(viewer);
            output(v.client_width, v.client_height, "map", v.zoom_u);
        } else if (mode == "city") {
            CityViewWindow v;
            std::memset(v.backing, 0, sizeof v.backing);
            int population, kind, n;
            in >> kind >> artEra >> population >> map.seed;
            if (!in || kind < 0 || kind > 2 || artEra < 0 || artEra > 3 || population < 0 || population > 127)
                throw std::runtime_error("City fixture domain");
            map.width = 128;
            map.height = 128;
            tiles.resize(map.width * map.height);
            cities[0].x = 30;
            cities[0].y = 30;
            cities[0].size = population;
            cities[0].flags = kind == 0 ? CITYF_COASTAL : 0;
            if (kind == 1)
                fixture_tile(31, 29).raw[0] |= 0x80;
            while (in >> n) {
                if (n >= 1 && n <= 34)
                    improvements[0][n] = true;
                else if (n >= 100 && n < 128)
                    game.wonder_city[n - 100] = 0;
                else
                    throw std::runtime_error("City improvement domain");
            }
            v.classify_site();
            std::memcpy(v.improvement_slot_tables, cityview_slot_x_table_block.cityview_slot_tables_init,
                        0x174);
            std::memcpy(v.improvement_slot_tables + 0x174, str_empty, 0x120);
            ((DibSurface*)v.improvement_art_surface)->resource = 300;
            ((DibSurface*)v.wonder_art_surface)->resource = 305;
            for (int i = 0; i < 4; i++) {
                named(*(Sprite*)(v.building_art_block + 0x643 + i * 60), "house/small/" + std::to_string(i),
                      123, 82);
                named(*(Sprite*)(v.building_art_block + 0x823 + i * 60), "house/large/" + std::to_string(i),
                      158, 114);
                named(*(Sprite*)(v.building_art_block + 0x553 + i * 60), "lot/small/" + std::to_string(i),
                      123, 82);
                named(*(Sprite*)(v.building_art_block + 0x733 + i * 60), "lot/large/" + std::to_string(i),
                      158, 114);
            }
            v.layout_buildings();
            v.draw_buildings();
            output(1280, 480, "city");
        } else if (mode == "throne") {
            ThroneRoomWindow v;
            int n;
            for (int i = 0; i < 9; i++) {
                if (!(in >> n) || n < 0 || n > (i == 8 ? 127 : 4))
                    throw std::runtime_error("Throne fixture domain");
                civs[1].throne_room[i] = char(n);
            }
            in >> v.throne_complete;
            if (!v.render())
                throw std::runtime_error("Resource binding failed");
            output(640, 480, "throne");
        } else
            throw std::runtime_error("Unknown scene");
        return 0;
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
