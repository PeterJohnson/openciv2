void bind(Sprite *p, std::string key, int w, int h) {
    sprites[p] = {key, w, h};
}
void copyRaw(const char *key, void *dest, size_t capacity) {
    auto &h = rawInputs.at(key);
    if (h.size() / 2 > capacity)
        throw std::runtime_error(std::string(key) + " fixture " + std::to_string(h.size() / 2) +
                                 " exceeds " + std::to_string(capacity));
    auto d = (unsigned char *)dest;
    for (size_t i = 0; i < h.size(); i += 2)
        d[i / 2] = (unsigned char)std::stoi(h.substr(i, 2), nullptr, 16);
}
void setup() {

    memcpy(&year_table_start_years_block, year_table_start_years_block_init,
           sizeof(year_table_start_years_block_init) - 1);
    static i32 reviewLabels[2048];
    label_table.string_ids = reviewLabels;
#include "inputs.inc"
    copyRaw("power_history", &power_graph_history_block.power_graph_history, 1200);
    copyRaw("game", &game, sizeof(game));
    copyRaw("civs", civs, sizeof(civs));
    copyRaw("cities", cities, sizeof(cities));
    copyRaw("units", units, sizeof(power_graph_history_block.units));
    human_civ[0] = 6;
    copyRaw("map_header", &map, sizeof(map));
    fixtureTiles.resize(map.area);
    copyRaw("tiles", fixtureTiles.data(), fixtureTiles.size() * sizeof(Tile));
    knownTiles.resize(map.area);
    copyRaw("known6", knownTiles.data(), knownTiles.size());
    strcpy((char *)&main_frame_wnd_block.game_txt_path, "GAME");
    ui_metrics.border_width = 8;
    ui_metrics.caption_height = 36;
    ui_metrics.bevel_width = 2;
    ui_metrics.padding = 2;
    ui_metrics.highlight_color = 37;
    ui_metrics.shadow_color = 18;
    ui_metrics.large_screen = 1;
    ui_metrics.border_tile = (iptr)&window_border_tile_surface;
    ((GameFont *)&caption_font_block.caption_font)->set(0, 24);
    ((GameFont *)&caption_small_font_block.caption_small_font)->set(0, 16);
    ((GameFont *)&ui_text_font)->set(0, 24);
    ((GameFont *)&advisor_button_font_block.advisor_button_font)->set(0, 16);
    ((GameFont *)&advisor_font_block.advisor_font)->set(0, 18);
    ((GameFont *)&advisor_bold_font)->set_styled(0, 18, 1);
    ((GameFont *)&credits_font_block.credits_font)->set_styled(0, 24, 1);
    caption_font_block.screen_width = 1920;
    caption_font_block.screen_height = 1080;

    for (int i = 0; i < 4; i++)
        bind((Sprite *)&city_down_arrow_sprite_block.research_flask_sprites + i,
             "flask/" + std::to_string(i), 14, 14);
    for (int i = 0; i < game.num_cities; i++)
        if (strcmp(cities[i].name, "London") == 0)
            fixtureCity = i;

    std::strcpy((char *)&game_dirs.home, "home");
    std::strcpy((char *)&net_map_lock_slots_block.scenario_dir_path, "midgame1");
    fonts[(GameFont *)&font_size21].set(0, 21);
    fonts[(GameFont *)&font_size24].set(0, 24);
    fonts[(GameFont *)&font_size24_bold].set_styled(0, 24, 1);
    fonts[(GameFont *)&font_size30].set(0, 30);
    fonts[(GameFont *)&dialog_plain_font_obj_block.dialog_plain_font_obj].set(0, 16);
    buttonFont = (GameFont *)&dialog_plain_font_obj_block.dialog_plain_font_obj;
    dialog_set_colors(0x10, 0x21, 0x25, 0x1a, 0x1d, 0x25, 0x12, 0x1a, 10);
    dialog_set_list_colors(0x23, 10, 10, 0x17, 0x29, 10, 0x12);
    dlg_style.client_tile_surface = (iptr)&panel_texture_surface;
    dlg_style.frame_tile_surface = (iptr)&window_border_tile_surface;
    for (int i = 0; i < 20; i++)
        bind((Sprite *)&government_sprites_block.advance_category_icon_sprites + i,
             "advance/" + std::to_string(i), 36, 20);
    for (int i = 0; i < 67; i++)
        bind((Sprite *)&caption_close_button_sprite_block.improvement_icon_sprites + i,
             "improvement/" + std::to_string(i), 36, 20);
    for (int i = 0; i < 62; i++)
        bind((Sprite *)&pollution_sprite_block.unit_sprites + i, "unit/" + std::to_string(i), 64,
             48);
    for (int i = 0; i < 11; i++)
        bind((Sprite *)&terrain_base_sprites_block.terrain_base_sprites + i,
             "terrain/" + std::to_string(i), 64, 32);
    for (int i = 0; i < 22; i++)
        bind((Sprite *)&city_down_arrow_sprite_block.terrain_resource_sprites + i,
             "resource/" + std::to_string(i), 64, 32);
    bind((Sprite *)&forest_sprites, "feature/forest/0", 64, 32);
    bind((Sprite *)&mountain_sprites, "feature/mountains/0", 64, 32);
    bind(&hill_sprites_block.hill_sprites[0], "feature/hills/0", 64, 32);
    bind((Sprite *)&popup_info_icon_sprite, "popup-info", 64, 64);
    bind((Sprite *)&caption_close_button_sprite_block.caption_close_button_sprite, "caption-close",
         16, 16);
    bind(&war_icon_sprite_block.shield_icon_sprite, "economy/production", 14, 14);
    bind(&war_icon_sprite_block.trade_icon_sprite, "economy/trade", 14, 14);
    bind((Sprite *)&war_icon_sprite_block.resource_icon_sprites, "economy/food", 14, 14);
    bind(&tax_rate_icon_sprites_block.gold_coin_icon_sprite, "economy/gold", 14, 14);
    bind((Sprite *)&grassland_shield_sprite, "terrain/grassland-shield", 64, 32);
    dlg_style.default_text_font = (i8 *)&dialog_text_font_obj_block.dialog_text_font_obj;
    *(iptr *)(dlg_style.default_text_font_rest) =
        (iptr)&dialog_title_font_obj_block.dialog_title_font_obj;
    *(iptr *)(dlg_style.default_text_font_rest + 4) = (iptr)&dialog_list_font_obj;
    *(iptr *)(dlg_style.default_text_font_rest + 8) =
        (iptr)&dialog_plain_font_obj_block.dialog_plain_font_obj;
    ((GameFont *)dlg_style.default_text_font)->set(0, 24);
    ((GameFont *)&dialog_title_font_obj_block.dialog_title_font_obj)->set(0, 24);
    ((GameFont *)&dialog_list_font_obj)->set(0, 20);
    dlg_style.button_labels[0] = (i8 *)&str_ok_2;
    dlg_style.button_labels[1] = (i8 *)((u8 *)&str_ok_2 + 4);
    dlg_style.button_labels[2] = (i8 *)&str_cancel_2;
    dlg_style.scale_num = 3;
    dlg_style.scale_den = 2;
}
void renderPedia(std::string id) {

    auto p = (PediaWindow *)&pedia_wnd.window;
    p->create();
    int *ids = p->pedia_advance_ids;
    int count = p->pedia_advance_count, target = ADV_RAILROAD;
    p->category = 1;
    p->border_width = 1;
    if (id == "pedia-unit") {
        p->category = 4;
        ids = p->pedia_unit_ids;
        count = 62;
        target = UNIT_RIFLEMEN;
    } else if (id == "pedia-improvement") {
        p->category = 2;
        ids = p->pedia_improve_ids;
        count = 38;
        target = 6;
    } else if (id == "pedia-wonder") {
        p->category = 3;
        ids = p->pedia_wonder_ids;
        count = 28;
        target = 39;
    } else if (id == "pedia-terrain") {
        p->category = 5;
        ids = p->pedia_terrain_ids;
        count = 33;
        target = 3;
    }
    p->resize_border = std::find(ids, ids + count, target) - ids;
    const char *title = label_string(p->category == 1   ? advances[target].name
                                     : p->category == 4 ? unit_types[target].name
                                     : p->category == 5 ? terrain_types[target].name
                                                        : improvements[target].name);
    if (id == "pedia-advances") {
        p->border_width = 0;
        title = "Civilization Advances";
        p->list_count = count;
        p->list_top_index = 0;
        for (int i = 0; i < count; i++)
            p->list_items[i] = ids[i];
        pedia_wnd.selected_item = 0;
    }
    if (id == "pedia-tree") {
        p->border_width = 2;
        p->category = 8;
        title = "Civilization Advances";
    }
    std::strcpy((char *)p->pedia_title_text_2, title);
    p->update_controls();
    p->draw_frame();
    if (id == "pedia-advances")
        p->draw_item_list();
    else if (id == "pedia-advance")
        p->draw_advance_page();
    else if (id == "pedia-tree")
        p->draw_advance_tree();
    else if (id == "pedia-unit")
        p->draw_unit_page();
    else if (id == "pedia-improvement")
        p->draw_improvement_page();
    else if (id == "pedia-wonder")
        p->draw_improvement();
    else if (id == "pedia-terrain")
        p->draw_terrain_page();
    else
        throw std::runtime_error("Unknown scene");
    finishControls();
}
std::string quoted(const std::string &s) {
    std::ostringstream o;
    o << '"';
    for (unsigned char c : s) {
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
void dump() {
    std::cout << "{\"width\":" << width << ",\"height\":" << height << ",\"commands\":[";
    bool first = true;
    for (auto &d : draws) {
        if (!first)
            std::cout << ',';
        first = false;
        std::cout << "{\"op\":" << quoted(d.op) << ",\"text\":" << quoted(d.text)
                  << ",\"x\":" << d.x << ",\"y\":" << d.y << ",\"width\":" << d.w
                  << ",\"height\":" << d.h << ",\"color\":" << d.color << ",\"face\":" << d.face
                  << ",\"fontHeight\":" << d.size << ",\"style\":" << d.style << ",\"clip\":["
                  << d.clip.left << ',' << d.clip.top << ',' << d.clip.right << ',' << d.clip.bottom
                  << "]}";
    }
    std::cout << "]}\n";
}

void renderDialog(std::string id) {
    Dialog d{};
    d.construct(0x4000);
    if (id == "dialog-setup") {
        d.load_game_section("MAINMENU", 1);
    } else if (id == "dialog-confirmation") {
        d.load_text("GAME", "REALLYQUIT", 0);
        d.add_sprite((iptr)&popup_info_icon_sprite, 0, 0);
    } else if (id == "dialog-information") {
        text_set_string_arg(0, "London");
        text_set_string_arg(1, "Library");
        text_set_string_arg(3, "builds");
        d.load_text("GAME", "BUILT", 0);
    } else if (id == "dialog-options") {
        int bits[] = {OPT_SOUND,
                      OPT_MUSIC,
                      OPT_ALWAYS_WAIT,
                      OPT_AUTOSAVE,
                      OPT_SHOW_ENEMY_MOVES,
                      OPT_NO_PAUSE_ENEMY,
                      OPT_FAST_PIECE_SLIDE,
                      OPT_INSTANT_ADVICE,
                      OPT_TUTORIAL,
                      OPT_MOVE_WITH_MOUSE,
                      OPT_ENTER_CLOSES_CITY};
        dlg_checks_clear();
        for (int i = 0; i < 11; i++)
            dlg_check_set_bool(i, game.game_options & bits[i]);
        text_set_string_arg(0, "5.4.0f Multiplayer 26-March-99 Patch 3");
        d.load_text("GAME", "GAMEOPTIONS", 1);
        for (auto p = d.option_list; p; p = p->next)
            if (dlg_check_get(p->id))
                p->flags |= 4;
    } else if (id == "dialog-production") {
        city_calc.shield_rows = 10;
        city_calc.total_shields = cities[fixtureCity].total_shields;
        city_calc.shield_support = 0;
        text_set_string_arg(0, cities[fixtureCity].name);
        d.load_game_text("PRODUCTION");
        d.set_option_draw_fn((DialogOptionDrawFn)city_change_draw_option_icon);
        d.set_list_indent(75, 0);
        int count = 0;
        city_button_change_add_options(6, count, cities[fixtureCity].building, d);
        if (count < 16)
            d.set_list_rows(std::max(8, count + 1));
    } else if (id == "dialog-research") {
        civ_choose_research_dialog(6, 1);
        return;
    } else
        throw std::runtime_error("Unknown dialog");
    d.render();
    finishControls();
}

void renderOther(std::string id) {
    if (id.rfind("dialog-", 0) == 0) {
        renderDialog(id);
        return;
    }
    if (id == "historian") {
        historian_report_show();
        return;
    }
    if (id == "foreign-minister") {
        foreign_minister_show(6);
        return;
    }
    if (id == "powergraph") {
        powergraph_show();
        return;
    }
    if (id == "tax-rates") {
        TaxRateDialog d{};
        controlFont = (GameFont *)&ui_text_font;
        d.run(6);
        return;
    }
    if (id == "world-map") {
        auto p = (FrameWindow *)&minimap_state.window;
        p->create("World", 6, 0, 0, 256, 168, 0, 0, 0);
        turn_loop.active = 1;
        minimap_hidden = 0;
        map_views_block.mapview_layout_width = map.width;
        map_views_block.mapview_layout_height = map.height;
        map_views_block.map_view_center_x[0] = 13;
        map_views_block.mapview_center_y[0] = 105;
        map_views_block.mapview_origin_x[0] = 144;
        map_views_block.mapview_origin_y[0] = 59;
        map_views_block.mapview_end_x = 196;
        map_views_block.mapview_end_y = 123;
        minimap_redraw();
        return;
    }
    if (id == "status-panel") {
        auto p = (FrameWindow *)&status_wnd.window;
        p->create("Status", 6, 0, 0, 256, 900, 0, 0, 0);
        turn_loop.active = 1;
        player_turn_active = 1;
        moving_units_mode = 1;
        status_bar.wnd_hidden = 0;
        status_wnd_repaint();
        return;
    }
    if (id == "high-council") {
        CouncilWindow p{};
        p.council_civ = 6;
        p.wnd_create_with_surface("", 0, 0, 0, ui_metrics.border_width * 6 + 450,
                                  ui_metrics.caption_height * 2 + ui_metrics.bevel_width + 252, 0,
                                  0);
        p.draw_background();
        p.create_buttons();
        for (auto &[ptr, c] : controls)
            c.visible = true;
        finishControls();
        return;
    }
    if (id == "casualty-timeline" || id == "credits") {
        auto p = id == "credits" ? (PictureWindow *)&advisor_state.window
                                 : (PictureWindow *)&casualty.window;
        p->open(id == "credits" ? 10000 : 2, id == "credits" ? 8 : 12, id == "credits" ? 1 : 0, 600,
                400, 0, 0);
        p->advisor_add_close_button();
        p->image_width = 600;
        p->image_height = 400;
        surfaceAssets[&p->surface] = id == "credits" ? "credits" : "51";
        if (id == "credits") {
            text_open_section("CREDITS", "CREDITS");
            for (char *l = text_read_line(1); l && l[0] != '@'; l = text_read_line(1))
                creditLines.push_back(l);
            credits.line_count = creditLines.size();
            credits.scroll_pos = 0;
            for (int i = 0; i < 30; i++)
                credits_font_block.credits_slot_lines[i] = -1;
            credits_draw_scroll(1);
            for (auto &[ptr, c] : controls)
                c.visible = true;
            finishControls();
        } else {
            casualty.civ = 6;
            casualty.vscroll_width = 17;
            casualty_timeline_draw();
            for (auto &[ptr, c] : controls)
                c.visible = true;
            finishControls();
        }
        return;
    }
    if (id == "destroyed-civilizations") {
        DestroyedCivsWindow p{};
        width = 640;
        height = 480;
        auto target = (DibSurface *)&p.media_wnd;
        surfaceSizes[target] = {0, 0, 640, 480};
        target->reset_clip();
        surfaceAssets[(DibSurface *)p.civs_art_surface] = "10000";
        surfaceAssets[(DibSurface *)&destroyed_civs_text_bg] = "10000";
        auto back = (DibSurface *)((u8 *)&p + 0x600);
        back->create(640, 480);
        surfaceAssets[back] = "10000";
        rect_set((iptr)&p.panel_clip_rect, 208, 57, 433, 332);
        RECT all{0, 0, 640, 480};
        ((DibSurface *)p.civs_art_surface)->blit(target, &all, &all);
        rect_set((iptr)&p.slot_sprites, 193, 371, 448, 461);
        ((GameFont *)((u8 *)&p + 0x700))->set(0, 24);
        strcpy((char *)&destroyed_civs.names, "The Romans");
        destroyed_civs.turns[0] = 320;
        destroyed_civs.portraits[0] = 0;
        destroyed_civs_show_date = 1;
        p.draw_entry(0);
        p.draw_portrait(0);
        return;
    }
    throw std::runtime_error("Unknown scene " + id);
}
