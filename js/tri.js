/* ==========================================================================
 * tri.js -- a triangle, drawn and named
 * --------------------------------------------------------------------------
 * Every triangle in the lesson is one of these: three vertices in the
 * picture's own units (the figure's viewBox, 1000 x 420), one of them
 * carrying the right angle and one the reference angle θ. From those the
 * module works out everything else -- which side is opposite, adjacent and
 * hypotenuse for the angle in hand, where the angle arc and the right-angle
 * square go, where a word beside a side sits so it reads outside the shape
 * -- and builds the marks into a group of the figure:
 *
 *   fill        the wash inside
 *   outline     the closed path the pen draws (hidden once drawn)
 *   sides       three paths, A-B, B-C, C-A, each knowing its role
 *   dots        the three vertices
 *   arcs        one angle arc per vertex, and the right-angle square
 *   words/vals  a name and a length beside each side
 *   angles      a word at each vertex, inside, by the arc
 *   names       a letter on each vertex, outside
 *   tip         the pen that draws the outline
 *
 * Geometry is rewritten by set(), so a triangle under a slider is redrawn
 * from its vertices every frame -- paths, dots, arcs and labels alike --
 * and never carries a transform of its own apart from the slide a section
 * gives the whole group. The draw/show helpers at the foot are the beats
 * every section builds its triangle with.
 *
 * Load order: js/pages.js -> js/tri.js -> js/widgets.js -> the sections
 * ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var M = global.Motion;
  var Flow = global.Flow;
  var Beats = global.Beats;

  function round2(n) { return Math.round(n * 100) / 100; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function pt(p) { return round2(p.x) + ' ' + round2(p.y); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function unit(a) { var l = len(a) || 1; return { x: a.x / l, y: a.y / l }; }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function dist(a, b) { return len(sub(a, b)); }

  var SIDES = { AB: ['A', 'B'], BC: ['B', 'C'], CA: ['C', 'A'] };
  var ARC_R = 40;          /* the angle arc's radius                      */
  var SQ = 20;             /* the right angle's square, along each side   */
  var WORD_OFF = 34;       /* a word beside a side, out from it           */
  var VAL_OFF = 30;        /* a length beside a side, the same            */
  var ANG_OFF = 66;        /* the angle's word, in from its vertex        */
  var VTX_OFF = 26;        /* A, B, C: out from the vertex                */

  function opposite(v) {
    return Object.keys(SIDES).filter(function (s) { return SIDES[s].indexOf(v) < 0; })[0];
  }
  function between(u, v) {
    return Object.keys(SIDES).filter(function (s) {
      return SIDES[s].indexOf(u) >= 0 && SIDES[s].indexOf(v) >= 0;
    })[0];
  }
  function other(u, v) {
    return ['A', 'B', 'C'].filter(function (w) { return w !== u && w !== v; })[0];
  }

  /* An angle arc at vertex V, from the direction of neighbour P to the
     direction of neighbour Q, the short way round (the interior angle). */
  function arcPath(V, P, Q, r) {
    var u1 = unit(sub(P, V)), u2 = unit(sub(Q, V));
    var a1 = add(V, mul(u1, r)), a2 = add(V, mul(u2, r));
    var cross = u1.x * u2.y - u1.y * u2.x;
    var sweep = cross > 0 ? 1 : 0;
    return 'M' + pt(a1) + ' A' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + pt(a2);
  }
  function squarePath(V, P, Q, s) {
    var u1 = unit(sub(P, V)), u2 = unit(sub(Q, V));
    var a = add(V, mul(u1, s)), b = add(add(V, mul(u1, s)), mul(u2, s)), c = add(V, mul(u2, s));
    return 'M' + pt(a) + ' L' + pt(b) + ' L' + pt(c);
  }
  /* The point `off` out from the middle of side P-Q, away from R. */
  function outside(P, Q, R, off) {
    var m = mid(P, Q);
    var d = unit(sub(Q, P));
    var n = { x: -d.y, y: d.x };
    if ((n.x * (R.x - m.x) + n.y * (R.y - m.y)) > 0) n = mul(n, -1);
    return add(m, mul(n, off));
  }
  /* How a word beside side P-Q is turned so it reads along the side and
     upright: 0 for a level or an upright side, the side's angle otherwise. */
  function slant(P, Q) {
    var a = Math.atan2(Q.y - P.y, Q.x - P.x) * 180 / Math.PI;
    if (a > 90) a -= 180;
    if (a < -90) a += 180;
    if (Math.abs(a) < 8 || Math.abs(a) > 82) return 0;
    return a;
  }

  /* A word set beside side P-Q at `w`: turned along a slanted side, set
     under a level one, beside an upright one. */
  function placeText(txt, p, q, w) {
    var turn = slant(p, q);
    var m = mid(p, q);
    txt.setAttribute('x', round2(w.x));
    txt.setAttribute('y', round2(w.y));
    if (turn) {
      txt.setAttribute('transform', 'rotate(' + round2(turn) + ' ' + round2(w.x) + ' ' + round2(w.y) + ')');
      txt.setAttribute('dy', w.y < m.y ? '.1em' : '.7em');
      txt.setAttribute('text-anchor', 'middle');
    } else {
      txt.removeAttribute('transform');
      var level = Math.abs(q.y - p.y) < Math.abs(q.x - p.x);
      if (level) {
        txt.setAttribute('dy', w.y > m.y ? '.85em' : '-.1em');
        txt.setAttribute('text-anchor', 'middle');
      } else {
        txt.setAttribute('dy', '.36em');
        txt.setAttribute('text-anchor', w.x > m.x ? 'start' : 'end');
      }
    }
  }

  /* ---- the triangle ----------------------------------------------------- */
  function create(group, spec) {
    var V = { A: spec.A, B: spec.B, C: spec.C };
    var right = spec.right === undefined ? 'B' : spec.right;
    var theta = spec.theta || 'A';
    var wordOff = spec.wordOff || WORD_OFF;
    var valOff = spec.valOff || VAL_OFF;

    group.classList.add('figure__tri');

    var fill = el('path', { 'class': 'tri__fill' }, group);
    var outline = el('path', { 'class': 'tri__outline' }, group);
    var sides = {};
    Object.keys(SIDES).forEach(function (s) {
      sides[s] = el('path', { 'class': 'tri__side', 'data-side': s }, group);
    });
    var sq = el('path', { 'class': 'tri__right' }, group);
    var arcs = {};
    ['A', 'B', 'C'].forEach(function (v) {
      arcs[v] = el('path', { 'class': 'tri__arc', 'data-vertex': v }, group);
    });
    var dots = {};
    ['A', 'B', 'C'].forEach(function (v) {
      dots[v] = el('circle', { 'class': 'end-dot', r: 4.6, 'data-vertex': v }, group);
    });
    var tip = el('circle', { 'class': 'tri__tip', r: 7 }, group);
    var words = {}, vals = {}, angles = {}, names = {};
    Object.keys(SIDES).forEach(function (s) {
      words[s] = el('text', { 'class': 'figure-label tri__word', 'data-side': s, 'text-anchor': 'middle' }, group);
      vals[s]  = el('text', { 'class': 'figure-label tri__val', 'data-side': s, 'text-anchor': 'middle' }, group);
    });
    ['A', 'B', 'C'].forEach(function (v) {
      angles[v] = el('text', { 'class': 'figure-label tri__angle', 'data-vertex': v, 'text-anchor': 'middle' }, group);
      names[v]  = el('text', { 'class': 'figure-label tri__name', 'data-vertex': v, 'text-anchor': 'middle' }, group);
    });

    var t = {
      group: group, fill: fill, outline: outline, sides: sides, square: sq, arcs: arcs,
      dots: dots, tip: tip, words: words, vals: vals, angles: angles, names: names,
      V: V
    };

    /* ---- roles: which side is which, for the angle in hand ------------- */
    function roles(at) {
      var v = at || theta;
      var r = {};
      /* the hypotenuse faces the right angle, the adjacent side runs from
         the angle in hand to the right angle, and the opposite side is the
         one that never touches the angle in hand */
      r.hyp = opposite(right);
      r.adj = between(v, right);
      r.opp = opposite(v);
      return r;
    }
    t.roles = roles;
    t.theta = function () { return theta; };
    t.right = function () { return right; };
    t.side = function (role, at) { return sides[roles(at)[role]]; };
    t.sideKey = function (role, at) { return roles(at)[role]; };
    t.word = function (role, at) { return words[roles(at)[role]]; };
    t.val = function (role, at) { return vals[roles(at)[role]]; };

    /* Dress every side in its role's colour (a class each), or undress. */
    t.colourRoles = function (on, at) {
      var r = roles(at);
      Object.keys(sides).forEach(function (s) {
        sides[s].classList.remove('tri__side--opp', 'tri__side--adj', 'tri__side--hyp');
        words[s].classList.remove('tri__word--opp', 'tri__word--adj', 'tri__word--hyp');
      });
      if (!on) return;
      Object.keys(r).forEach(function (role) {
        sides[r[role]].classList.add('tri__side--' + role);
        words[r[role]].classList.add('tri__word--' + role);
      });
    };

    /* ---- geometry, written -------------------------------------------- */
    function layout() {
      var A = V.A, B = V.B, C = V.C;
      var poly = 'M' + pt(A) + ' L' + pt(B) + ' L' + pt(C) + ' Z';
      fill.setAttribute('d', poly);
      outline.setAttribute('d', poly);
      Object.keys(SIDES).forEach(function (s) {
        var p = V[SIDES[s][0]], q = V[SIDES[s][1]];
        sides[s].setAttribute('d', 'M' + pt(p) + ' L' + pt(q));
        var third = V[other(SIDES[s][0], SIDES[s][1])];
        var wv = outside(p, q, third, valOff);
        var ww = outside(p, q, third, wordOff);
        /* beside an upright side both words read rightward from the same
           edge, so the name is set UNDER the length rather than past it */
        var upright = Math.abs(q.y - p.y) >= Math.abs(q.x - p.x) && !slant(p, q);
        if (upright && wordOff > valOff) ww = { x: wv.x, y: wv.y + (wordOff - valOff) };
        placeText(words[s], p, q, ww);
        placeText(vals[s], p, q, wv);
      });
      ['A', 'B', 'C'].forEach(function (v) {
        var P = V[v];
        dots[v].setAttribute('cx', round2(P.x));
        dots[v].setAttribute('cy', round2(P.y));
        var o = ['A', 'B', 'C'].filter(function (w) { return w !== v; });
        var P1 = V[o[0]], P2 = V[o[1]];
        if (v === right) {
          sq.setAttribute('d', squarePath(P, P1, P2, SQ));
          arcs[v].setAttribute('d', '');
        } else {
          arcs[v].setAttribute('d', arcPath(P, P1, P2, ARC_R));
        }
        var bis = unit(add(unit(sub(P1, P)), unit(sub(P2, P))));
        var inside = add(P, mul(bis, v === right ? ANG_OFF * 0.9 : ANG_OFF));
        angles[v].setAttribute('x', round2(inside.x));
        angles[v].setAttribute('y', round2(inside.y));
        angles[v].setAttribute('dy', '.36em');
        var out = add(P, mul(bis, -VTX_OFF));
        names[v].setAttribute('x', round2(out.x));
        names[v].setAttribute('y', round2(out.y));
        names[v].setAttribute('dy', '.36em');
      });
      tip.setAttribute('cx', round2(A.x));
      tip.setAttribute('cy', round2(A.y));
    }
    t.layout = layout;
    t.set = function (a, b, c) {
      if (a) V.A = a;
      if (b) V.B = b;
      if (c) V.C = c;
      layout();
    };
    t.setTheta = function (v) { theta = v; };
    t.setWordOff = function (n) { wordOff = n; layout(); };

    function slotOf(map, which, at) {
      return map[SIDES[which] ? which : roles(at)[which]];
    }
    t.writeWord = function (which, text, at) {
      var e = slotOf(words, which, at); e.textContent = text; return e;
    };
    t.writeVal = function (which, text, at) {
      var e = slotOf(vals, which, at); e.textContent = text; return e;
    };
    t.writeAngle = function (v, text) { angles[v].textContent = text; return angles[v]; };
    t.writeName = function (v, text) { names[v].textContent = text; return names[v]; };

    t.angleAt = function (v) {
      var o = ['A', 'B', 'C'].filter(function (w) { return w !== v; });
      var u1 = unit(sub(V[o[0]], V[v])), u2 = unit(sub(V[o[1]], V[v]));
      return Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y))) * 180 / Math.PI;
    };
    t.length = function (s) { return dist(V[SIDES[s][0]], V[SIDES[s][1]]); };
    t.midOf = function (which, at) {
      var s = SIDES[which] ? which : roles(at)[which];
      return mid(V[SIDES[s][0]], V[SIDES[s][1]]);
    };
    t.outsideOf = function (which, off, at) {
      var s = SIDES[which] ? which : roles(at)[which];
      return outside(V[SIDES[s][0]], V[SIDES[s][1]], V[other(SIDES[s][0], SIDES[s][1])], off);
    };

    t.parts = function () {
      var list = [fill, outline, sq, tip];
      Object.keys(sides).forEach(function (s) { list.push(sides[s], words[s], vals[s]); });
      ['A', 'B', 'C'].forEach(function (v) { list.push(arcs[v], dots[v], angles[v], names[v]); });
      return list;
    };
    t.allSides = function () { return Object.keys(sides).map(function (s) { return sides[s]; }); };
    t.allDots = function () { return ['A', 'B', 'C'].map(function (v) { return dots[v]; }); };
    t.reset = function () {
      Object.keys(sides).forEach(function (s) { words[s].textContent = ''; vals[s].textContent = ''; });
      ['A', 'B', 'C'].forEach(function (v) { angles[v].textContent = ''; names[v].textContent = ''; });
      t.colourRoles(false);
      group.classList.remove('is-named');
      layout();
    };

    layout();
    return t;
  }

  /* ======================================================================
   * The beats a triangle is built with
   * ====================================================================== */

  /* Drawn: the pen round the outline, then the sides take over from it,
     the vertices pop on, the colour is poured, and the right angle's
     square is drawn. `o.time` is the pen's trip; `o.square: false` leaves
     the right angle for a beat of its own. */
  function draw(t, o) {
    o = o || {};
    t.group.removeAttribute('hidden');
    return Flow.anim(Beats.drawOutline(t.outline, t.tip, { time: o.time || 2.2 }))
      .then(function () {
        M.set(t.allSides(), { opacity: 1 });
        M.set(t.outline, { opacity: 0 });
        return Flow.anim(Beats.marksIn(t.allDots(), 0.2));
      })
      .then(function () { return Flow.wait(o.hold == null ? 260 : o.hold); })
      .then(function () { return Flow.anim(Beats.fillShape(t.fill)); })
      .then(function () {
        if (o.square === false || t.right() == null) return;
        return Flow.wait(200).then(function () {
          return Flow.anim(Beats.growLine(t.square, 0.5, 'power2.inOut'));
        });
      });
  }

  /* Everything a drawn triangle shows, written straight in: for a page
     staged from the level bar, or a copy that has to appear whole. */
  function instant(t) {
    t.group.removeAttribute('hidden');
    M.set(t.allSides().concat(t.allDots(), [t.fill]), { opacity: 1 });
    M.set(t.outline, { opacity: 0 });
    if (t.right() != null) M.set(t.square, { opacity: 1 });
  }

  /* The angle at `v` marked: its arc drawn, and its word popped in. */
  function angleIn(t, v, text) {
    if (text != null) t.writeAngle(v, text);
    return Flow.anim(Beats.growLine(t.arcs[v], 0.5, 'power2.inOut'))
      .then(function () {
        if (text == null) return;
        return Flow.anim(Beats.labelIn(t.angles[v]));
      });
  }

  /* The sides named for the angle in hand: each word written and popped
     in turn, in its side's colour. `order` is the roles in the order the
     words land; the sides take their colours as the words arrive. */
  function nameSides(t, order, gapMs) {
    var names = { opp: 'lblOpposite', adj: 'lblAdjacent', hyp: 'lblHypotenuse' };
    var list = order || ['opp', 'adj', 'hyp'];
    t.colourRoles(true);
    t.group.classList.add('is-named');
    return list.reduce(function (chain, role, i) {
      return chain.then(function () {
        var w = t.writeWord(role, global.T ? global.T(names[role]) : role);
        return Flow.anim(Beats.labelIn(w)).then(function () {
          return i < list.length - 1 ? Flow.wait(gapMs == null ? 220 : gapMs) : null;
        });
      });
    }, Promise.resolve());
  }

  /* The words beside the sides taken off. */
  function unname(t) {
    var list = Object.keys(t.words).map(function (s) { return t.words[s]; });
    return Flow.anim(Beats.labelsOut(list)).then(function () {
      list.forEach(function (w) { w.textContent = ''; });
      M.set(list, { clearProps: 'opacity,transform' });
    });
  }

  /* The reference angle moved from one vertex to another: the arc at the
     old vertex fades, θ travels along to the new arc's spot, and the new
     arc draws under it as it lands. */
  function moveTheta(t, from, to, seconds) {
    var a = t.angles[from];
    var b = t.angles[to];
    var dx = parseFloat(b.getAttribute('x')) - parseFloat(a.getAttribute('x'));
    var dy = parseFloat(b.getAttribute('y')) - parseFloat(a.getAttribute('y'));
    var text = a.textContent;
    t.setTheta(to);
    return Promise.all([
      Flow.anim(Beats.marksOut([t.arcs[from]])),
      Flow.anim(Beats.travel(a, dx, dy, seconds || 1.1))
    ]).then(function () {
      b.textContent = text;
      a.textContent = '';
      M.set(a, { clearProps: 'transform,opacity' });
      M.set(b, { opacity: 1 });
      return Flow.anim(Beats.growLine(t.arcs[to], 0.45, 'power2.inOut'));
    });
  }

  global.Tri = {
    create: create,
    draw: draw,
    instant: instant,
    angleIn: angleIn,
    nameSides: nameSides,
    unname: unname,
    moveTheta: moveTheta,
    SIDES: SIDES,
    el: el, round2: round2, mid: mid, sub: sub, add: add, mul: mul, unit: unit, dist: dist,
    outside: outside, arcPath: arcPath
  };
})(window);
