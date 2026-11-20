/// <reference types="mocha" />
import { assert } from "chai";
import { ensurePageKeys, pageKey, readBranches, readNodePosition, writeBranches } from "../src/model/page-branches";

const page = () => document.createElement("div");

export function testBranchModel() {
    describe("page branch model", function () {
        it("ignores malformed JSON, non-array values, and invalid branch entries", function () {
            const element = page();
            assert.deepEqual(readBranches(element), []);
            for (const value of ["", "{", "null", "{}", '"text"', "42"]) {
                element.setAttribute("branches", value);
                assert.deepEqual(readBranches(element), []);
            }
            element.setAttribute("branches", JSON.stringify([
                null, [], 3, {}, { target: "valid", label: 4 }, { target: 4, label: "Invalid" },
                { target: "bad key", label: "Invalid" }, { target: "", label: "Invalid" },
                { target: "destination_1", label: "Continue" },
            ]));
            assert.deepEqual(readBranches(element), [{ target: "destination_1", label: "Continue" }]);
        });

        it("preserves additional fields on valid branches through reading and writing", function () {
            const element = page();
            const branches = [
                { target: "page-one", label: "Continue", condition: { score: 2 }, flags: ["keep"], weight: 0 },
                { target: "page-two", label: "", extra: null },
            ];
            element.setAttribute("branches", JSON.stringify(branches));
            const read = readBranches(element);
            assert.deepEqual(read, branches);
            writeBranches(element, read);
            assert.deepEqual(JSON.parse(element.getAttribute("branches")!), branches);
        });

        it("does not repair or rewrite authored attributes when reading", function () {
            const element = page();
            element.setAttribute("page-key", "invalid key");
            element.setAttribute("branches", "{bad JSON");
            element.setAttribute("node-x", "Infinity");
            element.setAttribute("node-y", " ");
            element.innerHTML = "<p>Keep</p><!--keep-->";
            const original = element.outerHTML;
            pageKey(element);
            readBranches(element);
            readNodePosition(element, 4);
            assert.equal(element.outerHTML, original);
        });

        it("accepts safe keys and tolerates missing pages or invalid keys", function () {
            assert.equal(pageKey(undefined), "");
            const element = page();
            assert.equal(pageKey(element), "");
            for (const key of ["bad key", "bad:port", "<bad>", ""]) {
                element.setAttribute("page-key", key);
                assert.equal(pageKey(element), "");
            }
            element.setAttribute("page-key", "page_A-1");
            assert.equal(pageKey(element), "page_A-1");
        });

        it("repairs missing and duplicate keys once and keeps them stable after reordering", function () {
            const first = page(), existing = page(), missing = page(), invalid = page();
            first.setAttribute("page-key", "first");
            first.setAttribute("branches", '[{"target":"later","label":"Keep"}]');
            existing.setAttribute("page-key", "later");
            invalid.setAttribute("page-key", "invalid key");
            const duplicate = first.cloneNode(true) as Element;
            const pages = [first, duplicate, missing, invalid, existing];
            ensurePageKeys(pages);
            assert.equal(pageKey(first), "first");
            assert.equal(pageKey(existing), "later");
            assert.equal(new Set(pages.map(pageKey)).size, pages.length);
            for (const element of [duplicate, missing, invalid]) assert.match(pageKey(element), /^page-[A-Za-z0-9_-]+$/);
            assert.equal(duplicate.getAttribute("branches"), first.getAttribute("branches"));
            const keys = pages.map(pageKey);
            ensurePageKeys([...pages].reverse());
            assert.deepEqual(pages.map(pageKey), keys);
        });

        it("uses grid defaults for missing or nonfinite coordinates and retains finite coordinates", function () {
            const element = page();
            assert.deepEqual(readNodePosition(element, 0), { x: 32, y: 32 });
            assert.deepEqual(readNodePosition(element, 2), { x: 552, y: 32 });
            assert.deepEqual(readNodePosition(element, 3), { x: 32, y: 172 });
            for (const value of ["", " ", "NaN", "Infinity", "-Infinity", "invalid"]) {
                element.setAttribute("node-x", value);
                element.setAttribute("node-y", value);
                assert.deepEqual(readNodePosition(element, 4), { x: 292, y: 172 });
            }
            element.setAttribute("node-x", "0");
            element.setAttribute("node-y", "-15.5");
            assert.deepEqual(readNodePosition(element, 4), { x: 0, y: -15.5 });
            element.removeAttribute("node-y");
            assert.deepEqual(readNodePosition(element, 4), { x: 0, y: 172 });
        });

        it("writes branches and removes an empty branch attribute without changing other content", function () {
            const element = page();
            element.setAttribute("page-key", "keep");
            element.innerHTML = "<p>Keep</p><!--keep-->";
            const branches = [{ target: "destination", label: "Go" }];
            writeBranches(element, branches);
            assert.deepEqual(JSON.parse(element.getAttribute("branches")!), branches);
            writeBranches(element, []);
            assert.isFalse(element.hasAttribute("branches"));
            assert.equal(element.getAttribute("page-key"), "keep");
            assert.equal(element.innerHTML, "<p>Keep</p><!--keep-->");
        });
    });
}
