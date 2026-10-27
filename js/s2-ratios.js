/* ==========================================================================
 * s2-ratios.js -- Section 2: the ratios, and the 45° triangle
 * --------------------------------------------------------------------------
 * Storyboard pages 14-34. Three scenes:
 *
 *   Recall the ratios.  The first triangle again, named; it slides to the
 *     left half and the header asks, row by row, which two sides make sin θ,
 *     cos θ and tan θ -- each a fraction of two dropdown blanks. "Now let's
 *     use these ratios to find the values for a few familiar angles." Next.
 *   The 45° triangle.  "We'll start with 45°." The rows give way and the
 *     triangle comes to the middle of the board, set low so it has room to
 *     grow; its top corner glows, and the learner drags it up until the
 *     angle is 45°. The missing angle is asked for with the answers under
 *     the triangle. Next. The triangle goes back to the left half, the two
 *     equal sides are given 1 unit each, the hypotenuse is found by
 *     Pythagoras (√2), and sin 45° is worked; cos 45° and tan 45° are the
 *     learner's. Next.
 *   The table.  The three values go into the table. "Next up are 30° and
 *     60°." Next.
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion, Flow = global.Flow, Beats = global.Beats;
  var Pages = global.Pages, Tri = global.Tri, W = global.W, S1 = global.S1;
  if (!Pages || !Tri || !W || !S1) { console.error('s2-ratios.js: load pages.js, tri.js, widgets.js and s1-sides.js first.'); return; }
  var K = Pages.kit;
  var BEAT = K.BEAT, SHORT = K.SHORT;
  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  var quiet = K.quiet;

  var BASE = 300;              /* the base's length, picture units          */
  var START_DEG = 35;
  /* From the 45° triangle on, the figure stands this much lower: a 45°
     triangle is as tall as its base is long, and its top corner -- and
     the drag past 45° -- needs the room above it. */
  var DROP = 50;

  var dom = null;
  var t = null;
  var rows = {};               /* sin, cos, tan: the ratio rows            */

  function build() {
    dom = Object.create(K.dom());
    dom.g = document.getElementById('figS2');
    t = Tri.create(dom.g, { A: S1.A, B: S1.B, C: S1.C, right: 'B', theta: 'A' });
    buildGrab();
    reset();
  }

  /* The triangle at `deg`: the base held, the far corner carried up. */
  function shapeAt(deg) {
    var h = BASE * Math.tan(deg * Math.PI / 180);
    t.set(null, null, { x: S1.B.x, y: S1.B.y - h });
    if (grab) placeGrab();
  }

  /* ======================================================================
   * The top corner, taken in hand
   * The 45° triangle is made by carrying C up its side: the corner glows,
   * the hand shows the pull, and the learner drags it. The angle at A is
   * worked out from the height C is held at, and the triangle redrawn
   * from it every frame. Let go within SNAP of 45°, it is caught there
   * and locked; ask() resolves when it is. Arrow keys move it a degree
   * at a time.
   * ====================================================================== */
  var MIN_DEG = 20, MAX_DEG = 50, TARGET = 45, SNAP = 2;
  var HALO_R = 15;             /* the glow round the corner                 */
  var HIT_R = 42;              /* where a finger catches it                 */
  var HAND_PX = 46;            /* the hand's height, per picture unit's px  */

  var grab = null;

  function buildGrab() {
    var g = Tri.el('g', { 'class': 'grab', hidden: '', role: 'slider', tabindex: '-1',
                          'aria-valuemin': MIN_DEG, 'aria-valuemax': MAX_DEG }, dom.g);
    grab = {
      el: g,
      halo: Tri.el('circle', { 'class': 'grab__halo', r: HALO_R }, g),
      hit: Tri.el('circle', { 'class': 'grab__hit', r: HIT_R }, g),
      deg: START_DEG, live: false, locked: false,
      held: false, pid: null, offY: 0, stopHand: null
    };
    g.addEventListener('pointerdown', grabDown);
    g.addEventListener('pointermove', grabMove);
    g.addEventListener('pointerup', grabUp);
    g.addEventListener('pointercancel', grabUp);
    g.addEventListener('keydown', grabKey);
  }
  function placeGrab() {
    var c = t.V.C;
    [grab.halo, grab.hit].forEach(function (e) {
      e.setAttribute('cx', Tri.round2(c.x));
      e.setAttribute('cy', Tri.round2(c.y));
    });
  }
  /* The triangle turned to `deg`, its measure written at A. */
  function turnTo(deg) {
    grab.deg = Math.max(MIN_DEG, Math.min(MAX_DEG, deg));
    shapeAt(grab.deg);
    t.writeAngle('A', T('lblDegVal', { n: Math.round(grab.deg) }));
    grab.el.setAttribute('aria-valuenow', Math.round(grab.deg));
  }

  /* Between the page and the picture's own units, through the group's
     slide and the figure's scale alike. */
  function toLocal(ev) {
    var m = dom.g.getScreenCTM();
    return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : t.V.C;
  }
  function toScreen(p) {
    var m = dom.g.getScreenCTM();
    return m ? new DOMPoint(p.x, p.y).matrixTransform(m) : p;
  }
  function degAt(y) { return Math.atan2(t.V.B.y - y, BASE) * 180 / Math.PI; }
  function apexAt(deg) { return { x: t.V.B.x, y: t.V.B.y - BASE * Math.tan(deg * Math.PI / 180) }; }

  function stopHand() {
    if (grab.stopHand) { grab.stopHand(); grab.stopHand = null; }
  }
  function tryLock() {
    if (grab.locked || Math.abs(grab.deg - TARGET) > SNAP) return false;
    grab.locked = true;
    grab.live = false;
    grab.el.classList.remove('is-held');
    turnTo(TARGET);
    Beats.pop();
    quiet(Flow.anim(Beats.partPulse(t.dots.C, { times: 1 })));
    dom.gate.click();
    return true;
  }
  /* The finger is held where it caught the corner, not snapped onto it. */
  function grabDown(ev) {
    if (!grab.live) return;
    grab.held = true;
    grab.pid = ev.pointerId;
    grab.offY = t.V.C.y - toLocal(ev).y;
    stopHand();
    grab.el.classList.add('is-held');
    try { grab.el.setPointerCapture(ev.pointerId); } catch (e) {}
    ev.preventDefault();
  }
  function grabMove(ev) {
    if (!grab.held || ev.pointerId !== grab.pid) return;
    turnTo(degAt(toLocal(ev).y + grab.offY));
  }
  function grabUp(ev) {
    if (!grab.held || ev.pointerId !== grab.pid) return;
    grab.held = false;
    grab.el.classList.remove('is-held');
    if (!tryLock() && Math.abs(grab.deg - TARGET) <= SNAP * 3) {
      /* close, but not there: eased the rest of the way, as a thing is
         caught by the place it belongs */
      var from = grab.deg;
      var p = { t: 0 };
      quiet(Flow.anim(M.to(p, { t: 1, duration: M.dur(0.3), ease: M.SNAP,
        onUpdate: function () { turnTo(from + (TARGET - from) * p.t); } })).then(tryLock));
    }
  }
  function grabKey(ev) {
    if (!grab.live) return;
    var step = (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') ? 1 :
               (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') ? -1 : 0;
    if (!step) return;
    ev.preventDefault();
    stopHand();
    turnTo(Math.round(grab.deg) + step);
    tryLock();
  }

  /* The corner lit, and live: the hand shows the pull up to where 45°
     is, until the learner takes hold. A skip carries it there. */
  function askGrab() {
    grab.live = true;
    grab.locked = false;
    grab.el.setAttribute('tabindex', '0');
    grab.el.setAttribute('aria-label', T('a11yApex'));
    grab.el.classList.add('is-asking');
    t.dots.C.classList.add('is-lit');
    var m = dom.g.getScreenCTM();
    grab.stopHand = W.handDrag(
      function () { return toScreen(t.V.C); },
      function () { return toScreen(apexAt(TARGET)); },
      HAND_PX * (m ? m.a : 1));
    return Flow.once(dom.gate, { auto: true }).then(function () {
      if (!grab.locked) { grab.locked = true; turnTo(TARGET); }
      grabOff();
    }, function (err) { grabOff(); throw err; });
  }
  function grabOff() {
    grab.live = false;
    grab.held = false;
    stopHand();
    grab.el.setAttribute('tabindex', '-1');
    grab.el.classList.remove('is-asking', 'is-held');
    t.dots.C.classList.remove('is-lit');
  }

  /* The rows of the first scene, written in whole for the second to open
     on, with no animation. */
  function rowsInstant() {
    W.pane.show();
    [['sin', 'eqSinTheta', 'wOpposite', 'wHypotenuse'],
     ['cos', 'eqCosTheta', 'wAdjacent', 'wHypotenuse'],
     ['tan', 'eqTanTheta', 'wOpposite', 'wAdjacent']].forEach(function (r) {
      var row = W.eqRow(T(r[1]));
      W.write(row.A.n, T(r[2])); W.write(row.A.d, T(r[3]));
      row.A.n.className += ' c-' + roleOf(r[2]); row.A.d.className += ' c-' + roleOf(r[3]);
      row.A.el.removeAttribute('hidden');
      M.set([row.el, row.A.el], { clearProps: 'opacity,transform' });
      rows[r[0]] = row;
    });
  }
  function roleOf(key) { return { wOpposite: 'opp', wAdjacent: 'adj', wHypotenuse: 'hyp' }[key]; }

  /* A wrong pick in a blank: the header says so. */
  function notQuite() { quiet(K.speak(K.keyed('fbNotQuite'))); }

  /* ======================================================================
   * Scene 1 -- recall the ratios
   * ====================================================================== */
  function sceneRatios() {
    return K.wipeBoard()
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        shapeAt(START_DEG);
        return Tri.draw(t, { time: 1.4, hold: 120 });
      })
      .then(function () { return Tri.angleIn(t, 'A', T('lblTheta')); })
      .then(function () { return Tri.nameSides(t, ['opp', 'adj', 'hyp'], 120); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return K.say('s2Back', function () {
          return Flow.anim(Beats.moveGroup(dom.g, K.aside(dom.g), 0.9));
        });
      })
      .then(function () {
        W.pane.show();
        return Flow.wait(SHORT);
      })
      .then(function () { return askRow('sin', 'eqSinTheta', 's2SinAsk', 'wOpposite', 'wHypotenuse', false); })
      .then(function () { return askRow('cos', 'eqCosTheta', 's2CosAsk', 'wAdjacent', 'wHypotenuse', false); })
      .then(function () { return askRow('tan', 'eqTanTheta', 's2TanAsk', 'wOpposite', 'wAdjacent', true); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.say('s2UseRatios'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* One ratio asked: the row arrives, the header asks, the two blanks are
     filled, and the row is told right. The sides named light as their
     words are chosen. */
  function askRow(which, lhsKey, askKey, num, den, last) {
    var row = W.eqRow(T(lhsKey));
    rows[which] = row;
    Object.keys(rows).forEach(function (k) { if (k !== which) rows[k].el.classList.add('is-done'); });
    return Flow.anim(Beats.rowIn(row.el))
      .then(function () { return K.say(askKey); })
      .then(function () {
        return W.askRatio(row, {
          num: num, den: den,
          onWrong: notQuite
        });
      })
      .then(function () {
        quiet(Flow.anim(Beats.linePulse([t.side(roleOf(num)), t.side(roleOf(den))])));
        return last ? K.praise() : K.speak(K.keyed('fbCorrect'));
      })
      .then(function () { return Flow.wait(SHORT); });
  }

  /* ======================================================================
   * Scene 2 -- the 45° triangle
   * ====================================================================== */
  function sceneForty5() {
    var hypRow = null, hypPills = null;
    return ensureRows()
      .then(function () { return K.say('s2Start45'); })
      .then(function () { return Flow.wait(SHORT); })
      /* the rows give way, and the triangle comes to the middle, low */
      .then(function () {
        return Promise.all([
          W.pane.out(),
          Flow.anim(Beats.moveGroup(dom.g, { x: 0, y: DROP }, 0.9))
        ]);
      })
      /* the top corner lit and handed over, while the pull is asked for */
      .then(function () {
        /* the angle's measure takes θ's place while the corner is in hand */
        turnTo(START_DEG);
        grab.el.removeAttribute('hidden');
        M.set(grab.el, { opacity: 0 });
        quiet(Flow.anim(Beats.marksIn(grab.el, 0.3)));
        return Promise.all([K.say('s2Drag45'), askGrab()]);
      })
      .then(function () {
        turnTo(TARGET);
        t.writeAngle('A', T('lblDeg45'));
        return Promise.all([
          K.say('s2Now45'),
          Flow.anim(Beats.marksOut(grab.el)).then(function () { grab.el.setAttribute('hidden', ''); })
        ]);
      })
      .then(function () { return Flow.wait(SHORT); })

      /* ---- the missing angle: the answers under the triangle -------------- */
      .then(function () {
        t.writeAngle('C', T('lblQ'));
        return Promise.all([
          K.say('s2Missing'),
          Flow.anim(Beats.labelIn(t.angles.C))
        ]);
      })
      .then(function () {
        var btns = K.buildChoices(dom.choices, K.shuffle([T('lblDeg30'), T('lblDeg45'), T('lblDeg60')]));
        K.choices(btns);
        return Flow.anim(Beats.trayIn(dom.choices, btns)).then(function () {
          var right = btns.map(function (b) { return b.dataset.name; }).indexOf(T('lblDeg45'));
          return K.askUntilRight(btns, right, { onWrong: notQuite });
        }).then(function () {
          return Promise.all([
            Flow.anim(Beats.relabel(t.angles.C, function () { t.angles.C.textContent = T('lblDeg45'); })),
            Flow.anim(Beats.growLine(t.arcs.C, 0.45, 'power2.inOut')),
            K.speak(K.keyed('fbCorrect'))
          ]);
        });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); })
      /* the answers go, and the triangle back to the left half */
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.trayOut(dom.choices, K.choices())).then(function () { K.resetFooter(); }),
          Flow.anim(Beats.moveGroup(dom.g, K.aside(dom.g), 0.9))
        ]);
      })
      .then(function () {
        W.pane.show();
        return Flow.wait(SHORT);
      })

      /* ---- the two equal sides ------------------------------------------- */
      .then(function () {
        quiet(K.onPhrase('s2Both45', 'equal', function () {
          return Flow.anim(Beats.linePulse([t.sides.AB, t.sides.BC]));
        }));
        return K.say('s2Both45');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Tri.unname(t); })
      .then(function () {
        quiet(K.onPhrase('s2Base1', 'base', function () {
          return Flow.anim(Beats.labelIn(t.writeVal('AB', T('lblUnit1'))));
        }));
        quiet(K.onPhrase('s2Base1', 'also', function () {
          return Flow.anim(Beats.labelIn(t.writeVal('BC', T('lblUnit1'))));
        }));
        return K.speakBySentence('s2Base1');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s2TwoSides', 'two', function () {
          return Flow.anim(Beats.textPulse([t.vals.AB, t.vals.BC], 2));
        }));
        return K.say('s2TwoSides');
      })
      .then(function () {
        return Flow.anim(Beats.labelIn(t.writeVal('CA', T('lblQ'))));
      })
      .then(function () { return Flow.wait(SHORT); })

      /* ---- Pythagoras ---------------------------------------------------- */
      .then(function () {
        hypRow = W.eqRow(T('eqHyp'), 'eq--ask');
        W.write(hypRow.val, T('lblQ'));
        hypRow.val.removeAttribute('hidden');
        return Promise.all([
          K.say('s2PythHyp'),
          Flow.anim(Beats.rowIn(hypRow.el))
        ]);
      })
      .then(function () {
        hypPills = W.pills(K.shuffle([T('val2'), T('valRoot2'), T('val1')]));
        return Flow.anim(Beats.rowIn(hypPills.el));
      })
      .then(function () {
        var right = hypPills.btns.map(function (b) { return b.dataset.name; }).indexOf(T('valRoot2'));
        return K.askUntilRight(hypPills.btns, right, { onWrong: notQuite });
      })
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.swapIn(hypRow.val, function () { W.write(hypRow.val, T('valRoot2')); }))
            .then(function () { return Flow.anim(Beats.slotRight(hypRow.val)); }),
          Flow.anim(Beats.relabel(t.vals.CA, function () { t.vals.CA.textContent = T('valRoot2'); }))
        ]);
      })
      .then(function () { return W.pane.drop(hypPills.el); })
      .then(function () {
        quiet(K.onPhrase('s2HypRoot2', 'hypotenuse', function () {
          return Flow.anim(Beats.linePulse(t.sides.CA));
        }));
        return K.say('s2HypRoot2');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        quiet(K.onPhrase('s2AllThree', 'three', function () {
          return Flow.anim(Beats.textPulse([t.vals.AB, t.vals.BC, t.vals.CA], 2));
        }));
        return K.say('s2AllThree');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return W.pane.drop(hypRow.el); })

      /* ---- sin 45°, worked ----------------------------------------------- */
      .then(function () {
        var row = W.eqRow(T('eqSinDeg', { a: 45 }));
        rows.sin45 = row;
        return Promise.all([
          K.say('s2Sin45'),
          Flow.anim(Beats.rowIn(row.el))
        ]).then(function () {
          return showWords(row, 'opp', 'hyp');
        }).then(function () { return Flow.wait(SHORT); })
          .then(function () { return Flow.anim(row.showB(T('val1'), T('valRoot2'))); });
      })
      .then(function () { return Flow.wait(BEAT); })

      /* ---- your turn: cos 45° and tan 45° -------------------------------- */
      .then(function () {
        rows.sin45.el.classList.add('is-done');
        return K.say('s2YourTurn45');
      })
      .then(function () {
        return yourTurn('cos', 45, 'wAdjacent', 'wHypotenuse', [T('val1'), T('valRoot2')], null);
      })
      .then(function () {
        rows.cos45.el.classList.add('is-done');
        return yourTurn('tan', 45, 'wOpposite', 'wAdjacent', [T('val1'), T('val1')], T('val1'));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        Object.keys(rows).forEach(function (k) { rows[k].el.classList.remove('is-done'); });
        return K.praise();
      })
      .then(function () { return K.say('s2Found45'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* The words of a ratio written into a row's first fraction, coloured. */
  function showWords(row, n, d) {
    var names = { opp: 'wOpposite', adj: 'wAdjacent', hyp: 'wHypotenuse' };
    row.A.n.className = 'eq__n c-' + n;
    row.A.d.className = 'eq__d c-' + d;
    quiet(Flow.anim(Beats.linePulse([t.side(n), t.side(d)])));
    return Flow.anim(row.showA(T(names[n]), T(names[d])));
  }

  /* One of the learner's ratios: the row with its two blanks, asked; then
     the lengths put in after it, and the value if it simplifies. */
  function yourTurn(which, deg, num, den, lengths, value) {
    var key = { sin: 'eqSinDeg', cos: 'eqCosDeg', tan: 'eqTanDeg' }[which];
    var row = W.eqRow(T(key, { a: deg }));
    rows[which + deg] = row;
    return Flow.anim(Beats.rowIn(row.el))
      .then(function () {
        return W.askRatio(row, { num: num, den: den, onWrong: notQuite });
      })
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

  /* The second scene opens on the first's last board: the triangle aside,
     named, θ at A, the three rows on the pane, the header up. If
     it is not there (the scene played from the level bar), it is written
     in whole. */
  function ensureRows() {
    if (!dom.g.hasAttribute('hidden') && !dom.pane.hasAttribute('hidden')) return Promise.resolve();
    shapeAt(START_DEG);
    Tri.instant(t);
    t.writeAngle('A', T('lblTheta'));
    M.set([t.arcs.A, t.angles.A], { opacity: 1 });
    t.colourRoles(true);
    t.writeWord('opp', T('lblOpposite')); t.writeWord('adj', T('lblAdjacent')); t.writeWord('hyp', T('lblHypotenuse'));
    M.set(Object.keys(t.words).map(function (s) { return t.words[s]; }), { opacity: 1 });
    M.set(dom.g, K.aside(dom.g));
    rowsInstant();
    return Promise.resolve();
  }

  /* ======================================================================
   * Scene 3 -- the table
   * ====================================================================== */
  function sceneTable() {
    return Promise.resolve()
      .then(function () { return K.say('s2AddTable'); })
      .then(function () {
        return Promise.all([
          W.pane.out(),
          Flow.anim(Beats.clearFigure([dom.g]))
        ]);
      })
      .then(function () {
        dom.g.setAttribute('hidden', '');
        return W.table.show();
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return W.table.fillColumn(45, { sin: T('valOneOverRoot2'), cos: T('valOneOverRoot2'), tan: T('val1') });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.say('s2Next3060'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* ---- the hooks ---------------------------------------------------------- */
  function parts() { return t.parts().concat([grab.el]); }
  function wipe() { return []; }
  function reset() {
    grabOff();
    grab.el.setAttribute('hidden', '');
    t.reset();
    t.setTheta('A');
    shapeAt(START_DEG);
    dom.g.setAttribute('hidden', '');
    rows = {};
  }
  /* The board as each scene expects to find it. Scene 1 wipes; scene 2
     writes its own opening in (ensureRows); scene 3 opens on the 45°
     triangle's finished board -- the values found -- which it takes
     down at once, so nothing is staged. */
  function stage(local) {
    if (local <= 0) return;
    if (local === 1) { ensureRows(); return; }
    shapeAt(45);
    Tri.instant(t);
    M.set(dom.g, K.aside(dom.g));
  }

  Pages.addSection({
    name: 'The ratios',
    scenes: [
      { name: 'Recall the ratios', play: sceneRatios },
      { name: 'The 45° triangle',  play: sceneForty5 },
      { name: 'Table: 45°',        play: sceneTable }
    ],
    build: build,
    parts: parts,
    wipe: wipe,
    reset: reset,
    stage: stage
  });
})(window);
