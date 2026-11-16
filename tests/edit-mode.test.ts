/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-slide";
import "../src/widgets/webwriter-slides";
import { drag, frame, items, mount, order, slides, steps, unmountAll, until, visible } from "./helpers";

mocha.setup(getMochaConfig());

describe("<webwriter-slides> in edit mode", function () {
  beforeEach(function () {
    document.designMode = "on";
  });
  afterEach(function () {
    unmountAll();
    document.designMode = "off";
  });

  it("shows authors the controls while the arrow keys do not navigate", async function () {
    const widget = await mount(`<webwriter-slides contenteditable="">${slides(3)}</webwriter-slides>`);
    const tooltips = items(widget, "sl-tooltip[data-ww-can]");
    assert.isTrue(tooltips.every(visible) && tooltips.length >= 6, "tooltips");
    assert.isTrue(items(widget, ".controls-section[data-ww-can]").every(visible), "add controls");
    assert.equal(items(widget, "[data-ww-drag]").length, 3, "drag markers");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    assert.equal(widget.activeSlideIndex, 0);
  });

  describe("drag", function () {
    it("reorders the authored slides from the thumbnails in one transaction", async function () {
      const widget = await mount(`<webwriter-slides contenteditable="">${slides(4)}</webwriter-slides>`);
      const recorder = steps(widget);
      const thumbs = items(widget, ".slide-thumb");
      const { lifted } = await drag(thumbs[0], thumbs[2]);
      await until(() => order(widget).join() === "s2,s3,s1,s4", `order ${order(widget)}`);
      assert.isTrue(lifted, "item was lifted");
      assert.equal(widget.activeSlideIndex, 2, "active index follows the moved slide");
      await until(() => (widget.children[2] as any).active === true, "active attribute");
      assert.deepEqual(recorder.stop(), ["transactionstart", "dragcommit", "transactionend"], "one transaction");
      assert.isNull(widget.shadowRoot!.querySelector("[data-ww-dragging]"), "no drag state left");
      assert.deepEqual([...widget.querySelectorAll("webwriter-slide")].map(slide => slide.getAttributeNames().filter(name => name.startsWith("data-ww")).length), [0, 0, 0, 0], "nothing written to slides");
    });

    it("moves a slide backwards and to the end", async function () {
      const widget = await mount(`<webwriter-slides contenteditable="">${slides(4)}</webwriter-slides>`);
      const thumbs = items(widget, ".slide-thumb");
      await drag(thumbs[3], thumbs[0]);
      await until(() => order(widget)[0] === "s4" || order(widget)[1] === "s4", `order ${order(widget)}`);
      assert.deepEqual([...order(widget)].sort(), ["s1", "s2", "s3", "s4"]);
      assert.equal(widget.activeSlideIndex, order(widget).indexOf("s4"));
      const before = order(widget);
      const last = items(widget, ".slide-thumb").at(-1)!;
      await drag(items(widget, ".slide-thumb")[0], last);
      await until(() => order(widget).at(-1) === before[0], `order ${order(widget)}`);
    });

    it("cancels with Escape without a change or a transaction", async function () {
      const widget = await mount(`<webwriter-slides contenteditable="">${slides(3)}</webwriter-slides>`);
      const recorder = steps(widget);
      const thumbs = items(widget, ".slide-thumb");
      const { lifted } = await drag(thumbs[0], thumbs[2], { cancel: true });
      assert.isTrue(lifted, "lifted");
      assert.deepEqual(order(widget), ["s1", "s2", "s3"]);
      assert.deepEqual(recorder.stop(), []);
      await until(() => !widget.shadowRoot!.querySelector("[data-ww-dragging]"), "drag state cleared");
    });

    it("reorders in the tabs view too", async function () {
      const widget = await mount(`<webwriter-slides contenteditable="" type="tabs">${slides(3)}</webwriter-slides>`);
      const tabs = items(widget, ".slide-tab");
      assert.equal(tabs.length, 3);
      await drag(tabs[2], tabs[0]);
      await until(() => order(widget).join() !== "s1,s2,s3", `order ${order(widget)}`);
      assert.isTrue(order(widget).indexOf("s3") < 2);
      assert.equal(widget.activeSlideIndex, order(widget).indexOf("s3"));
    });

    it("navigates when thumbnails are clicked and never picks a slide up", async function () {
      const widget = await mount(`<webwriter-slides contenteditable="">${slides(3)}</webwriter-slides>`);
      const thumbs = () => items(widget, ".slide-thumb");
      thumbs()[0].click();
      thumbs()[2].click();
      await until(() => widget.activeSlideIndex === 2, "navigated");
      await frame(3);
      assert.deepEqual(order(widget), ["s1", "s2", "s3"]);
      assert.isNull(widget.shadowRoot!.querySelector("[data-ww-dragging]"), "nothing held");
    });
  });

  it("makes add, duplicate and remove one undo step each", async function () {
    const widget = await mount(`<webwriter-slides contenteditable="">${slides(2)}</webwriter-slides>`);
    const run = async (action: () => void) => {
      const recorder = steps(widget);
      action();
      await widget.updateComplete;
      await frame(2);
      return recorder.stop();
    };
    const click = (selector: string) => () => widget.shadowRoot!.querySelector<HTMLElement>(selector)!.click();
    assert.deepEqual(await run(click(".add-btn")), ["transactionstart", "transactionend"], "add");
    assert.equal(widget.querySelectorAll("webwriter-slide").length, 3);
    assert.deepEqual(await run(click(".duplicate-btn")), ["transactionstart", "transactionend"], "duplicate");
    assert.equal(widget.querySelectorAll("webwriter-slide").length, 4);
    assert.deepEqual(await run(click(".remove-btn")), ["transactionstart", "transactionend"], "remove");
    assert.equal(widget.querySelectorAll("webwriter-slide").length, 3);
    assert.deepEqual(await run(() => widget.duplicateActiveSlide()), ["transactionstart", "transactionend"], "action");
  });
});

mocha.run();
