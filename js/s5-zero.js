/* ==========================================================================
 * s5-zero.js -- Section 5: your turn, and towards 0°
 * --------------------------------------------------------------------------
 * Storyboard pages 58-70. Three scenes:
 *
 *   Your turn.  Three values to find, each from a triangle of its own
 *     (storyboard pages 58-60): the table stands aside, a triangle with
 *     new side lengths is drawn -- 6, 3 and 3√3 for sin 30°; 4, 4 and
 *     4√2 for cos 45°; 4, 2 and 2√3 for tan 60° -- the first in the middle
 *     of the board, stepping aside to the left once drawn, the others on
 *     the left -- and the ratio is asked on the right, its two lengths
 *     chosen from dropdowns of the triangle's lengths; then its value.
 *     Next after each.
 *   Towards 0°.  A triangle with its hypotenuse fixed at 4, in the middle
 *     of the board; the learner drags its far corner down, θ goes to 0°,
 *     and the opposite side shrinks to nothing while the other two sides
 *     come together. The triangle has become a line; it steps aside, and
 *     its distances -- opposite 0, adjacent 4, hypotenuse 4 -- extend the
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
     swinging down to the base as θ goes to 0. The line it ends as stands
     in the middle of the board. */
  var UNIT = 74;
  var HYP = 4 * UNIT;
  var A0 = { x: 500 - HYP / 2, y: 340 };
  var START_DEG = 40;
  /* Below this the triangle is too thin at A for θ's measure to sit inside
     it, so the measure stands just left of the corner instead. */
  var THIN_DEG = 25;

  /* The triangles of the first scene, one per value to find: the corners
     (θ's at A, or at C for 60°), the measure marked at θ, the length on
     each side, and the ratio asked -- its lengths, and the value they
     come to. 30° triangles have a base 330 long, the 45° one 260. */
  var FINDS = [
    { ask: 's5FindSin30', lhs: 'eqSinDeg', deg: 30, at: 'A', angle: 'lblDeg30',
      A: { x: 335, y: 350 }, B: { x: 665, y: 350 }, C: { x: 665, y: 159.47 },
      vals: { CA: 'val6', BC: 'val3', AB: 'val3Root3' },
      num: 'val3', den: 'val6', value: 'valHalf' },
    { ask: 's5FindCos45', lhs: 'eqCosDeg', deg: 45, at: 'A', angle: 'lblDeg45',
      A: { x: 370, y: 385 }, B: { x: 630, y: 385 }, C: { x: 630, y: 125 },
      vals: { CA: 'val4Root2', BC: 'val4', AB: 'val4' },
      num: 'val4', den: 'val4Root2', value: 'valOneOverRoot2' },
    { ask: 's5FindTan60', lhs: 'eqTanDeg', deg: 60, at: 'C', angle: 'lblDeg60',
      A: { x: 335, y: 350 }, B: { x: 665, y: 350 }, C: { x: 665, y: 159.47 },
      vals: { CA: 'val4', BC: 'val2', AB: 'val2Root3' },
      num: 'val2Root3', den: 'val2', value: 'valRoot3' }
  ];

  var dom = null;
  var t = null;
  var tF = null;
  var grab = null;

  function build() {
    dom = Object.create(K.dom());
    dom.g = document.getElementById('figS5');
    dom.gF = document.getElementById('figS5F');
    /* the names stand further out than the lengths, so both can show */
    t = Tri.create(dom.g, { A: A0, B: { x: A0.x + HYP, y: A0.y }, C: { x: A0.x + HYP, y: A0.y },
                            right: 'B', theta: 'A', wordOff: 70 });
    tF = Tri.create(dom.gF, { A: FINDS[0].A, B: FINDS[0].B, C: FINDS[0].C, right: 'B', theta: 'A' });
    buildGrab();
    reset();
  }

  function notQuite() { return quiet(K.speak(K.keyed('fbNotQuite'))); }
  function approx(n) { return T('lblApprox', { v: (Math.round(n * 100) / 100).toFixed(2) }); }

  /* The triangle at θ = deg, and the lengths beside its sides. */
  function shapeAt(deg) {
    var a = deg * Math.PI / 180;
    var C = { x: A0.x + HYP * Math.cos(a), y: A0.y - HYP * Math.sin(a) };
    var B = { x: C.x, y: A0.y };
    t.set(null, B, C);
    if (grab) grab.place();
    t.writeAngle('A', T('lblDegVal', { n: Math.round(deg) }));
    t.writeVal('CA', T('val4'));
    var ang = t.angles.A;
    ang.setAttribute('text-anchor', 'middle');
    if (deg < THIN_DEG) {
      ang.setAttribute('x', A0.x - 16); ang.setAttribute('y', A0.y);
      ang.setAttribute('dy', '.36em'); ang.setAttribute('text-anchor', 'end');
    }
    if (deg <= 0.01) {
      t.writeVal('BC', T('val0'));
      t.writeVal('AB', T('val4'));
      /* a line: the hypotenuse's length over it, the base's under it, and
         the opposite's nothing at the far end */
      var top = { x: (A0.x + B.x) / 2, y: A0.y - 26 };
      t.vals.CA.setAttribute('x', top.x); t.vals.CA.setAttribute('y', top.y);
      t.vals.CA.setAttribute('dy', '0'); t.vals.CA.setAttribute('text-anchor', 'middle');
      t.vals.BC.setAttribute('x', B.x + 22); t.vals.BC.setAttribute('y', B.y);
      t.vals.BC.setAttribute('dy', '.36em'); t.vals.BC.setAttribute('text-anchor', 'start');
      t.vals.BC.removeAttribute('transform');
      t.arcs.A.setAttribute('d', '');
    } else {
      t.writeVal('BC', approx(4 * Math.sin(a)));
      t.writeVal('AB', approx(4 * Math.cos(a)));
    }
  }

  /* The far corner, taken in hand (W.cornerGrab): dragged round on the
     hypotenuse's 4 units, down to the base. */
  function buildGrab() {
    grab = W.cornerGrab({
      group: dom.g, dot: t.dots.C,
      point: function () { return t.V.C; },
      degAt: function (p) { return Math.atan2(A0.y - p.y, Math.max(1, p.x - A0.x)) * 180 / Math.PI; },
      pointAt: function (deg) {
        var a = deg * Math.PI / 180;
        return { x: A0.x + HYP * Math.cos(a), y: A0.y - HYP * Math.sin(a) };
      },
      turn: shapeAt,
      min: 0, max: 60, target: 0, snap: 2,
      label: T('a11yApex')
    });
  }

  /* ======================================================================
   * Scene 1 -- your turn
   * ====================================================================== */
  /* Each value found is a page of its own: Next, and the next one. */
  function sceneYourTurn() {
    return W.table.hide()
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return find(0); })
      .then(nextFind)
      .then(function () { return find(1); })
      .then(nextFind)
      .then(function () { return find(2); })
      .then(function () { return Flow.wait(BEAT); })
      .then(nextFind);
  }
  function nextFind() { return K.handOver().then(findOut); }
  /* One value found: its triangle drawn, its lengths on its sides, and
     set on the left; the question said; then the ratio on the right, its
     two lengths chosen from dropdowns of the triangle's lengths, and the
     value they come to. */
  function find(n) {
    var f = FINDS[n], last = n === FINDS.length - 1;
    var lengths = Object.keys(f.vals).map(function (s) { return T(f.vals[s]); })
      .filter(function (v, i, all) { return all.indexOf(v) === i; });
    return findIn(f, n === 0)
      .then(function () { return K.say(f.ask); })
      .then(function () {
        W.pane.show();
        var row = W.eqRow(T(f.lhs, { a: f.deg }));
        return Flow.anim(Beats.rowIn(row.el))
          .then(function () {
            return W.askLengths(row, { frac: 'A', num: T(f.num), den: T(f.den), options: lengths, onWrong: notQuite });
          })
          .then(function () { return Flow.wait(SHORT); })
          .then(function () { return Flow.anim(row.showVal(T(f.value))); });
      })
      .then(function () {
        return last ? K.praise() : K.speak(K.keyed('fbCorrect'));
      })
      .then(function () { return Flow.wait(BEAT); });
  }
  /* The triangle drawn: laid out and measured whole first, so where it
     stands -- the left half, or the middle of the board when `centre` --
     is known, then put out of sight and drawn there: the pen round it,
     θ's arc and measure, and the lengths landing one by one. Drawn in the
     middle, it then steps aside to the left half for the pane. */
  function findIn(f, centre) {
    tF.reset();
    tF.set(f.A, f.B, f.C);
    tF.setTheta(f.at);
    Object.keys(f.vals).forEach(function (s) { tF.writeVal(s, T(f.vals[s])); });
    tF.writeAngle(f.at, T(f.angle));
    Tri.instant(tF);
    var marks = vals(tF).concat([tF.arcs[f.at], tF.angles[f.at]]);
    M.set(marks, { opacity: 1 });
    M.set(dom.gF, { x: 0, y: 0, opacity: 1 });
    var left = K.aside(dom.gF);
    M.set(dom.gF, centre ? K.aside(dom.gF, .5) : left);
    M.set(tF.parts(), { opacity: 0 });
    return Tri.draw(tF, { time: 1.2, hold: 100 })
      .then(function () { return Tri.angleIn(tF, f.at, T(f.angle)); })
      .then(function () {
        return ['CA', 'BC', 'AB'].reduce(function (chain, s) {
          return chain.then(function () {
            return Flow.anim(Beats.labelIn(tF.vals[s])).then(function () { return Flow.wait(100); });
          });
        }, Promise.resolve());
      })
      .then(function () {
        if (!centre) return;
        return Flow.wait(SHORT)
          .then(function () { return Flow.anim(Beats.moveGroup(dom.gF, left, 0.9)); });
      });
  }
  /* ...and taken away with its working, for the next. */
  function findOut() {
    return Promise.all([W.pane.out(), Flow.anim(Beats.clearFigure(tF.parts()))])
      .then(function () {
        dom.gF.setAttribute('hidden', '');
        tF.reset();
      });
  }
  function vals(tri) { return Object.keys(tri.vals).map(function (s) { return tri.vals[s]; }); }
  function rememberAll() {
    W.table.remember('sin', 45, T('valOneOverRoot2')); W.table.remember('cos', 45, T('valOneOverRoot2')); W.table.remember('tan', 45, T('val1'));
    W.table.remember('sin', 30, T('valHalf')); W.table.remember('cos', 30, T('valRoot3Over2')); W.table.remember('tan', 30, T('valOneOverRoot3'));
    W.table.remember('sin', 60, T('valRoot3Over2')); W.table.remember('cos', 60, T('valHalf')); W.table.remember('tan', 60, T('valRoot3'));
  }

  /* ======================================================================
   * Scene 2 -- towards 0°
   * ====================================================================== */
  function sceneZero() {
    return W.table.hide()
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        shapeAt(START_DEG);
        return K.say('s5Closer0', function () {
          return Tri.draw(t, { time: 1.4, hold: 120 })
            .then(function () { return Tri.angleIn(t, 'A', T('lblDegVal', { n: START_DEG })); })
            .then(function () { return Tri.nameSides(t, ['opp', 'adj', 'hyp'], 100); });
        });
      })
      .then(function () {
        return Flow.anim(Beats.marksIn([t.vals.CA, t.vals.BC, t.vals.AB], 0.4));
      })
      .then(function () { return Flow.wait(SHORT); })
      /* the far corner lit and handed over, in the middle of the board */
      .then(function () {
        grab.turnTo(START_DEG);
        quiet(Flow.anim(grab.show()));
        return Promise.all([K.say('s5Slide0'), grab.ask()]);
      })
      .then(function () { return grab.hide(); })
      .then(function () {
        shapeAt(0);
        /* the names come off the line: three words on one stroke would
           lie over each other, and the lengths say what is left */
        return Tri.unname(t);
      })
      /* unname lays the triangle out afresh; the line's own places back */
      .then(function () { shapeAt(0); })
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
      /* the line steps aside for the pane */
      .then(function () {
        return Flow.anim(Beats.slideGroup(dom.g, K.aside(dom.g).x, 0.9));
      })
      .then(function () {
        W.pane.show();
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

  /* One ratio extended: the definition said first; then the row, its
     numbers carried in from the line, and the value. */
  function ratio(sayKey, lhsKey, deg, n, d, nv, dv, value) {
    var row = W.eqRow(T(lhsKey, { a: deg }));
    row.A.n.className = 'eq__n c-' + n;
    row.A.d.className = 'eq__d c-' + d;
    return K.say(sayKey)
      .then(function () { return Flow.anim(Beats.rowIn(row.el)); })
      .then(function () {
        quiet(Flow.anim(Beats.linePulse([t.side(n), t.side(d)])));
        return row.flyA(nv, dv, t.val(n), t.val(d));
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
  function parts() { return t.parts().concat([grab.el], tF.parts()); }
  function wipe() { return []; }
  function reset() {
    grab.reset();
    t.reset();
    tF.reset();
    dom.g.setAttribute('hidden', '');
    dom.gF.setAttribute('hidden', '');
    M.set(dom.gF, { clearProps: 'transform,opacity' });
  }
  function stage(local) {
    rememberAll();
    if (local <= 0) { W.table.place(); return; }
    if (local === 1) { W.table.place(); return; }
    shapeAt(0);
    Tri.instant(t);
    t.colourRoles(true);
    M.set(dom.g, { x: K.aside(dom.g).x });
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
