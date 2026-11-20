/// <reference types="mocha" />
import { assert } from "chai";
import { resolveBranchNodeLayout, type BranchNodeLayoutInput, type BranchNodePosition } from "../src/model/branch-node-layout";

const node = (key: string, x: number, y: number, width = 100, height = 100): BranchNodeLayoutInput => ({ key, x, y, bounds: { x: 0, y: 0, width, height } });

function assertSeparated(nodes: readonly BranchNodeLayoutInput[], positions: Map<string, BranchNodePosition>, gap = 16) {
    const boxes = nodes.map(input => {
        const position = positions.get(input.key)!;
        assert.isAtLeast(position.x, input.x);
        assert.isAtLeast(position.y, input.y);
        return { x: position.x + input.bounds.x, y: position.y + input.bounds.y, width: input.bounds.width, height: input.bounds.height };
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        assert.isTrue(a.x + a.width + gap <= b.x + 1e-8 || b.x + b.width + gap <= a.x + 1e-8
            || a.y + a.height + gap <= b.y + 1e-8 || b.y + b.height + gap <= a.y + 1e-8, `boxes ${i} and ${j} stay separated`);
    }
}

export function testBranchNodeLayout() {
    describe("branch node display layout", function () {
        it("preserves clear preferred positions and stable key order without mutating inputs", function () {
            const inputs = Object.freeze([
                Object.freeze({ ...node("negative", -120, -70), bounds: Object.freeze({ x: -4, y: -20, width: 100, height: 80 }) }),
                Object.freeze({ ...node("distant", 310, 220), bounds: Object.freeze({ x: 0, y: 0, width: 100, height: 100 }) }),
            ]);
            const before = JSON.stringify(inputs);
            const result = resolveBranchNodeLayout(inputs);
            assert.deepEqual([...result], [["negative", { x: -120, y: -70 }], ["distant", { x: 310, y: 220 }]]);
            assert.equal(JSON.stringify(inputs), before);
            result.get("negative")!.x = 12;
            assert.equal(inputs[0].x, -120, "output positions are independent objects");
            assert.equal(resolveBranchNodeLayout([]).size, 0);
        });

        it("chooses the nearest right or down displacement and resolves equal distances consistently", function () {
            assert.deepEqual(resolveBranchNodeLayout([node("a", 0, 0, 40, 100), node("b", 0, 0, 40, 100)]).get("b"), { x: 56, y: 0 });
            assert.deepEqual(resolveBranchNodeLayout([node("a", 0, 0, 100, 40), node("b", 0, 0, 100, 40)]).get("b"), { x: 0, y: 56 });
            assert.deepEqual(resolveBranchNodeLayout([node("a", 0, 0), node("b", 0, 0)]).get("b"), { x: 116, y: 0 });
        });

        it("finds a nearer combined displacement around staggered prior obstacles", function () {
            const inputs = [node("a", 0, 0), node("b", 120, -100, 100, 200), node("c", -100, 120, 200, 100), node("moving", 80, 80, 40, 40)];
            const result = resolveBranchNodeLayout(inputs);
            assert.deepEqual(result.get("moving"), { x: 116, y: 116 }, "diagonal clearance is nearer than going around the entire row or column");
            assertSeparated(inputs, result);
        });

        it("resolves chains of identical preferred positions deterministically", function () {
            const inputs = Array.from({ length: 24 }, (_, i) => node(`node-${i}`, 0, 0, 40, 30));
            const first = resolveBranchNodeLayout(inputs, 8);
            assertSeparated(inputs, first, 8);
            assert.deepEqual([...resolveBranchNodeLayout(inputs, 8)], [...first]);
            assert.deepEqual([...first.keys()], inputs.map(input => input.key));
        });

        it("uses relative label/control bounds when calculating the closest placement", function () {
            const inputs = [
                { ...node("large", 0, 0), bounds: { x: -8, y: -30, width: 120, height: 100 } },
                { ...node("offset", 0, 0), bounds: { x: 12, y: 10, width: 30, height: 20 } },
            ];
            const result = resolveBranchNodeLayout(inputs);
            assert.deepEqual(result.get("offset"), { x: 0, y: 76 });
            assertSeparated(inputs, result);
        });

        it("handles negative positions and fractional dimensions and clearance", function () {
            const inputs = [node("a", -10.5, -20.25, 31.25, 22.75), node("b", -10.5, -20.25, 31.25, 22.75), node("c", -10.5, -20.25, 31.25, 22.75)];
            const result = resolveBranchNodeLayout(inputs, 0.125);
            assert.deepEqual(result.get("b"), { x: -10.5, y: 2.625 });
            assert.deepEqual(result.get("c"), { x: 20.875, y: -20.25 });
            assertSeparated(inputs, result, 0.125);
        });

        it("recomputes collisions after bounds grow and restores preferred positions when they shrink", function () {
            const inputs = [node("a", 0, 0, 100, 80), node("b", 0, 100, 100, 80)];
            const original = resolveBranchNodeLayout(inputs);
            assert.deepEqual(original.get("b"), { x: 0, y: 100 });
            const expanded = inputs.map(input => ({ ...input, bounds: { ...input.bounds, height: 200 } }));
            const result = resolveBranchNodeLayout(expanded);
            assertSeparated(expanded, result);
            assert.notDeepEqual(result.get("b"), original.get("b"));
            assert.deepEqual([...resolveBranchNodeLayout(inputs)], [...original]);
            assert.equal(inputs[1].y, 100, "preferred authored position is retained");
        });

        it("allows touching edges with zero gap and moves only the colliding node", function () {
            const inputs = [node("a", 0, 0), node("touching", 100, 0), node("overlap", 50, 0)];
            const result = resolveBranchNodeLayout(inputs, 0);
            assert.deepEqual(result.get("a"), { x: 0, y: 0 });
            assert.deepEqual(result.get("touching"), { x: 100, y: 0 });
            assert.deepEqual(result.get("overlap"), { x: 50, y: 100 });
            assertSeparated(inputs, result, 0);
        });
    });
}
