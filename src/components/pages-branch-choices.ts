import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import arrowRight from "@tabler/icons/outline/arrow-right.svg";
import plusIcon from "@tabler/icons/outline/plus.svg";
import removeIcon from "@tabler/icons/outline/x.svg";
import type { PagesView } from "../model/pages-view";
import type { WebwriterPage } from "../widgets/webwriter-page";
import type { WebwriterPages } from "../widgets/webwriter-pages";
import { pageKey, readBranches, type PageBranch } from "../model/page-branches";

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
function fallbackPopup(event: MouseEvent, id: string, prepare: (popup: HTMLDialogElement) => void) {
    if ("popover" in HTMLElement.prototype) return;
    const root = (event.currentTarget as HTMLElement).getRootNode() as ShadowRoot;
    const dialog = root.getElementById(id) as HTMLDialogElement;
    prepare(dialog);
    dialog.showModal();
}

/** The bottom pane is the common interface for reading and editing page choices. */
export function renderBranchChoices(view: PagesView, setBranches: (page: WebwriterPage, branches: PageBranch[]) => void, follow: (target: string) => void) {
    const page = view.pages[view.activePageIndex];
    if (!page) return nothing;
    const label = (target: WebwriterPage) => target.getAttribute("label") || `${view.msg("Page")} ${view.pages.indexOf(target) + 1}`;
    const branches = readBranches(page).filter((branch, index, all) => all.findIndex((entry) => entry.target === branch.target) === index);
    const destinations = (current?: string) => view.pages.filter((target) => target !== page &&
        (pageKey(target) === current || !readBranches(page).some((branch) => branch.target === pageKey(target))));
    const addId = `choice-add-${pageKey(page)}`;
    const addButton = (popup: HTMLElement) => (popup.getRootNode() as ShadowRoot).querySelector<HTMLButtonElement>(".add-choice");

    const popup = (id: string, original?: string) => {
        const prepare = (dialog: HTMLDialogElement) => {
            const branch = original ? readBranches(page).find((branch) => branch.target === original) : undefined;
            dialog.querySelector<HTMLInputElement>('input[name="label"]')!.value = branch?.label ?? "";
            dialog.querySelector<HTMLSelectElement>('select[name="destination"]')!.value = branch?.target ?? pageKey(destinations()[0]);
        };
        const title = original ? view.msg("Edit choice") : view.msg("Add choice");
        return { prepare, content: html`<dialog id=${id} class="choice-popover" popover="auto" aria-label=${title}
            @beforetoggle=${(event: ToggleEvent) => { if (event.newState === "open") prepare(event.currentTarget as HTMLDialogElement); }}>
            <div class="choice-bubble">
                <div class="choice-popover-heading"><span>${title}</span>
                    <button type="button" class="choice-close" aria-label=${view.msg("Close")} title=${view.msg("Close")}
                        @click=${(event: MouseEvent) => closePopup((event.currentTarget as HTMLElement).closest("dialog")!)}><sl-icon src=${removeIcon} aria-hidden="true"></sl-icon></button>
                </div>
                <form class="choice-form" @submit=${(event: SubmitEvent) => {
                    event.preventDefault();
                    const form = event.currentTarget as HTMLFormElement;
                    const dialog = form.closest("dialog")!;
                    const destination = form.querySelector<HTMLSelectElement>('select[name="destination"]')!.value;
                    const text = form.querySelector<HTMLInputElement>('input[name="label"]')!.value;
                    const target = view.pages.find((target) => target.parentElement === page.parentElement && pageKey(target) === destination);
                    const current = readBranches(page);
                    if (!target || target === page || current.some((branch) => branch.target === destination && branch.target !== original)) return;
                    if (original && !current.some((branch) => branch.target === original)) return;
                    closePopup(dialog, original === destination ? invoker(dialog) : addButton(dialog));
                    setBranches(page, original ? current.map((branch) => branch.target === original ? { ...branch, target: destination, label: text } : branch)
                        : [...current, { target: destination, label: text || label(target) }]);
                }}>
                    <label>${view.msg("Choice label")}<input name="label" class="choice-label-input" type="text" autofocus></label>
                    <label>${view.msg("Destination page")}<select name="destination" class="choice-destination" required>
                        ${original && !view.pages.some((target) => pageKey(target) === original) ? html`<option value=${original} disabled>${view.msg("Missing page")}</option>` : nothing}
                        ${destinations(original).map((target) => html`<option value=${pageKey(target)}>${label(target)}</option>`)}
                    </select></label>
                    <div class="choice-popover-actions">
                        ${original ? html`<button type="button" class="remove-choice" @click=${(event: MouseEvent) => {
                            const dialog = (event.currentTarget as HTMLElement).closest("dialog")!;
                            closePopup(dialog, addButton(dialog));
                            setBranches(page, readBranches(page).filter((branch) => branch.target !== original));
                        }}>${view.msg("Remove choice")}</button>` : nothing}
                        <button type="submit" class="choice-save">${original ? view.msg("Save") : view.msg("Add choice")}</button>
                    </div>
                </form>
            </div>
        </dialog>` };
    };

    const addition = view.editing ? popup(addId) : undefined;
    return html`<aside class="branch-controls" part="branch-controls" contenteditable="false" data-ww-capture-selection="false">
        <nav class="branch-choices" aria-label=${view.msg("Page choices")}>
            ${repeat(branches, (branch) => branch.target, (branch) => {
                const target = view.pages.find((target) => pageKey(target) === branch.target);
                if (!view.editing) return target ? html`<button type="button" class="branch-choice" @click=${() => follow(branch.target)}>${branch.label || view.msg("Continue")}</button>` : nothing;
                const id = `choice-edit-${pageKey(page)}-${branch.target}`;
                const editor = popup(id, branch.target);
                const goTo = target ? `${view.msg("Go to page")}: ${label(target)}` : view.msg("Missing page");
                return html`<div class="branch-choice-wrap">
                    <button type="button" class="branch-choice" popovertarget=${id} aria-haspopup="dialog" title=${view.msg("Edit choice")}
                        @click=${(event: MouseEvent) => fallbackPopup(event, id, editor.prepare)}>${branch.label || view.msg("Continue")}</button>
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
                ?disabled=${!destinations().length} @click=${(event: MouseEvent) => fallbackPopup(event, addId, addition.prepare)}><sl-icon src=${plusIcon} aria-hidden="true"></sl-icon></button>${addition.content}` : nothing}
        </nav>
    </aside>`;
}
