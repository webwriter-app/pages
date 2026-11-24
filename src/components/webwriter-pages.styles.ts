import { css } from "lit";

/**
 * Styles for the pages overview.
 */
export const pages_styles = css`
    :host {
        position: relative;
        background: var(--sl-panel-background-color);
        color: var(--ww-text-color, inherit);
        font-family: var(--ww-font-family, inherit);
        --_accent: var(--ww-theme-accent-1, var(--sl-color-primary-600));
        --_accent-soft: color-mix(in srgb, var(--ww-theme-accent-1) 12%, white);
        --_page-action-size: 24px;
        --_page-action-space: calc(var(--_page-action-size) / 2 + var(--sl-focus-ring-offset));
        display: block;
        box-sizing: border-box;
        min-width: min(300px, 100%);
        max-width: 2100px;
        margin-inline: auto;
        container-type: inline-size;
        container-name: pages;
    }

    :host(:not(:fullscreen):not(.ww-fullscreen)) {
        width: 100%;
        block-size: auto;
    }

    .pages-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
    }

    [part="branch-editor"] {
        position: absolute;
        inset: 0;
        z-index: 2;
        box-sizing: border-box;
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-medium) var(--sl-border-radius-medium) 0 0;
        overflow: clip;
        user-select: none;
    }

    .branch-controls {
        display: flex;
        align-items: flex-start;
        gap: var(--sl-spacing-small);
        padding: var(--sl-spacing-small);
        background: var(--sl-color-neutral-50);
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        border-block-start: 0;
        border-radius: 0 0 var(--sl-border-radius-medium) var(--sl-border-radius-medium);
        user-select: none;
    }

    .branch-choices {
        display: flex;
        flex: 1;
        min-inline-size: 0;
        min-block-size: 36px;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--sl-spacing-small);
        padding-block-start: 4px;
    }

    .branch-choice-wrap { position: relative; max-inline-size: 100%; }
    .branch-choice-wrap .branch-choice { padding-inline-end: 24px; }

    .branch-tools {
        --_branch-tool-size: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        align-self: center;
        flex: 0 0 auto;
        margin-block: calc(var(--sl-spacing-small) * -1);
        gap: 0;
    }
    .branch-fullscreen { display: flex; }
    .branch-fullscreen sl-icon-button::part(base) {
        box-sizing: border-box;
        inline-size: var(--_branch-tool-size);
        block-size: var(--_branch-tool-size);
        padding: 4px;
    }
    .branch-controls .graph-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        inline-size: var(--_branch-tool-size);
        min-block-size: var(--_branch-tool-size);
        padding: 0;
        border: 0;
        background: transparent;
    }
    .graph-toggle:dir(rtl) sl-icon { transform: scaleX(-1); }

    .branch-controls button, .branch-controls input, .branch-controls select {
        box-sizing: border-box;
        min-block-size: 36px;
        min-inline-size: 0;
        max-inline-size: 100%;
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-small);
        border: 1px solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-medium);
        background: var(--sl-panel-background-color);
        color: inherit;
        font: inherit;
    }

    .branch-controls button { cursor: pointer; overflow-wrap: anywhere; }
    .branch-controls button:disabled { opacity: 0.45; cursor: default; }
    .branch-controls sl-icon { font-size: 16px; pointer-events: none; }
    .branch-controls .choice-goto, .branch-controls .choice-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 24px;
        min-block-size: 24px;
        block-size: 24px;
        padding: 0;
        border-radius: 50%;
    }
    .choice-goto {
        position: absolute;
        inset-block-start: -8px;
        inset-inline-end: -6px;
        box-shadow: 0 1px 3px #0002;
    }
    .branch-controls .add-choice { display: inline-flex; align-items: center; justify-content: center; inline-size: 36px; padding: 0; }
    .choice-popover {
        inline-size: 20rem;
        max-inline-size: calc(100vw - 24px);
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        overflow: visible;
    }
    .choice-bubble {
        position: relative;
        padding: 12px;
        background: var(--sl-panel-background-color, white);
        border: 1px solid var(--sl-panel-border-color, #ddd);
        border-radius: var(--sl-border-radius-medium, 6px);
        box-shadow: 0 4px 20px #0002;
    }
    .choice-popover-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-block-end: 12px; font-weight: 600; }
    .choice-form { display: grid; gap: 12px; max-block-size: calc(100dvh - 110px); overflow: auto; }
    .choice-form label { display: grid; gap: 4px; font-size: 0.9em; }
    .choice-form :is(input, select) { inline-size: 100%; }
    .choice-popover-actions { display: flex; flex-wrap: wrap; justify-content: end; gap: 8px; }
    .choice-popover-actions .remove-choice { margin-inline-end: auto; }
    @supports (position-area: block-start) {
        .choice-popover:popover-open {
            inset: auto;
            margin: 12px 0;
            position-area: block-start span-inline-end;
            justify-self: start;
            position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
        }
    }
    @supports (container-type: anchored) {
        .choice-popover:popover-open { container-type: anchored; }
        .choice-popover:popover-open .choice-bubble::after { content: ""; }
        .choice-bubble::after {
            position: absolute;
            inline-size: 10px;
            block-size: 10px;
            inset-inline-start: 12px;
            inset-block-end: -6px;
            background: inherit;
            border-inline-end: inherit;
            border-block-end: inherit;
            transform: rotate(45deg);
        }
        @container anchored(fallback: flip-block) or anchored(fallback: flip-block flip-inline) {
            .choice-bubble::after { inset-block-start: -6px; inset-block-end: auto; transform: rotate(225deg); }
        }
        @container anchored(fallback: flip-inline) or anchored(fallback: flip-block flip-inline) {
            .choice-bubble::after { inset-inline-start: auto; inset-inline-end: 12px; }
        }
    }
    .branch-controls :is(button, input, select):focus-visible {
        outline: var(--sl-focus-ring-width) solid var(--_accent);
        outline-offset: var(--sl-focus-ring-offset);
    }

    .branch-controls .choice-form :is(input, select):focus {
        outline: 2px solid var(--sl-color-neutral-600, #52525b);
        outline-offset: -2px;
    }

    @media (hover: hover) {
        .branch-controls button:not(:disabled):hover { border-color: var(--_accent); }
        .branch-controls .graph-toggle:hover { background: transparent; color: var(--_accent); }
        .choice-popover-actions .remove-choice:hover { color: var(--sl-color-danger-600); border-color: currentColor; }
    }
    @media (pointer: coarse) {
        .branch-controls :is(button, input, select) { min-block-size: 44px; }
        .branch-tools { --_branch-tool-size: 44px; }
    }

    :host([type="branches"]) ::slotted(webwriter-page) {
        border-end-start-radius: 0;
        border-end-end-radius: 0;
    }

    :host(:fullscreen) .branch-controls,
    :host(.ww-fullscreen) .branch-controls {
        flex: 0 0 auto;
        border-color: transparent;
        border-radius: 0;
    }

    .page-stage {
        position: relative;
        min-inline-size: 0;
        inline-size: 100%;
        block-size: auto;
        align-self: center;
        aspect-ratio: var(--_page-ratio);
    }

    .page-aspect-handle {
        position: absolute;
        inset-inline: 0;
        block-size: 10px;
        z-index: 3;
        cursor: row-resize;
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
        outline: none;
    }

    .page-aspect-handle.top { inset-block-start: 0; }
    .page-aspect-handle.bottom { inset-block-end: 0; }
    .page-aspect-handle.inline-end {
        inset-inline: auto 0;
        inset-block: 0;
        inline-size: 10px;
        block-size: auto;
        cursor: col-resize;
    }

    .page-aspect-handle::after {
        content: "";
        position: absolute;
        inset-inline: 0;
        inset-block-start: 50%;
        block-size: 2px;
        background: var(--_accent);
        opacity: 0;
        pointer-events: none;
    }

    .page-aspect-handle.inline-end::after {
        inset-inline: 50% auto;
        inset-block: 0;
        inline-size: 2px;
        block-size: auto;
    }

    .page-aspect-handle:is(:hover, :focus-visible, [data-resizing])::after { opacity: 1; }

    .page-aspect-label {
        position: absolute;
        left: var(--_aspect-pointer, 50%);
        inset-block-end: calc(100% + 4px);
        translate: -50% 0;
        padding: 2px 6px;
        border: 1px solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-small);
        background: var(--sl-panel-background-color);
        color: var(--ww-text-color, inherit);
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
        pointer-events: none;
    }

    .page-aspect-handle.top .page-aspect-label { inset-block-end: auto; inset-block-start: calc(100% + 4px); }
    .page-aspect-handle.inline-end .page-aspect-label {
        left: auto;
        inset-inline-end: calc(100% + 4px);
        inset-block: var(--_aspect-pointer, 50%) auto;
        translate: 0 -50%;
    }

    .page-viewport {
        display: contents;
    }

    .page-surface {
        display: contents;
    }

    :host(:fullscreen),
    :host(.ww-fullscreen) {
        max-width: none;
        background: var(--sl-color-neutral-50);
    }

    :host::backdrop {
        background: var(--sl-color-neutral-50, #f9f9f9);
    }

    :host(:fullscreen) .pages-layout,
    :host(.ww-fullscreen) .pages-layout {
        display: flex;
        flex-direction: column;
        block-size: 100%;
    }

    :host(:fullscreen) .page-viewport,
    :host(.ww-fullscreen) .page-viewport {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        place-items: center;
        flex: 1 1 0;
        min-block-size: 0;
        container-type: size;
    }

    :host(:fullscreen) .page-stage,
    :host(.ww-fullscreen) .page-stage {
        inline-size: min(100cqi, calc(100cqb * var(--_page-ratio)));
        background: var(--sl-panel-background-color);
        margin: 0;
    }

    :host(:fullscreen:not([hide-pagination])) .pages-view .page-surface,
    :host(.ww-fullscreen:not([hide-pagination])) .pages-view .page-surface {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: var(--sl-spacing-small);
        inline-size: max-content;
        max-inline-size: 100%;
    }

    :host(:fullscreen:not([hide-pagination])) .pages-view .page-stage,
    :host(.ww-fullscreen:not([hide-pagination])) .pages-view .page-stage {
        grid-column: 1;
        grid-row: 1;
        inline-size: calc(100cqb * var(--_page-ratio));
        max-inline-size: 100%;
    }

    :host(:fullscreen:not([hide-pagination])) .pages-view .page-surface:dir(rtl),
    :host(.ww-fullscreen:not([hide-pagination])) .pages-view .page-surface:dir(rtl) {
        grid-template-columns: auto minmax(0, 1fr);
    }

    :host(:fullscreen:not([hide-pagination])) .pages-view .page-surface:dir(rtl) > .page-stage,
    :host(.ww-fullscreen:not([hide-pagination])) .pages-view .page-surface:dir(rtl) > .page-stage {
        grid-column: 2;
    }

    :host(:fullscreen) .pages-view .page-surface:dir(rtl) > .controls-overlay,
    :host(.ww-fullscreen) .pages-view .page-surface:dir(rtl) > .controls-overlay {
        grid-column: 1;
    }

    [part="tabs"] {
        inline-size: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: var(--sl-spacing-x-small);
        position: relative;
        z-index: 1;
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-medium) var(--sl-border-radius-medium) 0 0;
        background: var(--sl-color-neutral-50);
        flex: 0 0 auto;
    }

    :host(:fullscreen) [part="tabs"],
    :host(.ww-fullscreen) [part="tabs"] {
        padding-inline: max(0px, calc((100% - var(--_page-inline-size, 100%)) / 2 - var(--sl-panel-border-width)));
        column-gap: 0;
        border-color: transparent;
        transform: translateY(var(--_page-block-offset, 0px));
    }

    :host(:fullscreen) [part="tabs"]::before,
    :host(.ww-fullscreen) [part="tabs"]::before {
        content: "";
        position: absolute;
        inline-size: var(--_page-inline-size, 100%);
        block-size: var(--sl-panel-border-width);
        inset-inline-start: 50%;
        inset-block-end: calc(var(--sl-panel-border-width) * -1);
        transform: translateX(-50%);
        background: var(--sl-panel-border-color);
        pointer-events: none;
        z-index: -1;
    }

    [part="tabs"],
    [part="actions"],
    .controls-overlay {
        user-select: none;
    }

    [part="actions"] {
        --_preview-height: 4rem;
        --_thumb-width: calc(var(--_preview-height) * var(--_preview-ratio));
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: var(--sl-spacing-x-small);
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        border-block-start: 0;
        border-radius: 0 0 var(--sl-border-radius-medium) var(--sl-border-radius-medium);
        background-color: var(--sl-color-neutral-50);
    }

    :host([orientation="portrait"]) [part="actions"] {
        --_preview-height: 6rem;
    }

    :host([type="pages"]:not(:fullscreen):not(.ww-fullscreen):not([hide-pagination])) ::slotted(webwriter-page) {
        border-end-start-radius: 0;
        border-end-end-radius: 0;
    }

    .tabs-view .page-stage {
        margin-block-start: calc(var(--sl-panel-border-width) * -1);
    }

    :host(:not([type="pages"]):not([type="branches"])) ::slotted(webwriter-page) {
        border-start-start-radius: 0;
        border-start-end-radius: 0;
    }

    .pages-index {
        user-select: none;
        font-size: var(--sl-font-size-medium);
        color: var(--ww-text-color, var(--sl-color-neutral-800));
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5ch;
    }

    ::slotted(webwriter-page:not(:state(ww-page-active))) {
        display: none !important;
    }

    /* Keep inactive pages laid out for thumbnail capture. Paint a backdrop
       between them and the active page so only the active page shows during the reveal. */
    @media screen {
        slot.graph-preview-pages { isolation: isolate; }

        slot.graph-preview-pages::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 1;
            background: var(--sl-panel-background-color, Canvas);
        }

        slot.graph-preview-pages::slotted(webwriter-page) {
            display: block !important;
            position: absolute;
            inset: 0;
            z-index: 0;
        }

        slot.graph-preview-pages::slotted(webwriter-page:state(ww-page-active)) { z-index: 2; }
    }

    slot:not([name]) {
        display: block;
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    ::slotted(webwriter-page) {
        width: 100% !important;
        height: 100% !important;
    }

    .controls-columns, .controls-rows {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--sl-spacing-x-small);
        border-radius: var(--sl-border-radius-medium);
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        background-color: var(--sl-color-neutral-50);
    }

    .controls-columns {
        flex-direction: column;
        flex: 0 0 auto;
        border: 0;
        padding: var(--sl-spacing-x-small);
        background: none;
    }

    .controls-rows {
        box-sizing: border-box;
        block-size: 40px;
        flex-direction: row;
        gap: var(--sl-spacing-2x-small);
        margin: 0;
        padding-block: 0;
        border: 0;
        border-radius: 0;
        background: none;
    }

    .controls-section {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--sl-spacing-2x-small);
    }

    .pages-view .controls-section:has(> .completion-overview) {
        flex-direction: column;
    }

    .completion-bubble {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        inline-size: 20px;
        block-size: 20px;
        box-sizing: border-box;
        border: 1px solid var(--sl-color-neutral-300);
        border-radius: 50%;
        background: var(--sl-panel-background-color);
        color: var(--sl-color-neutral-400);
        font-size: 14px;
    }

    .completion-bubble.complete {
        color: var(--sl-color-success-700);
        background: var(--sl-color-success-100);
        border-color: var(--sl-color-success-600);
    }

    .page-completion {
        position: absolute;
        inset-inline-end: var(--sl-spacing-2x-small);
        inset-block-end: var(--sl-spacing-2x-small);
    }

    .page-tab.completed {
        padding-inline-end: calc(var(--sl-spacing-small) + 20px);
    }

    .page-tab .page-completion {
        inset-block: 0;
        margin-block: auto;
    }

    .page-tab .page-actions:has(+ .page-completion) {
        inset-inline-end: calc(var(--sl-spacing-2x-small) + 24px);
    }

    .tabs-scroll-backward:dir(rtl),
    .tabs-scroll-forward:dir(rtl) {
        transform: scaleX(-1);
    }

    .page-thumbs {
        grid-column: 1;
        grid-row: 1;
        display: flex;
        align-items: start;
        flex-direction: row;
        flex: 1 1 auto;
        min-inline-size: 0;
        gap: var(--sl-spacing-x-small);
        padding: var(--_page-action-space);
        padding-block-end: var(--sl-spacing-2x-small);
        /* scrollbar-gutter only reserves inline edges, not the bottom edge. */
        overflow-x: scroll;
        scrollbar-width: thin;
        --_scrollbar-thumb: var(--sl-color-neutral-500);
        --_scrollbar-track: var(--sl-color-neutral-50);
        scrollbar-color: var(--_scrollbar-thumb) var(--_scrollbar-track);
    }

    .page-thumb, .add-page {
        inline-size: var(--_thumb-width, 120px);
        aspect-ratio: var(--_page-ratio);
        box-sizing: border-box;
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        cursor: pointer;
        border-radius: var(--sl-border-radius-medium);
        flex: 0 0 auto;
        overflow: hidden;
    }

    .page-thumb {
        block-size: calc(var(--_thumb-width) / var(--_page-ratio));
        scroll-margin-inline: var(--_page-action-space);
        scroll-margin-block-start: var(--_page-action-space);
        max-inline-size: 100%;
        overflow: visible;
    }

    .preview-actions {
        grid-column: 2;
        grid-row: 1;
        display: flex;
        align-items: center;
        align-self: start;
        margin-block-start: var(--_page-action-space);
        margin-inline-end: var(--sl-spacing-x-small);
    }

    .preview-actions > .add-page {
        block-size: calc(var(--_thumb-width) / var(--_page-ratio));
        margin: 0;
    }

    .add-page {
        align-self: start;
        margin-block-start: var(--sl-spacing-x-small);
        padding: 0;
        font: inherit;
        font-size: var(--sl-font-size-small);
        color: var(--sl-color-neutral-600);
        background: var(--sl-color-neutral-50);
        border-style: dashed;
    }

    .add-page:hover,
    .add-page:focus-visible {
        color: var(--_accent);
        border-color: var(--_accent);
        background: var(--sl-panel-background-color);
    }

    .page-tabs-row > .add-page {
        align-self: end;
        inline-size: 48px;
        block-size: 40px;
        aspect-ratio: auto;
        margin: 0;
        border-radius: var(--sl-border-radius-medium) var(--sl-border-radius-medium) 0 0;
        border-block-end: 0;
        background: transparent;
    }

    .page-thumb[data-ww-dragging], .page-tab[data-ww-dragging] {
        opacity: 0.5;
    }

    .page-thumb.active {
        border-color: var(--_accent);
        background: var(--_accent-soft, var(--sl-color-primary-50));
    }

    .page-thumb:focus-visible,
    .add-page:focus-visible,
    .page-thumbs:focus-visible,
    .page-select:focus-visible {
        outline: var(--sl-focus-ring-width) solid var(--_accent);
        outline-offset: var(--sl-focus-ring-offset);
    }

    .page-select {
        font: inherit;
        color: inherit;
        background: none;
        border: 0;
        cursor: pointer;
        border-radius: var(--sl-border-radius-small);
    }

    .page-thumb-select {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        width: 100%;
        min-height: 0;
        padding: 0;
        border-radius: inherit;
        overflow: clip;
    }

    .page-thumb-select:focus-visible {
        outline-offset: calc(var(--sl-focus-ring-width) * -1);
    }

    .page-thumb-img {
        width: 100%;
        flex: 1;
        min-height: 0;
        object-fit: cover;
    }

    .remove-btn,
    .page-number,
    .fullscreen-btn {
        cursor: pointer;
        color: var(--sl-color-neutral-800);
        font-size: var(--sl-font-size-small);
    }

    .page-tabs-row {
        container: page-tabs / inline-size;
        --_tab-add-space: 0px;
        display: flex;
        align-items: end;
        min-inline-size: 0;
        gap: var(--sl-spacing-2x-small);
        padding: 0 0 0 var(--sl-spacing-x-small);
        margin-block-end: calc(var(--sl-panel-border-width) * -1);
    }

    .page-tabs-row.has-add {
        --_tab-add-space: calc(48px + var(--sl-spacing-2x-small));
    }

    .page-tabs-wrapper {
        flex: 0 1 auto;
        min-inline-size: 0;
        padding: var(--sl-spacing-2x-small) var(--sl-focus-ring-offset) var(--sl-panel-border-width);
        overflow-y: hidden;
        overflow-x: auto;
        scrollbar-width: none;
    }

    .page-tabs-wrapper::-webkit-scrollbar {
        display: none;
    }

    .page-tabs {
        display: flex;
        inline-size: max-content;
        gap: var(--sl-spacing-2x-small);
        cursor: pointer;
    }

    .page-tab {
        position: relative;
        box-sizing: border-box;
        background: transparent;
        display: flex;
        inline-size: auto;
        min-inline-size: clamp(5rem, calc((100cqi - var(--_tab-add-space) - var(--sl-focus-ring-offset) - var(--_page-action-space) - (var(--_tab-count) - 1) * var(--sl-spacing-2x-small)) / var(--_tab-count)), 12rem);
        block-size: 40px;
        border-radius: var(--sl-border-radius-medium) var(--sl-border-radius-medium) 0 0;
        padding: 0 var(--sl-spacing-2x-small) 0 var(--sl-spacing-small);
        align-items: center;
        border: var(--sl-panel-border-width) solid transparent;
        border-block-end: 0;
        flex-shrink: 0;
    }

    .page-tab.active {
        border-color: var(--sl-panel-border-color);
        background: var(--_page-background, var(--sl-panel-background-color));
    }

    .page-tab.active::after {
        content: "";
        position: absolute;
        inset-inline: 0;
        inset-block-end: calc(var(--sl-panel-border-width) * -1);
        block-size: var(--sl-panel-border-width);
        background: var(--_page-background, var(--sl-panel-background-color));
    }

    .page-tab:focus-visible {
        outline: var(--sl-focus-ring-width) solid var(--_accent);
        outline-offset: var(--sl-focus-ring-offset);
    }

    .page-options {
        position: absolute;
        inset-inline: 0;
        inset-block-end: 0;
        display: flex;
        width: 100%;
        align-items: center;
        box-sizing: border-box;
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-2x-small);
        padding-left: var(--sl-spacing-small);
        pointer-events: none;
    }

    .page-options > .page-number {
        opacity: 0.5;
        background: var(--sl-panel-background-color);
        border-radius: var(--sl-border-radius-small);
    }

    .page-options > .page-number {
        padding: var(--sl-spacing-3x-small) var(--sl-spacing-2x-small);
    }

    .page-thumb:hover .page-options > *,
    .page-thumb:focus-within .page-options > * {
        opacity: 1;
    }

    .page-number {
        font-weight: var(--sl-font-weight-semibold);
    }

    .page-tab .page-select {
        text-align: start;
        padding: 0;
        align-self: stretch;
        font-size: var(--sl-font-size-small);
        max-inline-size: 30ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .page-label-field {
        display: flex;
        align-items: center;
        font-size: var(--sl-font-size-small);
    }

    .page-label-input {
        field-sizing: content;
        inline-size: auto;
        min-inline-size: 4ch;
        max-inline-size: 30ch;
        align-self: center;
        padding: 0;
        border: 0;
        border-radius: var(--sl-border-radius-small);
        background: transparent;
        color: inherit;
        font: inherit;
        line-height: 1.5;
        user-select: text;
    }

    .page-label-input::placeholder,
    .page-label-placeholder {
        color: var(--sl-color-neutral-500);
        opacity: 1;
    }

    .page-label-input:focus {
        outline: none;
    }

    @supports not (field-sizing: content) {
        .page-label-field {
            display: inline-grid;
            min-inline-size: 4ch;
            max-inline-size: 30ch;
        }

        .page-label-field::after,
        .page-label-input {
            grid-area: 1 / 1;
        }

        .page-label-field::after {
            content: attr(data-label) " ";
            visibility: hidden;
            white-space: pre;
        }

        .page-label-input {
            inline-size: 0;
            min-inline-size: 100%;
        }
    }

    .page-actions {
        position: absolute;
        inset-block-start: calc(var(--_page-action-size) / -2);
        inset-inline-end: calc(var(--_page-action-size) / -2);
        display: flex;
        z-index: 2;
    }

    .page-tab .page-actions {
        inset-block: 0;
        inset-inline-end: var(--sl-spacing-2x-small);
        align-items: center;
    }

    .page-actions sl-icon-button {
        position: relative;
        isolation: isolate;
        inline-size: var(--_page-action-size);
        block-size: var(--_page-action-size);
        font-size: 12px;
        color: color-mix(in srgb, var(--sl-color-neutral-900) 50%, white);
    }

    .page-actions sl-icon-button::before {
        content: "";
        position: absolute;
        inset: 2px;
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        border-radius: 50%;
        background: white;
        pointer-events: none;
        z-index: -1;
    }

    .page-actions sl-icon-button::part(base) {
        inline-size: 100%;
        block-size: 100%;
        box-sizing: border-box;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: inherit;
    }

    .page-tab .remove-btn::before {
        background: rgb(255 255 255 / 0.5);
        border-color: transparent;
    }

    .page-actions sl-icon-button::part(base):focus-visible {
        outline-offset: -2px;
    }

    .page-thumb:focus-within .page-actions sl-icon-button,
    .page-tab:focus-within .page-actions sl-icon-button {
        color: var(--sl-color-neutral-800);
    }

    .page-actions .remove-btn:not([disabled]):focus-within::part(base) {
        color: var(--sl-color-danger-600);
    }

    .page-actions .remove-btn:not([disabled]):focus-within::before {
        border-color: var(--sl-color-danger-600);
    }

    @media (hover: hover) {
        .page-thumb:hover {
            box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
        }

        .page-thumb:not(.active):hover {
            border-color: var(--sl-color-neutral-500);
        }

        .page-tab:not(.active):hover {
            background: var(--sl-color-neutral-100);
            border-color: var(--sl-panel-border-color);
        }

        .page-tab.active:hover {
            border-color: var(--sl-color-neutral-400);
        }

        .page-thumb:hover .page-actions sl-icon-button,
        .page-tab:hover .page-actions sl-icon-button {
            color: var(--sl-color-neutral-800);
        }

        .page-actions .remove-btn:not([disabled]):hover::part(base) {
            color: var(--sl-color-danger-600);
        }

        .page-actions .remove-btn:not([disabled]):hover::before {
            border-color: var(--sl-color-danger-600);
        }

        .page-tab .remove-btn:not([disabled]):hover::before {
            background: white;
        }
    }

    .controls-overlay {
        grid-column: 2;
        grid-row: 1;
        margin-block-end: var(--sl-spacing-small);
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--sl-spacing-2x-small);
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-x-small);
        background: rgba(255, 255, 255, 0.75);
        border-radius: var(--sl-border-radius-large);
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        z-index: 1000000000;
    }

    .slide-controls-overlay {
        --_overlay-button-size: 28px;
        position: absolute;
        inset-inline-end: var(--sl-spacing-small);
        inset-block-end: var(--sl-spacing-small);
        z-index: 2;
        max-inline-size: calc(100% - 2 * var(--sl-spacing-small));
        box-sizing: border-box;
        margin: 0;
        gap: 2px;
        padding: 2px 4px;
        border-radius: var(--sl-border-radius-medium);
        flex-wrap: wrap;
        justify-content: flex-end;
        background: var(--sl-panel-background-color, Canvas);
    }

    .slide-controls-overlay .controls-section { gap: 2px; }
    .slide-controls-overlay .pages-index { font-size: 0.8125rem; }
    .pages-view .slide-controls-overlay .controls-section:has(> .completion-overview) { flex-direction: row; }

    .slide-controls-overlay :is(sl-icon-button, .overlay-add-page) {
        inline-size: var(--_overlay-button-size);
        block-size: var(--_overlay-button-size);
        font-size: 0.875rem;
    }

    .slide-controls-overlay sl-icon-button::part(base), .overlay-add-page {
        display: grid;
        place-items: center;
        box-sizing: border-box;
        padding: 0;
        border-radius: var(--sl-border-radius-medium);
    }

    .slide-controls-overlay sl-icon-button::part(base) { inline-size: 100%; block-size: 100%; }

    .overlay-add-page {
        border: 0;
        background: transparent;
        color: var(--sl-color-neutral-600);
        cursor: pointer;
    }

    .overlay-add-page:focus-visible { outline: 2px solid var(--_accent); outline-offset: 2px; }
    @media (hover: hover) { .overlay-add-page:hover { color: var(--_accent); } }
    @media (pointer: coarse) { .slide-controls-overlay { --_overlay-button-size: 44px; } }

    @container pages (max-width: 520px) {
        .page-tabs-row > .add-page {
            inline-size: 40px;
        }

        .page-tabs-row.has-add {
            --_tab-add-space: calc(40px + var(--sl-spacing-2x-small));
        }

    }

    @container pages (min-width: 1100px) {
        :host(:not(:fullscreen):not(.ww-fullscreen):not([hide-pagination])) .pages-view {
            grid-template-columns: minmax(0, 1fr) auto;
        }

        :host(:not(:fullscreen):not(.ww-fullscreen)) [part="actions"] {
            contain: size;
            inline-size: calc(2 * var(--_thumb-width) + 7rem);
            min-block-size: 0;
            grid-template-columns: minmax(0, 1fr) auto;
            border-block-start: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
            border-inline-start: 0;
            border-radius: 0 var(--sl-border-radius-medium) var(--sl-border-radius-medium) 0;
        }

        :host(:not(:fullscreen):not(.ww-fullscreen)) .page-thumbs {
            grid-column: 1;
            grid-row: 1 / -1;
            flex-direction: column;
            min-block-size: 0;
            padding-block-end: var(--_page-action-space);
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-gutter: stable;
        }

        :host([type="pages"]:not(:fullscreen):not(.ww-fullscreen):not([hide-pagination])) ::slotted(webwriter-page) {
            border-start-end-radius: 0;
            border-end-start-radius: var(--sl-border-radius-medium);
        }

    }

    @media (pointer: coarse) {
        :host {
            --_page-action-size: 32px;
        }

        sl-icon-button {
            font-size: 1.75rem;
        }

        .page-actions sl-icon-button {
            font-size: 14px;
        }

        .page-actions sl-icon-button::before {
            inset: 4px;
        }

        .page-tab {
            block-size: 56px;
        }

        .page-tabs-row > .add-page {
            block-size: 56px;
        }

        .controls-rows {
            block-size: 56px;
        }

        .page-select {
            min-height: 44px;
        }

        .page-thumb-select {
            min-height: 0;
        }
    }

    @supports not (scrollbar-color: auto) {
        .page-thumbs::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        .page-thumbs::-webkit-scrollbar-thumb {
            background: var(--_scrollbar-thumb);
        }

        .page-thumbs::-webkit-scrollbar-track {
            background: var(--_scrollbar-track);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        * {
            scroll-behavior: auto;
        }
    }

    @media print {
        :host,
        :host(:not(:fullscreen):not(.ww-fullscreen)) {
            display: block;
            border: 0;
            padding: 0;
            aspect-ratio: auto;
            max-width: none;
            width: auto;
            background: none;
            container-type: normal;
        }

        aside,
        [part="branch-editor"],
        .page-aspect-handle,
        .controls-overlay {
            display: none !important;
        }

        slot:not([name]) {
            position: static;
            height: auto;
            min-height: 0;
            opacity: 1 !important;
        }

        .pages-layout,
        .page-surface,
        .page-stage {
            display: block !important;
            aspect-ratio: auto;
            inline-size: auto !important;
            block-size: auto !important;
        }

        ::slotted(webwriter-page:not(:state(ww-page-active))),
        ::slotted(webwriter-page) {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            break-inside: avoid;
            margin-block-end: var(--sl-spacing-small);
        }
    }
`;
