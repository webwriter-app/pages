/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import {getMochaConfig} from "@webwriter/build/test"
import "../src/widgets/webwriter-slide";
import type { SelectOptionDeclaration } from "@webwriter/widget";
import { until } from "./helpers"
import type { WebwriterSlides } from "../src/widgets/webwriter-slides";
import "../src/widgets/webwriter-slides";

mocha.setup(getMochaConfig())

describe("<webwriter-slides>", function () {

  before(async function () {
    document.body.insertAdjacentHTML("beforeend",
      `<webwriter-slides><webwriter-slide><p>Initial slide</p></webwriter-slide></webwriter-slides>`
    )
    const el = document.querySelector("webwriter-slides") as any
    await el.updateComplete
  }) 

  describe("initialize", function () {
    it("is defined", async function () {
      const el = document.querySelector("webwriter-slides:defined")
      assert.isNotNull(el)
    })
    it("contains defined <webwriter-slide>", async function () {
      const el = document.querySelector("webwriter-slide")
      assert.isNotNull(el)
    })
  })

  it("keeps controls and drawer labels in each slideshow's inherited language", async function () {
    const wrapper = document.createElement("section")
    wrapper.innerHTML = `
      <div lang="en"><webwriter-slides contenteditable="true"><webwriter-slide><p>First</p></webwriter-slide></webwriter-slides></div>
      <div lang="de"><webwriter-slides contenteditable="true"><webwriter-slide><p>Second</p></webwriter-slide></webwriter-slides></div>
    `
    document.body.append(wrapper)
    const [english, german] = Array.from(wrapper.querySelectorAll<WebwriterSlides>("webwriter-slides"))
    const view = (widget: WebwriterSlides) => (widget.options!.type as SelectOptionDeclaration).options!.find((choice) => choice.value === "slides")!.label
    const waitForView = async (widget: WebwriterSlides, label: string) => {
      for (let attempt = 0; attempt < 40 && view(widget) !== label; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 25))
      }
      await widget.updateComplete
      assert.equal(view(widget), label)
    }
    try {
      await waitForView(german, "Folien")
      assert.equal(view(english), "Slides")
      const tooltips = (widget: WebwriterSlides) => Array.from(widget.shadowRoot!.querySelectorAll("sl-tooltip"), tooltip => tooltip.getAttribute("content"))
      assert.include(tooltips(english), "Duplicate slide")
      assert.include(tooltips(german), "Folie duplizieren")
      assert.isFalse(german.hasAttribute("lang"))
      assert.isFalse(german.querySelector("webwriter-slide")!.hasAttribute("lang"))

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
      <div lang="en"><webwriter-slides contenteditable=""><webwriter-slide><p>First</p></webwriter-slide></webwriter-slides></div>
      <div lang="de"><webwriter-slides contenteditable=""><webwriter-slide><p>Second</p></webwriter-slide></webwriter-slides></div>`
    document.body.append(wrapper)
    try {
      const [english, german] = Array.from(wrapper.querySelectorAll<WebwriterSlides>("webwriter-slides"))
      const view = (widget: WebwriterSlides) => (widget.options!.type as SelectOptionDeclaration).options!.find((choice) => choice.value === "slides")!.label
      const until = async (condition: () => boolean, message: string) => {
        for (let attempt = 0; attempt < 200 && !condition(); attempt++) await new Promise(resolve => setTimeout(resolve, 30))
        assert.isTrue(condition(), message)
      }
      const tooltips = (widget: WebwriterSlides) => Array.from(widget.shadowRoot!.querySelectorAll("sl-tooltip"), tooltip => tooltip.getAttribute("content"))
      await until(() => view(german) === "Folien", "German drawer label")
      assert.equal(view(english), "Slides")
      assert.include(tooltips(english), "Duplicate slide")
      await until(() => tooltips(german).includes("Folie duplizieren"), "German tooltip")
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
      const el = wrapper.querySelector("webwriter-slides") as any
      await el.updateComplete
      return { wrapper, el }
    }

    it("declares section conversions", function () {
      const Widget = customElements.get("webwriter-slides") as any
      assert.deepEqual(Object.keys(Widget.convertFrom), ["section"])
      assert.deepEqual(Object.keys(Widget.convertTo), ["section"])
    })

    it("turns slides into section elements and back", async function () {
      const { wrapper, el } = await make(`<webwriter-slides><webwriter-slide><h2>A</h2><p>One</p></webwriter-slide><webwriter-slide><p>Two</p></webwriter-slide></webwriter-slides>`)
      try {
        const fragment = el.toSections() as DocumentFragment
        const sections = Array.from(fragment.children)
        assert.deepEqual(sections.map(s => s.localName), ["section", "section"])
        assert.equal(sections[0].innerHTML, "<h2>A</h2><p>One</p>")

        const { wrapper: other, el: target } = await make(`<webwriter-slides><webwriter-slide><p>Old</p></webwriter-slide></webwriter-slides>`)
        try {
          const source = document.createDocumentFragment()
          const holder = document.createElement("section")
          holder.append(...sections)
          source.append(holder)
          assert.isTrue(target.loadSections(source))
          const loaded = Array.from(target.querySelectorAll(":scope > webwriter-slide"))
          assert.deepEqual(loaded.map((s: any) => s.innerHTML), ["<h2>A</h2><p>One</p>", "<p>Two</p>"])
        } finally { other.remove() }
      } finally { wrapper.remove() }
    })

    it("takes a single section as one slide and declines other input", async function () {
      const { wrapper, el } = await make(`<webwriter-slides><webwriter-slide><p>Old</p></webwriter-slide></webwriter-slides>`)
      try {
        const bad = document.createDocumentFragment()
        bad.append(document.createElement("div"))
        assert.isFalse(el.loadSections(bad))
        assert.equal(el.querySelectorAll("webwriter-slide").length, 1)
        const good = document.createDocumentFragment()
        const section = document.createElement("section")
        section.innerHTML = "<p>Only</p>"
        good.append(section)
        assert.isTrue(el.loadSections(good))
        assert.equal(el.querySelector("webwriter-slide").innerHTML, "<p>Only</p>")
      } finally { wrapper.remove() }
    })

    it("publishes the current slide and the count as stable signals", async function () {
      const { wrapper, el } = await make(`<webwriter-slides><webwriter-slide><p>A</p></webwriter-slide><webwriter-slide><p>B</p></webwriter-slide></webwriter-slides>`)
      try {
        const signals = el.signals
        assert.strictEqual(el.signals, signals)
        await until(() => signals.count.get() === 2, "count")
        assert.equal(signals.slide.get(), 1)
        el.nextSlide()
        await el.updateComplete
        assert.equal(signals.slide.get(), 2)
      } finally { wrapper.remove() }
    })
  })

  describe("use methods", function () {
    it("can add a slide", async function () {
      const el = document.querySelector("webwriter-slides") as any
      el.addSlide()
      await el.updateComplete
      const slides = el.querySelectorAll("webwriter-slide")
      assert.equal(slides.length, 2)
    })
    it("removes the active slide and preserves the required last slide", async function () {
      const el = document.querySelector("webwriter-slides") as any
      el.removeActiveSlide()
      el.removeActiveSlide()
      const slides = el.querySelectorAll("webwriter-slide")
      assert.equal(slides.length, 1)
    })
  })
});

mocha.run()
