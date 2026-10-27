/* ==========================================================================
 * s4-sixty.js -- Section 4: 60° as the reference angle
 * --------------------------------------------------------------------------
 * Storyboard pages 52-57. Two scenes:
 *
 *   The 60° angle.  The same half-equilateral triangle, with its lengths
 *     1, √3 and 2 and both acute angles. "Let's use 60° as our reference
 *     angle this time." -- the 60° angle lights and the 30° one stands
 *     back. "Now √3 is opposite and 1 is adjacent. The hypotenuse is still
 *     2." -- the names go on beside the lengths. The triangle stands aside;
 *     sin 60° is worked, cos 60° and tan 60° are the learner's. Next.
 *   The table.  The 60° values go in. Next.
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion, Flow = global.Flow, Beats = global.Beats;
  var Pages = global.Pages, Tri = global.Tri, W = global.W, S3 = global.S3;
  if (!Pages || !Tri || !W || !S3) { console.error('s4-sixty.js: load pages.js, tri.js, widgets.js and s3-thirty.js first.'); return; }
  var K = Pages.kit;
  var BEAT = K.BEAT, SHORT = K.SHORT;
  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  var quiet = K.quiet;

  var dom = null;
  var t = null;
  var rows = {};

  function build() {
    dom = Object.create(K.dom());
    dom.g = document.getElementById('figS4');
    /* the names stand further out than the lengths, so both can show */
    t = Tri.create(dom.g, { A: S3.HALF.A, B: S3.HALF.B, C: S3.HALF.C, right: 'B', theta: 'C', wordOff: 70 });
    reset();
  }

  function notQuite() { quiet(K.speak(K.keyed('fbNotQuite'))); }
  function vals() { return Object.keys(t.vals).map(function (s) { return t.vals[s]; }); }

  /* The triangle as section 3 left it: in the middle, its three lengths
     and both acute angles written. */
  function triInstant() {
    Tri.instant(t);
    t.writeVal('CA', T('val2'));
    t.writeVal('AB', T('val1'));
    t.writeVal('BC', T('lblRoot3Units'));
    t.writeAngle('C', T('lblDeg30'));
    t.writeAngle('A', T('lblDeg60'));
    M.set(vals().concat([t.arcs.C, t.angles.C, t.arcs.A, t.angles.A]), { opacity: 1 });
  }
  function ensureTri() {
    if (!dom.g.hasAttribute('hidden')) return Promise.resolve();
    /* section 3's half is the one on the board; this one takes over from
       it in the same place, so the swap is not seen */
    triInstant();
    var s3L = document.getElementById('figS3L');
    if (s3L && !s3L.hasAttribute('hidden')) {
      M.set(s3L, { opacity: 0 });
      s3L.setAttribute('hidden', '');
    }
    return Promise.resolve();
  }

  /* ======================================================================
   * Scene 1 -- 60° as the reference angle
   * ====================================================================== */
  function sceneSixty() {
    return ensureTri()
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s4Use60', '60°', function () {
          t.setTheta('A');
          return Promise.all([
            Flow.anim(Beats.textPulse([t.angles.A], 2)),
            Flow.anim(Beats.linePulse(t.arcs.A, 3.2)),
            Flow.anim(M.to([t.arcs.C, t.angles.C], { opacity: 0.4, duration: M.dur(0.5), ease: 'power2.inOut' }))
          ]);
        }));
        return K.say('s4Use60');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        t.setTheta('A');
        t.colourRoles(true);
        quiet(K.onPhrase('s4Roles', 'opposite', function () {
          return Flow.anim(Beats.labelIn(t.writeWord('opp', T('lblOpposite'))));
        }));
        quiet(K.onPhrase('s4Roles', 'adjacent', function () {
          return Flow.anim(Beats.labelIn(t.writeWord('adj', T('lblAdjacent'))));
        }));
        quiet(K.onPhrase('s4Roles', 'hypotenuse', function () {
          return Flow.anim(Beats.labelIn(t.writeWord('hyp', T('lblHypotenuse'))));
        }));
        return K.speakBySentence('s4Roles');
      })
      .then(function () { return Flow.wait(BEAT); })
      /* ---- aside, and the ratios ----------------------------------------- */
      .then(function () {
        return Flow.anim(Beats.slideGroup(dom.g, K.SHIFT, 0.9));
      })
      .then(function () {
        W.pane.show();
        var row = W.eqRow(T('eqSinDeg', { a: 60 }));
        rows.sin60 = row;
        return Promise.all([K.say('defSine'), Flow.anim(Beats.rowIn(row.el))])
          .then(function () { return showWords(row, 'opp', 'hyp'); })
          .then(function () { return Flow.wait(SHORT); })
          .then(function () { return Flow.anim(row.showB(T('valRoot3'), T('val2'))); });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        rows.sin60.el.classList.add('is-done');
        return K.say('s4YourTurn60');
      })
      .then(function () { return yourTurn('cos', 60, 'wAdjacent', 'wHypotenuse', [T('val1'), T('val2')], null); })
      .then(function () {
        rows.cos60.el.classList.add('is-done');
        return yourTurn('tan', 60, 'wOpposite', 'wAdjacent', [T('valRoot3'), T('val1')], T('valRoot3'));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        Object.keys(rows).forEach(function (k) { rows[k].el.classList.remove('is-done'); });
        return K.praise();
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  function showWords(row, n, d) {
    var names = { opp: 'wOpposite', adj: 'wAdjacent', hyp: 'wHypotenuse' };
    row.A.n.className = 'eq__n c-' + n;
    row.A.d.className = 'eq__d c-' + d;
    quiet(Flow.anim(Beats.linePulse([t.side(n), t.side(d)])));
    return Flow.anim(row.showA(T(names[n]), T(names[d])));
  }
  function roleOf(key) { return { wOpposite: 'opp', wAdjacent: 'adj', wHypotenuse: 'hyp' }[key]; }
  function yourTurn(which, deg, num, den, lengths, value) {
    var key = { sin: 'eqSinDeg', cos: 'eqCosDeg', tan: 'eqTanDeg' }[which];
    var row = W.eqRow(T(key, { a: deg }));
    rows[which + deg] = row;
    return Flow.anim(Beats.rowIn(row.el))
      .then(function () { return W.askRatio(row, { num: num, den: den, onWrong: notQuite }); })
      .then(function () {
        quiet(Flow.anim(Beats.linePulse([t.side(roleOf(num)), t.side(roleOf(den))])));
        return Flow.anim(row.showB(lengths[0], lengths[1]));
      })
      .then(function () {
        if (value == null) return;
        return Flow.wait(SHORT).then(function () { return Flow.anim(row.showVal(value)); });
      })
      .then(function () { return K.speak(K.keyed('fbCorrect')); })
      .then(function () { return Flow.wait(SHORT); });
  }

  /* ======================================================================
   * Scene 2 -- the table
   * ====================================================================== */
  function sceneTable() {
    return Promise.resolve()
      .then(function () { return K.say('s4AddTable'); })
      .then(function () {
        return Promise.all([W.pane.out(), Flow.anim(Beats.clearFigure([dom.g]))]);
      })
      .then(function () {
        dom.g.setAttribute('hidden', '');
        return W.table.show();
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return W.table.fillColumn(60, { sin: T('valRoot3Over2'), cos: T('valHalf'), tan: T('valRoot3') });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* ---- the hooks ---------------------------------------------------------- */
  function parts() { return t.parts(); }
  function wipe() { return []; }
  function reset() {
    t.reset();
    t.setTheta('C');
    dom.g.setAttribute('hidden', '');
    rows = {};
  }
  function stage(local) {
    if (local <= 0) {
      /* the table of the scene before, and the half under it */
      W.table.remember('sin', 45, T('valOneOverRoot2')); W.table.remember('cos', 45, T('valOneOverRoot2')); W.table.remember('tan', 45, T('val1'));
      W.table.remember('sin', 30, T('valHalf')); W.table.remember('cos', 30, T('valRoot3Over2')); W.table.remember('tan', 30, T('valOneOverRoot3'));
      triInstant();
      return;
    }
    triInstant();
    t.setTheta('A');
    t.colourRoles(true);
    M.set(dom.g, { x: K.SHIFT });
  }

  Pages.addSection({
    name: 'The 60° angle',
    scenes: [
      { name: 'The 60° angle', play: sceneSixty },
      { name: 'Table: 60°',    play: sceneTable }
    ],
    build: build,
    parts: parts,
    wipe: wipe,
    reset: reset,
    stage: stage
  });
})(window);
