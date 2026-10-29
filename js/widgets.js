/* ==========================================================================
 * widgets.js -- the right pane and what stands in it
 * --------------------------------------------------------------------------
 * The board's right half, where the working goes while the triangle stands
 * left: equation rows with a fraction stood up in them, the dropdown blank
 * a side's name is chosen from, the answer pills, the angle slider, and
 * the table of values that is filled in over the lesson. Each widget is
 * built here and animated through Beats; nothing here decides WHEN -- the
 * sections do.
 *
 *   W.pane.show() / clear() / row(cls, html)   the pane and its rows
 *   W.eqRow(lhs)                               sin θ = [a]/[b] = [c]/[d] = v
 *   W.dropdown(host, options, right, o).ask()  the blank
 *     ... .choose(fn) / settle() / refuse()      the blank, judged by the caller
 *   W.pills(labels)                            answer pills in the pane
 *   W.slider(opts).ask()                       the angle slider
 *   W.handNudge(el) / W.handSlide(track, ...)  the pointing hand
 *   W.handDrag(from, to, size)                 ... carrying a point
 *   W.table.show() / fill() / ask() / hide()   the table
 *   W.table.addRow() / note() / askRow()       ... and the rows added to it
 *
 * Load order: js/pages.js -> js/tri.js -> js/widgets.js -> the sections
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var Flow = global.Flow;
  var Beats = global.Beats;
  var Pages = global.Pages;
  if (!Pages || !Pages.kit) {
    console.error('widgets.js: load js/pages.js before js/widgets.js.');
    return;
  }
  var K = Pages.kit;
  var NS = 'http://www.w3.org/2000/svg';

  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  function dom() { return K.dom(); }
  function quiet(p) { return K.quiet(p); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function h(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function write(el, text) {
    if (global.MathText) global.MathText.write(el, text);
    else el.textContent = text;
    return el;
  }
  function shuffled(n) {
    var o = [];
    for (var i = 0; i < n; i++) o.push(i);
    for (var j = n - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1)), t = o[j]; o[j] = o[k]; o[k] = t;
    }
    return o;
  }

  /* ---- waiting on the learner ---------------------------------------------
     One wait for "whichever of these is pressed first". Every target
     forwards its press to the hidden gate, and the gate is what is waited
     on. Under Skip the `auto` answer is taken for the learner. */
  function waitPick(targets, auto) {
    if (Flow.isFast() && auto) return Promise.resolve(auto);
    var got = null;
    function on(ev) {
      got = ev.currentTarget;
      K.ripple(ev, got);
      dom().gate.click();
    }
    function onKey(ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      got = ev.currentTarget;
      dom().gate.click();
    }
    targets.forEach(function (t) {
      t.addEventListener('click', on);
      if (!(t instanceof HTMLButtonElement)) t.addEventListener('keydown', onKey);
    });
    function off() {
      targets.forEach(function (t) {
        t.removeEventListener('click', on);
        t.removeEventListener('keydown', onKey);
      });
    }
    return Flow.once(dom().gate).then(function () { off(); return got || auto; },
                                      function (err) { off(); throw err; });
  }

  /* A burst beside an element, in the frame's burst layer. */
  function burstAt(el) {
    if (!el) return;
    var d = dom();
    var f = d.frame.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var x = r.left + r.width / 2 - f.left;
    var y = r.top + r.height / 2 - f.top;
    var svg = d.burst;
    svg.setAttribute('viewBox', '0 0 ' + round2(f.width) + ' ' + round2(f.height));
    quiet(Flow.anim(Beats.confetti(svg, x, y)));
  }

  /* ======================================================================
   * The pane
   * ====================================================================== */
  var pane = {
    show: function () {
      var d = dom();
      d.pane.removeAttribute('hidden');
      watchColumn(d.paneBody);
      return d.paneBody;
    },
    /* Empty it and shut it, with no animation. */
    clear: function () {
      var d = dom();
      d.paneBody.textContent = '';
      M.set(d.paneBody, { clearProps: 'transform' });
      d.pane.setAttribute('hidden', '');
      d.pane.classList.remove('pane--low', 'pane--top');
    },
    /* A row of the working, appended and hidden until it is brought in. */
    row: function (cls, html) {
      var d = dom();
      var row = h('div', 'pane__row' + (cls ? ' ' + cls : ''), d.paneBody);
      if (html != null) row.innerHTML = html;
      M.set(row, { opacity: 0 });
      return row;
    },
    rows: function () { return Array.prototype.slice.call(dom().paneBody.children); },
    /* Everything in it taken away, smoothly, and the pane shut. */
    out: function () {
      var d = dom();
      var rows = pane.rows();
      if (d.pane.hasAttribute('hidden') || !rows.length) { pane.clear(); return Promise.resolve(); }
      return Flow.anim(Beats.rowOut(rows)).then(pane.clear);
    },
    /* Named rows taken away, the rest left standing. */
    drop: function (rows) {
      var list = [].concat(rows).filter(Boolean);
      if (!list.length) return Promise.resolve();
      return Flow.anim(Beats.rowOut(list, { remove: true }));
    }
  };
  /* The column of rows is centred in the half, so a row growing wider --
     a fraction arriving -- or one taken away moves every row across. The
     move is glided, not jumped: the column is held where it stood and let
     go. An empty column has nowhere it stood, so the first row just lands. */
  var colWatch = null, colAt = null;
  function watchColumn(body) {
    if (colWatch || !global.ResizeObserver) return;
    colWatch = new ResizeObserver(function () {
      var at = body.childElementCount ? body.offsetLeft : null;
      if (colAt != null && at != null && at !== colAt && !M.reducedMotion()) {
        var from = colAt - at + (global.gsap.getProperty(body, 'x') || 0);
        var tl = M.timeline({ willChange: body, willChangeValue: 'transform' });
        tl.fromTo(body, { x: from }, { x: 0, duration: M.dur(0.4), ease: 'power2.out' });
      }
      colAt = at;
    });
    colWatch.observe(body);
  }

  function wipePane() {
    var d = dom();
    var out = [];
    if (!d.pane.hasAttribute('hidden')) out.push(pane.out());
    if (!d.tableWrap.hasAttribute('hidden')) out.push(table.hide());
    return out;
  }
  /* A jump or a replay (rewind in pages.js) puts the pane and the table
     back to rest with no animation; each scene's stage() then writes in
     what it expects to find. */
  wipePane.reset = function () {
    pane.clear();
    table.reset();
  };
  K.addWipe(wipePane);

  /* ======================================================================
   * An equation row:  lhs  [A: n/d]  =  [B: n/d]  =  val
   * Each slot is written through mathtext.js and brought in with popIn.
   * A fraction slot may hold a dropdown in each half instead of a word.
   * ====================================================================== */
  function eqRow(lhs, cls) {
    var row = pane.row('eq' + (cls ? ' ' + cls : ''));
    var l = h('span', 'eq__lhs', row);
    write(l, lhs);
    function frac(c) {
      var f = h('span', 'eq__frac ' + c, row);
      f.setAttribute('hidden', '');
      return { el: f, n: h('span', 'eq__n', f), d: h('span', 'eq__d', f) };
    }
    var A = frac('eq__a');
    var eq1 = h('span', 'eq__eq', row); eq1.textContent = T('symEq'); eq1.setAttribute('hidden', '');
    var B = frac('eq__b');
    var eq2 = h('span', 'eq__eq', row); eq2.textContent = T('symEq'); eq2.setAttribute('hidden', '');
    var val = h('span', 'eq__val', row); val.setAttribute('hidden', '');

    function reveal(els) {
      var list = [].concat(els);
      list.forEach(function (e) { e.removeAttribute('hidden'); });
      return Beats.popIn(list, { stagger: 0.08 });
    }
    /* A fraction's values read off the picture: the fraction (and what
       comes in with it, `shown`) arrives with its bar, and each value is
       carried to its half from the label on the figure it is read from
       (`fromN`, `fromD`), the numerator first -- a copy lifting off the
       label as it lights. Each value stands in a span of its own, so the
       bar, the denominator's top edge, shows while they fly. */
    function flyInto(F, shown, n, d, fromN, fromD) {
      F.n.textContent = ''; F.d.textContent = '';
      var vn = write(h('span', 'eq__v', F.n), n);
      var vd = write(h('span', 'eq__v', F.d), d);
      M.set([vn, vd], { opacity: 0 });
      function fly(v, from, text) {
        if (!from) return Flow.anim(Beats.popIn(v));
        quiet(Flow.anim(Beats.textPulse(from, 1)));
        return Flow.anim(Beats.flyTo(from, v, text));
      }
      return Flow.anim(reveal(shown))
        .then(function () { return fly(vn, fromN, n); })
        .then(function () { return Flow.wait(120); })
        .then(function () { return fly(vd, fromD, d); });
    }
    var r = {
      el: row, lhs: l, A: A, B: B, val: val, eq1: eq1, eq2: eq2,
      /* the first fraction's two halves written and shown */
      showA: function (n, d) { write(A.n, n); write(A.d, d); return reveal(A.el); },
      /* ...or shown empty, for dropdowns to be set into */
      openA: function () { return reveal(A.el); },
      showB: function (n, d) { write(B.n, n); write(B.d, d); return reveal([eq1, B.el]); },
      /* ...or shown empty, for the lengths' dropdowns (askLengths) */
      openB: function () { return reveal([eq1, B.el]); },
      /* The second fraction's lengths read off the picture (flyInto). */
      flyB: function (n, d, fromN, fromD) { return flyInto(B, [eq1, B.el], n, d, fromN, fromD); },
      /* a plain value after the first fraction (no second fraction) */
      showVal: function (v) {
        write(val, v);
        var eq = B.el.hasAttribute('hidden') ? eq1 : eq2;
        return reveal([eq, val]);
      },
      /* ...and the first fraction's, for a row with no words in it. */
      flyA: function (n, d, fromN, fromD) { return flyInto(A, A.el, n, d, fromN, fromD); },
      /* a value straight after the lhs, with no fraction at all */
      showOnly: function (v) { write(val, v); return reveal(val); },
      /* the words in A changed for others, in place */
      swapA: function (n, d) {
        return Beats.swapIn(A.el, function () { write(A.n, n); write(A.d, d); });
      },
      /* the row marked right: the value's slot pulses green */
      right: function () { return Beats.slotRight(val.hasAttribute('hidden') ? A.el : val); },
      /* a halves' host for a dropdown */
      hostA: function (which) { return which === 'd' ? A.d : A.n; }
    };
    return r;
  }

  /* ======================================================================
   * The dropdown blank
   * A dashed slot in the sentence, with a chevron: tap it and the choices
   * drop out under it. Waiting, it breathes; a wrong one stays red in the
   * slot, shaken and shut, while the voice says so, and is struck off the
   * list; the right one stays, green, with a tick on the corner. After
   * K.TRIES wrong ones the right one is set in for the learner.
   *   Or a free choice (choose): a pick is only set in the slot, and
   * the caller judges it -- settle() for right, refuse() for wrong.
   * ====================================================================== */
  function dropdown(host, opts, right, o) {
    o = o || {};
    var hold = o.placeholder != null ? o.placeholder : T('lblChooseSide');
    var dd = h('span', 'dd' + (o.side ? ' dd--side' : o.up ? ' dd--up' : ''), host);
    var face = h('button', 'dd__face', dd);
    face.type = 'button';
    face.setAttribute('aria-label', o.label || T('a11yDropdown'));
    var val = h('span', 'dd__val is-placeholder', face);
    val.textContent = hold;
    var caret = svgEl('svg', { 'class': 'dd__caret', viewBox: '0 0 12 8', 'aria-hidden': 'true' }, face);
    svgEl('path', { d: 'M1.5 1.5 6 6.5 10.5 1.5' }, caret);
    var menu = h('span', 'dd__menu', dd);
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    var items = opts.map(function (t) {
      var b = h('button', 'dd__opt', menu);
      b.type = 'button';
      b.setAttribute('role', 'option');
      write(b, t);
      b.dataset.name = t;
      return b;
    });
    if (!o.keepOrder) shuffled(items.length).forEach(function (i) { menu.appendChild(items[i]); });
    var tick = svgEl('svg', { 'class': 'dd__tick', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, dd);
    svgEl('circle', { cx: 12, cy: 12, r: 10.5 }, tick);
    svgEl('path', { d: 'M7 12.5 10.5 16 17 8.5' }, tick);
    var good = items[right];
    var chosen = null;
    var locked = false;

    var row = dd.closest('.pane__row');
    function open(on) {
      dd.classList.toggle('is-open', on);
      if (row) row.classList.toggle('has-open', on);
      menu.hidden = !on;
      if (!on) return;
      if (o.side) {
        var left = opensLeft();
        dd.classList.toggle('dd--left', left);
        quiet(Flow.anim(M.fromTo(menu, { opacity: 0, x: left ? 6 : -6 },
          { opacity: 1, x: 0, duration: M.dur(0.22), ease: 'power2.out' })));
        return;
      }
      var up = opensUp();
      dd.classList.toggle('dd--up', up);
      quiet(Flow.anim(M.fromTo(menu, { opacity: 0, y: up ? 6 : -6 },
        { opacity: 1, y: 0, duration: M.dur(0.22), ease: 'power2.out' })));
    }
    /* Which way the menu opens, worked out as it opens: the side `o.up`
       asks for, unless the list would run off the window there and the
       other side has more room -- a blank low on the board opens upward
       rather than have its last choices cut off. */
    var MENU_EDGE = 12;
    function opensUp() {
      var f = face.getBoundingClientRect();
      var need = menu.offsetHeight + MENU_EDGE;
      var below = global.innerHeight - f.bottom, above = f.top;
      if (o.up) return need <= above || above >= below;
      return need > below && above > below;
    }
    /* A list laid along its row (`o.side`) opens to the right of its blank,
       over the blanks beside it, unless it would run off the table there
       -- the last columns' open to the left. */
    function opensLeft() {
      var f = face.getBoundingClientRect();
      var box = dd.closest('.ttable');
      var edge = box ? box.getBoundingClientRect() : { left: 0, right: global.innerWidth };
      var need = menu.offsetWidth + MENU_EDGE;
      var right = edge.right - f.right, left = f.left - edge.left;
      return need > right && left > right;
    }
    function setVal(text) {
      val.classList.remove('is-placeholder');
      write(val, text);
    }
    /* `hush`: no chime of its own -- the caller rings its own */
    function win(hush) {
      open(false);
      dd.classList.remove('is-asking', 'is-wrong');
      setVal(good.dataset.name);
      dd.classList.add('is-right');
      face.disabled = true;
      if (!hush) Beats.sfx('correct');
      quiet(Flow.anim(M.correct(face)));
      return Flow.anim(M.fromTo(tick, { opacity: 0, scale: 0, transformOrigin: 'center center' },
        { opacity: 1, scale: 1, duration: M.dur(0.4), ease: M.POP }));
    }

    /* Shut, or open again: no list opened, nothing picked. */
    function lock(on) {
      locked = on;
      face.disabled = on || dd.classList.contains('is-right');
      if (on) open(false);
    }
    /* A wrong pick, held: red in the slot, shaken, struck off the list,
       and the blank shut until `said` -- the voice saying so -- is heard
       out. Left red, for retry() to empty or win() to answer. */
    function miss(b, said) {
      if (b) {
        b.__out = true;
        b.classList.add('is-out');
        setVal(b.dataset.name);
      }
      dd.classList.remove('is-asking');
      dd.classList.add('is-wrong');
      lock(true);
      return K.heldWrong(M.incorrect(face), said).then(function () { lock(false); });
    }
    /* ...and emptied for another go. */
    function retry() {
      if (chosen || dd.classList.contains('is-right')) return;
      dd.classList.remove('is-wrong');
      val.classList.add('is-placeholder');
      val.textContent = hold;
      dd.classList.add('is-asking');
    }

    /* Only one menu open at a time: a press anywhere else shuts this one. */
    function onDoc(ev) {
      if (!dd.classList.contains('is-open')) return;
      if (dd.contains(ev.target)) return;
      open(false);
    }

    return {
      el: dd,
      face: face,
      /* The blank wearing its call, waiting. */
      arm: function () { dd.classList.add('is-asking'); },
      disarm: function () { dd.classList.remove('is-asking'); open(false); },
      /* Ask, and wait for the right answer. q.onWrong(i) answers a wrong
         pick, handing back the voice saying so, which the wrong pick is
         held for; q.onOpen fires on the first open (to stop a hand nudge). */
      ask: function (q) {
        q = q || {};
        dd.classList.add('is-asking');
        document.addEventListener('pointerdown', onDoc, true);
        var opened = false, misses = 0;
        function got() {
          if (!opened) { opened = true; if (q.onOpen) q.onOpen(); }
          document.removeEventListener('pointerdown', onDoc, true);
          return win().then(function () {
            if (q.burst !== false) burstAt(face);
          });
        }
        function loop() {
          var live = [face].concat(items.filter(function (i) { return !i.__out; }));
          return waitPick(live, good).then(function (b) {
            if (b === face) {
              if (!opened) { opened = true; if (q.onOpen) q.onOpen(); }
              open(menu.hidden);
              return loop();
            }
            if (b === good) return got();
            open(false);
            misses++;
            Beats.sfx('wrong');
            var said = q.onWrong ? q.onWrong(items.indexOf(b), b.dataset.name) : null;
            return miss(b, said).then(function () {
              /* missed too often: the right one is set in for the learner */
              if (misses >= K.TRIES) return got();
              retry();
              return loop();
            });
          });
        }
        return loop().then(null, function (err) {
          document.removeEventListener('pointerdown', onDoc, true);
          throw err;
        });
      },

      /* A free choice: the face opens the list, and an option pressed is
         set in the slot and the list shut -- right or wrong is not said
         until the caller judges it. `fn(name)` hears every pick, `onOpen` the
         list being opened. Hands back the function that stops listening. */
      choose: function (fn, onOpen) {
        dd.classList.add('is-asking');
        function onFace() {
          if (locked || dd.classList.contains('is-right')) return;
          if (onOpen) onOpen();
          open(menu.hidden);
        }
        function onItem(ev) {
          var b = ev.currentTarget;
          if (b.__out || locked || dd.classList.contains('is-right')) return;
          chosen = b;
          setVal(b.dataset.name);
          dd.classList.remove('is-asking', 'is-wrong');
          open(false);
          fn(b.dataset.name);
        }
        face.addEventListener('click', onFace);
        items.forEach(function (b) { b.addEventListener('click', onItem); });
        document.addEventListener('pointerdown', onDoc, true);
        return function off() {
          face.removeEventListener('click', onFace);
          items.forEach(function (b) { b.removeEventListener('click', onItem); });
          document.removeEventListener('pointerdown', onDoc, true);
          open(false);
          dd.classList.remove('is-asking');
        };
      },
      /* What is in the slot now, and whether it is the right one. */
      value: function () { return chosen ? chosen.dataset.name : null; },
      isRight: function () { return chosen === good; },
      /* Judged right -- or set right for the learner, under a skip: green,
         with the tick, and shut for good. */
      settle: function () {
        chosen = good;
        return win(true);
      },
      /* Judged wrong: red in the slot and a shake, that choice struck off
         the list, and the blank shut until `said` -- the voice saying so
         -- is heard out; then the slot is empty again for another go,
         unless `last`: then it is left for settle(). */
      refuse: function (said, last) {
        var b = chosen;
        chosen = null;
        return miss(b, said).then(function () { if (!last) retry(); });
      },
      /* Shut while another blank's miss is said, and opened again. */
      lock: lock
    };
  }

  /* ======================================================================
   * Answer pills in the pane
   * ====================================================================== */
  function pills(labels, cls) {
    var row = pane.row('pane__pills' + (cls ? ' ' + cls : ''));
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', T('a11yAnswers'));
    var btns = K.buildChoices(row, labels);
    btns.forEach(function (b) { M.button3d(b, { edge: 4 }); });
    return { el: row, btns: btns };
  }

  /* A single big button in the pane (the "split" control). */
  function button(text, cls) {
    var row = pane.row('pane__pills' + (cls ? ' ' + cls : ''));
    var b = h('button', 'choice choice--big', row);
    b.type = 'button';
    write(b, text);
    M.button3d(b, { edge: 4 });
    return { el: row, btn: b };
  }

  /* A plain line of words in the pane (the side lengths of the 90° page). */
  function fact(text, cls) {
    var row = pane.row('fact' + (cls ? ' ' + cls : ''));
    write(row, text);
    return row;
  }

  /* ======================================================================
   * The hand, over a control
   * ====================================================================== */
  var HAND_H = 52;
  function handLayer() {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'nudge');
    svg.setAttribute('aria-hidden', 'true');
    var ring = svgEl('circle', { 'class': 'nudge__ring', r: 0 }, svg);
    var hand = svgEl('g', { 'class': 'nudge__hand' }, svg);
    svgEl('path', { d: K.HAND_D }, hand);
    document.body.appendChild(svg);
    return { svg: svg, ring: ring, hand: hand };
  }
  function stopper(tl, L) {
    var stopped = false;
    return function stop() {
      if (stopped) return;
      stopped = true;
      Beats.nudgeStop(tl, L.hand).eventCallback('onComplete', function () {
        if (L.svg.parentNode) L.svg.parentNode.removeChild(L.svg);
      });
      L.ring.style.opacity = 0;
    };
  }

  /* Tap here: the hand taps on `el`, a little right of its middle. */
  function handNudge(el) {
    if (Flow.isFast() || M.reducedMotion()) return function () {};
    var L = handLayer();
    function tip() {
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width * 0.62, y: r.top + r.height * 0.62, h: Math.max(28, r.height) };
    }
    var tl = Beats.nudgeTap(L.hand,
      function (scale) {
        var p = tip();
        L.hand.setAttribute('transform', 'translate(' + round2(p.x) + ' ' + round2(p.y) +
                            ') scale(' + round2(p.h / HAND_H * scale) + ')');
      },
      function (k, alpha) {
        var p = tip();
        L.ring.setAttribute('cx', round2(p.x));
        L.ring.setAttribute('cy', round2(p.y));
        L.ring.setAttribute('r', round2(p.h * 0.34 * k));
        L.ring.style.opacity = alpha;
      });
    return stopper(tl, L);
  }

  /* Carry it there: the hand slides along `track` from fraction `from` to
     fraction `to` of its width. */
  function handSlide(track, from, to) {
    if (Flow.isFast() || M.reducedMotion()) return function () {};
    var L = handLayer();
    var tl = Beats.nudgeSlide(L.hand, function (t, gap) {
      var r = track.getBoundingClientRect();
      var x = r.left + r.width * (from + (to - from) * t);
      var y = r.top + r.height / 2 + gap * 0.6;
      var s = Math.max(28, r.height * 2.2) / HAND_H;
      L.hand.setAttribute('transform', 'translate(' + round2(x) + ' ' + round2(y) + ') scale(' + round2(s) + ')');
    });
    return stopper(tl, L);
  }

  /* Carry it there, anywhere: the hand slides from point `from` to point
     `to` -- each a function handing back client coordinates, read every
     frame -- drawn `size` px tall. */
  function handDrag(from, to, size) {
    if (Flow.isFast() || M.reducedMotion()) return function () {};
    var L = handLayer();
    var tl = Beats.nudgeSlide(L.hand, function (t, gap) {
      var a = from(), b = to();
      var x = a.x + (b.x - a.x) * t;
      var y = a.y + (b.y - a.y) * t + gap * 0.6;
      L.hand.setAttribute('transform', 'translate(' + round2(x) + ' ' + round2(y) + ') scale(' + round2(size / HAND_H) + ')');
    });
    return stopper(tl, L);
  }

  /* ======================================================================
   * The slider
   * A track with a thumb, a label and a readout. The thumb follows the
   * finger 1:1 (no tween) and the triangle it drives is redrawn from the
   * value every frame. Let go within `snap` of the target, it is caught
   * there and locked; `ask()` resolves when it is.
   * ====================================================================== */
  var NUDGE_AFTER = 2200;

  function slider(o) {
    var row = pane.row('slider');
    var head = h('div', 'slider__head', row);
    var lab = h('span', 'slider__label', head);
    lab.textContent = o.label || T('lblAngle');
    var out = h('span', 'slider__value', head);
    var track = h('div', 'slider__track', row);
    track.setAttribute('role', 'slider');
    track.setAttribute('tabindex', '0');
    track.setAttribute('aria-label', T('a11ySlider'));
    track.setAttribute('aria-valuemin', o.min);
    track.setAttribute('aria-valuemax', o.max);
    var fill = h('div', 'slider__fill', track);
    var mark = h('div', 'slider__mark', track);
    var thumb = h('div', 'slider__thumb', track);

    var min = o.min, max = o.max;
    var v = o.value;
    var target = o.target;
    var snap = o.snap == null ? 2 : o.snap;
    var fmt = o.fmt || function (n) { return T('lblDegVal', { n: Math.round(n) }); };
    var locked = false;
    var live = false;

    function frac(n) { return (n - min) / (max - min); }
    function paint() {
      var w = track.clientWidth || 1;
      var p = frac(v);
      thumb.style.transform = 'translate(' + round2(p * w) + 'px, -50%)';
      fill.style.transform = 'scaleX(' + round2(p) + ')';
      out.textContent = fmt(v);
      track.setAttribute('aria-valuenow', Math.round(v));
    }
    function setValue(n, silent) {
      v = Math.max(min, Math.min(max, n));
      paint();
      if (!silent && o.onChange) o.onChange(v);
    }
    if (target != null) {
      mark.style.left = (frac(target) * 100) + '%';
    } else {
      mark.hidden = true;
    }
    setValue(v, true);
    /* painted again once the row has its width */
    requestAnimationFrame(paint);

    var grabbing = false, pid = null, stopHand = null, moved = 0;
    function valueAt(ev) {
      var r = track.getBoundingClientRect();
      var p = (ev.clientX - r.left) / (r.width || 1);
      return min + Math.max(0, Math.min(1, p)) * (max - min);
    }
    function tryLock() {
      if (locked || target == null) return false;
      if (Math.abs(v - target) <= snap) {
        locked = true;
        live = false;
        row.classList.add('is-done');
        thumb.classList.remove('is-held');
        setValue(target);
        Beats.pop();
        quiet(Flow.anim(M.correct(thumb)));
        dom().gate.click();
        return true;
      }
      return false;
    }
    function onDown(ev) {
      if (!live) return;
      grabbing = true;
      pid = ev.pointerId;
      if (stopHand) { stopHand(); stopHand = null; }
      thumb.classList.add('is-held');
      try { track.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
      setValue(valueAt(ev));
    }
    function onMove(ev) {
      if (!grabbing || ev.pointerId !== pid) return;
      var n = valueAt(ev);
      moved += Math.abs(n - v);
      setValue(n);
    }
    function onUp(ev) {
      if (!grabbing || ev.pointerId !== pid) return;
      grabbing = false;
      thumb.classList.remove('is-held');
      if (!tryLock() && target != null && Math.abs(v - target) <= snap * 3) {
        /* close, but not there: ease the rest of the way, as a thing is
           caught by the place it belongs */
        var from = v;
        var p = { t: 0 };
        quiet(Flow.anim(M.to(p, { t: 1, duration: M.dur(0.3), ease: M.SNAP,
          onUpdate: function () { setValue(from + (target - from) * p.t); } })).then(tryLock));
      }
    }
    function onKey(ev) {
      if (!live) return;
      var step = (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') ? 1 :
                 (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') ? -1 : 0;
      if (!step) return;
      ev.preventDefault();
      if (stopHand) { stopHand(); stopHand = null; }
      setValue(v + step * (o.step || 1));
      tryLock();
    }
    track.addEventListener('pointerdown', onDown);
    track.addEventListener('pointermove', onMove);
    track.addEventListener('pointerup', onUp);
    track.addEventListener('pointercancel', onUp);
    track.addEventListener('keydown', onKey);
    global.addEventListener('resize', paint);

    function off() {
      live = false;
      if (stopHand) { stopHand(); stopHand = null; }
      global.removeEventListener('resize', paint);
    }

    return {
      el: row,
      track: track,
      value: function () { return v; },
      set: function (n) { setValue(n); },
      /* Live: wait for the thumb to be carried to the target. A skip
         carries it there for the learner. */
      ask: function () {
        live = true;
        row.classList.add('is-asking');
        quiet(Flow.wait(NUDGE_AFTER).then(function () {
          if (!live || grabbing || moved > 2 || locked) return;
          stopHand = handSlide(track, frac(v), target == null ? 1 : frac(target));
        }));
        return Flow.once(dom().gate, { auto: true }).then(function () {
          row.classList.remove('is-asking');
          if (!locked && target != null) {
            locked = true;
            setValue(target);
            row.classList.add('is-done');
          }
          off();
        }, function (err) { off(); throw err; });
      },
      off: off
    };
  }

  /* ======================================================================
   * The table of values
   * Ratio | 0° | 30° | 45° | 60° | 90°, three rows -- and, once those are
   * complete, three more (cosec, sec, cot), each kept out of the table
   * until the lesson adds it. Built once; the values filled in over the
   * lesson are remembered, so each time the table is shown it carries what
   * has been found so far. While a value lands, its row is lit and the
   * others step back. Under the table, a foot: the formula a new row is
   * worked from.
   * ====================================================================== */
  var ANGLES = [0, 30, 45, 60, 90];
  var RATIOS = ['sin', 'cos', 'tan'];
  var MORE = ['cosec', 'sec', 'cot'];
  var ROWS = RATIOS.concat(MORE);
  var RATIO_LBL = { sin: 'lblSinTheta', cos: 'lblCosTheta', tan: 'lblTanTheta',
                    cosec: 'lblCosecTheta', sec: 'lblSecTheta', cot: 'lblCotTheta' };
  var filled = {};          /* 'sin:45' -> text */
  var added = {};           /* 'cosec' -> true, once the lesson has added it */
  var tableEl = null;
  var footEl = null;
  var cells = {};
  var rows = {};

  function buildTable() {
    var d = dom();
    d.tableWrap.textContent = '';
    tableEl = h('div', 'ttable', d.tableWrap);
    tableEl.setAttribute('role', 'table');
    var head = h('div', 'ttable__row ttable__row--head', tableEl);
    var c0 = h('div', 'ttable__cell ttable__cell--head ttable__cell--lhs', head);
    c0.textContent = T('lblRatio');
    ANGLES.forEach(function (a) {
      var c = h('div', 'ttable__cell ttable__cell--head', head);
      c.dataset.angle = String(a);
      c.textContent = T('lblDegVal', { n: a });
    });
    ROWS.forEach(function (r) {
      var row = h('div', 'ttable__row', tableEl);
      rows[r] = row;
      var lhs = h('div', 'ttable__cell ttable__cell--lhs', row);
      lhs.textContent = T(RATIO_LBL[r]);
      ANGLES.forEach(function (a) {
        var c = h('div', 'ttable__cell ttable__cell--val', row);
        c.dataset.ratio = r;
        c.dataset.angle = String(a);
        c.setAttribute('aria-label', T('a11yCell', { ratio: T(RATIO_LBL[r]), angle: T('lblDegVal', { n: a }) }));
        var inner = h('span', 'ttable__v', c);
        cells[r + ':' + a] = { el: c, v: inner };
      });
    });
    footEl = h('div', 'ttable-foot', d.tableWrap);
    footEl.hidden = true;
    paintTable();
  }
  /* The added rows in, the rest out; a table of more than three rows is
     set closer, so it still stands clear of the header. */
  function syncRows() {
    MORE.forEach(function (r) { rows[r].hidden = !added[r]; });
    tableEl.classList.toggle('ttable--long', MORE.some(function (r) { return added[r]; }));
  }
  function clearFoot() {
    if (!footEl) return;
    footEl.textContent = '';
    footEl.hidden = true;
    M.set(footEl, { clearProps: 'opacity,transform' });
  }
  function paintTable() {
    syncRows();
    focusRow(null);
    focusCols(null);
    Object.keys(cells).forEach(function (k) {
      var c = cells[k];
      c.el.classList.remove('is-new', 'is-ask', 'is-right', 'is-wrong', 'is-pick');
      c.el.removeAttribute('tabindex');
      if (filled[k]) {
        write(c.v, filled[k]);
        c.el.classList.add('is-filled');
        M.set(c.v, { clearProps: 'opacity,transform' });
      } else {
        c.v.textContent = '';
        c.el.classList.remove('is-filled');
      }
    });
  }
  /* One row lit -- or several, given a list -- and the others stepped
     back; null brings them all back. */
  function focusRow(r) {
    var on = [].concat(r || []);
    tableEl.classList.toggle('has-focus', on.length > 0);
    ROWS.forEach(function (k) { rows[k].classList.toggle('is-focus', on.indexOf(k) >= 0); });
  }
  /* The same for columns: one angle lit -- or several, given a list --
     its key and its cells, and the other angles faded back; null brings
     them all back. */
  function focusCols(a) {
    var on = [].concat(a == null ? [] : a).map(String);
    tableEl.classList.toggle('has-colfocus', on.length > 0);
    Array.prototype.slice.call(tableEl.querySelectorAll('[data-angle]')).forEach(function (c) {
      c.classList.toggle('is-colfocus', on.indexOf(c.dataset.angle) >= 0);
    });
  }
  function rowCells(r) {
    return Array.prototype.slice.call(rows[r].children);
  }

  var table = {
    el: function () { return tableEl; },
    cell: function (r, a) { return cells[r + ':' + a]; },
    /* The table brought onto the stage, carrying what has been found. */
    show: function () {
      var d = dom();
      if (!tableEl) buildTable(); else paintTable();
      d.tableWrap.removeAttribute('hidden');
      return Flow.anim(Beats.rowIn(tableEl, { y: 18, scale: 0.96, d: 0.5 }));
    },
    /* Written straight in, shown, for a page staged from the level bar. */
    place: function () {
      var d = dom();
      if (!tableEl) buildTable(); else paintTable();
      d.tableWrap.removeAttribute('hidden');
      M.set(tableEl, { clearProps: 'opacity,transform' });
    },
    hide: function () {
      var d = dom();
      if (d.tableWrap.hasAttribute('hidden') || !tableEl) { d.tableWrap.setAttribute('hidden', ''); return Promise.resolve(); }
      var going = footEl.hidden ? [tableEl] : [tableEl, footEl];
      return Flow.anim(Beats.rowOut(going)).then(function () {
        d.tableWrap.setAttribute('hidden', '');
        M.set(tableEl, { clearProps: 'opacity,transform' });
        clearFoot();
      });
    },
    /* Rows lit, by name or a list of names; null for none. */
    focus: function (r) { if (tableEl) focusRow(r); },
    /* Columns lit, by angle or a list of angles; null for none. */
    focusCols: function (a) { if (tableEl) focusCols(a); },

    /* A new row taken into the table: the rows already there close up to
       make room for it, and its cells come in after. */
    addRow: function (r) {
      if (!tableEl) buildTable();
      if (added[r]) return Promise.resolve();
      var fresh = rowCells(r);
      var standing = Array.prototype.slice.call(tableEl.querySelectorAll('.ttable__cell'))
        .filter(function (c) { return !c.parentNode.hidden; });
      M.set(fresh, { opacity: 0 });
      var move = M.flip([tableEl].concat(standing), function () {
        added[r] = true;
        syncRows();
      }, { nested: true });
      return Flow.anim(move).then(function () {
        return Flow.anim(Beats.rowIn(fresh, { y: 10, stagger: 0.06 }));
      });
    },
    /* ...or written straight in, for a page staged from the level bar. */
    rememberRow: function (r) {
      added[r] = true;
      if (tableEl) syncRows();
    },

    /* The formula under the table: `lhs` and a fraction n over d, the way
       cosec θ = 1 over sin θ is written -- whole words either side of the
       bar, which a value's fraction slash cannot carry. */
    note: function (lhs, n, d) {
      if (!tableEl) buildTable();
      clearFoot();
      var el = h('div', 'ttable-note', footEl);
      write(h('span', 'ttable-note__lhs', el), lhs);
      var f = h('span', 'frac', el);
      f.setAttribute('role', 'img');
      f.setAttribute('aria-label', n + '/' + d);
      write(h('span', 'frac__n', f), n);
      write(h('span', 'frac__d', f), d);
      footEl.hidden = false;
      return Flow.anim(Beats.rowIn(el, { y: 10 }));
    },
    noteOut: function () {
      if (!footEl || footEl.hidden) return Promise.resolve();
      return Flow.anim(Beats.rowOut(footEl)).then(clearFoot);
    },

    /* A whole row asked, one cell at a time: a blank in each of its five
       cells, each with its own short list, but only one open to a pick --
       0° first, and each of the others waiting, dimmed, until the one
       before it is right. A pick is judged the moment it is made: a right
       one is kept, green, and the next blank called; a wrong one is held
       red in its blank, shut, while `spec.onWrong(n)` has the voice say so
       (the promise it hands back), and is then struck off its list and
       emptied for another go -- or, the blank's K.TRIES-th, the right one
       is set in for the learner. Once the whole row is right, the blanks
       give way to the values, which are remembered.
         spec: { answers: { 0: text, 30: text, ... },
                 options: { 0: [text, ...], 30: [...], ... }, onWrong(n) }.
       Under a skip, the right values are set in for the learner. */
    askRow: function (r, spec) {
      var picks = ANGLES.map(function (a) {
        var c = cells[r + ':' + a];
        var opts = spec.options[a];
        c.v.textContent = '';
        c.el.classList.add('is-pick');
        /* each list opens upward, its choices stacked in its own column
           over the two cells above it, so it never covers the row it is
           worked from or the formula under the table */
        var dd = dropdown(c.v, opts, opts.indexOf(spec.answers[a]), {
          keepOrder: true, placeholder: '', up: true,
          label: T('a11yCellPick', { ratio: T(RATIO_LBL[r]), angle: T('lblDegVal', { n: a }) })
        });
        return { a: a, c: c, dd: dd, ok: false };
      });
      footEl.hidden = false;

      var touched = false, stopHand = null;
      function hush() {
        touched = true;
        if (stopHand) { stopHand(); stopHand = null; }
      }
      /* The blank whose turn it is called and opened to a pick; the ones
         after it shut, dimmed and still. */
      function call(i) {
        picks.forEach(function (q, j) {
          if (q.ok) return;
          q.c.el.classList.toggle('is-waiting', j !== i);
          if (j === i) { q.dd.lock(false); q.dd.arm(); } else { q.dd.disarm(); q.dd.lock(true); }
        });
      }
      /* each pick judged as it is made; a right one calls the next blank,
         and the last opens the gate */
      function right(p) {
        if (p.ok) return;
        p.ok = true;
        Beats.sfx('correct');
        quiet(p.dd.settle());
        var next = picks.findIndex(function (q) { return !q.ok; });
        if (next < 0) dom().gate.click();
        else call(next);
      }
      function judge(p) {
        if (p.ok) return;
        if (p.dd.isRight()) return right(p);
        p.misses = (p.misses || 0) + 1;
        var last = p.misses >= K.TRIES;
        Beats.sfx('wrong');
        var said = spec.onWrong ? spec.onWrong(1) : null;
        quiet(p.dd.refuse(said, last).then(function () {
          if (last) right(p);
        }));
      }
      var offs = picks.map(function (p) { return p.dd.choose(function () { judge(p); }, hush); });
      call(0);
      function off() {
        hush();
        offs.forEach(function (f) { f(); });
        picks.forEach(function (p) { p.c.el.classList.remove('is-waiting'); });
      }
      var allRight = Flow.once(dom().gate, { auto: true });

      return Flow.anim(Beats.rowIn(picks.map(function (p) { return p.dd.el; }), { y: 10, stagger: 0.06 }))
        .then(function () {
          quiet(Flow.wait(K.SHORT * 3).then(function () {
            if (!touched) stopHand = handNudge(picks[0].dd.face);
          }));
          return allRight;
        })
        .then(function () {
          off();
          var late = picks.filter(function (p) { return !p.ok; });
          late.forEach(function (p) { p.ok = true; });
          return Promise.all(late.map(function (p) { return p.dd.settle(); }));
        })
        .then(function () {
          burstAt(cells[r + ':45'].el);
          return Flow.wait(K.SHORT);
        })
        /* the row as the table keeps it: the blanks give way to the values */
        .then(function () {
          return Promise.all(picks.map(function (p, i) {
            var text = spec.answers[p.a];
            filled[r + ':' + p.a] = text;
            return Flow.wait(i * 60).then(function () {
              return Flow.anim(Beats.swapIn(p.c.v, function () {
                write(p.c.v, text);
                p.c.el.classList.remove('is-pick');
                p.c.el.classList.add('is-filled');
              }));
            });
          }));
        }, function (err) { off(); throw err; });
    },
    /* One value landing in its cell, and remembered; its row lit unless
       `keepFocus` (a column is lit instead). */
    fill: function (r, a, text, keepFocus) {
      var c = cells[r + ':' + a];
      filled[r + ':' + a] = text;
      if (!keepFocus) focusRow(r);
      write(c.v, text);
      c.el.classList.add('is-filled', 'is-new');
      Beats.sfx('correct');
      return Flow.anim(Beats.popIn(c.v, { from: 0.4, d: 0.46 })).then(function () {
        return Flow.wait(K.SHORT);
      });
    },
    /* The three values of one angle, one after another, the angle's
       column lit while they land and the others faded back. */
    fillColumn: function (a, vals) {
      focusRow(null);
      focusCols(a);
      return RATIOS.reduce(function (chain, r) {
        return chain.then(function () { return table.fill(r, a, vals[r], true); });
      }, Promise.resolve()).then(function () { focusCols(null); });
    },
    /* What has been found, for a later scene to stage. */
    remember: function (r, a, text) { filled[r + ':' + a] = text; },
    known: function (r, a) { return filled[r + ':' + a]; },
    /* Tap the cell: every filled cell is live, the right one is confirmed
       with a pulse and a burst, a wrong one shakes and is refused. The
       caller is told of a wrong tap through onWrong. */
    ask: function (r, a, q) {
      q = q || {};
      var good = cells[r + ':' + a];
      var live = Object.keys(cells).filter(function (k) { return filled[k]; })
        .map(function (k) { return cells[k].el; });
      live.forEach(function (c) { c.classList.add('is-live'); c.setAttribute('tabindex', '0'); });
      tableEl.classList.add('is-asking');
      function done() {
        live.forEach(function (c) { c.classList.remove('is-live'); c.removeAttribute('tabindex'); });
        tableEl.classList.remove('is-asking');
      }
      function loop() {
        return waitPick(live, good.el).then(function (c) {
          if (c === good.el) {
            good.el.classList.add('is-right');
            Beats.sfx('correct');
            quiet(Flow.anim(M.correct(good.el)));
            burstAt(good.el);
            done();
            return;
          }
          quiet(Flow.anim(Beats.shakeWrong(c)));
          if (q.onWrong) q.onWrong(c);
          return loop();
        });
      }
      return loop().then(null, function (err) { done(); throw err; });
    },
    /* The cell marked right, back to plain. */
    settle: function (r, a) {
      var c = cells[r + ':' + a];
      if (c) c.el.classList.remove('is-right', 'is-ask');
    },
    reset: function () {
      filled = {};
      added = {};
      if (tableEl) paintTable();
      clearFoot();
      dom().tableWrap.setAttribute('hidden', '');
    },
    ANGLES: ANGLES, RATIOS: RATIOS, MORE: MORE
  };

  /* ======================================================================
   * A ratio asked: two dropdown blanks in the row's first fraction, the
   * numerator asked first and the denominator after, each from the three
   * side names. A faint hand taps the blank in hand until it is opened.
   * spec: { num, den } -- the right keys (wOpposite ...), `options` the
   * three keys, `onWrong(name)` a wrong pick's answer. Resolves once both
   * are right and the blanks have given way to the words in their sides'
   * inks (plainA).
   * ====================================================================== */
  var ROLE_OF = { wOpposite: 'opp', wAdjacent: 'adj', wHypotenuse: 'hyp' };

  /* The green blanks give way to the plain words, coloured as the sides
     they name -- the bar taking the denominator's ink, as a row written in
     whole has it. The boxes fade, the words come up in their place, and
     whatever the change of size moves on the pane glides there rather
     than jumping. */
  function plainA(row, num, den) {
    var A = row.A;
    return plainFrac(row, A, [row.lhs, row.eq1, row.B.el, row.eq2, row.val], function () {
      A.n.className = 'eq__n c-' + ROLE_OF[num];
      A.d.className = 'eq__d c-' + ROLE_OF[den];
      write(A.n, T(num)); write(A.d, T(den));
    });
  }
  /* A fraction's blanks giving way to what `change` writes in their
     place: the fraction fades, comes back plain, and whatever the change
     of size moves -- the rest of its row, `near`, and the other rows --
     glides there. */
  function plainFrac(row, F, near, change) {
    near = near.concat(pane.rows().filter(function (r) { return r !== row.el; }));
    function at(e) { var b = e.getBoundingClientRect(); return { x: b.left, y: b.top }; }
    return Flow.anim(M.to(F.el, { opacity: 0, scale: 0.92, duration: M.dur(0.22), ease: 'power2.in' }))
      .then(function () {
        var before = near.map(at);
        change();
        var tl = M.timeline({ willChange: near.concat(F.el), willChangeValue: 'transform, opacity' });
        near.forEach(function (e, i) {
          var now = at(e), dx = before[i].x - now.x, dy = before[i].y - now.y;
          if (!dx && !dy) return;
          tl.fromTo(e, { x: '+=' + dx, y: '+=' + dy }, { x: 0, y: 0, duration: M.dur(0.42), ease: 'power2.out' }, 0);
        });
        tl.fromTo(F.el, { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: M.dur(0.34), ease: 'power2.out' }, M.gap(0.06));
        return Flow.anim(tl);
      });
  }
  /* One blank asked until it is right, a faint hand tapping it until it
     is opened; `onWrong(name)` hears a wrong pick, and hands back the
     voice saying so. */
  function askBlank(d, onWrong) {
    var stop = null, opened = false;
    quiet(Flow.wait(K.SHORT * 3).then(function () {
      if (!opened && d.el.classList.contains('is-asking')) stop = handNudge(d.face);
    }));
    return d.ask({
      burst: false,
      onOpen: function () { opened = true; if (stop) stop(); },
      onWrong: function (i, name) { return onWrong ? onWrong(name) : null; }
    }).then(function () {
      opened = true;
      if (stop) stop();
    }, function (err) { opened = true; if (stop) stop(); throw err; });
  }

  function askRatio(row, spec) {
    var options = spec.options || ['wOpposite', 'wAdjacent', 'wHypotenuse'];
    var labels = options.map(function (k) { return T(k); });
    var dn = dropdown(row.hostA('n'), labels, options.indexOf(spec.num));
    var dd = dropdown(row.hostA('d'), labels, options.indexOf(spec.den), { up: false });
    [[dn, spec.num], [dd, spec.den]].forEach(function (pair) {
      pair[0].el.dataset.role = ROLE_OF[pair[1]];
    });
    function one(d) {
      return askBlank(d, spec.onWrong).then(function () {
        d.el.classList.add('c-' + d.el.dataset.role);
      });
    }
    return row.openA()
      .then(function () { return Flow.wait(K.SHORT); })
      .then(function () { return one(dn); })
      .then(function () { return Flow.wait(K.SHORT); })
      .then(function () { return one(dd); })
      .then(function () { return plainA(row, spec.num, spec.den); })
      .then(function () { return { num: dn, den: dd }; });
  }

  /* ======================================================================
   * A ratio's lengths asked: the side names already stand in the row's
   * first fraction, and the second has a dropdown blank in each half --
   * the numerator asked first, the denominator after -- each listing the
   * triangle's side lengths. Once both are right the blanks give way to
   * the plain lengths, as plainA does for the names. With `frac: 'A'` the
   * blanks are the first fraction's instead, for a row with no names.
   *   spec: { num, den } the right lengths, as text; `options` the lengths
   * offered; `onWrong(text)` a wrong pick's answer.
   * ====================================================================== */
  function lengthBlank(host, options, right, more) {
    return dropdown(host, options, options.indexOf(right), Object.assign({
      placeholder: T('lblChoose'), label: T('a11yDropdownLen')
    }, more || {}));
  }
  function askLengths(row, spec) {
    var first = spec.frac === 'A';
    var F = first ? row.A : row.B;
    var near = first ? [row.lhs, row.eq1, row.B.el, row.eq2, row.val]
                     : [row.lhs, row.A.el, row.eq1, row.eq2, row.val];
    F.n.textContent = ''; F.d.textContent = '';
    var dn = lengthBlank(F.n, spec.options, spec.num);
    var dd = lengthBlank(F.d, spec.options, spec.den, { up: false });
    return Flow.anim(first ? row.openA() : row.openB())
      .then(function () { return Flow.wait(K.SHORT); })
      .then(function () { return askBlank(dn, spec.onWrong); })
      .then(function () { return Flow.wait(K.SHORT); })
      .then(function () { return askBlank(dd, spec.onWrong); })
      .then(function () {
        return plainFrac(row, F, near, function () {
          write(F.n, spec.num); write(F.d, spec.den);
        });
      });
  }

  /* A value asked in the row's own value slot -- "Hypotenuse = [ ]" --
     from a dropdown of lengths. Set in place as the row is built, so it
     arrives with the row; ask() waits for the right one, and the blank
     then gives way to the value, green.
       spec: { answer, options, onWrong(text) }. */
  function valueBlank(row, spec) {
    row.val.textContent = '';
    row.val.removeAttribute('hidden');
    var d = lengthBlank(row.val, spec.options, spec.answer);
    return {
      dd: d,
      ask: function () {
        return askBlank(d, spec.onWrong).then(function () {
          return Flow.anim(Beats.swapIn(row.val, function () {
            write(row.val, spec.answer);
            row.val.classList.add('is-right');
          }));
        });
      }
    };
  }

  /* ======================================================================
   * A corner taken in hand -- the 45° triangle's (s2-ratios.js), for any
   * figure. The corner glows, the hand shows the pull, and the learner
   * drags it: the angle is worked out from where the corner is held
   * (o.degAt) and the figure redrawn from it (o.turn). Let go within
   * o.snap of o.target, it is caught there and locked, and ask() resolves;
   * close but short, it is eased the rest of the way. Arrow keys move it a
   * degree at a time; a skip carries it there.
   *   o: { group, dot, point(), degAt(p), pointAt(deg), turn(deg),
   *        min, max, target, snap, label }
   * point() is where the corner is now and pointAt(deg) where it would be,
   * both in the group's own units.
   * ====================================================================== */
  var GRAB_HALO = 15;          /* the glow round the corner                 */
  var GRAB_HIT = 42;           /* where a finger catches it                 */
  var GRAB_HAND = 46;          /* the hand's height, per picture unit's px  */

  function cornerGrab(o) {
    var Tri = global.Tri;
    var g = Tri.el('g', { 'class': 'grab', hidden: '', role: 'slider', tabindex: '-1',
                          'aria-valuemin': o.min, 'aria-valuemax': o.max }, o.group);
    var halo = Tri.el('circle', { 'class': 'grab__halo', r: GRAB_HALO }, g);
    var hit = Tri.el('circle', { 'class': 'grab__hit', r: GRAB_HIT }, g);
    var s = { deg: o.min, live: false, locked: false, held: false, pid: null, off: null, stopHand: null };

    function place() {
      var c = o.point();
      [halo, hit].forEach(function (e) {
        e.setAttribute('cx', Tri.round2(c.x));
        e.setAttribute('cy', Tri.round2(c.y));
      });
    }
    function turnTo(deg) {
      s.deg = Math.max(o.min, Math.min(o.max, deg));
      o.turn(s.deg);
      place();
      g.setAttribute('aria-valuenow', Math.round(s.deg));
    }
    function local(ev) {
      var m = o.group.getScreenCTM();
      return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : o.point();
    }
    function screen(p) {
      var m = o.group.getScreenCTM();
      return m ? new DOMPoint(p.x, p.y).matrixTransform(m) : p;
    }
    function stopHand() {
      if (s.stopHand) { s.stopHand(); s.stopHand = null; }
    }
    function tryLock() {
      if (s.locked || Math.abs(s.deg - o.target) > o.snap) return false;
      s.locked = true;
      s.live = false;
      g.classList.remove('is-held');
      turnTo(o.target);
      Beats.pop();
      quiet(Flow.anim(Beats.partPulse(o.dot, { times: 1 })));
      dom().gate.click();
      return true;
    }
    /* The finger is held where it caught the corner, not snapped onto it. */
    g.addEventListener('pointerdown', function (ev) {
      if (!s.live) return;
      var p = local(ev), c = o.point();
      s.held = true;
      s.pid = ev.pointerId;
      s.off = { x: c.x - p.x, y: c.y - p.y };
      stopHand();
      g.classList.add('is-held');
      try { g.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
    });
    g.addEventListener('pointermove', function (ev) {
      if (!s.held || ev.pointerId !== s.pid) return;
      var p = local(ev);
      turnTo(o.degAt({ x: p.x + s.off.x, y: p.y + s.off.y }));
    });
    function up(ev) {
      if (!s.held || ev.pointerId !== s.pid) return;
      s.held = false;
      g.classList.remove('is-held');
      if (!tryLock() && Math.abs(s.deg - o.target) <= o.snap * 3) {
        /* close, but not there: eased the rest of the way, as a thing is
           caught by the place it belongs */
        var from = s.deg;
        var p = { t: 0 };
        quiet(Flow.anim(M.to(p, { t: 1, duration: M.dur(0.3), ease: M.SNAP,
          onUpdate: function () { turnTo(from + (o.target - from) * p.t); } })).then(tryLock));
      }
    }
    g.addEventListener('pointerup', up);
    g.addEventListener('pointercancel', up);
    g.addEventListener('keydown', function (ev) {
      if (!s.live) return;
      var step = (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') ? 1 :
                 (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') ? -1 : 0;
      if (!step) return;
      ev.preventDefault();
      stopHand();
      turnTo(Math.round(s.deg) + step);
      tryLock();
    });

    function off() {
      s.live = false;
      s.held = false;
      stopHand();
      g.setAttribute('tabindex', '-1');
      g.classList.remove('is-asking', 'is-held');
      o.dot.classList.remove('is-lit');
    }
    return {
      el: g,
      place: place,
      turnTo: turnTo,
      deg: function () { return s.deg; },
      /* The glow brought in at the corner. */
      show: function () {
        place();
        g.removeAttribute('hidden');
        M.set(g, { opacity: 0 });
        return Beats.marksIn(g, 0.3);
      },
      /* ...and taken away. */
      hide: function () {
        return Flow.anim(Beats.marksOut(g)).then(function () { g.setAttribute('hidden', ''); });
      },
      /* The corner lit, and live: the hand shows the pull to the target,
         until the learner takes hold. */
      ask: function () {
        s.live = true;
        s.locked = false;
        g.setAttribute('tabindex', '0');
        if (o.label) g.setAttribute('aria-label', o.label);
        g.classList.add('is-asking');
        o.dot.classList.add('is-lit');
        var m = o.group.getScreenCTM();
        s.stopHand = handDrag(
          function () { return screen(o.point()); },
          function () { return screen(o.pointAt(o.target)); },
          GRAB_HAND * (m ? m.a : 1));
        return Flow.once(dom().gate, { auto: true }).then(function () {
          if (!s.locked) { s.locked = true; turnTo(o.target); }
          off();
        }, function (err) { off(); throw err; });
      },
      off: off,
      /* Put away whole, for a reset. */
      reset: function () { off(); g.setAttribute('hidden', ''); }
    };
  }

  global.W = {
    pane: pane,
    eqRow: eqRow,
    askRatio: askRatio,
    askLengths: askLengths,
    valueBlank: valueBlank,
    dropdown: dropdown,
    pills: pills,
    button: button,
    fact: fact,
    slider: slider,
    handNudge: handNudge,
    handSlide: handSlide,
    handDrag: handDrag,
    cornerGrab: cornerGrab,
    waitPick: waitPick,
    burstAt: burstAt,
    table: table,
    h: h, svgEl: svgEl, write: write
  };
})(window);
