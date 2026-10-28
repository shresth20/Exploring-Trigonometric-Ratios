/* ==========================================================================
 * s8-more.js -- Section 8: cosec, sec and cot
 * --------------------------------------------------------------------------
 * Storyboard pages 80-89. The table of sin, cos and tan is complete; three
 * more rows are added to it, one scene each, and each the same three pages:
 *
 *   Remember.  The new row joins the table, empty, lit with the row it is
 *     worked from, and its formula stands under the table: "Remember, cosec
 *     is the reciprocal of sine." Next.
 *   Your turn.  "Can you use the sine values to complete this new row?" A
 *     blank in each of its five cells, three values to choose from in
 *     each, judged as it is picked: a right one kept, a wrong one struck
 *     off and emptied for another go, until the whole row is right.
 *   Right.  "That's right! Each cosec value is the reciprocal of the sine
 *     value." Next.
 *
 *   cosec θ = 1/sin θ (pages 80-82), sec θ = 1/cos θ (83-85), and
 *   cot θ = cos θ/sin θ (86-88). Then the whole table, with nothing lit:
 *   "There we go! Our table is complete." (89). Next takes the board away
 *   and leaves the swamp.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats;
  var Pages = global.Pages, W = global.W;
  if (!Pages || !W) { console.error('s8-more.js: load pages.js and widgets.js first.'); return; }
  var K = Pages.kit;
  var BEAT = K.BEAT, SHORT = K.SHORT;
  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  var quiet = K.quiet;

  /* Each new row: the rows it is worked from, its lines, its formula, and
     its five values, by key. */
  var ROWS = {
    cosec: {
      from: ['sin'], recall: 's8CosecRecall', ask: 's8CosecAsk', done: 's8CosecDone',
      lhs: 'eqCosecTheta', n: 'val1', d: 'lblSinTheta',
      answers: { 0: 'valUndefined', 30: 'val2', 45: 'valRoot2', 60: 'valTwoOverRoot3', 90: 'val1' }
    },
    sec: {
      from: ['cos'], recall: 's8SecRecall', ask: 's8SecAsk', done: 's8SecDone',
      lhs: 'eqSecTheta', n: 'val1', d: 'lblCosTheta',
      answers: { 0: 'val1', 30: 'valTwoOverRoot3', 45: 'valRoot2', 60: 'val2', 90: 'valUndefined' }
    },
    cot: {
      from: ['sin', 'cos'], recall: 's8CotRecall', ask: 's8CotAsk', done: 's8CotDone',
      lhs: 'eqCotTheta', n: 'lblCosTheta', d: 'lblSinTheta',
      answers: { 0: 'valUndefined', 30: 'valRoot3', 45: 'val1', 60: 'valOneOverRoot3', 90: 'val0' }
    }
  };
  var ORDER = ['cosec', 'sec', 'cot'];

  /* What each blank offers, smallest first: three values -- the right
     one, the value it is worked from left un-flipped, and a near miss. */
  var OPTIONS = {
    cosec: {
      0:  ['val0', 'val1', 'valUndefined'],
      30: ['valHalf', 'valRoot2', 'val2'],
      45: ['valOneOverRoot2', 'valRoot2', 'val2'],
      60: ['valRoot3Over2', 'valTwoOverRoot3', 'valRoot3'],
      90: ['val0', 'val1', 'valUndefined']
    },
    sec: {
      0:  ['val0', 'val1', 'valUndefined'],
      30: ['valRoot3Over2', 'valTwoOverRoot3', 'valRoot3'],
      45: ['valOneOverRoot2', 'valRoot2', 'val2'],
      60: ['valHalf', 'valRoot2', 'val2'],
      90: ['val0', 'val1', 'valUndefined']
    },
    cot: {
      0:  ['val0', 'val1', 'valUndefined'],
      30: ['valOneOverRoot3', 'valRoot3Over2', 'valRoot3'],
      45: ['val0', 'val1', 'valRoot2'],
      60: ['valHalf', 'valOneOverRoot3', 'valRoot3'],
      90: ['val0', 'val1', 'valUndefined']
    }
  };

  var dom = null;

  function build() {
    dom = Object.create(K.dom());
  }

  /* A row's lists, by angle, as text. */
  function optionsFor(r) {
    var o = {};
    W.table.ANGLES.forEach(function (a) { o[a] = OPTIONS[r][a].map(function (k) { return T(k); }); });
    return o;
  }

  function notQuite() { quiet(K.speak(K.keyed('fbNotQuite'))); }

  function rememberAll() {
    var t = W.table;
    t.remember('sin', 0, T('val0')); t.remember('cos', 0, T('val1')); t.remember('tan', 0, T('val0'));
    t.remember('sin', 30, T('valHalf')); t.remember('cos', 30, T('valRoot3Over2')); t.remember('tan', 30, T('valOneOverRoot3'));
    t.remember('sin', 45, T('valOneOverRoot2')); t.remember('cos', 45, T('valOneOverRoot2')); t.remember('tan', 45, T('val1'));
    t.remember('sin', 60, T('valRoot3Over2')); t.remember('cos', 60, T('valHalf')); t.remember('tan', 60, T('valRoot3'));
    t.remember('sin', 90, T('val1')); t.remember('cos', 90, T('val0')); t.remember('tan', 90, T('valUndefined'));
  }
  /* A row as the table keeps it once it has been found. */
  function rememberRow(r) {
    W.table.rememberRow(r);
    W.table.ANGLES.forEach(function (a) { W.table.remember(r, a, T(ROWS[r].answers[a])); });
  }

  function ensureTable() {
    if (!dom.tableWrap.hasAttribute('hidden')) return Promise.resolve();
    rememberAll();
    return W.table.show();
  }

  /* ======================================================================
   * One new row: remember, your turn, right
   * ====================================================================== */
  function sceneRow(r) {
    var s = ROWS[r];
    return function () {
      var answers = {};
      W.table.ANGLES.forEach(function (a) { answers[a] = T(s.answers[a]); });
      return Promise.all([ensureTable(), W.table.noteOut()])
        .then(function () {
          W.table.focus(s.from);
          return Flow.wait(SHORT);
        })
        /* ---- remember: the row joins the table, and its formula ---- */
        .then(function () { return W.table.addRow(r); })
        .then(function () {
          W.table.focus(s.from.concat(r));
          return Promise.all([
            K.say(s.recall),
            Flow.wait(SHORT).then(function () { return W.table.note(T(s.lhs), T(s.n), T(s.d)); })
          ]);
        })
        .then(function () { return Flow.wait(BEAT); })
        .then(function () { return K.handOver(); })
        /* ---- your turn: the five blanks, each judged as it is picked ---- */
        .then(function () { return K.say(s.ask); })
        .then(function () {
          return W.table.askRow(r, {
            answers: answers,
            options: optionsFor(r),
            onWrong: notQuite
          });
        })
        /* ---- right ---- */
        .then(function () {
          K.celebrate();
          return Flow.wait(Beats.ringing()).then(function () { return K.say(s.done); });
        })
        .then(function () { return Flow.wait(BEAT); })
        .then(function () { return K.handOver(); });
    };
  }

  /* The cot row, and then the whole table with nothing lit; Next closes
     the lesson. */
  function sceneCot() {
    return sceneRow('cot')()
      .then(function () {
        return Promise.all([W.table.noteOut(), K.lineAway()]);
      })
      .then(function () {
        W.table.focus(null);
        return Flow.wait(SHORT);
      })
      .then(function () { return K.say('s8AllDone'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); })
      /* ---- the lesson closes: the board goes, and the swamp is left ---- */
      .then(function () { return K.wipeBoard(); })
      .then(function () { return Flow.anim(Beats.boardOut(dom.board)); });
  }

  /* ---- the hooks ---------------------------------------------------------- */
  function parts() { return []; }
  function wipe() { return []; }
  function reset() {}
  /* The table as scene i finds it: everything found before it, in. */
  function stage(i) {
    rememberAll();
    ORDER.slice(0, i).forEach(rememberRow);
    W.table.place();
  }

  Pages.addSection({
    name: 'Cosec, sec and cot',
    scenes: [
      { name: 'Cosec θ', play: sceneRow('cosec') },
      { name: 'Sec θ', play: sceneRow('sec') },
      { name: 'Cot θ', play: sceneCot }
    ],
    build: build,
    parts: parts,
    wipe: wipe,
    reset: reset,
    stage: stage
  });
})(window);
