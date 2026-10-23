/* ==========================================================================
 * devnav.js -- TEMPORARY page bar (jump / Back / Skip / Replay)
 * --------------------------------------------------------------------------
 * A development control, not part of the lesson. It moves in PAGES, which is
 * what the learner moves in: a page is one stretch of lesson between two
 * presses of Next. A scene can hold one page or six -- the last activity is
 * a page per name -- so counting scenes would not match what is on screen,
 * and this bar counts pages.
 *
 *   the list   jump straight to any page the lesson has shown
 *   Back       the page before this one, from its first beat
 *   Skip       forward to where the Next button appears
 *   Replay     this page again, from its first beat
 *
 * Back, Replay and the list are Pages.runFrom(scene, page): the pages before
 * the one asked for are not cut, they are played at once -- every beat runs
 * and the taps they ask for are answered for the learner -- and the page
 * asked for then plays at full speed from its own first beat, on the board
 * it would really have opened on.
 *
 * Skip is the lesson's own Flow.skip(): the rest of THIS page plays itself
 * out in a handful of frames and stops at its hand-over, with Next waiting
 * to be pressed.
 *
 * How many pages a scene has cannot be known before it is played -- a scene
 * that hands over inside a loop decides it as it goes -- so the list is
 * learned as the lesson is walked, and remembered for the rest of the
 * browser session. Walk it once with Skip and the list is complete.
 *
 * It owns its own markup and its own styles so it is one file to delete:
 * remove this file and its <script> tag in index.html and nothing else in
 * the project knows it was here.
 *
 * Keyboard: Alt+Left a page back, Alt+Right skip ahead, Alt+R replay.
 *
 * Load order: js/pages.js -> js/script.js -> js/devnav.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var STORE = 'devnav.pages';        /* the page counts, for this session */

  var ARROW = "data:image/svg+xml;utf8," +
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'>" +
    "<path d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%232B2C89' " +
    "stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>";

  var CSS = [
    '.devnav{',
    /* Pinned to the WINDOW's bottom-right corner, not to the lesson's frame:
       out in the letterbox below the board, clear of the whole stage. */
    '  position:fixed; z-index:9999;',
    '  bottom:max(10px,env(safe-area-inset-bottom,0px));',
    '  right:max(10px,env(safe-area-inset-right,0px));',
    '  display:flex; align-items:center; gap:8px;',
    '  padding:0px 0px; border-radius:999px;',
    '  font-family:var(--font-body,system-ui,sans-serif);',
    '  opacity:1; transition:opacity .18s ease;',
    '}',
    /* Out of the way until it is wanted. */
    '.devnav:hover,.devnav:focus-within{opacity:1;}',
    '.devnav__tag{',
    '  padding:0 2px 0 8px; font-size:11px; font-weight:700; letter-spacing:.04em;',
    '  color:#fff; white-space:nowrap; opacity:.85;',
    '}',
    '.devnav__btn,.devnav__pick{',
    '  appearance:none; -webkit-appearance:none; cursor:pointer; white-space:nowrap;',
    '  padding:7px 14px; border-radius:999px;',
    '  border:1px solid rgba(255,255,255,.55);',
    '  background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.72));',
    '  color:#262A7A; font:inherit; font-size:13px; font-weight:700;',
    '  line-height:1; transition:filter .15s ease, transform .1s ease;',
    '}',
    '.devnav__pick{',
    '  max-width:220px; padding-right:28px; text-overflow:ellipsis;',
    /* the chevron, drawn rather than fetched */
    '  background-image:url("' + ARROW + '"),' +
      'linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.72));',
    '  background-repeat:no-repeat,no-repeat;',
    '  background-position:right 11px center,center;',
    '  background-size:10px auto,auto;',
    '}',
    '.devnav__btn:hover,.devnav__pick:hover{filter:brightness(1.04);}',
    '.devnav__btn:active{transform:translateY(1px);}',
    '.devnav__btn:focus-visible,.devnav__pick:focus-visible{',
    '  outline:2px solid #FFF; outline-offset:2px;}',
    '.devnav__btn[disabled]{opacity:.42; cursor:default; filter:none;}',
    '@media (max-width:820px){',
    '  .devnav{gap:6px; padding:5px 6px;}',
    '  .devnav__btn,.devnav__pick{padding:6px 10px; font-size:12px;}',
    '  .devnav__pick{max-width:130px; padding-right:24px;}',
    '  .devnav__tag{display:none;}',
    '}'
  ].join('\n');

  function style() {
    var el = document.createElement('style');
    el.id = 'devnavStyle';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function button(label, title, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'devnav__btn';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }

  /* What the lesson has shown of itself, kept for the rest of the browser
     session so the list survives the reloads a page gets while it is being
     worked on. Storage can throw or come back empty -- a private window,
     cleared site data -- and an empty list is simply one the lesson fills
     in again as it is played. */
  function load() {
    try {
      var raw = sessionStorage.getItem(STORE);
      var got = raw ? JSON.parse(raw) : null;
      return Object.prototype.toString.call(got) === '[object Array]' ? got : [];
    } catch (e) { return []; }
  }
  function save(counts) {
    try { sessionStorage.setItem(STORE, JSON.stringify(counts)); } catch (e) {}
  }

  function mount() {
    var Pages = global.Pages;
    if (!Pages || !Pages.runFrom || !Pages.onLevel) {
      console.warn('devnav.js: this build of Pages has no page bar to drive.');
      return;
    }

    style();

    var names = Pages.levels();
    var counts = load();
    var at = 0, page = 0;

    function pagesIn(scene) { return Math.max(1, counts[scene] | 0); }

    /* Back, Replay and the list all land the same way. */
    function go(scene, p) { Pages.runFrom(scene, p); }

    /* Forward to the next hand-over. Flow.skip() is the lesson's own
       fast-forward, so this is not a jump at all: the beats still run, they
       just run at once. */
    function fwd() { if (global.Flow) global.Flow.skip(); }

    function back() {
      if (page > 0) return go(at, page - 1);
      if (at > 0) return go(at - 1, pagesIn(at - 1) - 1);
    }

    var tag = document.createElement('span');
    tag.className = 'devnav__tag';

    var pick = document.createElement('select');
    pick.className = 'devnav__pick';
    pick.title = 'Jump to a page';
    pick.setAttribute('aria-label', 'Jump to a page');
    pick.addEventListener('change', function () {
      var bits = pick.value.split(':');
      go(+bits[0], +bits[1]);
    });

    var prev  = button('« Back', 'The page before this one (Alt+Left)', back);
    var skip  = button('Skip »', 'Forward to the Next button (Alt+Right)', fwd);
    var again = button('↺ Replay', 'This page again (Alt+R)',
                       function () { go(at, page); });

    var bar = document.createElement('div');
    bar.className = 'devnav';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Page controls (development)');
    bar.appendChild(tag);
    bar.appendChild(pick);
    bar.appendChild(prev);
    bar.appendChild(skip);
    bar.appendChild(again);

    /* On the body: the bar belongs to the window, not to the staged lesson. */
    document.body.appendChild(bar);

    /* The list is rebuilt only when the lesson has shown a page it had not
       shown before; `shape` is what that is judged on. */
    var shape = '';
    function fill() {
      var want = counts.join(',');
      if (want === shape) return;
      shape = want;

      /* Each skill's pages under its own heading: an <optgroup>, so the
         heading is shown but cannot be picked. */
      var heads = Pages.skills ? Pages.skills() : [];
      var into = pick, h = 0;

      pick.textContent = '';
      for (var s = 0; s < names.length; s++) {
        while (h < heads.length && heads[h].first <= s) {
          into = document.createElement('optgroup');
          into.label = heads[h++].name;
          pick.appendChild(into);
        }
        for (var p = 0; p < pagesIn(s); p++) {
          var o = document.createElement('option');
          o.value = s + ':' + p;
          o.textContent = (s + 1) + '. ' + names[s] +
                          (pagesIn(s) > 1 ? ' · ' + (p + 1) : '');
          into.appendChild(o);
        }
      }
    }

    /* The lesson says where it is; the bar only reads it. */
    Pages.onLevel(function (where) {
      at = where.scene;
      page = where.page;

      /* A section added after this bar was built brings scenes with it. */
      if (where.scenes !== names.length) { names = Pages.levels(); shape = ''; }

      var grew = false;
      where.pages.forEach(function (n, i) {
        if (n > (counts[i] | 0)) { counts[i] = n; grew = true; }
      });
      if (grew) save(counts);

      fill();
      pick.value = at + ':' + page;

      /* "page 3/4" once the scene's length is known, "page 3" while it is
         not -- and never "page 7/6": between the last Next of a scene and
         the first beat of the next one, there is no page to be on. */
      var total = pagesIn(at);
      tag.textContent = (at + 1) + '/' + where.scenes + ' · page ' + (page + 1) +
                        (total > 1 && page < total ? '/' + total : '');
      prev.disabled = (at === 0 && page === 0);
      /* Skip is never spent: on the last page it still runs that page out to
         its own hand-over. */
    });

    document.addEventListener('keydown', function (ev) {
      if (!ev.altKey || ev.ctrlKey || ev.metaKey) return;
      var k = ev.key;
      if (k === 'ArrowLeft')           { ev.preventDefault(); back(); }
      else if (k === 'ArrowRight')     { ev.preventDefault(); fwd(); }
      else if (k === 'r' || k === 'R') { ev.preventDefault(); go(at, page); }
    });

    /* ?scene=N&page=M opens the lesson at that page (both from 0); with
       &auto=1 the page is fast-forwarded to its Next as well -- for a
       screenshot of a page's finished board from a headless browser. */
    try {
      var q = new URLSearchParams(global.location.search);
      if (q.has('scene')) {
        var sc = +q.get('scene') || 0, pg = +q.get('page') || 0;
        /* once the lesson has booted -- its words read in and its first
           run begun (script.js) -- not before */
        var armed = setInterval(function () {
          if (!Pages.started || !Pages.started()) return;
          clearInterval(armed);
          go(sc, pg);
          if (q.get('auto') !== '1') return;
          var timer = setInterval(function () {
            var b = document.getElementById('nextBtn');
            if (!b) return;
            if (b.hidden) { fwd(); return; }
            if (parseFloat(getComputedStyle(b).opacity) > 0.9) clearInterval(timer);
          }, 300);
        }, 100);
      }
    } catch (e) { /* no URL to read */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})(window);
