/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-page";
import "../src/widgets/webwriter-pages";
import { drag, frame, items, mount, order, pages, unmountAll, until, visible } from "./helpers";

mocha.setup(getMochaConfig());

describe("<webwriter-pages> in read mode", function () {
  beforeEach(function () {
    document.designMode = "off";
  });
  afterEach(function () {
    unmountAll();
    document.designMode = "off";
  });

  it("shows readers no authoring controls and nothing can be dragged", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(3)}</webwriter-pages>`);
    assert.equal(items(widget, "sl-icon-button[data-ww-can]").filter(visible).length, 0, "visible author controls");
    assert.equal(items(widget, ".add-page").length, 0, "no author add card");
    assert.equal(items(widget, "[data-ww-drag]").length, 0, "drag markers");
    const before = order(widget);
    const [first, , last] = items(widget, ".page-thumb");
    await drag(first, last);
    assert.deepEqual(order(widget), before);
  });

  it("fits single media to the page without padding or distorted proportions", async function () {
    const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="640"><rect width="320" height="640" fill="teal"/></svg>')}`;
    const widget = await mount(`<webwriter-pages><webwriter-page><!--keep--><picture style="width:320px"><img src="${image}" width="320" height="640" alt="Portrait"></picture></webwriter-page></webwriter-pages>`);
    widget.parentElement!.style.width = "720px";
    const page = widget.querySelector<HTMLElement>("webwriter-page")!;
    const img = page.querySelector("img")!;
    await img.decode();
    for(const type of ["tabs", "pages"] as const) {
      widget.type = type;
      await widget.updateComplete;
      await frame(2);
      const style = getComputedStyle(page), rect = page.getBoundingClientRect();
      const media = img.getBoundingClientRect();
      assert.equal(style.padding, "0px");
      assert.closeTo(media.width, rect.width - page.clientLeft * 2, 1);
      assert.closeTo(media.height, rect.height - page.clientTop * 2, 1);
      assert.equal(getComputedStyle(img).objectFit, "contain", "media remains uncropped and proportional");
      assert.equal(img.naturalWidth / img.naturalHeight, 0.5, "portrait source is preserved");
      assert.isAtMost(page.scrollHeight, page.clientHeight + 1, "no media scrollbar");
    }
    page.insertAdjacentHTML("beforeend", "<p>Caption</p>");
    await frame(2);
    assert.isAbove(parseFloat(getComputedStyle(page).paddingTop), 0, "mixed content keeps its padding");
    assert.equal(img.getAttribute("width"), "320", "authored dimensions are preserved");
    page.querySelector("p")!.remove();
    await frame(2);
    assert.equal(getComputedStyle(page).padding, "0px", "direct DOM changes update layout");
    page.replaceChildren(document.createElement("video"));
    await frame(2);
    const video = page.firstElementChild as HTMLVideoElement;
    assert.equal(getComputedStyle(video).objectFit, "contain");
    assert.closeTo(video.getBoundingClientRect().height, page.clientHeight, 1);
    assert.equal(getComputedStyle(page).padding, "0px");
  });

  it("preserves plaintext tab labels through serialization and follows external updates", async function () {
    const widget = await mount(`<webwriter-pages><webwriter-page label="Introduction"><p>First</p></webwriter-page><webwriter-page><p>Second</p></webwriter-page></webwriter-pages>`);
    const saved = await mount(widget.outerHTML);
    assert.equal(items(saved, ".page-label-input").length, 0, "readers cannot edit labels");
    const buttons = items<HTMLButtonElement>(saved, ".page-tab .page-select");
    assert.equal(buttons[0].textContent!.trim(), "Introduction");
    assert.equal(buttons[1].textContent!.trim(), "Page 2");
    saved.children[0].setAttribute("label", "Updated remotely");
    await until(() => buttons[0].textContent!.trim() === "Updated remotely", "reader sees external label change");
    buttons[1].click();
    await saved.updateComplete;
    assert.equal(saved.activePageIndex, 1);
    assert.isFalse(saved.children[1].hasAttribute("label"), "placeholder remains transient");
  });

  it("navigates with the arrow keys, to the end with Shift and by ten with Ctrl", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(4)}</webwriter-pages>`);
    const key = (name: string, init: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, ...init }));
    key("ArrowRight");
    assert.equal(widget.activePageIndex, 1);
    key("ArrowRight", { shiftKey: true });
    assert.equal(widget.activePageIndex, 3);
    key("ArrowLeft");
    assert.equal(widget.activePageIndex, 2);
    key("ArrowLeft", { ctrlKey: true });
    assert.equal(widget.activePageIndex, 0);
  });

  it("leaves the arrow keys to text entry and to Alt combinations", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(3)}<input id="field"></webwriter-pages>`);
    const field = widget.querySelector<HTMLInputElement>("#field")!;
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, composed: true }));
    assert.equal(widget.activePageIndex, 0, "typing in an input");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true }));
    assert.equal(widget.activePageIndex, 0, "Alt+Arrow is the browser's");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    assert.equal(widget.activePageIndex, 1);
  });

  it("selects a page with the keyboard through the labelled buttons", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(3)}</webwriter-pages>`);
    const buttons = items<HTMLButtonElement>(widget, "button.page-select");
    assert.equal(buttons.length, 3);
    assert.isTrue(buttons.every(button => button.getAttribute("aria-label")!.length > 0), "labels");
    assert.isTrue(items(widget, "sl-icon-button").every(button => (button as any).label), "icon button labels");
    buttons[2].focus();
    assert.equal(widget.shadowRoot!.activeElement, buttons[2]);
    buttons[2].click();
    await until(() => widget.activePageIndex === 2, "selected");
    await widget.updateComplete;
    assert.equal(items(widget, "button.page-select")[2].getAttribute("aria-current"), "true");
    assert.isNull(items(widget, "button.page-select")[0].getAttribute("aria-current"));
  });

  it("works with a touch tap on a thumbnail and has touch-sized controls", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(3)}</webwriter-pages>`);
    const thumb = items(widget, ".page-thumb")[1];
    const rect = thumb.getBoundingClientRect();
    const init = { bubbles: true, composed: true, pointerType: "touch", pointerId: 3, isPrimary: true, clientX: rect.left + 20, clientY: rect.top + 20 };
    thumb.dispatchEvent(new PointerEvent("pointerdown", init));
    thumb.dispatchEvent(new PointerEvent("pointerup", init));
    thumb.click();
    await until(() => widget.activePageIndex === 1, "tapped");
    for (const button of items(widget, "sl-icon-button")) {
      const box = button.getBoundingClientRect();
      if (!box.width) continue;
      assert.isAtLeast(Math.min(box.width, box.height), 24, "target size");
    }
  });

  it("takes text color, font and accent from the page theme", async function () {
    const wrap = document.createElement("div");
    wrap.style.cssText = "--ww-text-color: rgb(1, 2, 3); --ww-font-family: Courier, monospace; --ww-theme-accent-1: rgb(200, 10, 20)";
    wrap.innerHTML = `<webwriter-pages type="pages">${pages(2)}</webwriter-pages>`;
    document.body.append(wrap);
    const widget = wrap.firstElementChild as any;
    await widget.updateComplete;
    await until(() => widget.shadowRoot.querySelector(".page-thumb"), "thumbs");
    try {
      assert.equal(getComputedStyle(widget).color, "rgb(1, 2, 3)");
      assert.include(getComputedStyle(widget).fontFamily, "Courier");
      assert.equal(getComputedStyle(widget.shadowRoot.querySelector(".page-thumb.active")).borderTopColor, "rgb(200, 10, 20)");
      assert.equal(getComputedStyle(widget.shadowRoot.querySelector(".pages-index")).color, "rgb(1, 2, 3)");
    } finally {
      wrap.remove();
    }
  });

  it("keeps pages at 16:9 across widths even when their content overflows", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(2)}</webwriter-pages>`);
    widget.querySelector("webwriter-page")!.innerHTML = "<p>Long page content</p>".repeat(50);
    const box = widget.parentElement!;
    for (const width of [300, 720, 1099, 1100, 2400]) {
      box.style.width = `${width}px`;
      await frame(2);
      const rect = widget.getBoundingClientRect();
      assert.isAtMost(rect.width, 2100, `max at ${width}`);
      const page = widget.querySelector("webwriter-page[active]")!.getBoundingClientRect();
      assert.closeTo(page.width / page.height, 16 / 9, 0.01, `page ratio at ${width}`);
      assert.isAtMost(widget.scrollWidth, rect.width + 1, `no sideways overflow at ${width}`);
    }
  });

  it("applies saved and external orientation changes to both layouts and their preview cards", async function () {
    const widget = await mount(`<webwriter-pages orientation="portrait">${pages(2)}</webwriter-pages>`);
    assert.equal(widget.orientation, "portrait");
    for(const type of ["tabs", "pages"] as const) {
      widget.type = type;
      for(const orientation of ["portrait", "landscape"] as const) {
        widget.setAttribute("orientation", orientation);
        await widget.updateComplete;
        for(const width of [300, 720, 1100]) {
          widget.parentElement!.style.width = `${width}px`;
          await frame(2);
          const page = widget.querySelector("webwriter-page[active]")!.getBoundingClientRect();
          const ratio = orientation === "portrait" ? 9 / 16 : 16 / 9;
          assert.closeTo(page.width / page.height, ratio, 0.01, `${type}/${orientation}/${width}`);
          for(const card of items(widget, ".page-thumb")) {
            const box = card.getBoundingClientRect();
            assert.closeTo(box.width / box.height, ratio, 0.01, "preview matches page orientation");
          }
          assert.isAtMost(widget.scrollWidth, widget.getBoundingClientRect().width + 1, "no sideways overflow");
        }
      }
    }
    widget.orientation = "portrait";
    await widget.updateComplete;
    assert.equal(widget.getAttribute("orientation"), "portrait");
    const restored = await mount(widget.outerHTML);
    assert.equal(restored.orientation, "portrait", "orientation survives saving and reopening");
    widget.removeAttribute("orientation");
    await widget.updateComplete;
    assert.equal(widget.orientation, "landscape", "removing the attribute restores the default");
  });

  it("fits fullscreen pages below the actual tab toolbar and colors the surrounding space", async function () {
    const widget = await mount(`<webwriter-pages type="tabs">${pages(3)}</webwriter-pages>`);
    widget.classList.add("ww-fullscreen");
    widget.style.fontSize = "32px";
    const pane = items(widget, '[part="tabs"]')[0];
    pane.style.paddingBlock = "2rem";
    for (const orientation of ["landscape", "portrait"] as const) {
      widget.orientation = orientation;
      await widget.updateComplete;
      for (const [width, height] of [[900, 400], [400, 800]]) {
        widget.style.width = `${width}px`;
        widget.style.height = `${height}px`;
        await frame(2);
        const host = widget.getBoundingClientRect();
        const toolbar = pane.getBoundingClientRect();
        const page = widget.querySelector("webwriter-page[active]")!.getBoundingClientRect();
        assert.closeTo(page.width / page.height, orientation === "portrait" ? 9 / 16 : 16 / 9, 0.01, "page ratio");
        assert.isAtLeast(page.top, toolbar.bottom - 1, "page stays below toolbar");
        assert.isAtMost(page.bottom, host.bottom + 1, "page fits vertically");
        assert.isAtLeast(page.left, host.left - 1, "page fits on the left");
        assert.isAtMost(page.right, host.right + 1, "page fits on the right");
        assert.closeTo(page.top - toolbar.bottom, host.bottom - page.bottom, 1, "unused vertical space is balanced");
        assert.equal(getComputedStyle(widget).backgroundColor, getComputedStyle(pane).backgroundColor, "letterbox uses the panel color");
      }
    }
  });

  it("scrolls previews vertically beside a wide page and returns them below a narrow page", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(12)}</webwriter-pages>`);
    widget.parentElement!.style.width = "1100px";
    await frame(2);
    const strip = items(widget, ".page-thumbs")[0];
    const pane = items(widget, '[part="actions"]')[0];
    const page = widget.querySelector("webwriter-page[active]")!;
    assert.closeTo(pane.getBoundingClientRect().left, page.getBoundingClientRect().right, 1);
    assert.closeTo(pane.getBoundingClientRect().height, page.getBoundingClientRect().height, 1);
    assert.isAbove(strip.scrollHeight, strip.clientHeight, "preview list overflows vertically");
    strip.scrollTop = strip.scrollHeight;
    assert.isAbove(strip.scrollTop, 0, "preview list can scroll");
    const button = items<HTMLButtonElement>(widget, "button.page-select").at(-1)!;
    button.focus();
    button.click();
    await until(() => widget.activePageIndex === 11, "last preview selected");
    assert.closeTo(pane.getBoundingClientRect().bottom, widget.getBoundingClientRect().bottom, 1);
    widget.parentElement!.style.width = "720px";
    await frame(2);
    assert.closeTo(pane.getBoundingClientRect().top, widget.querySelector("webwriter-page[active]")!.getBoundingClientRect().bottom, 1);
    assert.isAbove(strip.scrollWidth, strip.clientWidth, "preview list now scrolls horizontally");
  });

  it("uses native title tooltips and retains accessible labels in both layouts", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(3)}</webwriter-pages>`);
    for (const type of ["pages", "tabs"] as const) {
      widget.type = type;
      await widget.updateComplete;
      assert.isNull(widget.shadowRoot!.querySelector("sl-tooltip, sl-popup"), "no custom tooltip elements");
      for (const button of items<HTMLElement>(widget, "sl-icon-button")) {
        assert.isNotEmpty(button.title, "native title");
        assert.equal(button.title, button.getAttribute("label"), "tooltip matches accessible label");
      }
    }
  });

  it("scrolls long tab lists without changing the page and updates the chevrons at each edge", async function () {
    const widget = await mount(`<webwriter-pages type="tabs">${pages(12)}</webwriter-pages>`);
    widget.parentElement!.style.width = "360px";
    const scroller = items(widget, ".page-tabs-wrapper")[0];
    const backward = items<any>(widget, ".tabs-scroll-backward")[0];
    const forward = items<any>(widget, ".tabs-scroll-forward")[0];
    await until(() => !forward.disabled, "forward scrolling available");
    assert.isTrue(backward.disabled, "backward disabled at start");
    assert.isNull(widget.shadowRoot!.querySelector(".pages-index"), "tabs have no page pagination");
    forward.click();
    await until(() => scroller.scrollLeft > 0, "tab list scrolled forward");
    assert.equal(widget.activePageIndex, 0, "scrolling does not select another page");
    scroller.scrollLeft = scroller.scrollWidth;
    await until(() => forward.disabled && !backward.disabled, "forward disabled at end");
    const end = scroller.scrollLeft;
    backward.click();
    await until(() => scroller.scrollLeft < end, "tab list scrolled backward");
    assert.equal(widget.activePageIndex, 0);
    widget.parentElement!.style.width = "2400px";
    await until(() => backward.disabled && forward.disabled, "both disabled when the list fits");
    widget.dir = "rtl";
    widget.parentElement!.style.width = "360px";
    await until(() => !forward.disabled, "RTL list overflows");
    scroller.scrollLeft = 0;
    forward.click();
    await until(() => scroller.scrollLeft < 0, "RTL list scrolls in reading direction");
    assert.equal(widget.activePageIndex, 0);
  });

  it("refreshes tab scrolling after direct DOM changes and reconnection", async function () {
    const widget = await mount(`<webwriter-pages type="tabs">${pages(1)}</webwriter-pages>`);
    const parent = widget.parentElement!;
    parent.style.width = "360px";
    const forward = () => items<any>(widget, ".tabs-scroll-forward")[0];
    await until(() => forward().disabled, "single tab fits");
    widget.insertAdjacentHTML("beforeend", pages(12).replaceAll('id="s', 'id="r'));
    await until(() => !forward().disabled, "directly inserted tabs overflow");
    [...widget.children].slice(1).forEach(child => child.remove());
    await until(() => forward().disabled, "removed tabs fit again");
    widget.remove();
    parent.append(widget);
    widget.insertAdjacentHTML("beforeend", pages(12).replaceAll('id="s', 'id="r'));
    await until(() => !forward().disabled, "scroll state resumes after reconnection");
    assert.equal(widget.activePageIndex, 0);
  });

  it("follows the mode when the contenteditable attribute changes", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(3)}</webwriter-pages>`);
    assert.equal(items(widget, "[data-ww-drag]").length, 0);
    widget.setAttribute("contenteditable", "");
    await until(() => items(widget, "[data-ww-drag]").length === 3, "markers after entering edit mode");
    widget.removeAttribute("contenteditable");
    await until(() => items(widget, "[data-ww-drag]").length === 0, "markers after leaving edit mode");
  });

  it("leaves no listener behind when a sequence of pages is removed", async function () {
    const widget = await mount(`<webwriter-pages type="pages">${pages(2)}</webwriter-pages>`);
    widget.parentElement!.remove();
    await frame(2);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    assert.equal(widget.activePageIndex, 0);
  });
});

mocha.run();
