# Pages (`@webwriter/pages@3.0.0`)
[License: MIT](LICENSE) | Version: 3.0.0

Present content as tabs, slides, or branching pages.

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| Slides | `@webwriter/pages/snippets/slides.html` |
| Branching Scenario | `@webwriter/pages/snippets/branching-scenario.html` |
| What is WebWriter? | `@webwriter/pages/snippets/what-is-webwriter.html` |

Slides inserts one empty page in the Slides layout. “What is WebWriter?” introduces authoring, exploration, collaboration, and widget development in four illustrated pages; its embedded images also work offline.


## `WebwriterPages` (`<webwriter-pages>`)
Display authored content in Tabs, Slides, or Branches, with Tabs by default.

Authors add `webwriter-page` children; the `type` attribute switches between the Slides view with preview cards ("pages")
and the default tab strip ("tabs"). Thumbnails are drawn in the editor with a capture library that loads on first use.
In use mode the arrow keys, the controls and swipes in fullscreen move between pages. The arrow keys leave
text entry, Alt and Meta combinations alone. Every thumbnail and inactive tab has a button that selects its page;
in edit mode Space or Enter on the thumbnail itself picks it up for reordering.
The selected tab has an auto-sizing plaintext label input. Labels are saved in each page’s `label` attribute;
an empty label displays a grey “Page n” placeholder. Tab-strip chevrons scroll the list without changing pages.

In **Branches** view (`type="branches"`), a collapsible, editing-only WebWriter Scene shows the pages as movable nodes. The graph starts expanded; an icon-only chevron in the graph toolbar collapses it while keeping fullscreen and choice controls available. Activate a node to edit its content below the graph. Edit its plaintext label inside the active node and use its **Set as start** button to choose the entry page. Add pages with the graph toolbar. Connect output/input ports by dragging, clicking, or keyboard; the destination menu provides another way to add choices. Choice labels and destinations are edited in the bottom pane, where authors can also follow a choice to continue. Connections can be selected and removed in the graph. The fullscreen button is in the top toolbar.

Readers see the active page and a bottom bar for choices and continuing, without the graph or completion indicator. Choice controls are shadow UI and do not become authored content. Arrow keys and fullscreen swipes do not bypass the authored routes. The basic **Branching Scenario** snippet inserts a start page with two alternative paths. This first version supports direct page choices and cycles; conditional quiz routing and popup nodes remain in the separate Branching Scenario package.

Routing uses stable local `page-key` values, independent of page order or labels. Each page's `branches` attribute stores JSON choices such as `[{"target":"next","label":"Continue"}]`; `node-x` and `node-y` store optional graph coordinates. `start-page` on the sequence names the entry key, defaulting to its first page. Reading does not generate keys or rewrite routes. Duplicating a page gives it a new key, and removing one removes incoming choices. Switching views retains authored routing and content.

Set `orientation="portrait"` for a 9:16 page, or use the default `landscape` for 16:9. The orientation applies to all views, fullscreen, and preview cards. The attribute is optional; an absent attribute keeps landscape without adding it to existing markup.

The widget follows the page theme: `--ww-text-color`, `--ww-font-family`, and `--ww-theme-accent-1` (the
selected thumbnail). On paper it prints all pages one after another and leaves out the controls.
In Tabs view, the active tab and its connecting edge match the page's background color. Its remove button overlays the end of the tab with a translucent round background. Duplicate remains available as an action in the options. Tab and preview controls keep their native focus without capture-selecting the widget; background clicks retain normal capture.

After deletion in edit mode, selection moves to the start of the surviving active page: a text caret where possible, otherwise selection of its first element.

Conversions: a `section` becomes pages (its nested `section` children become one page each, otherwise the
section is one page). Each page converts to a `details` element with its label as the summary.
Page labels become plaintext summaries; unlabeled pages use “Page n”. Page content is preserved; thumbnails and branching routes are not carried over.

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
| `WebwriterPages.scopedElements` | - | - | `{ "sl-icon-button": SlIconButton, }` | ✗ |
| `WebwriterPages.convertFrom` | `object` | - | `{ section: "loadSections" }` | ✗ |
| `WebwriterPages.convertTo` | `object` | - | `{ details: "toDetails" }` | ✗ |
| `WebwriterPages.options` | - | - | `{ type: { type: "select", label: (widget: Labelled) => widget.msg("View"), options: [ { value: "tabs", label: (widget: Labelled) => widget.msg("Tabs") }, { value: "pages", label: (widget: Labelled) => widget.msg("Slides") }, { value: "branches", label: (widget: Labelled) => widget.msg("Branches") }, ], }, completionIndicators: { type: Boolean, label: (widget: Labelled) => widget.msg("Show completion indicators"), }, } satisfies Record<string, Declared<OptionDeclaration>>` | ✗ |
| `WebwriterPages.actions` | - | - | `{ addPage: { label: (widget: Labelled) => widget.msg("Add"), buttonGroup: "pages", icon: "Plus", intent: "default" }, removeActivePage: { label: (widget: Labelled) => widget.msg("Remove"), buttonGroup: "pages", icon: "Delete", intent: "danger", disabled: true }, duplicateActivePage: { label: (widget: Labelled) => widget.msg("Duplicate"), buttonGroup: "pages", icon: "Copy", intent: "default", disabled: true }, } satisfies Record<string, Declared<ActionDeclaration>>` | ✗ |
| `localize` | - | - | - | ✗ |
| `type` (`type`) | `"tabs" \| "pages" \| "branches"` | Defines the type of view for the sequence of pages.<br>- "pages": Show the Slides view with preview cards.<br>- "tabs": Show content using tabs.<br>- "branches": Edit a page graph; read by following choices. | `"tabs"` | ✓ |
| `completionIndicators` (`completion-indicators`) | `boolean` | Mark pages read on leaving them after reaching their bottom. Reader-local; off by default. | `false` | ✓ |
| `startPage` (`start-page`) | `string` | Stable key of the first page in Branches; an absent key starts at the first page. | `""` | ✓ |
| `orientation` (`orientation`) | `"landscape" \| "portrait"` | Page orientation: 16:9 landscape or 9:16 portrait. The optional orientation attribute defaults to landscape when absent; the default is not added to existing markup. | `"landscape"` | ✓ |
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
| branch-editor | The editing-only Scene graph in Branches view. |
| branch-controls | The bottom pane for choices, continuing, and choice editing. |
| actions | The pane of thumbnails and controls below or beside the page. |
| tabs | The strip of tabs and controls above the page. |
| thumbnail | One page thumbnail in the strip. |
| tab | One tab in the tab strip. |

*[CSS parts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_shadow_parts) allow freely styling internals of the widget with CSS.*

## Editing config
| Name | Value |
| :--: | :---------: |
| `resize` | `inline` |
| `definingAsContext` | `true` |
| `definingForContent` | `true` |
| `content` | `webwriter-page+` |

*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public custom CSS properties.*


## `WebwriterPage` (`<webwriter-page>`)
Represents a single page in the `webwriter-pages` widget.

A page containing one media element has no content padding. Media fills the available page area with
its original proportions preserved and the complete image or video visible. Mixed content keeps its usual padding.

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
| `active` (`active`) | `boolean` | Indicates whether the page is currently active/visible. | `false` | ✓ |
| `label` (`label`) | `string` | Plaintext tab label; empty labels display the “Page n” placeholder. | `""` | ✓ |
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
| `definingAsContext` | `true` |
| `definingForContent` | `true` |
| `content` | `p \| flow*` |
| `resize` | `none` |
| `uninsertable` | `true` |

*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, events, custom CSS properties, or CSS parts.*


---
*Generated with @webwriter/build@1.14.0*
