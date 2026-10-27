/* ==========================================================================
 * s3-thirty.js -- Section 3: the equilateral triangle, and 30°
 * --------------------------------------------------------------------------
 * Storyboard pages 35-51. Three scenes:
 *
 *   Equilateral triangle.  Drawn pointing left, its far side upright,
 *     every angle 60°, every side 2 units. A faint line shows where the
 *     cut goes -- from the left corner to the middle of the upright side --
 *     and the learner draws it. The two halves part, up and down; the
 *     upright side and the 60° angle are halved (1 and 1, 30° and 30°),
 *     and each half shows its right angle. Next.
 *   The 30° triangle.  The lower half goes and the upper one comes to the
 *     middle: 30° at the left, 2 on the hypotenuse, 1 on the upright, b on
 *     the base. It stands aside and b is found by Pythagoras (√3); sin 30°
 *     is worked, cos 30° and tan 30° are the learner's. Next.
 *   The table.  The 30° values go in. "That leaves 60°. Can we use the
 *     triangle we already have?" The table fades, the half comes back, and
 *     "Yes! The other acute angle in this triangle is 60°." Next.
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion, Flow = global.Flow, Beats = global.Beats;
  var Pages = global.Pages, Tri = global.Tri, W = global.W;
  if (!Pages || !Tri || !W) { console.error('s3-thirty.js: load pages.js, tri.js and widgets.js first.'); return; }
  var K = Pages.kit;
  var BEAT = K.BEAT, SHORT = K.SHORT;
  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  var quiet = K.quiet;

  /* The equilateral: side 300, pointing left -- P the left corner, the
     upright side Q (foot) to R (top) on the right, MID halfway up it. */
  var SIDE = 300;
  var R = { x: 630, y: 105 }, Q = { x: 630, y: 405 };
  var P = { x: R.x - SIDE * Math.sqrt(3) / 2, y: 255 };
  var MID = { x: 630, y: 255 };
  var PART = 12;                /* how far each half slides from the cut   */
  /* The upper half, as it stands once the lower one has gone: carried
     down to the middle of the board. Each half has 30° at A (P), its
     right angle at B (MID), and 60° at C. */
  var CENTRE_Y = 75;            /* the upper half's drop to the middle     */
  var HALF = {
    A: { x: P.x, y: P.y + CENTRE_Y },
    B: { x: MID.x, y: MID.y + CENTRE_Y },
    C: { x: R.x, y: R.y + CENTRE_Y }
  };

  var dom = null;
  var tE = null, tL = null, tR = null;
  var rows = {};

  function build() {
    dom = Object.create(K.dom());
    dom.g = document.getElementById('figS3');
    dom.gL = document.getElementById('figS3L');
    dom.gR = document.getElementById('figS3R');
    tE = Tri.create(dom.g, { A: P, B: Q, C: R, right: null, theta: 'A' });
    tL = Tri.create(dom.gL, { A: P, B: MID, C: R, right: 'B', theta: 'A' });
    tR = Tri.create(dom.gR, { A: P, B: MID, C: Q, right: 'B', theta: 'A' });
    buildCut();
    reset();
  }

  function notQuite() { quiet(K.speak(K.keyed('fbNotQuite'))); }
  function vals(t) { return Object.keys(t.vals).map(function (s) { return t.vals[s]; }); }

  /* The halves written in whole as the split leaves them: the lengths on
     the hypotenuses, 60° at the far corners, 30° at the left, 1 on each
     half of the upright side, and the right angles -- `squares` and
     `halved` say how far. */
  function halvesInstant(o) {
    o = o || {};
    [tL, tR].forEach(function (t, i) {
      Tri.instant(t);
      t.writeVal('CA', T('val2'));
      t.writeAngle('C', T('lblDeg60'));
      M.set([t.vals.CA, t.arcs.C, t.angles.C], { opacity: 1 });
      if (o.halved !== false) {
        t.writeVal('BC', T('val1'));
        t.writeAngle('A', T('lblDeg30'));
        M.set([t.vals.BC, t.arcs.A, t.angles.A], { opacity: 1 });
      }
      if (o.squares === false) M.set(t.square, { opacity: 0 });
      M.set(t.group, { y: i === 0 ? -PART : PART });
    });
  }

  /* ======================================================================
   * The split, drawn by the learner
   * A faint dashed line shows where the cut goes, from the corner at P to
   * the middle of the upright side; the corner glows and the hand shows
   * the stroke. The learner drags from the corner and the line follows
   * the finger along the guide; carried most of the way, it is drawn the
   * rest and ask() resolves. Let go short, it draws back. Enter or Space
   * on the corner draws it whole.
   * ====================================================================== */
  var DONE_AT = 0.88;           /* of the way along, the line is taken as drawn */
  var HALO_R = 15;              /* the glow round the corner                 */
  var HIT_R = 42;               /* where a finger catches it                 */
  var HAND_PX = 46;             /* the hand's height, per picture unit's px  */
  var GUIDE_ALPHA = 0.45;       /* the dotted guide: there, but faint        */

  var cut = null;

  function buildCut() {
    var guide = K.el('path', { 'class': 'split-guide', d: K.seg(P, MID) });
    var ink = K.el('path', { 'class': 'split-ink', d: K.seg(P, MID) });
    var g = Tri.el('g', { 'class': 'grab', hidden: '', role: 'button', tabindex: '-1' });
    Tri.el('circle', { 'class': 'grab__halo', r: HALO_R, cx: Tri.round2(P.x), cy: P.y }, g);
    Tri.el('circle', { 'class': 'grab__hit', r: HIT_R, cx: Tri.round2(P.x), cy: P.y }, g);
    /* the stroke lies over the sides but under the corners and the words */
    dom.g.insertBefore(guide, tE.dots.A);
    dom.g.insertBefore(ink, tE.dots.A);
    dom.g.appendChild(g);
    cut = { guide: guide, ink: ink, el: g, k: 0, live: false, done: false,
            held: false, pid: null, stopHand: null };
    g.addEventListener('pointerdown', cutDown);
    g.addEventListener('pointermove', cutMove);
    g.addEventListener('pointerup', cutUp);
    g.addEventListener('pointercancel', cutUp);
    g.addEventListener('keydown', cutKey);
  }

  /* The stroke drawn `k` of the way, grown from P by a scale. */
  function inkTo(k) {
    cut.k = Math.max(0, Math.min(1, k));
    M.set(cut.ink, { scaleX: cut.k, svgOrigin: Tri.round2(P.x) + ' ' + P.y });
  }
  function alongAt(ev) {
    var m = dom.g.getScreenCTM();
    if (!m) return cut.k;
    var p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return (p.x - P.x) / (MID.x - P.x);
  }
  function toScreen(p) {
    var m = dom.g.getScreenCTM();
    return m ? new DOMPoint(p.x, p.y).matrixTransform(m) : p;
  }
  function stopCutHand() {
    if (cut.stopHand) { cut.stopHand(); cut.stopHand = null; }
  }
  /* The rest of the line drawn, and the wait answered. */
  function cutDone() {
    if (cut.done) return;
    cut.done = true;
    cut.live = false;
    cut.el.classList.remove('is-held');
    var p = { k: cut.k };
    Beats.pop();
    quiet(Flow.anim(M.to(p, { k: 1, duration: M.dur(0.2), ease: 'power2.out',
      onUpdate: function () { inkTo(p.k); } })));
    dom.gate.click();
  }
  function cutDown(ev) {
    if (!cut.live) return;
    cut.held = true;
    cut.pid = ev.pointerId;
    stopCutHand();
    cut.el.classList.add('is-held');
    try { cut.el.setPointerCapture(ev.pointerId); } catch (e) {}
    ev.preventDefault();
  }
  function cutMove(ev) {
    if (!cut.held || ev.pointerId !== cut.pid) return;
    inkTo(alongAt(ev));
    if (cut.k >= DONE_AT) { cut.held = false; cutDone(); }
  }
  function cutUp(ev) {
    if (!cut.held || ev.pointerId !== cut.pid) return;
    cut.held = false;
    cut.el.classList.remove('is-held');
    /* let go short: the stroke draws back to the corner */
    var p = { k: cut.k };
    quiet(Flow.anim(M.to(p, { k: 0, duration: M.dur(0.25), ease: 'power2.in',
      onUpdate: function () { inkTo(p.k); } })));
  }
  function cutKey(ev) {
    if (!cut.live || (ev.key !== 'Enter' && ev.key !== ' ')) return;
    ev.preventDefault();
    stopCutHand();
    cutDone();
  }

  /* The guide, the corner lit and live, and the hand drawing the stroke
     until the learner takes over. A skip draws it for them. */
  function askCut() {
    cut.live = true;
    cut.done = false;
    inkTo(0);
    cut.el.removeAttribute('hidden');
    cut.el.setAttribute('tabindex', '0');
    cut.el.setAttribute('aria-label', T('a11ySplit'));
    cut.el.classList.add('is-asking');
    M.set(cut.ink, { opacity: 1 });
    var m = dom.g.getScreenCTM();
    cut.stopHand = W.handDrag(
      function () { return toScreen(P); },
      function () { return toScreen(MID); },
      HAND_PX * (m ? m.a : 1));
    return Flow.once(dom.gate, { auto: true }).then(function () {
      if (!cut.done) { cut.done = true; inkTo(1); }
      cutOff();
    }, function (err) { cutOff(); throw err; });
  }
  function cutOff() {
    cut.live = false;
    cut.held = false;
    stopCutHand();
    cut.el.setAttribute('tabindex', '-1');
    cut.el.classList.remove('is-asking', 'is-held');
  }

  /* ======================================================================
   * Scene 1 -- the equilateral triangle
   * ====================================================================== */
  function sceneEquilateral() {
    return K.wipeBoard()
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        return K.say('s3Equi', function () {
          return Tri.draw(tE, { time: 1.8, hold: 160, square: false });
        });
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3AllEqual', 'equal', function () {
          return Flow.anim(Beats.linePulse(tE.allSides()));
        }));
        quiet(K.onPhrase('s3AllEqual', 'every angle', function () {
          return ['A', 'B', 'C'].reduce(function (chain, v) {
            return chain.then(function () {
              return Tri.angleIn(tE, v, T('lblDeg60')).then(function () { return Flow.wait(120); });
            });
          }, Promise.resolve());
        }));
        return K.speakBySentence('s3AllEqual');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3Len2', '2 units', function () {
          return ['AB', 'BC', 'CA'].reduce(function (chain, s) {
            return chain.then(function () {
              return Flow.anim(Beats.labelIn(tE.writeVal(s, T('lblUnits2')))).then(function () { return Flow.wait(140); });
            });
          }, Promise.resolve());
        }));
        return K.say('s3Len2');
      })
      .then(function () { return Flow.wait(SHORT); })

      /* ---- the split: where it goes shown faintly, the learner draws it -- */
      .then(function () {
        M.set(cut.el, { opacity: 0 });
        cut.el.removeAttribute('hidden');
        return Promise.all([
          Flow.anim(Beats.marksIn(cut.el, 0.4)),
          Flow.anim(M.to(cut.guide, { opacity: GUIDE_ALPHA, duration: M.dur(0.4), ease: 'power2.out' }))
        ]);
      })
      .then(function () {
        return Promise.all([K.say('s3DrawSplit'), askCut()]);
      })
      .then(function () { return Flow.anim(Beats.marksOut([cut.guide, cut.el])); })
      .then(function () { cut.el.setAttribute('hidden', ''); })
      /* ---- the halves take over from the whole and part, up and down ---- */
      .then(function () {
        halvesInstant({ halved: false, squares: false });
        M.set([dom.gL, dom.gR], { y: 0, opacity: 0 });
        return Promise.all([
          Flow.anim(Beats.marksOut(tE.parts().concat([cut.ink]))),
          Flow.anim(Beats.marksIn([dom.gL, dom.gR], 0.4))
        ]);
      })
      .then(function () {
        dom.g.setAttribute('hidden', '');
        return Flow.anim(Beats.splitApart([dom.gL, dom.gR], [{ x: 0, y: -PART }, { x: 0, y: PART }]));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3Perp', 'side', function () {
          return Promise.all([tL, tR].map(function (t) {
            return Flow.anim(Beats.labelIn(t.writeVal('BC', T('val1'))));
          }));
        }));
        quiet(K.onPhrase('s3Perp', 'angle', function () {
          return Promise.all([tL, tR].map(function (t) {
            return Tri.angleIn(t, 'A', T('lblDeg30'));
          }));
        }));
        return K.say('s3Perp');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3EachHalf', 'right', function () {
          return Flow.anim(Beats.growLines([tL.square, tR.square], 0.5, 'power2.inOut'));
        }));
        return K.say('s3EachHalf');
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }
  /* ======================================================================
   * Scene 2 -- the 30° triangle
   * ====================================================================== */
  function sceneThirty() {
    var bRow = null, bPills = null;
    return ensureHalves()
      .then(function () {
        quiet(K.onPhrase('s3KeepOne', 'this one', function () {
          return Promise.all([
            Flow.anim(Beats.marksOut([dom.gR])),
            Flow.anim(Beats.moveGroup(dom.gL, { y: CENTRE_Y }, 0.9))
          ]).then(function () { dom.gR.setAttribute('hidden', ''); });
        }));
        return K.speakBySentence('s3KeepOne');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3Here30', '30°', function () {
          return Flow.anim(Beats.textPulse([tL.angles.A], 2));
        }));
        return K.say('s3Here30');
      })
      .then(function () {
        return Flow.anim(Beats.labelIn(tL.writeVal('AB', T('lblB'))));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3TwoLengths', 'two', function () {
          return Flow.anim(Beats.textPulse([tL.vals.CA, tL.vals.BC], 2));
        }));
        return K.say('s3TwoLengths');
      })
      .then(function () {
        quiet(K.onPhrase('s3Third', 'third', function () {
          return Flow.anim(Beats.textPulse([tL.vals.AB], 2));
        }));
        return K.say('s3Third');
      })
      .then(function () { return Flow.wait(SHORT); })
      /* ---- aside, and b by Pythagoras ------------------------------------ */
      .then(function () {
        return Flow.anim(Beats.moveGroup(dom.gL, K.aside(dom.gL), 0.9));
      })
      .then(function () {
        W.pane.show();
        bRow = W.eqRow(T('eqB'), 'eq--ask');
        W.write(bRow.val, T('lblQ'));
        bRow.val.removeAttribute('hidden');
        return Promise.all([
          K.say('s3PythB'),
          Flow.anim(Beats.rowIn(bRow.el))
        ]);
      })
      .then(function () {
        bPills = W.pills(K.shuffle([T('val3'), T('valRoot3'), T('valRoot5')]));
        return Flow.anim(Beats.rowIn(bPills.el));
      })
      .then(function () {
        var right = bPills.btns.map(function (b) { return b.dataset.name; }).indexOf(T('valRoot3'));
        return K.askUntilRight(bPills.btns, right, { onWrong: notQuite });
      })
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.swapIn(bRow.val, function () { W.write(bRow.val, T('valRoot3')); }))
            .then(function () { return Flow.anim(Beats.slotRight(bRow.val)); }),
          Flow.anim(Beats.relabel(tL.vals.AB, function () { tL.vals.AB.textContent = T('lblRoot3Units'); }))
        ]);
      })
      .then(function () { return W.pane.drop(bPills.el); })
      .then(function () {
        quiet(K.onPhrase('s3Root3', 'three', function () {
          return Flow.anim(Beats.textPulse(vals(tL), 2));
        }));
        return K.speakBySentence('s3Root3');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return W.pane.drop(bRow.el); })

      /* ---- sin 30°, worked ---------------------------------------------- */
      .then(function () {
        var row = W.eqRow(T('eqSinDeg', { a: 30 }));
        rows.sin30 = row;
        return Promise.all([K.say('s3Sin30'), Flow.anim(Beats.rowIn(row.el))])
          .then(function () { return showWords(row, 'opp', 'hyp'); })
          .then(function () { return Flow.wait(SHORT); })
          .then(function () { return Flow.anim(row.showB(T('val1'), T('val2'))); });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        rows.sin30.el.classList.add('is-done');
        return K.say('s3YourTurn30');
      })
      .then(function () { return yourTurn('cos', 30, 'wAdjacent', 'wHypotenuse', [T('valRoot3'), T('val2')], null); })
      .then(function () {
        rows.cos30.el.classList.add('is-done');
        return yourTurn('tan', 30, 'wOpposite', 'wAdjacent', [T('val1'), T('valRoot3')], null);
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
    quiet(Flow.anim(Beats.linePulse([tL.side(n), tL.side(d)])));
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
        quiet(Flow.anim(Beats.linePulse([tL.side(roleOf(num)), tL.side(roleOf(den))])));
        return Flow.anim(row.showB(lengths[0], lengths[1]));
      })
      .then(function () {
        if (value == null) return;
        return Flow.wait(SHORT).then(function () { return Flow.anim(row.showVal(value)); });
      })
      .then(function () { return K.speak(K.keyed('fbCorrect')); })
      .then(function () { return Flow.wait(SHORT); });
  }

  /* The second scene opens on the two halves, parted; written in if they
     are not there. */
  function ensureHalves() {
    if (!dom.gL.hasAttribute('hidden') && !dom.gR.hasAttribute('hidden')) return Promise.resolve();
    halvesInstant();
    return Promise.resolve();
  }

  /* ======================================================================
   * Scene 3 -- the table, and back to the triangle
   * ====================================================================== */
  function sceneTable() {
    return Promise.resolve()
      .then(function () { return K.say('s3AddTable'); })
      .then(function () {
        return Promise.all([W.pane.out(), Flow.anim(Beats.clearFigure([dom.gL, dom.gR]))]);
      })
      .then(function () {
        dom.gL.setAttribute('hidden', ''); dom.gR.setAttribute('hidden', '');
        return W.table.show();
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return W.table.fillColumn(30, { sin: T('valHalf'), cos: T('valRoot3Over2'), tan: T('valOneOverRoot3') });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.say('s3Leaves60'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.autoTurn(); })
      /* the table fades and the same half comes back, whole, in the middle */
      .then(function () { return W.table.hide(); })
      .then(function () {
        halfCentred();
        M.set(dom.gL, { opacity: 0 });
        return Flow.anim(Beats.marksIn([dom.gL], 0.5));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3Yes60', 'other acute', function () {
          return Flow.anim(Beats.textPulse([tL.angles.A], 2));
        }));
        return K.speakBySentence('s3Yes60');
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* The kept half, in the middle of the board, with its three lengths and
     both acute angles written -- the board section 4 opens on. */
  function halfCentred() {
    halfWritten();
    M.set(dom.gL, { x: 0, y: CENTRE_Y, opacity: 1 });
  }
  /* The kept half with its three lengths and both acute angles. */
  function halfWritten() {
    Tri.instant(tL);
    tL.writeVal('CA', T('val2'));
    tL.writeVal('BC', T('val1'));
    tL.writeVal('AB', T('lblRoot3Units'));
    tL.writeAngle('A', T('lblDeg30'));
    tL.writeAngle('C', T('lblDeg60'));
    M.set(vals(tL).concat([tL.arcs.C, tL.angles.C, tL.arcs.A, tL.angles.A]), { opacity: 1 });
  }

  /* ---- the hooks ---------------------------------------------------------- */
  function parts() { return tE.parts().concat(tL.parts(), tR.parts(), [cut.guide, cut.ink, cut.el]); }
  function wipe() { return []; }
  function reset() {
    cutOff();
    cut.el.setAttribute('hidden', '');
    tE.reset(); tL.reset(); tR.reset();
    tL.setTheta('A'); tR.setTheta('A');
    [dom.g, dom.gL, dom.gR].forEach(function (g) { g.setAttribute('hidden', ''); });
    rows = {};
  }
  function stage(local) {
    if (local <= 0) return;
    if (local === 1) { halvesInstant(); return; }
    /* scene 3 opens on the kept half aside, with the rows found */
    halfWritten();
    M.set(dom.gL, K.aside(dom.gL));
  }

  Pages.addSection({
    name: 'The 30° triangle',
    scenes: [
      { name: 'Equilateral triangle', play: sceneEquilateral },
      { name: 'The 30° triangle',     play: sceneThirty },
      { name: 'Table: 30°',           play: sceneTable }
    ],
    build: build,
    parts: parts,
    wipe: wipe,
    reset: reset,
    stage: stage
  });

  /* The kept half's geometry in the middle of the board, for section 4. */
  global.S3 = { HALF: HALF };
})(window);
