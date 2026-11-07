// SOURCE src/game/map_view_cache.cpp copy_pixels
// SOURCE src/game/map_view_cache.cpp cell_rect
// SOURCE src/game/map_view_cache.cpp valid_rect
// SOURCE src/game/map_view_cache.cpp crop
// SOURCE src/game/map_view_cache.cpp recenter
// SOURCE src/game/map_view_cache.cpp fill
// SOURCE src/game/map_view_cache.cpp map_view_cache_invalidate
#include <algorithm>
#include <cassert>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
using iptr=intptr_t;
struct RECT { int left,top,right,bottom; };
static int minimum(int a,int b) { return std::min(a,b); }
static int maximum(int a,int b) { return std::max(a,b); }
static int IntersectRect(RECT *r,const RECT *a,const RECT *b) {
    *r={maximum(a->left,b->left),maximum(a->top,b->top),minimum(a->right,b->right),minimum(a->bottom,b->bottom)};
    return r->left<r->right && r->top<r->bottom;
}
static void OffsetRect(RECT *r,int x,int y) { r->left+=x;r->right+=x;r->top+=y;r->bottom+=y; }
enum { CELL=128,MAX_CELLS=1024,SLOTS=3 };
static int wrap_delta(int x) { if(x>128)x-=256;if(x<-128)x+=256;return x; }
struct DibSurface {
    uintptr_t bits;int width,height;
    std::vector<unsigned char> pixels;
    void init(int w,int h) { width=w;height=h;pixels.resize(w*h);bits=(uintptr_t)pixels.data(); }
    intptr_t pixel_ptr(int x,int y) { assert(x>=0 && x<width && y>=0 && y<height);return bits+y*width+x; }
};
struct MapView: DibSurface {
    int client_width,client_height,center_x,center_y,origin_x,origin_y,margin_x=0,margin_y=0;
    int half_tile_width=16,half_tile_height=8;
    void update_layout() {
        origin_x=(center_x-client_width/(2*half_tile_width)+256)%256;
        origin_y=center_y-client_height/(2*half_tile_height);
    }
    void tile_radius_rect(int x,int y,int radius,iptr out) {
        int px=wrap_delta(x-origin_x-1)*half_tile_width,py=(y-origin_y-1)*half_tile_height;
        *(RECT *)out={px-(2*radius+1)*half_tile_width,py-(2*radius+1)*half_tile_height,
                     px+(2*radius+3)*half_tile_width,py+(2*radius+3)*half_tile_height};
    }
};
struct CachedView { MapView *view;int cols,rows,civ;unsigned used;unsigned char valid[MAX_CELLS]; };
static CachedView entries[SLOTS];
static MapView *painting,*owner;
static int busy;
static int map_camera_busy() { return busy; }
static int map_camera_owns(void *v) { return v==owner; }
static uint64_t clock_us;
static uint64_t host_time_us() { return clock_us; }
static void hd_copy(void *,void *,int,int,int,int,int,int) {}
static void hd_commit_rect(void *,int,int,int,int) {}
static void host_memory_move(void *dst,const void *src,uint32_t size) { memmove(dst,src,size); }
static int changed;
static unsigned char expected(MapView &v,int x,int y) {
    int wx=((v.origin_x+1)*16+x)%4096,wy=(v.origin_y+1)*8+y;
    return (unsigned char)((wx*17+wy*31+(changed && wx>=2000 && wx<2016 && wy>=800 && wy<808 ? 71:0))%251);
}
static void paint_rect(CachedView &e,RECT r) {
    for(int y=r.top;y<r.bottom;y++)for(int x=r.left;x<r.right;x++)
        e.view->pixels[y*e.view->width+x]=expected(*e.view,x,y);
    clock_us+=1000;
}
#include "production.inc"
int main()
{
    MapView view,cache;owner=&view;
    view.client_width=420;view.client_height=300;view.center_x=128;view.center_y=100;view.update_layout();
    cache.client_width=676;cache.client_height=556;cache.init(676,556);
    cache.center_x=128;cache.center_y=100;cache.update_layout();
    CachedView &e=entries[0];e.view=&cache;e.cols=6;e.rows=5;
    RECT all={0,0,676,556};
    assert(fill(e,all,2000)==2); // Stop after the budget, leaving work pending.
    fill(e,all,0);
    unsigned seed=73;
    for(int n=0;n<1000;n++) {
        seed=1664525*seed+1013904223;
        view.center_x=(view.center_x+((seed>>24)%13)-6+256)%256;
        view.center_y+=((seed>>16)%9)-4;
        view.update_layout();recenter(e,&view);
        if(n%7==0) { changed=!changed;map_view_cache_invalidate(&view,125,100,0); }
        RECT r;crop(&view,&cache,r);
        assert(r.left>=0 && r.top>=0 && r.right<=cache.width && r.bottom<=cache.height);
        fill(e,r,0);
        for(int y=r.top;y<r.bottom;y++)for(int x=r.left;x<r.right;x++)
            assert(cache.pixels[y*cache.width+x]==expected(cache,x,y));
        if(n%11==0)fill(e,all,clock_us+2000);
    }
    fill(e,all,0);busy=1;map_view_cache_invalidate(&view,0,0,-1);assert(valid_rect(e,all));
    busy=0;map_view_cache_invalidate(&view,0,0,-1);assert(!valid_rect(e,all));
    puts("Viewport cache: 1,000 scrolls match fresh pixels, including wrap, dirty regions and budgeted fills.");
}
