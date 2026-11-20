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

    it("keeps choices between the page and collapsible graph, with fullscreen at the end", async function () {
        const widget = await mount(authorSnippet());
        const graph = await editor(widget);
        assert.isNull(graph.shadowRoot!.querySelector(".help"), "no permanent editing hint");
        const toggle = control<HTMLButtonElement>(widget, ".branch-controls .graph-toggle");
        const controls = control(widget, ".branch-controls");
        assert.equal(controls.firstElementChild!.className, "branch-choices", "choices start the row");
        assert.equal(controls.lastElementChild!.className, "branch-tools", "controls end the row");
        assert.equal(toggle.previousElementSibling!.className, "branch-fullscreen");
        assert.isAtLeast(toggle.getBoundingClientRect().top, control(widget, "#fullscreen").getBoundingClientRect().bottom, "chevron sits below fullscreen");
        assert.equal(controls.nextElementSibling, graph, "graph follows choices in DOM and keyboard order");
        assert.isAbove(controls.getBoundingClientRect().top, control(widget, ".page-stage").getBoundingClientRect().top);
        assert.isAtLeast(graph.getBoundingClientRect().top, controls.getBoundingClientRect().bottom - 1);
        const height = widget.getBoundingClientRect().height;
        assert.isNull(graph.shadowRoot!.querySelector("summary"), "no separate labelled row");
        assert.equal(toggle.textContent!.trim(), "", "icon-only toggle");
        assert.isNotNull(toggle.querySelector('sl-icon[aria-hidden="true"]'));
        assert.equal(toggle.getAttribute("aria-expanded"), "true");
        assert.equal(widget.shadowRoot!.getElementById(toggle.getAttribute("aria-controls")!), graph);
        toggle.click();
        await frame(2);
        assert.isTrue(graph.hidden);
        assert.equal(toggle.getAttribute("aria-expanded"), "false");
        assert.equal(toggle.getAttribute("aria-label"), "Expand graph");
        assert.isBelow(widget.getBoundingClientRect().height, height - 200, "closed graph releases its space");
        assert.equal(control(graph, ".toolbar").getBoundingClientRect().height, 0, "toolbar is also hidden");
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
        control(graph, ".remove-connection").click();
        await until(() => readBranches(widget.children[0]).length === 0);
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
        blocker.setAttribute("x", "265");
        blocker.setAttribute("y", "110");
        blocker.style.cssText = "inline-size: 40px; min-block-size: 100px; padding: 0";
        const group = document.createElement("ww-group", scope);
        group.setAttribute("x", "265");
        group.setAttribute("y", "110");
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
