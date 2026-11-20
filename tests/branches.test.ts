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
        await element.updateComplete;
        await until(() => element.shadowRoot!.querySelector("ww-node")?.getBoundingClientRect().width, "nodes laid out");
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
        assert.isNotNull(widget.shadowRoot!.querySelector(".branch-topbar #fullscreen"));
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

    it("uses Scene nodes in edit mode and navigates only on activation", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget);
        assert.equal(graph.shadowRoot!.querySelectorAll("ww-node").length, 3);
        assert.equal(graph.shadowRoot!.querySelectorAll("ww-path").length, 4);
        assert.isNull(graph.shadowRoot!.querySelector(".page-settings"), "no separate label input row");
        assert.isNotNull(graph.shadowRoot!.querySelector(".fullscreen-controls #fullscreen"));
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

    it("collapses the graph with an icon in the toolbar while keeping fullscreen and choices available", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget);
        assert.isNull(graph.shadowRoot!.querySelector(".help"), "no permanent editing hint");
        const toggle = control<HTMLButtonElement>(graph, ".toolbar .graph-toggle");
        const scene = control(graph, "ww-scene");
        const height = graph.getBoundingClientRect().height;
        assert.isNull(graph.shadowRoot!.querySelector("summary"), "no separate labelled row");
        assert.equal(toggle.textContent!.trim(), "", "icon-only toggle");
        assert.isNotNull(toggle.querySelector('sl-icon[aria-hidden="true"]'));
        assert.equal(toggle.getAttribute("aria-expanded"), "true");
        toggle.click();
        await frame(2);
        assert.isTrue(scene.hidden);
        assert.equal(toggle.getAttribute("aria-expanded"), "false");
        assert.equal(toggle.getAttribute("aria-label"), "Expand graph");
        assert.isBelow(graph.getBoundingClientRect().height, height - 200, "closed graph releases its space");
        assert.isAbove(control(graph, "#fullscreen").getBoundingClientRect().height, 0, "fullscreen remains visible");
        choices(widget)[0].click();
        await until(() => widget.activePageIndex === 1);
        await frame(2);
        assert.isTrue(scene.hidden, "page navigation does not reopen the graph");
        toggle.click();
        await frame(3);
        assert.isFalse(scene.hidden);
        assert.equal(toggle.getAttribute("aria-expanded"), "true");
        assert.equal(graph.shadowRoot!.querySelectorAll("ww-node").length, 3);
        assert.deepEqual(readBranches(widget.children[0]).map((branch) => branch.target), ["first-path", "second-path"]);
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
        await graph.updateComplete;
        control(graph, ".add-node").click();
        await until(() => widget.children.length === 1 && pageKey(widget.children[0]), "first page created");
        assert.isNotNull(widget.children[0].querySelector("p"));
    });

    it("adds and edits choices through the destination menu", async function () {
        const widget = await mount(`<webwriter-pages type="branches" contenteditable="true">${pages(2)}</webwriter-pages>`);
        const graph = await editor(widget);
        control(widget, ".add-choice").click();
        await until(() => readBranches(widget.children[0]).length === 1, "choice saved");
        assert.equal(readBranches(widget.children[0])[0].target, pageKey(widget.children[1]));
        await graph.updateComplete;
        const label = control<HTMLInputElement>(widget, '.branch-choice-edit input');
        label.value = "Continue to the activity";
        label.dispatchEvent(new Event("change", { bubbles: true }));
        await until(() => readBranches(widget.children[0])[0].label === "Continue to the activity");
        widget.removeAttribute("contenteditable");
        await until(() => !widget.shadowRoot!.querySelector("pages-branches"));
        assert.equal(choices(widget)[0].textContent!.trim(), "Continue to the activity");
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
        control(graph, ".remove-connection").click();
        await until(() => readBranches(widget.children[0]).length === 0);
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
        await until(() => control(graph, ".add-node").textContent!.includes("Seite hinzufügen"), "German node controls");
        assert.equal(control<HTMLInputElement>(graph, ".node-label-input").getAttribute("aria-label"), "Seitenbeschriftung");
        await until(() => widget.shadowRoot!.querySelector(".branch-choices")?.getAttribute("aria-label") === "Seitenauswahl", "German choices navigation");
        assert.isFalse(widget.hasAttribute("lang"), "inherited language stays inherited");
    });
});

mocha.run();
