// SOURCE src/platform/text.c text_camera_labels
#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>
#include "map_camera.h"
enum { MINH=6,MAXH=48 };
struct RECT { int left,top,right,bottom; };
struct Bitmap { int w,h,hd_gpu;uint32_t *hd; };
struct AaGlyph { int x,y,w,h; };
struct Glyph { int dadv; };
struct FontFace { int tm[11];Glyph g[256];AaGlyph *aa; };
static FontFace *faces[4][MAXH+1][2][2];
static FontFace font;
static AaGlyph glyphs[256];
static unsigned char coverage[15],palette[768];
static int hd_density,font_data=1,aa_data=1,fallback,reads,uploads;
struct Draw { int x,y,w,h,l,t,r,b;uint32_t color; };
static std::vector<Draw> draws;
static void load_fonts() { assert(false); }
static void load_aa() { assert(false); }
static const unsigned char *hd_palette() { return palette; }
static const unsigned char *aa_coverage(AaGlyph *) { return coverage; }
static int text_width(FontFace *,const char *,int n) { return n*4; }
static void hd_gpu_text_begin() {}
static void hd_gpu_text_end() {}
static int hd_gpu_text(Bitmap *,const unsigned char *,int sw,int sh,int x,int y,int w,int h,
                       int l,int t,int r,int b,uint32_t color) {
    // At small display sizes use the hinted glyphs directly, without resizing.
    assert(sw==w && sh==h && w==3 && h==5);
    draws.push_back({x,y,w,h,l,t,r,b,color});return !fallback;
}
static unsigned aa_blend(unsigned dst,unsigned text,int aa) { return aa==16 ? text : dst; }
static void hd_read_region(Bitmap *,int,int,int,int) { reads++; }
static void hd_upload_region(Bitmap *,int,int,int,int) { uploads++; }
#include "production.inc"
int main()
{
    memset(coverage,16,sizeof coverage);palette[3]=200;palette[4]=150;palette[5]=100;
    font.aa=glyphs;font.tm[0]=6;
    for(int c=0;c<256;c++) { font.g[c].dadv=4;glyphs[c]={0,0,3,5}; }
    for(int h=MINH;h<=MAXH;h++)faces[0][h][0][0]=&font;
    MapCameraLabel label={40,30,1,"AB"};RECT clip={49,28,54,36};
    for(hd_density=1;hd_density<=4;hd_density++) {
        std::vector<uint32_t> pixels(64*48*hd_density*hd_density,0xff111111);
        Bitmap dst={64,48,1,pixels.data()};draws.clear();fallback=0;
        text_camera_labels(&dst,&label,1,6,10,0,&clip);
        assert(!draws.empty());int old_x=draws.back().x;
        label.x+=1.0/hd_density;draws.clear();
        text_camera_labels(&dst,&label,1,6,10,0,&clip);
        assert(draws.back().x==old_x+1); // One physical pixel, even at density 4.
        for(auto &v:draws)assert(v.l>=clip.left*hd_density && v.t>=clip.top*hd_density &&
                                v.r<=clip.right*hd_density && v.b<=clip.bottom*hd_density);
        fallback=1;reads=uploads=0;
        text_camera_labels(&dst,&label,1,6,10,0,&clip);
        assert(reads>0 && reads==uploads);
        bool colored=false;
        for(int y=0;y<48*hd_density;y++)for(int x=0;x<64*hd_density;x++) {
            auto p=pixels[y*64*hd_density+x];if(p==0xffc89664)colored=true;
            if(x<clip.left*hd_density || x>=clip.right*hd_density || y<clip.top*hd_density || y>=clip.bottom*hd_density)
                assert(p==0xff111111);
        }
        assert(colored);label.x=40;
    }
    puts("Camera text: native glyph sampling, physical-pixel placement, clipping and fallback at densities 1-4 passed.");
}
