# Slides (`@webwriter/slides@3.0.0`)
[License: MIT](LICENSE) | Version: 3.0.0

Present content as a sequence of slides or tabs.

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| Example | `@webwriter/slides/snippets/example.html` |



## `WebwriterSlides` (`<webwriter-slides>`)
Container for displaying a slideshow of content sequentially.

Authors add `webwriter-slide` children; the `type` attribute switches between a thumbnail strip ("slides")
and a tab strip ("tabs"). Thumbnails are drawn in the editor with a capture library that loads on first use.
In use mode the arrow keys, the controls and swipes in fullscreen move between slides. The arrow keys leave
text entry, Alt and Meta combinations alone. Every thumbnail and tab has a button that selects its slide;
in edit mode Space or Enter on the thumbnail itself picks it up for reordering.

The widget follows the page theme: `--ww-text-color`, `--ww-font-family`, and `--ww-theme-accent-1` (the
selected thumbnail or tab). On paper it prints all slides one after another and leaves out the controls.

Conversions: a `section` becomes slides (its nested `section` children become one slide each, otherwise the
section is one slide), and the slides convert to a fragment of `section` elements with the slide content.
The thumbnails are not carried over.

Signals: `slide` is the number of the current slide, starting at 1; `count` is the number of slides.
Both change when readers or authors move to another slide.

Known limitation: in edit mode the drag module sets `touch-action: none` on the thumbnails, so on a touch
screen the thumbnail strip cannot be scrolled by dragging on a thumbnail; the select buttons still work.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/slides/widgets/webwriter-slides.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/slides/widgets/webwriter-slides.js"></script>
<webwriter-slides></webwriter-slides>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/slides
```

```html
<link href="@webwriter/slides/widgets/webwriter-slides.css" rel="stylesheet">
<script type="module" src="@webwriter/slides/widgets/webwriter-slides.js"></script>
<webwriter-slides></webwriter-slides>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `WebwriterSlides.scopedElements` | `object` | - | `{ "sl-icon-button": SlIconButton, "sl-tooltip": SlTooltip, }` | ✗ |
| `WebwriterSlides.convertFrom` | `object` | - | `{ section: "loadSections" }` | ✗ |
| `WebwriterSlides.convertTo` | `object` | - | `{ section: "toSections" }` | ✗ |
| `WebwriterSlides.options` | - | - | `{ type: { type: "select", group: "presentation", label: (widget: Labelled) => widget.msg("View"), options: [ { value: "tabs", label: (widget: Labelled) => widget.msg("Tabs") }, { value: "slides", label: (widget: Labelled) => widget.msg("Slides") }, ], }, } satisfies Record<string, Declared<OptionDeclaration>>` | ✗ |
| `WebwriterSlides.optionGroups` | - | - | `{ presentation: { label: (widget: Labelled) => widget.msg("Presentation"), collapsible: true, advanced: false }, } satisfies Record<string, Declared<OptionGroupDeclaration>>` | ✗ |
| `WebwriterSlides.actions` | - | - | `{ addSlide: { label: (widget: Labelled) => widget.msg("Add slide"), group: "presentation", icon: "Add", intent: "default" }, duplicateActiveSlide: { label: (widget: Labelled) => widget.msg("Duplicate current slide"), group: "presentation", icon: "Copy", intent: "default", disabled: true }, removeActiveSlide: { label: (widget: Labelled) => widget.msg("Remove current slide"), group: "presentation", icon: "Delete", intent: "danger", disabled: true }, } satisfies Record<string, Declared<ActionDeclaration>>` | ✗ |
| `localize` | - | - | - | ✗ |
| `type` (`type`) | `"tabs" \| "slides"` | Defines the type of view for the slideshow.<br>- "slides": Show content as sequential slides.<br>- "tabs": Show content using tabs. | `"slides"` | ✓ |
| `activeSlideIndex` | `number` | Index of the currently active slide. | `0` | ✗ |
| `signals` | `object` | Public signals: the current slide number (from 1) and the number of slides. | `{ slide: this.#slide, count: this.#count }` | ✗ |
| `actions` | - | The drawer declarations with the availability of the slide actions, which follows the slides. | - | ✗ |
| `activeSlide` | `WebwriterSlide` | The active slide element based on the activeSlideIndex. | - | ✗ |
| `hasNextSlide` | `boolean` | False if slideshow is on the last slide. | - | ✗ |
| `hasPreviousSlide` | `boolean` | False if slideshow is on the first slide. | - | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `loadSections` | Replaces the slides with the slides a `section` stands for; declines anything else. | `fragment: DocumentFragment`
| `toSections` | One `section` per slide, in a detached fragment; `null` without slides. | -
| `duplicateActiveSlide` | - | -
| `addSlide` | Add a new empty slide element. Optionally insert after given index. | `index: number`
| `duplicateSlide` | Duplicate an existing slide at given index. | `index: number`
| `removeActiveSlide` | Remove the currently active slide element. | -
| `removeSlide` | Remove the currently active slide element. | `slideIndex: number`
| `nextSlide` | Activate the next slide element. | `backwards=false`, `step=1`

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Slots
| Name | Description | Content Type |
| :--: | :---------: | :----------: |
| `default` | Slide elements to be displayed (should be `webwriter-slide` components only). | webwriter-slide+ |

*[Slots](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots) define how the content of the widget is rendered.*

## Events
| Name | Description |
| :--: | :---------: |
| optionschange | - |

*[Events](https://developer.mozilla.org/en-US/docs/Web/Events) are dispatched by the widget after certain triggers.*

## CSS parts
| Name | Description |
| :--: | :---------: |
| actions | The strip of thumbnails and controls below the slide. |
| tabs | The strip of tabs and controls above the slide. |
| thumbnail | One slide thumbnail in the strip. |
| tab | One tab in the tab strip. |

*[CSS parts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_shadow_parts) allow freely styling internals of the widget with CSS.*

## Editing config
| Name | Value |
| :--: | :---------: |
| `definingAsContext` | `true` |
| `definingForContent` | `true` |
| `content` | `webwriter-slide+` |

*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public custom CSS properties.*


## `WebwriterSlide` (`<webwriter-slide>`)
Represents a single slide in the `webwriter-slides` widget.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/slides/widgets/webwriter-slide.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/slides/widgets/webwriter-slide.js"></script>
<webwriter-slide></webwriter-slide>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/slides
```

```html
<link href="@webwriter/slides/widgets/webwriter-slide.css" rel="stylesheet">
<script type="module" src="@webwriter/slides/widgets/webwriter-slide.js"></script>
<webwriter-slide></webwriter-slide>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `active` (`active`) | `boolean` | Indicates whether the slide is currently active/visible. | `false` | ✓ |
| `thumbnail` (`thumbnail`) | `string` | Data URI string for the slide thumbnail (e.g., "data:image/png;base64,...").<br>Used to display a preview image for the slide. | `""` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Slots
| Name | Description | Content Type |
| :--: | :---------: | :----------: |
| `default` | The content displayed within the slide. | p \| flow* |

*[Slots](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots) define how the content of the widget is rendered.*

## Editing config
| Name | Value |
| :--: | :---------: |
| `definingAsContext` | `true` |
| `definingForContent` | `true` |
| `content` | `p \| flow*` |
| `uninsertable` | `true` |

*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, events, custom CSS properties, or CSS parts.*


---
*Generated with @webwriter/build@1.14.0*