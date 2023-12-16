`svg-icon` Web Component
========================

This is a web component for displaying icons from an SVG symbols atlas file.

It's easy to use! Just provide the name of the icon and the SVG file
containing it:

```
<svg-icon name="arrow-left" src="assets/icons.svg"></svg-icon>
```

Advanced Usage
--------------

### Inlining Icons

By default, icons will be referenced into the document using an SVG `use`
tag with `xlink:href`. However, this isn't supported in some browsers and
some runtime configurations. In those cases, the contents of the SVG icon
will be inlined into the page.

For testing and special cases, this behaviour can be forced by adding an
`inline` attribute to the svg-icon:

```
<svg-icon src="close-x" src="assets/icons.svg" inline></svg-icon>
```

### WKWebView Hacks

When using SVG icons in a WKWebView from file:/// URLs, there are
restrictions that prevent loading them using `xlink:href`. Unfortunately,
there are also restrictions that prevent loading the SVG symbol file using
fetch.

As a workaround, on WKWebView in a file:/// origin, we attempt to load the
SVG symbol file into an iframe and then wait for a postMessage call to
serialize the XML and return it to the main page. This requires a special
SVG to be included in the icon bundle that will generate the message:

```
<svg viewBox="0 0 1 1">
  <script>//<![CDATA[
    if (window && window.parent && window.location.search.match(/postHack=/)) {
      setTimeout(function() {
        var filename = window.location.search.match(/postHack=([^&]+)/)[1];
        var message = 'SVGICON:' + filename + ':' + ':' + (new XMLSerializer()).serializeToString(document);
        window.parent.postMessage(message, '*');
      }, 0);
    }
  //]]></script>
</svg>
```

Contributing
------------

Contributions of bug reports, feature requests, and pull requests are greatly
appreciated!

Please note that this project is released with a [Contributor Code of
Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to
abide by its terms.


Licence
-------

Released under the [MIT Licence](LICENCE).

Copyright © 2014 – 2023 Ayogo Health Inc.
