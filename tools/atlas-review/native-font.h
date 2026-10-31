// Metrics from the same reference font bank used by src/platform/text.c.
// Generated at extraction time; no dependency on the host SVG/font resolver.
#pragma once
#include "font-metrics.inc"
bool enhancedBoundary = false;
int legacyScaleNum = 1, legacyScaleDen = 1;

struct GameFont {
    int face = 0, height = 11, style = 0;

    void init(int f, int h) {
        set(f, h);
    }

    void destroy() {}

    void set(int f, int h) {
        face = f;
        height = std::clamp(h, 6, 48);
        style = 0;
    }

    void set_styled(int f, int h, int s) {
        set(f, h);
        style = s;
    }

    const ReviewFontMetrics& metrics() const {
        for (const auto& f : reviewFonts)
            if (f.face == face && f.height == height && f.style == style)
                return f;
        throw std::runtime_error("Missing native font metrics");
    }

    int text_width(const char* text) {
        if (enhancedBoundary)
            return int(std::strlen(text)) * std::max(3, 6 * legacyScaleNum / legacyScaleDen);
        int result = 0;
        for (auto p = (const unsigned char*)text; *p; ++p)
            result += metrics().advance[*p];
        return result;
    }

    int font_cached_height() {
        return enhancedBoundary ? std::max(5, 10 * legacyScaleNum / legacyScaleDen) : metrics().cellHeight;
    }
};
