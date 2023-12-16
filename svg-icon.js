/*! Copyright (c) 2014 - 2023 Ayogo Health Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

/** The XML namespace needed for SVG elements. */
const svgns = "http://www.w3.org/2000/svg";

/** Styles to be applied within the Shadow DOM of the svg-icon element. */
const svgicon_styles = `
:host {
  display: inline-block;
  height: 1.5em;
  width: 1.5em;
  margin-bottom: -0.25em;
}

svg {
  height: inherit;
  width: inherit;
  flex-shrink: inherit;
  display: inline-block;
  fill: currentColor;
  vertical-align: inherit;
}

@supports (display: contents) {
  :host {
    display:contents;
  }

  svg {
    margin: inherit;
  }
}
`;

/**
 * @type {CSSStyleSheet}
 */
let stylesheet = null;
try {
  stylesheet = new CSSStyleSheet();
  stylesheet.replaceSync(svgicon_styles);
} catch(e) { }


/**
 * `svg-icon` Web Component
 * ========================
 *
 * This is a web component for displaying icons from an SVG symbols atlas file.
 *
 * It's easy to use! Just provide the name of the icon and the SVG file
 * containing it:
 *
 * ```
 * <svg-icon name="arrow-left" src="assets/icons.svg"></svg-icon>
 * ```
 *
 * Advanced Usage
 * --------------
 *
 * ### Inlining Icons
 *
 * By default, icons will be referenced into the document using an SVG `use`
 * tag with `xlink:href`. However, this isn't supported in some browsers and
 * some runtime configurations. In those cases, the contents of the SVG icon
 * will be inlined into the page.
 *
 * For testing and special cases, this behaviour can be forced by adding an
 * `inline` attribute to the svg-icon:
 *
 * ```
 * <svg-icon src="close-x" src="assets/icons.svg" inline></svg-icon>
 * ```
 *
 * ### WKWebView Hacks
 *
 * When using SVG icons in a WKWebView from file:/// URLs, there are
 * restrictions that prevent loading them using `xlink:href`. Unfortunately,
 * there are also restrictions that prevent loading the SVG symbol file using
 * fetch.
 *
 * As a workaround, on WKWebView in a file:/// origin, we attempt to load the
 * SVG symbol file into an iframe and then wait for a postMessage call to
 * serialize the XML and return it to the main page. This requires a special
 * SVG to be included in the icon bundle that will generate the message:
 *
 * ```
 * <svg viewBox="0 0 1 1">
 *   <script>//<![CDATA[
 *     if (window && window.parent && window.location.search.match(/postHack=/)) {
 *       setTimeout(function() {
 *         var filename = window.location.search.match(/postHack=([^&]+)/)[1];
 *         var message = 'SVGICON:' + filename + ':' + ':' + (new XMLSerializer()).serializeToString(document);
 *         window.parent.postMessage(message, '*');
 *       }, 0);
 *     }
 *   //]]></script>
 * </svg>
 * ```
 *
 * @element svg-icon
 * @attr {string} src
 * @attr {string} name
 * @attr {boolean|"iframe"} [inline=false]
 */
export class SvgIconElement extends HTMLElement {
  /**
   * Global property to force all SVG icons to be inlined into the page rather
   * than loading using `xlink:href`.
   *
   * This should be automatically set to true for browsers that are known to
   * have incompatibilities with linked icons, but it is also available to be
   * set globally for the application.
   *
   * Access this as `SvgIconElement.inlineAll`.
   */
  static inlineAll = false;

  /**
   * Global property used as a prefix for all icon names.
   *
   * Typically when using a tool like [svgstore](https://npm.im/svgstore), a
   * prefix is added to all the bundled icon symbols. This defaults to the
   * string `icon-`, but can be overridden as needed. If no prefix is required,
   * set this to an empty string.
   *
   * Access this as `SvgIconElement.prefix`.
   */
  static prefix = "icon-";

  /**
   * Stores an internal map of SVG files that have been loaded for icon lookup.
   *
   * @type {Map<string,Promise<XMLDocument>>}
   */
  static #fileMap = new Map();

  /**
   * The root SVG element for the component.
   *
   * @type {SVGSVGElement}
   */
  #root = null;

  /** @private */
  static get observedAttributes() {
    return ["name", "src", "inline"];
  }

  /**
   * The name of the icon to display.
   */
  get name() {
    return this.getAttribute("name");
  }

  /**
   * The source SVG atlas file that contains the icon to display.
   */
  get src() {
    return this.getAttribute("src");
  }

  /**
   * Optional boolean attribute to force inlining of an icon instead of linking.
   */
  get inline() {
    return this.hasAttribute("inline");
  }

  /**
   * The name of the icon to display.
   */
  set name(value) {
    if (value) {
      this.setAttribute("name", value);
    } else {
      this.removeAttribute("name");
    }
  }

  /**
   * The source SVG atlas file that contains the icon to display.
   */
  set src(value) {
    if (value) {
      this.setAttribute("src", value);
    } else {
      this.removeAttribute("src");
    }
  }

  /**
   * Callback that runs when the element is connected to the DOM.
   *
   * @private
   */
  connectedCallback() {
    /** @type {HTMLElement | ShadowRoot} */
    let el = this;

    // If there's no accessible label provided for the icon, let's assume it's
    // purely decorative and hide it from AT
    if (!el.hasAttribute("title") &&
        !el.hasAttribute("role") &&
        !el.hasAttribute("aria-label") &&
        !el.hasAttribute("aria-labelledby")) {
      el.setAttribute("aria-hidden", "true");
    }

    if (!this.#root) {
      this.#root = document.createElementNS(svgns, "svg");

      el = this.attachShadow({ mode: "open" });
      if ("adoptedStyleSheets" in el && stylesheet !== null) {
        el.adoptedStyleSheets = [stylesheet];
      } else {
        el.innerHTML = `<style>${svgicon_styles}</style>`;
      }

      el.appendChild(this.#root);
    }

    const iconname = this.getAttribute("name");
    const iconsrc = this.getAttribute("src");

    if (iconname && iconsrc && !iconname.match(/\{/)) {
      this.#setIcon(iconname, iconsrc);
    }
  }

  /**
   * Callback that runs when the element's observed attributes change.
   *
   * @private
   */
  attributeChangedCallback() {
    const iconname = this.getAttribute("name");
    const iconsrc = this.getAttribute("src");

    if (this.#root && iconname && iconsrc) {
      this.#setIcon(iconname, iconsrc);
    }
  }

  /**
   * Actually sets up the SVG icon to be displayed, when the component
   * initializes or attributes are changed.
   *
   * @param {string} name The unprefixed name of the icon to reference from the
   *        atlas.
   * @param {string} src The URL of the SVG atlas file.
   */
  #setIcon(name, src) {
    const range = document.createRange();
    range.selectNodeContents(this.#root);
    range.deleteContents();

    if (src && (SvgIconElement.inlineAll || this.hasAttribute("inline"))) {
      this.#setIconWithInlining(name, src);
    } else {
      this.#setIconWithReference(name, src);
    }
  }

  /**
   * Creates an SVG `use` element and adds it as a child.
   *
   * @param {string} name The unprefixed name of the icon to reference from the
   *        atlas.
   * @param {string} src The URL of the SVG atlas file.
   */
  #setIconWithReference(name, src) {
    const icon = `${src || ""}#${SvgIconElement.prefix}${name}`;

    const use = document.createElementNS(svgns, "use");
    use.setAttributeNS("http://www.w3.org/1999/xlink", "href", icon);

    this.#root.appendChild(use);
  }

  /**
   * Retrieves the SVG atlas file, extracts the requested icon, and inlines it
   * as a child.
   *
   * @param {string} name The unprefixed name of the icon to reference from the
   *        atlas.
   * @param {string} src The URL of the SVG atlas file.
   */
  #setIconWithInlining(name, src) {
    if (!SvgIconElement.#fileMap.has(src)) {
      // WKWebView can't deal with file URLs that use external files in
      // xlink :(
      // Also allow overriding with an attribute, for testing
      if (
        (document.location.protocol.match(/file:/) && "webkit" in window) ||
        this.getAttribute("inline") === "iframe"
      ) {
        this.#inlineWithIFrame(src);
      } else {
        this.#inlineWithXHR(src);
      }
    }

    SvgIconElement.#fileMap.get(src).then((svgdoc) => {
      const symbol = svgdoc.getElementById(`${SvgIconElement.prefix}${name}`);

      if (symbol) {
        if (symbol.hasAttribute("viewBox")) {
          this.#root.setAttribute("viewBox", symbol.getAttribute("viewBox"));
        }

        const nodes = symbol.childNodes;
        for (let i = 0; i < nodes.length; i++) {
          this.#root.appendChild(nodes[i].cloneNode(true));
        }
      }
    });
  }

  /**
   * Creates a hidden iframe and loads the SVG atlas file inside. If the SVG
   * atlas file uses postMessage to broadcast its contents, the parsed result
   * is stored in the internal file map.
   *
   * @param {string} filename The URI of the SVG atlas file.
   */
  #inlineWithIFrame(filename) {
    const query = `postHack=${encodeURIComponent(filename)}`;

    const ifr = document.createElement("iframe");
    ifr.src = `${filename}${filename.indexOf("?") === -1 ? "?" : "&"}${query}`;
    ifr.style.position = "absolute";
    ifr.style.overflow = "hidden";
    ifr.style.clip = "rect(1px, 1px, 1px, 1px)";
    ifr.style.height = "0";
    ifr.style.width = "0";

    this.parentNode.insertBefore(ifr, this);

    SvgIconElement.#fileMap.set(
      filename,
      new Promise((resolve) => {
        const handler = (/** @type {MessageEvent} */ evt) => {
          const matches = evt.data.match(/^SVGICON:([^:]+)::/);
          if (matches) {
            const name = decodeURIComponent(matches[1]);
            if (name === filename) {
              const response = evt.data.split("::")[1];
              const parser = new DOMParser();

              resolve(parser.parseFromString(response, "image/svg+xml"));

              ifr.parentNode.removeChild(ifr);
              window.removeEventListener("message", handler);
            }
          }
        };

        window.addEventListener("message", handler);
      })
    );
  }

  /**
   * Makes an XHR request to the SVG atlas file, and stores the parsed result
   * in the internal file map.
   *
   * @param {string} filename The URI of the SVG atlas file.
   */
  #inlineWithXHR(filename) {
    SvgIconElement.#fileMap.set(
      filename,
      new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", filename, true);
        xhr.onload = () => {
          const parser = new DOMParser();
          resolve(parser.parseFromString(xhr.responseText, "image/svg+xml"));
        };
        xhr.send();
      })
    );
  }
}

// inlineAll is true for all versions of IE (not including Edge)
if (!!navigator.userAgent.match(/Trident\//)) {
  SvgIconElement.inlineAll = true;
}

// WKWebView can't deal with file URLs that use external files in xlink :(
if (document.location.protocol.match(/file:/) && ('webkit' in window)) {
  SvgIconElement.inlineAll = true;
}

// Safari <= 12 seem to have issues with external SVG icon links too :(
if (navigator.userAgent.match(/Version\/[0-9\.]+( Mobile\/.+)? Safari\//) &&
    parseInt(navigator.userAgent.match(/Version\/([0-9\.]+)/)[1], 10) < 13) {
  SvgIconElement.inlineAll = true;
}

customElements.define("svg-icon", SvgIconElement);
