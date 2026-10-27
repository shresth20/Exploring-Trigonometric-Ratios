/* ==========================================================================
 * pages.js -- the lesson's kit, and the welcome
 * --------------------------------------------------------------------------
 * One scene is one `await` chain. Everything it waits on -- a stretch of
 * time, an animation, a tap -- is taken out through Flow, so the whole chain
 * unwinds in one go if the scene is replayed, and collapses to a few frames
 * if Skip is pressed. Nothing in here sets a timeout of its own.
 *
 * This file owns what every section shares: the board and its header, the
 * lines said on the header and its opening and closing around them, the
 * Next control, the tray of names and the drag that puts them in boxes,
 * the pacing constants, and the registry the sections join. The sections themselves are in
 * js/s1-sides.js ... js/s7-table.js, and the right pane's widgets -- the
 * dropdown, the slider, the equations, the table -- in js/widgets.js.
 *
 * Load order: motion.js -> flow.js -> mathtext.js -> typer.js -> mascot.js
 *             -> animations.js -> pages.js -> tri.js -> widgets.js -> s*.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var Flow = global.Flow;
  var Beats = global.Beats;

  function T(key, repl) { return global.T ? global.T(key, repl) : key; }

  /* ---- pacing -----------------------------------------------------------
     A BEAT is the gap between one line and the next -- long enough to
     finish reading, short enough not to feel like a hang. SHORT is the gap
     between two marks of one drawing. */
  var BEAT  = 560;
  var SHORT = 280;
  var HOLD_ASK = 2000;      /* an instruction left standing before the hand-over */
  var AUTO_TURN = 2500;     /* ms: a self-turning page, left to be looked at */
  var LOOK = 1400;          /* ms: a finished mark looked at before the next */
  var BIRD_LAG = 160;       /* ms: the bird hops up once the plate is mostly in */

  /* The figure's own coordinates: the picture is 1000 x 420, from y = 45
     (the viewBox in index.html), so centred on (500, 255). SHIFT is how far
     a figure slides to stand in the left half. */
  var VB_W = 1000, VB_H = 420;
  var CX = 500, CY = 255;
  var SHIFT = -250;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function round2(n) { return Math.round(n * 100) / 100; }

  /* The activity's boxes: the same proportions as a name in the tray. */
  var BOX_W = 210, BOX_H = 42;
  var BOX_R = BOX_H / 2;
  var LEAD_STUB = 42;

  var dom = null;
  var chips = [];
  var choiceBtns = [];
  var sayBubble, sayPrompt;
  var mascot = null;

  function $(id) { return document.getElementById(id); }

  function collect() {
    return {
      welcome:  $('welcome'),
      title:    document.querySelector('.welcome__title'),
      startBtn: $('startBtn'),

      frame:    $('frame'),
      bubble:   $('bubble'),
      bird:     $('bubbleBird'),

      board:    $('board'),
      promptLine: document.querySelector('.prompt__line'),

      figure:    $('figure'),
      figNudges: $('figNudges'),
      figBurst:  $('figBurst'),
      burst:     $('burst'),

      pane:      $('pane'),
      paneBody:  $('paneBody'),
      tableWrap: $('tableWrap'),

      tray:     $('tray'),
      choices:  $('choices'),
      gate:     $('gate'),
      nextBtn:  $('nextBtn')
    };
  }

  /* ---- building into the SVG ------------------------------------------- */
  function el(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    }
    return e;
  }
  function seg(a, b) {
    return 'M' + round2(a.x) + ' ' + round2(a.y) + ' L' + round2(b.x) + ' ' + round2(b.y);
  }

  /* One box, with the dashed leader that ties it to the part it is for.
     `b` is { name, x, y, anchor }: where the box sits and the point its
     leader runs to. The leader runs level out of the box, turns once, and
     goes to the anchor. The leader itself is drawn the other way, from the
     anchor back to the box, so its dash pattern starts with a dash ON the
     part and never leaves a gap there; the mask still draws from the box. */
  var maskN = 0;
  function buildBox(group, defs, b) {
    var left = b.x + BOX_W / 2 < (b.anchor ? b.anchor.x : CX);
    var cy = b.y + BOX_H / 2;
    var edge = { x: left ? b.x + BOX_W : b.x, y: cy };
    var turn = { x: edge.x + (left ? LEAD_STUB : -LEAD_STUB), y: cy };
    var target = b.anchor;
    var d = 'M' + round2(edge.x) + ' ' + round2(edge.y) +
            ' L' + round2(turn.x) + ' ' + round2(turn.y) +
            ' L' + round2(target.x) + ' ' + round2(target.y);

    var maskId = 'leaderMask' + (++maskN);
    var mask = el('mask', { id: maskId, maskUnits: 'userSpaceOnUse',
                            x: -500, y: -500, width: 2000, height: 1400 });
    var maskPath = el('path', { 'class': 'q-leader-mask', d: d });
    mask.appendChild(maskPath);
    defs.appendChild(mask);

    var back = 'M' + round2(target.x) + ' ' + round2(target.y) +
               ' L' + round2(turn.x) + ' ' + round2(turn.y) +
               ' L' + round2(edge.x) + ' ' + round2(edge.y);
    var leader = el('path', { 'class': 'q-leader', d: back, mask: 'url(#' + maskId + ')' });
    group.appendChild(leader);

    var g = el('g', { 'class': 'q-box', 'data-name': b.name, tabindex: 0, role: 'button' });
    var rect = el('rect', { 'class': 'q-box__rect', x: b.x, y: b.y,
                            width: BOX_W, height: BOX_H, rx: BOX_R });
    var badge = el('g', { 'class': 'q-badge' });
    badge.appendChild(el('circle', { 'class': 'q-badge__ring', cx: b.x + 24, cy: cy, r: 10 }));
    badge.appendChild(el('path', { 'class': 'q-badge__tick',
      d: 'M' + (b.x + 18.5) + ' ' + cy + ' L' + (b.x + 22.5) + ' ' + (cy + 4) +
         ' L' + (b.x + 29.5) + ' ' + (cy - 4) }));
    var text = el('text', { 'class': 'figure-label q-box__text',
                            x: b.x + BOX_W / 2 + 9, y: cy + 7.5, 'text-anchor': 'middle' });
    g.appendChild(rect);
    g.appendChild(badge);
    g.appendChild(text);
    group.appendChild(g);

    var box = { name: b.name, g: g, rect: rect, badge: badge, text: text,
                leader: leader, mask: maskPath, filled: false };
    emptyBox(box);
    return box;
  }

  function emptyBox(box) {
    box.filled = false;
    box.text.textContent = '';
    [box.g, box.leader].forEach(function (e) {
      e.classList.remove('is-right', 'is-wrong', 'is-over', 'is-shown', 'is-quiet', 'is-target');
    });
    box.g.setAttribute('aria-label', T('a11yBox'));
  }

  /* The names, as buttons in the tray. */
  function buildChips(tray, names) {
    tray.textContent = '';
    return names.map(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      global.MathText.write(b, T(name));
      b.dataset.name = name;
      b.setAttribute('aria-label', T('a11yChip', { name: T(name) }));
      tray.appendChild(b);
      return b;
    });
  }

  /* The answers to a question, as buttons. The label is written through
     mathtext.js, so a fraction stands up on the pill -- and is kept as
     data on it, because a stacked fraction reads back as "12". */
  function buildChoices(host, labels) {
    host.textContent = '';
    return labels.map(function (text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      global.MathText.write(b, text);
      b.dataset.name = text;
      host.appendChild(b);
      return b;
    });
  }

  /* A fresh order every time, and never the order given. */
  function shuffle(list) {
    var a = list.slice();
    for (var tries = 0; tries < 8; tries++) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      if (a.join() !== list.join()) break;
    }
    return a;
  }

  /* ---- the figure, as a whole ------------------------------------------- */
  function figureParts() {
    return sections.reduce(function (all, s) {
      return s.parts ? all.concat(s.parts()) : all;
    }, []);
  }

  /* Back to an empty stage: every inline write handed back -- and the dash
     patterns with them -- and then every section's groups hidden. The
     sections lay out after the clear, not before: a word beside a slanted
     side is turned by its own transform, and clearing it would leave the
     word level and lying across the side. */
  function resetFigure() {
    dom.figure.querySelectorAll('.is-lit, .is-pulsing, .is-glowing-text').forEach(function (l) {
      l.classList.remove('is-lit', 'is-pulsing', 'is-glowing-text');
    });
    clearInline([dom.figure].concat(
      Array.prototype.slice.call(dom.figure.querySelectorAll('*'))));
    sections.forEach(function (s) { if (s.reset) s.reset(); });
  }

  function clearInline(els) {
    M.set(els, { clearProps: 'opacity,transform,strokeWidth' });
    els.forEach(function (p) {
      if (!p.style) return;
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
      p.style.filter = '';
    });
  }

  function resetFooter() {
    dom.tray.setAttribute('hidden', '');
    dom.tray.textContent = '';
    chips = [];
    dom.choices.setAttribute('hidden', '');
    dom.choices.textContent = '';
    choiceBtns = [];
  }

  /* The ripple goes where the finger landed. */
  function ripple(ev, el) {
    var r = el.getBoundingClientRect();
    M.tapRipple((ev && ev.clientX) || (r.left + r.width / 2),
                (ev && ev.clientY) || (r.top + r.height / 2));
  }

  /* A promise the scene may never get round to awaiting: retiring a scene
     rejects every wait it owns, and the ones nobody awaited would surface
     as unhandled rejections. That noise is swallowed here. */
  function quiet(p) {
    if (p && p.catch) p.catch(function () {});
    return p;
  }

  /* ---- controls ---------------------------------------------------------
     Next is the one control that both appears and is waited on. */
  function handOver(btn) {
    btn = btn || dom.nextBtn;
    note(at, page);
    announce();

    if (seek > 0) {
      seek--;
      turned();
      if (!seek) Flow.resume();
      return Promise.resolve();
    }
    Flow.resume();

    M.button3d(btn, { edge: 5 });
    Beats.controlIn(btn);
    return Flow.once(btn).then(function () {
      Beats.sfx('click');
      turned();
      return Flow.anim(Beats.controlOut(btn));
    });
  }

  function clearPrompt() {
    sayPrompt.clear();
    M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
  }

  /* Say a line in the header. The plate is one width for every line, so
     nothing in the row has to make room for it. */
  function sayInHeader(text, over) {
    return sayPrompt(text, over);
  }

  var speaking = 0;

  function lineOf(text) {
    if (text && typeof text === 'object') return text;
    return { text: String(text), vo: null };
  }

  /* A key's recording, played and listened to the end. Listened for on
     Flow's own waits, so a line is never held past a Skip. */
  function hear(key) {
    if (!key || !global.I18n || Flow.isFast()) return Promise.resolve(false);
    var done = false, ok = false;
    quiet(global.I18n.say(key)).then(function (r) { done = true; ok = r; },
                                     function () { done = true; });
    function heard() {
      if (Flow.isFast()) { global.I18n.stop(); return false; }
      if (done) return ok;
      return Flow.wait(80).then(heard, function (err) {
        global.I18n.stop();
        throw err;
      });
    }
    return heard();
  }
  function voiceOf(line) {
    return line.vo ? hear(line.vo) : Promise.resolve(false);
  }

  /* ---- a line on its recording's clock --------------------------------- */
  var keyOfText = null;
  var patterns = null;
  function plain(text) { return String(text).replace(/ /g, ' '); }
  function cuesFor(text, key) {
    var I = global.I18n;
    if (!I || !I.cues) return null;
    if (key && I.voiced().indexOf(key) >= 0) return I.cues(key, plain(text));
    if (!keyOfText) {
      keyOfText = {};
      patterns = [];
      I.voiced().forEach(function (k) {
        var s = I.t(k);
        keyOfText[s] = k;
        if (/\{\w+\}/.test(s)) {
          patterns.push({ key: k, re: new RegExp('^' +
            s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.+?') + '$') });
        }
      });
    }
    var line = plain(text);
    var found = keyOfText[line];
    if (!found) {
      patterns.some(function (p) { if (p.re.test(line)) { found = p.key; return true; } });
    }
    return found ? I.cues(found, line) : null;
  }

  /* When a phrase of a line is heard, in ms from the line's start. */
  function wordAt(text, phrase) {
    var i = plain(text).indexOf(plain(phrase));
    if (i < 0) return 0;
    var cues = cuesFor(text);
    if (!cues) return i * global.Typer.TYPE_MS;
    var cuts = global.Typer.wordCuts(plain(text));
    for (var w = 0; w < cuts.length && w < cues.length; w++) {
      if (i < cuts[w]) return cues[w];
    }
    return cues[cues.length - 1];
  }

  var begun = { text: null, at: 0 };
  var awaiting = [];
  function began(text) {
    begun = { text: text, at: performance.now() };
    awaiting = awaiting.filter(function (w) {
      if (w.text !== text) return true;
      w.resolve(begun.at);
      return false;
    });
  }
  function lineBegins(text) {
    if (begun.text === text && performance.now() - begun.at < 100) {
      return Promise.resolve(begun.at);
    }
    return new Promise(function (resolve) {
      awaiting.push({ text: text, resolve: resolve });
    });
  }
  /* fn, run as `phrase` is heard in the line `text`. */
  function onWord(text, phrase, fn) {
    return lineBegins(text)
      .then(function (t0) { return Flow.wait(t0 + wordAt(text, phrase) - performance.now()); })
      .then(fn);
  }

  /* fn, run as `phrase` is heard in the line keyed `key` -- whether the
     line is said whole or a sentence at a time (speakBySentence): both
     the whole text and the sentence the phrase is in are listened for,
     and whichever begins is the one timed by. Armed BEFORE the line is
     started; a phrase that is never said leaves fn unrun. */
  function onPhrase(key, phrase, fn) {
    var text = T(key);
    var parts = sentencesOf(text) || [text];
    /* the phrase may open a piece, where it has been given a capital */
    var low = phrase.toLowerCase();
    var own = parts.filter(function (p) { return p.toLowerCase().indexOf(low) >= 0; })[0];
    var cands = [text];
    if (own && own !== text) cands.push(own);
    if (own && own.indexOf(phrase) < 0) phrase = own.charAt(0) + phrase.slice(1);
    return Promise.race(cands.map(function (c) {
      return lineBegins(c).then(function (t0) {
        var p = c.indexOf(phrase) >= 0 ? phrase : phrase.toLowerCase();
        return Flow.wait(t0 + wordAt(c, p) - performance.now());
      });
    })).then(fn);
  }

  /* A typer whose every line is laid out on its recording's clock. */
  function onVoice(say) {
    function reserve(text, over) {
      var key = text && typeof text === 'object' ? text.vo : null;
      text = text && typeof text === 'object' ? text.text : text;
      var cues = over ? null : cuesFor(text, key);
      var reveal = say.reserve(text, over || (cues ? { at: cues } : undefined));
      return function () {
        began(text);
        return reveal();
      };
    }
    function said(text, over) { return reserve(text, over)(); }
    said.reserve = reserve;
    said.clear = say.clear;
    return said;
  }

  /* The next line, said on the header while it is already up. `along` is
     something acted out on the figure while the line is said. */
  function speak(text, along) {
    var line = lineOf(text);
    var mine = ++speaking;
    var has = dom.promptLine.textContent.trim().length > 0;
    var gone = has ? Flow.anim(Beats.lineOut(dom.promptLine)) : Promise.resolve();
    return gone.then(function () {
      if (mine !== speaking) return;
      M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
      var heard = quiet(voiceOf(line));
      var said = sayInHeader(line);
      return Promise.all([said, heard, along ? along(line) : null]);
    });
  }

  /* ---- the header, taken up and let go ----------------------------------
     A line arriving on a closed header opens it first; the lesson letting
     the header go closes it behind, unless `keep`. `headerUp` is whether
     the header is in use: whether the next line is said on it straight
     away, or opens it first. */
  var headerUp = false;

  function headerIn() {
    headerUp = true;
    return Flow.anim(openHeader());
  }
  function headerOut(keep) {
    if (!headerUp) return Promise.resolve();
    headerUp = false;
    if (!keep) Flow.anim(collapseHeader(true));
    return Promise.resolve();
  }

  /* A line arriving on the header. It is RESERVED before the header opens,
     so its plate arrives already the size of the finished line, and the
     words start as the header settles. */
  function arriveSaying(text, along) {
    var line = lineOf(text);
    speaking++;
    var reveal = sayPrompt.reserve(line);
    return headerIn().then(function () {
      var heard = quiet(voiceOf(line));
      return Promise.all([reveal(), heard, along ? along(line) : null]);
    });
  }

  /* A line by key: its words, and the recording filed under the same key. */
  function keyed(key, repl) {
    return { text: global.I18n ? global.I18n.t(key, repl) : key, vo: key };
  }

  /* A line, said on the header: straight away if the header is up, or
     opening it first. A line of several pieces is said a piece at a time
     (speakBySentence); a line with something acted out alongside it is
     said whole, so the beat and the words start together. */
  function say(key, along) {
    var line = typeof key === 'string' ? keyed(key) : key;
    if (!along && sentencesOf(line.text)) return speakBySentence(line);
    return sayWhole(line, along);
  }
  function sayWhole(line, along) {
    return headerUp ? speak(line, along) : arriveSaying(line, along);
  }

  /* A line of more than one sentence, said one sentence at a time from ONE
     key and ONE clip: each sentence typed on the clip's own clock, the
     first taken off and the next put up as the voice reaches it. */
  var OUT_LEAD = 280;

  /* A line cut into the pieces it is said in: at every full stop,
     exclamation and question mark, and at a comma that joins two clauses
     -- three words or more before it, and a clause starter after it (so,
     and, but, let's, the, a capital, ...) -- so a list ("the sine, cosine
     and tangent values") stays whole. Each piece is trimmed, loses a
     trailing comma, and begins with a capital, so it reads as a sentence
     of its own. null for a line of one piece. */
  var CLAUSE = /^(?:(?:so|and|but|then|because|while|which|where|or|let’s|let's|we|we’ll|we'll|the|it|it’s|it's|you|you’ll|you'll|now|watch|this|that|these|those|our|a|an)\b|[A-Z])/;
  function tidy(s) {
    s = s.trim().replace(/,$/, '').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function wordsIn(s) { return (s.match(/\S+/g) || []).length; }
  function clausesOf(p) {
    var pieces = [], from = 0, re = /,\s+/g, m;
    while ((m = re.exec(p)) !== null) {
      var left = p.slice(from, m.index), right = p.slice(m.index + m[0].length);
      if (wordsIn(left) >= 3 && CLAUSE.test(right)) {
        pieces.push(left + ',');
        from = m.index + m[0].length;
      }
    }
    pieces.push(p.slice(from));
    return pieces;
  }
  function sentencesOf(text) {
    var parts = text.match(/[^.!?]+[.!?]+\s*/g);
    if (!parts || parts.join('') !== text) parts = [text];
    var out = [];
    parts.forEach(function (p) {
      clausesOf(p).forEach(function (q) { var s = tidy(q); if (s) out.push(s); });
    });
    return out.length > 1 ? out : null;
  }

  function speakBySentence(key) {
    var line = typeof key === 'string' ? keyed(key) : key;
    var I = global.I18n;
    var parts = sentencesOf(line.text);
    if (!parts || Flow.isFast()) return sayWhole(line);

    var cues = I && I.cues && line.vo ? I.cues(line.vo) : null;
    if (!cues) {
      /* A clip that is here but carries no cues is said whole: a sentence
         at a time with nothing to time the sentences by would run ahead
         of the voice or behind it. */
      var clipHere = I && line.vo && global.GameAudio && global.GameAudio.has &&
                     global.GameAudio.has(I.voice(line.vo));
      if (clipHere) return sayWhole(line);
      /* no clip: each piece its own plain line, the first opening the
         header if it is not up already */
      return parts.reduce(function (chain, s, i) {
        return chain.then(function (n) {
          if (i > 0 && n !== speaking) return n;
          var said = i === 0 ? sayWhole({ text: s, vo: null }) : speak(s);
          var mine = speaking;
          return said.then(function () { return mine; });
        });
      }, Promise.resolve(speaking));
    }

    /* each piece with the cues of its own words, from the clip's start:
       a piece has as many words as it had in the line */
    var w = 0;
    var split = parts.map(function (s) {
      var n = (s.match(/\S+\s*/g) || []).length;
      var atc = cues.slice(w, w + n);
      w += n;
      return { text: s, at: atc };
    });

    var up = headerUp ? Promise.resolve() : headerIn();
    return up.then(function () {
      var mine = ++speaking;
      var has = dom.promptLine.textContent.trim().length > 0;
      var gone = has ? Flow.anim(Beats.lineOut(dom.promptLine)) : Promise.resolve();
      return gone.then(function () {
        if (mine !== speaking) return;
        M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
        var t0 = performance.now();
        var heard = quiet(voiceOf(line));
        var typed = split.reduce(function (chain, s, i) {
          return chain.then(function () {
            if (mine !== speaking) return;
            var out = i === 0 ? Promise.resolve() :
              Flow.wait(t0 + s.at[0] - OUT_LEAD - performance.now()).then(function () {
                if (mine !== speaking) return;
                return Flow.anim(Beats.lineOut(dom.promptLine));
              });
            return out.then(function () {
              if (mine !== speaking) return;
              M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
              var late = performance.now() - t0;
              return sayInHeader(s.text, {
                at: s.at.map(function (c) { return Math.max(0, c - late); })
              });
            });
          });
        }, Promise.resolve());
        return Promise.all([typed, heard]);
      });
    });
  }

  /* How long a line takes to type, in seconds. */
  function typedFor(text) {
    var cues = cuesFor(text);
    if (cues) return (cues[cues.length - 1] + global.Typer.WORD_IN * 2) / 1000;
    return text.length * global.Typer.TYPE_MS / 1000;
  }

  /* A page that turns itself: handOver without the button. */
  function autoTurn(ms) {
    note(at, page);
    announce();
    if (seek > 0) {
      seek--;
      turned();
      if (!seek) Flow.resume();
      return Promise.resolve();
    }
    Flow.resume();
    return Flow.wait(ms == null ? AUTO_TURN : ms).then(turned);
  }

  /* The line off the header, with the header kept open. */
  function lineAway() {
    if (!dom.promptLine.textContent.trim()) return Promise.resolve();
    return Flow.anim(Beats.lineOut(dom.promptLine)).then(clearPrompt);
  }

  /* ---- an activity finished -------------------------------------------- */
  var PRAISE = ['praiseGreatJob', 'praiseWellDone', 'praiseExcellent', 'praiseAwesome',
                'praiseFantastic', 'praiseBrilliant', 'praiseSuperb', 'praiseWonderful',
                'praiseAmazing', 'praisePerfect'];
  var praised = 0;
  function praiseKey() { return PRAISE[praised++ % PRAISE.length]; }

  function celebrate() {
    Beats.sfx('cheer');
    quiet(Flow.anim(Beats.confettiRain(dom.board)));
  }
  /* ...and a word of praise said as the confetti comes down. */
  function praise(key) {
    celebrate();
    return Flow.wait(Beats.ringing())
      .then(function () { return say(key || praiseKey()); });
  }

  /* The bubble put away, and the bird with it: its player stopped, so no
     frame is painted for a bird nobody can see. */
  function restoreBubble() {
    sayBubble.clear();
    mascot.stop();
    dom.bubble.setAttribute('hidden', '');
    M.set([dom.bubble, dom.bird], { clearProps: 'opacity,transform' });
  }

  /* ---- the board's top band, taken away and given back ------------------- */
  function pictureAt(rect) {
    return {
      scale: Math.min(rect.width / VB_W, rect.height / VB_H),
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  var rowsMove = null;
  function collapseHeader(on, cls, pop) {
    if (dom.board.classList.contains(cls || 'is-headless') === !!on) {
      return rowsMove && rowsMove.progress() < 1 ? rowsMove : null;
    }
    return moveRows(function () {
      dom.board.classList.toggle(cls || 'is-headless', !!on);
    }, pop);
  }

  function openHeader() {
    if (!dom.board.classList.contains('is-headless') &&
        !dom.board.classList.contains('is-bare')) return null;
    return moveRows(function () {
      dom.board.classList.remove('is-headless', 'is-bare');
    });
  }

  /* `change` rewrites the board's row classes; the picture's move between
     the two layouts is played as one transform. */
  function moveRows(change, pop) {
    var was = pictureAt(dom.figure.getBoundingClientRect());
    dom.board.style.transition = 'none';
    change();
    var now = pictureAt(dom.figure.getBoundingClientRect());
    dom.board.style.transition = '';

    if (!was.scale || !now.scale || M.reducedMotion()) return (rowsMove = null);

    M.set(dom.figure, {
      scale: was.scale / now.scale,
      x: was.x - now.x,
      y: was.y - now.y,
      transformOrigin: 'center center'
    });
    var tl = M.timeline({ willChange: dom.figure, willChangeValue: 'transform' });
    tl.to(dom.figure, pop
      ? { scale: 1, x: 0, y: 0, duration: M.dur(0.7), ease: 'back.out(1.6)' }
      : { scale: 1, x: 0, y: 0, duration: M.dur(0.66), ease: 'power2.inOut' });
    return (rowsMove = tl);
  }

  /* ---- a scene, over ------------------------------------------------------
     The line leaves and the board is wiped in the same beat; the header
     closes once its line has gone. */
  var wipers = [];
  function addWipe(fn) { wipers.push(fn); }

  function wipeBoard() {
    var shut = Flow.anim(Beats.bubbleOut(dom.bubble));
    var line = Flow.anim(Beats.lineOut(dom.promptLine));
    var gone = line.then(function () { return headerOut(); });
    var figure = Flow.anim(Beats.clearFigure(figureParts()));

    var footer = [];
    if (!dom.tray.hasAttribute('hidden')) {
      footer.push(Flow.anim(Beats.trayOut(dom.tray, chips)));
    }
    if (!dom.choices.hasAttribute('hidden')) {
      footer.push(Flow.anim(Beats.trayOut(dom.choices, choiceBtns)));
    }
    var extra = sections.reduce(function (all, s) {
      return s.wipe ? all.concat(s.wipe()) : all;
    }, []);
    wipers.forEach(function (w) { extra = extra.concat(w() || []); });

    return Promise.all([gone, shut, line, figure].concat(footer, extra)).then(function () {
      clearPrompt();
      restoreBubble();
      resetFigure();
      resetFooter();
    });
  }

  /* ---- waiting on an answer ----------------------------------------------
     Several buttons, one answer: whichever is pressed fires a click at the
     hidden gate and the scene waits on THAT. Hands back the index pressed,
     or `opts.answer` if a skip answered it. */
  function askChoice(buttons, opts) {
    var o = opts || {};
    var picked = -1;
    var live = true;

    function onPick(ev) {
      if (!live) return;
      live = false;
      var btn = ev.currentTarget;
      picked = buttons.indexOf(btn);
      ripple(ev, btn);
      dom.gate.dispatchEvent(new MouseEvent('click'));
    }
    function off() {
      live = false;
      buttons.forEach(function (b) {
        b.removeEventListener('click', onPick);
        b.classList.add('is-done');
      });
    }
    buttons.forEach(function (b) { b.addEventListener('click', onPick); });

    return Flow.once(dom.gate, { auto: true }).then(
      function () {
        off();
        if (picked < 0) picked = (o.answer == null ? 0 : o.answer);
        return picked;
      },
      function (err) { off(); throw err; });
  }

  /* One press on one of several pills, tried until the right one: a wrong
     press is refused -- the pill shakes, turns red and is spent, `onWrong`
     is told which -- and the learner tries again among the rest. Resolves
     with { misses } once the right one is pressed (or a skip presses it). */
  function askUntilRight(buttons, answerIndex, opts) {
    var o = opts || {};
    var live = true;
    var misses = 0;
    var good = buttons[answerIndex];

    function onPick(ev) {
      if (!live) return;
      var btn = ev.currentTarget;
      if (btn.classList.contains('is-done')) return;
      ripple(ev, btn);
      if (btn === good) {
        live = false;
        Beats.choiceRight(btn);
        dom.gate.dispatchEvent(new MouseEvent('click'));
        return;
      }
      misses++;
      btn.classList.add('is-done');
      quiet(Flow.anim(Beats.choiceWrong(btn)).then(function () {
        btn.classList.remove('is-wrong');
        btn.classList.add('is-out');
      }));
      if (o.onWrong) o.onWrong(buttons.indexOf(btn), misses);
    }
    function off() {
      live = false;
      buttons.forEach(function (b) {
        b.removeEventListener('click', onPick);
        b.classList.add('is-done');
      });
    }
    function fillIn() {
      if (!good.classList.contains('is-right')) good.classList.add('is-right');
    }
    buttons.forEach(function (b) { b.addEventListener('click', onPick); });

    return Flow.once(dom.gate, { auto: true }).then(
      function () { fillIn(); off(); return { misses: misses }; },
      function (err) { off(); throw err; });
  }

  /* ---- the drag, shown ---------------------------------------------------
     A faint card and a hand carried from the tray to the box the learner
     is to fill, while the instruction is said. */
  var GUIDE_ALPHA = 0.5;
  var GUIDE_LOOPS = 2;

  function dragGuide(to) {
    var none = { stop: function () {} };
    if (!to || Flow.isFast() || M.reducedMotion() || dom.tray.hasAttribute('hidden')) return none;
    var sample = dom.tray.querySelector('[data-name]');
    var tray = dom.tray.getBoundingClientRect();
    var end = to.getBoundingClientRect();
    if (!sample || !tray.width || !end.width) return none;
    var size = sample.getBoundingClientRect();

    var wrap = document.createElement('div');
    wrap.className = 'drag-guide';
    wrap.setAttribute('aria-hidden', 'true');
    var card = document.createElement('div');
    card.className = 'drag-guide__card';
    card.style.width = size.width + 'px';
    card.style.height = size.height + 'px';
    card.style.left = -size.width / 2 + 'px';
    card.style.top = -size.height / 2 + 'px';
    wrap.appendChild(card);
    var hand = document.createElementNS(SVG_NS, 'svg');
    hand.setAttribute('class', 'drag-guide__hand');
    hand.setAttribute('viewBox', '-16 -2 44 52');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', HAND_D);
    hand.appendChild(path);
    wrap.appendChild(hand);
    document.body.appendChild(wrap);

    var sx = tray.left + tray.width / 2, sy = tray.top;
    var ex = end.left + end.width / 2, ey = end.top + end.height / 2;

    function stop() { if (tl.totalProgress() < 1) tl.totalProgress(1); }
    var tl = M.timeline({
      willChange: [wrap, card], willChangeValue: 'transform, opacity',
      revert: function () {
        dom.tray.removeEventListener('pointerdown', stop, true);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }
    });
    tl.set(wrap, { x: sx, y: sy, opacity: 0 })
      .to(wrap, { opacity: GUIDE_ALPHA, duration: M.dur(0.3), ease: 'power2.out' })
      .to(card, { scale: 0.94, duration: M.dur(0.15), ease: 'power2.out' })
      .to(wrap, { x: ex, y: ey, duration: M.dur(1.0), ease: 'power2.inOut' })
      .to(card, { scale: 1, duration: M.dur(0.2), ease: 'back.out(2)' })
      .to(wrap, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' }, '+=' + M.dur(0.25));
    tl.repeat(GUIDE_LOOPS - 1).repeatDelay(M.dur(0.4));
    dom.tray.addEventListener('pointerdown', stop, true);
    return { stop: stop };
  }

  /* The lesson's pointing hand, drawn in line: the index finger up with
     its tip at the origin, three fingers curled beside it, the thumb to
     the other side, the palm below. */
  var HAND_D =
    'M-3.5 26 C-5 24 -7 23 -9.5 23.5 C-13 24.5 -14 28 -12 31 L-6 39 C-3 44 3 47 9 47 ' +
    'C18 47 24.5 41 24.5 31 L24.5 18.5 A3.5 3.5 0 0 0 17.5 18.5 L17.5 22 ' +
    'M17.5 22 L17.5 16 A3.5 3.5 0 0 0 10.5 16 L10.5 22 ' +
    'M10.5 22 L10.5 13.5 A3.5 3.5 0 0 0 3.5 13.5 L3.5 22 ' +
    'M3.5 22 L3.5 3.5 A3.5 3.5 0 0 0 -3.5 3.5 L-3.5 26';

  /* ---- the activity's interaction -----------------------------------------
     Names and boxes, and two ways to put one in the other: drag, or tap a
     name then tap a box (which is what a keyboard does). */
  var TAP_SLOP = 8;
  var DROP_SLACK = 10;

  function armQuiz(q, names, opts) {
    var o = opts || {};
    var failed = false;
    var misses = 0;
    var live = true;
    var picked = null;
    var drag = null;
    var placed = 0;

    q.g = o.group;
    if (q.g) q.g.classList.add('is-live');

    function boxAt(x, y) {
      for (var i = 0; i < q.boxes.length; i++) {
        var b = q.boxes[i];
        if (b.filled) continue;
        var r = b.rect.getBoundingClientRect();
        if (x >= r.left - DROP_SLACK && x <= r.right + DROP_SLACK &&
            y >= r.top - DROP_SLACK && y <= r.bottom + DROP_SLACK) return b;
      }
      return null;
    }
    function hover(box) {
      q.boxes.forEach(function (b) {
        var on = (b === box);
        [b.g, b.leader].forEach(function (e) { e.classList.toggle('is-over', on); });
      });
      if (o.onHover) o.onHover(box);
    }
    function pick(chip) {
      if (picked) picked.classList.remove('is-picked');
      picked = chip;
      if (chip) chip.classList.add('is-picked');
    }
    function home(chip) {
      chip.classList.remove('is-lifted');
      Beats.chipHome(chip);
    }
    function attempt(box, chip) {
      hover(null);
      if (!box || box.filled) return home(chip);
      if (box.name === chip.dataset.name) return right(box, chip);
      return wrong(box, chip);
    }
    function right(box, chip) {
      dock(box, chip);
      if (placed >= q.boxes.length) finish();
    }
    function dock(box, chip) {
      box.filled = true;
      placed++;
      pick(null);
      chip.classList.remove('is-lifted');

      var c = chip.getBoundingClientRect();
      var r = box.rect.getBoundingClientRect();
      Beats.chipDock(chip,
        (r.left + r.width / 2) - (c.left + c.width / 2),
        (r.top + r.height / 2) - (c.top + c.height / 2));

      box.text.textContent = T(box.name);
      box.g.setAttribute('aria-label', T('a11yBoxRight', { name: T(box.name) }));
      Beats.boxRight(box);
      if (o.onRight) o.onRight(box, chip);
    }
    function wrong(box, chip) {
      failed = true;
      misses++;
      pick(null);
      if (o.onWrong) o.onWrong(box, chip);
      Beats.boxWrong(box);
      home(chip);
    }
    function finish() {
      if (!live) return;
      live = false;
      done();
    }
    function done() {
      dom.gate.dispatchEvent(new MouseEvent('click'));
    }

    function onDown(ev) {
      if (!live || drag) return;
      var chip = ev.currentTarget;
      if (chip.classList.contains('is-docked')) return;
      ev.preventDefault();
      drag = {
        chip: chip, id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, moved: false,
        x0: gsap.getProperty(chip, 'x') || 0, y0: gsap.getProperty(chip, 'y') || 0
      };
      if (chip.setPointerCapture) {
        try { chip.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
      }
      chip.classList.add('is-lifted');
      M.to(chip, { scale: 1.06, duration: M.dur(0.12), ease: 'power2.out', overwrite: 'auto' });
    }
    function onMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dx = ev.clientX - drag.ox, dy = ev.clientY - drag.oy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > TAP_SLOP) drag.moved = true;
      if (!drag.moved) return;
      M.set(drag.chip, { x: drag.x0 + dx, y: drag.y0 + dy });
      hover(boxAt(ev.clientX, ev.clientY));
    }
    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      if (!d.moved) {
        d.chip.classList.remove('is-lifted');
        M.to(d.chip, { scale: 1, duration: M.dur(0.15), ease: 'power2.out', overwrite: 'auto' });
        pick(picked === d.chip ? null : d.chip);
        return;
      }
      attempt(boxAt(ev.clientX, ev.clientY), d.chip);
    }
    function onCancel(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      hover(null);
      home(d.chip);
    }
    function onChipKey(ev) {
      if (!live) return;
      if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
      ev.preventDefault();
      var chip = ev.currentTarget;
      if (chip.classList.contains('is-docked')) return;
      pick(picked === chip ? null : chip);
    }
    function boxOf(ev) {
      var g = ev.currentTarget;
      for (var i = 0; i < q.boxes.length; i++) if (q.boxes[i].g === g) return q.boxes[i];
      return null;
    }
    function onBoxUp(ev) {
      if (!live || drag || !picked) return;
      var box = boxOf(ev);
      if (box) attempt(box, picked);
    }
    function onBoxKey(ev) {
      if (!live || !picked) return;
      if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
      ev.preventDefault();
      var box = boxOf(ev);
      if (box) attempt(box, picked);
    }
    function onBoxEnter(ev) {
      if (!live || drag) return;
      hover(boxOf(ev));
    }
    function onBoxLeave() {
      if (!live || drag) return;
      hover(null);
    }

    function off() {
      live = false;
      names.forEach(function (c) {
        c.removeEventListener('pointerdown', onDown);
        c.removeEventListener('keydown', onChipKey);
      });
      q.boxes.forEach(function (b) {
        b.g.removeEventListener('pointerup', onBoxUp);
        b.g.removeEventListener('keydown', onBoxKey);
        b.g.removeEventListener('pointerenter', onBoxEnter);
        b.g.removeEventListener('pointerleave', onBoxLeave);
      });
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if (q.g) q.g.classList.remove('is-live');
      hover(null);
      pick(null);
      drag = null;
    }

    names.forEach(function (c) {
      c.addEventListener('pointerdown', onDown);
      c.addEventListener('keydown', onChipKey);
    });
    q.boxes.forEach(function (b) {
      b.g.addEventListener('pointerup', onBoxUp);
      b.g.addEventListener('keydown', onBoxKey);
      b.g.addEventListener('pointerenter', onBoxEnter);
      b.g.addEventListener('pointerleave', onBoxLeave);
    });
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);

    /* Every name still in the tray put into its own box, at once: what a
       skip needs. */
    function fill() {
      q.boxes.forEach(function (b) {
        if (b.filled) return;
        for (var i = 0; i < names.length; i++) {
          if (names[i].dataset.name === b.name) { dock(b, names[i]); return; }
        }
      });
    }

    return Flow.once(dom.gate, { auto: true }).then(
      function () { live = false; fill(); off(); return { right: !failed }; },
      function (err) { off(); throw err; });
  }

  /* The box the activity is asking for now, lifted out of the quiet level. */
  function targetBox(box, on) {
    [box.g, box.leader].forEach(function (e) { e.classList.toggle('is-target', on); });
  }

  /* ======================================================================
   * Scene 0 -- welcome
   * The welcome is the swamp itself: the title drops in on its hanging
   * plate (a CSS entrance, from the first frame -- see .welcome__title),
   * and Start is offered once everything has loaded. Then the welcome
   * stands aside, and the first line arrives on a plate of its own in the
   * middle of the screen (the bubble), with the bird hopping up under it
   * to say it -- the one screen the bird is on.
   * ====================================================================== */
  function sceneWelcome() {
    return Flow.wait(SHORT)
      .then(function () { return Flow.anim(global.Loader ? global.Loader.ready() : null); })
      .then(function () {
        dom.startBtn.removeAttribute('hidden');
        return Flow.frame();
      })
      .then(function () {
        dom.startBtn.classList.add('in');
        M.button3d(dom.startBtn, { edge: 5 });
        return Flow.once(dom.startBtn, { auto: true });
      })
      .then(function () {
        Beats.sfx('click');
        return Flow.anim(Beats.welcomeOut(dom.welcome, dom.title, dom.startBtn));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        Beats.bubbleArm(dom.bubble);
        Beats.birdArm(dom.bird);
        mascot.state('talking');
        var hello = keyed('s1Hello');
        var heard = quiet(voiceOf(hello));
        var said = sayBubble(hello);
        Beats.bubbleIn(dom.bubble);
        var hop = Flow.wait(BIRD_LAG).then(function () {
          return Flow.anim(Beats.birdIn(dom.bird));
        });
        return Promise.all([said, heard, hop]);
      })
      .then(function () {
        mascot.settle();
        return Flow.wait(SHORT);
      })
      .then(function () { return handOver(dom.nextBtn); });
  }

  /* The lesson in playing order. */
  var SCENES = [
    { name: 'Welcome', play: sceneWelcome }
  ];

  /* The sections, each in a file of its own. A section brings its scenes
     and a handful of hooks the board's housekeeping calls into:
       build(kit)  once, when the board exists
       parts()     what it has on the figure, for wipeBoard to fade
       wipe()      promises for whatever it keeps OUTSIDE the figure
       reset()     back to rest, with no animation
       stage(i)    the board as its i-th scene expects to find it */
  var BASE_SCENES = SCENES.length;
  var sections = [];
  var skills = [{ first: 0, name: 'Trigonometric ratios' }];

  function addSection(spec) {
    if (!spec || !spec.scenes) return;
    spec.first = SCENES.length;
    sections.push(spec);
    if (spec.skill) skills.push({ first: spec.first, name: spec.skill });
    spec.scenes.forEach(function (sc) { SCENES.push(sc); });
    if (dom && spec.build) spec.build(kit);
  }
  function sectionOf(index) {
    for (var i = sections.length - 1; i >= 0; i--) {
      if (index >= sections[i].first) return sections[i];
    }
    return null;
  }

  /* Where the lesson is, and whoever asked to be told when that changes. */
  var at = 0;
  var page = 0;
  var seen = [];
  var seek = 0;
  var seekIn = -1;
  var watchers = [];

  function note(scene, p) {
    if (!(seen[scene] > p + 1)) seen[scene] = p + 1;
  }
  function turned() {
    page++;
    announce();
  }
  function announce() {
    var where = {
      scene: at, scenes: SCENES.length, name: SCENES[at].name,
      page: page, pages: seen.slice()
    };
    watchers.forEach(function (fn) {
      try { fn(where); } catch (e) {}
    });
  }

  function play(from) {
    var chain = Promise.resolve();
    for (var i = from || 0; i < SCENES.length; i++) {
      chain = chain.then(enter(i));
    }
    return chain;
  }
  function enter(i) {
    return function () {
      at = i;
      page = 0;
      note(i, 0);
      if (seek && i !== seekIn) { seek = 0; Flow.resume(); }
      announce();
      return SCENES[i].play();
    };
  }

  /* ======================================================================
   * Setting up and starting over
   * ====================================================================== */
  function rewind() {
    if (sayBubble) sayBubble.clear();
    if (sayPrompt) sayPrompt.clear();
    speaking++;
    awaiting = [];
    begun = { text: null, at: 0 };
    if (global.I18n) global.I18n.stop();

    headerUp = false;
    rowsMove = null;
    dom.welcome.removeAttribute('hidden');
    dom.startBtn.setAttribute('hidden', '');
    dom.startBtn.classList.remove('in');
    dom.nextBtn.setAttribute('hidden', '');
    dom.bubble.setAttribute('hidden', '');

    dom.board.classList.remove('show', 'is-animating', 'is-headless', 'is-bare');
    dom.board.setAttribute('aria-hidden', 'true');

    restoreBubble();
    resetFigure();
    resetFooter();
    wipers.forEach(function (w) { if (w.reset) w.reset(); });

    M.set([dom.welcome, dom.title, dom.startBtn, dom.nextBtn, dom.bubble,
           dom.board, dom.promptLine],
          { clearProps: 'opacity,transform,filter' });
  }

  /* The board as the scene at `index` expects to FIND it, written straight
     in with no animation. */
  function stageFor(index) {
    if (index <= 0) return;
    dom.welcome.setAttribute('hidden', '');
    if (index <= 1) return;

    dom.board.classList.add('show');
    dom.board.setAttribute('aria-hidden', 'false');

    if (index >= BASE_SCENES) {
      var s = sectionOf(index);
      if (s && s.stage) s.stage(index - s.first);
    }
  }

  function init() {
    if (dom) return { dom: dom };
    dom = collect();
    sayBubble = onVoice(global.Typer.create($('bubbleType'), { box: dom.bubble }));
    mascot = global.Mascot.create({ slot: dom.bird, idle: false });
    sayPrompt = onVoice(global.Typer.create($('promptType')));
    sections.forEach(function (s) { if (s.build) s.build(kit); });
    return { dom: dom };
  }

  var started = false;

  function runFrom(index, wanted) {
    if (!dom) init();
    started = true;
    index = Math.max(0, Math.min(SCENES.length - 1, index | 0));
    seek = Math.max(0, wanted | 0);
    seekIn = index;

    Flow.reset();
    dom.board.style.transition = 'none';
    rewind();
    stageFor(index);
    void dom.board.offsetHeight;
    dom.board.style.transition = '';
    return Flow.run(function () {
      if (seek > 0) Flow.skip();
      return play(index);
    });
  }

  function run() { return runFrom(0, 0); }

  /* What a section needs from this file to speak with the same voice. */
  var kit = {
    BEAT: BEAT, SHORT: SHORT, HOLD_ASK: HOLD_ASK, AUTO_TURN: AUTO_TURN, LOOK: LOOK,
    TAP_SLOP: TAP_SLOP,
    CX: CX, CY: CY, VB_W: VB_W, VB_H: VB_H, SHIFT: SHIFT,
    BOX_W: BOX_W, BOX_H: BOX_H, LEAD_STUB: LEAD_STUB, HAND_D: HAND_D,
    dom: function () { return dom; },
    el: el, seg: seg, round2: round2,
    buildBox: buildBox, emptyBox: emptyBox, targetBox: targetBox,
    buildChips: buildChips, buildChoices: buildChoices, shuffle: shuffle,
    chips: function (list) { if (list) chips = list; return chips; },
    choices: function (list) { if (list) choiceBtns = list; return choiceBtns; },
    handOver: handOver, speak: speak, say: say, arriveSaying: arriveSaying,
    speakBySentence: speakBySentence,
    clearPrompt: clearPrompt, headerIn: headerIn, headerOut: headerOut,
    sayBubble: function (text) { return sayBubble(text); },
    clearBubble: function () { sayBubble.clear(); },
    restoreBubble: restoreBubble,
    onVoice: onVoice,
    wipeBoard: wipeBoard, collapseHeader: collapseHeader, openHeader: openHeader,
    resetFooter: resetFooter, addWipe: addWipe,
    askChoice: askChoice, askUntilRight: askUntilRight, armQuiz: armQuiz, dragGuide: dragGuide,
    keyed: keyed, hear: hear, onWord: onWord, onPhrase: onPhrase, wordAt: wordAt,
    typedFor: typedFor, sentencesOf: sentencesOf,
    celebrate: celebrate, praise: praise, praiseKey: praiseKey,
    autoTurn: autoTurn, lineAway: lineAway,
    ripple: ripple, quiet: quiet, clearInline: clearInline
  };

  global.Pages = {
    init: init,
    addSection: addSection,
    kit: kit,
    run: run,
    runFrom: runFrom,
    rewind: rewind,
    started: function () { return started; },
    levels: function () { return SCENES.map(function (s) { return s.name; }); },
    skills: function () { return skills.slice(); },
    level: function () { return at; },
    page: function () { return page; },
    pages: function () { return seen.slice(); },
    onLevel: function (fn) {
      if (typeof fn !== 'function') return;
      watchers.push(fn);
      fn({ scene: at, scenes: SCENES.length, name: SCENES[at].name,
           page: page, pages: seen.slice() });
    },
    dom: function () { return dom; }
  };
})(window);
