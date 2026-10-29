/* ==========================================================================
 * s1-sides.js -- Section 1: the right-angled triangle and its sides
 * --------------------------------------------------------------------------
 * Storyboard pages 1-13. One scene, several pages:
 *
 *   1. The board opens and the pen draws the triangle. Then the header
 *      comes up saying "Here's a right-angled triangle." and the caption
 *      lands. "We'll call this angle theta." -- the arc goes on at A as
 *      "this angle" is said, the θ as "theta" is. The page turns.
 *   2. "Before we begin, let's recall the side names for this angle."
 *      The caption goes once the line is said. Three boxes arrive on the
 *      ends of dashed leaders, one per side, and the three names arrive
 *      in the tray. "Can you match each side to its
 *      name?" -- the drag is shown, and each name dropped right colours
 *      its side. A box given two wrong names is answered for the learner,
 *      its side and box lit as the reason is said ("This side is opposite
 *      θ."). "That's correct! These are the opposite side, adjacent side
 *      and hypotenuse." -- each side lit, with its box, as it is named.
 *      Next.
 *   3. The boxes go and the sides lose their colours. "What if we look at
 *      the triangle from this angle instead?" -- θ travels from A to C.
 *      Then the match of page 2 again, for θ at C: the same boxes on the
 *      same sides, but the opposite's and adjacent's have changed places.
 *      Once the names are in, they are written beside the sides. "Did you
 *      notice?" Two labelled views stand side by side: the first angle's
 *      and this one's. "The opposite and adjacent swap roles. The
 *      hypotenuse stays the same." -- the sides and their names lit in
 *      both as they are named. Next.
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion, Flow = global.Flow, Beats = global.Beats;
  var Pages = global.Pages, Tri = global.Tri, W = global.W;
  if (!Pages || !Tri || !W) { console.error('s1-sides.js: load pages.js, tri.js and widgets.js first.'); return; }
  var K = Pages.kit;
  var BEAT = K.BEAT, SHORT = K.SHORT;
  function T(key, repl) { return global.T ? global.T(key, repl) : key; }
  var quiet = K.quiet;

  /* The triangle: θ at A (bottom left), the right angle at B (bottom
     right), C above B. A 35° angle, as the storyboard's first slider
     page begins with. */
  var A = { x: 350, y: 345 }, B = { x: 650, y: 345 }, C = { x: 650, y: 135 };
  var DRAW_TIME = 2.4;
  /* How far each of the two triangles shrinks to stand side by side */
  var PAIR_K = 0.92;

  /* The three boxes round the triangle, each tied to its side by a leader
     that ends ON it. The adjacent box sits below the base, so its leader
     comes up from underneath and never crosses θ or the hypotenuse on the
     way. The hypotenuse's midpoint is nearly under its box's corner, and a
     leader to it would drop almost straight down; it lands higher up the
     side instead (HYP_AT of the way from A to C), at the same shallow
     slant as the adjacent's. The boxes stay on their sides wherever θ is;
     the name each one wants is its side's role for θ where it is now. */
  var HYP_AT = 0.63;
  function boxSpecs(t) {
    var r = t.roles();
    function nameOn(side) {
      return Object.keys(ROLE).filter(function (n) { return r[ROLE[n]] === side; })[0];
    }
    return [
      { name: nameOn('CA'), x: 230, y: 162,
        anchor: { x: A.x + (C.x - A.x) * HYP_AT, y: A.y + (C.y - A.y) * HYP_AT } },
      { name: nameOn('BC'), x: 730, y: 221, anchor: t.midOf('BC') },
      { name: nameOn('AB'), x: 170, y: 368, anchor: t.midOf('AB') }
    ];
  }

  /* The side a name is for: the box names a role, the role a side. */
  var ROLE = { lblOpposite: 'opp', lblAdjacent: 'adj', lblHypotenuse: 'hyp' };
  /* A box answered for the learner after this many wrong names, and the
     line that says why, by the name it wants. */
  var REVEAL_AFTER = 2;
  var HINT = { lblOpposite: 's1HintOpp', lblAdjacent: 's1HintAdj', lblHypotenuse: 's1HintHyp' };

  var dom = null;
  var t = null, t2 = null;
  var caption = null;
  var boxes = [];
  var boxDefs = null;

  function build() {
    dom = Object.create(K.dom());
    dom.g = document.getElementById('figS1');
    dom.g2 = document.getElementById('figS1b');
    dom.boxes = document.getElementById('figBoxes');
    t = Tri.create(dom.g, { A: A, B: B, C: C, right: 'B', theta: 'A' });
    t2 = Tri.create(dom.g2, { A: A, B: B, C: C, right: 'B', theta: 'A' });
    /* the caption sits under the base, centred on it */
    caption = K.el('text', { 'class': 'figure-label tri-caption', x: (A.x + B.x) / 2, y: 398, 'text-anchor': 'middle' });
    dom.g.appendChild(caption);
    boxDefs = K.el('defs');
    dom.boxes.appendChild(boxDefs);
    reset();
  }

  function buildBoxes() {
    clearBoxes();
    boxes = boxSpecs(t).map(function (b) { return K.buildBox(dom.boxes, boxDefs, b); });
  }
  function clearBoxes() {
    boxes = [];
    Array.prototype.slice.call(dom.boxes.children).forEach(function (c) {
      if (c !== boxDefs) dom.boxes.removeChild(c);
    });
    boxDefs.textContent = '';
  }
  function boxFor(name) {
    return boxes.filter(function (b) { return b.name === name; })[0];
  }

  /* A side and its box lit together: what names it. */
  function lightSide(box) {
    return Promise.all([
      Flow.anim(Beats.linePulse(t.side(ROLE[box.name]))),
      Flow.anim(Beats.boxPulse(box))
    ]);
  }
  /* A box answered for the learner: its side and box lit as the reason
     is said. */
  function explain(box) {
    return K.say(HINT[box.name], function () { return lightSide(box); });
  }

  /* The match, for θ where it is now. The boxes arrive on the ends of
     their leaders, the names in the tray, and the instruction is said --
     with the drag shown, if `guided`. Each name dropped right colours its
     side; a box given two wrong names is answered for the learner
     (explain). Once all three are in, the confetti, and each side lit
     with its box as it is named. */
  function matchSides(guided) {
    buildBoxes();
    dom.boxes.removeAttribute('hidden');
    return boxes.reduce(function (chain, b) {
      return chain.then(function () {
        return Flow.anim(Beats.boxIn(b)).then(function () { return Flow.wait(160); });
      });
    }, Promise.resolve())
      .then(function () {
        var chips = K.buildChips(dom.tray, K.shuffle(['lblOpposite', 'lblAdjacent', 'lblHypotenuse']));
        K.chips(chips);
        return Flow.anim(Beats.trayIn(dom.tray, chips));
      })
      .then(function () {
        var guide = null;
        return K.say('s1Match', function () {
          if (guided) guide = K.dragGuide(boxes[0].rect);
        }).then(function () {
          return K.armQuiz({ boxes: boxes }, K.chips(), {
            group: dom.boxes,
            revealAfter: REVEAL_AFTER,
            onWrong: function () { return quiet(K.speak(K.keyed('fbNotQuite'))); },
            onRight: function (box) {
              var role = ROLE[box.name];
              t.side(role).classList.add('tri__side--' + role);
              /* an answer given is lit by explain, with its line */
              if (!box.revealed) quiet(Flow.anim(Beats.linePulse(t.side(role))));
            },
            onReveal: explain
          }).then(function () { if (guide) guide.stop(); });
        });
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        K.celebrate();
        ['opposite', 'adjacent', 'hypotenuse'].forEach(function (w) {
          var box = boxFor('lbl' + w.charAt(0).toUpperCase() + w.slice(1));
          quiet(K.onPhrase('s1MatchDone', w, function () { return lightSide(box); }));
        });
        return Flow.wait(Beats.ringing()).then(function () {
          return K.speakBySentence('s1MatchDone');
        });
      });
  }

  /* The boxes and the tray taken away. */
  function boxesOut() {
    return Promise.all([
      Flow.anim(Beats.trayOut(dom.tray, K.chips())),
      Flow.anim(Beats.marksOut(boxes.map(function (b) { return b.g; }).concat(
        boxes.map(function (b) { return b.leader; }))))
    ]).then(function () {
      dom.boxes.setAttribute('hidden', '');
      clearBoxes();
      K.resetFooter();
    });
  }

  /* ======================================================================
   * The scene
   * ====================================================================== */
  function scene() {
    var sides = t.allSides();
    return Flow.anim(Beats.bubbleOut(dom.bubble))
      .then(function () {
        K.restoreBubble();
        return Flow.anim(Beats.boardIn(dom.board));
      })
      .then(function () { return Flow.wait(SHORT); })

      /* ---- 1. Here's a right-angled triangle ----------------------------
         The pen draws the triangle first, before a word is said. Then the
         first sentence names it and the caption lands; the second puts θ
         on at A -- the arc as "this angle" is said, the θ as "theta" is. */
      .then(function () { return Tri.draw(t, { time: DRAW_TIME }); })
      .then(function () {
        var captioned = null, arced = null, named = null;
        function captionIt() {
          if (!captioned) captioned = Flow.anim(Beats.labelIn(caption));
          return captioned;
        }
        function arcIt() {
          if (!arced) arced = Tri.angleIn(t, 'A', null);
          return arced;
        }
        function nameIt() {
          if (!named) {
            named = arcIt().then(function () {
              t.writeAngle('A', T('lblTheta'));
              return Flow.anim(Beats.labelIn(t.angles.A));
            });
          }
          return named;
        }
        quiet(K.onPhrase('s1Here', 'right-angled', captionIt));
        quiet(K.onPhrase('s1Here', 'this angle', arcIt));
        quiet(K.onPhrase('s1Here', 'theta', nameIt));
        return K.speakBySentence('s1Here', null)
          .then(function () { return Promise.all([captionIt(), nameIt()]); });
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.wait(K.LOOK); })
      .then(function () { return K.autoTurn(); })

      /* ---- 2. Name the sides ------------------------------------------------ */
      /* the caption has done its job once the recall is said: it goes
         before the boxes arrive */
      .then(function () { return K.say('s1Recall'); })
      .then(function () { return Flow.anim(Beats.marksOut([caption])); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return matchSides(true); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); })

      /* ---- 3. From the other angle ------------------------------------------ */
      /* the first angle's boxes go, and the colours with them: they are
         the answers, and two of them are wrong for C */
      .then(function () {
        t.colourRoles(false);
        return boxesOut();
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        var moved = null;
        function moveIt() {
          if (!moved) moved = Tri.moveTheta(t, 'A', 'C', 1.2);
          return moved;
        }
        quiet(K.onPhrase('s1Other', 'this angle', moveIt));
        return K.say('s1Other').then(moveIt);
      })
      .then(function () { return Flow.wait(SHORT); })
      /* the learner has done it once: no drag shown this time */
      .then(function () { return matchSides(false); })
      .then(function () { return Flow.wait(BEAT); })
      /* the boxes and the tray go; the names are written beside the
         sides themselves, in their colours, so the triangle stays named */
      .then(boxesOut)
      .then(function () { return Tri.nameSides(t, ['opp', 'adj', 'hyp'], 120); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.say('s1Notice'); })
      .then(function () { return Flow.wait(SHORT); })
      /* the two views, side by side: the first angle's on the left, this
         one's on the right */
      .then(function () {
        Tri.instant(t2);
        t2.setTheta('A');
        t2.writeAngle('A', T('lblTheta'));
        t2.colourRoles(true, 'A');
        t2.writeWord('opp', T('lblOpposite'), 'A');
        t2.writeWord('adj', T('lblAdjacent'), 'A');
        t2.writeWord('hyp', T('lblHypotenuse'), 'A');
        M.set([t2.arcs.A, t2.angles.A].concat(Object.keys(t2.words).map(function (s) { return t2.words[s]; })), { opacity: 1 });
        dom.g2.removeAttribute('hidden');
        /* each shrunk a little and centred in its own half, measured with
           its words, so the pair splits the stage evenly */
        var o = { x: 500, y: 240 };
        var k = Math.min(PAIR_K, K.aside(dom.g2, .25).fit, K.aside(dom.g, .75).fit);
        var left = K.aside(dom.g2, .25, k, o), right = K.aside(dom.g, .75, k, o);
        M.set(dom.g2, { opacity: 0, x: left.x - 270, y: left.y, scale: k, svgOrigin: '500 240' });
        return Promise.all([
          Flow.anim(Beats.moveGroup(dom.g, { x: right.x, y: right.y, scale: k, svgOrigin: '500 240' }, 0.9)),
          Flow.anim(Beats.moveGroup(dom.g2, { x: left.x, opacity: 1, scale: k, svgOrigin: '500 240' }, 0.9))
        ]);
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        /* each role lit in both views as it is named -- the sides and
           the names beside them -- in both sentences of the line */
        function both(role) {
          return Promise.all([
            Flow.anim(Beats.linePulse([t2.side(role, 'A'), t.side(role, 'C')])),
            Flow.anim(Beats.textPulse([t2.word(role, 'A'), t.word(role, 'C')], 2))
          ]);
        }
        quiet(K.onPhrase('s1Swap', 'opposite', function () { return both('opp'); }));
        quiet(K.onPhrase('s1Swap', 'adjacent', function () { return both('adj'); }));
        quiet(K.onPhrase('s1Swap', 'hypotenuse', function () { return both('hyp'); }));
        return K.speakBySentence('s1Swap');
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  /* ---- the hooks ---------------------------------------------------------- */
  function parts() { return t.parts().concat(t2.parts(), [caption, dom.boxes]); }
  function wipe() { return []; }
  function reset() {
    t.reset(); t2.reset();
    t.setTheta('A');
    dom.g.setAttribute('hidden', '');
    dom.g2.setAttribute('hidden', '');
    dom.boxes.setAttribute('hidden', '');
    dom.boxes.classList.remove('is-live');
    caption.textContent = T('lblRightTriangle');
    clearBoxes();
  }
  /* The scene opens on a board the welcome left: the bubble still up on
     the field, the board not yet shown. Nothing to stage. */
  function stage() {}

  Pages.addSection({
    name: 'The sides',
    scenes: [{ name: 'Right-angled triangle', play: scene }],
    build: build,
    parts: parts,
    wipe: wipe,
    reset: reset,
    stage: stage
  });

  /* The first triangle's geometry, for the sections that draw the same one. */
  global.S1 = { A: A, B: B, C: C, DRAW_TIME: DRAW_TIME };
})(window);
