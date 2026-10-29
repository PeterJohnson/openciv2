// SOURCE src/auto/network.cpp net_received_message_valid
// SOURCE src/auto/network.cpp net_on_broadcast_receive
// SOURCE src/auto/network.cpp net_on_secure_receive
#include <cassert>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include "native.h"
#include "win32_types.h"
#include "civ2types.h"
typedef unsigned int uint;
typedef unsigned short ushort;
typedef unsigned char byte;
#include "civ2classes.h"
#include "enums.h"
static_assert(sizeof(void *) == 4, "run with a 32-bit compiler");
static_assert(sizeof(NetMsg) == 44 && sizeof(NetNamedMsg) == 116 && sizeof(NetServerInfoMsg) == 408,
              "wire layouts");
static int enqueued;
static std::vector<unsigned char> queued;
i32 NetMsgQueue::enqueue(int, NetMsg *msg, uint size) {
    enqueued++;
    queued.assign((unsigned char *)msg, (unsigned char *)msg + size);
    return 1;
}
static struct {
    NetMsgQueue msg_queue;
    int nm_recv_counts_by_type[169];
    uint last_recv_callback_size, last_queued_send_seq, last_recv_msg_size;
    int msgq_normal_count, msgq_priority_count;
} net;
static struct {
    char net_ip_address[32];
} menu_prefs;
static struct {
    char active;
} mp_drag;
static int net_last_recv_msg_type = -1, net_send_sequence = 7;
static void mp_release_mouse_capture() {}
#define LOG_TEXT(name) static char name[] = #name
LOG_TEXT(str_broadcastreceivefunc_killed_message_tiny);
LOG_TEXT(str_broadcastreceivefunc_killed_message_not);
LOG_TEXT(str_securereceivefunc_killed_message_not_civ);
LOG_TEXT(str_last_callback_size_s);
LOG_TEXT(str_last_legal_sequence_number_s);
LOG_TEXT(str_last_legal_type_s);
LOG_TEXT(str_last_legal_netmsg_size_s);
LOG_TEXT(str_sequence_number_s);
LOG_TEXT(str_message_size_s);
LOG_TEXT(str_s_3);
LOG_TEXT(str_empty_184);
LOG_TEXT(str_potential_offset_message_found);
LOG_TEXT(str_offset_s_bytes);
LOG_TEXT(str_type_s);
LOG_TEXT(str_size_s_bytes);
LOG_TEXT(str_sequence_number_s_2);
static char str_nm_datagram[5408], net_hexdump_space_str[] = " ";
static std::string diagnostic_type;
static void dbg_log(const char *) {}
static void dbg_logf_str(const char *label, const char *text) {
    if (label == str_type_s)
        diagnostic_type = text;
}
static char *__itoa(int n, char *out, int radix) {
    if (radix == 16)
        sprintf(out, "%x", (unsigned)n);
    else
        sprintf(out, "%d", n);
    return out;
}
static char *__ultoa(unsigned long n, char *out, int) {
    sprintf(out, "%lu", n);
    return out;
}
#define _strlen strlen
#define _strcmp strcmp
#define crt_strcat strcat
static const unsigned char *packet;
static size_t captured, backing;
static void check_read(const void *p, size_t n) {
    uintptr_t off = (uintptr_t)p - (uintptr_t)packet;
    if (off <= backing)
        assert(off <= captured && n <= captured - off);
}
static void *checked_copy(void *dst, const void *src, size_t n) {
    check_read(src, n);
    return memcpy(dst, src, n);
}
static const void *checked_find(const void *p, int c, size_t n) {
    check_read(p, n);
    return memchr(p, c, n);
}
#define memcpy checked_copy
#define memchr checked_find
#include "production.inc"
#undef memcpy
#undef memchr
static void put(std::vector<unsigned char> &p, size_t off, int value) {
    memcpy(p.data() + off, &value, 4);
}
static std::vector<unsigned char> message(size_t n, int type) {
    std::vector<unsigned char> p(n);
    put(p, 0, 0x66606660);
    put(p, 4, type);
    put(p, 8, (int)n);
    return p;
}
static int valid(const std::vector<unsigned char> &p, size_t size) {
    packet = p.data();
    captured = size;
    backing = p.size();
    return net_received_message_valid(packet, (uint)size);
}
static void secure(std::vector<unsigned char> &p, size_t size, int expected) {
    packet = p.data();
    captured = size;
    backing = p.size();
    enqueued = 0;
    queued.clear();
    net_on_secure_receive(3, p.data(), (uint)size, 0);
    assert(enqueued == expected);
    if (expected)
        assert(queued == std::vector<unsigned char>(p.begin(), p.begin() + size));
}
static void broadcast(std::vector<unsigned char> &p, size_t size, int expected) {
    packet = p.data();
    captured = size;
    backing = p.size();
    enqueued = 0;
    net_on_broadcast_receive(p.data(), (ushort)size, 0);
    assert(enqueued == expected);
}
int main() {
    std::vector<unsigned char> p = message(16, NM_HEART_BEAT);
    for (int n = 0; n < 16; n++) {
        assert(!valid(p, n));
        secure(p, n, 0);
        broadcast(p, n, 0);
    }
    secure(p, 16, 1);
    assert(net.last_recv_callback_size == 16 && net_last_recv_msg_type == NM_HEART_BEAT);
    assert(!net_received_message_valid(nullptr, 16));
    net_on_secure_receive(0, nullptr, 16, 0);
    for (int type : {-1, 169, 0x7fffffff}) {
        put(p, 4, type);
        secure(p, 16, 0);
        broadcast(p, 16, 0);
    }
    p = message(116, NM_DATAGRAM);
    put(p, 112, NM_GET_SERVERS);
    strcpy(menu_prefs.net_ip_address, "local");
    for (int n = 16; n < 116; n++) {
        assert(!valid(p, n));
        broadcast(p, n, 0);
    }
    broadcast(p, 116, 1);
    strcpy((char *)p.data() + 48, "local");
    broadcast(p, 116, 1);
    strcpy((char *)p.data() + 80, "local");
    broadcast(p, 116, 0); // self announcement
    p[80] = 0;
    strcpy((char *)p.data() + 48, "other");
    broadcast(p, 116, 0); // wrong target
    for (int offset : {16, 48, 80}) {
        p = message(116, NM_DATAGRAM);
        put(p, 112, NM_GET_SERVERS);
        memset(p.data() + offset, 'x', 32);
        secure(p, 116, 0);
        broadcast(p, 116, 0);
    }
    p = message(408, NM_DATAGRAM);
    put(p, 112, NM_SERVER_INFO);
    for (int n = 116; n < 408; n++)
        assert(!valid(p, n));
    secure(p, 408, 1);
    broadcast(p, 408, 1);
    for (auto field : {std::pair<int, int>{0, 32}, {48, 64}, {112, 32}, {144, 32}, {188, 80}}) {
        p = message(408, NM_DATAGRAM);
        put(p, 112, NM_SERVER_INFO);
        memset(p.data() + 116 + field.first, 'x', field.second);
        assert(!valid(p, 408));
    }
    p = message(116, NM_DATAGRAM);
    put(p, 112, -1);
    assert(!valid(p, 116));
    put(p, 112, 169);
    assert(!valid(p, 116));
    p = message(44 + 6, NM_CHAT);
    put(p, 16, 1);
    put(p, 20, 7);
    memcpy(p.data() + 44, "hello", 6);
    secure(p, p.size(), 1);
    broadcast(p, p.size(), 1);
    for (int n = 16; n <= 44; n++)
        assert(!valid(p, n));
    p.back() = 'x';
    secure(p, p.size(), 0);
    p = message(44 + 257, NM_CHAT);
    memset(p.data() + 44, 'x', 256);
    secure(p, p.size(), 1);
    p.push_back(0);
    secure(p, p.size(), 0);
    p = message(45, NM_CHAT);
    secure(p, p.size(), 1); // empty, terminated chat
    for (int offset : {16, 20})
        for (int civ : {-1, 8}) {
            p = message(45, NM_CHAT);
            put(p, offset, civ);
            secure(p, p.size(), 0);
        }
    // Invalid-magic diagnostics: a full header at an unaligned offset may be logged.
    strcpy(str_nm_datagram + 32, "HELLO");
    p.assign(48, 0);
    put(p, 1, 0x66606660);
    put(p, 5, 1);
    put(p, 9, 16);
    diagnostic_type.clear();
    secure(p, 17, 0);
    assert(diagnostic_type == "HELLO");
    diagnostic_type.clear();
    secure(p, 16, 0);
    assert(diagnostic_type.empty());
    put(p, 5, 0x7fffffff);
    secure(p, 17, 0);
    assert(diagnostic_type == "2147483647");
    puts("network: captured headers, discovery fields/filtering, chat bounds and diagnostic scans "
         "passed");
}
