/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import {getMochaConfig} from "@webwriter/build/test"
import "../src/widgets/webwriter-page";
import type { SelectOptionDeclaration } from "@webwriter/widget";
import { frame, mount, unmountAll, until } from "./helpers"
import type { WebwriterPages } from "../src/widgets/webwriter-pages";
import "../src/widgets/webwriter-pages";
import { captureThumbnail } from "../src/components/page-thumbnail";

mocha.setup(getMochaConfig())

describe("<webwriter-pages>", function () {

  before(async function () {
    document.body.insertAdjacentHTML("beforeend",
      `<webwriter-pages type="pages"><webwriter-page><p>Initial page</p></webwriter-page></webwriter-pages>`
    )
    const el = document.querySelector("webwriter-pages") as any
    await el.updateComplete
  }) 

  describe("initialize", function () {
    it("defaults to Tabs for newly created Pages widgets", async function () {
      const el = document.createElement("webwriter-pages") as WebwriterPages;
      el.innerHTML = "<webwriter-page><p>First page</p></webwriter-page>";
      document.body.append(el);
      try {
        await el.updateComplete;
        await until(() => el.shadowRoot!.querySelector(".page-tab"), "default tab");
        assert.equal(el.type, "tabs");
        assert.equal(el.orientation, "landscape");
        assert.isFalse(el.hasAttribute("orientation"), "default does not rewrite existing markup");
        assert.equal(el.getAttribute("type"), "tabs");
        assert.isNull(el.shadowRoot!.querySelector(".page-thumb"));
        assert.equal(el.shadowRoot!.querySelector("button.page-select")!.getAttribute("aria-label"), "Page 1");
        assert.isUndefined(customElements.get("webwriter-slides"));
        assert.isUndefined(customElements.get("webwriter-slide"));
      } finally { el.remove(); }
    })

    it("is defined", async function () {
      const el = document.querySelector("webwriter-pages:defined")
      assert.isNotNull(el)
    })
    it("contains defined <webwriter-page>", async function () {
      const el = document.querySelector("webwriter-page")
      assert.isNotNull(el)
    })
  })

  it("declares a persisted Orientation option and captures previews without stretching", async function () {
    this.timeout(10000);
    const widget = await mount("<webwriter-pages><webwriter-page><p>Proportional preview</p></webwriter-page></webwriter-pages>");
    widget.parentElement!.style.width = "320px";
    try {
      const option = widget.options!.orientation as SelectOptionDeclaration;
      assert.equal(option.label, "Orientation");
      assert.deepEqual(option.options!.map(choice => [choice.value, choice.label]), [["landscape", "Landscape"], ["portrait", "Portrait"]]);
      for(const orientation of ["landscape", "portrait"] as const) {
        widget.orientation = orientation;
        await widget.updateComplete;
        await frame(2);
        const image = new Image();
        image.src = await captureThumbnail(widget.querySelector("webwriter-page")!);
        await image.decode();
        assert.closeTo(image.naturalWidth / image.naturalHeight, orientation === "portrait" ? 9 / 16 : 16 / 9, 0.01, "capture preserves orientation");
      }
    } finally { unmountAll(); }
  })

  it("keeps controls and drawer labels in each Pages widget's inherited language", async function () {
    const wrapper = document.createElement("section")
    wrapper.innerHTML = `
      <div lang="en"><webwriter-pages type="pages" contenteditable="true"><webwriter-page><p>First</p></webwriter-page></webwriter-pages></div>
      <div lang="de"><webwriter-pages type="pages" contenteditable="true"><webwriter-page><p>Second</p></webwriter-page></webwriter-pages></div>
    `
    document.body.append(wrapper)
    const [english, german] = Array.from(wrapper.querySelectorAll<WebwriterPages>("webwriter-pages"))
    const view = (widget: WebwriterPages) => (widget.options!.type as SelectOptionDeclaration).options!.find((choice) => choice.value === "pages")!.label
    const waitForView = async (widget: WebwriterPages, label: string) => {
      for (let attempt = 0; attempt < 40 && view(widget) !== label; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 25))
      }
      await widget.updateComplete
      assert.equal(view(widget), label)
    }
    try {
      await waitForView(german, "Folien")
      assert.equal(view(english), "Slides")
      const orientation = german.options!.orientation as SelectOptionDeclaration;
      assert.equal(orientation.label, "Ausrichtung");
      assert.deepEqual(orientation.options!.map(choice => choice.label), ["Querformat", "Hochformat"]);
      const labels = (widget: WebwriterPages) => Object.values(widget.actions).map(action => action.label)
      assert.deepEqual(labels(english), ["Add", "Remove", "Duplicate"])
      assert.deepEqual(labels(german), ["Hinzufügen", "Entfernen", "Duplizieren"])
      assert.deepEqual(Object.keys(english.optionGroups ?? {}), [], "options have no enclosing group")
      assert.isUndefined(english.options!.type.group, "View appears directly in the drawer")
      assert.isTrue(Object.values(english.actions).every(action => action.group === undefined), "page actions appear directly in the drawer")
      assert.isTrue(Object.values(english.actions).every(action => action.buttonGroup === "pages"), "page actions share one button group")
      assert.deepEqual(Object.values(english.actions).map(action => action.icon), ["Plus", "Delete", "Copy"], "all page actions have supported icons")
      const tooltips = (widget: WebwriterPages) => Array.from(widget.shadowRoot!.querySelectorAll("[title]"), control => control.getAttribute("title"))
      assert.include(tooltips(english), "Duplicate page")
      assert.include(tooltips(german), "Seite duplizieren")
      assert.isFalse(german.hasAttribute("lang"))
      assert.isFalse(german.querySelector("webwriter-page")!.hasAttribute("lang"))

      german.parentElement!.lang = "en"
      await waitForView(german, "Slides")
      german.lang = "de"
      await waitForView(german, "Folien")
      german.removeAttribute("lang")
      await waitForView(german, "Slides")

      const first = wrapper.firstElementChild as HTMLElement
      first.append(german)
      first.lang = "de"
      await waitForView(english, "Folien")
      await waitForView(german, "Folien")
      assert.isFalse(german.hasAttribute("lang"))
    } finally {
      wrapper.remove()
    }
  })
  
  it("changes the drawer labels and tooltips with the inherited, explicit or removed language and announces it", async function () {
    const wrapper = document.createElement("section")
    wrapper.innerHTML = `
      <div lang="en"><webwriter-pages type="pages" contenteditable=""><webwriter-page><p>First</p></webwriter-page></webwriter-pages></div>
      <div lang="de"><webwriter-pages type="pages" contenteditable=""><webwriter-page><p>Second</p></webwriter-page></webwriter-pages></div>`
    document.body.append(wrapper)
    try {
      const [english, german] = Array.from(wrapper.querySelectorAll<WebwriterPages>("webwriter-pages"))
      const view = (widget: WebwriterPages) => (widget.options!.type as SelectOptionDeclaration).options!.find((choice) => choice.value === "pages")!.label
      const until = async (condition: () => boolean, message: string) => {
        for (let attempt = 0; attempt < 200 && !condition(); attempt++) await new Promise(resolve => setTimeout(resolve, 30))
        assert.isTrue(condition(), message)
      }
      const tooltips = (widget: WebwriterPages) => Array.from(widget.shadowRoot!.querySelectorAll("[title]"), control => control.getAttribute("title"))
      await until(() => view(german) === "Folien", "German drawer label")
      assert.equal(view(english), "Slides")
      assert.include(tooltips(english), "Duplicate page")
      await until(() => tooltips(german).includes("Seite duplizieren"), "German tooltip")
      let changes = 0
      german.addEventListener("optionschange", () => changes++)
      german.parentElement!.lang = "en"
      await until(() => view(german) === "Slides", "back to English")
      german.lang = "de"
      await until(() => view(german) === "Folien", "explicit lang")
      german.removeAttribute("lang")
      await until(() => view(german) === "Slides", "lang removed")
      assert.isAbove(changes, 0, "optionschange sent")
    } finally {
      wrapper.remove()
    }
  })

  describe("conversions and signals", function () {
    const make = async (html: string) => {
      const wrapper = document.createElement("div")
      wrapper.innerHTML = html
      document.body.append(wrapper)
      const el = wrapper.querySelector("webwriter-pages") as any
      await el.updateComplete
      return { wrapper, el }
    }

    it("declares section conversions", function () {
      const Widget = customElements.get("webwriter-pages") as any
      assert.deepEqual(Object.keys(Widget.convertFrom), ["section"])
      assert.deepEqual(Object.keys(Widget.convertTo), ["section"])
    })

    it("turns pages into section elements and back", async function () {
      const { wrapper, el } = await make(`<webwriter-pages type="pages"><webwriter-page label="Introduction"><h2>A</h2><p>One</p></webwriter-page><webwriter-page><p>Two</p></webwriter-page></webwriter-pages>`)
      try {
        const fragment = el.toSections() as DocumentFragment
        const sections = Array.from(fragment.children)
        assert.deepEqual(sections.map(s => s.localName), ["section", "section"])
        assert.equal(sections[0].innerHTML, "<h2>A</h2><p>One</p>")
        assert.equal(sections[0].getAttribute("aria-label"), "Introduction")

        const { wrapper: other, el: target } = await make(`<webwriter-pages type="pages"><webwriter-page><p>Old</p></webwriter-page></webwriter-pages>`)
        try {
          const source = document.createDocumentFragment()
          const holder = document.createElement("section")
          holder.append(...sections)
          source.append(holder)
          assert.isTrue(target.loadSections(source))
          const loaded = Array.from(target.querySelectorAll(":scope > webwriter-page"))
          assert.deepEqual(loaded.map((s: any) => s.innerHTML), ["<h2>A</h2><p>One</p>", "<p>Two</p>"])
          assert.equal(loaded[0].getAttribute("label"), "Introduction")
        } finally { other.remove() }
      } finally { wrapper.remove() }
    })

    it("takes a single section as one page and declines other input", async function () {
      const { wrapper, el } = await make(`<webwriter-pages type="pages"><webwriter-page><p>Old</p></webwriter-page></webwriter-pages>`)
      try {
        const bad = document.createDocumentFragment()
        bad.append(document.createElement("div"))
        assert.isFalse(el.loadSections(bad))
        assert.equal(el.querySelectorAll("webwriter-page").length, 1)
        const good = document.createDocumentFragment()
        const section = document.createElement("section")
        section.innerHTML = "<p>Only</p>"
        good.append(section)
        assert.isTrue(el.loadSections(good))
        assert.equal(el.querySelector("webwriter-page").innerHTML, "<p>Only</p>")
      } finally { wrapper.remove() }
    })

    it("publishes the current page and the count as stable signals", async function () {
      const { wrapper, el } = await make(`<webwriter-pages type="pages"><webwriter-page><p>A</p></webwriter-page><webwriter-page><p>B</p></webwriter-page></webwriter-pages>`)
      try {
        const signals = el.signals
        assert.strictEqual(el.signals, signals)
        await until(() => signals.count.get() === 2, "count")
        assert.equal(signals.page.get(), 1)
        el.nextPage()
        await el.updateComplete
        assert.equal(signals.page.get(), 2)
      } finally { wrapper.remove() }
    })
  })

  describe("use methods", function () {
    it("can add a page", async function () {
      const el = document.querySelector("webwriter-pages") as any
      el.addPage()
      await el.updateComplete
      const pages = el.querySelectorAll("webwriter-page")
      assert.equal(pages.length, 2)
    })
    it("removes the active page and preserves the required last page", async function () {
      const el = document.querySelector("webwriter-pages") as any
      el.removeActivePage()
      el.removeActivePage()
      const pages = el.querySelectorAll("webwriter-page")
      assert.equal(pages.length, 1)
    })
  })
});

mocha.run()
