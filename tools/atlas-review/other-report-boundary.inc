// Review device and immutable gameplay-input boundary.
struct FrameComplete {};
std::map<int, std::string> civNames, civAdjectives, civLeaders, civTitles;
std::vector<std::string> creditLines;
DibSurface *textTarget = nullptr;
GameFont *textFont = nullptr;
int textFg = 10, textBg = 37, textDx = 1, textDy = 1;
extern "C" BOOL CopyRect(RECT *d, const RECT *s) {
    *d = *s;
    return 1;
}
void WndBase::set_resize_border(int) {}
WndMouseFn WndHandlers::set_dblclick_handler(WndMouseFn f) {
    return f;
}
WndNotifyFn WndHandlers::set_drag_begin_callback(WndNotifyFn f) {
    return f;
}
WndNotifyFn WndHandlers::set_drag_end_callback(WndNotifyFn f) {
    return f;
}
void ModalMenuWindow::end_modal_loop() {}
void SurfaceWindow::repaint() {
    if (on_paint)
        on_paint();
}
void FrameWindow::destroy_caption_buttons() {}
FrameWindow *FrameWindow::construct() {
    memset(this, 0, sizeof(*this));
    return this;
}
void FrameWindow::destruct() {}
void frame_wnd_on_caption_button_click(int) {}
void mp_window_drag_begin() {}
void mp_window_drag_end() {}
void casualty_scrollbar_on_scroll(int) {}
void casualty_timeline_on_dblclick(int, int) {}
void council_on_advisor_button(uint) {}
void wnd_flush_paint() {}
void win_flush_pending_msgs() {}
GameFont *GameFont::init_empty() {
    return this;
}
GameFont *GameFont::destroy() {
    return this;
}
GamePalette *GamePalette::init() {
    return this;
}
GamePalette *GamePalette::destroy() {
    return this;
}
GamePalette *GamePalette::scalar_destruct(uint) {
    return this;
}
void GamePalette::get_rgb(int, int, int) {}
void GamePalette::set_rgb(int, int, int) {}
DibSurface *surface_ctor(DibSurface *s) {
    return s;
}
DibSurface *surface_dtor(DibSurface *s) {
    return s;
}
DibSurface *DibSurface::surface_delete(uint) {
    return this;
}
void DibSurface::set_palette(iptr) {}
int DibSurface::get_width() {
    return surfaceSizes.count(this) ? surfaceSizes.at(this).right : width;
}
int DibSurface::get_height() {
    return surfaceSizes.count(this) ? surfaceSizes.at(this).bottom : height;
}
u32 *DibSurface::get_rect() {
    auto &r = surfaceSizes[this];
    return (u32 *)&r;
}
void DibSurface::create(int w, int h) {
    surfaceSizes[this] = {0, 0, w, h};
    offscreen[this].clear();
    reset_clip();
}
void DibSurface::fill(int c) {
    auto r = surfaceSizes.count(this) ? surfaceSizes.at(this) : RECT{0, 0, width, height};
    gfx_fill_rect((iptr)this, &r, c);
}
int DibSurface::load_gif_resource(int id, uint, uint, iptr) {
    surfaceAssets[this] = std::to_string(id);
    return 1;
}
void DibSurface::blit(DibSurface *dest, RECT *sr, RECT *dr) {
    gfx_copy_rect_xywh((iptr)this, (iptr)dest, sr->left, sr->top, dr->left, dr->top,
                       dr->right - dr->left, dr->bottom - dr->top);
}
void gfx_copy_rect_xywh(iptr from, iptr to, int sx, int sy, int x, int y, int w, int h) {
    auto src = (DibSurface *)from, dest = (DibSurface *)to;
    if (surfaceAssets.count(src))
        emit("image", x, y, w, h,
             surfaceAssets.at(src) + "," + std::to_string(sx) + "," + std::to_string(sy), 0, dest);
    if (offscreen.count(src)) {
        for (auto d : offscreen.at(src)) {
            d.x += x - sx;
            d.y += y - sy;
            d.clip = {x, y, x + w, y + h};
            if (offscreen.count(dest))
                offscreen[dest].push_back(d);
            else
                draws.push_back(d);
        }
    } else if (!surfaceAssets.count(src))
        throw std::runtime_error("Unknown source surface in blit");
}
Sprite *sprite_init(Sprite *s) {
    return s;
}
Sprite *Sprite::scalar_destruct(uint) {
    return this;
}
void Sprite::grab_from_surface(iptr from, uint, int sx, int sy, int w, int h) {
    auto s = (DibSurface *)from;
    if (surfaceAssets.count(s))
        sprites[this] = {"crop/" + surfaceAssets.at(s) + "," + std::to_string(sx) + "," +
                             std::to_string(sy) + "," + std::to_string(w) + "," + std::to_string(h),
                         w, h};
    else {
        sprites[this] = {"buffer", w, h};
        spriteBuffers[this] = offscreen.at(s);
        auto &v = spriteBuffers[this];
        v.erase(std::remove_if(v.begin(), v.end(),
                               [](const Draw &d) { return d.op == "fill" && d.color == 250; }),
                v.end());
    }
}
void text_set_surface(iptr p) {
    textTarget = (DibSurface *)p;
}
void text_set_font(iptr p) {
    textFont = (GameFont *)p;
}
void text_set_colors(int fg, int bg, int dx, int dy) {
    textFg = fg;
    textBg = bg;
    if (dx >= 0)
        textDx = dx;
    if (dy >= 0)
        textDy = dy;
}
int text_draw_shadowed(iptr target, const char *s, int x, int y) {
    auto t = (DibSurface *)target;
    emit("text", x + textDx, y + textDy, 0, 0, s, textBg, t, textFont);
    emit("text", x, y, 0, 0, s, textFg, t, textFont);
    return x + textFont->text_width(s);
}
int text_draw_centered(iptr t, const char *s, int x, int y, int w) {
    return text_draw_shadowed(t, s, x + (w - textFont->text_width(s) - abs(textDx)) / 2, y);
}
int text_draw_right_aligned(iptr t, const char *s, int x, int y, int w) {
    return text_draw_shadowed(t, s, x + w - textFont->text_width(s) - abs(textDx), y);
}
int gfx_draw_text(const char *s, int x, int y) {
    return text_draw_shadowed((iptr)textTarget, s, x, y);
}
void gfx_draw_text_centered(const char *s, int x, int y, int w) {
    text_draw_centered((iptr)textTarget, s, x, y, w);
}
void gfx_draw_line_color(iptr s, int x, int y, int xx, int yy, int color) {
    emit("line", x, y, xx, yy, "", color, (DibSurface *)s);
}
char *civ_name_plural(int c) {
    return civNames.at(c).data();
}
char *civ_leader_name(int c) {
    return civLeaders.at(c).data();
}
int civ_leader_title(int c) {
    return (int)civTitles.at(c).c_str();
}
int civ_adjective(int c) {
    return (int)civAdjectives.at(c).c_str();
}
int civ_get_adjective(int c) {
    return civ_adjective(c);
}
int civ_color_primary(int c) {
    return civ_primary_colors_block.civ_colors[c].primary;
}
int unit_make_dummy(int type, int owner) {
    units[2047].type = type;
    units[2047].owner = owner;
    return 2047;
}
void gfx_draw_unit(iptr target, int u, uint flags, int x, int y, int z, int) {
    emit("unit", x, y, 64 * (z + 8) / 8, 48 * (z + 8) / 8, std::to_string(u), flags,
         (DibSurface *)target);
}
int city_find_nearest(int, int, int, int, int) {
    return -1;
} // Only used by declared casualty fixture, no nearest-city suffix.
int rand_range(int low, int) {
    return low;
} // Deterministic historian category and author.
char *credits_get_line(int i) {
    return creditLines.at(i).data();
}
char *__itoa(int n, char *d, int base) {
    return _itoa(n, d, base);
}
int Dialog::destruct() {
    return 0;
}
int Dialog::show_modal(iptr) {
    render();
    finishControls();
    throw FrameComplete{};
}
Scrollbar *Scrollbar::construct() {
    return this;
}
void Scrollbar::set_pos(int p) {
    controls.at((Control *)this).draw.face = p;
}
void Scrollbar::set_range(int l, int r) {
    auto &d = controls.at((Control *)this).draw;
    d.size = l;
    d.style = r;
}

#define OUTSIDE_RENDER throw std::runtime_error("Interactive continuation outside review frame")
extern "C" BOOL BringWindowToTop(HWND) {
    OUTSIDE_RENDER;
}
NativeWindow *WndBase::get_window() {
    OUTSIDE_RENDER;
}
void ModalMenuWindow::set_modal_idle_callback(WndNotifyFn) {}
void ModalMenuWindow::run_modal_loop() {
    for (auto &[ptr, c] : controls)
        c.visible = true;
    finishControls();
    throw FrameComplete{};
}
u32 Dialog::run_modal(iptr, iptr) {
    return show_modal(0);
}
int ScenarioEvents::check_negotiation(int, int) {
    OUTSIDE_RENDER;
}
void Checkbox::set_callback(CheckboxToggleFn) {}
void ErrorContext::report(int, int, int, int) {
    throw std::runtime_error("Source validation failure");
}
void ParleyWindow::open(int, uint) {
    OUTSIDE_RENDER;
}
void PediaWindow::show_topic_modal(int) {
    OUTSIDE_RENDER;
}
void CityWindow::recalc_redraw(int) {
    OUTSIDE_RENDER;
}
void taxrate_dialog_redraw() {
    taxrate_wnd.dlg->paint();
}
void taxrate_on_tax_scroll(int) {}
void taxrate_on_science_scroll(int) {}
void taxrate_on_lux_scroll(int) {}
void taxrate_on_ok_clicked() {}
void taxrate_on_lock_toggled(int, int) {}
void win_pump_one_message() {
    OUTSIDE_RENDER;
}
int timer_ticks() {
    return 0;
}
int popup_game(const char *) {
    OUTSIDE_RENDER;
}
int popup_game_with_sprite(const char *, int, int) {
    OUTSIDE_RENDER;
}
int popup_game_sprite_flags(const char *, int, int, int) {
    OUTSIDE_RENDER;
}
void intel_report_show(int, int) {
    OUTSIDE_RENDER;
}
void mp_meeting_wait_idle() {
    OUTSIDE_RENDER;
}
void advisor_refresh_if_open(int) {
    OUTSIDE_RENDER;
}
void diplo_ai_meet_player(int, int, int, int, int) {
    OUTSIDE_RENDER;
}
void diplo_set_treaty_flags(int, int, uint) {
    OUTSIDE_RENDER;
}
int net_send_message(int, int, int, int, int, int, int, int, const char *, int) {
    OUTSIDE_RENDER;
}
void turn_popup_timeout_idle() {
    OUTSIDE_RENDER;
}
void ui_flush_input() {}
int prefs_save_civ2dat() {
    OUTSIDE_RENDER;
}
void civ_research_goal_dialog(int, int, int) {
    OUTSIDE_RENDER;
}
int city_recalc(int, int) {
    OUTSIDE_RENDER;
}
void net_send_text_args(int, int, int, int, int, int) {
    OUTSIDE_RENDER;
}
void net_modal_idle_poll() {
    OUTSIDE_RENDER;
}
void unit_stack_unlink(int, int) {
    OUTSIDE_RENDER;
}
void unit_stack_link(int, int, int, int) {
    OUTSIDE_RENDER;
}
char dbg_logf(const char *, int) {
    OUTSIDE_RENDER;
}
DibSurface *drawTarget = nullptr;
void gfx_set_draw_target(iptr s) {
    drawTarget = (DibSurface *)s;
}
void gfx_fill_draw_target(int c) {
    drawTarget->fill(c);
}
void gfx_target_frame_rect(RECT *r, int c) {
    gfx_draw_rect_frame((iptr)drawTarget, r, c);
}
void gfx_target_fill_rect(int x, int y, int w, int h, int c) {
    emit("fill", x, y, w, h, "", c, drawTarget);
}
void gfx_draw_hline(iptr s, int x, int xx, int y, int c) {
    emit("fill", x, y, xx - x + 1, 1, "", c, (DibSurface *)s);
}
std::vector<Tile> fixtureTiles;
std::vector<u8> knownTiles;
int fixtureCity = 0;
u32 CityWindow::get_city() {
    return fixtureCity;
}
Tile *tile_at(int x, int y) {
    return &fixtureTiles.at(y * (map.width / 2) + (x / 2));
}
u8 *known_at(int x, int y, int c) {
    if (c != 6)
        throw std::runtime_error("Unsupplied remembered map");
    return &knownTiles.at(y * (map.width / 2) + x / 2);
}
void gfx_draw_city(iptr target, int city, uint flags, int x, int y, int z) {
    emit("city", x, y, 64 * (z + 8) / 8, 48 * (z + 8) / 8, std::to_string(city), flags,
         (DibSurface *)target);
}
int civ_pick_research_advance(int c) {
    return civs[c].researching;
} // Advice is disabled for the forced picker frame.
void diplo_eval_ai_stance(int from, int to) {
    diplo_eval.cur_attitude = civs[to].attitude[from];
} // Supplied saved relation, not AI negotiation.
int extras_population_limit() {
    return 32000;
}
extern "C" {
uint64_t extras_enabled = 0, extras_rules = 0;
const char *extras_text(const char *) {
    OUTSIDE_RENDER;
}
}

void extras_append_shield_cost(int) {
    OUTSIDE_RENDER;
}

void PictureWindow::close() {}
int DibSurface::load_gif_file(const char *, uint, uint, iptr) {
    surfaceAssets[this] = "credits";
    return 1;
}
u32 DibSurface::surface_width() {
    return 600;
}
u32 DibSurface::surface_height() {
    return 400;
}
void advisor_on_close_clicked(int) {}
