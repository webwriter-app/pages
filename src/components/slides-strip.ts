import { html, nothing } from "lit";
import type { SlidesView } from "../model/slides-view";
import { renderControls, renderSlideButtons } from "./slides-controls";

/** The tab strip with its controls, shown in the "tabs" view. */
export function renderTabs(view: SlidesView) {
    return html`<aside part="tabs">
        <div class="slide-tabs-wrapper">
            <div class="slide-tabs" data-ww-drop="slide" data-ww-drop-position="index" @ww-dragcommit=${view.onDragCommit}>
                ${view.slides.map(
                    (_slide, index) => html`
                        <div
                            class="slide-tab ${index === view.activeSlideIndex ? "active" : ""}"
                            @click=${() => view.changeSlide(index)}
                            data-ww-drag=${view.editing ? "slide" : nothing}
                            data-ww-drag-via="pointer keyboard"
                            data-ww-key=${index}
                        >
                            <div class="slide-number">${index + 1}</div>
                            <div class="spacer"></div>

                            ${renderSlideButtons(view, index, "right")}
                        </div>
                    `
                )}
            </div>
        </div>
        <div class="controls-rows">${renderControls(view)}</div>
    </aside>`;
}

/** The thumbnail strip with its controls, shown in the "slides" view outside fullscreen. */
export function renderThumbs(view: SlidesView) {
    return html`<aside part="actions">
        <div class="slide-thumbs" data-ww-drop="slide" data-ww-drop-position="index" @ww-dragcommit=${view.onDragCommit}>
            ${view.slides.map(
                (slide, index) => html`
                    <div
                        class="slide-thumb ${index === view.activeSlideIndex ? "active" : ""}"
                        @click=${() => view.changeSlide(index)}
                        data-ww-drag=${view.editing ? "slide" : nothing}
                        data-ww-drag-via="pointer keyboard"
                        data-ww-key=${index}
                    >
                        ${slide.thumbnail
                            ? html`<img class="slide-thumb-img" draggable="false" src=${slide.thumbnail} />`
                            : html`<div class="slide-thumb-img"></div>`}

                        <div class="slide-options">
                            <div class="slide-number">${index + 1}</div>
                            <div class="spacer"></div>

                            ${renderSlideButtons(view, index)}
                        </div>
                    </div>
                `
            )}
        </div>
        <div class="controls-columns">${renderControls(view)}</div>
    </aside>`;
}
