// Minimal DOM double for HUD tests: elements, classes, text writes and ids.
function makeClassList(el) {
  return {
    add() { for (const name of arguments) el._classes.add(name); },
    remove() { for (const name of arguments) el._classes.delete(name); },
    contains(name) { return el._classes.has(name); },
    toggle(name, force) {
      const on = force === undefined ? !el._classes.has(name) : !!force;
      if (on) el._classes.add(name);
      else el._classes.delete(name);
      return on;
    },
  };
}

function makeElement(tag) {
  const el = {
    tagName: tag,
    _classes: new Set(),
    _text: '',
    textWrites: 0,
    children: [],
    parentNode: null,
    style: {},
    attributes: {},
    offsetWidth: 0,
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    addEventListener(type, fn) {
      this._listeners = this._listeners || {};
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    },
    dispatch(type) {
      const list = (this._listeners && this._listeners[type]) || [];
      for (const fn of list) fn({ type, target: this });
    },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
  };
  Object.defineProperty(el, 'className', {
    get() { return Array.from(el._classes).join(' '); },
    set(value) { el._classes = new Set(String(value).split(/\s+/).filter(Boolean)); },
  });
  Object.defineProperty(el, 'textContent', {
    get() { return el._text; },
    set(value) { el._text = String(value); el.textWrites++; },
  });
  el.classList = makeClassList(el);
  return el;
}

function makeDocument(ids) {
  const elements = {};
  for (const id of ids) elements[id] = makeElement('div');
  return {
    elements,
    getElementById(id) { return elements[id] || null; },
    createElement(tag) { return makeElement(tag); },
  };
}

module.exports = { makeElement, makeDocument };
