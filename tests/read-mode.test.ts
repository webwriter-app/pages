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
