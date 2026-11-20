import { css, html, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { LitElementWw } from "@webwriter/lit";
import { SceneController, type ActivateDetail, type ConnectDetail, type MoveDetail, type SelectDetail } from "@webwriter/lit/scene";
import { Viewport } from "@webwriter/lit/viewport";
import { sceneElements } from "@webwriter/widget/scene";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import { renderControls } from "./pages-controls";
import type { PagesView } from "../model/pages-view";
import type { WebwriterPage } from "../widgets/webwriter-page";
import { pageKey, readBranches, readNodePosition, type PageBranch } from "../model/page-branches";

/** An editing-only Scene over the same authored pages that the reader sees. */
export class PagesBranches extends LitElementWw {
    static scopedElements = { ...sceneElements, "sl-icon-button": SlIconButton };

    @property({ attribute: false }) accessor view!: PagesView;
    @property({ attribute: false }) accessor startKey = "";
    @property({ attribute: false }) accessor setBranches!: (page: WebwriterPage, branches: PageBranch[]) => void;
    @property({ attribute: false }) accessor movePages!: (items: MoveDetail["items"]) => void;
    @property({ attribute: false }) accessor setStart!: (page: WebwriterPage) => void;
    @state() private accessor selectedPath = "";
    @state() private accessor selectedNode = "";

    #viewport: Viewport = new Viewport(this, {
        wheel: "page",
        bounds: () => this.#scene.extent(),
        start: () => ({ x: 12, y: 12, scale: 0.85 }),
        can: () => !this.#scene.marquee,
    });
    #scene: SceneController = new SceneController(this, {
        viewport: this.#viewport.core,
        can: () => Boolean(this.view?.editing),
        undoHost: () => (this.getRootNode() as ShadowRoot).host as HTMLElement,
    });

    static styles = css`
        :host { display: block; color: var(--ww-text-color, inherit); font-family: var(--ww-font-family, inherit); }
        * { box-sizing: border-box; }
        .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .toolbar { padding: 10px 12px; background: var(--sl-color-neutral-50); }
        .toolbar { border-bottom: 1px solid var(--sl-panel-border-color); }
        .tools { display: flex; gap: 4px; margin-inline-start: auto; }
        button, input, select { font: inherit; font-size: 13px; color: inherit; min-block-size: 32px; }
        button { padding: 4px 10px; border: 1px solid var(--sl-panel-border-color); border-radius: 5px; background: var(--sl-panel-background-color); cursor: pointer; }
        button:disabled { opacity: 0.45; cursor: default; }
        input, select { padding: 4px 7px; border: 1px solid var(--sl-panel-border-color); border-radius: 4px; background: var(--sl-panel-background-color); min-inline-size: 0; }
        input { inline-size: 14rem; max-inline-size: 100%; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--ww-theme-accent-1, #0284c7); outline-offset: 2px; }
        ww-scene { display: block; block-size: 280px; background: var(--sl-panel-background-color); --ww-scene-selection: var(--ww-theme-accent-1, #0284c7); }
        ww-node { inline-size: 200px; min-block-size: 84px; padding: 18px 20px; background: var(--sl-panel-background-color); border: 1px solid var(--sl-color-neutral-400); border-radius: 8px; color: inherit; cursor: pointer; }
        ww-node[selected] { border-color: var(--ww-theme-accent-1, #0284c7); background: var(--sl-color-primary-50); }
        .node-label { display: block; font-weight: 600; overflow-wrap: anywhere; }
        .node-label-input { inline-size: 100%; min-inline-size: 0; padding: 0; border: 0; background: transparent; font-weight: 600; }
        .node-start { display: block; margin-block-start: 6px; min-block-size: 24px; padding: 1px 5px; font-size: 11px; }
        .controls-section { display: flex; align-items: center; }
        .node-kind { display: block; margin-block-start: 5px; font-size: 12px; color: var(--sl-color-neutral-500); }
        .port { position: absolute; inset-block-start: 28px; inline-size: 24px; block-size: 24px; border: 6px solid var(--sl-panel-background-color); border-radius: 50%; background: var(--ww-theme-accent-1, #0284c7); }
        .input { inset-inline-start: -12px; }
        .output { inset-inline-end: -12px; }
        .port[data-ww-port-candidate], .port[data-ww-port-over] { outline: 2px solid var(--ww-theme-accent-1, #0284c7); }
        ww-path { stroke: var(--sl-color-neutral-500); stroke-width: 2px; }
        ww-text { fill: var(--ww-text-color, #374151); font-size: 12px; }
        .help { margin: 0; padding: 8px 12px; font-size: 12px; color: var(--sl-color-neutral-600); border-block: 1px solid var(--sl-panel-border-color); }
        @media (hover: hover) { button:not(:disabled):hover { border-color: var(--sl-color-neutral-500); background: var(--sl-color-neutral-100); } }
        @media (pointer: coarse) { button, input, select { min-block-size: 44px; } }
    `;

    #label(page: WebwriterPage) {
        return page.getAttribute("label") || `${this.view.msg("Page")} ${this.view.pages.indexOf(page) + 1}`;
    }

    #page(key: string) { return this.view.pages.find((page) => pageKey(page) === key); }

    protected updated(changed: PropertyValues<this>) {
        const previous = changed.get("view") as PagesView | undefined;
        const page = this.view?.pages[this.view.activePageIndex];
        if (previous && page && previous.pages[previous.activePageIndex] !== page) {
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
        this.setBranches(source, [...branches, { target: to, label: this.#label(target) }]);
        return true;
    }

    #onConnect = (event: CustomEvent<ConnectDetail>) => {
        if (!this.#connect(event.detail.from.split(":")[0], event.detail.to.split(":")[0])) event.preventDefault();
    };

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
            const page = this.#page(this.selectedNode) ?? this.view.pages[this.view.activePageIndex];
            this.view.removePage(this.view.pages.indexOf(page));
        }
    }

    render() {
        const view = this.view;
        if (!view?.editing) return nothing;
        const page = view.pages[view.activePageIndex];
        return html`
            <div class="toolbar">
                <button type="button" class="add-node" @click=${() => view.addPage()}><span aria-hidden="true">＋</span> ${view.msg("Add page")}</button>
                <button type="button" class="remove-node" ?disabled=${view.pages.length <= 1} @click=${() => view.removePage(view.activePageIndex)}>${view.msg("Remove")}</button>
                <button type="button" class="remove-connection" ?disabled=${!this.selectedPath} @click=${() => this.#removePath()}>${view.msg("Remove connection")}</button>
                <div class="tools">
                    <button type="button" title=${view.msg("Zoom out")} aria-label=${view.msg("Zoom out")} @click=${() => this.#viewport.zoomBy(1 / 1.2)}>−</button>
                    <button type="button" title=${view.msg("Zoom in")} aria-label=${view.msg("Zoom in")} @click=${() => this.#viewport.zoomBy(1.2)}>+</button>
                    <button type="button" @click=${() => this.#viewport.fit({ follow: "none" })}>${view.msg("Fit graph")}</button>
                    ${renderControls(view, "none", false)}
                </div>
            </div>
            <ww-scene select="single" connect-click grid="10" background="dots" background-spacing="20"
                data-ww-viewport="canvas" data-ww-viewport-fit="none" data-ww-viewport-zoom="0.4 1.5"
                aria-label=${view.msg("Page branches")} @ww-select=${this.#select} @ww-activate=${this.#select}
                @ww-ready=${() => this.#viewport.fit({ follow: "none" })}
                @ww-connect=${this.#onConnect} @ww-move=${(event: CustomEvent<MoveDetail>) => this.movePages(event.detail.items)}
                @keydown=${this.#keydown}>
                ${view.pages.flatMap((source) => readBranches(source).filter((branch) => this.#page(branch.target)).map((branch) => html`
                    <ww-path data-ww-key=${`path:${pageKey(source)}:${branch.target}`} from=${`${pageKey(source)}:out`} to=${`${branch.target}:in`}
                        route="curve" marker-end="arrow" aria-label=${branch.label} selectable ?selected=${this.selectedPath === `path:${pageKey(source)}:${branch.target}`}>
                    </ww-path>`))}
                ${repeat(view.pages, pageKey, (node, index) => {
                    const position = readNodePosition(node, index), key = pageKey(node);
                    return html`<ww-node data-ww-key=${key} x=${position.x} y=${position.y} selectable movable ?selected=${!this.selectedPath && (this.selectedNode ? this.selectedNode === key : node === page)}
                        aria-label=${this.#label(node)}>
                        <span class="port input" data-ww-port="in" data-ww-accept="page" data-ww-side="left" data-ww-control aria-label=${view.msg("Connect to page")}></span>
                        ${node === page ? html`<input class="node-label-input" aria-label=${view.msg("Page label")} .value=${live(node.getAttribute("label") ?? "")}
                            placeholder=${this.#label(node)} @input=${(event: InputEvent) => view.setPageLabel(node, (event.target as HTMLInputElement).value)}>`
                            : html`<span class="node-label">${this.#label(node)}</span>`}
                        <button type="button" class="node-start" data-ww-control ?disabled=${key === this.startKey}
                            @click=${() => this.setStart(node)}>${key === this.startKey ? view.msg("Start page") : view.msg("Set as start")}</button>
                        <span class="port output" data-ww-port="out" data-ww-link="page" data-ww-side="right" data-ww-control aria-label=${view.msg("Connect from page")}></span>
                    </ww-node>`;
                })}
            </ww-scene>
            <p class="help">${view.msg("Select a node to edit its page. Connect the dots to add choices, or use the destination menu below.")}</p>
        `;
    }
}
