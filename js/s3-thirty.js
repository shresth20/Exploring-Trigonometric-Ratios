/* ==========================================================================
 * s3-thirty.js -- Section 3: the equilateral triangle, and 30°
 * --------------------------------------------------------------------------
 * Storyboard pages 35-51. Three scenes:
 *
 *   Equilateral triangle.  Drawn, every angle 60°, every side 2 units. One
 *     control: "Tap here to split the triangle into two matching halves."
 *     The perpendicular draws, the two halves part; the base and the 60°
 *     angle are halved (1 and 1, 30° and 30°), and each half shows its
 *     right angle. Next.
 *   The 30° triangle.  One half is kept and stands in the middle: 30° at
 *     the top, 2 on the hypotenuse, 1 on the base, b on the upright. It
 *     stands aside and b is found by Pythagoras (√3); sin 30° is worked,
 *     cos 30° and tan 30° are the learner's. Next.
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

  /* The equilateral: side 300, apex up. */
  var P = { x: 350, y: 355 }, Q = { x: 650, y: 355 }, R = { x: 500, y: 95 };
  var MID = { x: 500, y: 355 };
  var PART = 12;                /* how far each half slides from the cut   */
  /* The left half, as it stands once the right one has gone: carried to
     the middle of the board. */
  var HALF = { A: { x: 413, y: 355 }, B: { x: 563, y: 355 }, C: { x: 563, y: 95 } };
  var CENTRE_X = 63;            /* the left half's slide to the middle      */

  var dom = null, mascot = null;
  var tE = null, tL = null, tR = null;
  var perp = null, perpMask = null;
  var rows = {};

  function build() {
    dom = Object.create(K.dom());
    mascot = K.mascot();
    dom.g = document.getElementById('figS3');
    dom.gL = document.getElementById('figS3L');
    dom.gR = document.getElementById('figS3R');
    tE = Tri.create(dom.g, { A: P, B: Q, C: R, right: null, theta: 'A' });
    tL = Tri.create(dom.gL, { A: P, B: MID, C: R, right: 'B', theta: 'C' });
    tR = Tri.create(dom.gR, { A: Q, B: MID, C: R, right: 'B', theta: 'C' });
    /* the perpendicular, dashed, shown through a mask grown from the apex */
    var defs = K.el('defs');
    var mask = K.el('mask', { id: 'perpMask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1000, height: 420 });
    perpMask = K.el('path', { 'class': 'tri-perp-mask', d: K.seg(R, MID) });
    mask.appendChild(perpMask);
    defs.appendChild(mask);
    dom.g.appendChild(defs);
    perp = K.el('path', { 'class': 'tri-perp', d: K.seg(R, MID), mask: 'url(#perpMask)' });
    dom.g.appendChild(perp);
    reset();
  }

  function notQuite() { quiet(K.speak(K.keyed('fbNotQuite'), 'confused')); }
  function vals(t) { return Object.keys(t.vals).map(function (s) { return t.vals[s]; }); }

  /* The halves written in whole as the split leaves them: the lengths on
     the hypotenuses, 60° at the feet, 30° at the apex, 1 on each base,
     and the right angles -- `squares` and `halved` say how far. */
  function halvesInstant(o) {
    o = o || {};
    [tL, tR].forEach(function (t, i) {
      Tri.instant(t);
      t.writeVal('CA', T('val2'));
      t.writeAngle('A', T('lblDeg60'));
      M.set([t.vals.CA, t.arcs.A, t.angles.A], { opacity: 1 });
      if (o.halved !== false) {
        t.writeVal('AB', T('val1'));
        t.writeAngle('C', T('lblDeg30'));
        M.set([t.vals.AB, t.arcs.C, t.angles.C], { opacity: 1 });
      }
      if (o.squares === false) M.set(t.square, { opacity: 0 });
      M.set(t.group, { x: i === 0 ? -PART : PART });
    });
  }

  /* ======================================================================
   * Scene 1 -- the equilateral triangle
   * ====================================================================== */
  function sceneEquilateral() {
    var btn = null;
    return K.wipeBoard()
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        return K.say('s3Equi', null, function () {
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

      /* ---- the one control: split --------------------------------------- */
      .then(function () {
        var btns = K.buildChoices(dom.choices, [T('btnSplit')]);
        K.choices(btns);
        btn = btns[0];
        btn.classList.add('choice--big');
        M.button3d(btn, { edge: 4 });
        return Flow.anim(Beats.trayIn(dom.choices, btns));
      })
      .then(function () {
        var stop = null;
        btn.classList.add('is-asking');
        quiet(K.say('s3TapSplit'));
        quiet(Flow.wait(SHORT * 5).then(function () {
          if (btn.classList.contains('is-asking')) stop = W.handNudge(btn);
        }));
        return Flow.once(btn, { auto: true }).then(function () {
          btn.classList.remove('is-asking');
          if (stop) stop();
          Beats.sfx('click');
          K.ripple(null, btn);
          speakingDone();
        }, function (err) { if (stop) stop(); throw err; });
      })
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.trayOut(dom.choices, K.choices())),
          Flow.anim(Beats.dashedIn(perp, perpMask, 0.8))
        ]).then(function () { dom.choices.setAttribute('hidden', ''); K.resetFooter(); });
      })
      .then(function () { return Flow.wait(SHORT); })
      /* ---- the split: the halves take over from the whole and part ------ */
      .then(function () {
        halvesInstant({ halved: false, squares: false });
        M.set([dom.gL, dom.gR], { x: 0, opacity: 0 });
        return Promise.all([
          Flow.anim(Beats.marksOut(tE.parts().concat([perp]))),
          Flow.anim(Beats.marksIn([dom.gL, dom.gR], 0.4))
        ]);
      })
      .then(function () {
        dom.g.setAttribute('hidden', '');
        return Flow.anim(Beats.splitApart([dom.gL, dom.gR], [{ x: -PART, y: 0 }, { x: PART, y: 0 }]));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3Perp', 'base', function () {
          return Promise.all([tL, tR].map(function (t) {
            return Flow.anim(Beats.labelIn(t.writeVal('AB', T('val1'))));
          }));
        }));
        quiet(K.onPhrase('s3Perp', 'angle', function () {
          return Promise.all([tL, tR].map(function (t) {
            return Tri.angleIn(t, 'C', T('lblDeg30'));
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
  function speakingDone() {}

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
            Flow.anim(Beats.moveGroup(dom.gL, { x: CENTRE_X }, 0.9))
          ]).then(function () { dom.gR.setAttribute('hidden', ''); });
        }));
        return K.speakBySentence('s3KeepOne');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3Here30', '30°', function () {
          return Flow.anim(Beats.textPulse([tL.angles.C], 2));
        }));
        return K.say('s3Here30');
      })
      .then(function () {
        return Flow.anim(Beats.labelIn(tL.writeVal('BC', T('lblB'))));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s3TwoLengths', 'two', function () {
          return Flow.anim(Beats.textPulse([tL.vals.CA, tL.vals.AB], 2));
        }));
        return K.say('s3TwoLengths');
      })
      .then(function () {
        quiet(K.onPhrase('s3Third', 'third', function () {
          return Flow.anim(Beats.textPulse([tL.vals.BC], 2));
        }));
        return K.say('s3Third');
      })
      .then(function () { return Flow.wait(SHORT); })
      /* ---- aside, and b by Pythagoras ------------------------------------ */
      .then(function () {
        return Flow.anim(Beats.moveGroup(dom.gL, { x: CENTRE_X + K.SHIFT }, 0.9));
      })
      .then(function () {
        W.pane.show();
        bRow = W.eqRow(T('eqB'));
        W.write(bRow.val, T('lblQ'));
        bRow.val.removeAttribute('hidden');
        return Promise.all([
          K.say('s3PythB'),
          Flow.anim(Beats.rowIn(bRow.el))
        ]);
      })
      .then(function () {
        bPills = W.pills(K.shuffle([T('val1'), T('val2'), T('val3'), T('valRoot3'), T('valRoot5')]));
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
          Flow.anim(Beats.relabel(tL.vals.BC, function () { tL.vals.BC.textContent = T('lblRoot3Units'); }))
        ]);
      })
      .then(function () { return W.pane.drop(bPills.el); })
      .then(function () {
        quiet(K.onPhrase('s3Root3', 'three', function () {
          return Flow.anim(Beats.textPulse(vals(tL), 2));
        }));
        return K.speakBySentence('s3Root3', 'happy');
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
      .then(function () { return K.speak(K.keyed('fbCorrect'), 'happy'); })
      .then(function () { return Flow.wait(SHORT); });
  }

  /* The second scene opens on the two halves, parted, with the bird on
     the header; written in if they are not there. */
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
        return K.speakBySentence('s3Yes60', 'happy');
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* The kept half, in the middle of the board, with its three lengths and
     both acute angles written -- the board section 4 opens on. */
  function halfCentred() {
    Tri.instant(tL);
    tL.writeVal('CA', T('val2'));
    tL.writeVal('AB', T('val1'));
    tL.writeVal('BC', T('lblRoot3Units'));
    tL.writeAngle('C', T('lblDeg30'));
    tL.writeAngle('A', T('lblDeg60'));
    M.set(vals(tL).concat([tL.arcs.C, tL.angles.C, tL.arcs.A, tL.angles.A]), { opacity: 1 });
    M.set(dom.gL, { x: CENTRE_X, opacity: 1 });
  }

  /* ---- the hooks ---------------------------------------------------------- */
  function parts() { return tE.parts().concat(tL.parts(), tR.parts(), [perp]); }
  function wipe() { return []; }
  function reset() {
    tE.reset(); tL.reset(); tR.reset();
    tL.setTheta('C'); tR.setTheta('C');
    [dom.g, dom.gL, dom.gR].forEach(function (g) { g.setAttribute('hidden', ''); });
    rows = {};
  }
  function stage(local) {
    if (local <= 0) return;
    mascot.placeIn(dom.slotHeader);
    mascot.el.classList.remove('is-away');
    mascot.idle();
    if (local === 1) { halvesInstant(); return; }
    /* scene 3 opens on the kept half aside, with the rows found */
    Tri.instant(tL);
    tL.writeVal('CA', T('val2')); tL.writeVal('AB', T('val1')); tL.writeVal('BC', T('lblRoot3Units'));
    tL.writeAngle('C', T('lblDeg30')); tL.writeAngle('A', T('lblDeg60'));
    M.set(vals(tL).concat([tL.arcs.C, tL.angles.C, tL.arcs.A, tL.angles.A]), { opacity: 1 });
    M.set(dom.gL, { x: CENTRE_X + K.SHIFT });
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
