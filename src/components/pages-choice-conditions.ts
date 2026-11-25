import { css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { LitElementWw } from "@webwriter/lit";
import type { MsgFn } from "@lit/localize";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import plusIcon from "@tabler/icons/outline/plus.svg";
import removeIcon from "@tabler/icons/outline/x.svg";
import type {
    BranchCondition,
    BranchConditionMatch,
    BranchConditionOp,
    BranchUnmetMode,
    PageBranch,
} from "../model/page-branches";
import {
    discoverSignalSources,
    formatSignalReference,
    parseSignalReference,
    readBranchConditions,
    readBranchMatch,
    readBranchUnmetMode,
    resolveSignalElement,
    type SignalShapeKind,
    type SignalSourceOption,
} from "../model/branch-conditions";

export interface DraftBranchCondition {
    /** Canonical `#id[signal]` reference when known, or empty for an ID-less element. */
    source: string;
    /** Target element when picked from discovered sources (used to assign an ID on save if needed). */
    element?: Element;
    signalName?: string;
    shape: SignalShapeKind;
    op: BranchConditionOp;
    value: number | boolean | string;
    rawValue?: string;
}

export interface ConditionsDraftResult {
    conditions: DraftBranchCondition[];
    whenMatch: BranchConditionMatch;
    whenUnmet: BranchUnmetMode;
}

const NUMBER_OPS: BranchConditionOp[] = [">=", ">", "<=", "<", "==", "!="];
const EQUALITY_OPS: BranchConditionOp[] = ["==", "!="];

function defaultOpForShape(shape: SignalShapeKind): BranchConditionOp {
    return shape === "number" ? ">=" : "==";
}

function defaultValueForShape(shape: SignalShapeKind): number | boolean | string {
    if (shape === "boolean") return true;
    if (shape === "number") return 0.5;
    return "";
}

function coerceConditionForShape(
    shape: SignalShapeKind,
    op: BranchConditionOp,
    value: number | boolean | string,
): { op: BranchConditionOp; value: number | boolean | string } {
    if (shape === "boolean") {
        const nextOp = EQUALITY_OPS.includes(op) ? op : "==";
        const nextValue = typeof value === "boolean" ? value : value === "false" ? false : Boolean(value);
        return { op: nextOp, value: nextValue };
    }
    if (shape === "number") {
        const nextOp = NUMBER_OPS.includes(op) ? op : ">=";
        const numeric = typeof value === "number" ? value : Number(value);
        return { op: nextOp, value: Number.isFinite(numeric) ? numeric : 0.5 };
    }
    const nextOp = EQUALITY_OPS.includes(op) ? op : "==";
    return { op: nextOp, value: typeof value === "string" ? value : String(value) };
}

/** Generate a unique element ID inside `root` without mutating any DOM node. */
export function allocateSignalElementId(root: ParentNode): string {
    let candidate = "";
    do {
        candidate = `ww-${crypto.randomUUID().slice(0, 8)}`;
    } while (root.querySelector(`[id="${CSS.escape(candidate)}"]`));
    return candidate;
}

/** Resolve draft conditions into serializable `when` / `whenMatch` / `whenUnmet`, assigning missing IDs when saving. */
export function resolveConditionsForSave(
    draft: ConditionsDraftResult,
    root: ParentNode,
): { when?: BranchCondition[]; whenMatch?: BranchConditionMatch; whenUnmet?: BranchUnmetMode } {
    const when: BranchCondition[] = [];
    for (const item of draft.conditions) {
        let source = item.source;
        const parsed = source ? parseSignalReference(source) : null;
        if ((!parsed || !resolveSignalElement(root, parsed.id))
            && item.element?.isConnected && item.signalName) {
            const existingId = item.element.getAttribute("id")?.trim();
            const isUnique = Boolean(existingId && resolveSignalElement(root, existingId) === item.element);
            const id = isUnique ? existingId! : allocateSignalElementId(root);
            if (!isUnique) item.element.setAttribute("id", id);
            source = formatSignalReference(id, item.signalName);
        }
        if (!source) continue;
        let value: number | boolean | string = item.value;
        if (item.shape === "number") {
            const raw = item.rawValue?.trim().replace(",", ".");
            const parsedNum = raw ? Number(raw) : NaN;
            value = Number.isFinite(parsedNum)
                ? parsedNum
                : (typeof item.value === "number" && Number.isFinite(item.value) ? item.value : 0);
        } else if (item.shape === "boolean") {
            value = Boolean(item.value);
        } else {
            value = String(item.rawValue ?? item.value);
        }
        when.push({ source, op: item.op, value });
    }
    if (!when.length) return {};
    return {
        when,
        ...(when.length > 1 && draft.whenMatch === "or" ? { whenMatch: "or" as const } : {}),
        ...(draft.whenUnmet === "hide" ? { whenUnmet: "hide" as const } : {}),
    };
}

/** Scoped condition list editor rendered inside the branch choice popover. */
export class PagesChoiceConditions extends LitElementWw {
    static scopedElements = { "sl-icon": SlIcon };

    static styles = css`
        :host {
            display: grid;
            gap: 8px;
        }
        * { box-sizing: border-box; }
        .conditions-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            font-size: 0.9em;
        }
        .conditions-list {
            display: grid;
            gap: 6px;
        }
        .condition-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto minmax(4.5rem, 6rem) auto;
            gap: 6px;
            align-items: center;
        }
        .condition-combinator-row {
            display: flex;
            align-items: center;
        }
        .condition-combinator {
            min-block-size: 24px;
            padding: 2px 8px;
            border: 1px solid var(--sl-panel-border-color);
            border-radius: 999px;
            background: var(--sl-color-neutral-100, #f4f4f5);
            color: inherit;
            font: inherit;
            font-size: 0.75em;
            font-weight: 600;
            letter-spacing: 0.04em;
            cursor: pointer;
        }
        .condition-remove {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            inline-size: 32px;
            min-block-size: 32px;
            padding: 0;
            border: 1px solid var(--sl-panel-border-color);
            border-radius: var(--sl-border-radius-medium);
            background: var(--sl-panel-background-color);
            color: inherit;
            cursor: pointer;
        }
        button:not(.condition-combinator), input, select {
            box-sizing: border-box;
            min-block-size: 32px;
            min-inline-size: 0;
            max-inline-size: 100%;
            padding: 4px 8px;
            border: 1px solid var(--sl-panel-border-color);
            border-radius: var(--sl-border-radius-medium);
            background: var(--sl-panel-background-color);
            color: inherit;
            font: inherit;
            font-size: 0.9em;
        }
        button { cursor: pointer; }
        button:disabled { opacity: 0.45; cursor: default; }
        sl-icon { font-size: 14px; pointer-events: none; }
        .add-condition {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            justify-self: start;
        }
        .unmet-mode {
            display: grid;
            gap: 4px;
            font-size: 0.9em;
        }
        .no-signals {
            margin: 0;
            font-size: 0.85em;
            color: var(--sl-color-neutral-500, #71717a);
        }
        @media (hover: hover) {
            .condition-remove:hover { color: var(--sl-color-danger-600, #dc2626); border-color: currentColor; }
            .add-condition:not(:disabled):hover,
            .condition-combinator:hover { border-color: var(--ww-theme-accent-1, #0284c7); }
        }
        @media (pointer: coarse) {
            button:not(.condition-combinator), input, select { min-block-size: 44px; }
            .condition-remove { inline-size: 44px; min-block-size: 44px; }
            .condition-combinator { min-block-size: 32px; padding: 4px 12px; }
        }
    `;

    @state() private accessor sources: SignalSourceOption[] = [];
    @state() private accessor rows: DraftBranchCondition[] = [];
    @state() private accessor whenMatch: BranchConditionMatch = "and";
    @state() private accessor whenUnmet: BranchUnmetMode = "disable";
    #msg: MsgFn = ((s: unknown) => (typeof s === "string" ? s : "")) as MsgFn;

    /** Populate the draft state when the choice popover opens. */
    load(branch: PageBranch | undefined, host: Element, activePage: Element | undefined, msg: MsgFn, locale = "en") {
        this.#msg = msg;
        this.sources = discoverSignalSources(host, activePage, locale);
        this.whenMatch = readBranchMatch(branch);
        this.whenUnmet = readBranchUnmetMode(branch);
        this.rows = readBranchConditions(branch).map((cond) => {
            const match = this.sources.find((option) => option.ref === cond.source);
            const shape: SignalShapeKind = match?.shape
                ?? (typeof cond.value === "boolean" ? "boolean" : typeof cond.value === "number" ? "number" : "string");
            return {
                source: cond.source,
                element: match?.element,
                signalName: match?.signalName,
                shape,
                op: cond.op,
                value: cond.value,
                rawValue: String(cond.value),
            };
        });
        this.#emitConditionsChange();
    }

    getResult(): ConditionsDraftResult {
        return {
            conditions: this.rows.map((row) => ({ ...row })),
            whenMatch: this.whenMatch,
            whenUnmet: this.whenUnmet,
        };
    }

    getHighlightedElements(root?: ParentNode): Element[] {
        const result: Element[] = [];
        const seen = new Set<Element>();
        for (const row of this.rows) {
            let target = row.element?.isConnected ? row.element : undefined;
            if (!target && row.source && root) {
                const parsed = parseSignalReference(row.source);
                if (parsed) target = resolveSignalElement(root, parsed.id) ?? undefined;
            }
            if (target && !seen.has(target)) {
                seen.add(target);
                result.push(target);
            }
        }
        return result;
    }

    #emitConditionsChange() {
        this.dispatchEvent(new CustomEvent("conditions-change", { bubbles: true, composed: true }));
    }

    #optionValue(option: SignalSourceOption, index: number): string {
        return option.ref || `pending:${index}`;
    }

    #selectedValue(row: DraftBranchCondition): string {
        if (row.source) return row.source;
        const index = this.sources.findIndex((option) => option.element === row.element && option.signalName === row.signalName);
        return index >= 0 ? `pending:${index}` : "";
    }

    #findOptionByValue(value: string): SignalSourceOption | undefined {
        if (value.startsWith("pending:")) {
            const index = Number(value.slice("pending:".length));
            return this.sources[index];
        }
        return this.sources.find((option) => option.ref === value);
    }

    #addCondition = () => {
        const first = this.sources[0];
        if (!first) return;
        const value = defaultValueForShape(first.shape);
        this.rows = [
            ...this.rows,
            {
                source: first.ref,
                element: first.element,
                signalName: first.signalName,
                shape: first.shape,
                op: defaultOpForShape(first.shape),
                value,
                rawValue: String(value),
            },
        ];
        this.#emitConditionsChange();
    };

    #removeCondition(index: number) {
        this.rows = this.rows.filter((_, i) => i !== index);
        this.#emitConditionsChange();
    }

    #toggleMatch = () => {
        this.whenMatch = this.whenMatch === "or" ? "and" : "or";
    };

    #updateSource(index: number, optionValue: string) {
        const option = this.#findOptionByValue(optionValue);
        this.rows = this.rows.map((row, i) => {
            if (i !== index) return row;
            if (!option) return { ...row, source: optionValue, element: undefined, signalName: undefined };
            const coerced = coerceConditionForShape(option.shape, row.op, row.value);
            const resetValue = row.shape !== option.shape ? defaultValueForShape(option.shape) : coerced.value;
            return {
                source: option.ref,
                element: option.element,
                signalName: option.signalName,
                shape: option.shape,
                op: row.shape !== option.shape ? defaultOpForShape(option.shape) : coerced.op,
                value: resetValue,
                rawValue: String(resetValue),
            };
        });
        this.#emitConditionsChange();
    }

    #updateOp(index: number, op: BranchConditionOp) {
        this.rows = this.rows.map((row, i) => i === index ? { ...row, op } : row);
    }

    #updateValue(index: number, raw: string) {
        this.rows = this.rows.map((row, i) => {
            if (i !== index) return row;
            if (row.shape === "boolean") return { ...row, value: raw === "true", rawValue: raw };
            if (row.shape === "number") {
                const trimmed = raw.trim().replace(",", ".");
                const parsed = trimmed ? Number(trimmed) : NaN;
                return {
                    ...row,
                    value: Number.isFinite(parsed) ? parsed : row.value,
                    rawValue: raw,
                };
            }
            return { ...row, value: raw, rawValue: raw };
        });
    }

    #submitOnEnter = (event: KeyboardEvent) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this.closest("form")?.requestSubmit();
    };

    #renderSourceOptions(row: DraftBranchCondition) {
        const msg = this.#msg;
        const selected = this.#selectedValue(row);
        const missing = row.source && !this.sources.some((option) => option.ref === row.source);
        const groups: Array<{ key: SignalSourceOption["location"]; label: string }> = [
            { key: "page", label: msg("This page") },
            { key: "pages", label: msg("Other pages") },
            { key: "document", label: msg("Document") },
        ];
        return html`
            ${missing ? html`<option value=${row.source} ?selected=${selected === row.source}>${row.source} (${msg("missing")})</option>` : nothing}
            ${groups.map((group) => {
                const entries = this.sources
                    .map((option, index) => ({ option, index }))
                    .filter(({ option }) => option.location === group.key);
                if (!entries.length) return nothing;
                return html`<optgroup label=${group.label}>
                    ${entries.map(({ option, index }) => {
                        const val = this.#optionValue(option, index);
                        return html`<option value=${val} ?selected=${selected === val}>${option.elementLabel}: ${option.signalLabel}</option>`;
                    })}
                </optgroup>`;
            })}
        `;
    }

    #renderValueInput(row: DraftBranchCondition, index: number) {
        const msg = this.#msg;
        if (row.shape === "boolean") {
            const current = row.value === false ? "false" : "true";
            return html`<select class="condition-value" aria-label=${msg("Value")}
                .value=${live(current)}
                @change=${(event: Event) => this.#updateValue(index, (event.currentTarget as HTMLSelectElement).value)}>
                <option value="true" ?selected=${current === "true"}>${msg("true")}</option>
                <option value="false" ?selected=${current === "false"}>${msg("false")}</option>
            </select>`;
        }
        if (row.shape === "number") {
            return html`<input class="condition-value" type="number" step="any" aria-label=${msg("Value")}
                .value=${live(row.rawValue ?? String(row.value))}
                @input=${(event: Event) => this.#updateValue(index, (event.currentTarget as HTMLInputElement).value)}
                @keydown=${this.#submitOnEnter}>`;
        }
        return html`<input class="condition-value" type="text" aria-label=${msg("Value")}
            .value=${live(row.rawValue ?? String(row.value))}
            @input=${(event: Event) => this.#updateValue(index, (event.currentTarget as HTMLInputElement).value)}
            @keydown=${this.#submitOnEnter}>`;
    }

    render() {
        const msg = this.#msg;
        const opLabel = (op: BranchConditionOp) => {
            switch (op) {
                case "==": return "=";
                case "!=": return "≠";
                case ">=": return "≥";
                case ">": return ">";
                case "<=": return "≤";
                case "<": return "<";
            }
        };
        const matchLabel = this.whenMatch === "or" ? msg("OR") : msg("AND");
        const matchTitle = this.whenMatch === "or"
            ? msg("Any condition can match (click to require all)")
            : msg("All conditions must match (click to match any)");
        return html`
            <div class="conditions-header">
                <span>${msg("Conditions")}</span>
            </div>
            ${this.rows.length ? html`<div class="conditions-list">
                ${this.rows.map((row, index) => {
                    const ops = row.shape === "number" ? NUMBER_OPS : EQUALITY_OPS;
                    return html`
                        ${index > 0 ? html`<div class="condition-combinator-row">
                            <button type="button" class="condition-combinator" aria-label=${matchTitle} title=${matchTitle}
                                @click=${this.#toggleMatch}>${matchLabel}</button>
                        </div>` : nothing}
                        <div class="condition-row">
                            <select class="condition-source" aria-label=${msg("Signal")}
                                .value=${live(this.#selectedValue(row))}
                                @change=${(event: Event) => this.#updateSource(index, (event.currentTarget as HTMLSelectElement).value)}>
                                ${this.#renderSourceOptions(row)}
                            </select>
                            <select class="condition-op" aria-label=${msg("Operator")}
                                .value=${live(row.op)}
                                @change=${(event: Event) => this.#updateOp(index, (event.currentTarget as HTMLSelectElement).value as BranchConditionOp)}>
                                ${ops.map((op) => html`<option value=${op} ?selected=${row.op === op}>${opLabel(op)}</option>`)}
                            </select>
                            ${this.#renderValueInput(row, index)}
                            <button type="button" class="condition-remove" aria-label=${msg("Remove condition")} title=${msg("Remove condition")}
                                @click=${() => this.#removeCondition(index)}>
                                <sl-icon src=${removeIcon} aria-hidden="true"></sl-icon>
                            </button>
                        </div>
                    `;
                })}
            </div>` : nothing}
            ${this.sources.length ? html`
                <button type="button" class="add-condition" @click=${this.#addCondition}>
                    <sl-icon src=${plusIcon} aria-hidden="true"></sl-icon>
                    <span>${msg("Add condition")}</span>
                </button>
            ` : html`<p class="no-signals">${msg("No widget signals found in this document.")}</p>`}
            ${this.rows.length ? html`
                <label class="unmet-mode">${msg("When unmet")}
                    <select class="condition-unmet"
                        .value=${live(this.whenUnmet)}
                        @change=${(event: Event) => this.whenUnmet = (event.currentTarget as HTMLSelectElement).value as BranchUnmetMode}>
                        <option value="disable" ?selected=${this.whenUnmet === "disable"}>${msg("Disable choice")}</option>
                        <option value="hide" ?selected=${this.whenUnmet === "hide"}>${msg("Hide choice")}</option>
                    </select>
                </label>
            ` : nothing}
        `;
    }
}
