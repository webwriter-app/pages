/** Draws a small WebP preview of a page; the capture library is loaded when the first one is needed. */
export async function captureThumbnail(page: Element, width = 240): Promise<string> {
    const { snapdom } = await import("@zumer/snapdom");
    const result = await snapdom(page, { width, dpr: 1 });
    const img = await result.toWebp({ quality: 0.8 });
    return img.src;
}

/** Three capture sizes, selected by the preview's physical screen width. */
export function nodePreviewResolution(width: number, scale: number, dpr = 1): number {
    const pixels = Math.max(1, width * scale * dpr);
    return pixels <= 160 ? 160 : pixels <= 320 ? 320 : 640;
}
