/** Module imports */
import { html, css } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { customElement, property } from "lit/decorators.js";

import "@shoelace-style/shoelace/dist/themes/light.css";
import "../components/page-media.css";

/**
 * Represents a single page in the `webwriter-pages` widget.
 * Single-media pages remove padding and fit media without stretching or cropping.
 * In Branches view, `page-key`, `branches`, `node-x` and `node-y` keep routing and graph layout.
 *
 * @slot default - The content displayed within the page.
 */
@customElement("webwriter-page")
export class WebwriterPage extends LitElementWw {
    #internals = this.attachInternals();

    /** Indicates whether the page is currently active/visible. */
    @property({ type: Boolean, attribute: true })
    accessor active = false;

    /** Plaintext tab label. An empty label shows the page-number placeholder. */
    @property({ type: String, reflect: true, useDefault: true })
    accessor label = "";

    /** Stable local identifier for Branches links; independent of order and label. */
    @property({ type: String, attribute: "page-key", reflect: true, useDefault: true })
    accessor pageKey = "";

    /** JSON choices: an array of objects with target page keys and plaintext labels. */
    @property({ type: String, reflect: true, useDefault: true })
    accessor branches = "";

    /** Saved node position in the Branches editor. Absent coordinates use a grid. */
    @property({ type: Number, attribute: "node-x", reflect: true, useDefault: true })
    accessor nodeX: number | undefined = undefined;

    /** Saved vertical node position in the Branches editor. */
    @property({ type: Number, attribute: "node-y", reflect: true, useDefault: true })
    accessor nodeY: number | undefined = undefined;

    /**
     * Data URI string for the page thumbnail (e.g., "data:image/png;base64,...").
     * Used to display a preview image for the page.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor thumbnail = "";

    static styles = css`
        :host {
            --ww-widget-max: none;
            height: 100%;
            width: 100%;
            padding: var(--sl-spacing-small);
            box-sizing: border-box;
            display: block;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: thin;
            border: var(--sl-panel-border-width) solid var(--sl-panel-border-color) !important;
            border-radius: var(--sl-border-radius-medium);
        }

    `;

    protected updated() {
        // Page navigation is local display state, not an authored edit or undo step.
        if (this.active) this.#internals.states.add("ww-page-active");
        else this.#internals.states.delete("ww-page-active");
    }

    render(): unknown {
        return html`<slot></slot>`;
    }
}
