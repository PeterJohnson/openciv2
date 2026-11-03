// Finite fixture/drawing boundary for unchanged additional window renderers.
// Game state records keep the source widths and layouts; no game source is edited.
#include <algorithm>
#include <cctype>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
using HWND = void*;
using HDC = void*;
using HBRUSH = void*;
using HPALETTE = void*;
using HCURSOR = void*;
using HICON = void*;
using HBITMAP = void*;
using HGDIOBJ = void*;

struct RECT {
    int left, top, right, bottom;
};

#include "civ2types.h"
#include "enums.h"
using uint = unsigned int;
using byte = unsigned char;
using ushort = unsigned short;
static_assert(sizeof(void*) == 4, "MSVC x86 fixture boundary");
using longlong = long long;
using ulonglong = unsigned long long;
using tagRECT = RECT;
#define GameFont ReportMetricFont
#include "native-font.h"
#undef GameFont
#include "report-font-leading.inc"

struct GameFont : ReportMetricFont {
    int line_spacing() {
        for (const auto& f : reportFontLeading)
            if (f[0] == face && f[1] == height && f[2] == style)
                return f[3];
        throw std::runtime_error("Unsupplied line spacing");
    }

    void init_styled(int f, int h, int s) {
        set_styled(f, h, s);
    }
};

struct Command {
    std::string asset, text;
    int x, y, width, height, color = 10, face = 0, fontHeight = 18, style = 0;
};

std::vector<Command> commands;

void emit(const std::string& asset, int x, int y, int w, int h, const std::string& text = "",
          int color = 10) {
    commands.push_back({asset, text, x, y, w, h, color});
}

int W = 600, H = 400, backgroundResource = 53;
GameFont advisor_bold_font, defaultFont;
GameFont* activeFont = &defaultFont;
int foreground = 37, shadow = 18, shadowX = 1, shadowY = 1;

struct DibSurface {
    void wnd_blit_surface() {}
};

struct FrameWindow : DibSurface {
    void layout() {}

    void draw_caption() {}
};

struct PictureWindow : FrameWindow {
    void blit() {
        emit("background", 0, 0, W, H, std::to_string(backgroundResource));
    }
};

struct Scrollbar {
    RECT rect{};

    void create(iptr, int, iptr r, int) {
        rect = *(RECT*)r;
    }

    void set_range(int, int) {}

    void set_pos(int) {}

    void set_page_size(int) {}

    template <class T> void set_callback(T) {}
};

struct Control {
    void show_and_redraw() {
        auto r = ((Scrollbar*)this)->rect;
        emit("scrollbar", r.left, r.top, r.right - r.left, r.bottom - r.top);
    }
};

struct WndHandlers {
    template <class T> void set_lbuttonup_handler(T) {}
};

struct {
    PictureWindow window;
    int wnd = 0;
    WndHandlers wnd_events;
    int client_x = 0, client_y = 0, client_width = 600, client_right = 600;
    int client_rect = 0, client_rect_top = 0, client_rect_right = 600, client_rect_bottom = 400;
    int column_width = 0, controls_created = 0, first_row = 0, items_per_page = 0, list_height = 0,
        list_left = 0, list_top = 0, list_width = 0, page_count = 1, report_civ = 1, report_param = 0,
        row_height = 0, rows_per_page = 0, vscroll_width = 16;
    Scrollbar scrollbar;
} advisor_state;

struct {
    GameFont advisor_font;
} advisor_font_block;

struct {
    GameFont hall_of_fame_font;
    HallOfFameEntry hall_of_fame[6];
} advisor_window_block;

struct Sprite {
    int id = 0, w = 28, h = 30;
    char backing[48]{};

    int draw(iptr, iptr, int x, int y) {
        if (w < 1 || w > 512 || h < 1 || h > 512)
            throw std::runtime_error("Unbound source sprite");
        emit("sprite", x, y, w, h, std::to_string(id));
        return x + w;
    }
};

static_assert(sizeof(Sprite) == 0x3c, "Source sprite array stride");

struct {
    Sprite citizen_sprites[44];
} road_sprites_block;

struct {
    Sprite wonder_icon_sprites[28];
} caption_close_button_sprite_block;

struct {
    Sprite advance_category_icon_sprites[20];
} government_sprites_block;

struct {
    Sprite gold_coin_icon_sprite, science_icon_sprite;
} tax_rate_icon_sprites_block;

struct {
    Sprite resource_icon_sprites[6];
} war_icon_sprite_block;

City cities[256]{};
Civ civs[8]{};
GameState game{};
Unit units[2048]{};
UnitType unit_types[64]{};
Advance advances[100]{};
Improvement improvements[80]{};
Cosmic cosmic{};
MapHeader map{};
Tile mapTiles[9000]{};
Leader leaders[21]{};

struct {
    Tile* tiles = mapTiles;
} map_data;

struct {
    int specialist_count = 0, angry_count = 0, happy_count = 0, unhappy_count = 0, tax_total = 0,
        lux_total = 0, total_shields = 0, total_trade = 0, pollution_divisor = 2, pop_pollution_factor = 1,
        yield_totals[3]{};
} city_calc;

struct {
    int citizens = 0, wonders = 0, spaceship_arrived = 0, spaceship_in_flight = 0, pollution = 0, peace = 0,
        future_techs = 0, barbarian_bonus = 0, total = 0, conquest_bonus = -1, scenario_points = 0,
        total_objective_value = 0, objective_civ_value = 0, civ_objective_value = 0, objective_outcome = 0;
} civ_score;

struct {
    int flags[2]{}, objective_civ = 1, victory_thresholds[3]{};
} scenario;

struct {
    int cur_attitude = 0;
} diplo_eval;

struct {
    int unit_ability_list_nonempty = 0;
} tiles_dll_block;

struct {
    char game_txt_path[512]{};
} main_frame_wnd_block;

struct {
    GameFont* font = &defaultFont;
} text_style;

struct {
    iptr string_ids[1024]{};
} label_table;

struct {
    char buf[4096]{};
} textbuf;

int human_civ[8]{1}, game_language = 0;
bool savedState = false;
std::string civNames[8], civAdjectives[8], leaderNames[8], leaderTitles[8];
int civEras[8]{}, researchCosts[8]{}, civPopulation[8]{};
bool knownTech[8][100]{}, ownedBuildings[256][80]{};
std::vector<std::string> stringStore;
std::map<std::string, std::vector<std::string>> gameSections;
std::vector<std::string> sectionLines;
size_t sectionPosition = 0;
std::string stringArgs[10];
iptr difficulty_names[6]{}, attitude_names[9]{}, government_names[7]{};
#include "report-strings.inc"

char* label_string(iptr p) {
    if (!p)
        throw std::runtime_error("Missing string binding");
    return (char*)p;
}

void text_append(const char* p) {
    if (!p || std::strlen(textbuf.buf) + std::strlen(p) >= sizeof(textbuf.buf))
        throw std::runtime_error("Invalid text span");
    std::strcat(textbuf.buf, p);
}

void text_clear() {
    textbuf.buf[0] = 0;
}

void text_append_label(int i) {
    if (i < 0 || i >= 1024)
        throw std::runtime_error("Label index");
    text_append(label_string(label_table.string_ids[i]));
}

void text_append_string_id(iptr p) {
    text_append(label_string(p));
}

void text_append_int(int n) {
    text_append(std::to_string(n).c_str());
}

void text_append_long(int n) {
    text_append_int(n);
}

void text_append_space() {
    text_append(" ");
}

void text_append_colon() {
    text_append(": ");
}

void text_append_comma() {
    text_append(", ");
}

void text_append_period() {
    text_append(".");
}

void text_append_lparen() {
    text_append("(");
}

void text_append_rparen() {
    text_append(")");
}

void text_append_percent() {
    text_append("%");
}

void text_append_population(int n) {
    text_append_int(n);
}

std::string populationText(int units) {
    std::string s = std::to_string(units * 10000);
    for (int i = int(s.size()) - 3; i > 0; i -= 3)
        s.insert(i, ",");
    return s;
}

void text_append_population(int civ, int amount) {
    text_append(populationText(amount < 0 ? civPopulation[civ] : amount).c_str());
}

void text_append_gold(int n) {
    text_append_int(n);
    text_append(" gold");
}

void text_append_city_name(int n) {
    text_append(cities[n].name);
}

void text_append_year(int n) {
    if (n >= 0)
        text_append("A.D. ");
    text_append_int(std::abs(n));
    if (n < 0)
        text_append(" B.C.");
}

void str_clear(char* p) {
    *p = 0;
}

void str_append(char* p, const char* s) {
    std::strcat(p, s);
}

void str_append_label(iptr p, int n) {
    str_append((char*)p, label_string(label_table.string_ids[n]));
}

void str_append_string_id(iptr p, iptr n) {
    str_append((char*)p, label_string(n));
}

void str_append_population(iptr p, int n) {
    str_append((char*)p, std::to_string(n).c_str());
}

void str_append_population(iptr p, int civ, int amount) {
    str_append((char*)p, populationText(amount < 0 ? civPopulation[civ] : amount).c_str());
}

void crt_strcpy(char* p, const char* s) {
    std::strcpy(p, s);
}

char* __strupr(char* p) {
    for (char* q = p; *q; q++)
        *q = char(std::toupper((unsigned char)*q));
    return p;
}

void text_set_surface(iptr) {}

void text_set_font(iptr p) {
    activeFont = (GameFont*)p;
    text_style.font = activeFont;
}

void text_set_colors(int fg, int bg, int dx, int dy) {
    foreground = fg;
    shadow = bg;
    if (dx >= 0)
        shadowX = dx;
    if (dy >= 0)
        shadowY = dy;
}

int nativeText(const char* s, int x, int y) {
    const int w = activeFont->text_width(s), h = activeFont->font_cached_height();
    for (int pass = 0; pass < 2; pass++) {
        emit("text", x + (pass ? 0 : shadowX), y + (pass ? 0 : shadowY), w, h, s, pass ? foreground : shadow);
        auto& c = commands.back();
        c.face = activeFont->face;
        c.fontHeight = activeFont->height;
        c.style = activeFont->style;
    }
    return x + w;
}

int gfx_draw_text(const char* s, int x, int y) {
    return nativeText(s, x, y);
}

void gfx_draw_text_centered(const char* s, int x, int y, int w) {
    nativeText(s, x + (w - activeFont->text_width(s) - std::abs(shadowX)) / 2, y);
}

int gfx_draw_text_right(const char* s, int x, int y, int w) {
    return nativeText(s, x + w - activeFont->text_width(s) - std::abs(shadowX), y);
}

void gfx_draw_rect_frame(iptr, RECT* r, int color) {
    emit("frame", r->left, r->top, r->right - r->left, r->bottom - r->top, "", color);
}

void gfx_draw_hline(iptr, int x, int right, int y, int color) {
    emit("fill", x, y, right - x, 1, "", color);
}

int int_clamp(int n, int lo, int hi) {
    return std::clamp(n, lo, hi);
}

int rect_width(RECT* r) {
    return r->right - r->left;
}

int rect_height(RECT* r) {
    return r->bottom - r->top;
}

void rect_set(iptr p, int l, int t, int r, int b) {
    *(RECT*)p = {l, t, r, b};
}

int GetSystemMetrics(int n) {
    if (n == 2 || n == 3)
        return 16;
    throw std::runtime_error("Unsupplied metric");
}

bool bugfix_ui() {
    return true;
}

int extra_ui(int) {
    return 0;
}

constexpr int X_CELEBRATING = 22, X_RESEARCH = 1, X_ZERO_UPKEEP = 2, X_CITY_STATUS = 3;

int extras_attitude_color(int, int c) {
    return c;
}

void extras_draw_food_trend(iptr, int, int, int) {
    throw std::runtime_error("Unselected extra UI");
}

void extras_city_status_draw() {
    throw std::runtime_error("Unselected extra UI");
}

int civ_city_style_era(int c);

char* civ_name_plural(int c) {
    return civNames[c].data();
}

char* civ_leader_name(int c) {
    return leaderNames[c].data();
}

iptr civ_leader_title(int c) {
    return (iptr)leaderTitles[c].c_str();
}

iptr civ_get_adjective(int c) {
    return (iptr)civAdjectives[c].c_str();
}

int civ_color_primary(int c) {
    return 200 + c;
}

int civ_color_secondary(int c) {
    return 210 + c;
}

int city_specialist_type(int c, int i) {
    return i < 16 ? ((cities[c].specialists >> ((i * 2) & 31)) & 3) : 1;
}

int civ_has_advance(int c, int n) {
    return n >= 0 && n < 100 && knownTech[c][n];
}

int city_has_improvement(int c, int n) {
    return n >= 0 && n < 40 && ((cities[c].improvements[n / 8] >> (n % 8)) & 1);
}

int civ_has_wonder(int c, int n) {
    return n >= 0 && n < 28 && game.wonder_city[n] >= 0 && cities[game.wonder_city[n]].owner == c;
}

int civ_research_cost(int c) {
    return researchCosts[c];
}

int civ_improvement_upkeep(int, int n) {
    return improvements[n].upkeep;
}

int civ_total_population(int c) {
    return civPopulation[c];
}

void city_recalc(int c, int) {
    city_calc.happy_count = cities[c].happy;
    city_calc.unhappy_count = cities[c].unhappy;
    city_calc.tax_total = cities[c].tax;
    city_calc.total_shields = cities[c].total_shields;
    city_calc.total_trade = cities[c].trade;
    city_calc.yield_totals[0] = cities[c].total_food;
    city_calc.specialist_count = cities[c].worked_tiles >> 26;
}

void civ_calc_score(int) {} // Supplied score inputs, not a score/gameplay simulation.

void diplo_eval_ai_stance(int, int) {
    diplo_eval.cur_attitude = 3;
}

int diplo_attitude_level(int) {
    return 3;
}

int unit_make_dummy(int type, int) {
    return type;
}

void gfx_draw_unit(iptr, int type, int flags, int x, int y, int zoom, int) {
    emit("unit-glyph", x, y, zoom, flags, std::to_string(type));
}

void gfx_draw_city(iptr, int city, int flags, int x, int y, int zoom) {
    emit("city-glyph", x, y, zoom, flags, std::to_string(city));
}

int ui_calc_item_spacing(int, int, int, iptr, iptr);
void sprite_draw_spaced_row(iptr, iptr, int, int, int, int, int, int, int);

void text_set_string_arg(int i, const char* s) {
    stringArgs[i] = s;
}

int text_open_section(const char*, const char* section) {
    auto i = gameSections.find(section);
    if (i == gameSections.end())
        throw std::runtime_error("Missing GAME section " + std::string(section));
    sectionLines = i->second;
    sectionPosition = 0;
    return 0;
}

char* text_read_line(int) {
    if (sectionPosition == sectionLines.size())
        return nullptr;
    std::strcpy(textbuf.buf, sectionLines[sectionPosition++].c_str());
    return textbuf.buf;
}

int text_read_section_line(const char* file, const char* section, int n) {
    text_open_section(file, section);
    for (int i = 0; i < n; i++)
        text_read_line(1);
    return text_read_line(1) ? 0 : 1;
}

void text_expand_vars(iptr input, iptr output) {
    std::string value = (char*)input;
    for (int i = 0; i < 10; i++) {
        std::string key = "%STRING" + std::to_string(i);
        size_t p;
        while ((p = value.find(key)) != std::string::npos)
            value.replace(p, key.size(), stringArgs[i]);
    }
    std::strcpy((char*)output, value.c_str());
}

void attitude_advisor_on_scroll(int) {}

void attitude_advisor_on_click(int, int) {}

void defense_minister_on_scroll(int) {}

void intel_report_on_scroll(int) {}

void intel_report_on_click(int, int) {}

void science_advisor_on_scroll(int) {}

void science_advisor_on_click(int, int) {}

void trade_advisor_on_scroll(int) {}

void trade_advisor_on_click(int, int) {}

void city_status_on_scroll(int) {}

void city_status_on_click(int, int) {}

void wonders_report_on_scroll(int) {}

void wonders_report_on_click(int, int) {}

#include "report-bodies.inc"

std::string quote(const std::string& value) {
    std::ostringstream o;
    o << '"';
    for (unsigned char c : value) {
        if (c == '"' || c == '\\')
            o << '\\' << c;
        else if (c < 32 || c >= 127)
            o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << int(c) << std::dec;
        else
            o << c;
    }
    o << '"';
    return o.str();
}

std::string store(const std::string& s) {
    stringStore.push_back(s);
    return s;
}

void loadInputs(const char* path) {
    stringStore.reserve(4096);
    std::ifstream in(path);
    if (!in)
        throw std::runtime_error("Missing fixture input");
    std::fill(std::begin(game.wonder_city), std::end(game.wonder_city), -1);
    for (auto& f : advisor_window_block.hall_of_fame)
        f.score = -1;
    std::string kind;
    while (in >> kind) {
        if (kind == "raw") {
            std::string name, hex;
            in >> name >> hex;
            void* target = nullptr;
            size_t limit = 0;
            if (name == "game") {
                target = &game;
                limit = sizeof(game);
                savedState = true;
            } else if (name == "civs") {
                target = civs;
                limit = sizeof(civs);
            } else if (name == "cities") {
                target = cities;
                limit = sizeof(cities);
            } else if (name == "units") {
                target = units;
                limit = sizeof(units);
            } else if (name == "map_header") {
                target = &map;
                limit = sizeof(map);
            } else if (name == "tiles") {
                target = mapTiles;
                limit = sizeof(mapTiles);
            }
            if (!target || hex.size() % 2 || hex.size() / 2 > limit)
                throw std::runtime_error("Invalid saved record");
            for (size_t i = 0; i < hex.size() / 2; i++)
                ((unsigned char*)target)[i] = (unsigned char)std::stoul(hex.substr(i * 2, 2), nullptr, 16);
        } else if (kind == "view") {
            in >> advisor_state.report_civ;
            human_civ[0] = advisor_state.report_civ;
        } else if (kind == "label") {
            int id;
            std::string value;
            in >> id >> std::quoted(value);
            stringStore.push_back(value);
            label_table.string_ids[id] = (iptr)stringStore.back().c_str();
        } else if (kind == "civ") {
            int c, era, gov, gold, tech, cost, pop;
            in >> c >> era >> gov >> gold >> tech >> cost >> pop >> std::quoted(civNames[c]) >>
                std::quoted(civAdjectives[c]) >> std::quoted(leaderNames[c]) >> std::quoted(leaderTitles[c]);
            civEras[c] = era;
            civs[c].government = gov;
            civs[c].gold = gold;
            civs[c].researching = tech;
            civs[c].research_progress = 137;
            civs[c].science_rate = 6;
            civs[c].tax_rate = 3;
            researchCosts[c] = cost;
            civPopulation[c] = pop;
            game.civs_alive |= 1 << c;
        } else if (kind == "city") {
            int id, c, size, happy, unhappy, tax, science, food, shields, trade, building;
            std::string name;
            in >> id >> c >> size >> happy >> unhappy >> tax >> science >> food >> shields >> trade >>
                building >> std::quoted(name);
            auto& q = cities[id];
            q.id = id + 1;
            q.owner = c;
            q.size = size;
            q.happy = happy;
            q.unhappy = unhappy;
            q.tax = tax;
            q.science = science;
            q.total_food = food;
            q.total_shields = shields;
            q.trade = trade;
            q.building = building;
            q.shield_box = 37;
            std::strcpy(q.name, name.c_str());
            game.num_cities = std::max<int>(game.num_cities, id + 1);
            civs[c].num_cities++;
            civs[c].total_city_size += size;
        } else if (kind == "building") {
            int c, n;
            in >> c >> n;
            ownedBuildings[c][n] = true;
        } else if (kind == "wonder") {
            int n, c;
            in >> n >> c;
            game.wonder_city[n] = c;
        } else if (kind == "advance") {
            int n, cat, epoch;
            std::string name;
            if (!(in >> n >> cat >> epoch >> std::quoted(name)) || n < 0 || n >= 100 ||
                cat < 0 || cat >= 5 || epoch < 0 || epoch >= 4)
                throw std::runtime_error("Advance category/epoch domain");
            stringStore.push_back(name);
            advances[n].name = (iptr)stringStore.back().c_str();
            advances[n].category = cat;
            advances[n].epoch = epoch;
        } else if (kind == "known") {
            int c, n;
            in >> c >> n;
            knownTech[c][n] = true;
            civs[c].num_advances++;
            game.first_discoverer[n] = c;
        } else if (kind == "unit-type") {
            int n, a, d, m, hp, fp, cost, domain, active, building, lost;
            std::string name;
            in >> n >> a >> d >> m >> hp >> fp >> cost >> domain >> active >> building >> lost >>
                std::quoted(name);
            stringStore.push_back(name);
            auto& u = unit_types[n];
            u.name = (iptr)stringStore.back().c_str();
            u.attack = a;
            u.defense = d;
            u.move = m;
            u.hit_points = hp;
            u.firepower = fp;
            u.cost = cost;
            u.domain = domain;
            civs[1].units_active[n] = active;
            civs[1].units_in_production[n] = building;
            civs[1].units_lost[n] = lost;
        } else if (kind == "unit-extra") {
            int n, hold, flags;
            in >> n >> hold >> flags;
            unit_types[n].hold = hold;
            unit_types[n].flags = flags;
        } else if (kind == "improvement") {
            int n, cost, upkeep;
            std::string name;
            in >> n >> cost >> upkeep >> std::quoted(name);
            stringStore.push_back(name);
            improvements[n].name = (iptr)stringStore.back().c_str();
            improvements[n].cost = cost;
            improvements[n].upkeep = upkeep;
        } else if (kind == "fame") {
            int n, score, rating, year;
            std::string leader, civ;
            in >> n >> score >> rating >> year >> std::quoted(leader) >> std::quoted(civ);
            auto& f = advisor_window_block.hall_of_fame[n];
            f.score = score;
            f.rating = rating;
            f.year = year;
            f.difficulty = 3;
            f.population = 850;
            std::strcpy(f.leader_name, leader.c_str());
            std::strcpy(f.civ_name, civ.c_str());
        } else if (kind == "section") {
            std::string section, line;
            in >> std::quoted(section) >> std::quoted(line);
            gameSections[section].push_back(line);
        } else
            throw std::runtime_error("Unknown fixture field " + kind);
        if (!in)
            throw std::runtime_error("Malformed fixture input");
    }
    if (!savedState) {
        game.year = 1788;
        game.turn = 240;
        game.difficulty = 3;
    }
    cosmic.road_move_mult = 3;
    cosmic.shield_box_rows = 10;
    for (int c = 1; c < 8; c++)
        for (int n = 0; n < 100; n++)
            knownTech[c][n] = (civs[c].advances[n / 8] >> (n % 8)) & 1;
    const char* governments[] = {"Anarchy",        "Despotism", "Monarchy", "Communism",
                                 "Fundamentalism", "Republic",  "Democracy"};
    for (int i = 0; i < 7; i++)
        government_names[i] = (iptr)governments[i];
    const char* attitudes[] = {"Enraged",      "Hostile",    "Uncooperative", "Neutral", "Cordial",
                               "Enthusiastic", "Worshipful", "Neutral",       "Neutral"};
    for (int i = 0; i < 9; i++)
        attitude_names[i] = (iptr)attitudes[i];
    const char* difficulties[] = {"Chieftain", "Warlord", "Prince", "King", "Emperor", "Deity"};
    for (int i = 0; i < 6; i++)
        difficulty_names[i] = (iptr)difficulties[i];
    civ_score.citizens = 142;
    civ_score.wonders = 100;
    civ_score.peace = 30;
    civ_score.barbarian_bonus = 25;
    civ_score.total = 297;
    advisor_font_block.advisor_font.set(0, 18);
    advisor_bold_font.set_styled(0, 14, 1);
    advisor_window_block.hall_of_fame_font.set_styled(0, 16, 1);
    for (int i = 0; i < 44; i++)
        road_sprites_block.citizen_sprites[i] = {i, 27, 30};
    for (int i = 0; i < 28; i++)
        caption_close_button_sprite_block.wonder_icon_sprites[i] = {100 + i, 36, 20};
    for (int i = 0; i < 20; i++)
        government_sprites_block.advance_category_icon_sprites[i] = {200 + i, 36, 20};
    tax_rate_icon_sprites_block.gold_coin_icon_sprite = {300, 14, 14};
    tax_rate_icon_sprites_block.science_icon_sprite = {301, 14, 14};
    for (int i = 0; i < 3; i++)
        war_icon_sprite_block.resource_icon_sprites[i * 2] = {302 + i, 14, 14};
}

int main(int argc, char** argv) {
    try {
        if (argc != 3)
            throw std::runtime_error("atlas-reports MODE FIXTURE");
        loadInputs(argv[2]);
        std::string mode = argv[1];
        if (mode == "attitude") {
            backgroundResource = 53;
            attitude_advisor_draw();
        } else if (mode == "defense" || mode == "losses") {
            backgroundResource = 51;
            advisor_state.report_param = mode == "losses";
            defense_minister_draw();
        } else if (mode == "intelligence") {
            backgroundResource = 52;
            advisor_state.report_param = 7;
            intel_report_draw();
        } else if (mode == "top-cities") {
            backgroundResource = 57;
            top_cities_draw();
        } else if (mode == "demographics") {
            backgroundResource = 58;
            demographics_draw();
        } else if (mode == "hall-of-fame") {
            backgroundResource = 57;
            advisor_state.report_param = -1;
            hall_of_fame_draw();
        } else if (mode == "science") {
            backgroundResource = 55;
            science_advisor_draw();
        } else if (mode == "score") {
            backgroundResource = 59;
            civ_score_window_draw();
        } else if (mode == "trade") {
            backgroundResource = 54;
            trade_advisor_draw();
        } else if (mode == "city-status") {
            backgroundResource = 50;
            city_status_draw();
        } else if (mode == "wonders") {
            backgroundResource = 56;
            wonders_report_draw();
        } else
            throw std::runtime_error("Unknown report mode " + mode);
        if (mode == "science" || mode == "trade" || mode == "defense" || mode == "losses" ||
            mode == "intelligence") {
            int label = mode == "science"        ? 0x173
                        : mode == "trade"        ? 0x16f
                        : mode == "defense"      ? 0x159
                        : mode == "intelligence" ? 0xc5
                                                 : 0x158;
            emit("button", 2, 374, 297, 24, label_string(label_table.string_ids[label]));
            emit("button", 301, 374, 297, 24, "Close");
        } else
            emit("button", 2, 374, 596, 24, "Close");
        std::cout << "{\"width\":" << W << ",\"height\":" << H << ",\"commands\":[";
        for (size_t i = 0; i < commands.size(); i++) {
            if (i)
                std::cout << ',';
            const auto& c = commands[i];
            std::cout << "{\"asset\":" << quote(c.asset) << ",\"text\":" << quote(c.text) << ",\"x\":" << c.x
                      << ",\"y\":" << c.y << ",\"width\":" << c.width << ",\"height\":" << c.height
                      << ",\"color\":" << c.color << ",\"face\":" << c.face
                      << ",\"fontHeight\":" << c.fontHeight << ",\"style\":" << c.style << '}';
        }
        std::cout << "]}\n";
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
