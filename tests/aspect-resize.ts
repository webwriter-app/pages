/// <reference types="mocha" />
import { assert } from "chai";
import { MAX_PAGE_ASPECT_RATIO, MIN_PAGE_ASPECT_RATIO, PAGE_ASPECT_RATIO_STEP, PageAspectResize, formatPageAspectRatio, normalizePageAspectRatio, ratioFromPageAspectDrag, type PageAspectResizeState } from "../src/components/page-aspect-resize";

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const tick = async () => { await frame(); await frame(); };

export function testAspectResize() {
    describe("page aspect resize helper", function () {
        const bottom: PageAspectResizeState = { ratio: 2, width: 600, height: 300, edge: "bottom" };
        let handle: HTMLElement;
        let resize: PageAspectResize;
        let current: PageAspectResizeState | null;
        let previews: (number | null)[];
        let commits: number[];

        beforeEach(function () {
            current = { ...bottom };
            previews = [];
            commits = [];
            handle = document.createElement("div");
            handle.tabIndex = 0;
            document.body.append(handle);
            resize = new PageAspectResize({
                read: () => current,
                preview: ratio => previews.push(ratio),
                commit: ratio => { commits.push(ratio); handle.setAttribute("page-aspect-ratio", String(ratio)); },
            });
            handle.addEventListener("pointerdown", resize.pointerdown);
            handle.addEventListener("keydown", resize.keydown);
        });

        afterEach(function () { resize.disconnect(); handle.remove(); });

        const pointer = (type: string, x = 20, y = 20) => {
            const target = type === "pointerdown" ? handle : window;
            target.dispatchEvent(new PointerEvent(type, { pointerId: 91, pointerType: "mouse", button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
        };
        const key = (name: string) => {
            const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
            handle.dispatchEvent(event);
            return event;
        };

        it("clamps finite ratios and keeps exact orientation defaults for invalid input", function () {
            assert.equal(normalizePageAspectRatio(0), MIN_PAGE_ASPECT_RATIO);
            assert.equal(normalizePageAspectRatio(30), MAX_PAGE_ASPECT_RATIO);
            assert.equal(normalizePageAspectRatio(NaN), 16 / 9);
            assert.equal(normalizePageAspectRatio(Infinity, 9 / 16), 9 / 16);
            assert.equal(normalizePageAspectRatio(NaN, NaN), 16 / 9);
        });

        it("uses the seam side, horizontal RTL direction and fixed initial dimensions", function () {
            assert.closeTo(ratioFromPageAspectDrag(bottom, 0, 100), 1.5, 1e-10);
            assert.closeTo(ratioFromPageAspectDrag({ ...bottom, edge: "top" }, 0, 100), 3, 1e-10);
            assert.closeTo(ratioFromPageAspectDrag({ ...bottom, edge: "inline-end" }, 90, 500), 2.3, 1e-10);
            assert.closeTo(ratioFromPageAspectDrag({ ...bottom, edge: "inline-end", rtl: true }, 90, 500), 1.7, 1e-10);
            assert.equal(ratioFromPageAspectDrag(bottom, 0, -500), MAX_PAGE_ASPECT_RATIO);
            assert.equal(ratioFromPageAspectDrag(bottom, 0, 5000), MIN_PAGE_ASPECT_RATIO);
            assert.equal(ratioFromPageAspectDrag({ ...bottom, width: Infinity }, 10, 10), 2);
        });

        it("snaps a drag to exact 16:9 through both expanded snap boundaries, then returns to ordinary steps", function () {
            const exact = 16 / 9, reach = 1.5 * PAGE_ASPECT_RATIO_STEP;
            for (const offset of [-reach, -PAGE_ASPECT_RATIO_STEP, 0, PAGE_ASPECT_RATIO_STEP, reach]) {
                const raw = exact + offset;
                assert.equal(ratioFromPageAspectDrag(bottom, 0, bottom.width / raw - bottom.height), exact);
                assert.equal(ratioFromPageAspectDrag({ ...bottom, edge: "inline-end" }, raw * bottom.height - bottom.width, 0), exact);
            }
            assert.equal(ratioFromPageAspectDrag(bottom, 0, bottom.width / (exact - reach - 0.0001) - bottom.height), 1.7);
            assert.equal(ratioFromPageAspectDrag(bottom, 0, bottom.width / (exact + reach + 0.0001) - bottom.height), 1.85);
        });

        it("formats familiar exact and nearby ratios as small whole-number fractions", function () {
            for (const [ratio, label] of [[16 / 9, "16:9"], [4 / 3, "4:3"], [1.35, "4:3"], [3 / 2, "3:2"], [5 / 4, "5:4"], [9 / 16, "9:16"], [1.6, "8:5"], [0.75, "3:4"]] as const) {
                assert.equal(formatPageAspectRatio(ratio), label);
            }
            assert.equal(formatPageAspectRatio(-20), "1:2");
            assert.equal(formatPageAspectRatio(20), "3:1");
            assert.equal(formatPageAspectRatio(NaN), "16:9");
            assert.equal(formatPageAspectRatio(Infinity), "16:9");
            for (const ratio of [0.53, 0.7, 1.1, 1.95, 2.71]) {
                const label = formatPageAspectRatio(ratio);
                assert.match(label, /^[1-9]\d?:[1-9]\d?$/);
                const [width, height] = label.split(":").map(Number);
                assert.isAtMost(width, 36);
                assert.isAtMost(height, 16);
                assert.closeTo(width / height, ratio, 0.05, "bounded fractions stay close to the live ratio");
            }
        });

        it("previews without authored writes and commits only once on release", async function () {
            pointer("pointerdown");
            pointer("pointermove", 20, 70);
            await tick();
            assert.equal(previews.at(-1), 16 / 9, "raw 600/350 enters the expanded 16:9 snap range");
            assert.deepEqual(commits, []);
            assert.isFalse(handle.hasAttribute("page-aspect-ratio"));
            pointer("pointermove", 20, 120);
            await tick();
            pointer("pointerup", 20, 120);
            await tick();
            assert.deepEqual(commits, [1.5]);
            assert.equal(handle.getAttribute("page-aspect-ratio"), "1.5");
            assert.isNull(previews.at(-1));
        });

        for (const cancel of ["Escape", "pointercancel", "disconnect"]) {
            it(`restores the preview without persisting after ${cancel}`, async function () {
                pointer("pointerdown");
                pointer("pointermove", 20, 120);
                await tick();
                if (cancel === "Escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                else if (cancel === "pointercancel") pointer("pointercancel");
                else resize.disconnect();
                await tick();
                pointer("pointerup", 20, 120);
                await tick();
                assert.deepEqual(commits, []);
                assert.isFalse(handle.hasAttribute("page-aspect-ratio"));
                assert.isNull(previews.at(-1));
            });
        }

        it("does not commit a click, a detached handle or a gesture after edit mode ends", async function () {
            pointer("pointerdown"); pointer("pointerup"); await tick();
            assert.deepEqual(commits, []);
            pointer("pointerdown"); pointer("pointermove", 20, 120); await tick();
            current = null;
            pointer("pointerup", 20, 120); await tick();
            assert.deepEqual(commits, []);
            current = { ...bottom };
            pointer("pointerdown"); pointer("pointermove", 20, 120); await tick();
            handle.remove();
            pointer("pointerup", 20, 120); await tick();
            assert.deepEqual(commits, []);
            assert.isNull(previews.at(-1));
        });

        it("uses arrows and Home/End with the same step and bounds, leaving unrelated keys alone", function () {
            assert.isTrue(key("ArrowUp").defaultPrevented);
            assert.equal(commits.at(-1), 2.05, "step values serialize without floating-point tails");
            current = { ...bottom, edge: "top" };
            key("ArrowUp");
            assert.closeTo(commits.at(-1)!, 1.95, 1e-10);
            current = { ...bottom, edge: "inline-end", rtl: true };
            key("ArrowRight");
            assert.closeTo(commits.at(-1)!, 1.95, 1e-10);
            key("Home"); assert.equal(commits.at(-1), MIN_PAGE_ASPECT_RATIO);
            key("End"); assert.equal(commits.at(-1), MAX_PAGE_ASPECT_RATIO);
            const count = commits.length;
            assert.isFalse(key("Tab").defaultPrevented);
            assert.isFalse(key("ArrowUp").defaultPrevented);
            assert.equal(commits.length, count);
            current = { ...bottom, ratio: MAX_PAGE_ASPECT_RATIO };
            key("End");
            assert.equal(commits.length, count, "bounds are a no-op");
        });

        it("keeps keyboard steps unsnapped inside the drag magnet", function () {
            current = { ...bottom, ratio: 1.75 };
            key("ArrowUp");
            assert.equal(commits.at(-1), 1.8);
            current = { ...bottom, ratio: 1.85 };
            key("ArrowDown");
            assert.equal(commits.at(-1), 1.8);
            assert.notEqual(commits.at(-1), 16 / 9);
        });
    });
}
