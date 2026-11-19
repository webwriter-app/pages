# Pages (`@webwriter/pages@3.0.0`)
[License: MIT](LICENSE) | Version: 3.0.0

Present content as pages or tabs.

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| Example | `@webwriter/pages/snippets/example.html` |



## `WebwriterPages` (`<webwriter-pages>`)
Display authored content as pages, with tabs by default or a preview-card layout.

Authors add `webwriter-page` children; the `type` attribute switches between a thumbnail strip ("pages")
and the default tab strip ("tabs"). Thumbnails are drawn in the editor with a capture library that loads on first use.
In use mode the arrow keys, the controls and swipes in fullscreen move between pages. The arrow keys leave
text entry, Alt and Meta combinations alone. Every thumbnail and inactive tab has a button that selects its page;
in edit mode Space or Enter on the thumbnail itself picks it up for reordering.
The selected tab has an auto-sizing plaintext label input. Labels are saved in each page’s `label` attribute;
an empty label displays a grey “Page n” placeholder. Tab-strip chevrons scroll the list without changing pages.

The widget follows the page theme: `--ww-text-color`, `--ww-font-family`, and `--ww-theme-accent-1` (the
selected thumbnail or tab). On paper it prints all pages one after another and leaves out the controls.

Conversions: a `section` becomes pages (its nested `section` children become one page each, otherwise the
section is one page), and the pages convert to a fragment of `section` elements with the page content.
Page labels are preserved as section `aria-label` attributes; thumbnails are not carried over.

Signals: `page` is the number of the current page, starting at 1; `count` is the number of pages.
Both change when readers or authors move to another page.

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
| `WebwriterPages.scopedElements` | `object` | - | `{ "sl-icon-button": SlIconButton, }` | ✗ |
| `WebwriterPages.convertFrom` | `object` | - | `{ section: "loadSections" }` | ✗ |
| `WebwriterPages.convertTo` | `object` | - | `{ section: "toSections" }` | ✗ |
| `WebwriterPages.options` | - | - | `{ type: { type: "select", group: "presentation", label: (widget: Labelled) => widget.msg("View"), options: [ { value: "tabs", label: (widget: Labelled) => widget.msg("Tabs") }, { value: "pages", label: (widget: Labelled) => widget.msg("Pages") }, ], }, } satisfies Record<string, Declared<OptionDeclaration>>` | ✗ |
| `WebwriterPages.optionGroups` | - | - | `{ presentation: { label: (widget: Labelled) => widget.msg("Presentation"), collapsible: true, advanced: false }, } satisfies Record<string, Declared<OptionGroupDeclaration>>` | ✗ |
| `WebwriterPages.actions` | - | - | `{ addPage: { label: (widget: Labelled) => widget.msg("Add page"), group: "presentation", icon: "Add", intent: "default" }, duplicateActivePage: { label: (widget: Labelled) => widget.msg("Duplicate current page"), group: "presentation", icon: "Copy", intent: "default", disabled: true }, removeActivePage: { label: (widget: Labelled) => widget.msg("Remove current page"), group: "presentation", icon: "Delete", intent: "danger", disabled: true }, } satisfies Record<string, Declared<ActionDeclaration>>` | ✗ |
| `localize` | - | - | - | ✗ |
| `type` (`type`) | `"tabs" \| "pages"` | Defines the type of view for the sequence of pages.<br>- "pages": Show content as sequential pages.<br>- "tabs": Show content using tabs. | `"tabs"` | ✓ |
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
| `toSections` | One `section` per page, in a detached fragment; `null` without pages. | -
| `duplicateActivePage` | - | -
| `addPage` | Add a new empty page element. Optionally insert after given index. | `index: number`
| `duplicatePage` | Duplicate an existing page at given index. | `index: number`
| `removeActivePage` | Remove the currently active page element. | -
| `removePage` | Remove the currently active page element. | `pageIndex: number`
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
