/** A detached `section` with a copy of the slide content; the slide stays as it is. */
export function slideToSection(slide: Element, doc: Document): HTMLElement {
    const section = doc.createElement("section");
    for (const child of Array.from(slide.childNodes)) section.append(child.cloneNode(true));
    return section;
}

/**
 * The slides a `section` stands for: its nested `section` children when it has any
 * (one slide each), otherwise the section itself.
 */
export function sectionToSlides(source: Element, doc: Document): HTMLElement[] {
    const nested = Array.from(source.children).filter((child) => child.localName === "section");
    const parts = nested.length ? nested : [source];
    return parts.map((part) => {
        const slide = doc.createElement("webwriter-slide");
        for (const child of Array.from(part.childNodes)) slide.append(child.cloneNode(true));
        if (!slide.querySelector("*") && !slide.textContent?.trim()) slide.replaceChildren(doc.createElement("p"));
        return slide;
    });
}
