/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-slide";
import "../src/widgets/webwriter-slides";
import { drag, frame, items, mount, order, slides, unmountAll, until, visible } from "./helpers";

mocha.setup(getMochaConfig());

describe("<webwriter-slides> in read mode", function () {
  beforeEach(function () {
    document.designMode = "off";
  });
  afterEach(function () {
    unmountAll();
    document.designMode = "off";
  });

  it("shows readers no authoring controls and nothing can be dragged", async function () {
    const widget = await mount(`<webwriter-slides>${slides(3)}</webwriter-slides>`);
    assert.equal(items(widget, "sl-tooltip[data-ww-can]").filter(visible).length, 0, "visible author tooltips");
    assert.equal(items(widget, ".controls-section[data-ww-can]").filter(visible).length, 0, "visible add controls");
    assert.equal(items(widget, "[data-ww-drag]").length, 0, "drag markers");
    const before = order(widget);
    const [first, , last] = items(widget, ".slide-thumb");
    await drag(first, last);
    assert.deepEqual(order(widget), before);
  });

  it("navigates with the arrow keys, to the end with Shift and by ten with Ctrl", async function () {
    const widget = await mount(`<webwriter-slides>${slides(4)}</webwriter-slides>`);
    const key = (name: string, init: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, ...init }));
    key("ArrowRight");
    assert.equal(widget.activeSlideIndex, 1);
    key("ArrowRight", { shiftKey: true });
    assert.equal(widget.activeSlideIndex, 3);
    key("ArrowLeft");
    assert.equal(widget.activeSlideIndex, 2);
    key("ArrowLeft", { ctrlKey: true });
    assert.equal(widget.activeSlideIndex, 0);
  });

  it("leaves the arrow keys to text entry and to Alt combinations", async function () {
    const widget = await mount(`<webwriter-slides>${slides(3)}<input id="field"></webwriter-slides>`);
    const field = widget.querySelector<HTMLInputElement>("#field")!;
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, composed: true }));
    assert.equal(widget.activeSlideIndex, 0, "typing in an input");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true }));
    assert.equal(widget.activeSlideIndex, 0, "Alt+Arrow is the browser's");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    assert.equal(widget.activeSlideIndex, 1);
  });

  it("selects a slide with the keyboard through the labelled buttons", async function () {
    const widget = await mount(`<webwriter-slides>${slides(3)}</webwriter-slides>`);
    const buttons = items<HTMLButtonElement>(widget, "button.slide-select");
    assert.equal(buttons.length, 3);
    assert.isTrue(buttons.every(button => button.getAttribute("aria-label")!.length > 0), "labels");
    assert.isTrue(items(widget, "sl-icon-button").every(button => (button as any).label), "icon button labels");
    buttons[2].focus();
    assert.equal(widget.shadowRoot!.activeElement, buttons[2]);
    buttons[2].click();
    await until(() => widget.activeSlideIndex === 2, "selected");
    await widget.updateComplete;
    assert.equal(items(widget, "button.slide-select")[2].getAttribute("aria-current"), "true");
    assert.isNull(items(widget, "button.slide-select")[0].getAttribute("aria-current"));
  });

  it("works with a touch tap on a thumbnail and has touch-sized controls", async function () {
    const widget = await mount(`<webwriter-slides>${slides(3)}</webwriter-slides>`);
    const thumb = items(widget, ".slide-thumb")[1];
    const rect = thumb.getBoundingClientRect();
    const init = { bubbles: true, composed: true, pointerType: "touch", pointerId: 3, isPrimary: true, clientX: rect.left + 20, clientY: rect.top + 20 };
    thumb.dispatchEvent(new PointerEvent("pointerdown", init));
    thumb.dispatchEvent(new PointerEvent("pointerup", init));
    thumb.click();
    await until(() => widget.activeSlideIndex === 1, "tapped");
    for (const button of items(widget, "sl-icon-button")) {
      const box = button.getBoundingClientRect();
      if (!box.width) continue;
      assert.isAtLeast(Math.min(box.width, box.height), 24, "target size");
    }
  });

  it("takes text color, font and accent from the page theme", async function () {
    const wrap = document.createElement("div");
    wrap.style.cssText = "--ww-text-color: rgb(1, 2, 3); --ww-font-family: Courier, monospace; --ww-theme-accent-1: rgb(200, 10, 20)";
    wrap.innerHTML = `<webwriter-slides>${slides(2)}</webwriter-slides>`;
    document.body.append(wrap);
    const widget = wrap.firstElementChild as any;
    await widget.updateComplete;
    await until(() => widget.shadowRoot.querySelector(".slide-thumb"), "thumbs");
    try {
      assert.equal(getComputedStyle(widget).color, "rgb(1, 2, 3)");
      assert.include(getComputedStyle(widget).fontFamily, "Courier");
      assert.equal(getComputedStyle(widget.shadowRoot.querySelector(".slide-thumb.active")).borderTopColor, "rgb(200, 10, 20)");
      assert.equal(getComputedStyle(widget.shadowRoot.querySelector(".slides-index")).color, "rgb(1, 2, 3)");
    } finally {
      wrap.remove();
    }
  });

  it("keeps its width between 300 and 2100 pixels and shows a usable slide area", async function () {
    const widget = await mount(`<webwriter-slides>${slides(2)}</webwriter-slides>`);
    const box = widget.parentElement!;
    for (const width of [300, 2400]) {
      box.style.width = `${width}px`;
      await frame(2);
      const rect = widget.getBoundingClientRect();
      assert.isAtMost(rect.width, 2100, `max at ${width}`);
      assert.isAtLeast(widget.querySelector("webwriter-slide[active]")!.getBoundingClientRect().height, 200, `slide height at ${width}`);
      assert.isAtMost(widget.scrollWidth, rect.width + 1, `no sideways overflow at ${width}`);
    }
  });

  it("places hoisted tooltips next to their button inside the sized container", async function () {
    const widget = await mount(`<webwriter-slides>${slides(3)}</webwriter-slides>`);
    const button = items(widget, ".controls-columns sl-icon-button").find(el => el.getBoundingClientRect().width)!;
    const tooltip = button.closest("sl-tooltip") as any;
    await tooltip.show();
    await frame(3);
    const popup = tooltip.shadowRoot.querySelector("sl-popup").shadowRoot.querySelector("[part=popup]") as HTMLElement;
    const anchor = button.getBoundingClientRect();
    const rect = popup.getBoundingClientRect();
    assert.isBelow(Math.abs(rect.top - anchor.bottom), 40, `tooltip ${rect.top} anchor ${anchor.bottom}`);
    assert.isBelow(Math.abs(rect.left + rect.width / 2 - (anchor.left + anchor.width / 2)), 40, "centered");
    await tooltip.hide();
  });

  it("follows the mode when the contenteditable attribute changes", async function () {
    const widget = await mount(`<webwriter-slides>${slides(3)}</webwriter-slides>`);
    assert.equal(items(widget, "[data-ww-drag]").length, 0);
    widget.setAttribute("contenteditable", "");
    await until(() => items(widget, "[data-ww-drag]").length === 3, "markers after entering edit mode");
    widget.removeAttribute("contenteditable");
    await until(() => items(widget, "[data-ww-drag]").length === 0, "markers after leaving edit mode");
  });

  it("leaves no listener behind when a slideshow is removed", async function () {
    const widget = await mount(`<webwriter-slides>${slides(2)}</webwriter-slides>`);
    widget.parentElement!.remove();
    await frame(2);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    assert.equal(widget.activeSlideIndex, 0);
  });
});

mocha.run();
