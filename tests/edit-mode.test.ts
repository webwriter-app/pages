/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-page";
import "../src/widgets/webwriter-pages";
import { drag, frame, items, mount, order, pages, steps, unmountAll, until, visible } from "./helpers";

mocha.setup(getMochaConfig());

describe("<webwriter-pages> in edit mode", function () {
  beforeEach(function () {
    document.designMode = "on";
  });
  afterEach(function () {
    unmountAll();
    document.designMode = "off";
  });

  it("shows authors the controls while the arrow keys do not navigate", async function () {
    const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(3)}</webwriter-pages>`);
    const controls = items(widget, "sl-icon-button[data-ww-can]");
    assert.isTrue(controls.every(visible) && controls.length === 2, "active page controls");
    assert.isTrue(visible(items(widget, ".add-page")[0]), "add card");
    assert.equal(items(widget, "[data-ww-drag]").length, 3, "drag markers");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    assert.equal(widget.activePageIndex, 0);
  });

  it("keeps thumbnails and their select buttons on the tab order for the keyboard", async function () {
    const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(3)}</webwriter-pages>`);
    await until(() => items(widget, ".page-thumb").every(thumb => thumb.tabIndex === 0), "thumbs focusable");
    const buttons = items<HTMLButtonElement>(widget, "button.page-select");
    buttons[1].click();
    await until(() => widget.activePageIndex === 1, "button selects");
    assert.deepEqual(order(widget), ["s1", "s2", "s3"]);
  });

  it("joins the active tab to a full-width grey pane and keeps the add tab beside the row", async function () {
    const widget = await mount(`<webwriter-pages type="tabs" contenteditable="">${pages(24)}</webwriter-pages>`);
    const pane = items(widget, '[part="tabs"]')[0];
    const scroller = items(widget, ".page-tabs-wrapper")[0];
    const add = items(widget, ".add-page")[0];
    assert.equal(scroller.nextElementSibling, add, "add tab follows the row");
    assert.equal(getComputedStyle(items(widget, ".controls-rows")[0]).borderWidth, "0px", "no separate pagination box");
    for (const width of [300, 720, 1100]) {
      widget.parentElement!.style.width = `${width}px`;
      await frame(2);
      const host = widget.getBoundingClientRect();
      const header = pane.getBoundingClientRect();
      const page = widget.querySelector("webwriter-page[active]")!.getBoundingClientRect();
      const active = items(widget, ".page-tab.active")[0];
      const inactive = items(widget, ".page-tab:not(.active)")[0];
      assert.closeTo(header.width, host.width, 1, `full pane width at ${width}`);
      assert.closeTo(header.bottom, page.top + 1, 1, `pane joins page at ${width}`);
      assert.isBelow(header.height, 100, `shallow pane at ${width}`);
      assert.equal(getComputedStyle(active).backgroundColor, getComputedStyle(widget).backgroundColor, "active tab matches page surface");
      assert.equal(getComputedStyle(active).borderTopColor, getComputedStyle(pane).borderTopColor, "neutral active border");
      assert.equal(getComputedStyle(inactive).backgroundColor, "rgba(0, 0, 0, 0)");
      assert.equal(getComputedStyle(inactive).borderTopColor, "rgba(0, 0, 0, 0)");
      assert.closeTo(active.getBoundingClientRect().bottom, page.top, 1, "active tab connects to page");
      assert.equal(getComputedStyle(add).borderBottomLeftRadius, "0px", "tab-shaped add button");
      assert.closeTo(add.getBoundingClientRect().bottom, active.getBoundingClientRect().bottom, 1, "plus tab shares the tab baseline");
      assert.isAtLeast(add.getBoundingClientRect().left, scroller.getBoundingClientRect().right, "add tab stays outside scroller");
      const tops = items(widget, ".page-tab").map(tab => tab.getBoundingClientRect().top);
      assert.isTrue(tops.every(top => Math.abs(top - tops[0]) < 1), "tabs remain on one row");
    }
    scroller.scrollLeft = scroller.scrollWidth;
    assert.isAbove(scroller.scrollLeft, 0, "overflowed tabs can scroll");
    add.click();
    await widget.updateComplete;
    assert.equal(widget.activePageIndex, 24, "add tab appends a new page");
  });

  it("gives fewer tabs wider minimums while keeping a readable floor for long lists", async function () {
    const widget = await mount(`<webwriter-pages contenteditable="">${pages(2)}</webwriter-pages>`);
    const minimum = () => parseFloat(getComputedStyle(items(widget, ".page-tab")[0]).minInlineSize);
    widget.parentElement!.style.width = "720px";
    await frame(2);
    const few = minimum();
    assert.isAtLeast(few, 180, "few tabs have generous minimums");
    widget.insertAdjacentHTML("beforeend", pages(3));
    await until(() => items(widget, ".page-tab").length === 5);
    await frame(2);
    const medium = minimum();
    assert.isBelow(medium, few, "minimum shrinks with more tabs");
    widget.parentElement!.style.width = "520px";
    await frame(2);
    assert.isBelow(minimum(), medium, "minimum responds to available space");
    widget.insertAdjacentHTML("beforeend", pages(15));
    await until(() => items(widget, ".page-tab").length === 20);
    await frame(2);
    assert.closeTo(minimum(), 80, 1, "long lists stop shrinking at the floor");
    const scroller = items<HTMLElement>(widget, ".page-tabs-wrapper")[0];
    assert.isAbove(scroller.scrollWidth, scroller.clientWidth, "long lists scroll");
  });

  it("overlays controls only on the active preview and reveals them on keyboard focus", async function () {
    const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(3)}</webwriter-pages>`);
    const thumbs = items(widget, ".page-thumb");
    assert.equal(thumbs[0].querySelectorAll(".duplicate-btn, .remove-btn").length, 2);
    assert.equal(thumbs[1].querySelectorAll(".duplicate-btn, .remove-btn").length, 0);
    assert.equal(getComputedStyle(thumbs[0].querySelector(".page-options")!).position, "absolute");
    assert.equal(getComputedStyle(thumbs[1].querySelector(".page-number")!).opacity, "0.5");
    const select = thumbs[1].querySelector<HTMLButtonElement>(".page-select")!;
    select.focus();
    select.click();
    await widget.updateComplete;
    assert.equal(thumbs[0].querySelectorAll(".duplicate-btn, .remove-btn").length, 0);
    assert.equal(thumbs[1].querySelectorAll(".duplicate-btn, .remove-btn").length, 2);
    assert.equal(getComputedStyle(thumbs[1].querySelector(".page-number")!).opacity, "1");
    assert.equal(getComputedStyle(thumbs[1].querySelector("sl-icon-button")!).opacity, "1");
  });

  it("places white circular actions across the top-right border in both layouts", async function () {
    const widget = await mount(`<webwriter-pages contenteditable="">${pages(3)}</webwriter-pages>`);
    widget.parentElement!.style.width = "720px";
    for (const type of ["tabs", "pages"] as const) {
      widget.type = type;
      await widget.updateComplete;
      await frame(2);
      const card = items(widget, type === "tabs" ? ".page-tab.active" : ".page-thumb.active")[0];
      const duplicate = card.querySelector<HTMLElement>(".duplicate-btn")!;
      const remove = card.querySelector<HTMLElement>(".remove-btn")!;
      await until(() => remove.shadowRoot?.querySelector('[part="base"]'), "action button ready");
      const box = card.getBoundingClientRect();
      const close = remove.getBoundingClientRect();
      const copy = duplicate.getBoundingClientRect();
      assert.isBelow(close.top, box.top, `${type} remove overlaps top`);
      assert.isAbove(close.bottom, box.top, `${type} remove crosses top`);
      assert.isBelow(close.left, box.right, `${type} remove overlaps right`);
      assert.isAbove(close.right, box.right, `${type} remove crosses right`);
      assert.closeTo(close.left + close.width / 2, box.right, 1.5, "remove centered on right edge");
      assert.closeTo(copy.top, close.top, 1, "actions align at the top");
      assert.closeTo(close.left - copy.right, 6, 1, "actions have a gap");
      for (const button of [duplicate, remove]) {
        const base = button.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
        const style = getComputedStyle(button, "::before");
        assert.equal(style.backgroundColor, "rgb(255, 255, 255)", "white button surface");
        assert.equal(style.borderRadius, "50%", "circular button");
        const rect = base.getBoundingClientRect();
        assert.closeTo(rect.width, rect.height, 1, "round target");
        assert.isAtLeast(rect.width, 24, "usable target");
        assert.equal(style.inset, "2px", "visible circle is smaller than its click target");
        const hit = widget.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + 2);
        assert.isTrue(hit === button, "overlapping portion remains clickable");
      }
    }
  });

  it("keeps the last page's remove button visible and disabled in both layouts", async function () {
    const widget = await mount(`<webwriter-pages contenteditable="">${pages(1)}</webwriter-pages>`);
    for (const type of ["tabs", "pages"] as const) {
      widget.type = type;
      await widget.updateComplete;
      const remove = items<any>(widget, ".remove-btn")[0];
      assert.isTrue(visible(remove), "remove button remains visible");
      assert.isTrue(remove.disabled, "last page cannot be removed");
      remove.click();
      widget.removePage(0);
      assert.equal(widget.querySelectorAll("webwriter-page").length, 1, "last page survives");
    }
    widget.addPage();
    await widget.updateComplete;
    assert.isFalse(items<any>(widget, ".remove-btn")[0].disabled, "remove is enabled after adding a page");
  });

  it("edits plaintext tab labels, auto-sizes the input, and follows external label changes", async function () {
    const widget = await mount(`<webwriter-pages type="tabs" contenteditable="">${pages(3)}</webwriter-pages>`);
    widget.parentElement!.style.width = "720px";
    await frame(2);
    let field = items<HTMLInputElement>(widget, ".page-label-input")[0];
    assert.equal(items(widget, ".page-label-input").length, 1, "only the selected tab is editable");
    assert.equal(field.placeholder, "Page 1");
    assert.equal(field.value, "");
    assert.isFalse(widget.children[0].hasAttribute("label"), "placeholder is not saved as a label");
    assert.equal(items(widget, ".page-tab .page-number").length, 0, "no tab numbers");
    const short = field.getBoundingClientRect().width;
    const recorder = steps(widget);
    field.focus();
    assert.equal(getComputedStyle(field).outlineStyle, "none", "caret is the editing indicator");
    field.value = "An introduction to the topic";
    field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    await widget.updateComplete;
    await frame(2);
    assert.equal(widget.children[0].getAttribute("label"), "An introduction to the topic");
    assert.deepEqual(recorder.stop(), ["transactionstart", "transactionend"], "label edit is one undo step");
    assert.isAbove(field.getBoundingClientRect().width, short, "field grows with its label");
    widget.children[0].setAttribute("label", "Remote label");
    await until(() => field.value === "Remote label", "external attribute updates focused input");
    field.setSelectionRange(3, 3);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, composed: true }));
    assert.equal(widget.activePageIndex, 0, "arrow keys are reserved for text editing");
    items<HTMLButtonElement>(widget, ".page-tab .page-select")[0].click();
    await widget.updateComplete;
    assert.equal(widget.activePageIndex, 1, "first click selects the inactive tab");
    field = items<HTMLInputElement>(widget, ".page-label-input")[0];
    assert.notEqual(widget.shadowRoot!.activeElement, field, "selection does not begin text editing");
    assert.equal(field.placeholder, "Page 2");
    field.focus();
    assert.equal(widget.shadowRoot!.activeElement, field, "selected label accepts editing");
    widget.children[0].setAttribute("label", "<b>Plain text</b>");
    await until(() => items<HTMLButtonElement>(widget, ".page-tab .page-select")[0].textContent!.includes("<b>Plain text</b>"), "inactive label follows external updates");
    assert.isNull(widget.shadowRoot!.querySelector(".page-tab b"));
    items<HTMLButtonElement>(widget, ".page-tab .page-select")[0].click();
    await widget.updateComplete;
    field = items<HTMLInputElement>(widget, ".page-label-input")[0];
    field.value = "";
    field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    await widget.updateComplete;
    assert.isFalse(widget.children[0].hasAttribute("label"), "clearing restores the placeholder");
  });

  it("keeps a gap beside the add card while previews scroll and appends a page", async function () {
    const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(12)}</webwriter-pages>`);
    const strip = items(widget, ".page-thumbs")[0];
    const add = items<HTMLButtonElement>(widget, ".add-page")[0];
    assert.equal(strip.nextElementSibling, add, "add card sits beside the scroller");
    assert.isNull(widget.shadowRoot!.querySelector(".add-btn"), "no toolbar add button");
    for (const width of [300, 720, 1100]) {
      widget.parentElement!.style.width = `${width}px`;
      await frame(2);
      const initial = add.getBoundingClientRect();
      for (const progress of [0, 0.5, 1]) {
        strip.scrollLeft = (strip.scrollWidth - strip.clientWidth) * progress;
        strip.scrollTop = (strip.scrollHeight - strip.clientHeight) * progress;
        await frame();
        const viewport = strip.getBoundingClientRect();
        const card = add.getBoundingClientRect();
        const pane = items(widget, '[part="actions"]')[0].getBoundingClientRect();
        assert.closeTo(card.left - viewport.right, 8, 1, `gap at ${width}/${progress}`);
        assert.closeTo(card.left, initial.left, 1, "add card does not move when scrolling");
        assert.closeTo(card.top, initial.top, 1, "add card stays visible when scrolling");
        assert.isAtMost(card.right, pane.right, "add card fits the pane");
        assert.closeTo(viewport.left, pane.left, 1, "scroller reaches the left edge");
        if (width >= 520) assert.closeTo(viewport.bottom, pane.bottom, 1, "scroller reaches the bottom edge");
        assert.equal(getComputedStyle(strip).scrollbarWidth, "thin");
        assert.closeTo(card.width / card.height, 16 / 9, 0.01, "add card is page-shaped");
      }
    }
    add.click();
    await widget.updateComplete;
    assert.equal(widget.querySelectorAll("webwriter-page").length, 13);
    assert.equal(widget.activePageIndex, 12, "new page is appended and selected");
    assert.isNull(widget.querySelector("button"), "controls stay out of authored content");
  });

  it("fills the page area and ends at the controls under the editor's block display rule", async function () {
    const widget = await mount(`<webwriter-pages type="pages" contenteditable=""><webwriter-page><p></p></webwriter-page></webwriter-pages>`);
    const style = document.createElement("style");
    style.textContent = "webwriter-pages:not([hidden]) { display: block; }";
    widget.parentElement!.append(style);
    for (const type of ["pages", "tabs"] as const) {
      widget.type = type;
      await widget.updateComplete;
      for (const width of [300, 720, 1100]) {
        widget.parentElement!.style.width = `${width}px`;
        await frame(2);
        const area = widget.shadowRoot!.querySelector("slot:not([name])")!.getBoundingClientRect();
        const page = widget.querySelector("webwriter-page")!.getBoundingClientRect();
        const host = widget.getBoundingClientRect();
        assert.closeTo(page.height, area.height, 1, `${type} page fills its slot at ${width}`);
        assert.closeTo(page.width / page.height, 16 / 9, 0.01, `${type} page ratio at ${width}`);
        if (type === "pages") {
          const pane = widget.shadowRoot!.querySelector('[part="actions"]')!.getBoundingClientRect();
          if (width >= 1100) {
            assert.closeTo(pane.left, page.right, 1, `pane beside page at ${width}`);
            assert.closeTo(pane.height, page.height, 1, `pane matches page height at ${width}`);
          } else {
            assert.closeTo(pane.top, page.bottom, 1, `pane touches page at ${width}`);
          }
          assert.closeTo(pane.bottom, host.bottom, 1, `no blank area below pane at ${width}`);
        } else {
          assert.closeTo(page.bottom, host.bottom, 1, `no blank area below page at ${width}`);
        }
      }
    }
  });

  it("reorders the authored pages in the vertical preview pane", async function () {
    const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(4)}</webwriter-pages>`);
    widget.parentElement!.style.width = "1100px";
    await frame(2);
    const thumbs = items(widget, ".page-thumb");
    await drag(thumbs[0], thumbs[2]);
    await until(() => order(widget).join() === "s2,s3,s1,s4", `order ${order(widget)}`);
    assert.equal(widget.activePageIndex, 2);
  });

  describe("drag", function () {
    it("reorders the authored pages from the thumbnails in one transaction", async function () {
      const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(4)}</webwriter-pages>`);
      const recorder = steps(widget);
      const thumbs = items(widget, ".page-thumb");
      const { lifted } = await drag(thumbs[0], thumbs[2]);
      await until(() => order(widget).join() === "s2,s3,s1,s4", `order ${order(widget)}`);
      assert.isTrue(lifted, "item was lifted");
      assert.equal(widget.activePageIndex, 2, "active index follows the moved page");
      await until(() => (widget.children[2] as any).active === true, "active attribute");
      assert.deepEqual(recorder.stop(), ["transactionstart", "dragcommit", "transactionend"], "one transaction");
      assert.isNull(widget.shadowRoot!.querySelector("[data-ww-dragging]"), "no drag state left");
      assert.deepEqual([...widget.querySelectorAll("webwriter-page")].map(page => page.getAttributeNames().filter(name => name.startsWith("data-ww")).length), [0, 0, 0, 0], "nothing written to pages");
    });

    it("moves a page backwards and to the end", async function () {
      const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(4)}</webwriter-pages>`);
      const thumbs = items(widget, ".page-thumb");
      await drag(thumbs[3], thumbs[0]);
      await until(() => order(widget)[0] === "s4" || order(widget)[1] === "s4", `order ${order(widget)}`);
      assert.deepEqual([...order(widget)].sort(), ["s1", "s2", "s3", "s4"]);
      assert.equal(widget.activePageIndex, order(widget).indexOf("s4"));
      const before = order(widget);
      const last = items(widget, ".page-thumb").at(-1)!;
      await drag(items(widget, ".page-thumb")[0], last);
      await until(() => order(widget).at(-1) === before[0], `order ${order(widget)}`);
    });

    it("cancels with Escape without a change or a transaction", async function () {
      const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(3)}</webwriter-pages>`);
      const recorder = steps(widget);
      const thumbs = items(widget, ".page-thumb");
      const { lifted } = await drag(thumbs[0], thumbs[2], { cancel: true });
      assert.isTrue(lifted, "lifted");
      assert.deepEqual(order(widget), ["s1", "s2", "s3"]);
      assert.deepEqual(recorder.stop(), []);
      await until(() => !widget.shadowRoot!.querySelector("[data-ww-dragging]"), "drag state cleared");
    });

    it("reorders in the tabs view too", async function () {
      const widget = await mount(`<webwriter-pages contenteditable="" type="tabs">${pages(3)}</webwriter-pages>`);
      const tabs = items(widget, ".page-tab");
      assert.equal(tabs.length, 3);
      await drag(tabs[2], tabs[0]);
      await until(() => order(widget).join() !== "s1,s2,s3", `order ${order(widget)}`);
      assert.isTrue(order(widget).indexOf("s3") < 2);
      assert.equal(widget.activePageIndex, order(widget).indexOf("s3"));
    });

    it("navigates when thumbnails are clicked and never picks a page up", async function () {
      const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(3)}</webwriter-pages>`);
      const thumbs = () => items(widget, ".page-thumb");
      thumbs()[0].click();
      thumbs()[2].click();
      await until(() => widget.activePageIndex === 2, "navigated");
      await frame(3);
      assert.deepEqual(order(widget), ["s1", "s2", "s3"]);
      assert.isNull(widget.shadowRoot!.querySelector("[data-ww-dragging]"), "nothing held");
    });
  });

  it("makes add, duplicate and remove one undo step each", async function () {
    const widget = await mount(`<webwriter-pages type="pages" contenteditable="">${pages(2)}</webwriter-pages>`);
    const run = async (action: () => void) => {
      const recorder = steps(widget);
      action();
      await widget.updateComplete;
      await frame(2);
      return recorder.stop();
    };
    const click = (selector: string) => () => widget.shadowRoot!.querySelector<HTMLElement>(selector)!.click();
    assert.deepEqual(await run(click(".add-page")), ["transactionstart", "transactionend"], "add");
    assert.equal(widget.querySelectorAll("webwriter-page").length, 3);
    assert.deepEqual(await run(click(".duplicate-btn")), ["transactionstart", "transactionend"], "duplicate");
    assert.equal(widget.querySelectorAll("webwriter-page").length, 4);
    assert.deepEqual(await run(click(".remove-btn")), ["transactionstart", "transactionend"], "remove");
    assert.equal(widget.querySelectorAll("webwriter-page").length, 3);
    assert.deepEqual(await run(() => widget.duplicateActivePage()), ["transactionstart", "transactionend"], "action");
  });
});

mocha.run();
