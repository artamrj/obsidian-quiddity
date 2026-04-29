import { MarkdownRenderChild, Plugin } from "obsidian";
import { createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QuiddityRenderer } from "./renderer";

export default class QuiddityPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("quiddity", (source, el, ctx) => {
      el.empty();
      el.addClass("quiddity-host");

      const root = createRoot(el);
      root.render(createElement(
        StrictMode,
        null,
        createElement(QuiddityRenderer, { app: this.app, ctx, el, source })
      ));

      ctx.addChild(new ReactRootChild(el, root));
    });
  }
}

class ReactRootChild extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement, private readonly root: Root) {
    super(containerEl);
  }

  onunload() {
    this.root.unmount();
  }
}
