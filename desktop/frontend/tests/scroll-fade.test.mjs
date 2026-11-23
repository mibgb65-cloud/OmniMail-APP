import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachScrollFade,
  readScrollFade,
} from "../src/components/common/scroll-fade/scrollFade.ts";

test("只对超过容差且尚未到底的可视内容显示遮罩", () => {
  const cases = [
    [200, 100, 0, false, false],
    [200, 202, 0, false, false],
    [0, 200, 0, false, false],
    [200, 400, -12, true, true],
    [200, 400, 197.5, true, true],
    [200, 400, 198, true, false],
    [200, 400, 205, true, false],
  ];
  for (const [
    clientHeight,
    scrollHeight,
    scrollTop,
    scrollable,
    hasMore,
  ] of cases) {
    assert.deepEqual(
      readScrollFade({ clientHeight, scrollHeight, scrollTop }),
      {
        scrollable,
        hasMore,
      },
    );
  }
});

function fakeScrollEnvironment(t) {
  const frameQueue = new Map();
  let lastFrame = 0;
  const observed = new Set();
  let requestResize;
  const originals = {
    window: globalThis.window,
    ResizeObserver: globalThis.ResizeObserver,
  };
  globalThis.window = {
    requestAnimationFrame(callback) {
      frameQueue.set(++lastFrame, callback);
      return lastFrame;
    },
    cancelAnimationFrame(id) {
      frameQueue.delete(id);
    },
  };
  globalThis.ResizeObserver = class {
    constructor(callback) {
      requestResize = callback;
    }
    observe(node) {
      observed.add(node);
    }
    disconnect() {
      observed.clear();
    }
  };
  t.after(() => {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const attrs = new Set();
  const host = {
    toggleAttribute(attribute, on) {
      if (on) attrs.add(attribute);
      else attrs.delete(attribute);
    },
    removeAttribute(attribute) {
      attrs.delete(attribute);
    },
  };
  const listeners = new Map();
  const viewport = {
    clientHeight: 200,
    scrollHeight: 200,
    scrollTop: 0,
    tabIndex: -1,
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type, fn) {
      assert.equal(fn, listeners.get(type));
      listeners.delete(type);
    },
  };
  return {
    host,
    viewport,
    listeners,
    observed,
    frameQueue,
    resize: () => requestResize(),
    fades: () => attrs.has("data-scroll-more"),
    flush() {
      const callbacks = [...frameQueue.values()];
      frameQueue.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

test("尺寸、异步内容和滚动共同更新遮罩，清理所有监听", (t) => {
  const env = fakeScrollEnvironment(t);
  const {
    host,
    viewport,
    listeners,
    observed,
    resize,
    fades,
    flush,
    frameQueue,
  } = env;
  const content = {};
  const controller = attachScrollFade(host, viewport, {
    content,
    focusOnOverflow: true,
  });
  assert.deepEqual([...observed], [viewport, content]);
  assert.equal(viewport.tabIndex, -1);
  viewport.scrollHeight = 430;
  resize();
  resize();
  assert.equal(frameQueue.size, 1);
  flush();
  assert.equal(viewport.tabIndex, 0);
  assert.equal(fades(), true);
  viewport.scrollTop = 229;
  listeners.get("scroll")();
  flush();
  assert.equal(fades(), false);
  viewport.scrollTop = 0;
  listeners.get("scroll")();
  flush();
  assert.equal(fades(), true);
  viewport.clientHeight = 440;
  resize();
  flush();
  assert.equal(viewport.tabIndex, -1);
  assert.equal(fades(), false);
  resize();
  controller.dispose();
  assert.equal(listeners.size, 0);
  assert.equal(observed.size, 0);
  assert.equal(frameQueue.size, 0);
});

test("输入或程序写入可更新文本域遮罩且不接管编辑焦点", (t) => {
  const { host, viewport, listeners, fades, flush } = fakeScrollEnvironment(t);
  viewport.tabIndex = 0;
  const controller = attachScrollFade(host, viewport, { editable: true });
  viewport.scrollHeight = 310;
  listeners.get("input")();
  flush();
  assert.equal(fades(), true);
  viewport.scrollHeight = 200;
  controller.refresh();
  flush();
  assert.equal(fades(), false);
  assert.equal(viewport.tabIndex, 0);
  controller.dispose();
  assert.equal(listeners.size, 0);
});
