/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import {getMochaConfig} from "@webwriter/build/test"
import "../src/widgets/webwriter-slide";
import type { SelectOptionDeclaration } from "@webwriter/widget";
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
