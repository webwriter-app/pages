import { html } from "lit";
import fullscreenIcon from "@tabler/icons/outline/arrows-maximize.svg";
import fullscreenExitIcon from "@tabler/icons/outline/arrows-minimize.svg";
import chevronLeftIcon from "@tabler/icons/outline/chevron-left.svg";
import chevronRightIcon from "@tabler/icons/outline/chevron-right.svg";
import removeIcon from "@tabler/icons/outline/circle-x.svg";
import addIcon from "@tabler/icons/outline/circle-plus.svg";
import duplicateIcon from "@tabler/icons/outline/copy.svg";
import type { SlidesView } from "../model/slides-view";

/** Duplicate and remove buttons of one slide in the tab or thumbnail strip. */
export function renderSlideButtons(view: SlidesView, index: number, tooltipPlacement: "top" | "right" | "bottom" | "left" = "top") {
    return html`
        <sl-tooltip
            data-ww-can="edit"
            content=${view.msg("Duplicate slide")}
            placement=${tooltipPlacement}
            hoist
        >
            <sl-icon-button
                class="duplicate-btn"
                @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    view.duplicateSlide(index);
                }}
                src=${duplicateIcon}
            ></sl-icon-button>
        </sl-tooltip>
        ${view.slides.length > 1 ? html`
            <sl-tooltip
                data-ww-can="edit"
                content=${view.msg("Remove slide")}
                placement=${tooltipPlacement}
                hoist
            >
                <sl-icon-button
                    class="remove-btn"
                    @click=${(e: MouseEvent) => {
                        e.stopPropagation();
                        view.removeSlide(index);
                    }}
                    src=${removeIcon}
                ></sl-icon-button>
            </sl-tooltip>
        ` : html``}
    `;
}

/** Add, previous/next and fullscreen controls. */
export function renderControls(view: SlidesView) {
    return html` <div class="controls-section" data-ww-can="edit">
            <sl-tooltip
                content=${view.msg("Add slide after current")}
                placement="bottom"
            >
                <sl-icon-button
                    class="add-btn"
                    @click=${(e: MouseEvent) => {
                        e.stopPropagation();
                        view.addSlide(view.activeSlideIndex);
                    }}
                    src=${addIcon}
                ></sl-icon-button>
            </sl-tooltip>
        </div>
        <div class="controls-section">
            <sl-tooltip
                content=${view.msg("Go to previous slide")}
                placement="bottom"
            >
                <sl-icon-button
                    @click=${(e: MouseEvent) => view.handleNextSlideClick(e, true)}
                    src=${chevronLeftIcon}
                    ?disabled=${!view.hasPreviousSlide}
                ></sl-icon-button>
            </sl-tooltip>
            <div class="slides-index">
                <span>${view.activeSlideIndex + 1}</span> /
                <span>${view.slides?.length}</span>
            </div>
            <sl-tooltip
                content=${view.msg("Go to next slide")}
                placement="bottom"
            >
                <sl-icon-button
                    @click=${(e: MouseEvent) => view.handleNextSlideClick(e)}
                    src=${chevronRightIcon}
                    ?disabled=${!view.hasNextSlide}
                ></sl-icon-button>
            </sl-tooltip>
        </div>
        <div class="controls-section">
            <sl-tooltip
                content=${view.isFullscreen
                    ? view.msg("Exit fullscreen")
                    : view.msg("Show in fullscreen")}
                placement="bottom"
            >
                <sl-icon-button
                    id="fullscreen"
                    class="fullscreen-btn"
                    src=${view.isFullscreen ? fullscreenExitIcon : fullscreenIcon}
                    @click=${() => view.toggleFullscreen()}
                ></sl-icon-button>
            </sl-tooltip>
        </div>`;
}
