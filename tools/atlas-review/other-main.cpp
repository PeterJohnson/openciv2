// Review-only entry point. Uses the game's original class layouts.
#include <algorithm>
#include <cstdarg>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
#define __attribute__(x)
#define __builtin_trap() throw std::runtime_error("Unreachable source path")
#include "native.h"
#define CIV2_GAMEDATA_DEFINE
#include "auto_common.h"
#undef bool
#undef true
#undef false
#undef long
static_assert(sizeof(void *) == 4, "Review extraction requires MSVC x86");
#include "other-boundary.inc"
#include "other-data.inc"
#include "other-dialog-boundary.inc"
#include "other-report-boundary.inc"
#define long int
#include "other-bodies.inc"
#undef long
#include "other-fixture.inc"
int main(int argc, char **argv) {
    try {
        setup();
        std::string id = argc > 1 ? argv[1] : "pedia-advance";
        if (id.rfind("pedia-", 0) == 0)
            renderPedia(id);
        else
            renderOther(id);
        dump();
        return 0;
    } catch (const FrameComplete &) {
        dump();
        return 0;
    } catch (const std::exception &e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
