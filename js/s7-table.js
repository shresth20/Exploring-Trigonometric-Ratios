/* ==========================================================================
 * s7-table.js -- Section 7: the complete table
 * --------------------------------------------------------------------------
 * Storyboard pages 80-89. One scene: the 90° values go into the table, and
 * "Our table is complete! You've found the sine, cosine and tangent values
 * for all five angles." -- the bird celebrates under a shower of confetti.
 * Next takes the board away and leaves the bird waving on the field.
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion, Flow = global.Flow, Beats = global.Beats;
  var Pages = global.Pages, W = global.W;
  if (!Pages || !W) { console.error('s7-table.js: load pages.js and widgets.js first.'); return; }
  var K = Pages.kit;
  var BEAT = K.BEAT, SHORT = K.SHORT;
  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  var quiet = K.quiet;

  var dom = null, mascot = null;

  function build() {
    dom = Object.create(K.dom());
    mascot = K.mascot();
  }

  function rememberAll() {
    W.table.remember('sin', 45, T('valOneOverRoot2')); W.table.remember('cos', 45, T('valOneOverRoot2')); W.table.remember('tan', 45, T('val1'));
    W.table.remember('sin', 30, T('valHalf')); W.table.remember('cos', 30, T('valRoot3Over2')); W.table.remember('tan', 30, T('valOneOverRoot3'));
    W.table.remember('sin', 60, T('valRoot3Over2')); W.table.remember('cos', 60, T('valHalf')); W.table.remember('tan', 60, T('valRoot3'));
    W.table.remember('sin', 0, T('val0')); W.table.remember('cos', 0, T('val1')); W.table.remember('tan', 0, T('val0'));
  }

  function scene() {
    return Promise.resolve()
      .then(function () {
        rememberAll();
        return Promise.all([
          W.pane.out(),
          Flow.anim(Beats.clearFigure([document.getElementById('figS6')]))
        ]);
      })
      .then(function () {
        document.getElementById('figS6').setAttribute('hidden', '');
        return W.table.show();
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        var c = W.table.cell('tan', 90);
        if (c) c.el.classList.add('is-undef');
        return W.table.fillColumn(90, { sin: T('val1'), cos: T('val0'), tan: T('valUndefined') });
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        K.celebrate();
        return Flow.wait(Beats.ringing()).then(function () {
          return K.speakBySentence('s7Complete', 'happy');
        });
      })
      .then(function () {
        mascot.state('celebrating');
        return Flow.wait(1600);
      })
      .then(function () {
        mascot.settle();
        return Flow.wait(SHORT);
      })
      .then(function () { return K.handOver(); })
      /* ---- the lesson closes: the board goes, the bird is on the field ---- */
      .then(function () { return K.wipeBoard(); })
      .then(function () {
        mascot.placeIn(dom.slotHero);
        mascot.el.classList.remove('is-away');
        mascot.idle();
        return Flow.anim(Beats.boardOut(dom.board));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        mascot.state('waving');
        return Flow.wait(2400);
      })
      .then(function () { mascot.settle(); });
  }

  function parts() { return []; }
  function wipe() { return []; }
  function reset() {}
  function stage() {
    mascot.placeIn(dom.slotHeader);
    mascot.el.classList.remove('is-away');
    mascot.idle();
    rememberAll();
    W.table.place();
  }

  Pages.addSection({
    name: 'The complete table',
    scenes: [{ name: 'The complete table', play: scene }],
    build: build,
    parts: parts,
    wipe: wipe,
    reset: reset,
    stage: stage
  });
})(window);
