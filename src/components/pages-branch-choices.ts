import { html, nothing } from "lit";
import { live } from "lit/directives/live.js";
import type { PagesView } from "../model/pages-view";
import type { WebwriterPage } from "../widgets/webwriter-page";
import { pageKey, readBranches, type PageBranch } from "../model/page-branches";

/** The bottom pane is the common interface for reading and editing page choices. */
export function renderBranchChoices(view: PagesView, setBranches: (page: WebwriterPage, branches: PageBranch[]) => void, follow: (target: string) => void) {
    const page = view.pages[view.activePageIndex];
    if (!page) return nothing;
    const label = (target: WebwriterPage) => target.getAttribute("label") || `${view.msg("Page")} ${view.pages.indexOf(target) + 1}`;
    const branches = readBranches(page);
    const targets = view.pages.filter((target) => target !== page && !branches.some((branch) => branch.target === pageKey(target)));
    return html`<aside class="branch-controls" part="branch-controls" contenteditable="false" data-ww-capture-selection="false">
        <nav class="branch-choices" aria-label=${view.msg("Page choices")}>
            ${branches.map((branch) => {
                const target = view.pages.find((target) => pageKey(target) === branch.target);
                return view.editing ? html`<div class="branch-choice-edit">
                    <input aria-label=${view.msg("Choice label")} .value=${live(branch.label)}
                        @change=${(event: Event) => setBranches(page, readBranches(page).map((entry) => entry.target === branch.target ? { ...entry, label: (event.target as HTMLInputElement).value } : entry))}>
                    <button type="button" class="branch-choice" ?disabled=${!target} @click=${() => follow(branch.target)}><span aria-hidden="true">→</span> ${target ? label(target) : view.msg("Missing page")}</button>
                    <button type="button" class="remove-choice" title=${view.msg("Remove choice")} aria-label=${view.msg("Remove choice")}
                        @click=${() => setBranches(page, readBranches(page).filter((entry) => entry.target !== branch.target))}>×</button>
                </div>` : target ? html`<button type="button" class="branch-choice" @click=${() => follow(branch.target)}>${branch.label || view.msg("Continue")}</button>` : nothing;
            })}
        </nav>
        ${view.editing ? html`<form class="branch-new-choice" @submit=${(event: SubmitEvent) => {
            event.preventDefault();
            const destination = (event.currentTarget as HTMLFormElement).querySelector<HTMLSelectElement>("select")!.value;
            const target = view.pages.find((target) => pageKey(target) === destination && target.parentElement === page.parentElement);
            const current = readBranches(page);
            if (target && target !== page && !current.some((branch) => branch.target === destination)) setBranches(page, [...current, { target: destination, label: label(target) }]);
        }}>
            <select aria-label=${view.msg("Destination page")} name="destination">
                ${targets.map((target) => html`<option value=${pageKey(target)}>${label(target)}</option>`)}
            </select>
            <button type="submit" class="add-choice" ?disabled=${!targets.length}>${view.msg("Add choice")}</button>
        </form>` : nothing}
    </aside>`;
}
