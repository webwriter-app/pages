import type { MsgFn } from "@lit/localize";

/** What the slide strip and the controls need from the slideshow to render and to act. */
export interface SlidesView {
    msg: MsgFn;
    slides: { thumbnail?: string }[];
    activeSlideIndex: number;
    editing: boolean;
    isFullscreen: boolean;
    hasPreviousSlide: boolean;
    hasNextSlide: boolean;
    changeSlide(index: number): void;
    addSlide(index?: number): void;
    duplicateSlide(index: number): void;
    removeSlide(index: number): void;
    handleNextSlideClick(e: MouseEvent | KeyboardEvent, backwards?: boolean): void;
    toggleFullscreen(): void;
    onDragCommit(e: Event): void;
}
