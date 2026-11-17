import { html, type PropertyValues } from "lit";
import { LitElementWw, resolveDeclarations } from "@webwriter/lit";
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
import type { ActionDeclaration, OptionDeclaration, OptionGroupDeclaration, Declared } from "@webwriter/widget";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js";
import "@shoelace-style/shoelace/dist/themes/light.css";
// @ts-ignore The Lit localization CLI generates this JavaScript module.
import { sourceLocale, targetLocales } from "../../localization/generated/locale-codes.js";

import { WebwriterSlide } from "./webwriter-slide";
import { slides_styles } from "../components/webwriter-slides.styles";
import { renderControls } from "../components/slides-controls";
import { renderThumbs, renderTabs } from "../components/slides-strip";
import { captureThumbnail } from "../components/slide-thumbnail";
import type { SlidesView } from "../model/slides-view";

type Labelled = { msg: MsgFn };

/**
 * Container for displaying a slideshow of content sequentially.
 *
 * Authors add `webwriter-slide` children; the `type` attribute switches between a thumbnail strip ("slides")
 * and a tab strip ("tabs"). Thumbnails are drawn in the editor with a capture library that loads on first use.
 * In use mode the arrow keys, the controls and swipes in fullscreen move between slides.
 *
 * @slot default - Slide elements to be displayed (should be `webwriter-slide` components only).
 */
@customElement("webwriter-slides")
export class WebwriterSlides extends LitElementWw {
    static styles = slides_styles;

    static scopedElements = {
        "sl-icon-button": SlIconButton,
        "sl-tooltip": SlTooltip,
    };

    static options = {
        type: {
            type: "select",
            group: "presentation",
            label: (widget: Labelled) => widget.msg("View"),
            options: [
                { value: "tabs", label: (widget: Labelled) => widget.msg("Tabs") },
                { value: "slides", label: (widget: Labelled) => widget.msg("Slides") },
            ],
        },
    } satisfies Record<string, Declared<OptionDeclaration>>;

    static optionGroups = {
        presentation: { label: (widget: Labelled) => widget.msg("Presentation"), collapsible: true, advanced: false },
    } satisfies Record<string, Declared<OptionGroupDeclaration>>;

    static actions = {
        addSlide: { label: (widget: Labelled) => widget.msg("Add slide"), group: "presentation", icon: "Add", intent: "default" },
        duplicateActiveSlide: { label: (widget: Labelled) => widget.msg("Duplicate current slide"), group: "presentation", icon: "Copy", intent: "default", disabled: true },
        removeActiveSlide: { label: (widget: Labelled) => widget.msg("Remove current slide"), group: "presentation", icon: "Delete", intent: "danger", disabled: true },
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

    /**
     * Defines the type of view for the slideshow.
     * - "slides": Show content as sequential slides.
     * - "tabs": Show content using tabs.
     */
    @property({ type: String, attribute: true, reflect: true })
    public accessor type: "tabs" | "slides" = "slides";

    /**
     * All `webwriter-slide` elements.
     * Represents the individual slides in the slideshow.
     */
    @queryAssignedElements()
    protected accessor slides!: WebwriterSlide[];

    /** Index of the currently active slide. */
    @state()
    accessor activeSlideIndex = 0;

    #actionsDisabled = { duplicateActiveSlide: true, removeActiveSlide: true };
    #lifecycle?: AbortController;
    #changeTimer?: ReturnType<typeof setTimeout>;
    #touchStartX: number | null = null;
    #touchTarget: Element | null = null;

    /** The drawer declarations with the availability of the slide actions, which follows the slides. */
    get actions() {
        const actions = resolveDeclarations<ActionDeclaration>(this, WebwriterSlides.actions)!;
        return {
            ...actions,
            duplicateActiveSlide: { ...actions.duplicateActiveSlide, disabled: this.#actionsDisabled.duplicateActiveSlide },
            removeActiveSlide: { ...actions.removeActiveSlide, disabled: this.#actionsDisabled.removeActiveSlide },
        };
    }

    /** The active slide element based on the activeSlideIndex. */
    get activeSlide(): WebwriterSlide {
        return this.slides[this.activeSlideIndex];
    }

    /** False if slideshow is on the last slide. */
    get hasNextSlide(): boolean {
        return this.activeSlideIndex < this.slides?.length - 1;
    }

    /** False if slideshow is on the first slide. */
    get hasPreviousSlide(): boolean {
        return this.activeSlideIndex > 0;
    }

    /** Whether the slideshow is currently displayed in fullscreen mode. */
    protected get isFullscreen() {
        return this.ownerDocument.fullscreenElement === this;
    }

    constructor() {
        super();
        // Reordering by pointer or keyboard is for authors only.
        new Drag(this, { can: () => this.#permissions.editing });
        this.addEventListener("fullscreenchange", () => this.requestUpdate());
    }

    connectedCallback() {
        super.connectedCallback?.();
        this.#lifecycle = new AbortController();
        const { signal } = this.#lifecycle;

        window.addEventListener("keydown", (e) => this.#handleKeyDown(e), { signal });
        document.addEventListener("selectionchange", () => this.#handleSelectionChange(), { passive: true, signal });
        this.addEventListener("touchstart", (e) => this.#handleTouchStart(e), { passive: true, signal });
        this.addEventListener("touchend", (e) => this.#handleTouchEnd(e), { passive: true, signal });
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.#lifecycle?.abort();
        this.#lifecycle = undefined;
        clearTimeout(this.#changeTimer);
    }

    protected firstUpdated(): void {
        this.requestUpdate();
    }

    /**
     * Lifecycle method called whenever the component is updated.
     * Updates each slide's `active` property based on the current activeSlideIndex.
     */
    protected updated(changed: PropertyValues<this>) {
        super.updated(changed);
        this.slides?.forEach(
            (slide, i) => (slide.active = i === this.activeSlideIndex)
        );
        const duplicateDisabled = !this.activeSlide;
        const removeDisabled = duplicateDisabled || this.slides.length <= 1;
        if (this.#actionsDisabled.duplicateActiveSlide !== duplicateDisabled ||
            this.#actionsDisabled.removeActiveSlide !== removeDisabled) {
            this.#actionsDisabled = { duplicateActiveSlide: duplicateDisabled, removeActiveSlide: removeDisabled };
            this.dispatchEvent(new Event("optionschange", { bubbles: true }));
        }
    }

    duplicateActiveSlide() { this.duplicateSlide(this.activeSlideIndex); }

    /** Add a new empty slide element. Optionally insert after given index. */
    addSlide(index?: number) {
        transaction(this, () => this.#addSlide(index));
    }

    #addSlide(index?: number) {
        const slide = this.ownerDocument.createElement(
            "webwriter-slide"
        ) as WebwriterSlide;
        const p = this.ownerDocument.createElement("p");
        slide.appendChild(p);

        if (index !== undefined && index >= 0 && index < this.slides.length) {
            const refSlide = this.slides[index];
            refSlide.insertAdjacentElement("afterend", slide);
        } else {
            this.appendChild(slide);
        }

        this.changeSlide(this.slides.indexOf(slide));

        // place cursor at the start of the new slide
        const selection = document.getSelection();
        if (selection) {
            selection.setBaseAndExtent(p, 0, p, 0);
        }
        return this.updateComplete;
    }

    /** Duplicate an existing slide at given index. */
    duplicateSlide(index: number) {
        transaction(this, () => this.#duplicateSlide(index));
    }

    #duplicateSlide(index: number) {
        const original = this.slides[index];
        if (!original) return;

        const clone = original.cloneNode(true) as WebwriterSlide;
        original.insertAdjacentElement("afterend", clone);

        this.changeSlide(this.slides.indexOf(clone));
        return this.updateComplete;
    }

    /** Remove the currently active slide element. */
    removeActiveSlide() {
        if (this.slides.length > 1 && this.activeSlide) {
            this.removeSlide(this.activeSlideIndex);
        }
    }

    /** Remove the currently active slide element. */
    removeSlide(slideIndex: number) {
        transaction(this, () => {
            this.slides[slideIndex].remove();
            if (this.activeSlideIndex > this.slides.length - 1) {
                this.changeSlide(this.slides.length - 1);
            }
            this.requestUpdate();
            return this.updateComplete;
        });
    }

    /** Activate the next slide element. */
    nextSlide(backwards = false, step = 1) {
        const i = this.activeSlideIndex;
        const n = this.slides?.length - 1;
        this.changeSlide(
            backwards ? Math.max(0, i - step) : Math.min(n, i + step)
        );
    }

    /** Follows the selection to the slide that contains it. */
    #handleSelectionChange() {
        const selectedSlideIndex = this.slides?.findIndex((slide) =>
            document.getSelection()?.containsNode(slide, true)
        );
        if (selectedSlideIndex !== undefined && selectedSlideIndex !== -1) {
            this.changeSlide(selectedSlideIndex);
            this.requestUpdate();
        }
    }

    /**
     * Handles keyboard navigation for the slideshow.
     * ArrowRight advances to the next slide, ArrowLeft goes back.
     * Only possible in preview mode.
     */
    #handleKeyDown(e: KeyboardEvent) {
        if (this.#permissions.editing) return;

        switch (e.key) {
            case "ArrowRight":
                this.handleNextSlideClick(e);
                break;
            case "ArrowLeft":
                this.handleNextSlideClick(e, true);
                break;
        }
    }

    /**
     * Handles the start of a touch event for swipe navigation.
     * Records the initial touch position and target element.
     * Only active in fullscreen mode.
     */
    #handleTouchStart(e: TouchEvent) {
        if (!this.isFullscreen) return;
        this.#touchStartX = e.touches[0].clientX;
        this.#touchTarget = e.target as Element;
    }

    /**
     * Determines if the given element or any of its ancestors (up to the slideshow container) is an interactive element.
     * Used to prevent swipe navigation when interacting with widgets or interactive elements.
     */
    #isInteractiveTarget(el: Element | null): boolean {
        const interactiveTags = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A", "VIDEO", "AUDIO", "CANVAS", "DETAILS", "SUMMARY"]);
        let node = el;
        while (node && node.tagName !== "WEBWRITER-SLIDE") {
            if (interactiveTags.has(node.tagName)) return true;
            if (node.hasAttribute("contenteditable") && node.getAttribute("contenteditable") !== "false") return true;
            if (node.tagName.includes("-")) return true;
            node = node.parentElement;
        }
        return false;
    }

    /**
     * Handles the end of a touch event for swipe navigation.
     * Determines the swipe direction and navigates to the next or previous slide accordingly.
     * Ignores swipes on interactive elements or if the swipe distance is too small.
     */
    #handleTouchEnd(e: TouchEvent) {
        if (!this.isFullscreen || this.#touchStartX === null) return;
        const deltaX = e.changedTouches[0].clientX - this.#touchStartX;
        const target = this.#touchTarget;
        this.#touchStartX = null;
        this.#touchTarget = null;
        if (this.#isInteractiveTarget(target) || Math.abs(deltaX) < 50) return;
        this.nextSlide(deltaX >= 0);
    }

    /**
     * Handles navigation to the next or previous slide based on user input.
     * - Shift key: jump by the total number of slides.
     * - Ctrl key: jump by 10 slides.
     * - Otherwise: move by one slide.
     *
     * @param e - The triggering mouse or keyboard event.
     * @param backwards - Whether to navigate backward (default is false).
     */
    protected handleNextSlideClick(
        e: MouseEvent | KeyboardEvent,
        backwards = false
    ) {
        if (e.shiftKey) {
            this.nextSlide(backwards, this.slides.length);
        } else if (e.ctrlKey) {
            this.nextSlide(backwards, 10);
        } else {
            this.nextSlide(backwards);
        }
    }

    /**
     * Changes the active slide to the specified index.
     * Waits for rendering to finish, scrolls the active slide into view,
     * and generates a thumbnail preview.
     *
     * @param index - The index of the slide to activate.
     */
    protected changeSlide = (index: number) => {
        this.activeSlideIndex = index;

        // Wait briefly to ensure slide rendering completes. Rapid calls (every selection change while
        // typing) collapse into one scroll and one thumbnail capture.
        clearTimeout(this.#changeTimer);
        this.#changeTimer = setTimeout(async () => {
            this.renderRoot.querySelector(".active")?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest",
            });

            const slide = this.slides[index];
            if (!slide) return;
            const thumbnail = await captureThumbnail(slide);
            // Only keep the capture if the slide has not changed in the meantime.
            if (this.activeSlideIndex !== index) return;
            slide.thumbnail = thumbnail;
            this.requestUpdate();
        }, 100);
    };

    /**
     * Moves the dragged slide to the place the drop resolved to.
     * The thumbnails and tabs stand for the authored `webwriter-slide` children,
     * so the commit moves the slide itself and the lifted item settles at the new layout.
     */
    private onDragCommit(e: CustomEvent<DragCommitDetail>) {
        const from = Number(e.detail.key);
        const slide = this.slides[from];
        const others = this.slides.filter((other) => other !== slide);
        if (!slide || e.detail.index === null) return;

        const next = others[e.detail.index];
        if (next) next.insertAdjacentElement("beforebegin", slide);
        else others[others.length - 1].insertAdjacentElement("afterend", slide);

        this.activeSlideIndex = e.detail.index;
        this.requestUpdate();
    }

    /** The slideshow as seen by the strip and control components. */
    #view(): SlidesView {
        return {
            msg: this.msg,
            slides: this.slides,
            activeSlideIndex: this.activeSlideIndex,
            editing: this.#permissions.editing,
            isFullscreen: this.isFullscreen,
            hasPreviousSlide: this.hasPreviousSlide,
            hasNextSlide: this.hasNextSlide,
            changeSlide: (index) => this.changeSlide(index),
            addSlide: (index) => this.addSlide(index),
            duplicateSlide: (index) => this.duplicateSlide(index),
            removeSlide: (index) => this.removeSlide(index),
            handleNextSlideClick: (e, backwards) => this.handleNextSlideClick(e, backwards),
            toggleFullscreen: () => {
                if (this.isFullscreen) this.ownerDocument.exitFullscreen();
                else this.requestFullscreen();
                this.requestUpdate();
            },
            onDragCommit: (e) => this.onDragCommit(e as CustomEvent<DragCommitDetail>),
        };
    }

    /**
     * Renders the tab strip or the thumbnail strip with the slide controls around the default slot.
     * The controls adapt depending on whether the component is editable.
     */
    render() {
        const view = this.#view();
        return html`
            ${this.type == "tabs" ? renderTabs(view) : html``}
            <slot></slot>
            ${this.type == "slides"
                ? this.isFullscreen
                    ? html`<div class="controls-overlay">${renderControls(view)}</div>`
                    : renderThumbs(view)
                : html``}
        `;
    }
}
