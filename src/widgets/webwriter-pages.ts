import { html, nothing, type PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { LitElementWw, resolveDeclarations, signal } from "@webwriter/lit";
import {
    customElement,
    property,
    queryAssignedElements,
    state,
} from "lit/decorators.js";
import type { MsgFn } from "@lit/localize";
import { localizer } from "@webwriter/lit/localize";
import { Permissions } from "@webwriter/lit/permissions";
import { Drag, type DragCommitDetail } from "@webwriter/lit/drag";
import { transaction } from "@webwriter/widget/transaction";
import type { ActionDeclaration, OptionDeclaration, Declared } from "@webwriter/widget";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import "@shoelace-style/shoelace/dist/themes/light.css";
// @ts-ignore The Lit localization CLI generates this JavaScript module.
import { sourceLocale, targetLocales } from "../../localization/generated/locale-codes.js";

import { WebwriterPage } from "./webwriter-page";
import { pages_styles } from "../components/webwriter-pages.styles";
import { renderAddPage, renderControls } from "../components/pages-controls";
import { renderThumbs, renderTabs } from "../components/pages-strip";
import { sectionToPages, pageToDetails } from "../components/pages-convert";
import { captureThumbnail } from "../components/page-thumbnail";
import type { PagesView } from "../model/pages-view";
import { PagesBranches } from "../components/pages-branches";
import { renderBranchChoices } from "../components/pages-branch-choices";
import { PagesChoiceConditions, resolveConditionsForSave, type ConditionsDraftResult } from "../components/pages-choice-conditions";
import { evaluateBranch, readBranchConditions, signalRootFor } from "../model/branch-conditions";
import { ensurePageKeys, pageKey, readBranches, writeBranches, type PageBranch } from "../model/page-branches";
import type { MoveDetail } from "@webwriter/lit/scene";
import { MAX_PAGE_ASPECT_RATIO, MIN_PAGE_ASPECT_RATIO, PageAspectResize, formatPageAspectRatio, normalizePageAspectRatio } from "../components/page-aspect-resize";

type Labelled = { msg: MsgFn };
type PagesLayout = "tabs" | "pages" | "carousel" | "branches";

/**
 * Display authored content in Tabs, Slides, Carousel, or Branches, with Tabs by default.
 *
 * Authors add `webwriter-page` children. Slides ("pages") shows preview cards, Carousel ("carousel") shows
 * compact controls over the page, and Tabs ("tabs") shows a tab strip. Thumbnails are drawn in the editor
 * with a capture library that loads on first use.
 * The "branches" view adds an editing-only Scene graph. Node labels, start page, positions and choices
 * are saved on the authored pages; the bottom pane edits choices and lets readers follow them.
 * The graph has no reading-mode controls, and Branches hides completion indicators.
 * In use mode the arrow keys, the controls and swipes in fullscreen move between pages. The arrow keys leave
 * text entry, Alt and Meta combinations alone. Every thumbnail and tab has a button that selects its page;
 * in edit mode Space or Enter on the thumbnail itself picks it up for reordering.
 *
 * Set `orientation="portrait"` for a 9:16 page, or use the default `landscape` for 16:9.
 * The orientation applies to all views, fullscreen, and preview cards.
 *
 * The widget follows the page theme: `--ww-text-color`, `--ww-font-family`, and `--ww-theme-accent-1` (the
 * selected thumbnail). On paper it prints all pages one after another and leaves out the controls.
 *
 * Conversions: a `section` becomes pages (its nested `section` children become one page each, otherwise the
 * section is one page). Each page converts to a `details` element with its label as the summary.
 * The thumbnails are not carried over.
 *
 * Signals: `page` is the number of the current page, starting at 1; `count` is the number of pages.
 * Both change when readers or authors move to another page.
 *
 * Enable `completion-indicators` to mark pages read after switching away, once opened and scrolled to the bottom.
 * A checkmark on each read tab/preview and an aggregate checkmark in the controls show progress.
 * Progress is local to this widget instance, is not saved in authored HTML, and does not advance in edit mode.
 *
 * Known limitation: in edit mode the drag module sets `touch-action: none` on the thumbnails, so on a touch
 * screen the thumbnail strip cannot be scrolled by dragging on a thumbnail; the select buttons still work.
 *
 * @slot default - Page elements to be displayed (should be `webwriter-page` components only).
 * @part actions - The pane of thumbnails and controls below or beside the page.
 * @part tabs - The strip of tabs and controls above the page.
 * @part thumbnail - One page thumbnail in the strip.
 * @part tab - One tab in the tab strip.
 * @part branch-editor - The editing-only Scene graph in Branches view.
 * @part branch-controls - The bottom pane of choices and continuation controls in Branches view.
 */
@customElement("webwriter-pages")
export class WebwriterPages extends LitElementWw {
    static styles = pages_styles;

    static scopedElements = {
        "sl-icon-button": SlIconButton,
        "sl-icon": SlIcon,
        "pages-branches": PagesBranches,
        "pages-choice-conditions": PagesChoiceConditions,
    };

    static convertFrom = { section: "loadSections" };
    static convertTo = { details: "toDetails" };

    static options = {
        type: {
            type: "select",
            control: "select",
            attribute: false,
            label: (widget: Labelled) => widget.msg("View"),
            options: [
                { value: "tabs", label: (widget: Labelled) => widget.msg("Tabs") },
                { value: "pages", label: (widget: Labelled) => widget.msg("Slides") },
                { value: "carousel", label: (widget: Labelled) => widget.msg("Carousel") },
                { value: "branches", label: (widget: Labelled) => widget.msg("Branches") },
            ],
        },
        completionIndicators: {
            type: Boolean,
            label: (widget: Labelled) => widget.msg("Show completion indicators"),
        },
    } satisfies Record<string, Declared<OptionDeclaration>>;

    static actions = {
        addPage: { label: (widget: Labelled) => widget.msg("Add"), buttonGroup: "pages", icon: "Plus", intent: "default" },
        removeActivePage: { label: (widget: Labelled) => widget.msg("Remove"), buttonGroup: "pages", icon: "Delete", intent: "danger", disabled: true },
        duplicateActivePage: { label: (widget: Labelled) => widget.msg("Duplicate"), buttonGroup: "pages", icon: "Copy", intent: "default", disabled: true },
        resetPageAspectRatio: { label: (widget: Labelled) => widget.msg("Reset aspect ratio"), buttonGroup: "pages", icon: "Restore", intent: "default", disabled: true },
    } satisfies Record<string, Declared<ActionDeclaration>>;

    // The drawer labels are computed with `msg`, so the editor reads them again after a language change.
    localize = localizer(this, {
        sourceLocale,
        targetLocales,
        load: (locale) => import(`../../localization/generated/${locale}.ts`),
        drawer: true,
    });
    private readonly msg = this.localize.msg;

    #permissions = new Permissions(this);

    @property({
        type: String,
        attribute: "type",
        converter: { fromAttribute: (value: string | null) => value === "pages" || value === "carousel" || value === "branches" ? value : "tabs" },
    })
    private accessor authoredType: PagesLayout = "tabs";

    @property({ type: Boolean, attribute: "hide-pagination" })
    private accessor legacyHidePagination = false;

    /** The current view, stored in the `type` attribute. */
    get type(): PagesLayout {
        // Read existing compact Slides without changing their authored markup.
        return this.authoredType === "pages" && this.legacyHidePagination ? "carousel" : this.authoredType;
    }

    set type(value: PagesLayout | null) {
        if (value) this.setAttribute("type", value);
        else this.removeAttribute("type");
        this.removeAttribute("hide-pagination");
    }

    /** Stable key of the first page in Branches; an absent key starts at the first page. */
    @property({ type: String, attribute: "start-page", reflect: true, useDefault: true })
    accessor startPage = "";

    /** Mark pages read on leaving them after reaching their bottom. Reader-local; off by default. */
    @property({ type: Boolean, attribute: "completion-indicators", reflect: true, useDefault: true })
    accessor completionIndicators = false;

    /** Page orientation: 16:9 landscape or 9:16 portrait. */
    @property({ type: String, reflect: true, useDefault: true })
    accessor orientation: "landscape" | "portrait" = "landscape";

    /** Optional page width/height ratio, clamped to 0.5–3. Without it, orientation supplies the ratio. */
    @property({ type: Number, attribute: "page-aspect-ratio", reflect: true, converter: {
        fromAttribute: (value: string | null) => value === null || !value.trim() ? undefined : Number(value),
        toAttribute: (value: number | undefined) => value === undefined ? null : String(value),
    } })
    accessor pageAspectRatio: number | undefined = undefined;

    @state() private accessor aspectPreview: number | null = null;
    #aspectEditing = false;
    #aspectFullscreen = false;
    #lastPageRatio?: number;
    #aspectCaptureRevision = 0;
    #resetAspectDisabled = true;
    #aspectResize = new PageAspectResize({
        read: () => {
            const stage = this.renderRoot.querySelector(".page-stage");
            if (!this.isConnected || !this.#permissions.editing || !stage) return null;
            const rect = stage.getBoundingClientRect();
            return { ratio: this.#pageRatio, width: rect.width, height: rect.height };
        },
        preview: ratio => {
            if (ratio !== this.aspectPreview) this.#aspectCaptureRevision++;
            this.aspectPreview = ratio;
        },
        commit: ratio => transaction(this, async () => {
            if (!this.isConnected || !this.#permissions.editing) return;
            this.pageAspectRatio = ratio;
            await this.updateComplete;
            await this.#waitForThumbnail();
        }),
    });

    get #pageRatio() {
        return normalizePageAspectRatio(this.pageAspectRatio ?? NaN, this.orientation === "portrait" ? 9 / 16 : 16 / 9);
    }

    #positionAspectLabel(event: PointerEvent) {
        const handle = event.currentTarget as HTMLElement;
        const rect = handle.getBoundingClientRect();
        const position = event.clientX - rect.left;
        handle.style.setProperty("--_aspect-pointer", `${Math.max(32, Math.min(rect.width - 32, position))}px`);
    }

    #resizePagePointerDown(event: PointerEvent) {
        this.#positionAspectLabel(event);
        void this.#aspectResize.pointerdown(event);
    }

    /** Restore the exact orientation default by removing the authored override. */
    resetPageAspectRatio() {
        this.#aspectResize.disconnect();
        if (!this.hasAttribute("page-aspect-ratio") && this.pageAspectRatio === undefined) return;
        return transaction(this, async () => {
            this.removeAttribute("page-aspect-ratio");
            this.pageAspectRatio = undefined;
            this.requestUpdate();
            await this.updateComplete;
            await this.#waitForThumbnail();
        });
    }

    /**
     * All `webwriter-page` elements.
     * Represents the individual pages in the sequence of pages.
     */
    @queryAssignedElements({ selector: "webwriter-page" })
    protected accessor pages!: WebwriterPage[];

    /** Index of the currently active page. */
    @state()
    accessor activePageIndex = 0;

    @state()
    private accessor tabScroll = { backward: false, forward: false };

    #tabScroller: HTMLElement | null = null;
    #tabResizeObserver?: ResizeObserver;
    #pageAttributesObserver = new MutationObserver((records) => {
        if (records.some((record) =>
            (record.target.parentNode === this && (record.target as Element).localName === "webwriter-page")
            || (this.type === "branches" && (record.attributeName === "id" || record.type === "childList"))
        )) {
            this.requestUpdate();
        }
    });
    #documentSignalObserver = new MutationObserver((records) => {
        if (this.type !== "branches") return;
        const affectsSignalLookup = records.some((record) => {
            if (this.contains(record.target)) return false;
            if (record.type === "attributes") return record.attributeName === "id";
            return [...record.addedNodes, ...record.removedNodes].some((node) =>
                node instanceof Element && (node.localName.includes("-") || node.hasAttribute("id") || node.querySelector("[id]"))
            );
        });
        if (affectsSignalLookup) this.requestUpdate();
    });
    #pendingSignalTags = new Set<string>();

    #page = signal(1);
    #count = signal(0);

    /** Public signals: the current page number (from 1) and the number of pages. */
    readonly signals = { page: this.#page, count: this.#count };

    #actionsDisabled = { duplicateActivePage: true, removeActivePage: true };
    #lifecycle?: AbortController;
    #changeTimer?: ReturnType<typeof setTimeout>;
    #changeFinished?: () => void;
    #thumbnailTask = Promise.resolve();
    #touchStartX: number | null = null;
    #touchStartY = 0;
    #touchTarget: Element | null = null;
    #completedPages = new Set<WebwriterPage>();
    #completionPage?: WebwriterPage;
    #completionVisible = false;
    #completionReachedBottom = false;
    #completionIntersection?: IntersectionObserver;
    #completionResize?: ResizeObserver;
    #completionMutation?: MutationObserver;
    #completionFrame?: number;
    #readingBranches = false;
    @state() private accessor branchGraphExpanded = false;
    #branchPageAnimation?: Animation;
    #highlightedWidgets: Element[] = [];
    #highlightAbort?: AbortController;
    #highlightResize?: ResizeObserver;
    @state() private accessor highlightRects: Array<{ top: number; left: number; width: number; height: number }> = [];
    #conditionMonitorAbort?: AbortController;
    #conditionMonitorTimer?: ReturnType<typeof setInterval>;
    #conditionMonitorFrame?: number;
    #conditionMonitorRoot?: ParentNode;
    #branchAvailabilityKey = "";

    /** The drawer declarations with the availability of the page actions, which follows the pages. */
    get actions() {
        const actions = resolveDeclarations<ActionDeclaration>(this, WebwriterPages.actions)!;
        return {
            ...actions,
            duplicateActivePage: { ...actions.duplicateActivePage, disabled: this.#actionsDisabled.duplicateActivePage },
            removeActivePage: { ...actions.removeActivePage, disabled: this.#actionsDisabled.removeActivePage },
            resetPageAspectRatio: { ...actions.resetPageAspectRatio, disabled: !this.hasAttribute("page-aspect-ratio") },
        };
    }

    /** The active page element based on the activePageIndex. */
    get activePage(): WebwriterPage {
        return this.pages[this.activePageIndex];
    }

    /** False if Pages is on the last page. */
    get hasNextPage(): boolean {
        return this.activePageIndex < this.pages?.length - 1;
    }

    /** False if Pages is on the first page. */
    get hasPreviousPage(): boolean {
        return this.activePageIndex > 0;
    }

    /** Whether the sequence of pages is currently displayed in fullscreen mode. */
    protected get isFullscreen() {
        return this.ownerDocument.fullscreenElement === this;
    }

    constructor() {
        super();
        // Reordering by pointer or keyboard is for authors only.
        new Drag(this, { can: () => this.#permissions.editing });
        this.addEventListener("fullscreenchange", this.#handleFullscreenChange);
    }

    #handleFullscreenChange = async (event: Event) => {
        if (event.target !== this) return;
        this.requestUpdate();
        if (!this.isFullscreen) return;
        await this.updateComplete;
        const page = this.activePage;
        if (!this.isConnected || !this.isFullscreen || !this.#permissions.editing || page?.parentElement !== this
            || (this.type === "branches" && this.branchGraphExpanded)) return;
        page.scrollTop = 0;
        this.#selectPageStart(page, { firstElementOnly: true });
    };

    connectedCallback() {
        super.connectedCallback?.();
        this.#lifecycle = new AbortController();
        const { signal } = this.#lifecycle;

        window.addEventListener("keydown", this.#aspectResize.cancelOnEscape, { capture: true, signal });
        window.addEventListener("keydown", (e) => this.#handleKeyDown(e), { signal });
        document.addEventListener("selectionchange", () => this.#handleSelectionChange(), { passive: true, signal });
        this.addEventListener("touchstart", (e) => this.#handleTouchStart(e), { passive: true, signal });
        this.addEventListener("touchend", (e) => this.#handleTouchEnd(e), { passive: true, signal });
        this.addEventListener("scroll", (e) => {
            if (e.target === this.#completionPage) this.#queueCompletionCheck();
        }, { capture: true, passive: true, signal });
        this.addEventListener("load", this.#queueCompletionCheck, { capture: true, signal });
        this.addEventListener("error", this.#queueCompletionCheck, { capture: true, signal });
        document.addEventListener("visibilitychange", this.#queueCompletionCheck, { signal });
        this.#pageAttributesObserver.observe(this, { childList: true, attributes: true, attributeFilter: ["label", "style", "class", "page-key", "branches", "node-x", "node-y", "id"], subtree: true });
        this.#documentSignalObserver.observe(signalRootFor(this), { childList: true, subtree: true, attributes: true, attributeFilter: ["id"] });
        this.requestUpdate();
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.#lifecycle?.abort();
        this.#lifecycle = undefined;
        clearTimeout(this.#changeTimer);
        this.#changeFinished?.();
        this.#changeFinished = undefined;
        this.#tabResizeObserver?.disconnect();
        this.#tabScroller = null;
        this.#pageAttributesObserver.disconnect();
        this.#documentSignalObserver.disconnect();
        this.#pendingSignalTags.clear();
        this.#setHighlightedWidgets([]);
        this.#stopConditionMonitoring();
        this.#branchPageAnimation?.cancel();
        this.#branchPageAnimation = undefined;
        this.#stopCompletionTracking();
        this.#aspectResize.disconnect();
    }

    protected firstUpdated(): void {
        this.requestUpdate();
    }

    protected willUpdate(changed: PropertyValues) {
        super.willUpdate(changed);
        const editing = this.#permissions.editing;
        const viewChanged = changed.has("authoredType") || changed.has("legacyHidePagination");
        if (viewChanged || changed.has("activePageIndex") || this.branchGraphExpanded) {
            this.#branchPageAnimation?.cancel();
            this.#branchPageAnimation = undefined;
        }
        if (viewChanged || changed.has("orientation") || changed.has("pageAspectRatio") ||
            this.#aspectEditing !== editing || this.#aspectFullscreen !== this.isFullscreen) this.#aspectResize.disconnect();
        this.#aspectEditing = editing;
        this.#aspectFullscreen = this.isFullscreen;
        if (this.#highlightedWidgets.length && (changed.has("activePageIndex") || this.type !== "branches" || !editing)) {
            this.#setHighlightedWidgets([]);
        }
        const pages = this.pages ?? [];
        if (this.type === "branches" && this.#permissions.editing && pages.length) {
            const keys = pages.map(pageKey);
            if (keys.some((key) => !key) || new Set(keys).size !== keys.length) {
                transaction(this, () => ensurePageKeys(pages));
            }
        }
    }

    /**
     * Lifecycle method called whenever the component is updated.
     * Updates each page's `active` property based on the current activePageIndex.
     */
    protected updated(changed: PropertyValues) {
        super.updated(changed);
        const readingBranches = this.type === "branches" && !this.#permissions.editing;
        if (readingBranches && !this.#readingBranches) {
            const start = this.pages.findIndex((page) => pageKey(page) === this.startPage && this.startPage);
            const index = Math.max(0, start);
            if (this.activePageIndex !== index) this.activePageIndex = index;
        }
        this.#readingBranches = readingBranches;
        if (this.pages.length && this.activePageIndex >= this.pages.length) this.activePageIndex = this.pages.length - 1;
        const ratio = this.#pageRatio;
        if (this.#lastPageRatio !== undefined && ratio !== this.#lastPageRatio) {
            this.#aspectCaptureRevision++;
            if (this.#permissions.editing) this.changePage(this.activePageIndex);
        }
        this.#lastPageRatio = ratio;
        const scroller = this.renderRoot.querySelector<HTMLElement>(".page-tabs-wrapper");
        if (scroller !== this.#tabScroller) {
            this.#tabResizeObserver?.disconnect();
            this.#tabScroller = scroller;
            if (scroller) {
                this.#tabResizeObserver ??= new ResizeObserver(this.#updateTabScroll);
                this.#tabResizeObserver.observe(scroller);
                if (scroller.firstElementChild) this.#tabResizeObserver.observe(scroller.firstElementChild);
                const stage = this.renderRoot.querySelector(".page-stage");
                if (stage) this.#tabResizeObserver.observe(stage);
                const viewport = this.renderRoot.querySelector(".page-viewport");
                if (viewport) this.#tabResizeObserver.observe(viewport);
            }
        }
        this.#updateTabScroll();
        this.pages?.forEach(
            (page, i) => (page.active = i === this.activePageIndex)
        );
        this.#syncCompletionTracking();
        this.#syncConditionMonitoring();
        this.#page.set(this.activePageIndex + 1);
        this.#count.set(this.pages?.length ?? 0);
        const duplicateDisabled = !this.activePage;
        const removeDisabled = duplicateDisabled || this.pages.length <= 1;
        const resetDisabled = !this.hasAttribute("page-aspect-ratio");
        if (changed.has("authoredType") || changed.has("legacyHidePagination") || this.#actionsDisabled.duplicateActivePage !== duplicateDisabled ||
            this.#actionsDisabled.removeActivePage !== removeDisabled || this.#resetAspectDisabled !== resetDisabled) {
            this.#actionsDisabled = { duplicateActivePage: duplicateDisabled, removeActivePage: removeDisabled };
            this.#resetAspectDisabled = resetDisabled;
            this.dispatchEvent(new Event("optionschange", { bubbles: true }));
        }
    }

    #stopCompletionTracking() {
        this.#completionIntersection?.disconnect();
        this.#completionResize?.disconnect();
        this.#completionMutation?.disconnect();
        if (this.#completionFrame !== undefined) cancelAnimationFrame(this.#completionFrame);
        this.#completionFrame = undefined;
        this.#completionPage = undefined;
        this.#completionVisible = false;
        this.#completionReachedBottom = false;
    }

    #syncCompletionTracking() {
        // Keep progress attached to page identity through reordering, never to an index or clone.
        for (const page of this.#completedPages) {
            if (!this.pages.includes(page)) this.#completedPages.delete(page);
        }
        const page = this.isConnected && this.type !== "branches" && this.completionIndicators && !this.#permissions.editing ? this.activePage : undefined;
        if (page !== this.#completionPage) {
            const previous = this.#completionPage;
            if (page && previous && this.pages.includes(previous)) {
                // Sample once more before the old page is hidden: a scroll and navigation
                // can happen before the scheduled animation-frame check.
                this.#checkCompletion();
                if (this.#completionReachedBottom && !this.#completedPages.has(previous)) {
                    this.#completedPages.add(previous);
                    this.requestUpdate();
                }
            }
            this.#stopCompletionTracking();
            this.#completionPage = page;
            if (page) {
                this.#completionIntersection = new IntersectionObserver((entries) => {
                    if (this.#completionPage !== page) return;
                    this.#completionVisible = entries.some((entry) => entry.isIntersecting);
                    this.#queueCompletionCheck();
                });
                this.#completionIntersection.observe(page);
                this.#completionResize = new ResizeObserver(this.#queueCompletionCheck);
                const observeContent = () => {
                    if (this.#completionPage !== page) return;
                    this.#completionResize!.disconnect();
                    this.#completionResize!.observe(page);
                    for (const child of page.children) this.#completionResize!.observe(child);
                    this.#queueCompletionCheck();
                };
                this.#completionMutation = new MutationObserver(observeContent);
                this.#completionMutation.observe(page, { childList: true, subtree: true, characterData: true, attributes: true });
                observeContent();
            }
        }
        this.#queueCompletionCheck();
    }

    #queueCompletionCheck = () => {
        if (!this.#completionPage || this.#completionFrame !== undefined) return;
        this.#completionFrame = requestAnimationFrame(() => {
            this.#completionFrame = undefined;
            this.#checkCompletion();
        });
    };

    #checkCompletion() {
        const page = this.#completionPage;
        if (!page || !this.isConnected || !this.completionIndicators || this.#permissions.editing ||
            !this.#completionVisible || document.hidden || this.#completionReachedBottom ||
            this.#completedPages.has(page) || page.clientHeight === 0) return;
        // Wait for pending images before deciding that the content fits without scrolling.
        if (Array.from(page.querySelectorAll("img")).some((image) => !image.complete && image.getClientRects().length)) return;
        // scrollTop can be fractional, whereas the dimensions are rounded by the browser.
        if (page.scrollHeight - page.clientHeight - Math.max(0, page.scrollTop) > 1) return;
        this.#completionReachedBottom = true;
    }

    #updateTabScroll = () => {
        const tabs = this.renderRoot.querySelector<HTMLElement>('[part="tabs"]');
        const stage = this.renderRoot.querySelector<HTMLElement>(".page-stage");
        if (tabs && stage) {
            const style = getComputedStyle(stage);
            const width = style.inlineSize;
            if (tabs.style.getPropertyValue("--_page-inline-size") !== width) tabs.style.setProperty("--_page-inline-size", width);
            const viewport = this.renderRoot.querySelector<HTMLElement>(".page-viewport");
            const offset = Math.max(0, ((viewport?.clientHeight ?? 0) - parseFloat(style.blockSize)) / 2) + parseFloat(getComputedStyle(tabs).borderBottomWidth);
            const position = `${offset}px`;
            if (tabs.style.getPropertyValue("--_page-block-offset") !== position) tabs.style.setProperty("--_page-block-offset", position);
        }
        const scroller = this.#tabScroller;
        const max = scroller ? Math.max(0, scroller.scrollWidth - scroller.clientWidth) : 0;
        const rtl = scroller && getComputedStyle(scroller).direction === "rtl";
        const position = scroller ? Math.max(0, Math.min(max, scroller.scrollLeft * (rtl ? -1 : 1))) : 0;
        const backward = position > 1;
        const forward = position < max - 1;
        if (backward !== this.tabScroll.backward || forward !== this.tabScroll.forward) {
            this.tabScroll = { backward, forward };
        }
    };

    #scrollTabs = (backwards: boolean) => {
        const scroller = this.#tabScroller;
        if (!scroller?.isConnected) return;
        const direction = getComputedStyle(scroller).direction === "rtl" ? -1 : 1;
        scroller.scrollBy({
            left: scroller.clientWidth * 0.8 * (backwards ? -1 : 1) * direction,
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        });
    };

    #setPageLabel = (page: WebwriterPage, label: string) => {
        if (!this.#permissions.editing || !page.isConnected || page.parentElement !== this || page !== this.activePage || page.getAttribute("label") === label) return;
        transaction(this, () => {
            if (label) page.setAttribute("label", label);
            else page.removeAttribute("label");
            this.requestUpdate();
        });
    };

    #setBranches = (page: WebwriterPage, branches: PageBranch[], draft?: { target: string; result: ConditionsDraftResult }) => {
        if (!this.#permissions.editing || page.parentElement !== this) return;
        transaction(this, () => {
            let next = branches;
            if (draft) {
                const resolved = resolveConditionsForSave(draft.result, signalRootFor(this));
                next = branches.map((branch) => {
                    if (branch.target !== draft.target) return branch;
                    const { when: _when, whenUnmet: _unmet, whenMatch: _match, ...rest } = branch;
                    return { ...rest, ...resolved };
                });
            }
            writeBranches(page, next);
            this.requestUpdate();
        });
    };

    #addPageChoice = (source: WebwriterPage, label: string, draft?: ConditionsDraftResult) => {
        if (!this.#permissions.editing || source.parentElement !== this) return;
        transaction(this, () => {
            const target = this.#createPage();
            ensurePageKeys(this.pages);
            const resolved = draft ? resolveConditionsForSave(draft, signalRootFor(this)) : {};
            writeBranches(source, [...readBranches(source), { target: pageKey(target), label, ...resolved }]);
            this.requestUpdate();
        });
    };

    #addBranchPage = (point: { x: number; y: number }) => {
        if (!this.#permissions.editing || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
        transaction(this, () => {
            const page = this.#createPage();
            page.setAttribute("node-x", String(Math.round((point.x - 100) / 10) * 10));
            page.setAttribute("node-y", String(Math.round((point.y - 46) / 10) * 10));
            ensurePageKeys(this.pages);
            this.changePage(this.pages.indexOf(page));
            this.requestUpdate();
            return this.updateComplete;
        });
    };

    #moveBranchPages = (items: MoveDetail["items"]) => {
        if (!this.#permissions.editing) return;
        transaction(this, () => {
            for (const { key, x, y } of items) {
                const page = this.pages.find((page) => pageKey(page) === key);
                if (!page || !Number.isFinite(x) || !Number.isFinite(y)) continue;
                page.setAttribute("node-x", String(x));
                page.setAttribute("node-y", String(y));
            }
            this.requestUpdate();
        });
    };

    #setStartPage = (page: WebwriterPage) => {
        if (!this.#permissions.editing || page.parentElement !== this || !pageKey(page)) return;
        transaction(this, () => this.setAttribute("start-page", pageKey(page)));
    };

    #followBranch = async (target: string) => {
        const source = this.activePage;
        const branch = source && readBranches(source).find((entry) => entry.target === target);
        if (!source || !branch) return;
        if (!this.#permissions.editing && !evaluateBranch(branch, signalRootFor(this)).available) return;
        const index = this.pages.findIndex((page) => pageKey(page) === target);
        if (index < 0) return;
        this.branchGraphExpanded = false;
        this.changePage(index);
        await this.updateComplete;
        const page = this.activePage;
        if (!this.isConnected || this.type !== "branches" || this.branchGraphExpanded || !page || pageKey(page) !== target) return;
        page.scrollTop = 0;
        this.#fadeInBranchPage();
        // The chosen button disappears; keep keyboard reading at the new page.
        this.renderRoot.querySelector<HTMLElement>(".page-stage")?.focus({ preventScroll: true });
    };

    #openBranchPage = async (index: number) => {
        const page = this.pages[index];
        if (!page || !this.#permissions.editing) return;
        this.branchGraphExpanded = false;
        this.changePage(index);
        await this.updateComplete;
        if (!this.isConnected || this.type !== "branches" || this.activePage !== page || this.branchGraphExpanded) return;
        this.#fadeInBranchPage();
        this.#selectPageStart(page);
    };

    #fadeInBranchPage() {
        this.#branchPageAnimation?.cancel();
        if (!this.ownerDocument.defaultView?.matchMedia("screen and (prefers-reduced-motion: no-preference)").matches) return;
        const slot = this.renderRoot.querySelector<HTMLSlotElement>(".page-stage > slot");
        this.#branchPageAnimation = slot?.animate?.([{ opacity: 0.45 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
    }

    /** Replaces the pages with the pages a `section` stands for; declines anything else. */
    loadSections(fragment: DocumentFragment): boolean {
        const source = fragment.firstElementChild;
        if (source?.localName !== "section") return false;
        this.replaceChildren(...sectionToPages(source, this.ownerDocument));
        this.activePageIndex = 0;
        return true;
    }

    /** One `details` per page with its label as summary; `null` without pages. */
    toDetails(): DocumentFragment | null {
        const pages = Array.from(this.children).filter((child) => child.localName === "webwriter-page");
        if (!pages.length) return null;
        const fragment = this.ownerDocument.createDocumentFragment();
        fragment.append(...pages.map((page, index) => pageToDetails(page, this.ownerDocument, this.msg("Page") + " " + (index + 1))));
        return fragment;
    }

    duplicateActivePage() { this.duplicatePage(this.activePageIndex); }

    /** Add a new empty page element. Optionally insert after given index. */
    addPage(index?: number) {
        transaction(this, () => this.#addPage(index));
    }

    #createPage(index?: number) {
        const page = this.ownerDocument.createElement(
            "webwriter-page"
        ) as WebwriterPage;
        const p = this.ownerDocument.createElement("p");
        page.appendChild(p);

        if (index !== undefined && index >= 0 && index < this.pages.length) {
            const refPage = this.pages[index];
            refPage.insertAdjacentElement("afterend", page);
        } else {
            this.appendChild(page);
        }

        return page;
    }

    #addPage(index?: number) {
        const page = this.#createPage(index);
        this.changePage(this.pages.indexOf(page));

        // A shadow control keeps its focus and capture; external actions start writing in the new page.
        const selection = (this.renderRoot as ShadowRoot).activeElement ? null : this.ownerDocument.getSelection();
        if (selection) {
            selection.setBaseAndExtent(page.firstElementChild!, 0, page.firstElementChild!, 0);
        }
        return this.updateComplete;
    }

    /** Duplicate an existing page at given index. */
    duplicatePage(index: number) {
        transaction(this, () => this.#duplicatePage(index));
    }

    #duplicatePage(index: number) {
        const original = this.pages[index];
        if (!original) return;

        const clone = original.cloneNode(true) as WebwriterPage;
        clone.removeAttribute("page-key");
        clone.removeAttribute("node-x");
        clone.removeAttribute("node-y");
        original.insertAdjacentElement("afterend", clone);

        this.changePage(this.pages.indexOf(clone));
        return this.updateComplete;
    }

    /** Remove the currently active page element. */
    removeActivePage() {
        if (this.pages.length > 1 && this.activePage) {
            this.removePage(this.activePageIndex);
        }
    }

    /** Remove a page and return editor selection to the surviving active page's start. */
    removePage(pageIndex: number) {
        if (this.pages.length <= 1 || !this.pages[pageIndex]) return;
        transaction(this, async () => {
            const page = this.pages[pageIndex];
            if (this.pages.length <= 1 || !page) return;
            const key = pageKey(page);
            if (key) {
                for (const other of this.pages) {
                    const branches = readBranches(other);
                    if (branches.some((branch) => branch.target === key)) writeBranches(other, branches.filter((branch) => branch.target !== key));
                }
                if (this.startPage === key) this.removeAttribute("start-page");
            }
            page.remove();
            this.changePage(Math.min(this.activePageIndex, this.pages.length - 1));
            const active = this.activePage;
            this.requestUpdate();
            await this.updateComplete;
            await active?.updateComplete;
            if (this.isConnected && active && this.activePage === active && this.#permissions.editing) {
                if (this.type === "branches" && this.branchGraphExpanded) this.renderRoot.querySelector<PagesBranches>("pages-branches")?.focus({ preventScroll: true });
                else this.#selectPageStart(active);
            }
        });
    }

    /** Return document editing to the first content of the page. */
    #selectPageStart(page: WebwriterPage, { firstElementOnly = false } = {}) {
        (this.renderRoot as ShadowRoot).activeElement?.closest<HTMLElement>("sl-icon-button, input, button")?.blur();
        this.blur();
        const selection = this.ownerDocument.getSelection();
        if (!selection) return;
        let node: Node = page;
        let first: Element | undefined;
        let textContainer: Element | undefined;
        while (node instanceof Element) {
            if (node !== page && (node.localName.includes("-") || node.matches("img, picture, svg, math, video, audio, canvas, iframe, object, embed, hr, input, textarea, select, button, [contenteditable='false']"))) break;
            const textBlock = node.matches("p, h1, h2, h3, h4, h5, h6, pre, li, td, th, summary");
            if (firstElementOnly && node === first && !textBlock) break;
            if (textBlock) textContainer = node;
            const child = Array.from(node.childNodes).find((child) => child instanceof Text ? Boolean(child.data.trim())
                : child instanceof Element && !child.matches("[hidden], [inert], script, style, template") && getComputedStyle(child).display !== "none");
            if (!child || child instanceof HTMLBRElement) {
                if (node === page || node.matches("p, h1, h2, h3, h4, h5, h6, div, pre, li, td, th, summary")) {
                    selection.setPosition(node, 0);
                    return;
                }
                break;
            }
            if (node === page && child instanceof Element) first = child;
            node = child;
        }
        if (node instanceof Text) selection.setPosition(node, 0);
        else if (textContainer) selection.setPosition(textContainer, 0);
        else if (first) {
            const range = this.ownerDocument.createRange();
            range.selectNode(first);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /** Activate the next page element. */
    nextPage(backwards = false, step = 1) {
        const i = this.activePageIndex;
        const n = this.pages?.length - 1;
        this.changePage(
            backwards ? Math.max(0, i - step) : Math.min(n, i + step)
        );
    }

    /** Follows the selection to the page that contains it. */
    #handleSelectionChange() {
        if ((this.renderRoot as ShadowRoot).activeElement?.classList.contains("page-label-input")) return;
        const selectedPageIndex = this.pages?.findIndex((page) =>
            document.getSelection()?.containsNode(page, true)
        );
        if (selectedPageIndex !== undefined && selectedPageIndex !== -1) {
            this.changePage(selectedPageIndex);
            this.requestUpdate();
        }
    }

    /**
     * Handles keyboard navigation for the sequence of pages.
     * ArrowRight advances to the next page, ArrowLeft goes back.
     * Only possible in preview mode.
     */
    #handleKeyDown(e: KeyboardEvent) {
        if (this.#permissions.editing || this.type === "branches" || e.defaultPrevented || e.altKey || e.metaKey) return;
        if (e.composedPath().some((node) => node instanceof HTMLElement && this.#takesText(node))) return;

        switch (e.key) {
            case "ArrowRight":
                this.handleNextPageClick(e);
                break;
            case "ArrowLeft":
                this.handleNextPageClick(e, true);
                break;
        }
    }

    /** Whether the element is a place where arrow keys move a caret or a value. */
    #takesText(el: HTMLElement) {
        if (el.isContentEditable) return true;
        return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || /^(textbox|combobox|pager|spinbutton|listbox)$/.test(el.getAttribute("role") ?? "");
    }

    /**
     * Handles the start of a touch event for swipe navigation.
     * Records the initial touch position and target element.
     * Only active in fullscreen mode.
     */
    #handleTouchStart(e: TouchEvent) {
        if (!this.isFullscreen || this.type === "branches") return;
        this.#touchStartX = e.touches[0].clientX;
        this.#touchStartY = e.touches[0].clientY;
        this.#touchTarget = e.target as Element;
    }

    /**
     * Determines if the given element or any of its ancestors (up to the sequence of pages container) is an interactive element.
     * Used to prevent swipe navigation when interacting with widgets or interactive elements.
     */
    #isInteractiveTarget(el: Element | null): boolean {
        const interactiveTags = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A", "VIDEO", "AUDIO", "CANVAS", "DETAILS", "SUMMARY"]);
        let node = el;
        while (node && node.tagName !== "WEBWRITER-PAGE") {
            if (interactiveTags.has(node.tagName)) return true;
            if (node.hasAttribute("contenteditable") && node.getAttribute("contenteditable") !== "false") return true;
            if (node.tagName.includes("-")) return true;
            node = node.parentElement;
        }
        return false;
    }

    /**
     * Handles the end of a touch event for swipe navigation.
     * Determines the swipe direction and navigates to the next or previous page accordingly.
     * Ignores swipes on interactive elements or if the swipe distance is too small.
     */
    #handleTouchEnd(e: TouchEvent) {
        if (!this.isFullscreen || this.type === "branches" || this.#touchStartX === null) return;
        const deltaX = e.changedTouches[0].clientX - this.#touchStartX;
        const deltaY = e.changedTouches[0].clientY - this.#touchStartY;
        const target = this.#touchTarget;
        this.#touchStartX = null;
        this.#touchTarget = null;
        if (this.#isInteractiveTarget(target) || Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
        this.nextPage(deltaX >= 0);
    }

    /**
     * Handles navigation to the next or previous page based on user input.
     * - Shift key: jump by the total number of pages.
     * - Ctrl key: jump by 10 pages.
     * - Otherwise: move by one page.
     *
     * @param e - The triggering mouse or keyboard event.
     * @param backwards - Whether to navigate backward (default is false).
     */
    protected handleNextPageClick(
        e: MouseEvent | KeyboardEvent,
        backwards = false
    ) {
        if (e.shiftKey) {
            this.nextPage(backwards, this.pages.length);
        } else if (e.ctrlKey) {
            this.nextPage(backwards, 10);
        } else {
            this.nextPage(backwards);
        }
    }

    /**
     * Changes the active page to the specified index.
     * Waits for rendering to finish, scrolls the active page into view,
     * and generates a thumbnail preview.
     *
     * @param index - The index of the page to activate.
     */
    protected changePage = (index: number) => {
        this.activePageIndex = index;

        // Wait briefly to ensure page rendering completes. Rapid calls (every selection change while
        // typing) collapse into one scroll and one thumbnail capture.
        clearTimeout(this.#changeTimer);
        this.#changeFinished?.();
        this.#changeFinished = undefined;
        if (this.type === "branches") {
            this.#thumbnailTask = Promise.resolve();
            return;
        }
        let finish!: () => void;
        this.#thumbnailTask = new Promise<void>(resolve => finish = resolve);
        this.#changeFinished = finish;
        this.#changeTimer = setTimeout(async () => {
            try {
                this.renderRoot.querySelector(".active")?.scrollIntoView({
                    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                    block: "nearest",
                    inline: "nearest",
                });

                const page = this.pages[index];
                const view = this.type;
                // Branch graph captures stay private to its overlay; only the strip writes thumbnails.
                if (!page || view === "branches") return;
                const ratio = this.#pageRatio;
                if (this.aspectPreview !== null) return;
                const revision = this.#aspectCaptureRevision;
                const thumbnail = await captureThumbnail(page);
                // Only keep the capture if the page has not changed in the meantime.
                if (!this.isConnected || this.activePage !== page || this.#pageRatio !== ratio || this.aspectPreview !== null || this.#aspectCaptureRevision !== revision || this.type !== view) return;
                page.thumbnail = thumbnail;
                this.requestUpdate();
                await page.updateComplete;
                await this.updateComplete;
            } finally {
                if (this.#changeFinished === finish) this.#changeFinished = undefined;
                finish();
            }
        }, 100);
    };

    /** Keep ratio snapshots in the same undo step, including a debounce replaced by a newer capture. */
    async #waitForThumbnail() {
        let task: Promise<void>;
        do {
            task = this.#thumbnailTask;
            await task;
        } while (this.isConnected && task !== this.#thumbnailTask);
    }

    /**
     * Moves the dragged page to the place the drop resolved to.
     * The thumbnails and tabs stand for the authored `webwriter-page` children,
     * so the commit moves the page itself and the lifted item settles at the new layout.
     */
    private onDragCommit(e: CustomEvent<DragCommitDetail>) {
        const from = Number(e.detail.key);
        const page = this.pages[from];
        const others = this.pages.filter((other) => other !== page);
        if (!page || e.detail.index === null) return;

        const next = others[e.detail.index];
        if (next) next.insertAdjacentElement("beforebegin", page);
        else others[others.length - 1].insertAdjacentElement("afterend", page);

        this.activePageIndex = e.detail.index;
        this.requestUpdate();
    }

    #watchPendingSignalTags = (tags: string[]) => {
        const registry = this.ownerDocument.defaultView?.customElements;
        if (!registry) return;
        for (const tag of tags) {
            if (this.#pendingSignalTags.has(tag)) continue;
            this.#pendingSignalTags.add(tag);
            void registry.whenDefined(tag).then(() => {
                this.#pendingSignalTags.delete(tag);
                if (this.isConnected) this.requestUpdate();
            });
        }
    };

    #setHighlightedWidgets = (elements: Element[]) => {
        const next = this.isConnected && this.#permissions.editing && this.type === "branches"
            ? elements.filter((el) => el.isConnected)
            : [];
        this.#highlightAbort?.abort();
        this.#highlightAbort = undefined;
        this.#highlightResize?.disconnect();
        this.#highlightResize = undefined;
        this.#highlightedWidgets = next;
        if (!next.length) {
            if (this.highlightRects.length) this.highlightRects = [];
            return;
        }
        this.#highlightAbort = new AbortController();
        const { signal } = this.#highlightAbort;
        window.addEventListener("scroll", this.#updateHighlightRects, { capture: true, passive: true, signal });
        window.addEventListener("resize", this.#updateHighlightRects, { passive: true, signal });
        this.#highlightResize = new ResizeObserver(this.#updateHighlightRects);
        this.#highlightResize.observe(this);
        for (const el of next) this.#highlightResize.observe(el);
        this.#updateHighlightRects();
    };

    #updateHighlightRects = () => {
        if (!this.isConnected || !this.#highlightedWidgets.length) {
            if (this.highlightRects.length) this.highlightRects = [];
            return;
        }
        const hostRect = this.getBoundingClientRect();
        const rects: Array<{ top: number; left: number; width: number; height: number }> = [];
        for (const el of this.#highlightedWidgets) {
            if (!el.isConnected) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            rects.push({
                top: rect.top - hostRect.top,
                left: rect.left - hostRect.left,
                width: rect.width,
                height: rect.height,
            });
        }
        this.highlightRects = rects;
    };

    #branchAvailabilitySnapshot(): string {
        const page = this.activePage;
        if (!page) return "";
        const root = signalRootFor(this);
        return readBranches(page)
            .map((branch) => (evaluateBranch(branch, root).available ? "1" : "0"))
            .join("");
    }

    #checkBranchConditions = () => {
        if (!this.isConnected || this.type !== "branches" || this.#permissions.editing) return;
        if (this.ownerDocument.visibilityState === "hidden") return;
        const next = this.#branchAvailabilitySnapshot();
        if (next !== this.#branchAvailabilityKey) {
            this.#branchAvailabilityKey = next;
            this.requestUpdate();
        }
    };

    #scheduleBranchConditionCheck = () => {
        queueMicrotask(this.#checkBranchConditions);
        if (this.#conditionMonitorFrame !== undefined) cancelAnimationFrame(this.#conditionMonitorFrame);
        this.#conditionMonitorFrame = requestAnimationFrame(() => {
            this.#conditionMonitorFrame = undefined;
            this.#checkBranchConditions();
        });
    };

    #stopConditionMonitoring() {
        this.#conditionMonitorAbort?.abort();
        this.#conditionMonitorAbort = undefined;
        if (this.#conditionMonitorTimer !== undefined) {
            clearInterval(this.#conditionMonitorTimer);
            this.#conditionMonitorTimer = undefined;
        }
        if (this.#conditionMonitorFrame !== undefined) {
            cancelAnimationFrame(this.#conditionMonitorFrame);
            this.#conditionMonitorFrame = undefined;
        }
        this.#conditionMonitorRoot = undefined;
        this.#branchAvailabilityKey = "";
    }

    #syncConditionMonitoring() {
        const page = this.activePage;
        const hasConditions = Boolean(page && readBranches(page).some((branch) => readBranchConditions(branch).length > 0));
        if (!this.isConnected || this.type !== "branches" || this.#permissions.editing || !hasConditions) {
            this.#stopConditionMonitoring();
            return;
        }
        const root = signalRootFor(this);
        if (this.#conditionMonitorRoot !== root) {
            this.#stopConditionMonitoring();
            this.#conditionMonitorRoot = root;
            this.#conditionMonitorAbort = new AbortController();
            const { signal } = this.#conditionMonitorAbort;
            for (const eventName of ["click", "change", "input", "keyup", "submit"] as const) {
                root.addEventListener(eventName, this.#scheduleBranchConditionCheck, { capture: true, passive: true, signal });
            }
            this.#conditionMonitorTimer = setInterval(this.#checkBranchConditions, 250);
        }
        this.#branchAvailabilityKey = this.#branchAvailabilitySnapshot();
    }

    /** The sequence of pages as seen by the strip and control components. */
    #view(): PagesView {
        return {
            msg: this.msg,
            pages: this.pages,
            activePageIndex: this.activePageIndex,
            editing: this.#permissions.editing,
            completionIndicators: this.completionIndicators,
            completedPages: this.#completedPages,
            isFullscreen: this.isFullscreen,
            hasPreviousPage: this.hasPreviousPage,
            hasNextPage: this.hasNextPage,
            canScrollTabsBackward: this.tabScroll.backward,
            canScrollTabsForward: this.tabScroll.forward,
            scrollTabs: this.#scrollTabs,
            onTabScroll: this.#updateTabScroll,
            setPageLabel: this.#setPageLabel,
            changePage: (index) => this.changePage(index),
            addPage: (index) => this.addPage(index),
            duplicatePage: (index) => this.duplicatePage(index),
            removePage: (index) => this.removePage(index),
            handleNextPageClick: (e, backwards) => this.handleNextPageClick(e, backwards),
            toggleFullscreen: () => {
                if (this.isFullscreen) this.ownerDocument.exitFullscreen();
                else this.requestFullscreen();
                this.requestUpdate();
            },
            onDragCommit: (e) => this.onDragCommit(e as CustomEvent<DragCommitDetail>),
        };
    }

    /**
     * Renders the current view with its page controls around the default slot.
     * The controls adapt depending on whether the component is editable.
     */
    render() {
        const view = this.#view();
        const layout = this.type;
        const branches = layout === "branches";
        const carousel = layout === "carousel";
        const ratio = this.aspectPreview ?? this.#pageRatio;
        return html`
            <div class="pages-layout ${layout}-view" style=${styleMap({ "--_page-ratio": String(ratio), "--_preview-ratio": String(this.orientation === "portrait" ? 9 / 16 : 16 / 9) })}
                role=${carousel ? "region" : nothing} aria-label=${carousel ? this.msg("Pages") : nothing}
                aria-roledescription=${carousel ? this.msg("Carousel") : nothing}>
                ${layout === "tabs" ? renderTabs(view) : nothing}
                <div class="page-viewport">
                    <div class="page-surface">
                        <div class="page-stage" tabindex=${branches ? "-1" : nothing}><slot class=${branches && view.editing && this.branchGraphExpanded ? "graph-preview-pages" : ""} ?inert=${branches && view.editing && this.branchGraphExpanded}></slot>
                            ${branches && view.editing ? html`<pages-branches id="branch-editor" part="branch-editor" contenteditable="false"
                                ?hidden=${!this.branchGraphExpanded} .collapsed=${!this.branchGraphExpanded}
                                .view=${view} .pageRatio=${ratio} .startKey=${this.startPage || pageKey(view.pages[0])}
                                .setBranches=${this.#setBranches} .movePages=${this.#moveBranchPages} .setStart=${this.#setStartPage} .addPageAt=${this.#addBranchPage} .openPage=${this.#openBranchPage}
                            ></pages-branches>` : nothing}
                            ${carousel ? html`<div class="controls-overlay slide-controls-overlay" contenteditable="false">
                                ${renderControls(view)}${renderAddPage(view, "icon")}
                            </div>` : nothing}
                            ${view.editing ? html`<div class="page-aspect-handle" role="separator" tabindex="0" contenteditable="false"
                                aria-label=${this.msg("Resize page aspect ratio")} title=${this.msg("Resize page aspect ratio")}
                                aria-orientation="horizontal"
                                aria-valuemin=${MIN_PAGE_ASPECT_RATIO} aria-valuemax=${MAX_PAGE_ASPECT_RATIO} aria-valuenow=${ratio} aria-valuetext=${formatPageAspectRatio(ratio)}
                                ?data-resizing=${this.aspectPreview !== null}
                                @pointerdown=${this.#resizePagePointerDown} @pointermove=${(event: PointerEvent) => { if (this.aspectPreview !== null) this.#positionAspectLabel(event); }} @keydown=${this.#aspectResize.keydown}>
                                ${this.aspectPreview !== null ? html`<span class="page-aspect-label" aria-hidden="true">${formatPageAspectRatio(ratio)}</span>` : nothing}
                            </div>` : nothing}
                        </div>
                    </div>
                </div>
                ${layout === "pages" ? renderThumbs(view) : nothing}
                ${branches ? renderBranchChoices(view, this.#setBranches, this.#followBranch, this.branchGraphExpanded, () => this.branchGraphExpanded = !this.branchGraphExpanded, this.#addPageChoice, this.localize.getLocale(), this.#watchPendingSignalTags, this.#setHighlightedWidgets) : nothing}
            </div>
            ${branches && view.editing && this.highlightRects.length ? html`
                <div class="condition-highlights" aria-hidden="true">
                    ${this.highlightRects.map((rect) => html`<div class="condition-highlight-box" style=${styleMap({
                        top: `${rect.top}px`,
                        left: `${rect.left}px`,
                        width: `${rect.width}px`,
                        height: `${rect.height}px`,
                    })}></div>`)}
                </div>
            ` : nothing}
        `;
    }
}
