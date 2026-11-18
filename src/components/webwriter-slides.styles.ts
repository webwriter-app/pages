import { css } from "lit";

/**
 * Styles for the slides overview.
 */
export const slides_styles = css`
    :host {
        position: relative;
        background: var(--sl-panel-background-color);
        color: var(--ww-text-color, inherit);
        font-family: var(--ww-font-family, inherit);
        --_accent: var(--ww-theme-accent-1, var(--sl-color-primary-600));
        --_accent-soft: color-mix(in srgb, var(--ww-theme-accent-1) 12%, white);
        display: block;
        box-sizing: border-box;
        padding: var(--sl-spacing-x-small);
        min-width: min(300px, 100%);
        max-width: 2100px;
        margin-inline: auto;
        container-type: inline-size;
    }

    :host(:not(:fullscreen):not(.ww-fullscreen)) {
        border: var(--sl-panel-border-width) solid var(--sl-color-neutral-300);
        border-radius: var(--sl-border-radius-large);
        aspect-ratio: 16/9;
        width: 100%;
    }

    :host(:fullscreen),
    :host(.ww-fullscreen) {
        max-width: none;
    }

    :host(:fullscreen),
    :host(.ww-fullscreen) {
        display: flex !important;
        flex-direction: column;
    }

    :host(:fullscreen) slot:not([name]),
    :host(.ww-fullscreen) slot:not([name]) {
        flex: 1 1 auto;
        min-height: 0;
        height: auto;
    }

    [part="actions"], [part="tabs"] {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .slides-index {
        user-select: none;
        font-size: var(--sl-font-size-medium);
        color: var(--ww-text-color, var(--sl-color-neutral-800));
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5ch;
    }

    ::slotted(webwriter-slide:not([active])) {
        display: none !important;
    }

    slot:not([name]) {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 15rem;

        &::slotted {
            width: 100%;
            height: 100%;
        }
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
        height: 108px;
        box-sizing: border-box;
        margin-top: var(--sl-spacing-x-small);
    }

    .controls-rows {
        flex-direction: row;
        margin: var(--sl-spacing-2x-small) var(--sl-spacing-x-small) 0 0;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-bottom: none;
    }

    .controls-section {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--sl-spacing-2x-small);
    }

    .slide-thumbs {
        display: flex;
        flex-direction: row;
        gap: var(--sl-spacing-x-small);
        padding: var(--sl-spacing-x-small);
        overflow-x: scroll;
        margin-left: calc(var(--sl-spacing-x-small) * -1);
    }

    .slide-thumb {
        width: 120px;
        height: 108px;
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

    .slide-thumb[data-ww-dragging], .slide-tab[data-ww-dragging] {
        opacity: 0.5;
    }

    .slide-thumb.active {
        border-color: var(--_accent);
        background: var(--_accent-soft, var(--sl-color-primary-50));
    }

    .slide-thumb:focus-visible,
    .slide-select:focus-visible {
        outline: var(--sl-focus-ring-width) solid var(--_accent);
        outline-offset: var(--sl-focus-ring-offset);
    }

    .slide-select {
        font: inherit;
        color: inherit;
        background: none;
        border: 0;
        cursor: pointer;
        border-radius: var(--sl-border-radius-small);
    }

    .slide-thumb-select {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        width: 100%;
        min-height: 0;
        padding: 0;
        border-radius: 0;
    }

    .slide-thumb-select:focus-visible {
        outline-offset: calc(var(--sl-focus-ring-width) * -1);
    }

    .slide-thumb-img {
        width: 100%;
        flex: 1;
        min-height: 0;
        object-fit: cover;
        border-bottom: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
    }

    .remove-btn,
    .add-btn,
    .duplicate-btn,
    .slide-number,
    .fullscreen-btn {
        cursor: pointer;
        color: var(--sl-color-neutral-800);
        font-size: var(--sl-font-size-small);
    }

    .slide-tabs-wrapper {
        overflow-y: hidden;
        overflow-x: auto;
    }

    .slide-tabs {
        display: flex;
        gap: var(--sl-spacing-2x-small);
        padding: var(--sl-spacing-2x-small);
        padding-bottom: 0;
        cursor: pointer;
    }

    .slide-tabs-wrapper, .slide-tabs {
        transform:rotateX(180deg);
        -moz-transform:rotateX(180deg); /* Mozilla */
        -webkit-transform:rotateX(180deg); /* Safari and Chrome */
        -ms-transform:rotateX(180deg); /* IE 9+ */
        -o-transform:rotateX(180deg); /* Opera */
    }

    .slide-tab {
        background-color: var(--sl-color-neutral-0);
        display: flex;
        width: 100px;
        height: 32px;
        border-radius: var(--sl-border-radius-large) var(--sl-border-radius-large) 0 0;
        padding: var(--sl-spacing-3x-small) var(--sl-spacing-2x-small) var(--sl-spacing-3x-small) var(--sl-spacing-small);
        align-items: center;
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        border-bottom: none;
        flex-shrink: 0;
    }

    .slide-tab.active {
        border-color: var(--_accent);
        background: var(--_accent-soft, var(--sl-color-primary-50));
    }

    .slide-tab:focus-visible {
        outline: var(--sl-focus-ring-width) solid var(--_accent);
        outline-offset: var(--sl-focus-ring-offset);
    }

    .slide-options {
        display: flex;
        width: 100%;
        align-items: center;
        box-sizing: border-box;
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-2x-small);
        padding-left: var(--sl-spacing-small);
    }

    .slide-number {
        font-weight: var(--sl-font-weight-semibold);
    }

    .slide-tab .slide-select {
        flex: 1 1 auto;
        text-align: start;
        padding: 0;
        align-self: stretch;
    }

    .spacer {
        flex: 1;
    }

    .controls-overlay {
        position: absolute;
        bottom: var(--sl-spacing-small);
        right: var(--sl-spacing-small);
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

    @container (max-width: 520px) {
        slot:not([name]) {
            min-height: 24rem;
        }

        [part="actions"] {
            flex-wrap: wrap;
        }

        [part="actions"] .controls-columns {
            order: -1;
            flex-direction: row;
            justify-content: space-between;
            width: 100%;
            height: auto;
            margin: 0 0 var(--sl-spacing-x-small);
        }

        [part="actions"] .slide-thumbs {
            width: 100%;
            margin-left: 0;
        }

        [part="tabs"] {
            flex-wrap: wrap;
        }

        [part="tabs"] .slide-tabs-wrapper {
            flex: 1 1 100%;
            min-width: 0;
        }

        [part="tabs"] .controls-rows {
            width: 100%;
            box-sizing: border-box;
            justify-content: space-between;
            margin-right: 0;
        }
    }

    @container (min-width: 1100px) {
        .slide-thumb {
            width: 168px;
            height: 132px;
        }

        .controls-columns {
            height: 132px;
        }

        .slide-tab {
            width: 128px;
        }
    }

    @media (pointer: coarse) {
        sl-icon-button {
            font-size: 1.75rem;
        }

        .controls-columns {
            height: auto;
        }

        .slide-thumb {
            width: 144px;
            height: 148px;
        }

        .slide-tab {
            width: 132px;
            height: 48px;
        }

        .slide-select {
            min-height: 44px;
        }

        .slide-thumb-select {
            min-height: 0;
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
        .controls-overlay {
            display: none !important;
        }

        slot:not([name]) {
            height: auto;
            min-height: 0;
        }

        ::slotted(webwriter-slide:not([active])),
        ::slotted(webwriter-slide) {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            break-inside: avoid;
            margin-block-end: var(--sl-spacing-small);
        }
    }
`;
