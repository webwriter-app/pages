export type BranchConditionOp = "==" | "!=" | ">=" | ">" | "<=" | "<";
export type BranchConditionMatch = "and" | "or";
export type BranchUnmetMode = "disable" | "hide";

export interface BranchCondition {
    source: string;
    op: BranchConditionOp;
    value: number | boolean | string;
}

/** A page choice; unfamiliar fields remain part of the authored branch. */
export interface PageBranch {
    target: string;
    label: string;
    when?: BranchCondition[];
    whenMatch?: BranchConditionMatch;
    whenUnmet?: BranchUnmetMode;
    [name: string]: unknown;
}

const keyPattern = /^[A-Za-z0-9_-]+$/;

export function pageKey(page?: Element): string {
    const key = page?.getAttribute("page-key") ?? "";
    return keyPattern.test(key) ? key : "";
}

export function readBranches(page: Element): PageBranch[] {
    try {
        const branches: unknown = JSON.parse(page.getAttribute("branches") ?? "[]");
        if (!Array.isArray(branches)) return [];
        return branches.filter((branch): branch is PageBranch =>
            branch !== null && typeof branch === "object" && !Array.isArray(branch)
            && typeof branch.target === "string" && keyPattern.test(branch.target)
            && typeof branch.label === "string"
        );
    } catch {
        return [];
    }
}

/** Call only when editing: reading a document must not assign authored keys. */
export function ensurePageKeys(pages: Element[]): void {
    const reserved = new Set(pages.map(pageKey).filter(Boolean));
    const seen = new Set<string>();
    for (const page of pages) {
        let key = pageKey(page);
        if (!key || seen.has(key)) {
            do { key = `page-${crypto.randomUUID()}`; } while (reserved.has(key));
            page.setAttribute("page-key", key);
            reserved.add(key);
        }
        seen.add(key);
    }
}

export function readNodePosition(page: Element, index: number): { x: number; y: number } {
    const coordinate = (name: string, fallback: number) => {
        const value = page.getAttribute(name);
        const number = value?.trim() ? Number(value) : NaN;
        return Number.isFinite(number) ? number : fallback;
    };
    return {
        x: coordinate("node-x", 32 + (index % 3) * 260),
        y: coordinate("node-y", 32 + Math.floor(index / 3) * 140),
    };
}

export function writeBranches(page: Element, branches: PageBranch[]): void {
    if (branches.length) page.setAttribute("branches", JSON.stringify(branches));
    else page.removeAttribute("branches");
}
