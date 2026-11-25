export const DEFAULT_BRANCH_NODE_GAP = 16;

export interface BranchNodePosition { x: number; y: number }
export interface BranchNodeBounds extends BranchNodePosition { width: number; height: number }
export interface BranchNodeLayoutInput extends BranchNodePosition {
    key: string;
    /** Bounds relative to the node position, including its label and controls. */
    bounds: Readonly<BranchNodeBounds>;
}

const epsilon = 1e-9;
const intersects = (a: BranchNodeBounds, b: BranchNodeBounds, gap: number) =>
    a.x < b.x + b.width + gap - epsilon && a.x + a.width + gap > b.x + epsilon
    && a.y < b.y + b.height + gap - epsilon && a.y + a.height + gap > b.y + epsilon;

/**
 * Place unique keys in their stable order. Inputs have finite coordinates and nonnegative sizes.
 * Clear preferred positions stay put; collisions move only right/down, with the requested clearance.
 * Equal distances prefer rightward movement. This computes display positions without changing authored data.
 */
export function resolveBranchNodeLayout(nodes: readonly BranchNodeLayoutInput[], gap = DEFAULT_BRANCH_NODE_GAP): Map<string, BranchNodePosition> {
    const spacing = Number.isFinite(gap) && gap >= 0 ? gap : DEFAULT_BRANCH_NODE_GAP;
    const positions = new Map<string, BranchNodePosition>();
    const placed: BranchNodeBounds[] = [];
    for (const node of nodes) {
        const box = (position: BranchNodePosition): BranchNodeBounds => ({
            x: position.x + node.bounds.x, y: position.y + node.bounds.y,
            width: node.bounds.width, height: node.bounds.height,
        });
        let best = { x: node.x, y: node.y };
        if (placed.some(other => intersects(box(best), other, spacing))) {
            // Every nearest feasible position uses the preferred coordinate or a prior box's far edge.
            const xs = [...new Set([node.x, ...placed.map(other => Math.max(node.x, other.x + other.width + spacing - node.bounds.x))])].sort((a, b) => a - b);
            const ys = [...new Set([node.y, ...placed.map(other => Math.max(node.y, other.y + other.height + spacing - node.bounds.y))])].sort((a, b) => a - b);
            best = { x: xs[xs.length - 1], y: node.y }; // Beyond every prior box: always feasible.
            let distance = (best.x - node.x) ** 2;
            for (const x of xs) for (const y of ys) {
                const candidate = (x - node.x) ** 2 + (y - node.y) ** 2;
                if (candidate > distance || (candidate === distance && y >= best.y)) continue;
                const at = { x, y };
                if (placed.some(other => intersects(box(at), other, spacing))) continue;
                best = at;
                distance = candidate;
            }
        }
        positions.set(node.key, best);
        placed.push(box(best));
    }
    return positions;
}
