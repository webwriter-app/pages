/// <reference types="mocha" />
import { assert } from "chai";
import { MAX_PAGE_ASPECT_RATIO, MIN_PAGE_ASPECT_RATIO, PageAspectResize, normalizePageAspectRatio, ratioFromPageAspectDrag, type PageAspectResizeState } from "../src/components/page-aspect-resize";

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

        it("previews without authored writes and commits only once on release", async function () {
            pointer("pointerdown");
            pointer("pointermove", 20, 70);
            await tick();
            assert.closeTo(previews.at(-1)!, 1.7, 1e-10);
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
    });
}
