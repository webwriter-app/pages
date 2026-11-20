/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-pages";
import "../src/widgets/webwriter-page";
import { frame, items, mount, pages, steps, unmountAll, until } from "./helpers";
import type { WebwriterPages } from "../src/widgets/webwriter-pages";
import type { PagesBranches } from "../src/components/pages-branches";
import { pageKey, readBranches } from "../src/model/page-branches";
import snippet from "../snippets/branching-scenario.html";
import { testBranchModel } from "./branches-model";

mocha.setup(getMochaConfig());
testBranchModel();

describe("Pages Branches view", function () {
    beforeEach(() => { document.designMode = "off"; });
    afterEach(() => { unmountAll(); document.designMode = "off"; });
    const authorSnippet = () => snippet.replace("<webwriter-pages ", '<webwriter-pages contenteditable="true" ');
    const editor = async (widget: WebwriterPages) => {
        const element = await until(() => widget.shadowRoot!.querySelector<PagesBranches>("pages-branches"));
        if (element.hidden) {
            widget.shadowRoot!.querySelector<HTMLButtonElement>(".graph-toggle")!.click();
            await widget.updateComplete;
        }
        await element.updateComplete;
        await until(() => element.shadowRoot!.querySelector("ww-node")?.getBoundingClientRect().width, "nodes laid out");
        await (element.shadowRoot!.querySelector("ww-scene") as any).ready;
        await frame(2);
        return element;
    };
    const control = <T extends HTMLElement = HTMLButtonElement>(element: Element, selector: string) => element.shadowRoot!.querySelector<T>(selector)!;
    const choices = (widget: WebwriterPages) => items<HTMLButtonElement>(widget, ".branch-choice");
    const sceneEvent = (element: Element, name: string, detail: unknown) => element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: true }));

    it("inserts the basic scenario and lets readers follow choices without exposing the graph", async function () {
        const widget = await mount(snippet);
        assert.equal(widget.type, "branches");
        assert.equal(widget.children.length, 3);
        assert.isNull(widget.shadowRoot!.querySelector("pages-branches"));
        assert.isNotNull(widget.shadowRoot!.querySelector(".branch-controls .branch-fullscreen #fullscreen"));
        widget.completionIndicators = true;
        await widget.updateComplete;
        assert.isNull(widget.shadowRoot!.querySelector(".completion-overview"), "completion remains hidden");
        assert.isNotNull(widget.shadowRoot!.querySelector(".branch-controls .branch-choices"), "choices use the bottom bar");
        assert.equal(items(widget, ".page-tab, .page-thumb, .pages-index").length, 0);
        assert.deepEqual(choices(widget).map((button) => button.textContent!.trim()), ["Explore the first path", "Explore the second path"]);
        choices(widget)[0].click();
        await until(() => widget.activePageIndex === 1, "first choice navigates");
        await frame(3);
        assert.equal(widget.shadowRoot!.activeElement, control(widget, ".page-stage"), "keyboard reading follows the page");
        assert.equal(choices(widget)[0].textContent!.trim(), "Start again");
        choices(widget)[0].click();
        await until(() => widget.activePageIndex === 0, "cycle returns to start");
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
        assert.equal(widget.activePageIndex, 0, "linear keyboard navigation cannot bypass choices");
    });

    it("starts readers at the saved start page without changing authored routing", async function () {
        const widget = await mount(snippet.replace('start-page="start"', 'start-page="second-path"'));
        await until(() => widget.activePageIndex === 2, "saved start page selected");
        const routing = [...widget.children].map((page) => [page.getAttribute("page-key"), page.getAttribute("branches")]);
        choices(widget)[0].click();
        await until(() => widget.activePageIndex === 0);
        assert.deepEqual([...widget.children].map((page) => [page.getAttribute("page-key"), page.getAttribute("branches")]), routing);
    });

    it("keeps page activation out of authored markup and editor history", async function () {
        const widget = await mount(authorSnippet()), graph = await editor(widget), scene = control(graph, "ww-scene");
        const mutations: MutationRecord[] = [];
        const observer = new MutationObserver(records => mutations.push(...records));
        observer.observe(widget, { attributes: true, subtree: true, attributeFilter: ["active", "thumbnail"] });
        sceneEvent(scene, "ww-activate", { key: "second-path", via: "keyboard", count: 1 });
        await until(() => widget.activePageIndex === 2);
        await frame(3);
        await new Promise(resolve => setTimeout(resolve, 200));
        assert.isTrue(widget.activePage.matches(":state(ww-page-active)"));
        assert.isFalse((widget.children[0] as HTMLElement).matches(":state(ww-page-active)"));
        assert.isEmpty([...mutations, ...observer.takeRecords()], "navigation and unused previews produce no authored attribute writes");
        observer.disconnect();
    });

    it("uses Scene nodes in edit mode and navigates only on activation", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget);
        assert.equal(graph.shadowRoot!.querySelectorAll("ww-node").length, 3);
        assert.equal(graph.shadowRoot!.querySelectorAll("ww-path").length, 4);
        assert.isNull(graph.shadowRoot!.querySelector(".page-settings"), "no separate label input row");
        assert.isNotNull(widget.shadowRoot!.querySelector(".branch-controls #fullscreen"));
        assert.isNotNull(graph.shadowRoot!.querySelector('ww-node[data-ww-key="start"] .node-label-input'));
        const scene = control(graph, "ww-scene");
        sceneEvent(scene, "ww-select", { keys: ["second-path"], items: [] });
        await graph.updateComplete;
        assert.equal(widget.activePageIndex, 0, "focus/selection alone does not navigate");
        sceneEvent(scene, "ww-activate", { key: "second-path", via: "keyboard", count: 1 });
        await until(() => widget.activePageIndex === 2, "activation opens the authored page");
        assert.isTrue((widget.children[2] as any).active);
        const field = control<HTMLInputElement>(graph, ".node-label-input");
        field.value = "A different ending";
        field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
        await until(() => widget.children[2].getAttribute("label") === "A different ending");
        await until(() => control<HTMLInputElement>(graph, '.node-label-input').value === "A different ending");
    });

    it("keeps labels and node geometry stable while selection reveals the start action", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget), scene = control<any>(graph, "ww-scene");
        await scene.ready;
        await frame(3);
        const node = control(graph, 'ww-node[data-ww-key="first-path"]');
        const start = control(graph, 'ww-node[data-ww-key="start"] .node-start');
        const button = node.querySelector<HTMLElement>(".node-start")!;
        const snapshot = () => {
            const label = node.querySelector<HTMLElement>(".node-label, .node-label-input")!;
            const box = node.getBoundingClientRect(), rect = label.getBoundingClientRect();
            const style = getComputedStyle(label);
            return { width: box.width, height: box.height, left: rect.left - box.left, top: rect.top - box.top,
                labelWidth: rect.width, labelHeight: rect.height, font: style.font, color: style.color };
        };
        for (const label of ["A long page label that exceeds the node width", ""]) {
            widget.children[1].setAttribute("label", label);
            sceneEvent(scene, "ww-activate", { key: "start", via: "keyboard", count: 1 });
            await until(() => widget.activePageIndex === 0);
            await graph.updateComplete;
            await frame(2);
            const before = snapshot();
            assert.equal(getComputedStyle(button).visibility, "hidden", "unselected non-start action is hidden");
            sceneEvent(scene, "ww-select", { keys: ["first-path"], items: [] });
            await graph.updateComplete;
            assert.equal(getComputedStyle(button).visibility, "visible", "selection reveals the action");
            assert.deepEqual(snapshot(), before, "selection changes neither the label nor node geometry");
            assert.equal(getComputedStyle(start).visibility, "visible", "start page indicator stays visible while unselected");
            sceneEvent(scene, "ww-activate", { key: "first-path", via: "keyboard", count: 1 });
            await until(() => widget.activePageIndex === 1);
            await graph.updateComplete;
            await frame(2);
            assert.deepEqual(snapshot(), before, "editable label has identical typography and geometry");
            const input = node.querySelector<HTMLInputElement>(".node-label-input")!;
            assert.equal(getComputedStyle(input, "::placeholder").color, before.color, "default labels keep the same color");
            assert.equal(getComputedStyle(input, "::placeholder").opacity, "1");
        }
    });

    it("fills proportional cards with private previews, routing-aware labels and start bubbles", async function () {
        this.timeout(20000);
        const widget = await mount(authorSnippet()), graph = await editor(widget);
        const original = widget.innerHTML;
        const first = control<HTMLElement>(graph, 'ww-node[data-ww-key="start"]');
        await until(() => graph.shadowRoot!.querySelectorAll(".node-preview").length === 3, "all pages previewed", 15000);
        for (const node of graph.shadowRoot!.querySelectorAll<HTMLElement>("ww-node")) {
            const box = node.querySelector<HTMLElement>(".node-card")!.getBoundingClientRect(), image = node.querySelector<HTMLImageElement>(".node-preview")!;
            await image.decode();
            assert.closeTo(box.width / box.height, 16 / 9, 0.02, "card matches the page ratio");
            assert.closeTo(image.naturalWidth / image.naturalHeight, 16 / 9, 0.02, "capture matches the page ratio");
            assert.closeTo(image.getBoundingClientRect().height, box.height - 2, 3, "preview fills the card");
            const start = node.querySelector<HTMLElement>(".node-start")!, label = node.querySelector<HTMLElement>(".node-label-overlay")!;
            assert.equal(getComputedStyle(start).position, "absolute");
            assert.isBelow(start.getBoundingClientRect().left, box.left + 2, "start action overlaps bottom left");
            assert.isAbove(start.getBoundingClientRect().bottom, box.bottom, "start action overlaps bottom edge");
            assert.equal(start.textContent!.trim(), "", "start action is icon-only");
            assert.isNotNull(start.querySelector("sl-icon"));
            assert.isAtMost(label.getBoundingClientRect().bottom, box.top, "label sits above the preview");
            const outer = node.getBoundingClientRect(), labelBox = label.getBoundingClientRect();
            assert.isAtMost(outer.top, labelBox.top, "routing box contains the label");
            assert.isAtLeast(outer.bottom, box.bottom, "routing box contains the preview");
            assert.include(getComputedStyle(label).backgroundColor, "0.8", "label background is translucent");
            assert.include(decodeURIComponent(node.querySelector(".node-open sl-icon")!.getAttribute("src")!), "icon-tabler-share-3", "open icon matches advance organizer");
        }
        assert.equal(widget.innerHTML, original, "captures never write authored markup");
        const before = first.querySelector<HTMLImageElement>(".node-preview")!.src;
        widget.children[0].querySelector("h2")!.textContent = "A changed heading";
        await until(() => first.querySelector<HTMLImageElement>(".node-preview")!.src !== before, "content edit refreshes preview");
        widget.pageAspectRatio = 4 / 3;
        await widget.updateComplete;
        await until(async () => {
            const image = first.querySelector<HTMLImageElement>(".node-preview")!;
            await image.decode();
            return Math.abs(image.naturalWidth / image.naturalHeight - 4 / 3) < 0.02;
        }, "ratio change refreshes captures");
        const card = first.querySelector<HTMLElement>(".node-card")!.getBoundingClientRect();
        assert.closeTo(card.width / card.height, 4 / 3, 0.02);
        const hidden = widget.children[1] as HTMLElement;
        assert.equal(getComputedStyle(hidden).display, "block", "inactive pages are laid out behind the inert graph");
        control<HTMLButtonElement>(widget, ".graph-toggle").click();
        await widget.updateComplete;
        assert.equal(getComputedStyle(hidden).display, "none", "closing restores inactive page hiding");
    });

    it("starts collapsed and overlays the page without moving choices or changing widget height", async function () {
        const widget = await mount(authorSnippet());
        const graph = await until(() => widget.shadowRoot!.querySelector<PagesBranches>("pages-branches"));
        await graph.updateComplete;
        assert.isNull(graph.shadowRoot!.querySelector(".help"), "no permanent editing hint");
        const toggle = control<HTMLButtonElement>(widget, ".branch-controls .graph-toggle");
        const controls = control(widget, ".branch-controls");
        const stage = control(widget, ".page-stage");
        assert.equal(controls.firstElementChild!.className, "branch-choices", "choices start the row");
        assert.equal(controls.lastElementChild!.className, "branch-tools", "controls end the row");
        assert.equal(toggle.nextElementSibling!.className, "branch-fullscreen");
        assert.isAtLeast(control(widget, "#fullscreen").getBoundingClientRect().top, toggle.getBoundingClientRect().bottom, "chevron sits above fullscreen");
        assert.equal(graph.parentElement, stage, "graph belongs to the page stage");
        assert.isAtLeast(controls.getBoundingClientRect().top, stage.getBoundingClientRect().bottom - 1, "choices remain below the page");
        const height = widget.getBoundingClientRect().height;
        const controlsTop = controls.getBoundingClientRect().top;
        assert.isNull(graph.shadowRoot!.querySelector("summary"), "no separate labelled row");
        assert.equal(toggle.textContent!.trim(), "", "icon-only toggle");
        assert.isNotNull(toggle.querySelector('sl-icon[aria-hidden="true"]'));
        assert.isTrue(graph.hidden, "graph is collapsed initially");
        assert.equal(toggle.getAttribute("aria-expanded"), "false");
        assert.equal(toggle.getAttribute("aria-label"), "Expand graph");
        const collapsedIcon = toggle.querySelector("sl-icon")!.getAttribute("src");
        toggle.click();
        await widget.updateComplete;
        await graph.updateComplete;
        await frame(3);
        assert.isFalse(graph.hidden);
        assert.equal(toggle.getAttribute("aria-expanded"), "true");
        assert.equal(toggle.getAttribute("aria-label"), "Collapse graph");
        assert.notEqual(toggle.querySelector("sl-icon")!.getAttribute("src"), collapsedIcon, "chevron reverses when opened");
        assert.equal(widget.shadowRoot!.getElementById(toggle.getAttribute("aria-controls")!), graph);
        const overlay = graph.getBoundingClientRect(), page = stage.getBoundingClientRect();
        for (const edge of ["left", "right", "top", "bottom"] as const) assert.closeTo(overlay[edge], page[edge], 1, `overlay fills the page at ${edge}`);
        assert.equal(getComputedStyle(graph).position, "absolute");
        assert.closeTo(widget.getBoundingClientRect().height, height, 1, "opening adds no widget height");
        assert.closeTo(controls.getBoundingClientRect().top, controlsTop, 1, "choices do not move");
        toggle.click();
        await frame(2);
        assert.isTrue(graph.hidden);
        assert.equal(toggle.getAttribute("aria-expanded"), "false");
        assert.equal(toggle.getAttribute("aria-label"), "Expand graph");
        assert.closeTo(widget.getBoundingClientRect().height, height, 1, "closing preserves the layout");
        assert.equal(toggle.querySelector("sl-icon")!.getAttribute("src"), collapsedIcon);
        assert.isNull(graph.shadowRoot!.querySelector(".toolbar"), "old toolbar is removed");
        assert.equal(control(graph, ".view-controls").getBoundingClientRect().height, 0, "floating controls are also hidden");
        assert.equal(control(graph, "ww-scene").getBoundingClientRect().height, 0, "scene is also hidden");
        assert.isAbove(control(widget, "#fullscreen").getBoundingClientRect().height, 0, "fullscreen remains visible");
        control(widget, ".choice-goto").click();
        await until(() => widget.activePageIndex === 1);
        await frame(2);
        assert.isTrue(graph.hidden, "page navigation does not reopen the graph");
        toggle.click();
        await frame(3);
        assert.isFalse(graph.hidden);
        assert.equal(toggle.getAttribute("aria-expanded"), "true");
        assert.equal(graph.shadowRoot!.querySelectorAll("ww-node").length, 3);
        assert.deepEqual(readBranches(widget.children[0]).map((branch) => branch.target), ["first-path", "second-path"]);
    });

    it("fits the initial narrow graph and keeps its nodes visible after reopening", async function () {
        const widget = await mount(authorSnippet());
        widget.parentElement!.style.width = "360px";
        await frame(2);
        const graph = await editor(widget), scene = control<any>(graph, "ww-scene");
        await frame(4);
        const boxes = () => [...scene.querySelectorAll("ww-node")].map((node: Element) => {
            const box = node.getBoundingClientRect(), frame = scene.getBoundingClientRect();
            assert.isAtLeast(box.left, frame.left - 0.5);
            assert.isAtMost(box.right, frame.right + 0.5);
            assert.isAtLeast(box.top, frame.top - 0.5);
            assert.isAtMost(box.bottom, frame.bottom + 0.5);
            return [box.x, box.y, box.width, box.height];
        });
        const initial = boxes();
        control<HTMLButtonElement>(widget, ".graph-toggle").click();
        await frame(2);
        control<HTMLButtonElement>(widget, ".graph-toggle").click();
        await frame(4);
        assert.deepEqual(boxes(), initial, "reopening uses the same fitted view");
    });

    it("opens pages only through node bubbles and leaves single and double activation in the graph", async function () {
        const widget = await mount(authorSnippet()), graph = await editor(widget), scene = control(graph, "ww-scene");
        for (const node of graph.shadowRoot!.querySelectorAll("ww-node")) {
            const open = node.querySelector<HTMLButtonElement>(".node-open")!;
            assert.equal(getComputedStyle(open).visibility, "visible", "every page can be opened without selecting it");
            assert.isNotEmpty(open.getAttribute("aria-label")!);
            assert.equal(open.textContent!.trim(), "", "open bubble is icon-only");
            assert.include(decodeURIComponent(open.querySelector("sl-icon")!.getAttribute("src")!), "icon-tabler-share-3", "same open-page icon as advance organizer");
            const box = node.querySelector<HTMLElement>(".node-card")!.getBoundingClientRect(), bubble = open.getBoundingClientRect();
            assert.isAbove(bubble.left, box.left + box.width / 2, "open bubble is on the right");
            assert.isBelow(bubble.top, box.top + box.height / 2, "open bubble is at the top");
        }
        for (const [count, key, index] of [[1, "first-path", 1], [2, "second-path", 2]] as const) {
            sceneEvent(scene, "ww-activate", { key, via: "pointer", count });
            await until(() => widget.activePageIndex === index);
            await frame(2);
            assert.isFalse(graph.hidden, `activation count ${count} keeps the graph open`);
        }
        const authored = widget.outerHTML;
        control(graph, 'ww-node[data-ww-key="first-path"] .node-open').click();
        await until(() => graph.hidden && widget.activePageIndex === 1, "bubble opens the page and closes the overlay");
        await frame(2);
        const selection = document.getSelection()!;
        assert.isTrue(selection.isCollapsed);
        assert.equal(selection.anchorNode, widget.activePage.querySelector("h2")!.firstChild, "caret moves to the beginning of page content");
        assert.equal(selection.anchorOffset, 0);
        assert.equal(widget.outerHTML, authored, "navigation does not write authored settings");
    });

    it("creates pages with stable keys and keeps the final page required", async function () {
        const widget = await mount(`<webwriter-pages type="branches" contenteditable="true">${pages(1)}</webwriter-pages>`);
        const graph = await editor(widget);
        const initialKey = pageKey(widget.children[0]);
        assert.isNotEmpty(initialKey);
        assert.isTrue(control<HTMLButtonElement>(graph, ".remove-node").disabled);
        control(graph, ".add-node").click();
        await until(() => widget.children.length === 2 && pageKey(widget.children[1]), "new page and key");
        assert.notEqual(pageKey(widget.children[1]), initialKey);
        assert.equal(widget.activePageIndex, 1);
        assert.isNotNull(widget.children[1].querySelector("p"));
        widget.duplicateActivePage();
        await until(() => widget.children.length === 3 && pageKey(widget.children[2]));
        assert.equal(new Set([...widget.children].map(pageKey)).size, 3, "duplicate gets its own routing identity");
    });

    it("can create the first page in an initially empty authoring widget", async function () {
        const widget = await mount('<webwriter-pages type="branches" contenteditable="true"></webwriter-pages>');
        const graph = control<PagesBranches>(widget, "pages-branches");
        control(widget, ".graph-toggle").click();
        await widget.updateComplete;
        await graph.updateComplete;
        control(graph, ".add-node").click();
        await until(() => widget.children.length === 1 && pageKey(widget.children[0]), "first page created");
        assert.isNotNull(widget.children[0].querySelector("p"));
    });

    it("adds and edits choices in button popovers without navigating", async function () {
        const widget = await mount(`<webwriter-pages type="branches" contenteditable="true">${pages(3)}</webwriter-pages>`);
        await editor(widget);
        const open = () => control<HTMLDialogElement>(widget, ".choice-popover:popover-open");
        control(widget, ".add-choice").click();
        const popup = open();
        assert.isNotNull(popup);
        assert.lengthOf(readBranches(widget.children[0]), 0, "opening + does not save a choice");
        popup.querySelector<HTMLSelectElement>("select")!.value = pageKey(widget.children[1]);
        popup.querySelector<HTMLInputElement>('input')!.value = "Continue to the activity";
        popup.querySelector<HTMLButtonElement>(".choice-save")!.click();
        await until(() => choices(widget).length === 1, "choice saved");
        assert.equal(readBranches(widget.children[0])[0].target, pageKey(widget.children[1]));
        assert.equal(widget.activePageIndex, 0);
        assert.equal(control(widget, ".branch-choices").lastElementChild!.previousElementSibling!.className, "add-choice", "+ follows all choice buttons");
        choices(widget)[0].click();
        const edit = open();
        assert.equal(edit.querySelector<HTMLInputElement>("input")!.value, "Continue to the activity");
        edit.querySelector<HTMLInputElement>("input")!.value = "See the ending";
        edit.querySelector<HTMLSelectElement>("select")!.value = pageKey(widget.children[2]);
        edit.querySelector<HTMLButtonElement>(".choice-save")!.click();
        await until(() => readBranches(widget.children[0])[0].target === pageKey(widget.children[2]));
        assert.equal(readBranches(widget.children[0])[0].label, "See the ending");
        assert.equal(widget.activePageIndex, 0, "editing never navigates");
        widget.removeAttribute("contenteditable");
        await until(() => !widget.shadowRoot!.querySelector("pages-branches"));
        assert.isNull(widget.shadowRoot!.querySelector(".choice-popover, .choice-goto, .add-choice"));
        choices(widget)[0].click();
        await until(() => widget.activePageIndex === 2, "reader buttons navigate directly");
    });

    it("defaults to a new empty destination and saves its choice in one transaction", async function () {
        const widget = await mount(`<webwriter-pages type="branches" contenteditable="true">${pages(1)}</webwriter-pages>`);
        await editor(widget);
        control(widget, ".add-choice").click();
        const popup = control<HTMLDialogElement>(widget, ".choice-popover:popover-open");
        const destination = popup.querySelector<HTMLSelectElement>("select")!;
        const input = popup.querySelector<HTMLInputElement>("input")!;
        assert.equal(destination.selectedOptions[0].textContent, "New page");
        assert.equal(input.value, "");
        assert.equal(input.placeholder, "Page 2");
        assert.deepEqual([...popup.querySelectorAll("form label")].map(el => [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim()), ["Destination", "Label"]);
        const log = steps(widget);
        popup.querySelector<HTMLButtonElement>(".choice-save")!.click();
        await until(() => widget.children.length === 2 && readBranches(widget.children[0]).length === 1);
        await frame(3);
        const target = widget.children[1];
        assert.equal(target.innerHTML, "<p></p>");
        assert.equal(readBranches(widget.children[0])[0].target, pageKey(target));
        assert.equal(readBranches(widget.children[0])[0].label, "", "blank label stays inherited");
        assert.equal(choices(widget)[0].textContent!.trim(), "Page 2");
        assert.equal(widget.activePageIndex, 0, "creating a destination keeps the source page active");
        assert.deepEqual(log.stop(), ["transactionstart", "transactionend"]);
    });

    it("inherits destination labels and updates the placeholder when destinations change", async function () {
        const widget = await mount(`<webwriter-pages type="branches" contenteditable="true">${pages(3)}</webwriter-pages>`);
        await editor(widget);
        widget.children[1].setAttribute("label", "Activity");
        await frame(2);
        control(widget, ".add-choice").click();
        const popup = control<HTMLDialogElement>(widget, ".choice-popover:popover-open");
        const select = popup.querySelector<HTMLSelectElement>("select")!, input = popup.querySelector<HTMLInputElement>("input")!;
        select.value = pageKey(widget.children[1]);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        assert.equal(input.placeholder, "Activity");
        assert.equal(input.value, "", "placeholder is not authored text");
        popup.querySelector<HTMLButtonElement>(".choice-save")!.click();
        await until(() => choices(widget).length === 1);
        assert.equal(choices(widget)[0].textContent!.trim(), "Activity");
        widget.children[1].setAttribute("label", "Renamed activity");
        await until(() => choices(widget)[0].textContent!.trim() === "Renamed activity");
        choices(widget)[0].click();
        const edit = control<HTMLDialogElement>(widget, ".choice-popover:popover-open");
        assert.equal(edit.querySelector<HTMLInputElement>("input")!.value, "");
        assert.equal(edit.querySelector<HTMLInputElement>("input")!.placeholder, "Renamed activity");
        edit.querySelector<HTMLSelectElement>("select")!.value = pageKey(widget.children[2]);
        edit.querySelector<HTMLSelectElement>("select")!.dispatchEvent(new Event("change", { bubbles: true }));
        assert.equal(edit.querySelector<HTMLInputElement>("input")!.placeholder, "Page 3");
        edit.querySelector<HTMLButtonElement>(".choice-save")!.click();
        await until(() => choices(widget)[0].textContent!.trim() === "Page 3");
        widget.removeAttribute("contenteditable");
        await until(() => !widget.shadowRoot!.querySelector("pages-branches"));
        assert.equal(choices(widget)[0].textContent!.trim(), "Page 3", "read mode uses the destination name too");
    });

    it("keeps choice drafts transient, resets them on reopening and removes via the popup", async function () {
        const widget = await mount(authorSnippet());
        await editor(widget);
        const page = widget.children[0], before = page.getAttribute("branches");
        choices(widget)[0].click();
        const popup = control<HTMLDialogElement>(widget, ".choice-popover:popover-open");
        popup.querySelector<HTMLInputElement>("input")!.value = "Unsaved draft";
        widget.requestUpdate();
        await widget.updateComplete;
        assert.equal(popup.querySelector<HTMLInputElement>("input")!.value, "Unsaved draft", "render preserves draft");
        popup.querySelector<HTMLButtonElement>(".choice-close")!.click();
        assert.equal(page.getAttribute("branches"), before);
        await frame();
        assert.equal(widget.shadowRoot!.activeElement, choices(widget)[0], "closing restores focus");
        choices(widget)[0].click();
        assert.equal(popup.querySelector<HTMLInputElement>("input")!.value, "Explore the first path");
        popup.querySelector<HTMLButtonElement>(".remove-choice")!.click();
        await until(() => choices(widget).length === 1);
        assert.equal(readBranches(page)[0].target, "second-path");
        assert.equal(widget.activePageIndex, 0);
        await frame();
        assert.equal(widget.shadowRoot!.activeElement, control(widget, ".add-choice"), "removing restores focus to the newly enabled +");
    });

    it("navigates using the circular overlay without opening the choice editor", async function () {
        const widget = await mount(authorSnippet());
        await editor(widget);
        const go = control<HTMLButtonElement>(widget, ".choice-goto");
        assert.equal(go.textContent!.trim(), "", "icon only");
        assert.include(go.getAttribute("aria-label")!, "First path");
        go.click();
        await until(() => widget.activePageIndex === 1);
        assert.isNull(widget.shadowRoot!.querySelector(":popover-open"));
        await frame();
        assert.equal(widget.shadowRoot!.activeElement, control(widget, ".page-stage"), "navigation focuses page content");
    });

    it("saves Scene connections and rejects duplicate, missing and self targets", async function () {
        const widget = await mount(`<webwriter-pages type="branches" contenteditable="true">${pages(2)}</webwriter-pages>`);
        const graph = await editor(widget), scene = control(graph, "ww-scene");
        const from = pageKey(widget.children[0]), to = pageKey(widget.children[1]);
        assert.isTrue(sceneEvent(scene, "ww-connect", { from: `${from}:out`, to: `${to}:in` }));
        await until(() => readBranches(widget.children[0]).length === 1);
        assert.isFalse(sceneEvent(scene, "ww-connect", { from: `${from}:out`, to: `${to}:in` }));
        assert.isFalse(sceneEvent(scene, "ww-connect", { from: `${from}:out`, to: "missing:in" }));
        assert.isFalse(sceneEvent(scene, "ww-connect", { from: `${from}:out`, to: `${from}:in` }));
        sceneEvent(scene, "ww-select", { keys: [`path:${from}:${to}`], items: [] });
        await graph.updateComplete;
        assert.isNull(graph.shadowRoot!.querySelector(".remove-connection"), "no separate connection-delete control");
        scene.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, composed: true }));
        await until(() => readBranches(widget.children[0]).length === 0);
    });

    it("floats viewport controls and limits delete bubbles to the selected node", async function () {
        const widget = await mount(authorSnippet()), graph = await editor(widget);
        await until(() => graph.shadowRoot!.querySelectorAll("[data-ww-viewport-action]").length === 4);
        const scene = control(graph, "ww-scene"), bar = control(graph, ".view-controls"), add = control(graph, ".add-node");
        assert.isNull(graph.shadowRoot!.querySelector(".toolbar"));
        assert.equal(bar.getAttribute("role"), "toolbar");
        assert.equal(getComputedStyle(bar).position, "absolute");
        assert.equal(getComputedStyle(bar).flexDirection, "row");
        assert.closeTo(bar.getBoundingClientRect().right, scene.getBoundingClientRect().right - 10, 1, "top-right controls");
        assert.closeTo(bar.getBoundingClientRect().top, scene.getBoundingClientRect().top + 10, 1);
        assert.isNotNull(bar.querySelector('[data-ww-viewport-action="fit"] sl-icon'), "fit uses a zoom-to-area icon");
        assert.closeTo(scene.getBoundingClientRect().height, graph.clientHeight, 1, "canvas fills the page overlay inside its border");
        assert.isNotNull(add.querySelector("sl-icon"));
        assert.equal(add.textContent!.trim(), "", "icon-only add");
        for(const key of ["start", "first-path"]) {
            sceneEvent(scene, "ww-select", { keys: [key], items: [] });
            await graph.updateComplete;
            for(const node of graph.shadowRoot!.querySelectorAll("ww-node")) {
                const remove = node.querySelector<HTMLElement>(".remove-node")!;
                assert.equal(getComputedStyle(remove).visibility, node.getAttribute("data-ww-key") === key ? "visible" : "hidden");
                if (node.getAttribute("data-ww-key") === key) {
                    const box = node.getBoundingClientRect(), bubble = remove.getBoundingClientRect();
                    assert.isAbove(bubble.left, box.left + box.width / 2, "delete bubble is on the right");
                    assert.isAbove(bubble.top, box.top + box.height / 2, "delete bubble is at the bottom");
                    const src = remove.querySelector("sl-icon")!.getAttribute("src")!;
                    const markup = src.includes(";base64,") ? atob(src.split(",")[1]) : decodeURIComponent(src);
                    assert.include(markup, "icon-tabler-trash", "delete uses a trash icon");
                }
            }
        }
        control(graph, 'ww-node[data-ww-key="first-path"] .remove-node').click();
        await until(() => widget.children.length === 2);
        assert.isFalse([...widget.children].some(page => pageKey(page) === "first-path"));
        assert.isFalse(readBranches(widget.children[0]).some(branch => branch.target === "first-path"), "incoming choices are removed too");
        sceneEvent(scene, "ww-select", { keys: [], items: [] });
        await graph.updateComplete;
        assert.equal(graph.shadowRoot!.querySelectorAll("ww-node[selected]").length, 0, "background clears node selection");
        assert.isTrue([...graph.shadowRoot!.querySelectorAll(".remove-node")].every(button => getComputedStyle(button).visibility === "hidden"));
        scene.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, composed: true }));
        assert.equal(widget.children.length, 2, "background Delete does not remove an unselected page");
    });

    it("adds pages at double-click and touch long-press positions as single transactions", async function () {
        const widget = await mount(authorSnippet()), graph = await editor(widget), scene = control(graph, "ww-scene");
        const background = (gesture: string, pointerType: string) => sceneEvent(scene, "ww-background", { gesture, pointerType, point: { x: 713, y: 277 } });
        background("click", "mouse");
        background("longpress", "mouse");
        assert.equal(widget.children.length, 3, "ordinary clicks and mouse holds do not insert");
        for(const [gesture, pointerType] of [["dblclick", "mouse"], ["longpress", "touch"]]) {
            const count = widget.children.length, log = steps(widget);
            background(gesture, pointerType);
            await until(() => widget.children.length === count + 1 && widget.activePageIndex === count);
            await frame(2);
            const page = widget.children[count];
            assert.equal(page.getAttribute("node-x"), "610");
            assert.equal(page.getAttribute("node-y"), "230");
            assert.isNotEmpty(pageKey(page));
            assert.equal(page.firstElementChild!.localName, "p");
            assert.deepEqual(log.stop(), ["transactionstart", "transactionend"]);
        }
    });

    it("reconnects either end, preserves choice data, and rejects invalid or duplicate destinations", async function () {
        const widget = await mount(authorSnippet()), graph = await editor(widget), scene = control(graph, "ww-scene");
        const source = widget.children[0], next = widget.children[1], third = widget.children[2];
        source.setAttribute("branches", '[{"target":"first-path","label":"Keep this label","custom":{"value":7}},{"target":"second-path","label":"Other"}]');
        await until(() => readBranches(source)[0].label === "Keep this label");
        await frame(2);
        const path = () => control<any>(graph, 'ww-path[data-ww-key="path:start:first-path"]');
        const rewire = (from: string, to: string) => sceneEvent(path(), "ww-reconnect", {
            path: path(), previous: { from: "start:out", to: "first-path:in" }, from, to,
        });
        assert.isFalse(rewire("start:out", "second-path:in"), "duplicate refused");
        assert.isFalse(rewire("first-path:out", "first-path:in"), "self-connection refused");
        assert.isFalse(rewire("missing:out", "first-path:in"));
        assert.isTrue(rewire("second-path:out", "first-path:in"), "source can move");
        await until(() => readBranches(third).some(branch => branch.target === "first-path"));
        assert.deepEqual(readBranches(third).at(-1), { target: "first-path", label: "Keep this label", custom: { value: 7 } });
        assert.deepEqual(readBranches(source).map(branch => branch.target), ["second-path"]);
        await frame(2);
        const moved = control<any>(graph, 'ww-path[data-ww-key="path:second-path:first-path"]');
        assert.equal(moved.getAttribute("rewire"), "from to", "only the selected connection exposes both endpoints");
        assert.isFalse(sceneEvent(moved, "ww-reconnect", { path: moved, previous: { from: "second-path:out", to: "first-path:in" }, from: "second-path:out", to: "start:in" }), "existing target refused");
        // Free a target, then reconnect the other end without losing the label or unfamiliar data.
        third.setAttribute("branches", JSON.stringify(readBranches(third).filter(branch => branch.target !== "start")));
        assert.isTrue(sceneEvent(moved, "ww-reconnect", { path: moved, previous: { from: "second-path:out", to: "first-path:in" }, from: "second-path:out", to: "start:in" }));
        await until(() => readBranches(third)[0]?.target === "start");
        assert.equal(readBranches(next)[0].target, "start", "other pages are untouched");
        await frame(2);
        const final = control<any>(graph, 'ww-path[data-ww-key="path:second-path:start"]');
        assert.isTrue(sceneEvent(final, "ww-disconnect", { path: final, from: "second-path:out", to: "start:in" }));
        await until(() => readBranches(third).length === 0);
    });

    it("routes connectors around nodes and reroutes after unrelated obstacles move", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget), scene = control<any>(graph, "ww-scene");
        await scene.ready;
        await frame(3);
        const extent = scene.extent(), frameBox = scene.getBoundingClientRect();
        const top = scene.toClient(extent.x, extent.y), bottom = scene.toClient(extent.x + extent.width, extent.y + extent.height);
        assert.isAtLeast(top.x, frameBox.left, "return routes fit inside the initial viewport");
        assert.isAtLeast(top.y, frameBox.top);
        assert.isAtMost(bottom.x, frameBox.right);
        assert.isAtMost(bottom.y, frameBox.bottom);
        const paths = [...scene.querySelectorAll("ww-path")] as any[];
        assert.isTrue(paths.every(path => path.route === "avoid"), "uses the SDK's optional avoidance route");
        for (const path of paths) {
            const drawing = scene.drawingOf(path), ends = scene.endsOf(path);
            for (const [end, point] of [[ends.from, drawing.points[0]], [ends.to, drawing.points.at(-1)]] as const) {
                const rect = end.element.getBoundingClientRect();
                const center = scene.toScene(rect.left + rect.width / 2, rect.top + rect.height / 2);
                assert.closeTo(point.x, center.x, 0.1, "connector reaches the port center horizontally");
                assert.closeTo(point.y, center.y, 0.1, "connector reaches the port center vertically");
            }
        }
        const clear = () => {
            for (const path of paths) {
                const drawing = scene.drawingOf(path);
                assert.isAbove(drawing.points.length, 1);
                for (const node of scene.querySelectorAll("ww-node")) {
                    const rect = node.getBoundingClientRect();
                    const topLeft = scene.toScene(rect.left, rect.top), bottomRight = scene.toScene(rect.right, rect.bottom);
                    const box = { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
                    for (let i = 1; i < drawing.points.length; i++) {
                        // Ports sit inside the node's one-pixel border; their
                        // own terminal segment is allowed to leave/enter it.
                        const ends = scene.endsOf(path);
                        if ((i === 1 && node === ends.from?.node) || (i === drawing.points.length - 1 && node === ends.to?.node)) continue;
                        const a = drawing.points[i - 1], b = drawing.points[i];
                        const crosses = Math.max(a.x, b.x) > box.x + 0.01 && Math.min(a.x, b.x) < box.x + box.width - 0.01
                            && Math.max(a.y, b.y) > box.y + 0.01 && Math.min(a.y, b.y) < box.y + box.height - 0.01;
                        assert.isFalse(crosses, `connector ${path.key} enters ${node.key}: ${JSON.stringify({ a, b, box })}`);
                    }
                }
            }
        };
        clear();
        const scope = { customElementRegistry: (graph.shadowRoot as any).customElementRegistry } as ElementCreationOptions;
        const blocker = document.createElement("ww-node", scope);
        blocker.setAttribute("data-ww-key", "obstacle");
        blocker.style.cssText = "inline-size: 40px; min-block-size: 100px; padding: 0";
        const group = document.createElement("ww-group", scope);
        const segment = paths.flatMap(path => {
            const points = scene.drawingOf(path).points;
            return points.slice(1).map((point: any, index: number) => ({ a: points[index], b: point }));
        }).sort((a, b) => Math.hypot(b.b.x - b.a.x, b.b.y - b.a.y) - Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y))[0];
        group.setAttribute("x", String((segment.a.x + segment.b.x) / 2 - 15));
        group.setAttribute("y", String((segment.a.y + segment.b.y) / 2 - 37.5));
        group.setAttribute("scale", "0.75");
        blocker.setAttribute("x", "0");
        blocker.setAttribute("y", "0");
        group.append(blocker);
        scene.append(group);
        await frame(3);
        clear();
        const routed = paths.map(path => scene.drawingOf(path).d);
        group.setAttribute("y", "-150");
        await frame(3);
        clear();
        assert.notDeepEqual(paths.map(path => scene.drawingOf(path).d), routed, "unattached obstacle invalidates routes");
        group.remove();
        await frame(3);
        clear();
        const stable = paths.map(path => scene.drawingOf(path).d);
        const searches = scene.stats.routed;
        for (let i = 0; i < 3; i++) { scene.restyle(); scene.flush(); }
        assert.equal(scene.stats.routed, searches, "style-only refreshes reuse cached route searches");
        assert.deepEqual(paths.map(path => scene.drawingOf(path).d), stable, "refreshes do not drift into new lanes");
        const snapshot = await scene.toSVG();
        for (const d of stable) assert.include(snapshot, d, "snapshot uses the same route geometry");
    });

    it("routes around an above-card label even when the preview does not block the direct path", async function () {
        const widget = await mount(authorSnippet());
        const [source, target, obstacle] = [...widget.children];
        source.setAttribute("branches", '[{"target":"first-path","label":"Continue"}]');
        target.removeAttribute("branches"); obstacle.removeAttribute("branches");
        for (const [page, x, y] of [[source, 40, 100], [target, 600, 100], [obstacle, 320, 184]] as const) {
            page.setAttribute("node-x", String(x)); page.setAttribute("node-y", String(y));
        }
        const graph = await editor(widget), scene = control<any>(graph, "ww-scene");
        await scene.ready; await frame(3);
        const path = scene.querySelector("ww-path"), drawing = scene.drawingOf(path);
        const node = control<HTMLElement>(graph, 'ww-node[data-ww-key="second-path"]');
        const rect = node.querySelector<HTMLElement>(".node-label-overlay")!.getBoundingClientRect();
        const topLeft = scene.toScene(rect.left, rect.top), bottomRight = scene.toScene(rect.right, rect.bottom);
        const pageTop = scene.toScene(0, node.querySelector<HTMLElement>(".node-card")!.getBoundingClientRect().top).y;
        const start = drawing.points[0], end = drawing.points.at(-1);
        assert.closeTo(start.y, end.y, 0.1, "endpoints share a baseline");
        assert.isAbove(start.y, topLeft.y, "direct path would enter the label");
        assert.isBelow(start.y, bottomRight.y);
        assert.isBelow(start.y, pageTop, "preview itself is below the direct path");
        for (let index = 1; index < drawing.points.length; index++) {
            const a = drawing.points[index - 1], b = drawing.points[index];
            assert.isFalse(Math.max(a.x, b.x) > topLeft.x && Math.min(a.x, b.x) < bottomRight.x
                && Math.max(a.y, b.y) > topLeft.y && Math.min(a.y, b.y) < bottomRight.y, "connector avoids the label");
        }
    });

    it("persists Scene moves as one undo step and restores the graph from HTML", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget), scene = control(graph, "ww-scene");
        const log = steps(widget);
        sceneEvent(scene, "ww-move", { items: [{ key: "start", x: 150, y: 90 }], dx: 110, dy: -30, pointer: null });
        await until(() => widget.children[0].getAttribute("node-x") === "150");
        await frame(3);
        assert.equal(widget.children[0].getAttribute("node-y"), "90");
        assert.deepEqual(log.stop(), ["transactionstart", "transactionend"]);
        const saved = await mount(widget.outerHTML);
        const restored = await editor(saved);
        assert.equal(control(restored, 'ww-node[data-ww-key="start"]').getAttribute("x"), "150");
        assert.deepEqual(readBranches(saved.children[0]), readBranches(widget.children[0]));
        assert.isNull(saved.querySelector("ww-scene, ww-node, pages-branches"), "implementation UI never enters authored markup");
    });

    it("moves a selected node with arrow keys without navigating", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget), node = control(graph, 'ww-node[data-ww-key="start"]');
        node.focus();
        node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, composed: true }));
        node.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true, composed: true }));
        await until(() => widget.children[0].getAttribute("node-x") === "50", "Scene commits its keyboard move after key release");
        assert.equal(widget.activePageIndex, 0);
    });

    it("connects pages using the Scene keyboard port interaction", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget), port = control(graph, 'ww-node[data-ww-key="first-path"] .output');
        port.focus();
        port.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
        const target = control(graph, 'ww-node[data-ww-key="second-path"] .input');
        for (let index = 0; index < 4 && !target.hasAttribute("data-ww-port-over"); index++) {
            port.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, composed: true }));
        }
        port.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
        await until(() => readBranches(widget.children[1]).some((branch) => branch.target === "second-path"), "nearest eligible page connected");
    });

    it("sets the start page and removes incoming choices when a page is deleted", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget);
        sceneEvent(control(graph, "ww-scene"), "ww-activate", { key: "first-path", via: "keyboard", count: 1 });
        await until(() => widget.activePageIndex === 1);
        await graph.updateComplete;
        const log = steps(widget);
        control(graph, 'ww-node[data-ww-key="first-path"] .node-start').click();
        assert.equal(widget.getAttribute("start-page"), "first-path", "start is written inside the undo step");
        await until(() => widget.startPage === "first-path");
        await frame(2);
        assert.deepEqual(log.stop(), ["transactionstart", "transactionend"]);
        widget.removeActivePage();
        await until(() => widget.children.length === 2);
        assert.isFalse(readBranches(widget.children[0]).some((branch) => branch.target === "first-path"));
        assert.equal(widget.startPage, "");
        assert.isNotNull(widget.children[0].querySelector("h2"), "remaining content retained");
    });

    it("follows direct attribute changes, broken links and mode changes safely", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget);
        widget.children[0].setAttribute("label", "Updated remotely");
        widget.children[0].setAttribute("node-x", "75");
        widget.children[0].setAttribute("branches", '[{"target":"missing","label":"Unavailable"}]');
        await until(() => control<HTMLInputElement>(graph, '.node-label-input').value === "Updated remotely");
        await until(() => control(graph, 'ww-node[data-ww-key="start"]').getAttribute("x") === "75");
        widget.removeAttribute("contenteditable");
        await until(() => !widget.shadowRoot!.querySelector("pages-branches"));
        assert.equal(choices(widget).length, 0, "broken targets offer no navigation");
        widget.children[0].setAttribute("branches", '{"invalid":true}');
        await frame(2);
        assert.equal(choices(widget).length, 0);
        widget.type = "tabs";
        await until(() => items(widget, ".page-tab").length === 3);
        widget.type = "branches";
        widget.setAttribute("contenteditable", "true");
        assert.isNotNull(await editor(widget));
    });

    it("localizes the new view, node controls and page choices in the inherited language", async function () {
        const widget = await mount(authorSnippet());
        widget.parentElement!.lang = "de";
        const graph = await editor(widget);
        await until(() => control(graph, ".add-node").getAttribute("aria-label") === "Seite hinzufügen", "German node controls");
        assert.equal(control<HTMLInputElement>(graph, ".node-label-input").getAttribute("aria-label"), "Seitenbeschriftung");
        await until(() => widget.shadowRoot!.querySelector(".branch-choices")?.getAttribute("aria-label") === "Seitenauswahl", "German choices navigation");
        assert.isFalse(widget.hasAttribute("lang"), "inherited language stays inherited");
    });
});

mocha.run();
