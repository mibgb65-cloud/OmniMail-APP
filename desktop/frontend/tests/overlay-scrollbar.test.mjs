import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachScrollFade,
  computeOverlayScrollbar,
  computeScrollTopForThumbDelta,
  computeScrollTopForTrackClick,
  MIN_SCROLL_THUMB_HEIGHT,
} from "../src/components/common/scroll-fade/scrollFade.ts";

test("未溢出或轨道高度无效时隐藏悬浮滚动条滑块", () => {
  assert.deepEqual(
    computeOverlayScrollbar(
      { clientHeight: 400, scrollHeight: 400, scrollTop: 0 },
      392,
    ),
    {
      scrollable: false,
      thumbHeight: 0,
      thumbOffset: 0,
      maxScrollTop: 0,
      maxOffset: 0,
    },
  );
  assert.equal(
    computeOverlayScrollbar(
      { clientHeight: 400, scrollHeight: 402, scrollTop: 0 },
      392,
    ).scrollable,
    false,
  );
  assert.equal(
    computeOverlayScrollbar(
      { clientHeight: 400, scrollHeight: 800, scrollTop: 0 },
      0,
    ).scrollable,
    false,
  );
});

test("按比例计算滑块高度与顶部/中部/底部偏移", () => {
  const top = computeOverlayScrollbar(
    { clientHeight: 400, scrollHeight: 1600, scrollTop: 0 },
    400,
  );
  assert.equal(top.scrollable, true);
  assert.equal(top.thumbHeight, 100);
  assert.equal(top.thumbOffset, 0);
  assert.equal(top.maxOffset, 300);

  const mid = computeOverlayScrollbar(
    { clientHeight: 400, scrollHeight: 1600, scrollTop: 600 },
    400,
  );
  assert.equal(mid.thumbOffset, 150);

  const bottom = computeOverlayScrollbar(
    { clientHeight: 400, scrollHeight: 1600, scrollTop: 1200 },
    400,
  );
  assert.equal(bottom.thumbOffset, 300);
});

test("超长列表钳制滑块最小高度为 28px，且底部对齐轨道末端", () => {
  const geom = computeOverlayScrollbar(
    { clientHeight: 400, scrollHeight: 60000, scrollTop: 59600 },
    392,
  );
  assert.equal(geom.scrollable, true);
  assert.equal(geom.thumbHeight, MIN_SCROLL_THUMB_HEIGHT);
  assert.equal(geom.maxOffset, 392 - MIN_SCROLL_THUMB_HEIGHT);
  assert.equal(geom.thumbOffset, 392 - MIN_SCROLL_THUMB_HEIGHT);
});

test("拖动位移与轨道点击正确反算并钳制 scrollTop", () => {
  assert.equal(computeScrollTopForThumbDelta(0, 150, 300, 1200), 600);
  assert.equal(computeScrollTopForThumbDelta(600, 999, 300, 1200), 1200);
  assert.equal(computeScrollTopForThumbDelta(200, -999, 300, 1200), 0);

  assert.equal(computeScrollTopForTrackClick(200, 400, 100, 1200), 600);
  assert.equal(computeScrollTopForTrackClick(10, 400, 100, 1200), 0);
  assert.equal(computeScrollTopForTrackClick(390, 400, 100, 1200), 1200);
});

test("attachScrollFade 同步更新滑块样式、触发活跃回调并在销毁时清理", (t) => {
  const frames = new Map();
  let seq = 0;
  const origWindow = globalThis.window;
  const origRO = globalThis.ResizeObserver;
  globalThis.window = {
    requestAnimationFrame(cb) {
      frames.set(++seq, cb);
      return seq;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  t.after(() => {
    if (origWindow === undefined) delete globalThis.window;
    else globalThis.window = origWindow;
    if (origRO === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = origRO;
  });

  const attrs = new Set();
  const host = {
    toggleAttribute(k, on) {
      if (on) attrs.add(k);
      else attrs.delete(k);
    },
    removeAttribute(k) {
      attrs.delete(k);
    },
  };
  const listeners = new Map();
  const viewport = {
    clientHeight: 400,
    scrollHeight: 1600,
    scrollTop: 0,
    tabIndex: -1,
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  const track = { clientHeight: 400 };
  const thumb = { style: { height: "", transform: "" } };
  let activeHits = 0;

  const ctrl = attachScrollFade(host, viewport, {
    track,
    thumb,
    onScrollActivity: () => {
      activeHits += 1;
    },
  });
  assert.equal(attrs.has("data-scrollable"), true);
  assert.equal(thumb.style.height, "100px");
  assert.equal(thumb.style.transform, "translate3d(0, 0px, 0)");

  viewport.scrollTop = 600;
  listeners.get("scroll")();
  assert.equal(activeHits, 1);
  [...frames.values()].forEach((cb) => cb());
  frames.clear();
  assert.equal(thumb.style.transform, "translate3d(0, 150px, 0)");

  ctrl.dispose();
  assert.equal(attrs.has("data-scrollable"), false);
  assert.equal(listeners.size, 0);
});
