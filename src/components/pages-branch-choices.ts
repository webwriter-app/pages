import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import arrowRight from "@tabler/icons/outline/arrow-right.svg";
import plusIcon from "@tabler/icons/outline/plus.svg";
import removeIcon from "@tabler/icons/outline/x.svg";
import trashIcon from "@tabler/icons/outline/trash.svg";
import chevronDown from "@tabler/icons/outline/chevron-down.svg";
import chevronUp from "@tabler/icons/outline/chevron-up.svg";
import { renderControls } from "./pages-controls";
import type { PagesView } from "../model/pages-view";
import type { WebwriterPage } from "../widgets/webwriter-page";
import type { WebwriterPages } from "../widgets/webwriter-pages";
import { pageKey, readBranches, type PageBranch } from "../model/page-branches";
import { evaluateBranch, formatConditionSummary, readBranchConditions, readBranchUnmetMode, signalRootFor } from "../model/branch-conditions";
import type { ConditionsDraftResult, PagesChoiceConditions } from "./pages-choice-conditions";

const newPageDestination = "new:page";

function invoker(popup: HTMLElement) {
    return (popup.getRootNode() as ShadowRoot).querySelector<HTMLButtonElement>(`[popovertarget="${popup.id}"]`);
}

function closePopup(popup: HTMLDialogElement, focus = invoker(popup)) {
    const host = (popup.getRootNode() as ShadowRoot).host as WebwriterPages;
    if (typeof popup.hidePopover === "function") {
        if (popup.matches(":popover-open")) popup.hidePopover();
    } else if (popup.open) popup.close();
    // Saving/removing can replace the invoker or enable the trailing add button.
    queueMicrotask(async () => {
        await host.updateComplete;
        if (!focus?.isConnected) return;
        const button = !focus.disabled ? focus : host.shadowRoot?.querySelector<HTMLButtonElement>(".branch-choice");
        button?.focus({ preventScroll: true });
    });
}

/** Native auto-popovers provide Escape/light dismissal; older engines use a modal dialog. */
function fallbackPopup(event: MouseEvent, id: string, prepare: (popup: HTMLDialogElement) => void, onOpen?: (popup: HTMLDialogElement) => void) {
    if ("popover" in HTMLElement.prototype) return;
    const root = (event.currentTarget as HTMLElement).getRootNode() as ShadowRoot;
    const dialog = root.getElementById(id) as HTMLDialogElement;
    prepare(dialog);
    dialog.showModal();
    onOpen?.(dialog);
}

/** The bottom pane is the common interface for reading and editing page choices. */
export function renderBranchChoices(
    view: PagesView,
    setBranches: (page: WebwriterPage, branches: PageBranch[], draft?: { target: string; result: ConditionsDraftResult }) => void,
    follow: (target: string) => void,
    graphExpanded: boolean,
    toggleGraph: () => void,
    addPageChoice: (source: WebwriterPage, label: string, draft?: ConditionsDraftResult) => void,
    locale = "en",
    onPendingTags?: (tags: string[]) => void,
    onHighlightChange?: (elements: Element[]) => void,
) {
    const page = view.pages[view.activePageIndex];
    const host = page?.parentElement;
    const signalRoot = host ? signalRootFor(host) : undefined;
    const label = (target: WebwriterPage) => target.getAttribute("label") || `${view.msg("Page")} ${view.pages.indexOf(target) + 1}`;
    const branches = (page ? readBranches(page) : []).filter((branch, index, all) => all.findIndex((entry) => entry.target === branch.target) === index);
    const destinations = (current?: string) => view.pages.filter((target) => target !== page &&
        (pageKey(target) === current || !readBranches(page).some((branch) => branch.target === pageKey(target))));
    const addId = `choice-add-${pageKey(page)}`;
    const addButton = (popup: HTMLElement) => (popup.getRootNode() as ShadowRoot).querySelector<HTMLButtonElement>(".add-choice");

    const popup = (id: string, original?: string) => {
        const updatePlaceholder = (dialog: HTMLDialogElement) => {
            const destination = dialog.querySelector<HTMLSelectElement>('select[name="destination"]')!.value;
            const target = view.pages.find((target) => pageKey(target) === destination);
            dialog.querySelector<HTMLInputElement>('input[name="label"]')!.placeholder = target ? label(target)
                : destination === newPageDestination ? `${view.msg("Page")} ${view.pages.length + 1}` : view.msg("Missing page");
        };
        const prepare = (dialog: HTMLDialogElement) => {
            const branch = original ? readBranches(page).find((branch) => branch.target === original) : undefined;
            dialog.querySelector<HTMLInputElement>('input[name="label"]')!.value = branch?.label ?? "";
            dialog.querySelector<HTMLSelectElement>('select[name="destination"]')!.value = branch?.target ?? newPageDestination;
            const condEditor = dialog.querySelector<PagesChoiceConditions>("pages-choice-conditions");
            if (condEditor && host) condEditor.load(branch, host, page, view.msg, locale);
            updatePlaceholder(dialog);
        };
        const syncHighlights = (dialog: HTMLDialogElement) => {
            const condEditor = dialog.querySelector<PagesChoiceConditions>("pages-choice-conditions");
            onHighlightChange?.(condEditor?.getHighlightedElements(signalRoot) ?? []);
        };
        const saveChoice = (form: HTMLFormElement) => {
            const dialog = form.closest("dialog")!;
            const destination = form.querySelector<HTMLSelectElement>('select[name="destination"]')!.value;
            const text = form.querySelector<HTMLInputElement>('input[name="label"]')!.value;
            const draftResult = form.querySelector<PagesChoiceConditions>("pages-choice-conditions")?.getResult();
            if (!original && destination === newPageDestination) {
                addPageChoice(page, text, draftResult);
                onHighlightChange?.([]);
                closePopup(dialog, addButton(dialog));
                return;
            }
            const siblings = Array.from(page.parentElement?.children ?? []).filter((el): el is WebwriterPage => el.localName === "webwriter-page");
            const target = siblings.find((candidate) => pageKey(candidate) === destination);
            const current = readBranches(page);
            if (!target || target === page || current.some((branch) => branch.target === destination && branch.target !== original)) return;
            if (original && !current.some((branch) => branch.target === original)) return;
            const nextBranches = original
                ? current.map((branch) => branch.target === original ? { ...branch, target: destination, label: text } : branch)
                : [...current, { target: destination, label: text }];
            setBranches(page, nextBranches, draftResult ? { target: destination, result: draftResult } : undefined);
            onHighlightChange?.([]);
            closePopup(dialog, original === destination ? invoker(dialog) : addButton(dialog));
        };
        const title = original ? view.msg("Edit choice") : view.msg("Add choice");
        return { prepare, syncHighlights, content: html`<dialog id=${id} class="choice-popover" popover="auto" aria-label=${title}
            @beforetoggle=${(event: ToggleEvent) => {
                const dialog = event.currentTarget as HTMLDialogElement;
                if (event.newState === "open") {
                    prepare(dialog);
                    syncHighlights(dialog);
                } else {
                    onHighlightChange?.([]);
                }
            }}
            @close=${() => onHighlightChange?.([])}>
            <div class="choice-bubble">
                <div class="choice-popover-heading"><span>${title}</span>
                    <button type="button" class="choice-close" aria-label=${view.msg("Close")} title=${view.msg("Close")}
                        @click=${(event: MouseEvent) => closePopup((event.currentTarget as HTMLElement).closest("dialog")!)}><sl-icon src=${removeIcon} aria-hidden="true"></sl-icon></button>
                </div>
                <form class="choice-form" novalidate @submit=${(event: SubmitEvent) => {
                    event.preventDefault();
                    saveChoice(event.currentTarget as HTMLFormElement);
                }}>
                    <div class="choice-basics">
                        <label for=${`${id}-destination`}>${view.msg("Destination")}<select id=${`${id}-destination`} name="destination" class="choice-destination" required autofocus
                            @change=${(event: Event) => updatePlaceholder((event.currentTarget as HTMLElement).closest("dialog")!)}>
                            ${!original ? html`<option value=${newPageDestination}>${view.msg("New page")}</option>` : nothing}
                            ${original && !view.pages.some((target) => pageKey(target) === original) ? html`<option value=${original} disabled>${view.msg("Missing page")}</option>` : nothing}
                            ${destinations(original).map((target) => html`<option value=${pageKey(target)}>${label(target)}</option>`)}
                        </select></label>
                        <label for=${`${id}-label`}>${view.msg("Label")}<input id=${`${id}-label`} name="label" class="choice-label-input" type="text"></label>
                    </div>
                    <pages-choice-conditions @conditions-change=${(event: Event) => {
                        const dialog = (event.currentTarget as HTMLElement).closest("dialog");
                        if (dialog && (dialog.matches(":popover-open") || dialog.open)) syncHighlights(dialog);
                    }}></pages-choice-conditions>
                    <div class="choice-popover-actions">
                        ${original ? html`<button type="button" class="remove-choice" aria-label=${view.msg("Remove choice")} title=${view.msg("Remove choice")} @click=${(event: MouseEvent) => {
                            const dialog = (event.currentTarget as HTMLElement).closest("dialog")!;
                            onHighlightChange?.([]);
                            closePopup(dialog, addButton(dialog));
                            setBranches(page, readBranches(page).filter((branch) => branch.target !== original));
                        }}><sl-icon src=${trashIcon} aria-hidden="true"></sl-icon></button>` : nothing}
                        <button type="button" class="choice-save" @click=${(event: MouseEvent) => saveChoice((event.currentTarget as HTMLElement).closest("form")!)}>${original ? view.msg("Save") : view.msg("Add choice")}</button>
                    </div>
                </form>
            </div>
        </dialog>` };
    };

    const addition = view.editing && page ? popup(addId) : undefined;
    const toggleLabel = graphExpanded ? view.msg("Collapse graph") : view.msg("Expand graph");
    const pendingTags: string[] = [];
    const content = html`<aside class="branch-controls ${view.editing && graphExpanded ? "graph-expanded" : ""}" part="branch-controls" contenteditable="false">
        <nav class="branch-choices" aria-label=${view.msg("Page choices")}>
            ${repeat(branches, (branch) => branch.target, (branch) => {
                const target = view.pages.find((target) => pageKey(target) === branch.target);
                const summary = signalRoot ? formatConditionSummary(branch, signalRoot, locale) : "";
                if (!view.editing) {
                    if (!target) return nothing;
                    const evaluation = signalRoot ? evaluateBranch(branch, signalRoot) : { available: true, hasConditions: false, unresolved: false, pendingTags: [] };
                    for (const tag of evaluation.pendingTags) {
                        if (!pendingTags.includes(tag)) pendingTags.push(tag);
                    }
                    if (!evaluation.available && readBranchUnmetMode(branch) === "hide") return nothing;
                    const text = branch.label || label(target);
                    return html`<button type="button" class="branch-choice" ?disabled=${!evaluation.available}
                        title=${!evaluation.available && summary ? summary : nothing}
                        @click=${() => follow(branch.target)}>${text}</button>`;
                }
                const id = `choice-edit-${pageKey(page)}-${branch.target}`;
                const editor = popup(id, branch.target);
                const goTo = target ? `${view.msg("Go to page")}: ${label(target)}` : view.msg("Missing page");
                const hasConditions = readBranchConditions(branch).length > 0;
                const editTitle = summary ? `${view.msg("Edit choice")} (${summary})` : view.msg("Edit choice");
                return html`<div class="branch-choice-wrap">
                    <button type="button" class="branch-choice" popovertarget=${id} aria-haspopup="dialog" title=${editTitle}
                        ?data-conditional=${hasConditions}
                        @click=${(event: MouseEvent) => fallbackPopup(event, id, editor.prepare, editor.syncHighlights)}>${branch.label || (target ? label(target) : view.msg("Missing page"))}</button>
                    <button type="button" class="choice-goto" ?disabled=${!target} title=${goTo} aria-label=${goTo}
                        @click=${(event: MouseEvent) => {
                            const root = (event.currentTarget as HTMLElement).getRootNode() as ShadowRoot;
                            const dialog = root.getElementById(id) as HTMLDialogElement;
                            if (dialog) closePopup(dialog, event.currentTarget as HTMLButtonElement);
                            follow(branch.target);
                        }}><sl-icon src=${arrowRight} aria-hidden="true"></sl-icon></button>
                    ${editor.content}
                </div>`;
            })}
            ${addition ? html`<button type="button" class="add-choice" popovertarget=${addId} aria-haspopup="dialog" title=${view.msg("Add choice")} aria-label=${view.msg("Add choice")}
                @click=${(event: MouseEvent) => fallbackPopup(event, addId, addition.prepare, addition.syncHighlights)}><sl-icon src=${plusIcon} aria-hidden="true"></sl-icon></button>${addition.content}` : nothing}
        </nav>
        <div class="branch-tools">
            ${view.editing ? html`<button type="button" class="graph-toggle" aria-expanded=${String(graphExpanded)} aria-controls="branch-editor" aria-label=${toggleLabel} title=${toggleLabel}
                @click=${toggleGraph}><sl-icon src=${graphExpanded ? chevronDown : chevronUp} aria-hidden="true"></sl-icon></button>` : nothing}
            <div class="branch-fullscreen">${renderControls(view, "none", false)}</div>
        </div>
    </aside>`;
    if (pendingTags.length) onPendingTags?.(pendingTags);
    return content;
}
