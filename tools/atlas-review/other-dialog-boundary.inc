extern "C" {
int plat_fix_bugs = 0;
int plat_extras = 0;
}
int WndBase::nonclient_height() {
    return 0;
}
int WndBase::frame_width() {
    return 0;
}
void WndBase::get_screen_rect(iptr r) {
    *(RECT *)r = {0, 0, 1920, 1080};
}
void gfx_get_screen_rect(iptr r) {
    *(RECT *)r = {0, 0, 1920, 1080};
}
void DibSurface::wnd_blit_surface() {}
void DibSurface::draw_text_cur_font(const char *s, int x, int y, uint f) {
    draw_text((iptr)buttonFont, s, x, y, f);
}
void Dialog::reset_string_pool(uint) {}
void Dialog::close() {}
MemBlock *MemBlock::construct() {
    return this;
}
u8 memblock_init(MemBlock *, int, uint) {
    return 1;
}
int memblock_alloc(MemBlock *, uint n) {
    return (int)std::calloc(1, n);
}
char *_strchr(const char *s, int c) {
    return (char *)strchr(s, c);
}
int __strcmpi(const char *a, const char *b) {
    return _stricmp(a, b);
}
void gfx_draw_rect_frame(iptr s, RECT *r, int c) {
    gfx_draw_bevel_rect(s, r, c, c);
}
void gfx_copy_rect_same_pos(iptr, iptr, int, int, int, int) {
    throw std::runtime_error("Unbound dialog picture");
}
void SurfaceWindow::show() {}
void dialog_radio_on_select() {}
void dialog_radio_on_dblclick(int, int) {}
void dialog_on_button_click(int) {}
Button *button_ctor(Button *b) {
    return b;
}
int ctrl_dtor(Button *) {
    return 0;
}
Checkbox *checkbox_elem_ctor(Checkbox *b) {
    return b;
}
void checkbox_dtor(Checkbox *) {}
void crt_vector_ctor_iterator(void *base, uint stride, int count, void (*ctor)(void *),
                              void (*)(void *)) {
    for (int i = 0; i < count; i++)
        ctor((char *)base + i * stride);
}
Sprite *extras_icon(int) {
    throw std::runtime_error("Enhanced runtime option was not disabled");
}
int extras_rich_width(iptr, const char *) {
    throw std::runtime_error("Enhanced runtime option was not disabled");
}
GameFont *controlFont = nullptr;
struct RadioFixture {
    RECT r;
    int columns, count, selected = 0;
    std::vector<std::string> labels;
    GameFont *font;
};
std::map<RadioGroup *, RadioFixture> radios;
RadioGroup *RadioGroup::construct() {
    return this;
}
void RadioGroup::create(iptr, int, iptr r, u32 columns, u32 count, iptr labels) {
    auto &q = radios[this];
    q.r = *(RECT *)r;
    q.columns = columns;
    q.count = count;
    q.font = controlFont;
    for (int i = 0; i < (int)count; i++)
        q.labels.emplace_back(((char **)labels)[i]);
}
void RadioGroup::disable_item(int) {}
void RadioGroup::set_selected(u32 i) {
    radios.at(this).selected = i;
}
void RadioGroup::set_select_callback(RadioNotifyFn) {}
void RadioGroup::set_dblclick_callback(RadioNotifyFn) {}
void RadioGroup::show_all() {}
void Checkbox::create(iptr, int, int x, int y, const char *label) {
    auto f = controlFont;
    controls[(Control *)this] = {{"checkbox", label, x, y, fonts.at(f).text_width(label) + 37,
                                  fonts.at(f).font_cached_height()},
                                 true,
                                 f};
}
void Checkbox::set_checked(u32 c) {
    controls.at((Control *)this).draw.color = c ? 1 : 0;
}
void Checkbox::disable() {}
int Dialog::create_window() {
    dialog_state.active = this;
    if (surf_wnd)
        return 0;
    static SurfaceWindow surface{};
    surf_wnd = (iptr)&surface;
    width = wnd_width;
    height = wnd_height;
    surface.reset_clip();
    style_flags |= 0x20;
    return 1;
}
void Dialog::create_controls() {
    controlFont = (GameFont *)body_font;
    buttonFont = (GameFont *)&dialog_plain_font_obj_block.dialog_plain_font_obj;
    if (option_count && !(style_flags & 0x1000)) {
        if (style_flags & 4)
            create_checkboxes();
        else {
            std::vector<uint> labels;
            for (auto p = option_list; p; p = p->next)
                labels.push_back((uint)p->text);
            create_radio_group(labels.data());
        }
    }
    if (edit_count || sprite_count > 1)
        throw std::runtime_error("Unbound edit/sprite controls");
    if (option_count && (style_flags & 0x1000)) {
        cur_pane = 0;
        create_list_scrollbar(nullptr, nullptr);
    }
    create_buttons();
    for (auto &[p, c] : controls)
        c.visible = true;
}
void finishControls() {
    // These independent child controls occupy disjoint rectangles. Paint in
    // position order so heap/stack address randomization cannot reorder traces.
    std::vector<ReviewControl *> visible;
    for (auto &[ptr, c] : controls)
        if (c.visible)
            visible.push_back(&c);
    std::sort(visible.begin(), visible.end(), [](const auto *a, const auto *b) {
        if (a->draw.y != b->draw.y)
            return a->draw.y < b->draw.y;
        if (a->draw.x != b->draw.x)
            return a->draw.x < b->draw.x;
        return a->draw.op < b->draw.op;
    });
    for (auto *control : visible) {
        auto &c = *control;
        auto d = c.draw;
        emit(d.op, d.x, d.y, d.w, d.h, d.text, c.disabled ? 128 : d.color, nullptr, c.font);
        if (d.op == "scrollbar") {
            draws.back().face = d.face;
            draws.back().size = d.size;
            draws.back().style = d.style;
            draws.back().text = d.text;
        }
    }
    for (auto &[p, r] : radios) {
        int rows = (r.count + r.columns - 1) / r.columns,
            cellW = (r.r.right - r.r.left) / r.columns, cellH = (r.r.bottom - r.r.top) / rows;
        for (int i = 0; i < r.count; i++)
            emit("radio", r.r.left + (i / rows) * cellW, r.r.top + (i % rows) * cellH, cellW, cellH,
                 r.labels[i], i == r.selected ? 1 : 0, nullptr, r.font);
    }
}

int __strnicmp(const char *a, const char *b, size_t n) {
    return _strnicmp(a, b, n);
}
int _isdigit(int c) {
    return isdigit(c);
}
int _isalpha(int c) {
    return isalpha(c);
}
int _atoi(const char *s) {
    return atoi(s);
}
char *_strncpy(char *d, const char *s, size_t n) {
    return strncpy(d, s, n);
}
void extras_note_dialog(void *, const char *, const char *) {}
unsigned int crt_toupper(unsigned int c) {
    return toupper(c);
}
void *_memset(void *d, int c, size_t n) {
    return memset(d, c, n);
}
int _strncmp(const char *a, const char *b, size_t n) {
    return strncmp(a, b, n);
}
char *__ltoa(int n, char *d, int base) {
    return _itoa(n, d, base);
}
void extras_note_dialog(Dialog *, const char *, const char *) {}
