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
 *     ... .choose(fn) / settle() / refuse()      the blank, judged later
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
    var r = {
      el: row, lhs: l, A: A, B: B, val: val, eq1: eq1, eq2: eq2,
      /* the first fraction's two halves written and shown */
      showA: function (n, d) { write(A.n, n); write(A.d, d); return reveal(A.el); },
      /* ...or shown empty, for dropdowns to be set into */
      openA: function () { return reveal(A.el); },
      showB: function (n, d) { write(B.n, n); write(B.d, d); return reveal([eq1, B.el]); },
      /* a plain value after the first fraction (no second fraction) */
      showVal: function (v) {
        write(val, v);
        var eq = B.el.hasAttribute('hidden') ? eq1 : eq2;
        return reveal([eq, val]);
      },
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
   * drop out under it. Waiting, it breathes; a wrong one shows red in the
   * slot for a moment, shakes, and is struck off the list; the right one
   * stays, green, with a tick on the corner.
   *   Or a free choice (choose): a pick is only set in the slot, and a
   * Check judges it later -- settle() for right, refuse() for wrong.
   * ====================================================================== */
  function dropdown(host, opts, right, o) {
    o = o || {};
    var hold = o.placeholder != null ? o.placeholder : T('lblChooseSide');
    var dd = h('span', 'dd' + (o.up ? ' dd--up' : ''), host);
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

    var row = dd.closest('.pane__row');
    function open(on) {
      dd.classList.toggle('is-open', on);
      if (row) row.classList.toggle('has-open', on);
      menu.hidden = !on;
      if (on) {
        var up = opensUp();
        dd.classList.toggle('dd--up', up);
        quiet(Flow.anim(M.fromTo(menu, { opacity: 0, y: up ? 6 : -6 },
          { opacity: 1, y: 0, duration: M.dur(0.22), ease: 'power2.out' })));
      }
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
    function setVal(text) {
      val.classList.remove('is-placeholder');
      write(val, text);
    }
    /* `hush`: no chime of its own -- one is rung for a Check's whole row */
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
         pick; q.onOpen fires on the first open (to stop a hand nudge). */
      ask: function (q) {
        q = q || {};
        dd.classList.add('is-asking');
        document.addEventListener('pointerdown', onDoc, true);
        var opened = false;
        function loop() {
          var live = [face].concat(items.filter(function (i) { return !i.__out; }));
          return waitPick(live, good).then(function (b) {
            if (b === face) {
              if (!opened) { opened = true; if (q.onOpen) q.onOpen(); }
              open(menu.hidden);
              return loop();
            }
            if (b === good) {
              if (!opened) { opened = true; if (q.onOpen) q.onOpen(); }
              document.removeEventListener('pointerdown', onDoc, true);
              return win().then(function () {
                if (q.burst !== false) burstAt(face);
              });
            }
            open(false);
            b.__out = true;
            b.classList.add('is-out');
            setVal(b.dataset.name);
            dd.classList.add('is-wrong');
            Beats.sfx('wrong');
            quiet(Flow.anim(M.incorrect(face)).then(function () {
              if (dd.classList.contains('is-right')) return;
              return Flow.wait(350).then(function () {
                if (dd.classList.contains('is-right')) return;
                dd.classList.remove('is-wrong');
                val.classList.add('is-placeholder');
                val.textContent = hold;
              });
            }));
            if (q.onWrong) q.onWrong(items.indexOf(b), b.dataset.name);
            return loop();
          });
        }
        return loop().then(null, function (err) {
          document.removeEventListener('pointerdown', onDoc, true);
          throw err;
        });
      },

      /* A free choice: the face opens the list, and an option pressed is
         set in the slot and the list shut -- right or wrong is not said
         until a Check judges it. `fn(name)` hears every pick, `onOpen` the
         list being opened. Hands back the function that stops listening. */
      choose: function (fn, onOpen) {
        dd.classList.add('is-asking');
        function onFace() {
          if (dd.classList.contains('is-right')) return;
          if (onOpen) onOpen();
          open(menu.hidden);
        }
        function onItem(ev) {
          var b = ev.currentTarget;
          if (b.__out || dd.classList.contains('is-right')) return;
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
         the list, and the slot empty again for another go. */
      refuse: function () {
        var b = chosen;
        chosen = null;
        if (b) { b.__out = true; b.classList.add('is-out'); }
        dd.classList.add('is-wrong');
        return Flow.anim(M.incorrect(face))
          .then(function () { return Flow.wait(350); })
          .then(function () {
            if (chosen || dd.classList.contains('is-right')) return;
            dd.classList.remove('is-wrong');
            val.classList.add('is-placeholder');
            val.textContent = hold;
            dd.classList.add('is-asking');
          });
      }
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
   * worked from, and the Check that judges it.
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
  function rowCells(r) {
    return Array.prototype.slice.call(rows[r].children);
  }

  /* The Check under the table: pressable once every blank of the row is
     set. */
  function checkButton() {
    var b = h('button', 'choice ttable-check', footEl);
    b.type = 'button';
    b.textContent = T('btnCheck');
    b.disabled = true;
    M.button3d(b, { edge: 4 });
    return b;
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

    /* A whole row asked at once: a blank in each of its five cells, all
       chosen from one list, and a Check beside the formula that judges the
       five together once every one is set. A right one is kept, green; a
       wrong one is struck off its list and emptied for another go, and
       `spec.onWrong(n)` is told how many were wrong. Once the whole row is
       right, the blanks give way to the values, which are remembered.
         spec: { answers: { 0: text, 30: text, ... }, options: [text, ...],
                 onWrong(n) }.
       Under a skip, the right values are set in for the learner. */
    askRow: function (r, spec) {
      var opts = spec.options;
      var picks = ANGLES.map(function (a) {
        var c = cells[r + ':' + a];
        c.v.textContent = '';
        c.el.classList.add('is-pick');
        var dd = dropdown(c.v, opts, opts.indexOf(spec.answers[a]), {
          keepOrder: true, placeholder: '',
          label: T('a11yCellPick', { ratio: T(RATIO_LBL[r]), angle: T('lblDegVal', { n: a }) })
        });
        return { a: a, c: c, dd: dd, ok: false };
      });
      footEl.hidden = false;
      var btn = checkButton();
      M.set(btn, { opacity: 0 });

      var touched = false, stopHand = null;
      function hush() {
        touched = true;
        if (stopHand) { stopHand(); stopHand = null; }
      }
      function ready() {
        btn.disabled = picks.some(function (p) { return !p.dd.value(); });
        btn.classList.toggle('is-asking', !btn.disabled);
      }
      var offs = picks.map(function (p) { return p.dd.choose(ready, hush); });
      function off() {
        hush();
        offs.forEach(function (f) { f(); });
        btn.disabled = true;
        btn.classList.remove('is-asking');
      }

      function round() {
        ready();
        return waitPick([btn], btn).then(function () {
          if (Flow.isFast()) picks.forEach(function (p) { if (!p.ok && !p.dd.isRight()) p.dd.settle(); });
          btn.disabled = true;
          btn.classList.remove('is-asking');
          var open = picks.filter(function (p) { return !p.ok; });
          var right = open.filter(function (p) { return p.dd.isRight(); });
          var wrong = open.filter(function (p) { return !p.dd.isRight(); });
          var landed = right.map(function (p) { p.ok = true; return p.dd.settle(); });
          if (!wrong.length) {
            Beats.sfx('correct');
            return Promise.all(landed);
          }
          Beats.sfx('wrong');
          if (spec.onWrong) spec.onWrong(wrong.length);
          return Promise.all(landed.concat(wrong.map(function (p) { return p.dd.refuse(); })))
            .then(round);
        });
      }

      return Flow.anim(Beats.rowIn(btn, { y: 10 }))
        .then(function () {
          quiet(Flow.wait(K.SHORT * 3).then(function () {
            if (!touched) stopHand = handNudge(picks[0].dd.face);
          }));
          return round();
        })
        .then(function () {
          off();
          burstAt(cells[r + ':45'].el);
          return Flow.wait(K.SHORT);
        })
        /* the row as the table keeps it: the blanks give way to the values */
        .then(function () {
          return Flow.anim(Beats.rowOut(btn, { remove: true }));
        })
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
    /* One value landing in its cell, and remembered. */
    fill: function (r, a, text) {
      var c = cells[r + ':' + a];
      filled[r + ':' + a] = text;
      focusRow(r);
      write(c.v, text);
      c.el.classList.add('is-filled', 'is-new');
      Beats.sfx('correct');
      return Flow.anim(Beats.popIn(c.v, { from: 0.4, d: 0.46 })).then(function () {
        return Flow.wait(K.SHORT);
      });
    },
    /* The three values of one angle, one after another. */
    fillColumn: function (a, vals) {
      return RATIOS.reduce(function (chain, r) {
        return chain.then(function () { return table.fill(r, a, vals[r]); });
      }, Promise.resolve()).then(function () { focusRow(null); });
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
   * are right, with the two blanks wearing their sides' inks.
   * ====================================================================== */
  var ROLE_OF = { wOpposite: 'opp', wAdjacent: 'adj', wHypotenuse: 'hyp' };
  function askRatio(row, spec) {
    var options = spec.options || ['wOpposite', 'wAdjacent', 'wHypotenuse'];
    var labels = options.map(function (k) { return T(k); });
    var dn = dropdown(row.hostA('n'), labels, options.indexOf(spec.num));
    var dd = dropdown(row.hostA('d'), labels, options.indexOf(spec.den), { up: false });
    [[dn, spec.num], [dd, spec.den]].forEach(function (pair) {
      pair[0].el.dataset.role = ROLE_OF[pair[1]];
    });
    function one(d) {
      var stop = null, opened = false;
      quiet(Flow.wait(K.SHORT * 3).then(function () {
        if (!opened && d.el.classList.contains('is-asking')) stop = handNudge(d.face);
      }));
      return d.ask({
        burst: false,
        onOpen: function () { opened = true; if (stop) stop(); },
        onWrong: function (i, name) { if (spec.onWrong) spec.onWrong(name); }
      }).then(function () {
        opened = true;
        if (stop) stop();
        d.el.classList.add('c-' + d.el.dataset.role);
      }, function (err) { opened = true; if (stop) stop(); throw err; });
    }
    return row.openA()
      .then(function () { return Flow.wait(K.SHORT); })
      .then(function () { return one(dn); })
      .then(function () { return Flow.wait(K.SHORT); })
      .then(function () { return one(dd); })
      .then(function () { return { num: dn, den: dd }; });
  }

  global.W = {
    pane: pane,
    eqRow: eqRow,
    askRatio: askRatio,
    dropdown: dropdown,
    pills: pills,
    button: button,
    fact: fact,
    slider: slider,
    handNudge: handNudge,
    handSlide: handSlide,
    handDrag: handDrag,
    waitPick: waitPick,
    burstAt: burstAt,
    table: table,
    h: h, svgEl: svgEl, write: write
  };
})(window);
