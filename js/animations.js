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
     grows from slightly small and slightly low, which is also what hides
     the mascot: the hero slot sits under the board on the --z ladder. */
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

  /* A word lit while it is spoken of: a slow breath, `times` over. */
  function textPulse(els, times) {
    var list = [].concat(els).filter(Boolean);
    function off() {
      list.forEach(function (m) {
        m.classList.remove('is-glowing-text');
        if (m.style) m.style.removeProperty('--pulse-times');
      });
    }
    var tl = M.timeline({ revert: off });
    tl.call(function () {
      list.forEach(function (m) {
        m.classList.remove('is-glowing-text');
        void m.getBoundingClientRect().width;
        if (m.style) m.style.setProperty('--pulse-times', String(times || 2));
        m.classList.add('is-glowing-text');
      });
    }, null, 0);
    tl.call(function () {}, null, M.gap(PULSE_SECS * (times || 2)));
    return tl;
  }

  /* A stroke swelling and settling, written into a timeline the caller
     owns: what lights a side once. */
  function swellTo(tl, paths, w, at) {
    tl.to(paths, { strokeWidth: w * 1.6, duration: M.dur(0.26), ease: 'power2.out' }, M.gap(at))
      .to(paths, { strokeWidth: w, duration: M.dur(0.5), ease: M.POP }, M.gap(at + 0.26));
  }
  var PART_W = 4;
  function linePulse(paths, w) {
    var list = [].concat(paths).filter(Boolean);
    var tl = M.timeline({ revert: function () { M.set(list, { clearProps: 'strokeWidth' }); } });
    swellTo(tl, list, w || PART_W, 0);
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

  /* The box, answered: the border turns green, the word pops in, the tick
     lands beside it, and the box gives one short pulse. */
  function boxRight(box) {
    box.g.classList.remove('is-wrong', 'is-over');
    box.g.classList.add('is-right');
    sfx('correct');

    M.set(box.text, { opacity: 0, scale: 0.7, transformOrigin: 'center center' });
    M.set(box.badge, { opacity: 1, scale: 0, transformOrigin: 'center center' });
    var tl = M.timeline({
      willChange: [box.text, box.badge], willChangeValue: 'transform, opacity'
    });
    tl.to(box.rect, { scale: 1.05, transformOrigin: 'center center',
                      duration: M.dur(0.14), ease: 'power2.out' }, 0)
      .to(box.rect, { scale: 1, duration: M.dur(0.3), ease: M.POP }, M.gap(0.14))
      .to(box.text, { opacity: 1, scale: 1, duration: M.dur(0.36), ease: 'back.out(1.7)' }, M.gap(0.06))
      .to(box.badge, { scale: 1, duration: M.dur(0.34), ease: M.POP }, M.gap(0.16));
    return tl;
  }

  /* The box, refused: it turns red and shakes its head, and holds the red
     for a beat before it is a plain box again. */
  var SHAKE = [-5, 5, -5, 5, -4, 4, 0];

  function boxWrong(box) {
    box.g.classList.remove('is-over');
    box.g.classList.add('is-wrong');
    sfx('wrong');

    var tl = M.timeline({
      willChange: box.g, willChangeValue: 'transform',
      revert: function () {
        box.g.classList.remove('is-wrong');
        M.set(box.g, { clearProps: 'transform' });
      }
    });
    var each = M.dur(0.3) / SHAKE.length;
    SHAKE.forEach(function (x, i) {
      tl.to(box.g, { x: x, duration: each,
                     ease: i === SHAKE.length - 1 ? 'power2.out' : 'none' });
    });
    tl.to({}, { duration: M.dur(0.5) });
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

  /* Where the bubble grows from: its tail. */
  var TAIL_X = 0.78 + 0.76 / 2;
  var TAIL_BORDER = 4;

  function tailOrigin(bubble) {
    var style = getComputedStyle(bubble);
    var em = parseFloat(style.fontSize) || 16;
    return (TAIL_BORDER + em * TAIL_X) + 'px 100%';
  }

  function bubbleArm(bubble) {
    bubble.removeAttribute('hidden');
    M.set(bubble, { opacity: 0, scale: 0.15, transformOrigin: tailOrigin(bubble) });
  }

  function bubbleIn(bubble) {
    var tl = M.timeline({ willChange: bubble, willChangeValue: 'transform, opacity' });
    tl.to(bubble, {
      opacity: 1, scale: 1, transformOrigin: tailOrigin(bubble),
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
      opacity: 0, scale: 0.9, transformOrigin: tailOrigin(bubble),
      duration: M.dur(0.24), ease: 'power2.in'
    });
    return tl;
  }

  /* ---- the mascot's jump (see mascotJumpIn in pages.js) ----------------- */
  function hopUp(hopper, y) {
    var tl = M.timeline({ willChange: hopper, willChangeValue: 'transform' });
    tl.to(hopper, { y: y, duration: M.dur(0.38), ease: 'power2.out' });
    return tl;
  }
  function hopDown(hopper, y) {
    var tl = M.timeline({ willChange: hopper, willChangeValue: 'transform' });
    tl.to(hopper, { y: y, duration: M.dur(0.36), ease: 'power2.in' });
    return tl;
  }
  function landOn(el, from) {
    var fall = Math.min(0.76, 0.32 + Math.abs(from) * 0.0005);
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, {
      y: 0, scaleX: 1.06, scaleY: 0.92,
      duration: M.dur(fall * 0.8), ease: 'power2.in'
    }).to(el, {
      scaleX: 1, scaleY: 1,
      duration: M.dur(fall * 0.2), ease: 'power2.out'
    });
    return tl;
  }
  function springOff(el, y) {
    var dip = el.getBoundingClientRect().height * 0.06;
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, {
      y: dip, scaleX: 1.06, scaleY: 0.92,
      duration: M.dur(0.14), ease: 'power2.in'
    }).to(el, {
      y: y, scaleX: 1, scaleY: 1,
      duration: M.dur(0.42), ease: 'power2.out'
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
    chipHome: chipHome,
    chipDock: chipDock,
    boxRight: boxRight,
    boxWrong: boxWrong,
    shakeWrong: shakeWrong,
    /* clearing up */
    clearFigure: clearFigure,
    /* text boxes and controls */
    bubbleArm: bubbleArm,
    bubbleIn: bubbleIn,
    bubbleOut: bubbleOut,
    hopUp: hopUp,
    hopDown: hopDown,
    landOn: landOn,
    springOff: springOff,
    lineOut: lineOut,
    controlIn: controlIn,
    controlOut: controlOut,
    welcomeOut: welcomeOut,
    rowIn: rowIn,
    rowOut: rowOut,
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
