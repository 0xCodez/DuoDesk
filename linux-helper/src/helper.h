// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// macshare-linuxhelper: shared declarations. JSON lines on stdin/stdout, the same commands and
// events as windows-helper.
#ifndef MACSHARE_HELPER_H
#define MACSHARE_HELPER_H

#include <stddef.h>
#include <X11/Xlib.h>

// Two X connections: one for capture (raw events, grabs), one for injection and
// queries, so injection never waits behind event reading.
extern Display *dpy_ev, *dpy_in;
extern Window root_ev, root_in;

// ---- json.c: our flat messages (one nested object: "ev") ----
enum { J_NULL, J_BOOL, J_NUM, J_STR, J_OBJ, J_OTHER };
typedef struct JObj JObj;
typedef struct { int type; double num; char *str; JObj *obj; } JVal;
#define J_MAX 32
struct JObj { int n; char *keys[J_MAX]; JVal vals[J_MAX]; };

JObj *json_parse(const char *s);
void json_free(JObj *o);
int jhas(const JObj *o, const char *k);
const char *jstr(const JObj *o, const char *k, const char *def);
double jnum(const JObj *o, const char *k, double def);
int jbool(const JObj *o, const char *k, int def);
JObj *jobj(const JObj *o, const char *k);

typedef struct { char buf[1024]; size_t len; int first; } JOut;
void jo_begin(JOut *o);
void jo_str(JOut *o, const char *k, const char *v);
void jo_num(JOut *o, const char *k, double v);
void jo_bool(JOut *o, const char *k, int v);
void jo_raw(JOut *o, const char *k, const char *json); // an already-built value
const char *jo_end(JOut *o);

void emit(const char *line); // one line to stdout (the only writer)

// ---- keys.c: DOM code <-> evdev (X keycode = evdev + 8) ----
int key_evdev(const char *code);   // -1 if unknown
const char *key_code(int evdev);   // NULL if unknown

// ---- screens.c: XRandR monitors (physical px) ----
enum { SIDE_NONE = -1, SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM };
int side_of(const char *s);
const char *side_name(int side);
void screens_refresh(void);
int screens_contains(int x, int y);
int screens_on_outer_edge(int x, int y, int side);
double screens_outward(int side, double dx, double dy);
double screens_offset(int x, int y, int side);
void screens_edge_point(int side, double offset, int *x, int *y);
void screens_center(int *x, int *y);
void screens_clamp(int x, int y, int fromX, int fromY, int *ox, int *oy);
void screens_box(int *x, int *y, int *w, int *h);

// ---- capture.c: XInput2 raw events, edge, hotkey, grabs, dead-man ----
int capture_init(void);
void capture_config(const JObj *c);
int capture_begin(int mouse, int keys);
void capture_stop(int side, double offset, int hasSide);
void capture_touch(void);
void capture_tick(void);
void capture_arm_return(int on, int side, double resistance);
void capture_feed_return(int x, int y, double dx, double dy);
void capture_xevent(XEvent *e);
int capture_active(void);
void capture_shutdown(void);

// ---- inject.c: XTest ----
void inject_apply(const JObj *ev);
void inject_move_to(int x, int y);
void inject_release_all(void);

double now_ms(void);

#endif
