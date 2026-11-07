// SOURCE src/game/map_camera.cpp map_camera_labels
#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstring>
#include "map_camera.h"
using iptr=intptr_t;
static int active=1,map_show_hidden_terrain,human_civ[]={1};
static int enabled() { return active; }
static double clamp(double v,double lo,double hi) { return v<lo ? lo : v>hi ? hi : v; }
static struct { int num_cities=5,reveal_map; } game;
struct City { int id,x,y,owner,known_to;int revealed_size[8];char name[32]; };
static City cities[5];
static int tile_visible_to(int x,int,int) { return x!=3; }
static int civ_color_secondary(int owner) { return owner+10; }
struct MapView {
    int client_x=8,client_y=36,half_tile_width=8,tile_height=8;
    int tile_in_view(int,int y) { return y!=99; }
    void tile_to_screen(iptr x,iptr y,int tx,int ty) {
        *(int *)x=client_x+tx*8;*(int *)y=client_y+ty*4;
    }
};
static struct { MapView *view;MapCameraTransform transform;double scale; } camera;
#include "production.inc"
int main()
{
    MapView view;camera.view=&view;camera.scale=.375;
    camera.transform={1.5,-4.25,-2.75,8,36,320,200};
    for(int i=0;i<5;i++) {
        cities[i].id=1;cities[i].x=i;cities[i].y=2;cities[i].owner=i ? 2 : 1;
        cities[i].known_to=2;cities[i].revealed_size[1]=3;
        snprintf(cities[i].name,32,"City %d",i);
    }
    cities[1].known_to=0;cities[2].revealed_size[1]=0;cities[4].y=99;
    MapCameraLabel labels[6]={};double height=0;
    assert(map_camera_labels(labels,5,&height)==1);
    assert(fabs(height-7.2)<1e-9 && labels[0].color==11);
    assert(labels[0].x==7.75 && labels[0].y==18.25);
    assert(!strcmp(labels[0].text,"City 0"));
    game.reveal_map=1;assert(map_camera_labels(labels,5,&height)==4);
    labels[1].color=99;assert(map_camera_labels(labels,1,&height)==1 && labels[1].color==99);
    camera.scale=.125;map_camera_labels(labels,5,&height);assert(height==6);
    camera.scale=2;map_camera_labels(labels,5,&height);assert(fabs(height-38.4)<1e-9);
    map_show_hidden_terrain=1;assert(!map_camera_labels(labels,5,&height));
    map_show_hidden_terrain=0;active=0;assert(!map_camera_labels(labels,5,&height));
    puts("Camera labels: display-space placement, minimum size, visibility and capacity passed.");
}
