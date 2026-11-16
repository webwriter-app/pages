/** Draws a small WebP preview of a slide; the capture library is loaded when the first one is needed. */
export async function captureThumbnail(slide: Element): Promise<string> {
    const { snapdom } = await import("@zumer/snapdom");
    const result = await snapdom(slide, { width: 240, height: 135, dpr: 1 });
    const img = await result.toWebp({ quality: 0.8 });
    return img.src;
}
