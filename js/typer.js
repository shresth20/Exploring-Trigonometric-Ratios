/* ==========================================================================
 * typer.js -- "words ease in"
 * --------------------------------------------------------------------------
 * A typewriter in PACING only. It lands a word at a time, and each word fades
 * up and unblurs where it already sits. Nothing reflows while a line arrives,
 * and the line always finishes on time even on slow frames.
 *
 * The three ideas that make it look smooth:
 *
 *   1. LAYOUT FIRST, REVEAL SECOND. The whole line is written into the DOM up
 *      front, one <span class="wd"> per word, all at opacity 0. Revealing only
 *      adds a class. Because every word already occupies its final box, no
 *      word ever pushes another sideways as it appears -- which is exactly
 *      what makes a character-by-character typewriter on a centred line look
 *      so jittery.
 *
 *   2. A HIDDEN GHOST RESERVES THE WIDTH. A visibility:hidden copy of the line
 *      sits in normal flow and gives the wrapper its final width and height;
 *      the live line is absolutely positioned on top of it. So a centred or
 *      wrapping line never shifts, and the box never grows as the text
 *      arrives. The ghost is built with the SAME span-per-word structure as
 *      the live line, not as a plain text node: a plain run can differ by a
 *      hair in width and wrap one word earlier than the live line does.
 *
 *   3. PACED AGAINST A WALL CLOCK, not a chain of timeouts. Each word is due
 *      at start + charsBefore * perChar, and before each word we sleep only
 *      the REMAINING time to its due moment. A dropped frame or a slow paint
 *      costs nothing; drift never accumulates. Pacing stays per character
 *      even though reveal is per word, so a long word naturally holds the
 *      line a little longer.
 *
 * Cancellation is Flow's: every sleep here is taken out through Flow.wait, so
 * a scene change unwinds a half-typed line along with the rest of the chain,
 * and Skip makes the line land whole and instantly with no special case here.
 * The `gen` guard is the second line of defence -- it stops an orphaned line
 * from writing into a box a newer line now owns.
 *
 * A fraction in a line (½ in a formula) is stood up -- numerator over
 * denominator -- by mathtext.js, which every word is written through when
 * it is loaded; the Typer stands alone without it.
 *
 * Load order: js/flow.js -> js/mathtext.js -> js/typer.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var TYPE_MS  = 72;    /* ms per character -- the default speaking pace   */
  var WORD_IN  = 200;   /* the tail: the last word finishing its fade      */
  var MORPH_MS = 0.42;  /* seconds: a box easing from one line's size to   */
                        /* the next's, when the caller names one           */

  var mq = global.matchMedia
    ? global.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  function reduced() { return !!(mq && mq.matches); }

  function sleep(ms) {
    return global.Flow ? global.Flow.wait(ms)
                       : new Promise(function (r) { setTimeout(r, ms); });
  }

  /* ---- laying a line out ------------------------------------------------ */

  /* Where a text is cut: after each word TOGETHER WITH the spaces that follow
     it, so the spacing rides along with the word it belongs to. (This is why
     .type is white-space: pre-wrap -- those trailing spaces must not
     collapse.) */
  function wordCuts(text) {
    var cuts = [];
    var re = /\S+\s*/g;
    var m;
    while ((m = re.exec(text)) !== null) cuts.push(m.index + m[0].length);
    if (!cuts.length || cuts[cuts.length - 1] !== text.length) cuts.push(text.length);
    return cuts;
  }

  /* A word into its span: plain text, unless a fraction is in it -- then
     the fraction is stood up (see mathtext.js), and the span holds text
     round a .frac element rather than one text node. */
  function write(el, s) {
    if (global.MathText) global.MathText.write(el, s);
    else el.textContent = s;
  }

  /* Lay a line out whole: a span per word, each remembering its cut (its end
     offset into the text) so the reveal can be paced per character. */
  function wordSpans(root, text) {
    root.textContent = '';
    var words = [];
    var from = 0;
    wordCuts(text).forEach(function (cut) {
      var sp = document.createElement('span');
      sp.className = 'wd';
      write(sp, text.slice(from, cut));
      root.appendChild(sp);
      words.push({ el: sp, cut: cut });
      from = cut;
    });
    return words;
  }

  /* ---- revealing it ----------------------------------------------------- */

  /* Show each word at the moment its FIRST character would have been typed.
     `due` is a performance.now() stamp; `alive` lets a newer line take the box
     over from this one. Resolves to the moment the line is done.
       `at`, when given, is the line's own clock instead: one offset in ms
     per word, from `due` -- the moment each word is heard in the line's
     recording -- so the words land as they are said, pauses and all, and
     the last one goes on as the voice says it. */
  function revealWords(words, due, perChar, alive, at) {
    var from = 0;
    var i = 0;
    var timed = !!(at && at.length === words.length);
    function when(n) { return timed ? due + at[n] : due + from * perChar; }

    function step() {
      if (i >= words.length) return Promise.resolve(timed ? when(words.length - 1) : due + from * perChar);
      if (alive && !alive()) return Promise.resolve(due);

      var w = words[i];
      var left = when(i) - performance.now();
      i++;
      var ready = left > 0 ? sleep(left) : Promise.resolve();

      return ready.then(function () {
        if (alive && !alive()) return due;
        w.el.classList.add('in');
        from = w.cut;
        return step();
      });
    }
    return step();
  }

  function wordsSettle() { return sleep(reduced() ? 0 : WORD_IN); }

  /* ---- the box a line lives in ------------------------------------------
     A bubble sized by its own text changes shape between one line and the
     next, and a bubble that snaps from "Hey there!" to a full sentence reads
     as a glitch. Flip measures both boxes and eases between them while the
     words -- already laid out, still invisible -- wait inside. scale:false on
     purpose: a scaled bubble would stretch its border and its corner radius
     along with it.

     REPLACING a line only. The first line into an empty box is not a morph
     -- there is no previous size to come from -- and running one anyway is
     actively harmful: Flip restores whatever inline styles the element had
     when it took over, so a Flip overlapping the bubble's own opening tween
     puts the bubble back to closed the moment it finishes. `had` is what
     keeps the two apart. */
  function morphBox(box, had, change) {
    var Flip = global.Flip;
    if (!box || !Flip || !had || reduced() ||
        (global.Flow && global.Flow.isFast()) ||
        box.getBoundingClientRect().width <= 0) {
      return change();
    }
    var state = Flip.getState(box);
    var out = change();
    Flip.from(state, {
      duration: MORPH_MS,
      ease: 'power2.inOut',
      scale: false,
      absolute: false
    });
    return out;
  }

  /* ---- a wrapped line's own width ---------------------------------------
     A box sized by its text stays as wide as its cap the moment the line
     wraps -- CSS has no width for "the longest row it broke into" -- so a
     two-row sentence sits in a box with a band of air either side. With
     `fit`, the wrapper is set to the widest row the ghost broke into and
     the box closes round the words. The rows cannot move: each one already
     fitted, and the word after it did not fit even at the wider width.
     Glyphs only -- the space after a row's last word hangs past its end and
     is left out. Measured through whatever scale an ancestor wears (a
     bubble arming at .15) by the wrapper's drawn-to-laid-out ratio, and set
     in em, so a board resized under a standing line keeps its rows. */

  /* `range` set round a word's glyphs: all of the span but the spaces that
     trail its last text node. From the span's first CHILD, not its first
     character, because a word with a fraction in it is text round a .frac
     element (see write above). False when there is nothing to measure -- a
     span that is spaces only. */
  function glyphs(range, sp) {
    var last = sp.lastChild;
    if (!last) return false;
    range.setStart(sp, 0);
    if (last.nodeType === 3) {
      var n = last.data.replace(/\s+$/, '').length;
      if (n) range.setEnd(last, n);
      else if (last.previousSibling) range.setEndBefore(last);
      else return false;
    } else {
      range.setEndAfter(last);
    }
    return true;
  }

  function fitWidth(wrap, ghost) {
    wrap.style.width = '';
    var cs = getComputedStyle(wrap);
    var laid = parseFloat(cs.width);
    var em = parseFloat(cs.fontSize);
    var drawn = wrap.getBoundingClientRect().width;
    if (!laid || !em || !drawn) return;
    var k = drawn / laid;

    var range = document.createRange();
    var words = ghost.querySelectorAll('.wd');
    var widest = 0, top = null, left = 0, right = 0;
    for (var i = 0; i < words.length; i++) {
      if (!glyphs(range, words[i])) continue;
      var r = range.getBoundingClientRect();
      if (top === null || r.top > top + r.height / 2) {
        if (top !== null) widest = Math.max(widest, right - left);
        top = r.top;
        left = r.left;
      }
      right = r.right;
    }
    widest = Math.max(widest, right - left) / k;

    /* A hair over, so rounding never wraps a row a word early. */
    if (widest + 2 < laid) wrap.style.width = (widest + 2) / em + 'em';
  }

  /* ---- the typewriter bound to a box ------------------------------------ */

  /* Returns a function(text) that types into this one box. A line that
     arrives while an earlier one is still typing takes the box over from it.
     `await say(...)` resolves only once the final word has FINISHED fading,
     so the caller can chain the next beat without the two overlapping. */
  function create(wrap, opts) {
    var o = opts || {};
    var ghost = wrap.querySelector('.type-ghost');
    var txt   = wrap.querySelector('.type .txt');
    var gen = 0;

    /* Lay the line out and hand back the function that says it.
       The two halves are separable because the caller sometimes needs to do
       something BETWEEN them: the board's prompt row is centred as a pair,
       so the mascot beside it can only be moved into its final place once
       the row knows how wide the finished line will make it. Reserving the
       width first lets the bird arrive where it belongs instead of landing
       in the middle of an empty row and being shoved sideways a beat later.
         Ghost before live, always, for the same reason. */
    function reserve(text, over) {
      var g = ++gen;
      var mine = function () { return g === gen; };
      var perChar = (over && over.perChar) || o.perChar || TYPE_MS;
      var at = (over && over.at) || null;
      var words;

      morphBox(o.box, ghost.textContent.length > 0, function () {
        wordSpans(ghost, text);
        words = wordSpans(txt, text);
        if (o.fit) fitWidth(wrap, ghost);
      });

      /* Pacing starts when this is CALLED, not when the line was laid out --
         so a caller may hold a reserved line for as long as it likes. */
      return function reveal() {
        return revealWords(words, performance.now(), perChar, mine, at)
          .then(function (end) {
            if (!mine()) return;
            var left = end - performance.now();
            return (left > 0 ? sleep(left) : Promise.resolve())
              .then(wordsSettle);
          });
      };
    }

    function say(text, over) { return reserve(text, over)(); }
    say.reserve = reserve;

    /* Empty the box -- both halves of it. A stale ghost holds a stale width,
       which is the one way this effect can still shift a layout. */
    say.clear = function () {
      gen++;
      ghost.textContent = '';
      txt.textContent = '';
      if (o.fit) wrap.style.width = '';
    };

    return say;
  }

  global.Typer = {
    TYPE_MS: TYPE_MS,
    WORD_IN: WORD_IN,
    create: create,
    wordCuts: wordCuts,
    wordSpans: wordSpans,
    revealWords: revealWords
  };
})(window);
