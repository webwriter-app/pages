import { css, html, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { LitElementWw } from "@webwriter/lit";
import { SceneController, type ActivateDetail, type BackgroundDetail, type ConnectDetail, type DisconnectDetail, type MoveDetail, type ReconnectDetail, type SelectDetail } from "@webwriter/lit/scene";
import { Viewport } from "@webwriter/lit/viewport";
import { sceneElements } from "@webwriter/widget/scene";
import type { PagesView } from "../model/pages-view";
import type { WebwriterPage } from "../widgets/webwriter-page";
import { pageKey, readBranches, readNodePosition, type PageBranch } from "../model/page-branches";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import plusIcon from "@tabler/icons/outline/plus.svg";
import removeIcon from "@tabler/icons/outline/trash.svg";
import fitIcon from "@tabler/icons/outline/zoom-scan.svg";
import openIcon from "@tabler/icons/outline/arrow-right.svg";

/** An editing-only Scene over the same authored pages that the reader sees. */
export class PagesBranches extends LitElementWw {
    static scopedElements = { ...sceneElements, "sl-icon": SlIcon };

    @property({ attribute: false }) accessor view!: PagesView;
    @property({ attribute: false }) accessor startKey = "";
    @property({ attribute: false }) accessor setBranches!: (page: WebwriterPage, branches: PageBranch[]) => void;
    @property({ attribute: false }) accessor movePages!: (items: MoveDetail["items"]) => void;
    @property({ attribute: false }) accessor setStart!: (page: WebwriterPage) => void;
    @property({ attribute: false }) accessor addPageAt!: (point: { x: number; y: number }) => void;
    @property({ attribute: false }) accessor openPage!: (index: number) => void;
    @state() private accessor selectedPath = "";
    @state() private accessor selectedNode: string | undefined = undefined;
    @property({ attribute: false }) accessor collapsed = false;

    #viewport: Viewport = new Viewport(this, {
        wheel: "page",
        bounds: () => this.#scene.extent(),
        start: () => ({ x: 12, y: 12, scale: 0.85 }),
        can: () => !this.#scene.marquee,
    });
    #scene: SceneController = new SceneController(this, {
        viewport: this.#viewport.core,
        can: () => Boolean(this.view?.editing && !this.collapsed),
        undoHost: () => (this.getRootNode() as ShadowRoot).host as HTMLElement,
    });

    static styles = css`
        :host { display: block; position: relative; block-size: 100%; color: var(--ww-text-color, inherit); font-family: var(--ww-font-family, inherit); }
        * { box-sizing: border-box; }
        :host([hidden]) { display: none; }
        .graph { position: relative; block-size: 100%; }
        .view-controls { position: absolute; inset-inline-end: 10px; inset-block-start: 10px; z-index: 10; display: flex; }
        .view-controls button { min-inline-size: 28px; min-block-size: 28px; padding: 0 4px; border: 0; background: transparent; }
        .icon-button { display: grid; place-items: center; min-inline-size: 32px; min-block-size: 32px; padding: 0; }
        .add-node { position: absolute; inset-inline-start: 10px; inset-block-start: 10px; z-index: 10; box-shadow: 0 1px 4px rgb(0 0 0 / 0.12); }
        .node-open, .remove-node { position: absolute; inset-inline-end: -6px; min-inline-size: 24px; min-block-size: 24px; border-radius: 50%; box-shadow: 0 1px 3px #0002; }
        .node-open { inset-block-start: -8px; }
        .remove-node { inset-block-end: -8px; visibility: hidden; }
        ww-node[selected] .remove-node { visibility: visible; }
        sl-icon { font-size: 16px; pointer-events: none; }
        button, input, select { font: inherit; font-size: 13px; color: inherit; min-block-size: 32px; }
        button { padding: 4px 10px; border: 1px solid var(--sl-panel-border-color); border-radius: 5px; background: var(--sl-panel-background-color); cursor: pointer; }
        button:disabled { opacity: 0.45; cursor: default; }
        input, select { padding: 4px 7px; border: 1px solid var(--sl-panel-border-color); border-radius: 4px; background: var(--sl-panel-background-color); min-inline-size: 0; }
        input { inline-size: 14rem; max-inline-size: 100%; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--ww-theme-accent-1, #0284c7); outline-offset: 2px; }
        ww-scene { display: block; block-size: 100%; background: var(--sl-panel-background-color); --ww-scene-selection: var(--ww-theme-accent-1, #0284c7); }
        ww-node { inline-size: 200px; min-block-size: 84px; padding: 18px 20px; background: var(--sl-panel-background-color); border: 1px solid var(--sl-color-neutral-400); border-radius: 8px; color: inherit; cursor: pointer; }
        ww-node[selected] { border-color: var(--ww-theme-accent-1, #0284c7); background: var(--sl-color-primary-50); }
        .node-label, .node-label-input { display: block; inline-size: 100%; min-inline-size: 0; min-block-size: 0; block-size: 1.5em; padding: 0; border: 0; border-radius: 0; background: transparent; font: inherit; font-weight: 600; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .node-label-input::placeholder { color: inherit; opacity: 1; }
        .node-start { display: block; visibility: hidden; margin-block-start: 6px; min-block-size: 24px; padding: 1px 5px; font-size: 11px; }
        ww-node[selected] .node-start, .node-start:disabled { visibility: visible; }
        .node-kind { display: block; margin-block-start: 5px; font-size: 12px; color: var(--sl-color-neutral-500); }
        .port { position: absolute; inset-block-start: 28px; inline-size: 24px; block-size: 24px; border: 6px solid transparent; border-radius: 50%; background: var(--ww-theme-accent-1, #0284c7); background-clip: padding-box; }
        /* Mask the node border, but leave the outward half clear for the connector. */
        .port::before { content: ""; position: absolute; inset: -6px; border: 6px solid var(--sl-panel-background-color); border-radius: 50%; clip-path: inset(0 0 0 50%); pointer-events: none; }
        .output::before { clip-path: inset(0 50% 0 0); }
        .input { inset-inline-start: -12px; }
        .output { inset-inline-end: -12px; }
        .port[data-ww-port-candidate], .port[data-ww-port-over] { outline: 2px solid var(--ww-theme-accent-1, #0284c7); }
        ww-path { stroke: var(--sl-color-neutral-500); stroke-width: 2px; }
        ww-path:state(rewiring) { opacity: 0.3; }
        ww-text { fill: var(--ww-text-color, #374151); font-size: 12px; }
        @media (hover: hover) {
            button:not(:disabled):hover { border-color: var(--sl-color-neutral-500); background: var(--sl-color-neutral-100); }
            .remove-node:not(:disabled):hover { color: var(--sl-color-danger-600); border-color: currentColor; }
        }
        @media (pointer: coarse) { button, input:not(.node-label-input), select { min-block-size: 44px; } .icon-button, .view-controls button { min-inline-size: 44px; min-block-size: 44px; } }
    `;

    #label(page: WebwriterPage) {
        return page.getAttribute("label") || `${this.view.msg("Page")} ${this.view.pages.indexOf(page) + 1}`;
    }

    #page(key: string) { return this.view.pages.find((page) => pageKey(page) === key); }

    focus(options?: FocusOptions) {
        this.renderRoot.querySelector<HTMLElement>("ww-scene")?.focus(options);
    }

    protected updated(changed: PropertyValues<this>) {
        if (changed.has("collapsed") && !this.collapsed) {
            void this.#scene.ready.then(() => {
                if (this.isConnected && !this.collapsed) return this.#viewport.fit({ follow: "none" });
            });
        }
        const buttons = this.renderRoot.querySelectorAll<HTMLButtonElement>(".view-controls button");
        if (!("focusGroup" in HTMLElement.prototype) && !Array.from(buttons).some(button => button.hasAttribute("tabindex"))) {
            buttons.forEach((button, index) => button.tabIndex = index ? -1 : 0);
        }
        const previous = changed.get("view") as PagesView | undefined;
        const previousPage = previous?.pages[previous.activePageIndex];
        const page = this.view?.pages[this.view.activePageIndex];
        if (previousPage && page && previousPage !== page) {
            this.selectedNode = pageKey(page);
            this.selectedPath = "";
            const { x, y } = readNodePosition(page, this.view.activePageIndex);
            const view = this.#viewport;
            const left = x * view.scale + view.x, top = y * view.scale + view.y;
            if (left < 0 || top < 0 || left + 200 * view.scale > view.width || top + 84 * view.scale > view.height) {
                void view.centerOn({ x: x + 100, y: y + 42 });
            }
        }
    }

    #select = (event: CustomEvent<SelectDetail | ActivateDetail>) => {
        const key = "keys" in event.detail ? event.detail.keys[0] : event.detail.key;
        this.selectedPath = key?.startsWith("path:") ? key : "";
        const page = key && this.#page(key);
        if (!key) this.selectedNode = "";
        if (page) {
            this.selectedNode = key;
            if (event.type === "ww-activate") this.view.changePage(this.view.pages.indexOf(page));
        }
    };

    #connect(from: string, to: string) {
        const source = this.#page(from), target = this.#page(to);
        if (!this.view.editing || !source || !target || source === target) return false;
        const branches = readBranches(source);
        if (branches.some((branch) => branch.target === to)) return false;
        this.setBranches(source, [...branches, { target: to, label: "" }]);
        return true;
    }

    #onConnect = (event: CustomEvent<ConnectDetail>) => {
        if (!this.#connect(event.detail.from.split(":")[0], event.detail.to.split(":")[0])) event.preventDefault();
    };

    #background = (event: CustomEvent<BackgroundDetail>) => {
        const { gesture, point, pointerType } = event.detail;
        if (gesture === "dblclick" || gesture === "longpress" && pointerType === "touch") this.addPageAt(point);
    };

    #addNode() {
        const scene = this.renderRoot.querySelector("ww-scene");
        if (!scene) return;
        const rect = scene.getBoundingClientRect();
        this.addPageAt(this.#scene.toScene(rect.left + rect.width / 2, rect.top + rect.height / 2));
    }

    #reconnect = (event: CustomEvent<ReconnectDetail>) => {
        const { path, previous, from, to } = event.detail;
        const source = this.#page(previous.from.split(":")[0]), target = this.#page(from.split(":")[0]);
        const destination = this.#page(to.split(":")[0]);
        const branches = source && readBranches(source), index = branches?.findIndex(branch => branch.target === previous.to.split(":")[0]) ?? -1;
        if (!this.view.editing || !path.isConnected || path.parentElement !== this.renderRoot.querySelector("ww-scene")
            || path.getAttribute("from") !== previous.from || path.getAttribute("to") !== previous.to
            || !source || !target || !destination || target === destination || index < 0
            || from !== `${pageKey(target)}:out` || to !== `${pageKey(destination)}:in`
            || readBranches(target).some((branch, i) => branch.target === pageKey(destination) && (source !== target || i !== index))) {
            event.preventDefault();
            return;
        }
        const branch = { ...branches![index], target: pageKey(destination) };
        if (source === target) this.setBranches(source, branches!.map((current, i) => i === index ? branch : current));
        else {
            this.setBranches(source, branches!.filter((_, i) => i !== index));
            this.setBranches(target, [...readBranches(target), branch]);
        }
        this.selectedPath = `path:${pageKey(target)}:${pageKey(destination)}`;
    };

    #disconnect = (event: CustomEvent<DisconnectDetail>) => {
        const { path, from, to } = event.detail;
        const source = this.#page(from.split(":")[0]);
        if (!this.view.editing || !path.isConnected || path.parentElement !== this.renderRoot.querySelector("ww-scene")
            || path.getAttribute("from") !== from || path.getAttribute("to") !== to || !source) {
            event.preventDefault();
            return;
        }
        this.setBranches(source, readBranches(source).filter(branch => branch.target !== to.split(":")[0]));
        this.selectedPath = "";
    };

    #toolbarFocus(event: FocusEvent) {
        if ("focusGroup" in HTMLElement.prototype) return;
        for (const button of (event.currentTarget as HTMLElement).querySelectorAll("button")) button.tabIndex = button === event.target ? 0 : -1;
    }

    #toolbarKey(event: KeyboardEvent) {
        if ("focusGroup" in HTMLElement.prototype) return;
        const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll("button")];
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        const rtl = getComputedStyle(event.currentTarget as HTMLElement).direction === "rtl";
        const step = event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
            : step ? (index + step + buttons.length) % buttons.length : -1;
        if (next < 0) return;
        event.preventDefault();
        buttons[next]?.focus();
    }

    #removePath() {
        const [, from, to] = this.selectedPath.split(":");
        const page = this.#page(from);
        if (page) this.setBranches(page, readBranches(page).filter((branch) => branch.target !== to));
        this.selectedPath = "";
    }

    #keydown(event: KeyboardEvent) {
        if (event.composedPath().some((node) => node instanceof HTMLElement && node.matches("input, select, textarea, button"))) return;
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        event.preventDefault();
        if (this.selectedPath) this.#removePath();
        else if (this.view.pages.length > 1) {
            const page = this.selectedNode === undefined ? this.view.pages[this.view.activePageIndex] : this.#page(this.selectedNode);
            if (page) this.view.removePage(this.view.pages.indexOf(page));
        }
    }

    render() {
        const view = this.view;
        if (!view?.editing) return nothing;
        const page = view.pages[view.activePageIndex];
        return html`
            <div class="graph">
            <button type="button" class="add-node icon-button" title=${view.msg("Add page")} aria-label=${view.msg("Add page")} @click=${this.#addNode}>
                <sl-icon src=${plusIcon} aria-hidden="true"></sl-icon>
            </button>
            <div class="view-controls" data-ww-viewport-controls role="toolbar" aria-label=${view.msg("Page branches")} aria-controls="graph" focusgroup="toolbar wrap"
                @focusin=${this.#toolbarFocus} @keydown=${this.#toolbarKey}>
                <button type="button" data-ww-viewport-action="out" aria-keyshortcuts="-">−</button>
                <button type="button" data-ww-viewport-action="in" aria-keyshortcuts="+">+</button>
                <button type="button" data-ww-viewport-action="reset"></button>
                <button type="button" data-ww-viewport-action="fit" aria-keyshortcuts="0"><sl-icon src=${fitIcon} aria-hidden="true"></sl-icon></button>
            </div>
            <ww-scene id="graph" select="single" connect-click grid="10" background="dots" background-spacing="20"
                data-ww-viewport="canvas" data-ww-viewport-fit="content" data-ww-viewport-fit-padding="24" data-ww-viewport-fit-inset="48 0 0 0" data-ww-viewport-zoom="0.4 1.5"
                aria-label=${view.msg("Page branches")} @ww-select=${this.#select} @ww-activate=${this.#select}
                @ww-ready=${async () => {
                    await this.updateComplete;
                    if (!this.collapsed) await this.#viewport.fit({ follow: "none" });
                }}
                @ww-connect=${this.#onConnect} @ww-reconnect=${this.#reconnect} @ww-disconnect=${this.#disconnect} @ww-background=${this.#background}
                @ww-move=${(event: CustomEvent<MoveDetail>) => this.movePages(event.detail.items)}
                @keydown=${this.#keydown}>
                ${view.pages.flatMap((source) => readBranches(source).filter((branch) => this.#page(branch.target)).map((branch) => html`
                    <ww-path data-ww-key=${`path:${pageKey(source)}:${branch.target}`} from=${`${pageKey(source)}:out`} to=${`${branch.target}:in`}
                        route="avoid" rewire=${this.selectedPath === `path:${pageKey(source)}:${branch.target}` ? "from to" : nothing}
                        aria-label=${branch.label || this.#label(this.#page(branch.target)!)} selectable ?selected=${this.selectedPath === `path:${pageKey(source)}:${branch.target}`}>
                    </ww-path>`))}
                ${repeat(view.pages, pageKey, (node, index) => {
                    const position = readNodePosition(node, index), key = pageKey(node);
                    return html`<ww-node data-ww-key=${key} x=${position.x} y=${position.y} selectable movable ?selected=${!this.selectedPath && (this.selectedNode === undefined ? node === page : this.selectedNode === key)}
                        aria-label=${this.#label(node)}>
                        <span class="port input" data-ww-port="in" data-ww-accept="page" data-ww-side="left" data-ww-control aria-label=${view.msg("Connect to page")}></span>
                        ${node === page ? html`<input class="node-label-input" aria-label=${view.msg("Page label")} .value=${live(node.getAttribute("label") ?? "")}
                            placeholder=${this.#label(node)} @input=${(event: InputEvent) => view.setPageLabel(node, (event.target as HTMLInputElement).value)}>`
                            : html`<span class="node-label">${this.#label(node)}</span>`}
                        <button type="button" class="node-start" data-ww-control ?disabled=${key === this.startKey}
                            @click=${() => this.setStart(node)}>${key === this.startKey ? view.msg("Start page") : view.msg("Set as start")}</button>
                        <button type="button" class="node-open icon-button" data-ww-control title=${`${view.msg("Go to page")}: ${this.#label(node)}`} aria-label=${`${view.msg("Go to page")}: ${this.#label(node)}`}
                            @click=${() => this.openPage(this.view.pages.indexOf(node))}><sl-icon src=${openIcon} aria-hidden="true"></sl-icon></button>
                        <button type="button" class="remove-node icon-button" data-ww-control ?disabled=${view.pages.length <= 1}
                            title=${view.msg("Remove page")} aria-label=${view.msg("Remove page")}
                            @click=${() => view.removePage(this.view.pages.indexOf(node))}><sl-icon src=${removeIcon} aria-hidden="true"></sl-icon></button>
                        <span class="port output" data-ww-port="out" data-ww-link="page" data-ww-side="right" data-ww-control aria-label=${view.msg("Connect from page")}></span>
                    </ww-node>`;
                })}
            </ww-scene>
            </div>
        `;
    }
}
