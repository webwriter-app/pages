import { PointerGesture } from "@webwriter/widget/gesture";

export const MIN_PAGE_ASPECT_RATIO = 0.5;
export const MAX_PAGE_ASPECT_RATIO = 3;
export const PAGE_ASPECT_RATIO_STEP = 0.05;

/** Keep orientation defaults exact; only deliberate resizing snaps to the step. */
export function normalizePageAspectRatio(value: number, fallback = 16 / 9): number {
    const ratio = Number.isFinite(value) ? value : Number.isFinite(fallback) ? fallback : 16 / 9;
    return Math.min(MAX_PAGE_ASPECT_RATIO, Math.max(MIN_PAGE_ASPECT_RATIO, ratio));
}

const stepped = (ratio: number) => normalizePageAspectRatio(Math.round(ratio / PAGE_ASPECT_RATIO_STEP) / (1 / PAGE_ASPECT_RATIO_STEP));
const landscapeRatio = 16 / 9;
const dragged = (ratio: number) => Math.abs(ratio - landscapeRatio) <= 1.5 * PAGE_ASPECT_RATIO_STEP + Number.EPSILON
    ? landscapeRatio : stepped(ratio);

/** Round the feedback to a familiar ratio, otherwise a fraction with a denominator of at most 12. */
export function formatPageAspectRatio(value: number): string {
    const ratio = normalizePageAspectRatio(value);
    const common = [[1, 2], [9, 16], [1, 1], [5, 4], [4, 3], [3, 2], [16, 9], [2, 1], [3, 1]];
    const nearest = common.reduce((best, pair) => Math.abs(pair[0] / pair[1] - ratio) < Math.abs(best[0] / best[1] - ratio) ? pair : best);
    if (Math.abs(nearest[0] / nearest[1] - ratio) <= PAGE_ASPECT_RATIO_STEP / 2 + Number.EPSILON) return nearest.join(":");
    let numerator = 1, denominator = 1, error = Infinity;
    for (let candidate = 1; candidate <= 12; candidate++) {
        const rounded = Math.round(ratio * candidate);
        const difference = Math.abs(rounded / candidate - ratio);
        if (difference < error - 1e-10) {
            numerator = rounded;
            denominator = candidate;
            error = difference;
        }
    }
    return `${numerator}:${denominator}`;
}

export interface PageAspectResizeState {
    ratio: number;
    width: number;
    height: number;
    edge: "top" | "bottom" | "inline-end";
    rtl?: boolean;
}

export function ratioFromPageAspectDrag(state: PageAspectResizeState, dx: number, dy: number): number {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(state.width > 0) || !(state.height > 0)
        || !Number.isFinite(state.width) || !Number.isFinite(state.height)) return normalizePageAspectRatio(state.ratio);
    if (state.edge === "inline-end") return dragged((state.width + (state.rtl ? -dx : dx)) / state.height);
    const height = state.height + (state.edge === "top" ? -dy : dy);
    return height <= 0 ? MAX_PAGE_ASPECT_RATIO : dragged(state.width / height);
}

export interface PageAspectResizeOptions {
    /** Return null outside edit mode or when there is no measurable page. Read at the start of each action. */
    read: () => PageAspectResizeState | null;
    /** Transient shadow UI only. Null clears the preview and restores the current authored ratio. */
    preview: (ratio: number | null) => void;
    /** The host writes page-aspect-ratio in one transaction, optionally awaiting its render. */
    commit: (ratio: number) => void | Promise<unknown>;
}

/** Bind to an edit-only, focusable separator. Its host owns ARIA, placement and the reset action. */
export class PageAspectResize {
    #gesture: PointerGesture | null = null;

    constructor(private readonly options: PageAspectResizeOptions) {}

    pointerdown = async (event: PointerEvent) => {
        if (event.button !== 0 || event.defaultPrevented || this.#gesture) return;
        const handle = event.currentTarget;
        const state = this.options.read();
        if (!(handle instanceof HTMLElement) || !handle.isConnected || !state
            || !(state.width > 0) || !(state.height > 0) || !Number.isFinite(state.width) || !Number.isFinite(state.height)) return;
        event.preventDefault();
        event.stopPropagation();
        const initial = { ...state, ratio: normalizePageAspectRatio(state.ratio) };
        const gesture = this.#gesture = new PointerGesture(handle, event);
        try {
            for await (const sample of gesture) {
                if (this.#gesture !== gesture) return;
                this.options.preview(ratioFromPageAspectDrag(initial, sample.dx, sample.dy));
            }
            if (this.#gesture !== gesture || gesture.cancelled || !gesture.moved || !handle.isConnected || !this.options.read()) return;
            const ratio = ratioFromPageAspectDrag(initial, gesture.last.dx, gesture.last.dy);
            if (Math.abs(ratio - initial.ratio) > 1e-10) await this.options.commit(ratio);
        } finally {
            if (this.#gesture === gesture) {
                this.#gesture = null;
                this.options.preview(null);
            }
        }
    };

    /** Claim Escape while the pointer is down, even when focus is outside the separator. */
    cancelOnEscape = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || !this.#gesture || this.#gesture.ended.aborted) return;
        event.preventDefault();
        event.stopPropagation();
        this.disconnect();
    };

    keydown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || this.#gesture || event.ctrlKey || event.metaKey || event.altKey) return;
        const state = this.options.read();
        if (!state) return;
        const directions = state.edge === "inline-end"
            ? { ArrowLeft: state.rtl ? 1 : -1, ArrowRight: state.rtl ? -1 : 1 }
            : { ArrowUp: state.edge === "top" ? -1 : 1, ArrowDown: state.edge === "top" ? 1 : -1 };
        const direction = directions[event.key as keyof typeof directions];
        const current = normalizePageAspectRatio(state.ratio);
        const ratio = event.key === "Home" ? MIN_PAGE_ASPECT_RATIO : event.key === "End" ? MAX_PAGE_ASPECT_RATIO
            : direction ? stepped(current + direction * PAGE_ASPECT_RATIO_STEP) : null;
        if (ratio === null) return;
        event.preventDefault();
        event.stopPropagation();
        if (Math.abs(ratio - current) > 1e-10) void this.options.commit(ratio);
    };

    /** Also call when changing layouts or resetting while a pointer gesture is active. */
    disconnect() {
        const gesture = this.#gesture;
        this.#gesture = null;
        gesture?.cancel();
        if (gesture) this.options.preview(null);
    }
}
