// Device, input and media boundary only. Layout decisions stay in extracted
// bodies.
#define GameFont MetricFont
#include "native-font.h"
#undef GameFont
#include "report-font-leading.inc"
struct Draw {
    std::string op, text;
    int x = 0, y = 0, w = 0, h = 0, color = 10, face = 0, size = 18, style = 0;
    RECT clip{0, 0, 640, 400};
};
std::vector<Draw> draws;
std::map<DibSurface *, std::vector<Draw>> offscreen;
std::map<DibSurface *, RECT> surfaceSizes;
std::map<DibSurface *, std::string> surfaceAssets;
std::map<Sprite *, std::vector<Draw>> spriteBuffers;
int width = 640, height = 400, ink = 10, scaleN = 1, scaleD = 1;
std::map<GameFont *, MetricFont> fonts;
std::map<DibSurface *, RECT> clips;
struct Asset {
    std::string key;
    int w, h;
};
std::map<Sprite *, Asset> sprites;
struct ReviewControl {
    Draw draw;
    bool visible = false;
    GameFont *font = nullptr;
    bool disabled = false;
};
std::map<Control *, ReviewControl> controls;
GameFont *buttonFont = nullptr;
std::map<int, std::string> pool;
std::map<std::string, std::vector<std::string>> textFiles;
std::map<std::string, std::string> rawInputs;
std::string virtualDirectory = "home";
std::vector<std::string> *reading = nullptr;
size_t readPos = 0;
void emit(std::string op, int x, int y, int w, int h, std::string text = "", int color = -1,
          DibSurface *s = nullptr, GameFont *font = nullptr) {
    Draw d;
    d.op = op;
    d.x = x;
    d.y = y;
    d.w = w;
    d.h = h;
    d.text = text;
    d.color = color < 0 ? ink : color;
    d.clip = s ? clips.at(s) : RECT{0, 0, width, height};
    if (font) {
        const auto &f = fonts.at(font);
        d.face = f.face;
        d.size = f.height;
        d.style = f.style;
    }
    if (s && offscreen.count(s))
        offscreen[s].push_back(d);
    else
        draws.push_back(d);
}
extern "C" BOOL SetRect(RECT *r, int l, int t, int rr, int b) {
    *r = {l, t, rr, b};
    return 1;
}
extern "C" BOOL OffsetRect(RECT *r, int x, int y) {
    r->left += x;
    r->right += x;
    r->top += y;
    r->bottom += y;
    return 1;
}
extern "C" BOOL InflateRect(RECT *r, int x, int y) {
    r->left -= x;
    r->right += x;
    r->top -= y;
    r->bottom += y;
    return 1;
}
extern "C" int GetSystemMetrics(int n) {
    if (n == 3 || n == 2)
        return 17;
    if (n == 0)
        return 640;
    if (n == 1)
        return 480;
    throw std::runtime_error("Unbound screen metric");
}
void *crt_memcpy(void *d, const void *s, size_t n) {
    return std::memcpy(d, s, n);
}
void *crt_memmove(void *d, const void *s, size_t n) {
    return std::memmove(d, s, n);
}
char *crt_strcpy(char *d, const char *s) {
    return std::strcpy(d, s);
}
char *crt_strcat(char *d, const char *s) {
    return std::strcat(d, s);
}
size_t _strlen(const char *s) {
    return std::strlen(s);
}
int _strcmp(const char *a, const char *b) {
    return std::strcmp(a, b);
}
void *operator_new(size_t n) {
    return std::calloc(1, n);
}
int _sprintf(char *out, const char *fmt, ...) {
    va_list a;
    va_start(a, fmt);
    int n = vsprintf(out, fmt, a);
    va_end(a);
    return n;
}
int __chdir(const char *path) {
    virtualDirectory = path;
    return 0;
}
char *lang_pool_text(int i) {
    return (char *)pool.at(i).c_str();
}
uint file_exists(const char *name) {
    return virtualDirectory == "home" ? 1 : 0;
}
int text_open_section(const char *filename, const char *section) {
    std::string name = filename;
    std::transform(name.begin(), name.end(), name.begin(), ::toupper);
    if (name.find('.') == std::string::npos)
        name += ".TXT";
    auto f = textFiles.find(name);
    if (f == textFiles.end())
        throw std::runtime_error("Missing text file: " + name);
    reading = &f->second;
    std::string tag = "@" + std::string(section);
    for (size_t i = 0; i < reading->size(); i++)
        if (_stricmp(reading->at(i).c_str(), tag.c_str()) == 0) {
            readPos = i + 1;
            return 0;
        }
    reading = nullptr;
    return 1;
}
char *text_read_line(int trim) {
    if (!reading || readPos >= reading->size()) {
        textbuf.buf[0] = 0;
        return nullptr;
    }
    auto &s = reading->at(readPos++);
    if (s.size() > 254)
        throw std::runtime_error("Oversized text fixture line");
    std::strcpy(textbuf.buf, s.c_str());
    if (trim == 1)
        str_trim(textbuf.buf);
    *(char **)&text_parse.line_cursor = textbuf.buf;
    return textbuf.buf;
}
void str_append_string_id(iptr dst, int i) {
    std::strcat((char *)dst, label_string(i));
}
void str_append_label(iptr dst, int i) {
    str_append_string_id(dst, label_table.string_ids[i]);
}
int str_append_int(iptr dst, int n) {
    std::strcat((char *)dst, std::to_string(n).c_str());
    return 0;
}
GameFont *GameFont::init(i32 f, i32 h) {
    fonts[this].set(f, h);
    cached_height = fonts.at(this).font_cached_height();
    return this;
}
GameFont *GameFont::init_styled(i32 f, i32 h, i32 s) {
    init(f, h);
    fonts[this].style = s;
    cached_height = fonts.at(this).font_cached_height();
    return this;
}
void GameFont::set_styled(i32 f, i32 h, i32 s) {
    init_styled(f, h, s);
}
void GameFont::set(i32 f, iptr h) {
    init(f, h);
}
u32 GameFont::font_cached_height() {
    return fonts.at(this).font_cached_height();
}
int GameFont::text_width(const char *s) {
    return fonts.at(this).text_width(s);
}
int GameFont::line_spacing() {
    auto f = fonts.at(this);
    for (auto &q : reportFontLeading)
        if (q[0] == f.face && q[1] == f.height && q[2] == f.style)
            return q[3];
    throw std::runtime_error("Font leading missing");
}
int WndBase::client_width() {
    return 640;
}
int WndBase::client_height() {
    return 480;
}
void WndBase::set_caption_height(i32) {}
void Wnd::set_keyboard_nav(i32) {}
WndKeyFn WndHandlers::set_keydown_handler(WndKeyFn f) {
    return f;
}
WndCloseFn WndHandlers::set_close_handler(WndCloseFn f) {
    return f;
}
void SurfaceWindow::set_redraw_callback(WndNotifyFn f) {
    on_paint = f;
}
void DibSurface::wnd_create_with_surface(const char *, i32, i32, i32, i32 w, i32 h, iptr, iptr) {
    width = w;
    height = h;
    surfaceSizes[this] = {0, 0, w, h};
    reset_clip();
}
void DibSurface::reset_clip() {
    clips[this] = surfaceSizes.count(this) ? surfaceSizes.at(this) : RECT{0, 0, width, height};
}
void DibSurface::set_clip(RECT *r) {
    clips[this] = *r;
}
void DibSurface::get_clip(RECT *r) {
    *r = clips.at(this);
}
void DibSurface::wnd_blit_surface_rect(iptr) {}
void DibSurface::fill_rect(iptr r, i32 c) {
    gfx_fill_rect((iptr)this, (RECT *)r, c);
}
void DibSurface::draw_text(iptr f, const char *s, iptr x, int y, uint flags) {
    if (flags != 5)
        throw std::runtime_error("Unbound text flags");
    emit("text", x, y, 0, 0, s, -1, this, (GameFont *)f);
}
void DibSurface::draw_text_rect(iptr f, const char *s, iptr r, i32 flags) {
    RECT box = *(RECT *)r;
    emit("wrapped", box.left, box.top, box.right - box.left, box.bottom - box.top, s, -1, this,
         (GameFont *)f);
}
void DibSurface::draw_line(u32 x, u32 y, u32 xx, u32 yy) {
    emit("line", x, y, xx, yy, "", -1, this);
}
i8 gfx_set_text_color_index(i32 c) {
    int old = ink;
    ink = c & 255;
    return old;
}
void gfx_fill_rect(iptr target, RECT *r, i32 c) {
    emit("fill", r->left, r->top, r->right - r->left, r->bottom - r->top, "", c,
         (DibSurface *)target);
}
void gfx_draw_bevel_rect(iptr target, RECT *r, i32 a, i32 b) {
    emit("bevel", r->left, r->top, r->right - r->left, r->bottom - r->top, std::to_string(b), a,
         (DibSurface *)target);
}
int gfx_tile_fill(iptr target, iptr tile, int x, int y, int w, int h, int ox, int oy) {
    emit("tile", x, y, w, h,
         (tile == (iptr)&window_border_tile_surface ||
          tile == (iptr)&frame_texture_surface_block.frame_texture_surface)
             ? "window-border"
             : "panel-texture",
         0, (DibSurface *)target);
    auto &d = offscreen.count((DibSurface *)target) ? offscreen[(DibSurface *)target].back()
                                                    : draws.back();
    d.face = ox;
    d.size = oy;
    return 1;
}
void gfx_set_scale_ratio(i32 n, i32 d) {
    scaleN = n;
    scaleD = d;
}
void gfx_get_scale_ratio(iptr n, iptr d) {
    *(int *)n = scaleN;
    *(int *)d = scaleD;
}
void gfx_reset_zoom_scale() {
    scaleN = scaleD = 1;
}
void gfx_set_zoom_scale(int z) {
    scaleN = z + 8;
    scaleD = 8;
}
int Sprite::get_width() {
    return sprites.at(this).w;
}
int Sprite::get_height() {
    return sprites.at(this).h;
}
int Sprite::width() {
    return sprites.at(this).w;
}
int Sprite::height() {
    return sprites.at(this).h;
}
iptr Sprite::draw(iptr dest, iptr target, int x, int y) {
    const auto &a = sprites.at(this);
    int w = get_width() * scaleN / scaleD, h = get_height() * scaleN / scaleD;
    if (spriteBuffers.count(this)) {
        for (auto d : spriteBuffers.at(this)) {
            d.x += x;
            d.y += y;
            d.clip = clips.at((DibSurface *)target);
            draws.push_back(d);
        }
    } else
        emit("sprite", x, y, w, h, a.key, 0, (DibSurface *)target);
    *(RECT *)dest = {x, y, x + w, y + h};
    return dest;
}
void ui_set_button_font(iptr f) {
    buttonFont = (GameFont *)f;
}
void ui_set_default_font(iptr) {}
void Button::create(iptr, int, iptr r, const char *label) {
    RECT q = *(RECT *)r;
    controls[(Control *)this] = {
        {"button", label, q.left, q.top, q.right - q.left, q.bottom - q.top}, false, buttonFont};
}
void Button::set_default_button() {}
void Button::set_cancel_button() {}
void Button::set_callback(CtrlNotifyFn) {}
void Button::disable() {
    controls.at((Control *)this).disabled = true;
}
void Button::enable() {
    controls.at((Control *)this).disabled = false;
}
void Control::show_and_redraw() {
    auto i = controls.find(this);
    if (i != controls.end())
        i->second.visible = true;
}
void Control::hide() {
    auto i = controls.find(this);
    if (i != controls.end())
        i->second.visible = false;
}
void Control::set_text(const char *) {}
void Scrollbar::create(iptr, int, iptr r, int) {
    RECT q = *(RECT *)r;
    controls[(Control *)this] = {
        {"scrollbar", "", q.left, q.top, q.right - q.left, q.bottom - q.top}, false, nullptr};
}
void Scrollbar::set_callback(CtrlNotifyFn) {}
void Scrollbar::set_track_callback(CtrlNotifyFn) {}
void Scrollbar::set_page_size(u32 n) {
    controls.at((Control *)this).draw.text = std::to_string(n);
}
void EditControl::create_styled(iptr, int, iptr, const char *, int, int) {}
Hotspot *hotspot_ctor(Hotspot *h) {
    return h;
}
void Hotspot::create(iptr, int, iptr) {}
void Hotspot::set_click_callback(CtrlNotifyFn) {}
void Hotspot::set_dblclick_callback(CtrlNotifyFn) {}
Hotspot *Hotspot::scalar_destruct(uint) {
    return this;
}
void ui_pump_messages() {}
void text_close_file() {}
void pedia_show_tech_tree() {}
void pedia_list_on_key(int) {}
int pedia_close() {
    return 0;
}
void pedia_redraw_page() {}
void pedia_on_close() {}
void pedia_on_back() {}
void pedia_toggle_describe(int) {}
void pedia_show_advance_tree(int) {}
void pedia_list_on_click(int) {}
void pedia_list_on_scroll(int) {}
void PediaWindow::clear_links() {}
void PediaWindow::free_lists() {}
void PediaWindow::history_push() {}

char *pedia_lookup_text(PediaListNode *node, int index) {
    while (index-- && node)
        node = node->next;
    if (!node)
        throw std::runtime_error("Missing Pedia name");
    return node->name;
}

void Hyperlink::create(iptr, int, iptr) {}
void Hyperlink::set_click_callback(CtrlNotifyFn) {}
void Hyperlink::set_dblclick_callback(CtrlNotifyFn) {}
PediaLink *PediaLink::construct() {
    return this;
}
void pedia_link_on_click_advance(int) {}
void pedia_link_on_click_improvement(int) {}
void pedia_link_on_click_wonder(int) {}
void pedia_link_on_click_unit(int) {}
void pedia_link_on_click_terrain(int) {}

void str_trim_trailing(char *s) {
    size_t n = strlen(s);
    while (n && s[n - 1] <= 32)
        s[--n] = 0;
}
