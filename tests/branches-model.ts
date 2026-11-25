/// <reference types="mocha" />
import { assert } from "chai";
import { ensurePageKeys, pageKey, readBranches, readNodePosition, writeBranches } from "../src/model/page-branches";
import {
    evaluateBranch,
    formatSignalReference,
    parseSignalReference,
    readBranchConditions,
    readBranchMatch,
    readBranchUnmetMode,
} from "../src/model/branch-conditions";

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

        it("parses and formats signal references and validates branch conditions", function () {
            assert.deepEqual(parseSignalReference("#quiz-1[score]"), { id: "quiz-1", name: "score" });
            const escaped = formatSignalReference("1quiz:a", "my[score]");
            assert.deepEqual(parseSignalReference(escaped), { id: "1quiz:a", name: "my[score]" });
            for (const bad of ["", "quiz[score]", "#quiz", "#quiz[]", "#quiz [score]", "#quiz[a=b]"]) {
                assert.isNull(parseSignalReference(bad), bad);
            }
            assert.equal(readBranchUnmetMode({ target: "a", label: "Go" }), "disable");
            assert.equal(readBranchUnmetMode({ target: "a", label: "Go", whenUnmet: "hide" }), "hide");
            assert.equal(readBranchMatch({ target: "a", label: "Go" }), "and");
            assert.equal(readBranchMatch({ target: "a", label: "Go", whenMatch: "or" }), "or");
            const valid = readBranchConditions({
                target: "a",
                label: "Go",
                when: [
                    { source: "#q[score]", op: ">=", value: 0.7 },
                    { source: "invalid", op: "==", value: true },
                    { source: "#q[score]", op: "invalid" as any, value: 1 },
                    { source: "#q[score]", op: "==", value: Infinity },
                    { source: "#q[complete]", op: "==", value: true },
                ],
            });
            assert.deepEqual(valid, [
                { source: "#q[score]", op: ">=", value: 0.7 },
                { source: "#q[complete]", op: "==", value: true },
            ]);
        });

        it("evaluates compound AND conditions and fails safely on missing or duplicate IDs", function () {
            const container = document.createElement("div");
            let score = 0;
            let complete = false;
            const source = document.createElement("div") as HTMLDivElement & { signals: Record<string, { get(): unknown }> };
            source.id = "quiz-a";
            source.signals = {
                score: { get: () => score },
                complete: { get: () => complete },
            };
            container.append(source);

            const branch = {
                target: "next",
                label: "Advance",
                when: [
                    { source: "#quiz-a[complete]", op: "==" as const, value: true },
                    { source: "#quiz-a[score]", op: ">=" as const, value: 0.8 },
                ],
            };
            assert.isFalse(evaluateBranch(branch, container).available);
            complete = true;
            score = 0.5;
            assert.isFalse(evaluateBranch(branch, container).available);
            score = 0.8;
            assert.isTrue(evaluateBranch(branch, container).available);

            const orBranch = { ...branch, whenMatch: "or" as const };
            score = 0.5;
            complete = true;
            assert.isTrue(evaluateBranch(orBranch, container).available, "OR branch passes when either condition holds");
            complete = false;
            assert.isFalse(evaluateBranch(orBranch, container).available, "OR branch fails when no condition holds");

            const duplicate = document.createElement("span");
            duplicate.id = "quiz-a";
            container.append(duplicate);
            const dupEval = evaluateBranch(branch, container);
            assert.isFalse(dupEval.available);
            assert.isTrue(dupEval.unresolved);
        });
    });
}
