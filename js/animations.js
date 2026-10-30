/* ==========================================================================
 * animations.js -- the beats this lesson is built out of, and its sound
 * --------------------------------------------------------------------------
 * Everything here returns a GSAP animation made through motion.js, so every
 * one of them is tracked: Skip lands them all on their last frame, and a
 * Replay kills them and hands back whatever they had written inline. Nothing
 * in this file decides WHEN it happens -- that is pages.js and the sections.
 *
 * Load order: js/motion.js -> js/flow.js -> js/animations.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var NS = 'http://www.w3.org/2000/svg';

  /* ======================================================================
   * Sound
   * ====================================================================== */
  var CLIPS = {
    click:   'assets/audio/button-click.webm',
    correct: 'assets/audio/correct-answer.webm',
    wrong:   'assets/audio/incorrect-answer.webm',
    cheer:   'assets/audio/confetti-sound.webm'
  };
  var A = global.GameAudio;
  var live = Object.create(null);     /* key -> the cue's sound still playing */

  /* How long a cue is LOUD, in ms -- a word said over the loud part is lost
     under it, so a line that follows a chime waits this out (see ringing). */
  var RING_MS = { correct: 600, wrong: 600 };
  var rang = Object.create(null);

  function sfx(key) {
    var src = CLIPS[key];
    if (!src || !A || !M || !M.mayPlay(key)) return;
    if (live[key]) live[key].stop();
    var h = live[key] = A.play(src, { keep: true });
    h.done.then(function () { if (live[key] === h) live[key] = null; });
    rang[key] = performance.now();
  }

  /* ms until every chime still ringing has quietened: 0 when none is. */
  function ringing() {
    var now = performance.now(), left = 0;
    Object.keys(RING_MS).forEach(function (k) {
      if (rang[k]) left = Math.max(left, rang[k] + RING_MS[k] - now);
    });
    return left;
  }

  /* The pop a mark makes as it lands: the click clip at a third of its
     volume and a touch off its own pitch each time. */
  var POP_GATE = 46;
  var popAt = 0;

  function pop() {
    var now = (global.performance && performance.now()) || Date.now();
    if (!A || (M && M.isMuted && M.isMuted())) return;
    if (now - popAt < POP_GATE) return;
    popAt = now;
    A.play(CLIPS.click, { keep: true, volume: 0.3, rate: 0.94 + Math.random() * 0.2 });
  }

  /* ======================================================================
   * Strokes -- the dash trick, shared by everything that draws a line
   * ====================================================================== */
  function pathLength(p) {
    try { return p.getTotalLength ? p.getTotalLength() : 0; } catch (e) { return 0; }
  }

  function stroke(tl, path, at, seconds, ease) {
    var len = pathLength(path) || 1;
    path.style.strokeDasharray = len + ' ' + len;
    path.style.strokeDashoffset = len;
    tl.to(path, {
      strokeDashoffset: 0,
      duration: M.dur(seconds),
      ease: ease || 'power2.out'
    }, M.gap(at));
  }

  /* A finished stroke is a plain solid one, so the pattern comes off the
     moment the timeline ends -- however it ends. */
  function undash(paths) {
    paths.forEach(function (p) {
      if (!p || !p.style) return;
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
    });
  }

  /* ======================================================================
   * The board
   * ====================================================================== */

  /* The board arriving. .show is the RESTING state -- opacity 1 in CSS --
     so the board ends up visible even if the tween below never runs. It
     grows from slightly small and slightly low. */
  function boardIn(board) {
    board.classList.add('is-animating');
    board.classList.add('show');
    board.setAttribute('aria-hidden', 'false');

    var tl = M.timeline({
      willChange: board, willChangeValue: 'transform, opacity',
      revert: function () {
        M.set(board, { clearProps: 'opacity,transform' });
        board.classList.remove('is-animating');
      }
    });
    tl.fromTo(board,
      { opacity: 0, scale: 0.965, y: 14 },
      { opacity: 1, scale: 1, y: 0, duration: M.dur(0.62), ease: 'power3.out' });
    return tl;
  }

  /* The board leaving: boardIn played back. */
  function boardOut(board) {
    board.classList.add('is-animating');
    var tl = M.timeline({
      willChange: board, willChangeValue: 'transform, opacity',
      revert: function () {
        board.classList.remove('show', 'is-animating');
        board.setAttribute('aria-hidden', 'true');
        M.set(board, { clearProps: 'opacity,transform' });
      }
    });
    tl.to(board, {
      opacity: 0, scale: 0.965, y: 14, duration: M.dur(0.5), ease: 'power2.in'
    });
    return tl;
  }

  /* ======================================================================
   * The triangle
   * ====================================================================== */

  /* A shape outlined by a pen. A pen-dot pops in at the path's start, the
     stroke unrolls out of it, and the dot rides the tip the whole way,
     then leaves as the outline closes. One plain stroke: the line itself
     is what the learner is meant to watch being made. */
  function drawOutline(path, tip, opts) {
    var o = opts || {};
    var len = pathLength(path) || 1;
    var x0 = parseFloat(tip.getAttribute('cx')) || 0;
    var y0 = parseFloat(tip.getAttribute('cy')) || 0;
    var START = 0.3;
    var time = o.time || 2.2;

    M.set(path, { opacity: 1 });
    M.set(tip, { opacity: 1, scale: 0, x: 0, y: 0, transformOrigin: 'center center' });

    var tl = M.timeline({
      revert: function () {
        undash([path]);
        M.set(tip, { clearProps: 'transform,opacity' });
      }
    });
    tl.to(tip, { scale: 1, duration: M.dur(0.26), ease: M.POP }, 0);
    tl.call(pop, null, 0);
    stroke(tl, path, START, time, 'power1.inOut');

    var pen = { t: 0 };
    tl.to(pen, {
      t: 1, duration: M.dur(time), ease: 'power1.inOut',
      onUpdate: function () {
        var p;
        try { p = path.getPointAtLength(len * pen.t); } catch (e) { return; }
        M.set(tip, { x: p.x - x0, y: p.y - y0 });
      }
    }, M.gap(START));
    tl.to(tip, { scale: 0, opacity: 0, duration: M.dur(0.24), ease: 'power2.in' },
          M.gap(START + time));
    return tl;
  }

  /* And then the colour goes in: it grows from just inside the outline,
     so the colour looks like it is being poured into a shape that was
     already there. */
  function fillShape(fill) {
    var tl = M.timeline({ willChange: fill, willChangeValue: 'transform, opacity' });
    tl.fromTo(fill,
      { opacity: 0, scale: 0.86, transformOrigin: 'center center' },
      { opacity: 1, scale: 1, duration: M.dur(0.55), ease: 'power2.out' });
    return tl;
  }

  /* A point going onto the diagram. `seconds` slows the pop for a point
     that is its own beat. */
  function plotDot(dot, seconds) {
    M.set(dot, { opacity: 1 });
    var tl = M.plotPoint(dot, null, { duration: seconds ? M.dur(seconds) : 0.3 });
    tl.call(pop, null, 0);
    return tl;
  }

  /* A segment, drawn from the start of its own path to its end. */
  function growLine(line, seconds, ease) {
    M.set(line, { opacity: 1 });
    var tl = M.timeline({ revert: function () { undash([line]); } });
    stroke(tl, line, 0, seconds || 0.55, ease || 'power2.out');
    return tl;
  }

  /* Several lines drawn one after another, each starting as the last
     finishes. */
  function growLines(lines, seconds, ease) {
    var tl = M.timeline({ revert: function () { undash(lines); } });
    var at = 0;
    lines.forEach(function (l) {
      M.set(l, { opacity: 1 });
      stroke(tl, l, at, seconds || 0.55, ease || 'power2.out');
      at += (seconds || 0.55) + 0.08;
    });
    return tl;
  }

  /* Marks taken off together and handed back to their resting state,
     which for every one of them is invisible. */
  function marksOut(els) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({
      willChange: list, willChangeValue: 'opacity',
      revert: function () { M.set(list, { clearProps: 'opacity' }); }
    });
    if (list.length) tl.to(list, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' });
    return tl;
  }

  /* Marks faded in together, and kept. */
  function marksIn(els, seconds) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    if (list.length) tl.to(list, { opacity: 1, duration: M.dur(seconds || 0.4), ease: 'power2.out' });
    return tl;
  }

  /* A word set on the figure landing the way every label in the figure
     lands, and a set of them taken away together. */
  function labelIn(text) {
    M.set(text, { opacity: 0, scale: 0.72, transformOrigin: 'center center' });
    var tl = M.timeline({ willChange: text, willChangeValue: 'transform, opacity' });
    tl.to(text, { opacity: 1, scale: 1, duration: M.dur(0.36), ease: 'back.out(1.7)' });
    tl.call(pop, null, 0);
    return tl;
  }
  function labelsOut(texts) {
    var list = [].concat(texts).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    if (list.length) tl.to(list, { opacity: 0, duration: M.dur(0.26), ease: 'power2.in' });
    return tl;
  }

  /* A label's words changed in place: the old word fades and shrinks a
     touch, the new one pops up where it stood. `write` rewrites the
     element between the two halves. */
  function relabel(el, write) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.to(el, { opacity: 0, scale: 0.8, transformOrigin: 'center center',
                duration: M.dur(0.2), ease: 'power2.in' }, 0);
    tl.call(write, null, M.gap(0.2));
    tl.to(el, { opacity: 1, scale: 1, duration: M.dur(0.34), ease: 'back.out(1.7)' }, M.gap(0.22));
    tl.call(pop, null, M.gap(0.22));
    return tl;
  }

  /* An element carried from where it stands to where another stands, as
     a transform -- for a word that moves from one corner of the triangle
     to another (θ), or a value that flies into its cell. `dx`, `dy` are
     measured by the caller. Left standing at its end; the caller rewrites
     the element's own position and clears the transform. */
  function travel(el, dx, dy, seconds) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, { x: dx, y: dy, duration: M.dur(seconds || 0.9), ease: 'power2.inOut' });
    return tl;
  }

  /* The pulse -- a mark lit while it is named. A CSS animation (it has to
     survive a beat being skipped without a tween to hold it), so all that
     is kept here is how long to leave the class on. */
  var PULSE_SECS = 1.05;
  var PULSE_TIMES = 3;

  function partPulse(marks, opts) {
    var o = opts || {};
    var times = o.times || PULSE_TIMES;
    var list = [].concat(marks).filter(Boolean);

    function off() {
      list.forEach(function (m) {
        m.classList.remove('is-pulsing');
        if (m.style) m.style.removeProperty('--pulse-times');
      });
    }

    var tl = M.timeline({ revert: off });
    tl.call(function () {
      list.forEach(function (m) {
        m.classList.remove('is-pulsing');
        void m.getBoundingClientRect().width;
        if (m.style) m.style.setProperty('--pulse-times', String(times));
        m.classList.add('is-pulsing');
      });
    }, null, 0);
    tl.call(function () {}, null, M.gap(PULSE_SECS * times));
    return tl;
  }

  /* The same pulse, held for as long as a beat leaves it on. */
  function pulseHold(marks) {
    [].concat(marks).filter(Boolean).forEach(function (mark) {
      mark.classList.remove('is-pulsing');
      void mark.getBoundingClientRect().width;
      mark.style.setProperty('--pulse-times', 'infinite');
      mark.classList.add('is-pulsing');
    });
  }

  function pulseRelease(marks) {
    var list = [].concat(marks).filter(Boolean);
    var tl = M.timeline({
      revert: function () {
        list.forEach(function (mark) { mark.style.filter = ''; });
        M.set(list, { clearProps: 'strokeWidth' });
      }
    });
    list.forEach(function (mark) {
      var now = parseFloat(getComputedStyle(mark).strokeWidth);
      mark.classList.remove('is-pulsing');
      mark.style.removeProperty('--pulse-times');
      var rest = parseFloat(getComputedStyle(mark).strokeWidth);
      mark.style.filter = 'url(#partGlow)';
      tl.fromTo(mark, { strokeWidth: now },
                { strokeWidth: rest, autoRound: false,
                  duration: M.dur(0.4), ease: 'power2.out' }, 0);
    });
    return tl;
  }

  /* A word lit while it is spoken of -- a length, an angle's measure: a
     gold halo round it (.is-glowing-text, the #hiGlow filter) and a swell
     and settle of its size, `times` over, so the eye is taken straight to
     it. A word beside a slanted side carries its turn as a transform
     attribute; it is handed back as it was when the light goes off. */
  var TEXT_SWELL = 1.32;
  var TEXT_BEAT = 0.7;
  function textPulse(els, times) {
    var list = [].concat(els).filter(Boolean);
    var n = times || 2;
    var turns = list.map(function (m) { return m.getAttribute ? m.getAttribute('transform') : null; });
    var tl = M.timeline({
      willChange: list, willChangeValue: 'transform',
      revert: function () {
        list.forEach(function (m, i) {
          m.classList.remove('is-glowing-text');
          M.set(m, { clearProps: 'transform' });
          if (turns[i]) m.setAttribute('transform', turns[i]);
        });
      }
    });
    tl.call(function () {
      list.forEach(function (m) { m.classList.add('is-glowing-text'); });
    }, null, 0);
    for (var i = 0; i < n; i++) {
      tl.to(list, { scale: TEXT_SWELL, transformOrigin: 'center center',
                    duration: M.dur(0.26), ease: 'power2.out' }, M.gap(i * TEXT_BEAT))
        .to(list, { scale: 1, duration: M.dur(0.44), ease: 'power2.inOut' }, M.gap(i * TEXT_BEAT + 0.26));
    }
    tl.to({}, { duration: M.dur(0.3) });
    return tl;
  }

  /* A stroke swelling and settling, written into a timeline the caller
     owns: what lights a side once. */
  var LINE_SWELL = 2.1;
  function swellTo(tl, paths, w, at) {
    tl.to(paths, { strokeWidth: w * LINE_SWELL, duration: M.dur(0.24), ease: 'power2.out' }, M.gap(at))
      .to(paths, { strokeWidth: w, duration: M.dur(0.38), ease: 'power2.inOut' }, M.gap(at + 0.24));
  }
  /* A side -- or an arc, or the right angle's square -- lit while it is
     spoken of: its own ink bloomed under it (.is-lit, #partGlow) and the
     stroke swelling and settling twice, so it is plainly picked out of the
     triangle, then let go. `w` is the stroke's resting width. A mark lit
     already (a corner in hand) keeps its light. */
  var PART_W = 4;
  function linePulse(paths, w) {
    var list = [].concat(paths).filter(Boolean);
    var lit = list.filter(function (p) { return !p.classList.contains('is-lit'); });
    var tl = M.timeline({
      revert: function () {
        lit.forEach(function (p) { p.classList.remove('is-lit'); });
        M.set(list, { clearProps: 'strokeWidth' });
      }
    });
    tl.call(function () { lit.forEach(function (p) { p.classList.add('is-lit'); }); }, null, 0);
    swellTo(tl, list, w || PART_W, 0);
    swellTo(tl, list, w || PART_W, 0.62);
    tl.to({}, { duration: M.dur(0.35) });
    return tl;
  }

  /* A name's box lit with the side it names: it swells and settles twice
     in step with linePulse, its border bloomed. */
  function boxPulse(box) {
    var tl = M.timeline({
      willChange: box.g, willChangeValue: 'transform',
      revert: function () {
        box.g.classList.remove('is-lit');
        M.set(box.g, { clearProps: 'transform' });
      }
    });
    tl.call(function () { box.g.classList.add('is-lit'); }, null, 0);
    [0, 0.62].forEach(function (at) {
      tl.to(box.g, { scale: 1.1, transformOrigin: 'center center',
                     duration: M.dur(0.24), ease: 'power2.out' }, M.gap(at))
        .to(box.g, { scale: 1, duration: M.dur(0.38), ease: 'power2.inOut' }, M.gap(at + 0.24));
    });
    tl.to({}, { duration: M.dur(0.35) });
    return tl;
  }

  /* A value carried out of the picture into the working: a copy of it
     lifts off the label it is read from (`from`, on the figure), flies in
     a shallow arc to the slot it fills (`to`, in the pane) -- growing or
     shrinking from the label's size to the slot's -- and the slot takes
     over from it as it lands. The slot is written already and waits
     invisible; where it is is read every frame, so a column still gliding
     to its place round it is followed, not missed.
       Or the other way: an answer worked out in the pane carried back
     onto the picture, `to` a word on the figure. The copy then lands at
     the size the word is drawn at and in its fill, and the word is left
     showing -- a figure's words rest invisible, so its opacity is not
     simply handed back. */
  var FLY_LIFT = 46;          /* px the arc rises at its middle */
  function flyTo(from, to, text) {
    var copy = document.createElement('span');
    copy.className = 'fly-copy';
    copy.setAttribute('aria-hidden', 'true');
    if (global.MathText) global.MathText.write(copy, text);
    else copy.textContent = text;
    var onFigure = !!global.SVGElement && to instanceof global.SVGElement;
    var cs = getComputedStyle(to);
    var px = parseFloat(cs.fontSize);
    var ctm = onFigure && to.getScreenCTM ? to.getScreenCTM() : null;
    if (ctm) px *= Math.sqrt(ctm.a * ctm.a + ctm.b * ctm.b);
    copy.style.fontSize = px + 'px';
    copy.style.color = onFigure ? cs.fill : cs.color;
    document.body.appendChild(copy);
    M.set(to, { opacity: 0 });

    function centre(el) {
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height };
    }
    var a = centre(from);
    var box = copy.getBoundingClientRect();
    var w = box.width || 1, h = box.height || 1;
    var k0 = Math.max(0.5, Math.min(2.5, a.h / h));
    var p = { t: 0 };
    function place() {
      var b = centre(to), e = p.t;
      M.set(copy, {
        x: a.x + (b.x - a.x) * e - w / 2,
        y: a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * FLY_LIFT - h / 2,
        scale: k0 + (1 - k0) * e
      });
    }
    M.set(copy, { opacity: 0, transformOrigin: '50% 50%' });
    place();

    var tl = M.timeline({
      willChange: copy, willChangeValue: 'transform, opacity',
      revert: function () {
        if (copy.parentNode) copy.parentNode.removeChild(copy);
        M.set(to, onFigure ? { opacity: 1 } : { clearProps: 'opacity' });
      }
    });
    tl.to(copy, { opacity: 1, duration: M.dur(0.18), ease: 'power2.out' }, 0);
    tl.to(p, { t: 1, duration: M.dur(0.8), ease: 'power2.inOut', onUpdate: place }, M.gap(0.12));
    tl.call(function () {
      M.set(to, { opacity: 1 });
      M.set(copy, { opacity: 0 });
      pop();
    }, null, M.gap(0.92));
    return tl;
  }

  /* The figure, or a group of it, carried to one side of the board, or
     back: a slide of the whole group, so nothing in it moves relative to
     anything else. */
  function slideGroup(group, x, seconds) {
    var tl = M.timeline({ willChange: group, willChangeValue: 'transform' });
    tl.to(group, { x: x, duration: M.dur(seconds || 0.8), ease: 'power2.inOut' });
    return tl;
  }

  /* A group carried to a place and scale at once, about a stated origin
     (the picture's own units through svgOrigin). */
  function moveGroup(group, vars, seconds) {
    var tl = M.timeline({ willChange: group, willChangeValue: 'transform' });
    tl.to(group, M.dur ? Object.assign({ duration: M.dur(seconds || 0.8), ease: 'power2.inOut' }, vars) : vars);
    return tl;
  }

  /* Two halves of a shape parted a little, and the gap between them read
     as a cut: each slides out along `away[i]`. */
  function splitApart(groups, away) {
    var tl = M.timeline({ willChange: groups, willChangeValue: 'transform' });
    groups.forEach(function (g, i) {
      tl.to(g, { x: away[i].x, y: away[i].y, duration: M.dur(0.6), ease: 'power2.out' }, 0);
    });
    tl.call(pop, null, 0);
    return tl;
  }

  /* The light held on a part: a blurred copy of itself under it (the
     #partGlow filter), breathing as a CSS class. */
  function glowOn(el) { el.classList.add('is-lit'); }
  function glowOff(el) { el.classList.remove('is-lit'); }

  /* A dashed line drawn out: the mask trick -- a solid path inside a mask
     uncovers the dashed one as it is stroked. */
  function dashedIn(line, mask, seconds) {
    M.set(line, { opacity: 1 });
    var tl = M.timeline({ revert: function () { undash([mask]); } });
    stroke(tl, mask, 0, seconds || 0.6, 'power1.inOut');
    return tl;
  }

  /* ======================================================================
   * The activity -- name the parts
   * ====================================================================== */

  /* One box, arriving on the part it will name: the dashed line draws
     itself out from the box's edge to the part, and the box lands at the
     other end of it. */
  function boxIn(box) {
    var parts = [box.g, box.leader];
    var tl = M.timeline({ revert: function () { undash([box.mask]); } });

    M.set(box.leader, { opacity: 1 });
    stroke(tl, box.mask, 0.14, 0.52, 'power1.inOut');
    tl.fromTo(box.g,
      { opacity: 0, scale: 0.72, transformOrigin: 'center center' },
      { opacity: 1, scale: 1, duration: M.dur(0.44), ease: M.POP }, M.gap(0.52));
    tl.call(pop, null, M.gap(0.52));

    tl.call(function () {
      parts.forEach(function (e) { e.classList.add('is-shown'); });
      M.set(parts, { clearProps: 'opacity' });
    });
    return tl;
  }

  /* The box, its line and the marks it names standing back. */
  var PART_DIM = 0.3;
  function dimPair(box, marks) {
    var tl = M.timeline({ willChange: marks, willChangeValue: 'opacity' });
    tl.call(function () {
      [box.g, box.leader].forEach(function (e) { e.classList.add('is-quiet'); });
    }, null, 0);
    if (marks && marks.length) {
      tl.to(marks, { opacity: PART_DIM, duration: M.dur(0.55), ease: 'power2.inOut' }, 0);
    }
    return tl;
  }

  /* Every part back to full, together. */
  function showParts(marks) {
    var tl = M.timeline({ willChange: marks, willChangeValue: 'opacity' });
    tl.to(marks, {
      opacity: 1, duration: M.dur(0.7), ease: 'power2.inOut', stagger: M.gap(0.05)
    });
    return tl;
  }

  /* What the learner has to reach for, arriving in a band and leaving it. */
  function trayIn(tray, chips) {
    tray.removeAttribute('hidden');
    var tl = M.timeline({ willChange: chips, willChangeValue: 'transform, opacity' });
    tl.fromTo(chips,
      { opacity: 0, y: 14, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(0.36), ease: M.POP,
        stagger: M.gap(0.08) });
    return tl;
  }
  function trayOut(tray, chips) {
    var tl = M.timeline({
      willChange: chips, willChangeValue: 'transform, opacity',
      revert: function () { tray.setAttribute('hidden', ''); }
    });
    if (chips.length) {
      tl.to(chips, {
        opacity: 0, y: 10, duration: M.dur(0.26), ease: 'power2.in',
        stagger: M.gap(0.03)
      });
    }
    return tl;
  }

  /* An answer pressed: one outward pulse for the right answer, a head-shake
     for the wrong one. The colour each one takes is its own class. */
  function choiceRight(btn) {
    btn.classList.remove('is-wrong');
    btn.classList.add('is-right');
    sfx('correct');
    return M.correct(btn);
  }
  function choiceWrong(btn) {
    btn.classList.add('is-wrong');
    sfx('wrong');
    return M.incorrect(btn);
  }
  /* A refused answer, spent: it fades back, so it plainly cannot be
     pressed again and the eye is left on the rest. */
  var SPENT_ALPHA = 0.38;
  function choiceOut(btn) {
    return M.to(btn, { opacity: SPENT_ALPHA, duration: M.dur(0.3), ease: 'power2.out' });
  }

  /* A name let go of somewhere that is not its box: back to the tray. */
  function chipHome(chip) {
    return M.to(chip, {
      x: 0, y: 0, scale: 1, duration: M.dur(0.36), ease: 'power3.out',
      overwrite: 'auto'
    });
  }

  /* A name dropped in the right box: it flies the rest of the way into
     the box and shrinks out as the word is set inside. */
  function chipDock(chip, dx, dy) {
    var x = gsap.getProperty(chip, 'x') || 0;
    var y = gsap.getProperty(chip, 'y') || 0;
    return M.to(chip, {
      x: x + dx, y: y + dy, scale: 0.55, opacity: 0,
      duration: M.dur(0.4), ease: 'power2.inOut', overwrite: 'auto',
      onComplete: function () {
        chip.classList.add('is-docked');
        M.set(chip, { clearProps: 'transform,opacity' });
      }
    });
  }

  /* The box, answered: the border turns green, the word pops in, and the
     box gives one short pulse. The green border is the verdict; there is
     no tick. */
  function boxRight(box) {
    box.g.classList.remove('is-wrong', 'is-over');
    box.g.classList.add('is-right');
    sfx('correct');

    M.set(box.text, { opacity: 0, scale: 0.7, transformOrigin: 'center center' });
    var tl = M.timeline({ willChange: box.text, willChangeValue: 'transform, opacity' });
    tl.to(box.rect, { scale: 1.05, transformOrigin: 'center center',
                      duration: M.dur(0.14), ease: 'power2.out' }, 0)
      .to(box.rect, { scale: 1, duration: M.dur(0.3), ease: M.POP }, M.gap(0.14))
      .to(box.text, { opacity: 1, scale: 1, duration: M.dur(0.36), ease: 'back.out(1.7)' }, M.gap(0.06));
    return tl;
  }

  /* The box, refused: the wrong name written in it pops in, and the box
     turns red and shakes its head. The red and the name stay -- held there
     while it is said to be wrong -- until boxFree gives them back. */
  var SHAKE = [-5, 5, -5, 5, -4, 4, 0];

  function boxWrong(box) {
    box.g.classList.remove('is-over');
    box.g.classList.add('is-wrong');
    sfx('wrong');

    M.set(box.text, { opacity: 0, scale: 0.7, transformOrigin: 'center center' });
    var tl = M.timeline({
      willChange: [box.g, box.text], willChangeValue: 'transform, opacity',
      revert: function () { M.set(box.g, { clearProps: 'transform' }); }
    });
    tl.to(box.text, { opacity: 1, scale: 1, duration: M.dur(0.36), ease: 'back.out(1.7)' }, M.gap(0.06));
    var each = M.dur(0.3) / SHAKE.length;
    SHAKE.forEach(function (x, i) {
      tl.to(box.g, { x: x, duration: each,
                     ease: i === SHAKE.length - 1 ? 'power2.out' : 'none' }, i * each);
    });
    return tl;
  }
  /* ...and given back: the wrong name goes out of the box with the red,
     and is lifted out and carried back to its place in the tray -- from
     `at`, the box, in the chip's own moves. */
  function boxFree(box, chip, at) {
    box.g.classList.remove('is-wrong');
    chip.classList.remove('is-docked');
    var tl = M.timeline({
      willChange: [box.text, chip], willChangeValue: 'transform, opacity',
      revert: function () {
        if (!box.g.classList.contains('is-right')) box.text.textContent = '';
      }
    });
    tl.to(box.text, { opacity: 0, scale: 0.7, duration: M.dur(0.2), ease: 'power2.in' }, 0)
      .fromTo(chip, { x: at.x, y: at.y, scale: 0.55, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: M.dur(0.4), ease: 'power2.out',
          overwrite: 'auto' }, M.gap(0.08));
    return tl;
  }

  /* A head-shake on any element, with the red held for a beat -- a table
     cell pressed in the wrong place, a slider let go short of its mark. */
  function shakeWrong(el) {
    el.classList.add('is-wrong');
    sfx('wrong');
    var tl = M.timeline({
      willChange: el, willChangeValue: 'transform',
      revert: function () {
        el.classList.remove('is-wrong');
        M.set(el, { clearProps: 'transform' });
      }
    });
    var each = M.dur(0.3) / SHAKE.length;
    SHAKE.forEach(function (x, i) {
      tl.to(el, { x: x, duration: each, ease: i === SHAKE.length - 1 ? 'power2.out' : 'none' });
    });
    tl.to({}, { duration: M.dur(0.5) });
    return tl;
  }

  /* ======================================================================
   * Clearing up
   * ====================================================================== */

  /* Everything on the figure, taken off it together: one fade. */
  function clearFigure(parts) {
    var list = [].concat(parts).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    if (list.length) {
      /* the stagger is capped so a wipe of many marks is still one short
         fade, not a slow roll across the board */
      tl.to(list, { opacity: 0, duration: M.dur(0.36), ease: 'power2.in',
                    stagger: M.gap(Math.min(0.04, 0.5 / list.length)) });
    }
    return tl;
  }

  /* ======================================================================
   * Text boxes and controls
   * ====================================================================== */

  /* The speech bubble grows out of its tail -- out of the bird's beak --
     and shrinks back into it. */
  var BUBBLE_ORIGIN = '0% 72%';
  function bubbleArm(bubble) {
    bubble.removeAttribute('hidden');
    M.set(bubble, { opacity: 0, scale: 0.15, transformOrigin: BUBBLE_ORIGIN });
  }

  function bubbleIn(bubble) {
    var tl = M.timeline({ willChange: bubble, willChangeValue: 'transform, opacity' });
    tl.to(bubble, {
      opacity: 1, scale: 1, transformOrigin: BUBBLE_ORIGIN,
      duration: M.dur(0.44), ease: 'back.out(1.6)'
    });
    return tl;
  }
  function bubbleOut(bubble) {
    var tl = M.timeline({
      willChange: bubble, willChangeValue: 'transform, opacity',
      revert: function () {
        bubble.setAttribute('hidden', '');
        M.set(bubble, { clearProps: 'opacity,transform' });
      }
    });
    tl.to(bubble, {
      opacity: 0, scale: 0.9, transformOrigin: BUBBLE_ORIGIN,
      duration: M.dur(0.24), ease: 'power2.in'
    });
    return tl;
  }

  /* The bird beside the bubble: out of sight while the bubble arms, then
     up onto its mark, squashing on its feet as it lands. It leaves with
     the bubble, so it has no way out of its own. */
  function birdArm(bird) {
    M.set(bird, { opacity: 0, yPercent: 30, transformOrigin: '50% 88%' });
  }
  function birdIn(bird) {
    var tl = M.timeline({ willChange: bird, willChangeValue: 'transform, opacity' });
    tl.to(bird, { opacity: 1, duration: M.dur(0.2), ease: 'power2.out' }, 0);
    tl.to(bird, {
      yPercent: 0, scaleX: 0.94, scaleY: 1.06,
      duration: M.dur(0.32), ease: 'power2.out'
    }, 0).to(bird, {
      scaleX: 1.06, scaleY: 0.94, duration: M.dur(0.12), ease: 'power2.in'
    }).to(bird, {
      scaleX: 1, scaleY: 1, duration: M.dur(0.24), ease: 'back.out(2)'
    });
    return tl;
  }

  /* A line in the board header, taken away: the words leave together. */
  function lineOut(line) {
    var tl = M.timeline({ willChange: line, willChangeValue: 'transform, opacity' });
    tl.to(line, {
      opacity: 0, y: -8, filter: 'blur(3px)',
      duration: M.dur(0.28), ease: 'power2.in'
    });
    return tl;
  }

  /* A control arriving in its corner, and leaving it. */
  function controlIn(btn) {
    btn.removeAttribute('hidden');
    var tl = M.timeline({ willChange: btn, willChangeValue: 'transform, opacity' });
    tl.fromTo(btn,
      { opacity: 0, scale: 0.7, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: M.dur(0.38), ease: 'back.out(1.6)' });
    return tl;
  }
  function controlOut(btn) {
    var tl = M.timeline({
      willChange: btn, willChangeValue: 'transform, opacity',
      revert: function () {
        btn.setAttribute('hidden', '');
        M.set(btn, { clearProps: 'transform,opacity' });
      }
    });
    tl.to(btn, {
      opacity: 0, scale: 0.8, duration: M.dur(0.2), ease: 'power2.in',
      overwrite: 'auto'
    });
    return tl;
  }

  /* The welcome screen standing aside. */
  function welcomeOut(welcome, title, start) {
    var tl = M.timeline({
      willChange: [title, start], willChangeValue: 'transform, opacity',
      revert: function () { welcome.setAttribute('hidden', ''); }
    });
    start.classList.remove('in');
    tl.to([title, start], {
      opacity: 0, y: -14, scale: 0.94,
      duration: M.dur(0.3), ease: 'power2.in', stagger: M.gap(0.05)
    }, 0);
    tl.to(welcome, { opacity: 0, duration: M.dur(0.34), ease: 'power2.in' }, 0.08);
    return tl;
  }

  /* ---- the right pane's rows ---------------------------------------------
     A row of the working arriving: it fades and rises into place, as a
     card does. Several arrive one after another with `stagger`. And away. */
  function rowIn(els, opts) {
    var o = opts || {};
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    tl.fromTo(list,
      { opacity: 0, y: o.y == null ? 14 : o.y, scale: o.scale == null ? 0.96 : o.scale },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(o.d || 0.46), ease: 'power3.out',
        stagger: M.gap(o.stagger == null ? 0.14 : o.stagger) });
    return tl;
  }
  function rowOut(els, opts) {
    var o = opts || {};
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({
      willChange: list, willChangeValue: 'transform, opacity',
      revert: function () {
        if (o.remove) list.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
        if (o.hide) list.forEach(function (e) { e.setAttribute('hidden', ''); });
      }
    });
    if (list.length) {
      tl.to(list, { opacity: 0, y: -10, scale: 0.98, duration: M.dur(0.3), ease: 'power2.in',
                    stagger: M.gap(o.stagger == null ? 0.05 : o.stagger) });
    }
    return tl;
  }

  /* A line of working written in (W.working): its terms one after another,
     left to right, each rising a little into place as it fades up -- the
     pace of a hand writing it on the board. */
  function writeIn(els, opts) {
    var o = opts || {};
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    if (!list.length) return tl;
    tl.fromTo(list,
      { opacity: 0, y: 10, scale: 0.9, transformOrigin: 'center bottom' },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(o.d || 0.34), ease: 'power3.out',
        stagger: M.gap(o.stagger == null ? 0.09 : o.stagger) });
    tl.call(pop, null, 0);
    return tl;
  }

  /* A value or a word landing in a slot of the working: the pop every
     label in the game lands with, in HTML. */
  function popIn(el, opts) {
    var o = opts || {};
    var list = [].concat(el).filter(Boolean);
    M.set(list, { opacity: 0, scale: o.from == null ? 0.6 : o.from, transformOrigin: 'center center' });
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    tl.to(list, { opacity: 1, scale: 1, duration: M.dur(o.d || 0.42), ease: M.POP,
                  stagger: M.gap(o.stagger || 0) });
    tl.call(pop, null, 0);
    return tl;
  }

  /* Words in a slot changed for others in the same place -- the side's
     name giving way to its length. */
  function swapIn(el, write) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.to(el, { opacity: 0, y: -6, duration: M.dur(0.2), ease: 'power2.in' }, 0);
    tl.call(write, null, M.gap(0.2));
    tl.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: M.dur(0.32), ease: 'power2.out' }, M.gap(0.22));
    return tl;
  }

  /* A slot's answer, confirmed: one outward pulse with the chime. */
  function slotRight(el) {
    el.classList.remove('is-wrong');
    el.classList.add('is-right');
    sfx('correct');
    return M.correct(el);
  }

  /* ---- the hand: a nudge that shows the gesture being asked for --------
     Both loops are endless, since nobody knows how long the learner will
     take, so their timings are the clock's and not M.dur's, and they are
     marked so Skip leaves them be. */
  var NUDGE_ON = 0.92;
  var NUDGE_REST = 16, NUDGE_TOUCH = 1.5;
  var NUDGE_SWELL = 1.22;

  function nudgeTap(hand, put, ripple) {
    var p = { s: 1 };
    var q = { k: 0.7, a: 0 };
    function move() { put(p.s); }
    function wave() { if (ripple) ripple(q.k, q.a); }
    move(); wave();
    var tl = M.timeline({
      revert: function () {
        M.set(hand, { clearProps: 'opacity' });
        q.a = 0; wave();
      }
    });
    if (M.reducedMotion()) {
      M.set(hand, { opacity: NUDGE_ON });
      q.k = 1; q.a = 0.8; wave();
      return tl;
    }
    tl.__motionEndless = true;
    tl.call(function () { p.s = 1; q.k = 0.7; q.a = 0; move(); wave(); }, null, 0);
    tl.to(hand, { opacity: NUDGE_ON, duration: 0.3, ease: 'power2.out' }, 0);
    [0.35, 1.05].forEach(function (at) {
      tl.to(p, { s: NUDGE_SWELL, duration: 0.22, ease: 'power2.out', onUpdate: move }, at)
        .to(p, { s: 1, duration: 0.36, ease: 'power2.inOut', onUpdate: move }, at + 0.22);
      tl.fromTo(q, { k: 0.7, a: 0.9 },
        { k: 1.15, a: 0, duration: 0.62, ease: 'power2.out', onUpdate: wave }, at);
    });
    tl.to(hand, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 1.85);
    tl.to({}, { duration: 0.7 });
    tl.repeat(-1);
    return tl;
  }

  /* Carry it there: the hand fades in over the start, presses down, slides
     to the mark -- `put(t, gap)` places it for t from 0 to 1 -- lifts, and
     fades; then again. */
  function nudgeSlide(hand, put) {
    var p = { t: 0, g: NUDGE_REST };
    function move() { put(p.t, p.g); }
    move();
    var tl = M.timeline({ revert: function () { M.set(hand, { clearProps: 'opacity' }); } });
    if (M.reducedMotion()) {
      p.t = 0.5; p.g = NUDGE_TOUCH; move();
      M.set(hand, { opacity: NUDGE_ON });
      return tl;
    }
    tl.__motionEndless = true;
    tl.call(function () { p.t = 0; p.g = NUDGE_REST; move(); }, null, 0);
    tl.to(hand, { opacity: NUDGE_ON, duration: 0.3, ease: 'power2.out' }, 0);
    tl.to(p, { g: NUDGE_TOUCH, duration: 0.24, ease: 'power2.in', onUpdate: move }, 0.2);
    tl.to(p, { t: 1, duration: 1.3, ease: 'power1.inOut', onUpdate: move }, 0.5);
    tl.to(p, { g: NUDGE_REST, duration: 0.24, ease: 'power2.out', onUpdate: move }, 1.85);
    tl.to(hand, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 1.9);
    tl.to({}, { duration: 0.65 });
    tl.repeat(-1);
    return tl;
  }

  function nudgeStop(tl, hand) {
    if (tl) tl.kill();
    return M.to(hand, { opacity: 0, duration: M.dur(0.22), ease: 'power2.in', overwrite: 'auto' });
  }

  /* ======================================================================
   * Celebration
   * ====================================================================== */
  var BURST_N = 14;
  var HUES = ['blue', 'teal', 'indigo', 'rose', 'amber'];

  /* A dozen or so small pieces put down on the spot -- `x`, `y` in the
     host's units -- thrown outward and up, each turning as it goes,
     slowing, and falling a little as it fades. */
  function confetti(host, x, y) {
    var bits = [];
    for (var i = 0; i < BURST_N; i++) {
      var round = i % 3 === 0;
      var size = 5 + Math.random() * 4;
      var el = document.createElementNS(NS, round ? 'circle' : 'rect');
      el.setAttribute('class', 'qz-bit qz-bit--' + HUES[i % HUES.length]);
      if (round) {
        el.setAttribute('cx', x); el.setAttribute('cy', y); el.setAttribute('r', size / 2);
      } else {
        el.setAttribute('x', x - size / 2); el.setAttribute('y', y - size * 0.3);
        el.setAttribute('width', size); el.setAttribute('height', size * 0.6);
        el.setAttribute('rx', 1);
      }
      host.appendChild(el);
      bits.push(el);
    }
    var tl = M.timeline({
      revert: function () {
        bits.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
      }
    });
    if (M.reducedMotion()) return tl;
    bits.forEach(function (b, i) {
      var ang = (i / BURST_N) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      var dist = 58 + Math.random() * 52;
      var dx = Math.cos(ang) * dist;
      var dy = -Math.abs(Math.sin(ang)) * dist * 0.9 - 14;
      var spin = (Math.random() - 0.5) * 540;
      M.set(b, { transformOrigin: 'center center' });
      tl.to(b, { x: dx, y: dy, rotation: spin, duration: M.dur(0.55), ease: 'power2.out' }, 0)
        .to(b, { y: dy + 36 + Math.random() * 20, duration: M.dur(0.5), ease: 'power1.in' }, M.gap(0.5))
        .to(b, { opacity: 0, scale: 0.5, duration: M.dur(0.4), ease: 'power2.in' }, M.gap(0.62));
    });
    return tl;
  }

  /* The light shower: an activity finished. A few dozen small pieces drift
     down over the board from its top edge and fade before they reach the
     bottom. */
  var RAIN_N = 30;

  function confettiRain(host) {
    var layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    host.appendChild(layer);
    var remove = function () { if (layer.parentNode) layer.parentNode.removeChild(layer); };

    var w = layer.clientWidth, h = layer.clientHeight;
    if (M.reducedMotion() || !w || !h) {
      remove();
      return M.timeline();
    }

    var bits = [];
    var plan = [];
    for (var i = 0; i < RAIN_N; i++) {
      var el = document.createElement('span');
      el.className = 'confetti__bit confetti__bit--' + HUES[i % HUES.length] +
                     (i % 3 === 0 ? ' confetti__bit--round' : '');
      layer.appendChild(el);
      bits.push(el);
      var fall = 1.5 + Math.random() * 0.7;
      plan.push({
        x: (i + Math.random()) / RAIN_N * w,
        sway: (Math.random() - 0.5) * 70,
        drop: h * (0.5 + Math.random() * 0.35),
        turn: (Math.random() - 0.5) * 720,
        delay: Math.random() * 0.4,
        fall: fall
      });
    }

    var tl = M.timeline({ willChange: bits, revert: remove });
    bits.forEach(function (b, n) {
      var p = plan[n];
      M.set(b, { x: p.x, y: -16, rotation: p.turn / 4, opacity: 1 });
      tl.to(b, { y: p.drop, duration: M.dur(p.fall), ease: 'power1.in' }, M.gap(p.delay))
        .to(b, { x: p.x + p.sway, rotation: p.turn, duration: M.dur(p.fall), ease: 'sine.inOut' },
            M.gap(p.delay))
        .to(b, { opacity: 0, duration: M.dur(p.fall * 0.4), ease: 'power2.in' },
            M.gap(p.delay + p.fall * 0.6));
    });
    return tl;
  }

  /* ---- the figure's own speed ------------------------------------------- */
  var figSpeed = 1;
  function figure(beat) {
    return function () {
      var tl = beat.apply(null, arguments);
      if (figSpeed !== 1 && tl && typeof tl.timeScale === 'function') tl.timeScale(figSpeed);
      return tl;
    };
  }
  var FIGURE_BEATS = [
    'drawOutline', 'fillShape', 'plotDot', 'growLine', 'growLines', 'marksOut', 'marksIn',
    'labelIn', 'labelsOut', 'relabel', 'travel', 'slideGroup', 'moveGroup',
    'splitApart', 'dashedIn', 'linePulse', 'boxIn', 'dimPair', 'showParts', 'clearFigure'
  ];

  global.Beats = {
    figureSpeed: function (s) { figSpeed = s > 0 ? s : 1; },
    sfx: sfx,
    sounds: function () { return Object.keys(CLIPS).map(function (k) { return CLIPS[k]; }); },
    ringing: ringing,
    pop: pop,
    boardIn: boardIn,
    boardOut: boardOut,
    /* the triangle */
    drawOutline: drawOutline,
    fillShape: fillShape,
    plotDot: plotDot,
    growLine: growLine,
    growLines: growLines,
    marksOut: marksOut,
    marksIn: marksIn,
    labelIn: labelIn,
    labelsOut: labelsOut,
    relabel: relabel,
    travel: travel,
    partPulse: partPulse,
    pulseHold: pulseHold,
    pulseRelease: pulseRelease,
    textPulse: textPulse,
    linePulse: linePulse,
    boxPulse: boxPulse,
    flyTo: flyTo,
    slideGroup: slideGroup,
    moveGroup: moveGroup,
    splitApart: splitApart,
    glowOn: glowOn,
    glowOff: glowOff,
    dashedIn: dashedIn,
    /* the activity */
    boxIn: boxIn,
    dimPair: dimPair,
    showParts: showParts,
    trayIn: trayIn,
    trayOut: trayOut,
    choiceRight: choiceRight,
    choiceWrong: choiceWrong,
    choiceOut: choiceOut,
    chipHome: chipHome,
    chipDock: chipDock,
    boxRight: boxRight,
    boxWrong: boxWrong,
    boxFree: boxFree,
    shakeWrong: shakeWrong,
    /* clearing up */
    clearFigure: clearFigure,
    /* text boxes and controls */
    bubbleArm: bubbleArm,
    bubbleIn: bubbleIn,
    bubbleOut: bubbleOut,
    birdArm: birdArm,
    birdIn: birdIn,
    lineOut: lineOut,
    controlIn: controlIn,
    controlOut: controlOut,
    welcomeOut: welcomeOut,
    rowIn: rowIn,
    rowOut: rowOut,
    writeIn: writeIn,
    popIn: popIn,
    swapIn: swapIn,
    slotRight: slotRight,
    nudgeTap: nudgeTap,
    nudgeSlide: nudgeSlide,
    nudgeStop: nudgeStop,
    /* celebration */
    confetti: confetti,
    confettiRain: confettiRain
  };
  FIGURE_BEATS.forEach(function (name) {
    global.Beats[name] = figure(global.Beats[name]);
  });
})(window);
