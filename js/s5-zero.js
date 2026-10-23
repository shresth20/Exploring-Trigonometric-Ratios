/* ==========================================================================
 * s5-zero.js -- Section 5: your turn, and towards 0°
 * --------------------------------------------------------------------------
 * Storyboard pages 58-70. Three scenes:
 *
 *   Your turn.  The table so far, and three values to find in it: sin 30°,
 *     cos 45°, tan 60° -- each a tap on the right cell. Next.
 *   Towards 0°.  A triangle with its hypotenuse fixed at 4; the slider
 *     carries θ down to 0° and the opposite side shrinks to nothing while
 *     the other two sides come together. The triangle has become a line.
 *     Its distances -- opposite 0, adjacent 4, hypotenuse 4 -- extend the
 *     three ratios to 0°. Next.
 *   The table.  The 0° values go in. Next.
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion, Flow = global.Flow, Beats = global.Beats;
  var Pages = global.Pages, Tri = global.Tri, W = global.W;
  if (!Pages || !Tri || !W) { console.error('s5-zero.js: load pages.js, tri.js and widgets.js first.'); return; }
  var K = Pages.kit;
  var BEAT = K.BEAT, SHORT = K.SHORT;
  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  var quiet = K.quiet;

  /* θ at A; the hypotenuse is 4 units long and stays so, the far corner
     swinging down to the base as θ goes to 0. */
  var A0 = { x: 300, y: 330 };
  var UNIT = 62;
  var HYP = 4 * UNIT;
  var START_DEG = 40;

  var dom = null, mascot = null;
  var t = null;

  function build() {
    dom = Object.create(K.dom());
    mascot = K.mascot();
    dom.g = document.getElementById('figS5');
    t = Tri.create(dom.g, { A: A0, B: { x: A0.x + HYP, y: A0.y }, C: { x: A0.x + HYP, y: A0.y }, right: 'B', theta: 'A' });
    reset();
  }

  function notQuite() { quiet(K.speak(K.keyed('fbNotQuite'), 'confused')); }
  function approx(n) { return T('lblApprox', { v: (Math.round(n * 100) / 100).toFixed(2) }); }

  /* The triangle at θ = deg, and the lengths beside its sides. */
  function shapeAt(deg) {
    var a = deg * Math.PI / 180;
    var C = { x: A0.x + HYP * Math.cos(a), y: A0.y - HYP * Math.sin(a) };
    var B = { x: C.x, y: A0.y };
    t.set(null, B, C);
    t.writeAngle('A', T('lblDegVal', { n: Math.round(deg) }));
    t.writeVal('CA', T('val4'));
    if (deg <= 0.01) {
      t.writeVal('BC', T('val0'));
      t.writeVal('AB', T('val4'));
      /* a line: the hypotenuse's length over it, the base's under it, the
         opposite's nothing at the far end, and the angle just above A */
      var top = { x: (A0.x + B.x) / 2, y: A0.y - 26 };
      t.vals.CA.setAttribute('x', top.x); t.vals.CA.setAttribute('y', top.y);
      t.vals.CA.setAttribute('dy', '0'); t.vals.CA.setAttribute('text-anchor', 'middle');
      t.vals.BC.setAttribute('x', B.x + 22); t.vals.BC.setAttribute('y', B.y);
      t.vals.BC.setAttribute('dy', '.36em'); t.vals.BC.setAttribute('text-anchor', 'start');
      t.vals.BC.removeAttribute('transform');
      t.angles.A.setAttribute('x', A0.x + 52); t.angles.A.setAttribute('y', A0.y - 22);
      t.angles.A.setAttribute('dy', '0');
      t.arcs.A.setAttribute('d', '');
    } else {
      t.writeVal('BC', approx(4 * Math.sin(a)));
      t.writeVal('AB', approx(4 * Math.cos(a)));
    }
  }

  /* ======================================================================
   * Scene 1 -- your turn
   * ====================================================================== */
  function sceneYourTurn() {
    return ensureTable()
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return find('s5FindSin30', 'sin', 30, false); })
      .then(function () { return find('s5FindCos45', 'cos', 45, false); })
      .then(function () { return find('s5FindTan60', 'tan', 60, true); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }
  function find(askKey, r, a, last) {
    return K.say(askKey)
      .then(function () {
        return W.table.ask(r, a, { onWrong: notQuite });
      })
      .then(function () {
        return last ? K.praise() : K.speak(K.keyed('fbCorrect'), 'happy');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { W.table.settle(r, a); });
  }
  function ensureTable() {
    var d = dom;
    if (!d.tableWrap.hasAttribute('hidden')) return Promise.resolve();
    rememberAll();
    return W.table.show();
  }
  function rememberAll() {
    W.table.remember('sin', 45, T('valOneOverRoot2')); W.table.remember('cos', 45, T('valOneOverRoot2')); W.table.remember('tan', 45, T('val1'));
    W.table.remember('sin', 30, T('valHalf')); W.table.remember('cos', 30, T('valRoot3Over2')); W.table.remember('tan', 30, T('valOneOverRoot3'));
    W.table.remember('sin', 60, T('valRoot3Over2')); W.table.remember('cos', 60, T('valHalf')); W.table.remember('tan', 60, T('valRoot3'));
  }

  /* ======================================================================
   * Scene 2 -- towards 0°
   * ====================================================================== */
  function sceneZero() {
    var slider = null;
    return W.table.hide()
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        shapeAt(START_DEG);
        return K.say('s5Closer0', null, function () {
          return Tri.draw(t, { time: 1.4, hold: 120 })
            .then(function () { return Tri.angleIn(t, 'A', T('lblDegVal', { n: START_DEG })); })
            .then(function () { return Tri.nameSides(t, ['opp', 'adj', 'hyp'], 100); });
        });
      })
      .then(function () {
        return Flow.anim(Beats.marksIn([t.vals.CA, t.vals.BC, t.vals.AB], 0.4));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return Flow.anim(Beats.slideGroup(dom.g, K.SHIFT, 0.9));
      })
      .then(function () {
        W.pane.show();
        slider = W.slider({
          min: 0, max: 60, value: START_DEG, target: 0, snap: 1.5,
          label: T('lblAngle'),
          onChange: function (v) { shapeAt(v); }
        });
        return Flow.anim(Beats.rowIn(slider.el));
      })
      .then(function () { return K.say('s5Slide0'); })
      .then(function () { return slider.ask(); })
      .then(function () {
        shapeAt(0);
        /* the names come off the line: three words on one stroke would
           lie over each other, and the lengths say what is left */
        return Tri.unname(t);
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s5At0', 'opposite', function () {
          return Flow.anim(Beats.textPulse([t.vals.BC], 2));
        }));
        quiet(K.onPhrase('s5At0', 'overlap', function () {
          return Flow.anim(Beats.linePulse([t.side('adj'), t.side('hyp')]));
        }));
        return K.speakBySentence('s5At0');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s5Line', 'line', function () {
          return Flow.anim(Beats.linePulse(t.allSides()));
        }));
        return K.say('s5Line');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return W.pane.drop(slider.el); })
      .then(function () {
        var facts = factsRow(T('lblOpp0'), T('lblAdj4'), T('lblHyp4'));
        return Promise.all([
          K.say('s5Extend0'),
          Flow.anim(Beats.rowIn(facts))
        ]);
      })
      .then(function () { return ratio('defSine', 'eqSinDeg', 0, 'opp', 'hyp', T('val0'), T('val4'), T('val0')); })
      .then(function () { return ratio('defCosine', 'eqCosDeg', 0, 'adj', 'hyp', T('val4'), T('val4'), T('val1')); })
      .then(function () { return ratio('defTangent', 'eqTanDeg', 0, 'opp', 'adj', T('val0'), T('val4'), T('val0')); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* The three distances, as one row of the pane. */
  function factsRow(a, b, c) {
    var row = W.pane.row('facts');
    [['fact--opp', a], ['fact--adj', b], ['fact--hyp', c]].forEach(function (f) {
      var s = W.h('span', 'fact ' + f[0], row);
      W.write(s, f[1]);
    });
    return row;
  }

  /* One ratio extended: the definition said, the row with its numbers,
     and the value. */
  function ratio(sayKey, lhsKey, deg, n, d, nv, dv, value) {
    var row = W.eqRow(T(lhsKey, { a: deg }));
    row.A.n.className = 'eq__n c-' + n;
    row.A.d.className = 'eq__d c-' + d;
    return Promise.all([K.say(sayKey), Flow.anim(Beats.rowIn(row.el))])
      .then(function () {
        quiet(Flow.anim(Beats.linePulse([t.side(n), t.side(d)])));
        return Flow.anim(row.showA(nv, dv));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.anim(row.showVal(value)); })
      .then(function () { return Flow.wait(SHORT); });
  }

  /* ======================================================================
   * Scene 3 -- the table
   * ====================================================================== */
  function sceneTable() {
    return Promise.resolve()
      .then(function () { return K.say('s5AddTable'); })
      .then(function () {
        return Promise.all([W.pane.out(), Flow.anim(Beats.clearFigure([dom.g]))]);
      })
      .then(function () {
        dom.g.setAttribute('hidden', '');
        return W.table.show();
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return W.table.fillColumn(0, { sin: T('val0'), cos: T('val1'), tan: T('val0') });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* ---- the hooks ---------------------------------------------------------- */
  function parts() { return t.parts(); }
  function wipe() { return []; }
  function reset() {
    t.reset();
    dom.g.setAttribute('hidden', '');
  }
  function stage(local) {
    mascot.placeIn(dom.slotHeader);
    mascot.el.classList.remove('is-away');
    mascot.idle();
    rememberAll();
    if (local <= 0) { W.table.place(); return; }
    if (local === 1) { W.table.place(); return; }
    shapeAt(0);
    Tri.instant(t);
    t.colourRoles(true);
    M.set(dom.g, { x: K.SHIFT });
  }

  Pages.addSection({
    name: 'Towards 0°',
    scenes: [
      { name: 'Your turn',   play: sceneYourTurn },
      { name: 'Towards 0°', play: sceneZero },
      { name: 'Table: 0°',  play: sceneTable }
    ],
    build: build,
    parts: parts,
    wipe: wipe,
    reset: reset,
    stage: stage
  });
})(window);
