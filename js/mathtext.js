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

  /* A root: the sign, and the figure it covers wearing the bar as its top
     edge. One inline-flex, so it never breaks between the two. */
  function radical(n) {
    var el = document.createElement('span');
    el.className = 'rad';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', '√' + n);
    var sign = document.createElement('span');
    sign.className = 'rad__sign';
    sign.setAttribute('aria-hidden', 'true');
    sign.textContent = '√';
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

  global.MathText = {
    GLYPHS: GLYPHS,
    has: has,
    write: write
  };
})(window);
