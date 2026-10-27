/* ==========================================================================
 * s6-ninety.js -- Section 6: towards 90°
 * --------------------------------------------------------------------------
 * Storyboard pages 71-79. One scene:
 *
 *   Triangle ABC, the right angle at B, BC fixed at 4. "Now let's explore
 *   90°. Move the slider and watch A move towards B." As angle A grows, A
 *   slides along the base towards B: AB gets shorter and AC gets closer to
 *   4. At 90°, A reaches B -- the adjacent side is zero and the other two
 *   sides overlap. Its distances extend the ratios to 90°: sin 90° = 1,
 *   cos 90° = 0, and tan 90° = 4/0 -- undefined. Next.
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion, Flow = global.Flow, Beats = global.Beats;
  var Pages = global.Pages, Tri = global.Tri, W = global.W;
  if (!Pages || !Tri || !W) { console.error('s6-ninety.js: load pages.js, tri.js and widgets.js first.'); return; }
  var K = Pages.kit;
  var BEAT = K.BEAT, SHORT = K.SHORT;
  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  var quiet = K.quiet;

  var UNIT = 60;
  var B0 = { x: 600, y: 340 };
  var C0 = { x: 600, y: 340 - 4 * UNIT };
  var START_DEG = 60;

  var dom = null;
  var t = null;
  var saidCloser = false;

  function build() {
    dom = Object.create(K.dom());
    dom.g = document.getElementById('figS6');
    t = Tri.create(dom.g, { A: aAt(START_DEG), B: B0, C: C0, right: 'B', theta: 'A' });
    reset();
  }

  function approx(n) { return T('lblApprox', { v: (Math.round(n * 100) / 100).toFixed(2) }); }
  function aAt(deg) {
    if (deg >= 89.95) return { x: B0.x, y: B0.y };
    return { x: B0.x - 4 * UNIT / Math.tan(deg * Math.PI / 180), y: B0.y };
  }
  /* The triangle at angle A = deg, and the lengths beside its sides. */
  function shapeAt(deg) {
    t.set(aAt(deg), null, null);
    t.writeAngle('A', T('lblDegVal', { n: Math.round(deg) }));
    t.writeVal('BC', T('val4'));
    var a = deg * Math.PI / 180;
    if (deg >= 89.95) {
      t.writeVal('CA', T('lblAC4'));
      t.writeVal('BC', T('lblBC4'));
      t.writeVal('AB', T('lblAB0'));
      t.writeName('B', T('lblAeqB'));
      t.writeName('A', '');
      /* a line: AB's nothing is written under its end, the angle's arc
         has no opening to draw, and the right angle's square goes */
      t.vals.AB.setAttribute('x', B0.x); t.vals.AB.setAttribute('y', B0.y + 52);
      t.vals.AB.setAttribute('dy', '.36em'); t.vals.AB.setAttribute('text-anchor', 'middle');
      t.vals.AB.removeAttribute('transform');
      t.names.B.setAttribute('x', B0.x); t.names.B.setAttribute('y', B0.y + 26);
      t.arcs.A.setAttribute('d', '');
      t.square.setAttribute('d', '');
      /* the angle's measure beside the foot of the line, where A has come
         to rest, rather than up the line where its bisector would put it */
      t.angles.A.setAttribute('x', B0.x - 52); t.angles.A.setAttribute('y', B0.y - 18);
      t.angles.A.setAttribute('dy', '0');
    } else {
      t.writeVal('CA', approx(4 / Math.sin(a)));
      t.writeVal('AB', approx(4 / Math.tan(a)));
      t.writeName('A', T('lblA'));
      t.writeName('B', T('lblB2'));
    }
    t.writeName('C', T('lblC'));
  }

  function scene() {
    var slider = null;
    saidCloser = false;
    return K.wipeBoard()
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        shapeAt(START_DEG);
        quiet(K.onPhrase('s6Explore90', 'slider', function () {
          return Flow.anim(Beats.slideGroup(dom.g, K.SHIFT, 0.9)).then(function () {
            W.pane.show();
            slider = W.slider({
              min: START_DEG, max: 90, value: START_DEG, target: 90, snap: 1.5,
              label: T('lblAngleA'),
              onChange: function (v) {
                shapeAt(v);
                if (!saidCloser && v >= 74) {
                  saidCloser = true;
                  quiet(K.speakBySentence('s6Closer'));
                }
              }
            });
            return Flow.anim(Beats.rowIn(slider.el));
          });
        }));
        /* the first piece of the line is said as the triangle is drawn;
           the rest follow one at a time */
        var pieces = K.sentencesOf(T('s6Explore90')) || [T('s6Explore90')];
        return K.say({ text: pieces[0], vo: null }, function () {
          return Tri.draw(t, { time: 1.4, hold: 120 })
            .then(function () { return Flow.anim(Beats.marksIn(['A', 'B', 'C'].map(function (v) { return t.names[v]; }), 0.3)); })
            .then(function () { return Tri.angleIn(t, 'A', T('lblDegVal', { n: START_DEG })); })
            .then(function () { return Flow.anim(Beats.marksIn([t.vals.BC, t.vals.CA, t.vals.AB], 0.4)); });
        }).then(function () {
          return pieces.slice(1).reduce(function (chain, s) {
            return chain.then(function () { return K.speak(s); });
          }, Promise.resolve());
        });
      })
      .then(function () {
        if (!slider) {
          /* the slider's cue never fired (the line was skipped): put it up */
          return Flow.anim(Beats.slideGroup(dom.g, K.SHIFT, 0.9)).then(function () {
            W.pane.show();
            slider = W.slider({
              min: START_DEG, max: 90, value: START_DEG, target: 90, snap: 1.5,
              label: T('lblAngleA'), onChange: function (v) { shapeAt(v); }
            });
            return Flow.anim(Beats.rowIn(slider.el));
          });
        }
      })
      .then(function () { return slider.ask(); })
      .then(function () {
        shapeAt(90);
        M.set(t.names.A, { opacity: 0 });
        return Flow.wait(SHORT);
      })
      .then(function () {
        quiet(K.onPhrase('s6At90', 'adjacent', function () {
          return Flow.anim(Beats.textPulse([t.vals.AB], 2));
        }));
        quiet(K.onPhrase('s6At90', 'overlap', function () {
          return Flow.anim(Beats.linePulse([t.sides.CA, t.sides.BC]));
        }));
        return K.speakBySentence('s6At90');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return W.pane.drop(slider.el); })
      .then(function () {
        var facts = factsRow(T('lblOpp4'), T('lblAdj0'), T('lblHyp4'));
        return Promise.all([
          K.speakBySentence('s6Line'),
          Flow.anim(Beats.rowIn(facts))
        ]);
      })
      .then(function () { return ratio('defSine', 'eqSinDeg', 90, 'opp', 'hyp', T('val4'), T('val4'), T('val1')); })
      .then(function () { return ratio('defCosine', 'eqCosDeg', 90, 'adj', 'hyp', T('val0'), T('val4'), T('val0')); })
      .then(function () {
        return ratio('defTangent', 'eqTanDeg', 90, 'opp', 'adj', T('val4'), T('val0'), null);
      })
      .then(function (row) {
        return K.say('s6Undefined').then(function () {
          row.val.classList.add('is-undef');
          return Flow.anim(row.showVal(T('valUndefined')));
        });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  function factsRow(a, b, c) {
    var row = W.pane.row('facts');
    [['fact--opp', a], ['fact--adj', b], ['fact--hyp', c]].forEach(function (f) {
      var s = W.h('span', 'fact ' + f[0], row);
      W.write(s, f[1]);
    });
    return row;
  }

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
      .then(function () {
        if (value == null) return;
        return Flow.anim(row.showVal(value));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return row; });
  }

  /* ---- the hooks ---------------------------------------------------------- */
  function parts() { return t.parts(); }
  function wipe() { return []; }
  function reset() {
    t.reset();
    saidCloser = false;
    dom.g.setAttribute('hidden', '');
  }
  function stage() {}

  Pages.addSection({
    name: 'Towards 90°',
    scenes: [{ name: 'Towards 90°', play: scene }],
    build: build,
    parts: parts,
    wipe: wipe,
    reset: reset,
    stage: stage
  });
})(window);
