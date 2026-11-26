# Pages (`@webwriter/pages@3.1.1`)
[License: MIT](LICENSE) | Version: 3.1.1

Present content as slides, tabs, carousels, or branching pages.

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| Slides | `@webwriter/pages/snippets/slides.html` |
| Carousel | `@webwriter/pages/snippets/carousel.html` |
| Branching Scenario | `@webwriter/pages/snippets/branching-scenario.html` |
| What Is Webwriter | `@webwriter/pages/snippets/what-is-webwriter.html` |



## `WebwriterPages` (`<webwriter-pages>`)
Display authored content in Tabs, Slides, Carousel, or Branches, with Tabs by default.

Authors add `webwriter-page` children. Slides ("pages") shows preview cards, Carousel ("carousel") shows
compact controls over the page, and Tabs ("tabs") shows a tab strip. Thumbnails are drawn in the editor
with a capture library that loads on first use.
The "branches" view adds an editing-only Scene graph. Node labels, start page, positions and choices
are saved on the authored pages; the bottom pane edits choices and lets readers follow them.
The graph has no reading-mode controls, and Branches hides completion indicators.
In use mode the arrow keys, the controls and swipes in fullscreen move between pages. The arrow keys leave
text entry, Alt and Meta combinations alone. Every thumbnail and tab has a button that selects its page;
in edit mode Space or Enter on the thumbnail itself picks it up for reordering.

Set `orientation="portrait"` for a 9:16 page, or use the default `landscape` for 16:9.
The orientation applies to all views, fullscreen, and preview cards.

The widget follows the page theme: `--ww-text-color`, `--ww-font-family`, and `--ww-theme-accent-1` (the
selected thumbnail). On paper it prints all pages one after another and leaves out the controls.

Conversions: a `section` becomes pages (its nested `section` children become one page each, otherwise the
section is one page). Each page converts to a `details` element with its label as the summary.
The thumbnails are not carried over.

Signals: `page` is the number of the current page, starting at 1; `count` is the number of pages.
Both change when readers or authors move to another page.

Enable `completion-indicators` to mark pages read after switching away, once opened and scrolled to the bottom.
A checkmark on each read tab/preview and an aggregate checkmark in the controls show progress.
Progress is local to this widget instance, is not saved in authored HTML, and does not advance in edit mode.

Known limitation: in edit mode the drag module sets `touch-action: none` on the thumbnails, so on a touch
screen the thumbnail strip cannot be scrolled by dragging on a thumbnail; the select buttons still work.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/pages/widgets/webwriter-pages.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/pages/widgets/webwriter-pages.js"></script>
<webwriter-pages></webwriter-pages>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/pages
```

```html
<link href="@webwriter/pages/widgets/webwriter-pages.css" rel="stylesheet">
<script type="module" src="@webwriter/pages/widgets/webwriter-pages.js"></script>
<webwriter-pages></webwriter-pages>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `WebwriterPages.scopedElements` | `object` | - | `{ "sl-icon-button": SlIconButton, "sl-icon": SlIcon, "pages-branches": PagesBranches, "pages-choice-conditions": PagesChoiceConditions, }` | ✗ |
| `WebwriterPages.convertFrom` | `object` | - | `{ section: "loadSections" }` | ✗ |
| `WebwriterPages.convertTo` | `object` | - | `{ details: "toDetails" }` | ✗ |
| `WebwriterPages.options` | - | - | `{ type: { type: "select", control: "select", attribute: false, label: (widget: Labelled) => widget.msg("View"), options: [ { value: "tabs", label: (widget: Labelled) => widget.msg("Tabs") }, { value: "pages", label: (widget: Labelled) => widget.msg("Slides") }, { value: "carousel", label: (widget: Labelled) => widget.msg("Carousel") }, { value: "branches", label: (widget: Labelled) => widget.msg("Branches") }, ], }, completionIndicators: { type: Boolean, label: (widget: Labelled) => widget.msg("Show completion indicators"), }, } satisfies Record<string, Declared<OptionDeclaration>>` | ✗ |
| `WebwriterPages.actions` | - | - | `{ addPage: { label: (widget: Labelled) => widget.msg("Add"), buttonGroup: "pages", icon: "Plus", intent: "default" }, removeActivePage: { label: (widget: Labelled) => widget.msg("Remove"), buttonGroup: "pages", icon: "Delete", intent: "danger", disabled: true }, duplicateActivePage: { label: (widget: Labelled) => widget.msg("Duplicate"), buttonGroup: "pages", icon: "Copy", intent: "default", disabled: true }, resetPageAspectRatio: { label: (widget: Labelled) => widget.msg("Reset aspect ratio"), buttonGroup: "pages", icon: "Restore", intent: "default", disabled: true }, } satisfies Record<string, Declared<ActionDeclaration>>` | ✗ |
| `localize` | - | - | - | ✗ |
| `type` | `PagesLayout` | The current view, stored in the `type` attribute. | - | ✗ |
| `startPage` (`start-page`) | `string` | Stable key of the first page in Branches; an absent key starts at the first page. | `""` | ✓ |
| `completionIndicators` (`completion-indicators`) | `boolean` | Mark pages read on leaving them after reaching their bottom. Reader-local; off by default. | `false` | ✓ |
| `orientation` (`orientation`) | `"landscape" \| "portrait"` | Page orientation: 16:9 landscape or 9:16 portrait. | `"landscape"` | ✓ |
| `pageAspectRatio` (`page-aspect-ratio`) | `number \| undefined` | Optional page width/height ratio, clamped to 0.5–3. Without it, orientation supplies the ratio. | `undefined` | ✓ |
| `activePageIndex` | `number` | Index of the currently active page. | `0` | ✗ |
| `signals` | `object` | Public signals: the current page number (from 1) and the number of pages. | `{ page: this.#page, count: this.#count }` | ✗ |
| `actions` | - | The drawer declarations with the availability of the page actions, which follows the pages. | - | ✗ |
| `activePage` | `WebwriterPage` | The active page element based on the activePageIndex. | - | ✗ |
| `hasNextPage` | `boolean` | False if Pages is on the last page. | - | ✗ |
| `hasPreviousPage` | `boolean` | False if Pages is on the first page. | - | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `resetPageAspectRatio` | Restore the exact orientation default by removing the authored override. | -
| `loadSections` | Replaces the pages with the pages a `section` stands for; declines anything else. | `fragment: DocumentFragment`
| `toDetails` | One `details` per page with its label as summary; `null` without pages. | -
| `duplicateActivePage` | - | -
| `addPage` | Add a new empty page element. Optionally insert after given index. | `index: number`
| `duplicatePage` | Duplicate an existing page at given index. | `index: number`
| `removeActivePage` | Remove the currently active page element. | -
| `removePage` | Remove a page and return editor selection to the surviving active page's start. | `pageIndex: number`
| `nextPage` | Activate the next page element. | `backwards=false`, `step=1`

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Slots
| Name | Description | Content Type |
| :--: | :---------: | :----------: |
| `default` | Page elements to be displayed (should be `webwriter-page` components only). | webwriter-page+ |

*[Slots](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots) define how the content of the widget is rendered.*

## Events
| Name | Description |
| :--: | :---------: |
| optionschange | - |

*[Events](https://developer.mozilla.org/en-US/docs/Web/Events) are dispatched by the widget after certain triggers.*

## CSS parts
| Name | Description |
| :--: | :---------: |
| actions | The pane of thumbnails and controls below or beside the page. |
| tabs | The strip of tabs and controls above the page. |
| thumbnail | One page thumbnail in the strip. |
| tab | One tab in the tab strip. |
| branch-editor | The editing-only Scene graph in Branches view. |
| branch-controls | The bottom pane of choices and continuation controls in Branches view. |

*[CSS parts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_shadow_parts) allow freely styling internals of the widget with CSS.*

## Editing config
| Name | Value |
| :--: | :---------: |
| `resize` | `inline` |
| `propagateEvents` | `keydown` |
| `definingAsContext` | `true` |
| `definingForContent` | `true` |
| `content` | `webwriter-page+` |

*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public custom CSS properties.*


## `WebwriterPage` (`<webwriter-page>`)
Represents a single page in the `webwriter-pages` widget.
Single-media pages remove padding and fit media without stretching or cropping.
In Branches view, `page-key`, `branches`, `node-x` and `node-y` keep routing and graph layout.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/pages/widgets/webwriter-page.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/pages/widgets/webwriter-page.js"></script>
<webwriter-page></webwriter-page>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/pages
```

```html
<link href="@webwriter/pages/widgets/webwriter-page.css" rel="stylesheet">
<script type="module" src="@webwriter/pages/widgets/webwriter-page.js"></script>
<webwriter-page></webwriter-page>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `active` (`active`) | `boolean` | Indicates whether the page is currently active/visible. | `false` | ✗ |
| `label` (`label`) | `string` | Plaintext tab label. An empty label shows the page-number placeholder. | `""` | ✓ |
| `pageKey` (`page-key`) | `string` | Stable local identifier for Branches links; independent of order and label. | `""` | ✓ |
| `branches` (`branches`) | `string` | JSON choices: an array of objects with target page keys and plaintext labels. | `""` | ✓ |
| `nodeX` (`node-x`) | `number \| undefined` | Saved node position in the Branches editor. Absent coordinates use a grid. | `undefined` | ✓ |
| `nodeY` (`node-y`) | `number \| undefined` | Saved vertical node position in the Branches editor. | `undefined` | ✓ |
| `thumbnail` (`thumbnail`) | `string` | Data URI string for the page thumbnail (e.g., "data:image/png;base64,...").<br>Used to display a preview image for the page. | `""` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Slots
| Name | Description | Content Type |
| :--: | :---------: | :----------: |
| `default` | The content displayed within the page. | p \| flow* |

*[Slots](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots) define how the content of the widget is rendered.*

## Editing config
| Name | Value |
| :--: | :---------: |
| `resize` | `none` |
| `definingAsContext` | `true` |
| `definingForContent` | `true` |
| `content` | `p \| flow*` |
| `uninsertable` | `true` |

*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, events, custom CSS properties, or CSS parts.*


---
*Generated with @webwriter/build@1.15.0*
