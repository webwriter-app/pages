import type { BranchCondition, BranchConditionMatch, BranchConditionOp, BranchUnmetMode, PageBranch } from "./page-branches";

export type SignalShapeKind = "boolean" | "number" | "string" | "unknown";

export interface SignalSourceOption {
    /** Canonical `#id[signal]` reference, or empty if the element has no unique ID yet. */
    ref: string;
    id: string;
    signalName: string;
    element: Element;
    elementLabel: string;
    signalLabel: string;
    shape: SignalShapeKind;
    location: "page" | "pages" | "document";
}

export interface ConditionEvaluation {
    met: boolean;
    resolved: boolean;
    pendingTag?: string;
}

export interface BranchEvaluation {
    available: boolean;
    hasConditions: boolean;
    unresolved: boolean;
    pendingTags: string[];
}

type ReadableSignal = { get(): unknown };
type StaticSignalDeclaration = {
    shape?: unknown;
    label?: unknown;
    description?: unknown;
};

const VALID_OPS = new Set<BranchConditionOp>(["==", "!=", ">=", ">", "<=", "<"]);
const EXCLUDED_SHAPES = new Set(["series", "table"]);

function unescapeCssIdent(raw: string): string {
    let out = "";
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch !== "\\") {
            out += ch;
            continue;
        }
        if (i + 1 >= raw.length) break;
        const hexMatch = /^[0-9a-fA-F]{1,6}[ \t\r\n\f]?/.exec(raw.slice(i + 1));
        if (hexMatch) {
            const code = parseInt(hexMatch[0].trim(), 16);
            out += code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "\uFFFD";
            i += hexMatch[0].length;
        } else {
            out += raw[++i];
        }
    }
    return out;
}

/** Parse a `#id[signal]` selector reference (including CSS-escaped identifiers). */
export function parseSignalReference(ref: string): { id: string; name: string } | null {
    if (typeof ref !== "string") return null;
    const trimmed = ref.trim();
    if (!trimmed.startsWith("#")) return null;
    // Split on an unescaped `[` that opens the attribute selector.
    let split = -1;
    for (let i = 1; i < trimmed.length; i++) {
        if (trimmed[i] === "\\") {
            i++;
            continue;
        }
        if (trimmed[i] === "[") {
            split = i;
            break;
        }
    }
    if (split <= 1 || !trimmed.endsWith("]")) return null;
    const rawId = trimmed.slice(1, split);
    const rawName = trimmed.slice(split + 1, -1).trim();
    const stripEscapes = (value: string) => value.replace(/\\[0-9a-fA-F]{1,6}[ \t\r\n\f]?|\\./g, "");
    if (!rawId || !rawName || /\s/.test(stripEscapes(rawId)) || /[\s=]/.test(stripEscapes(rawName))) {
        return null;
    }
    const id = unescapeCssIdent(rawId);
    const name = unescapeCssIdent(rawName);
    return id && name ? { id, name } : null;
}

/** Format a canonical `#id[signal]` reference using CSS escaping. */
export function formatSignalReference(id: string, name: string): string {
    return `#${CSS.escape(id)}[${CSS.escape(name)}]`;
}

export function isValidConditionOp(op: unknown): op is BranchConditionOp {
    return typeof op === "string" && VALID_OPS.has(op as BranchConditionOp);
}

export function isValidConditionValue(value: unknown): value is number | boolean | string {
    return typeof value === "boolean"
        || typeof value === "string"
        || (typeof value === "number" && Number.isFinite(value));
}

export function readBranchConditions(branch?: PageBranch): BranchCondition[] {
    if (!branch || !Array.isArray(branch.when)) return [];
    const conditions: BranchCondition[] = [];
    for (const entry of branch.when) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const candidate = entry as unknown as Record<string, unknown>;
        if (typeof candidate.source !== "string" || !parseSignalReference(candidate.source)) continue;
        if (!isValidConditionOp(candidate.op)) continue;
        if (!isValidConditionValue(candidate.value)) continue;
        conditions.push({ source: candidate.source, op: candidate.op, value: candidate.value });
    }
    return conditions;
}

export function readBranchMatch(branch?: PageBranch): BranchConditionMatch {
    return branch?.whenMatch === "or" ? "or" : "and";
}

export function readBranchUnmetMode(branch?: PageBranch): BranchUnmetMode {
    return branch?.whenUnmet === "hide" ? "hide" : "disable";
}

function resolveLocalizedText(value: unknown, locale = "en"): string | undefined {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return undefined;
    const map = value as Record<string, unknown>;
    const lang = locale.split("-")[0];
    const candidates = [map[locale], map[lang], map.en, map._, ...Object.values(map)];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
    return undefined;
}

function formatTagName(tagName: string): string {
    const clean = tagName.replace(/^webwriter-|^ww-/, "").replace(/-/g, " ");
    return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function readElementLabel(element: Element): string {
    return element.getAttribute("aria-label")?.trim()
        || element.getAttribute("title")?.trim()
        || element.getAttribute("label")?.trim()
        || formatTagName(element.localName);
}

function inferShape(declaredShape: unknown, currentValue: unknown): SignalShapeKind | null {
    if (typeof declaredShape === "string") {
        if (EXCLUDED_SHAPES.has(declaredShape)) return null;
        if (declaredShape === "boolean" || declaredShape === "number" || declaredShape === "string") {
            return declaredShape;
        }
        return "unknown";
    }
    if (typeof currentValue === "boolean") return "boolean";
    if (typeof currentValue === "number" && Number.isFinite(currentValue)) return "number";
    if (typeof currentValue === "string") return "string";
    return "unknown";
}

function readStaticSignals(element: Element): Record<string, StaticSignalDeclaration> {
    const ctor = (element.ownerDocument?.defaultView?.customElements.get(element.localName) ?? element.constructor) as {
        signals?: unknown;
    };
    if (!ctor?.signals || typeof ctor.signals !== "object") return {};
    return ctor.signals as Record<string, StaticSignalDeclaration>;
}

export function signalRootFor(host: Element): ParentNode {
    const body = host.ownerDocument?.body;
    if (body?.contains(host)) return body;
    return host.getRootNode() as ParentNode;
}

/** Discover custom elements publishing scalar signals in the document, grouped by page/document scope. */
export function discoverSignalSources(host: Element, activePage?: Element, locale = "en"): SignalSourceOption[] {
    const root = signalRootFor(host);
    const idCounts = new Map<string, number>();
    for (const el of root.querySelectorAll("[id]")) {
        const id = el.getAttribute("id");
        if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }

    const candidates: Element[] = [];
    for (const el of root.querySelectorAll("*")) {
        if (el !== host && el.localName.includes("-")) candidates.push(el);
    }

    const sources: SignalSourceOption[] = [];
    for (const element of candidates) {
        const signals = (element as { signals?: unknown }).signals;
        if (!signals || typeof signals !== "object") continue;
        const declarations = readStaticSignals(element);
        const rawId = element.getAttribute("id") ?? "";
        const uniqueId = rawId && idCounts.get(rawId) === 1 ? rawId : "";
        const elementLabel = readElementLabel(element);
        const location: SignalSourceOption["location"] = activePage?.contains(element)
            ? "page"
            : host.contains(element)
                ? "pages"
                : "document";

        for (const [signalName, entry] of Object.entries(signals as Record<string, unknown>)) {
            if (!signalName || !entry || typeof entry !== "object") continue;
            const sig = entry as Partial<ReadableSignal>;
            if (typeof sig.get !== "function" || "set" in sig) continue;
            const decl = declarations[signalName];
            let currentValue: unknown;
            try {
                currentValue = sig.get();
            } catch {
                currentValue = undefined;
            }
            const shape = inferShape(decl?.shape, currentValue);
            if (!shape) continue;
            const signalLabel = resolveLocalizedText(decl?.label, locale) ?? signalName;
            sources.push({
                ref: uniqueId ? formatSignalReference(uniqueId, signalName) : "",
                id: uniqueId,
                signalName,
                element,
                elementLabel,
                signalLabel,
                shape,
                location,
            });
        }
    }

    const order: Record<SignalSourceOption["location"], number> = { page: 0, pages: 1, document: 2 };
    return sources.sort((a, b) => order[a.location] - order[b.location]);
}

export function resolveSignalElement(root: ParentNode, id: string): Element | null {
    if (!id) return null;
    try {
        const matches = root.querySelectorAll(`[id="${CSS.escape(id)}"]`);
        return matches.length === 1 ? matches[0] : null;
    } catch {
        return null;
    }
}

export function evaluateCondition(condition: BranchCondition, root: ParentNode): ConditionEvaluation {
    const parsed = parseSignalReference(condition.source);
    if (!parsed) return { met: false, resolved: false };
    const element = resolveSignalElement(root, parsed.id);
    if (!element) return { met: false, resolved: false };
    const sig = (element as { signals?: Record<string, unknown> }).signals?.[parsed.name] as Partial<ReadableSignal> | undefined;
    if (!sig || typeof sig.get !== "function" || "set" in sig) {
        const registry = element.ownerDocument?.defaultView?.customElements;
        const pendingTag = element.localName.includes("-") && registry && !registry.get(element.localName)
            ? element.localName
            : undefined;
        return { met: false, resolved: false, pendingTag };
    }
    let actual: unknown;
    try {
        actual = sig.get();
    } catch {
        return { met: false, resolved: false };
    }

    let met = false;
    switch (condition.op) {
        case "==":
            met = actual === condition.value;
            break;
        case "!=":
            met = actual !== condition.value;
            break;
        case ">=":
        case ">":
        case "<=":
        case "<":
            if (typeof actual === "number" && Number.isFinite(actual)
                && typeof condition.value === "number" && Number.isFinite(condition.value)) {
                met = condition.op === ">=" ? actual >= condition.value
                    : condition.op === ">" ? actual > condition.value
                    : condition.op === "<=" ? actual <= condition.value
                    : actual < condition.value;
            }
            break;
    }
    return { met, resolved: true };
}

/**
 * Evaluate all conditions of a branch (logical AND or OR) without short-circuiting,
 * so every referenced signal is read and tracked during rendering.
 */
export function evaluateBranch(branch: PageBranch, root: ParentNode): BranchEvaluation {
    const conditions = readBranchConditions(branch);
    if (!conditions.length) {
        return { available: true, hasConditions: false, unresolved: false, pendingTags: [] };
    }
    const results = conditions.map((condition) => evaluateCondition(condition, root));
    const match = readBranchMatch(branch);
    const available = match === "or"
        ? results.some((result) => result.met)
        : results.every((result) => result.met);
    const unresolved = results.some((result) => !result.resolved);
    const pendingTags: string[] = [];
    for (const result of results) {
        if (result.pendingTag && !pendingTags.includes(result.pendingTag)) {
            pendingTags.push(result.pendingTag);
        }
    }
    return { available, hasConditions: true, unresolved, pendingTags };
}

const OP_DISPLAY: Record<BranchConditionOp, string> = {
    "==": "=",
    "!=": "≠",
    ">=": "≥",
    ">": ">",
    "<=": "≤",
    "<": "<",
};

export function formatConditionSummary(branch: PageBranch, root: ParentNode, locale = "en"): string {
    const conditions = readBranchConditions(branch);
    if (!conditions.length) return "";
    const joiner = readBranchMatch(branch) === "or" ? " | " : " & ";
    return conditions.map((condition) => {
        const parsed = parseSignalReference(condition.source);
        if (!parsed) return "";
        const element = resolveSignalElement(root, parsed.id);
        let name = `${parsed.id}.${parsed.name}`;
        if (element) {
            const decl = readStaticSignals(element)[parsed.name];
            const signalLabel = resolveLocalizedText(decl?.label, locale) ?? parsed.name;
            name = `${readElementLabel(element)}: ${signalLabel}`;
        }
        return `${name} ${OP_DISPLAY[condition.op]} ${String(condition.value)}`;
    }).filter(Boolean).join(joiner);
}
