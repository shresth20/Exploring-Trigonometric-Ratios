/* ==========================================================================
 * tank.js -- the commander and her tank, on the welcome and at the end
 * --------------------------------------------------------------------------
 * The welcome's line and the end's are said by the commander, from her
 * tank: a stone causeway rises out of the swamp, the tank rolls onto it
 * from the left and pulls up, its hatch is knocked loose and thrown open,
 * and she pops up out of it to speak. Once she is done she ducks back in,
 * the lid slams, and the tank drives off to the right.
 *
 * The tank is one SVG (#tank in index.html) laid out in the hull's own
 * pixels -- assets/new/tank/parts/hull.webp is 1000 x 322 at (0, 0) -- with
 * the barrel, the turret dome and the road wheels cut from the same sheet
 * and placed against it. The lid is drawn rather than painted, because it
 * has to swing. Shut, it is a flat ellipse lying in the ring; open, a disc
 * stood up on its hinge at the back of the hole, with its inside to us.
 * Seen from the side, the swing between the two is a scaleY about that
 * hinge that passes through zero -- so it is played as exactly that.
 *
 * Everything moves by transform and opacity, made through motion.js, so
 * Skip lands it and Replay takes it back like any other beat. The beats
 * here return their timelines and decide nothing about WHEN: that is
 * pages.js. Each beat's sound is a cue on its timeline (the tank* and
 * hatch* clips in animations.js), so it goes off with the move it belongs
 * to; the engine's clips are cut to the length of the drives below.
 *
 * Load order: js/motion.js -> js/tank.js -> js/pages.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var DEG = 180 / Math.PI;

  /* ---- the tank, in hull pixels -----------------------------------------
     Measured off the art: the hole in the turret ring is centred on
     (410, 33), the lid's hinge is its back edge, and her bust is cut off
     by the rim 3.5 below the hole's middle. */
  var VIEW_W = 1060;              /* the svg's viewBox width                 */
  var HINGE = '410 25';           /* the lid's hinge, at the hole's back edge */
  var LID_FLAT = -8 / 90;         /* the scaleY that lays the stood-up lid   */
                                  /* flat in the ring: its depth / its radius */
  var RIM = '410 36.5';           /* where the rim cuts her off              */
  var HEAD = { x: 410, y: -45 };  /* the middle of her helmet, once she is up */
  var DOWN = 150;                 /* how far under her mark she waits, unseen */
  var WHEEL_R = 53;               /* a tyre's radius: a turn per 2πR rolled  */
  var NOSE = '720 318';           /* where the hull dips as it brakes...     */
  var TAIL = '90 318';            /* ...and squats as it pulls away          */
  var CLEAR = 40;                 /* px past the window's edge it waits at   */

  /* The steam the hatch lets out: where each puff leaves the rim, how far
     it blows, and its size. The first and last also leak while the lid is
     only cracked. */
  var PUFFS = [
    { x: 340, y: 30, dx: -64, dy: -22, r: 9 },
    { x: 362, y: 24, dx: -34, dy: -50, r: 7 },
    { x: 394, y: 22, dx: -10, dy: -64, r: 8 },
    { x: 428, y: 22, dx: 12,  dy: -60, r: 7 },
    { x: 458, y: 24, dx: 38,  dy: -46, r: 8 },
    { x: 480, y: 30, dx: 66,  dy: -22, r: 9 }
  ];

  /* Her blinks, in seconds into a round: uneven, and twice running once,
     so it reads as somebody blinking rather than a light flashing. */
  var BLINKS = [0.7, 3.4, 6.1, 6.4, 9.5];
  var ROUND = 11.5;
  var BLINK = 0.12;

  /* ---- her mouth, in time with her voice --------------------------------
     lips.webp is the sheet's sixteen mouths, A..P, in a row of cells
     LIP_CELL wide (in hull pixels, as drawn in index.html); one is shown
     by sliding the strip under a window one cell wide. Which one is read
     off two things at each moment of the clip: the letter being said --
     each word's letters spread over the time from its cue (the locale's
     word timings) to the next -- picks the KIND of mouth, and how loud the
     voice is just then, measured off the clip itself, picks how far open
     (SHAPES lists each kind quietest first). Under a whisper the lips
     close. */
  var LIP_CELL = 22.253;
  var LIPS = 'ABCDEFGHIJKLMNOP';
  var SHAPES = {
    rest: 'III',     /* between words                         */
    mbp:  'PPA',     /* lips pressed: m b p                   */
    fv:   'JJB',     /* teeth on the lip: f v                 */
    ee:   'JMM',     /* teeth together: s z c x j             */
    ah:   'CDE',     /* a                                     */
    eh:   'NKL',     /* e                                     */
    ih:   'BKK',     /* i y                                   */
    oh:   'GFF',     /* o                                     */
    oo:   'OGG',     /* u                                     */
    w:    'HHO',     /* rounded: w q                          */
    con:  'BCD'      /* the rest: t d n l r k g h ...         */
  };
  var HUSH = 0.14;        /* a level under this is silence           */
  var LEAD = 40;          /* ms the mouth shapes ahead of the sound   */
  var HOLD = 70;          /* ms a mouth is held at least: ~14 a second */
  var ENV_FPS = 60;       /* the clip's loudness, read this often     */

  function kindOf(ch) {
    if ('mbp'.indexOf(ch) >= 0) return 'mbp';
    if ('fv'.indexOf(ch) >= 0) return 'fv';
    if ('wq'.indexOf(ch) >= 0) return 'w';
    if ('szcxj'.indexOf(ch) >= 0) return 'ee';
    if (ch === 'a') return 'ah';
    if (ch === 'e') return 'eh';
    if (ch === 'i' || ch === 'y') return 'ih';
    if (ch === 'o') return 'oh';
    if (ch === 'u') return 'oo';
    return 'con';
  }

  /* How loud the clip is, ENV_FPS times a second, as a share of how loud
     the line mostly is (its 90th percentile), so a quiet recording opens
     the mouth as wide as a loud one. Kept per decoded clip. */
  var envelopes = new WeakMap();
  function envelope(buf) {
    var hit = envelopes.get(buf);
    if (hit) return hit;
    var data = buf.getChannelData(0);
    var step = Math.max(1, Math.round(buf.sampleRate / ENV_FPS));
    var n = Math.ceil(data.length / step);
    var lv = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var sum = 0, end = Math.min(data.length, (i + 1) * step);
      for (var j = i * step; j < end; j++) sum += data[j] * data[j];
      lv[i] = Math.sqrt(sum / Math.max(1, end - i * step));
    }
    var sorted = Array.prototype.slice.call(lv).sort(function (a, b) { return a - b; });
    var ref = sorted[Math.floor(n * 0.9)] || 1;
    for (var k = 0; k < n; k++) lv[k] = Math.min(1, lv[k] / ref);
    envelopes.set(buf, lv);
    return lv;
  }

  /* A line's words as stretches of its clip: [{ from, to, letters }], ms. */
  function wordsOf(text, cues, length) {
    var words = String(text).match(/\S+\s*/g) || [];
    var list = [];
    words.forEach(function (w, i) {
      var from = cues ? cues[i] : length * i / words.length;
      var to = cues ? (i + 1 < cues.length ? cues[i + 1] : length) : length * (i + 1) / words.length;
      list.push({ from: from, to: to, letters: w.toLowerCase().replace(/[^a-z]/g, '') });
    });
    return list;
  }

  /* A sound on the tank's timeline (animations.js: tankDrive, hatchKnock,
     ...) -- but not while a skip lands the whole sequence in one instant,
     nor when it plays without motion: either way every cue on it would go
     off at once. */
  function sound(key) {
    if ((global.Flow && global.Flow.isFast()) || M.reducedMotion()) return null;
    return global.Beats ? global.Beats.sfx(key) : null;
  }
  function cue(key) {
    return function () { sound(key); };
  }

  function draw(tag, attrs, parent) {
    var e = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    parent.appendChild(e);
    return e;
  }

  function create() {
    function $(id) { return document.getElementById(id); }
    var host = $('host');
    var road = $('road');
    var tank = $('tank');
    var body = $('tankBody');
    var shut = $('lidShut');
    var open = $('lidOpen');
    var hinge = $('lidHinge');
    var pop = $('tankPop');
    var cmdr = $('tankCmdr');
    var blink = $('tankBlink');
    var wheels = Array.prototype.slice.call(tank.querySelectorAll('.tank__wheel'));

    /* The steam and the burst she pops out with, drawn from the numbers
       above rather than written out in the page. */
    var puffs = PUFFS.map(function (p) {
      return draw('circle', { cx: p.x, cy: p.y, r: p.r }, $('tankSteam'));
    });
    draw('circle', { cx: HEAD.x, cy: HEAD.y, r: 70 }, pop);
    for (var i = 0; i < 7; i++) {
      var a = Math.PI * (1.12 + i * 0.127);
      draw('line', {
        x1: HEAD.x + Math.cos(a) * 80, y1: HEAD.y + Math.sin(a) * 80,
        x2: HEAD.x + Math.cos(a) * 96, y2: HEAD.y + Math.sin(a) * 96
      }, pop);
    }

    var mouth = $('tankMouth');
    var lips = $('tankLips');

    var parts = [road, tank, body, shut, open, hinge, pop, cmdr, blink, mouth, lips].concat(puffs, wheels);
    var talking = null;
    var blinking = null;
    var line = null;       /* the line she is saying: its clip, words and cues */
    var speaking = 0;      /* the mouth's frame loop, while it runs */
    var engine = null;     /* the engine's sound, while it may still be running */

    /* The engine, started as the tank moves off; and cut, should the drive
       be skipped or the scene be taken down under it. */
    function startEngine(key) {
      return function () {
        stopEngine();
        engine = sound(key);
      };
    }
    function stopEngine() {
      if (engine) engine.stop();
      engine = null;
    }
    function engineIfSkipped() {
      if (global.Flow && global.Flow.isFast()) stopEngine();
    }
    /* The tank is out of sight: its engine fades out on its own, and is
       let go so that nothing tidying up after the tank cuts that short. */
    function letEngineGo() {
      if (global.Flow && global.Flow.isFast()) stopEngine();
      else engine = null;
    }

    /* px on screen per hull pixel; the drive's translate does not touch it */
    function unit() { return tank.getBoundingClientRect().width / VIEW_W; }
    /* how far the wheels turn, in degrees, for the tank to roll `px` */
    function turns(px) { return px / unit() / WHEEL_R * DEG; }

    /* ---- the loops she keeps up while she is out ---------------------- */
    function stopLoops() {
      if (talking) { talking.kill(); talking = null; }
      if (blinking) { blinking.kill(); blinking = null; }
      M.set(blink, { opacity: 0 });
      line = null;
      quietMouth();
    }

    /* ---- her mouth ----------------------------------------------------- */
    function showMouth(name) {
      M.set(lips, { x: -LIPS.indexOf(name) * LIP_CELL });
    }
    /* the lips away, and her own painted smile back */
    function quietMouth() {
      if (speaking) cancelAnimationFrame(speaking);
      speaking = 0;
      M.set(mouth, { opacity: 0 });
    }

    /* A clip has started to be heard (GameAudio.onStart). Hers: the mouth
       follows it, on its clock, until it has run out -- or talk() stops
       it. Without the clip's sound to measure (played by <audio>), the
       mouth opens once a syllable through each word instead. */
    function heard(url, info) {
      if (!line || url !== line.url || M.reducedMotion()) return;
      var env = info.buffer ? envelope(info.buffer) : null;
      var length = info.buffer ? info.buffer.duration * 1000
        : line.cues ? line.cues[line.cues.length - 1] + 900
        : line.text.length * 70;
      var words = wordsOf(line.text, line.cues, length);
      var zero = info.at - (info.from || 0) * 1000;    /* the clock at the clip's start */
      var shown = null, since = -Infinity;

      function wordAt(t) {
        for (var i = 0; i < words.length; i++) {
          if (t >= words[i].from && t < words[i].to) return words[i];
        }
        return null;
      }
      function mouthAt(t) {
        var w = wordAt(t);
        var f = w ? (t - w.from) / ((w.to - w.from) * 0.85) : 1;
        var kind = w && w.letters && f < 1
          ? kindOf(w.letters.charAt(Math.floor(f * w.letters.length))) : 'rest';
        var lv;
        if (env) {
          var i = Math.floor(t / 1000 * ENV_FPS);
          lv = i >= 0 && i < env.length ? env[i] : 0;
        } else {
          var syl = w ? Math.max(1, (w.letters.match(/[aeiouy]+/g) || []).length) : 1;
          lv = f < 1 ? 0.35 + 0.6 * Math.abs(Math.sin(Math.PI * f * syl)) : 0;
        }
        if (lv < HUSH) return kind === 'mbp' ? 'P' : 'I';
        var s = SHAPES[kind === 'rest' ? 'con' : kind];
        return s.charAt(lv < 0.45 ? 0 : lv < 0.8 ? 1 : 2);
      }
      function frame() {
        var now = performance.now();
        var t = now - zero + LEAD;
        if (t > length + LEAD) { quietMouth(); return; }
        if (now - since >= HOLD) {
          var name = mouthAt(t);
          if (name !== shown) { showMouth(name); shown = name; since = now; }
        }
        speaking = requestAnimationFrame(frame);
      }
      if (speaking) cancelAnimationFrame(speaking);
      showMouth('I');
      M.set(mouth, { opacity: 1 });
      speaking = requestAnimationFrame(frame);
    }
    if (global.GameAudio && global.GameAudio.onStart) global.GameAudio.onStart(heard);

    function startBlinking() {
      if (blinking) blinking.kill();
      blinking = null;
      if (M.reducedMotion()) return;
      var tl = M.timeline({ revert: function () { M.set(blink, { opacity: 0 }); } });
      tl.__motionEndless = true;
      BLINKS.forEach(function (at) {
        tl.set(blink, { opacity: 1 }, at).set(blink, { opacity: 0 }, at + BLINK);
      });
      tl.set({}, {}, ROUND);
      tl.repeat(-1);
      blinking = tl;
    }

    /* While her line -- the locale key `key` -- is said, she sways a
       little at the rim and bobs, as somebody talking does, and her mouth
       follows her voice from the moment its clip is heard (see heard).
       talk(null): she settles back where she stood, with her own smile. */
    function talk(key) {
      if (talking) {
        talking.kill();
        talking = null;
        M.to(cmdr, { rotation: 0, y: 0, duration: M.dur(0.2), ease: 'power2.out' });
      }
      line = null;
      quietMouth();
      var I = global.I18n;
      if (!key || !I) return;
      line = { url: I.voice(key), text: I.t(key), cues: I.cues(key) };
      if (M.reducedMotion()) return;
      var tl = M.timeline();
      tl.__motionEndless = true;
      tl.to(cmdr, { rotation: 1.4, y: -2.5, duration: 0.26, ease: 'sine.inOut' })
        .to(cmdr, { rotation: -1.2, y: 0, duration: 0.3, ease: 'sine.inOut' })
        .to(cmdr, { rotation: 0.6, y: -2, duration: 0.24, ease: 'sine.inOut' })
        .to(cmdr, { rotation: 0, y: 0, duration: 0.28, ease: 'sine.inOut' });
      tl.repeat(-1);
      talking = tl;
    }

    /* ---- out of sight, and set up to arrive ---------------------------- */
    function reset() {
      stopLoops();
      stopEngine();
      host.setAttribute('hidden', '');
      M.set(parts, { clearProps: 'transform,opacity' });
    }

    /* The causeway under the water, the tank waiting past the window's
       left edge with its hatch shut, and her down inside it. */
    function arm() {
      reset();
      host.removeAttribute('hidden');
      var from = -(tank.getBoundingClientRect().right + CLEAR);
      M.set(road, { yPercent: 70, opacity: 0 });
      M.set(tank, { x: from });
      M.set(wheels, { rotation: turns(from), transformOrigin: '50% 50%' });
      M.set(body, { svgOrigin: NOSE });
      M.set(open, { opacity: 0, scaleY: LID_FLAT, svgOrigin: HINGE });
      M.set([hinge, pop, blink].concat(puffs), { opacity: 0 });
      M.set(pop, { svgOrigin: HEAD.x + ' ' + HEAD.y });
      M.set(puffs, { transformOrigin: '50% 50%' });
      M.set(cmdr, { y: DOWN, svgOrigin: RIM });
    }

    /* Puffs of steam off the rim: `which` of them, blown `k` of the way. */
    function steam(which, k) {
      var tl = M.timeline();
      which.forEach(function (n) {
        var p = PUFFS[n];
        tl.fromTo(puffs[n],
          { opacity: 0.55, x: 0, y: 0, scale: 0.5 },
          { opacity: 0, x: p.dx * k, y: p.dy * k, scale: 1.5,
            duration: M.dur(0.55), ease: 'power2.out', immediateRender: false },
          M.gap(0.02) * n);
      });
      return tl;
    }

    /* The hatch: knocked twice from underneath, cracked, then thrown up
       onto its stop -- and, a beat later, out she pops. */
    function hatch() {
      var d = M.dur;
      var tl = M.timeline();
      tl.call(cue('hatchKnock'))
        .to(shut, { y: -5, duration: d(0.06), ease: 'power2.out' })
        .to(shut, { y: 0, duration: d(0.08), ease: 'power2.in' })
        .to(shut, { y: -5, duration: d(0.06), ease: 'power2.out' }, '+=' + d(0.1))
        .to(shut, { y: 0, duration: d(0.08), ease: 'power2.in' })
        /* cracked: it lifts a finger's width, and steam leaks at the rim */
        .to(shut, { y: -8, duration: d(0.2), ease: 'power3.out' }, '+=' + d(0.12))
        .call(cue('hatchHiss'), null, '<')
        .add(steam([0, 5], 0.5), '<')
        /* thrown: up and over, gathering speed, and it bangs on its stop
           (hatchOpen is the hinge's creak, then the clang) */
        .set(shut, { opacity: 0 })
        .call(cue('hatchOpen'))
        .set([open, hinge], { opacity: 1 })
        .fromTo(open, { scaleY: 0.12 },
          { scaleY: 1, duration: d(0.16), ease: 'power2.in', immediateRender: false })
        .addLabel('clang')
        .add(steam([0, 1, 2, 3, 4, 5], 1), 'clang')
        .to(open, { scaleY: 0.9, duration: d(0.07), ease: 'power2.out' }, 'clang')
        .to(open, { scaleY: 1, duration: d(0.12), ease: 'power2.in' }, 'clang+=' + d(0.07))
        /* a beat of empty hatch, then she springs up out of it, stretched
           on the way and squashed as she lands */
        .addLabel('pop', 'clang+=' + d(0.44))
        .call(cue('hatchPop'), null, 'pop')
        .fromTo(pop, { opacity: 1, scale: 0.4 },
          { opacity: 0, scale: 1.25, duration: d(0.42), ease: 'power3.out', immediateRender: false },
          'pop')
        .to(cmdr, { y: 0, duration: d(0.5), ease: 'back.out(1.7)' }, 'pop')
        .to(cmdr, {
          keyframes: [
            { scaleY: 1.12, scaleX: 0.93, duration: d(0.14), ease: 'power2.out' },
            { scaleY: 0.95, scaleX: 1.04, duration: d(0.14), ease: 'power2.inOut' },
            { scaleY: 1, scaleX: 1, duration: d(0.22), ease: 'power2.out' }
          ]
        }, 'pop')
        .call(startBlinking);
      return tl;
    }

    /* The whole arrival: the causeway rises, the tank rolls on -- its
       wheels turning exactly as far as it goes, its hull rumbling, dipping
       as it brakes and rocking back as it stops -- and the hatch opens. */
    function arrive() {
      var drive = M.dur(1.4);
      var at = M.dur(0.3);
      /* the hatch goes as she comes to rest: an ease-out's last tenth is
         the last hundredth of the road, so it reads as stopped */
      var still = at + drive * 0.9;
      var tl = M.timeline({ willChange: [road, tank], willChangeValue: 'transform, opacity' });
      tl.to(road, { yPercent: 0, opacity: 1, duration: M.dur(0.5), ease: 'power3.out' }, 0);
      /* tankDrive is timed to this drive: slowing to a stop at 1.4 s, the
         air brake, then idling under the knocks until it fades */
      tl.call(startEngine('tankDrive'), null, at);
      tl.call(engineIfSkipped, null, at + drive);
      tl.to(tank, { x: 0, duration: drive, ease: 'power2.out' }, at);
      tl.to(wheels, { rotation: 0, duration: drive, ease: 'power2.out' }, at);
      tl.to(body, {
        y: -2.5, duration: M.dur(0.1), ease: 'sine.inOut',
        yoyo: true, repeat: 2 * Math.max(1, Math.round(drive / 0.2)) - 1
      }, at);
      tl.to(body, { rotation: 1.4, duration: drive * 0.5, ease: 'sine.inOut' }, at + drive * 0.4);
      tl.to(body, { rotation: 0, duration: M.dur(0.6), ease: 'back.out(3)' }, still);
      tl.add(hatch(), still + M.dur(0.15));
      tl.call(engineIfSkipped);
      return tl;
    }

    /* Away: she ducks back in, the lid swings shut over her with a bang,
       and the tank pulls off to the right as the causeway sinks. */
    function leave() {
      var tl = M.timeline({
        willChange: [road, tank], willChangeValue: 'transform, opacity',
        revert: reset
      });
      if (host.hasAttribute('hidden')) return tl;
      stopLoops();
      var to = global.innerWidth - tank.getBoundingClientRect().left + CLEAR;
      var drive = M.dur(1.1);
      /* hatchShut is her dropping in, then the slam as the lid lands */
      tl.call(cue('hatchShut'), null, 0)
        .to(cmdr, { y: DOWN, scaleY: 1.06, scaleX: 0.96, duration: M.dur(0.22), ease: 'power2.in' }, 0)
        .to(open, { scaleY: LID_FLAT, duration: M.dur(0.2), ease: 'power2.in' }, M.dur(0.12))
        .set([open, hinge], { opacity: 0 })
        .set(shut, { opacity: 1, y: 0 })
        .to(body, { y: 2, duration: M.dur(0.05), ease: 'power2.out', yoyo: true, repeat: 1 })
        .addLabel('go', '+=' + M.dur(0.12))
        /* tankLeave revs up over this drive, and fades as it goes */
        .call(startEngine('tankLeave'), null, 'go')
        .to(tank, { x: to, duration: drive, ease: 'power2.in' }, 'go')
        .to(wheels, { rotation: turns(to), duration: drive, ease: 'power2.in' }, 'go')
        .to(body, { rotation: -1.2, svgOrigin: TAIL, duration: M.dur(0.3), ease: 'power2.out' }, 'go')
        .to(body, { rotation: 0, duration: M.dur(0.6), ease: 'power2.inOut' }, '>')
        .to(road, { yPercent: 70, opacity: 0, duration: M.dur(0.45), ease: 'power2.in' },
          'go+=' + drive * 0.6)
        .call(letEngineGo, null, 'go+=' + drive);
      return tl;
    }

    return {
      arm: arm,
      arrive: arrive,
      talk: talk,
      leave: leave,
      reset: reset
    };
  }

  global.Tank = { create: create };
})(window);
