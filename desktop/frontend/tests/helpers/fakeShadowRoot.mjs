export class MockClassList {
  set = new Set();
  add(...names) {
    names.forEach((n) => this.set.add(n));
  }
  contains(name) {
    return this.set.has(name);
  }
}

export class MockElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attrs = new Map();
    this.dataset = {};
    this.style = { display: "" };
    this.children = [];
    this.parent = null;
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
    this.type = "";
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.listeners = new Map();
    this.classList = new MockClassList();
  }
  set className(val) {
    this._className = val;
    this.classList.set = new Set(String(val).split(/\s+/).filter(Boolean));
  }
  get className() {
    return this._className ?? "";
  }
  setAttribute(k, v) {
    this.attrs.set(k.toLowerCase(), String(v));
  }
  getAttribute(k) {
    return this.attrs.has(k.toLowerCase())
      ? this.attrs.get(k.toLowerCase())
      : null;
  }
  hasAttribute(k) {
    return this.attrs.has(k.toLowerCase());
  }
  removeAttribute(k) {
    this.attrs.delete(k.toLowerCase());
  }
  closest() {
    return null;
  }
  append(...nodes) {
    nodes.forEach((n) => this.appendChild(n));
  }
  appendChild(node) {
    node.parent = this;
    this.children.push(node);
    return node;
  }
  insertAdjacentElement(pos, el) {
    if (pos === "afterend" && this.parent) {
      const idx = this.parent.children.indexOf(this);
      el.parent = this.parent;
      this.parent.children.splice(idx + 1, 0, el);
    }
    return el;
  }
  get nextElementSibling() {
    if (!this.parent) return null;
    const idx = this.parent.children.indexOf(this);
    return idx >= 0 ? (this.parent.children[idx + 1] ?? null) : null;
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  addEventListener(type, fn) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }
  removeEventListener(type, fn) {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      arr.filter((f) => f !== fn),
    );
  }
  dispatch(type) {
    const ev = { preventDefault() {}, stopPropagation() {}, target: this };
    for (const fn of this.listeners.get(type) ?? []) {
      fn(ev);
    }
  }
  collectText() {
    return (
      this.textContent + this.children.map((c) => c.collectText()).join("")
    );
  }
}

export function createFakeRoot() {
  const doc = {
    createElement: (tag) => new MockElement(tag, doc),
  };
  const root = new MockElement("div", doc);
  root.querySelectorAll = (selector) => {
    if (selector === "img") {
      return root.children.filter((c) => c.tagName === "IMG");
    }
    if (selector === 'img[data-zoomable="true"]') {
      return root.children.filter(
        (c) =>
          c.tagName === "IMG" && c.getAttribute("data-zoomable") === "true",
      );
    }
    return [];
  };
  return { doc, root };
}
