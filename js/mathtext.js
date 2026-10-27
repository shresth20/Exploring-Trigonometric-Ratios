/* ==========================================================================
 * mathtext.js -- a fraction stood up, and a root drawn, in a line of type
 * --------------------------------------------------------------------------
 * The game's text is plain strings: a value on a pill, a sentence in a box,
 * a cell of the table. A fraction in one of them is spelled with the glyph
 * (½, ¼ ...) or as figures either side of a fraction slash (1⁄√2, √3⁄2,
 * 4⁄4), and that is how the string is kept, compared and shuffled. This
 * module is the one place the glyph is DRAWN differently: written into the
 * page the way it is written on paper -- the numerator over the
 * denominator, with the bar between -- as a .frac span (css/style.css),
 * wherever text goes into a pill, a box or a cell. A root (√2, √3) is
 * drawn with its sign and a bar over the figure it covers (.rad), in a
 * fraction or on its own.
 *
 *   MathText.write(el, text)  -- empties `el` and fills it with `text`,
 *                                every fraction stood up, every root drawn
 *   MathText.has(text)        -- whether a line carries one at all
 *
 * The stacked span reads back as its digits run together ("12"), so a
 * caller that needs the label as data keeps the string (dataset.name on a
 * pill) rather than reading the element's text. A screen reader is given
 * the fraction whole, as an image with the glyph for its label.
 *
 * Load order: before js/typer.js and js/pages.js, which write through it.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* The glyphs a line may spell a fraction with -> [numerator, denominator]. */
  var GLYPHS = {
    '½': ['1', '2'],
    '⅓': ['1', '3'], '⅔': ['2', '3'],
    '¼': ['1', '4'], '¾': ['3', '4'],
    '⅕': ['1', '5'], '⅖': ['2', '5'], '⅗': ['3', '5'], '⅘': ['4', '5'],
    '⅙': ['1', '6'], '⅚': ['5', '6'],
    '⅛': ['1', '8'], '⅜': ['3', '8'], '⅝': ['5', '8'], '⅞': ['7', '8']
  };
  /* One glyph; or figures, letters, a root or a Greek letter either side
     of U+2044 FRACTION SLASH ("1⁄√2", "√3⁄2", "opposite⁄hypotenuse") --
     never the ordinary solidus, so "π/2" in prose is left alone; a
     fraction held in brackets is one token with them; or a root on its
     own ("√2", "√3 units"). */
  var FRAC_PART = '[A-Za-zθ√\\d°]+';
  var TOKEN = new RegExp(
    '[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]' +
    '|\\(' + FRAC_PART + '⁄' + FRAC_PART + '\\)' +
    '|' + FRAC_PART + '⁄' + FRAC_PART +
    '|√\\d+', 'g');
  var RADICAL = /√(\d+)/g;

  function parts(tok) {
    return GLYPHS[tok] || tok.split('⁄');
  }

  function bracketed(tok) {
    return tok.charAt(0) === '(' && tok.charAt(tok.length - 1) === ')';
  }

  function has(text) {
    TOKEN.lastIndex = 0;
    return TOKEN.test(String(text == null ? '' : text));
  }

  /* A root, as it is typeset: the sign DRAWN (not the √ glyph, whose top
     never meets the bar) with its last stroke running up into the bar,
     and the figure it covers wearing that bar as its top edge. The sign is
     in em units -- 100 to the em -- so it is as tall as the figure and its
     bar whatever the size; its top stroke sits exactly on the bar. One
     inline-flex, so it never breaks between the two. */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SIGN_PATH = 'M3 72 L13 65 L29 110 L54 5 L58 5';

  function radical(n) {
    var el = document.createElement('span');
    el.className = 'rad';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', '√' + n);
    var sign = document.createElementNS(SVG_NS, 'svg');
    sign.setAttribute('class', 'rad__sign');
    sign.setAttribute('viewBox', '0 0 58 118');
    sign.setAttribute('aria-hidden', 'true');
    sign.setAttribute('focusable', 'false');
    var stroke = document.createElementNS(SVG_NS, 'path');
    stroke.setAttribute('d', SIGN_PATH);
    sign.appendChild(stroke);
    var x = document.createElement('span');
    x.className = 'rad__x';
    x.setAttribute('aria-hidden', 'true');
    x.textContent = n;
    el.appendChild(sign);
    el.appendChild(x);
    return el;
  }

  /* Plain text with any roots in it drawn: text nodes round .rad spans. */
  function piece(el, s) {
    var from = 0, m;
    RADICAL.lastIndex = 0;
    while ((m = RADICAL.exec(s)) !== null) {
      if (m.index > from) el.appendChild(document.createTextNode(s.slice(from, m.index)));
      el.appendChild(radical(m[1]));
      from = m.index + m[0].length;
    }
    if (from < s.length) el.appendChild(document.createTextNode(s.slice(from)));
    return el;
  }

  /* The stack: numerator, then denominator wearing the bar as its top edge.
     A bracketed one is the stack between two tall brackets, all one span,
     so it never breaks across a row. */
  function frac(tok) {
    if (bracketed(tok)) {
      var inner = tok.slice(1, -1);
      var wrap = document.createElement('span');
      wrap.className = 'frac-group';
      wrap.setAttribute('role', 'img');
      wrap.setAttribute('aria-label', '(' + parts(inner).join('/') + ')');
      var stack = frac(inner);
      stack.removeAttribute('role');
      stack.removeAttribute('aria-label');
      wrap.appendChild(paren('('));
      wrap.appendChild(stack);
      wrap.appendChild(paren(')'));
      return wrap;
    }
    var p = parts(tok);
    var el = document.createElement('span');
    el.className = 'frac';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', GLYPHS[tok] ? tok : p[0] + '/' + p[1]);
    var n = document.createElement('span');
    n.className = 'frac__n';
    piece(n, p[0]);
    var d = document.createElement('span');
    d.className = 'frac__d';
    piece(d, p[1]);
    el.appendChild(n);
    el.appendChild(d);
    return el;
  }

  function paren(ch) {
    var b = document.createElement('span');
    b.className = 'frac-paren';
    b.setAttribute('aria-hidden', 'true');
    b.textContent = ch;
    return b;
  }

  /* `text` into `el`, as text nodes with a .frac for each fraction and a
     .rad for each root. A line with none in it comes out as one text node
     -- what el.textContent = text would have made -- so writing through
     here costs nothing. */
  function write(el, text) {
    var s = String(text == null ? '' : text);
    el.textContent = '';
    var from = 0;
    var m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(s)) !== null) {
      if (m.index > from) el.appendChild(document.createTextNode(s.slice(from, m.index)));
      /* a root on its own, or a fraction (which may begin with a root) */
      if (m[0].charAt(0) === '√' && m[0].indexOf('⁄') < 0) el.appendChild(radical(m[0].slice(1)));
      else el.appendChild(frac(m[0]));
      from = m.index + m[0].length;
    }
    if (from < s.length) el.appendChild(document.createTextNode(s.slice(from)));
    return el;
  }

  /* ======================================================================
   * A root in a figure label (SVG <text>)
   * ----------------------------------------------------------------------
   * A <text> cannot hold a drawn path, so a watched label keeps one beside
   * it -- its "ink", the next sibling -- with the same sign and bar as
   * .rad above. The label itself keeps the figure under the bar and a
   * space where the sign goes; the ink is drawn over that space and along
   * the top of the figure, in the label's own coordinates, and wears the
   * label's transform, classes and inline style, so it lands, pulses,
   * turns and fades with it. Anything that writes the label -- writeVal,
   * or textContent set straight -- is seen, and the root laid out again.
   *
   *   MathText.watch(textEl)  -- keep any root in this label drawn
   * ====================================================================== */
  var SIGN_W = 58, SIGN_TOP = 5, SIGN_FOOT = 110;
  var SIGN_PTS = [[3, 72], [13, 65], [29, 110], [54, 5], [58, 5]];
  var watched = [];
  var measurer = null;

  function round2(n) { return Math.round(n * 100) / 100; }

  /* How far the figures rise above the baseline, in the label's own units. */
  function capOf(text, s) {
    if (!measurer) measurer = document.createElement('canvas').getContext('2d');
    var cs = global.getComputedStyle(text);
    measurer.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    return measurer.measureText(s).actualBoundingBoxAscent;
  }

  /* The label's text as tspans: each root's figure in a .rad-x, after a
     .rad-gap that holds the sign's room. Plain text is left plain. */
  function layoutSvg(text) {
    if (text.querySelector('tspan.rad-x')) return;
    var s = text.textContent;
    RADICAL.lastIndex = 0;
    if (!RADICAL.test(s)) return;
    text.textContent = '';
    var from = 0, m;
    RADICAL.lastIndex = 0;
    while ((m = RADICAL.exec(s)) !== null) {
      if (m.index > from) text.appendChild(document.createTextNode(s.slice(from, m.index)));
      var gap = document.createElementNS(SVG_NS, 'tspan');
      gap.setAttribute('class', 'rad-gap');
      gap.textContent = ' ';
      var x = document.createElementNS(SVG_NS, 'tspan');
      x.setAttribute('class', 'rad-x');
      x.textContent = m[1];
      text.appendChild(gap);
      text.appendChild(x);
      from = m.index + m[0].length;
    }
    if (from < s.length) text.appendChild(document.createTextNode(s.slice(from)));
  }

  /* The ink takes on the label's look: its classes (so its opacity and
     its pulse), its transform and inline style, and its colour as stroke.
     Its width is set inline too: the label's class carries the lettering's
     outline width, which would otherwise win over an attribute. */
  function mirror(text, ink, width) {
    ink.setAttribute('class', (text.getAttribute('class') || '') + ' rad-ink');
    var tf = text.getAttribute('transform');
    if (tf) ink.setAttribute('transform', tf); else ink.removeAttribute('transform');
    ink.setAttribute('style', (text.getAttribute('style') || '') +
      ';stroke:' + global.getComputedStyle(text).fill + ';stroke-width:' + width + 'px');
  }

  /* The sign and bar for every root in the label; false while the label
     cannot be measured (it, or a group round it, is hidden). */
  function drawSvg(text) {
    var ink = text._radInk;
    var roots = text.querySelectorAll('tspan.rad-x');
    if (!roots.length) { ink.setAttribute('d', ''); return true; }
    if (ink.previousSibling !== text && text.parentNode) {
      text.parentNode.insertBefore(ink, text.nextSibling);
    }
    var d = '', fs = parseFloat(global.getComputedStyle(text).fontSize) || 25;
    try {
      for (var i = 0; i < roots.length; i++) {
        var x = roots[i], gap = x.previousSibling;
        var n = x.textContent.length;
        var start = x.getStartPositionOfChar(0);
        var end = x.getEndPositionOfChar(n - 1).x;
        var g0 = gap.getStartPositionOfChar(0).x;
        if (!(end > start.x)) return false;
        var bar = start.y - capOf(text, x.textContent) - 0.14 * fs;
        var foot = start.y + 0.04 * fs;
        var x1 = start.x - 0.04 * fs;
        var x0 = Math.max(g0, x1 - 0.55 * fs);
        var pts = SIGN_PTS.map(function (p) {
          return round2(x0 + p[0] / SIGN_W * (x1 - x0)) + ' ' +
                 round2(bar + (p[1] - SIGN_TOP) / (SIGN_FOOT - SIGN_TOP) * (foot - bar));
        });
        pts.push(round2(end + 0.06 * fs) + ' ' + round2(bar));
        d += 'M' + pts.join(' L');
      }
    } catch (e) {
      return false;
    }
    ink.setAttribute('d', d);
    mirror(text, ink, round2(0.08 * fs));
    return true;
  }

  function update(text) {
    layoutSvg(text);
    if (drawSvg(text) || text._radRetry) return;
    /* not measurable yet: look again shortly, while the label is still in
       the page and still has a root to draw */
    text._radRetry = setTimeout(function () {
      text._radRetry = null;
      if (text.isConnected && text.querySelector('tspan.rad-x')) update(text);
    }, 150);
  }

  function watch(text) {
    if (!text || text._radInk) return text;
    text._radInk = document.createElementNS(SVG_NS, 'path');
    text._radInk.setAttribute('aria-hidden', 'true');
    new MutationObserver(function () { update(text); }).observe(text, {
      childList: true, characterData: true, subtree: true, attributes: true,
      attributeFilter: ['x', 'y', 'dx', 'dy', 'text-anchor', 'transform', 'class', 'style', 'hidden']
    });
    watched.push(text);
    update(text);
    return text;
  }

  /* the figures move once the display face has loaded */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { watched.forEach(update); });
  }

  global.MathText = {
    GLYPHS: GLYPHS,
    has: has,
    write: write,
    watch: watch
  };
})(window);
