/* ==========================================================================
 * mascot.js -- Swiftee, played from the sprite sheets
 * --------------------------------------------------------------------------
 * The character ships as uniform-grid sprite sheets, not as GIFs: one sheet
 * per animation, every cell the same size, and the pivot at each cell's exact
 * centre for every frame of every animation. That last property is the whole
 * point of the pipeline -- it means we can cut from the end of `wave_stop` to
 * the first frame of `talking` and the bird does not shift a pixel. A GIF
 * could not do that, and could not be paused on a chosen frame either.
 *
 * So the player here is deliberately small: one element, a background image,
 * and a background-position written once per sprite frame.
 *
 *   background-size:     cols*100%  rows*100%     (scales the whole sheet)
 *   background-position: col/(cols-1)  row/(rows-1)  as percentages
 *
 * Percentages rather than pixels, so the same maths works at any displayed
 * size -- the bird can be 260px tall centre stage and 90px tall in the board
 * header with no second code path.
 *
 * TIMING is read off a wall clock, exactly as the text reveal is: the frame
 * shown is the frame that SHOULD be showing at performance.now(), not the
 * next one in a chain. A janky frame drops a sprite frame rather than
 * stretching the animation, so the bird never falls behind the line it is
 * speaking.
 *
 * The grid table below is transcribed from
 * assets/swiftee-assets/atlas/swiftee.manifest.json rather than fetched from
 * it: the game has to run from file://, where fetch() of a sibling file is
 * blocked. Regenerate it from the manifest if the sheets are ever rebuilt.
 * ========================================================================== */
(function (global) {
  'use strict';

  var BASE = 'assets/swiftee-assets/spritesheets/2x/swiftee_';
  var SUFFIX = '@2x.webp';
  var FPS = 20;                     /* the rate the sheets were rendered at */

  /* clip: [frames, cols, rows] */
  var SHEETS = {
    blinking:    [40, 7, 6],        /* the idle -- what the bird does between lines */
    wave_start:  [ 7, 3, 3],
    waving:      [30, 6, 5],
    wave_stop:   [ 8, 3, 3],
    talk_start:  [ 3, 2, 2],
    talking:     [ 8, 3, 3],
    talk_stop:   [ 5, 3, 2],
    happy_start: [ 7, 3, 3],
    happy:       [40, 7, 6],
    happy_stop:  [ 7, 3, 3],
    /* the activity's three moods: a right answer, a wrong one, and the end */
    celebrate_start: [ 8, 3, 3],
    celebrating:     [50, 8, 7],
    celebrate_stop:  [10, 4, 3],
    confused_start:  [ 7, 3, 3],
    confused:        [40, 7, 6],
    confused_stop:   [ 7, 3, 3]
  };

  /* The rig ships transitions, not just loops: play the start once, hold the
     loop for as long as you like, then play the stop once. Cutting straight
     into a loop is what makes a sprite character look like a sprite. */
  var STATES = {
    waving:  { start: 'wave_start',  loop: 'waving',  stop: 'wave_stop'  },
    talking: { start: 'talk_start',  loop: 'talking', stop: 'talk_stop'  },
    happy:   { start: 'happy_start', loop: 'happy',   stop: 'happy_stop' },
    celebrating: { start: 'celebrate_start', loop: 'celebrating', stop: 'celebrate_stop' },
    confused:    { start: 'confused_start',  loop: 'confused',    stop: 'confused_stop'  },
    idle:    { start: null,          loop: 'blinking', stop: null        }
  };

  /* The frame the idle is ENTERED on. The idle sheet opens on its blink --
     frames 1-4 are the eyes closing and opening again -- so a bird dropped
     into it at frame 0 blinks the instant it settles, and the instant it is
     first revealed. Frame 10 is the same open-eyed pose as frame 0 (and as
     the last frame of every *_stop clip), so entering there is seamless and
     the first blink falls a natural second and a half later. */
  var IDLE_ENTRY = 10;
  /* clip -> the frame a loop of it is entered on, when not frame 0 */
  var ENTRY = { blinking: IDLE_ENTRY };

  function url(clip) { return BASE + clip + SUFFIX; }

  /* ---- preloading -------------------------------------------------------
     These sheets are big -- the idle alone is 3584x3072, ~44MB decoded --
     and a background-image switched to a sheet that is still downloading,
     or not yet decoded, paints NOTHING until it is: the bird blinks out for
     a frame or more. So every sheet is fetched AND decoded up front, the
     Image is kept so the browser keeps the resource, and the player never
     switches to a sheet until it is ready (see play). A sheet that fails
     still settles, because a missing bird must not stop the lesson -- it is
     marked unusable and the player holds the frame it has instead. */
  var sheets = Object.create(null);    /* clip -> { img, ready, ok, promise } */
  function load(clip) {
    var s = sheets[clip];
    if (s) return s.promise;
    var img = new Image();
    s = sheets[clip] = { img: img, ready: false, ok: false, promise: null };
    s.promise = new Promise(function (resolve) {
      function done(ok) { s.ready = true; s.ok = ok; resolve(clip); }
      img.onload = function () {
        if (!img.decode) { done(true); return; }
        img.decode().then(function () { done(true); }, function () { done(true); });
      };
      img.onerror = function () { done(false); };
      img.src = url(clip);
    });
    return s.promise;
  }
  function preload(clips) {
    var list = (clips || Object.keys(SHEETS)).filter(function (c) { return SHEETS[c]; });
    return Promise.all(list.map(load));
  }

  /* ---- the player ------------------------------------------------------- */

  function create(opts) {
    var o = opts || {};

    var el = document.createElement('div');
    el.className = 'mascot';
    el.setAttribute('aria-hidden', 'true');   /* the bird is decoration; the */
                                              /* line it says is the content */

    var raf = 0;
    var cur = null;        /* { clip, cols, rows, frames, loop, from, live, blind, t0, onEnd } */
    var shown = -1;        /* the frame index currently painted             */
    var state = null;      /* the STATES key we are holding, if any         */
    var entering = null;   /* enter()'s promise for `state`, while it holds */
    var mirrors = [];      /* elements painted with the same frame (below)  */

    /* ---- mirroring ------------------------------------------------------
       A jump on and off the board is played by two elements at once -- the
       bird itself and the hopper standing in for it behind the board (see
       .hopper in style.css) -- and the two swap at the top of the arc. The
       swap is only invisible if both are showing the SAME sprite frame on
       the frame they swap on, so rather than run a second player, the hopper
       is dressed from this one: every write this file makes to the bird's
       background is made to the mirror in the same statement.
       Deliberately not a CSS custom property: the player writes background
       straight to the element's style, and one write to two elements is both
       cheaper and impossible to get out of step. */
    function dress(t) {
      t.style.backgroundImage = el.style.backgroundImage;
      t.style.backgroundSize = el.style.backgroundSize;
      t.style.backgroundPosition = el.style.backgroundPosition;
    }
    function mirror(t) {
      if (!t || mirrors.indexOf(t) >= 0) return;
      mirrors.push(t);
      dress(t);
    }
    function unmirror(t) {
      var i = mirrors.indexOf(t);
      if (i >= 0) mirrors.splice(i, 1);
    }

    /* Paint one cell. Guarded on `shown` so a 60fps rAF only touches the DOM
       on the 20 frames a second that actually change. */
    function paint(index) {
      if (index === shown || !cur || !cur.live || cur.blind) return;
      shown = index;
      var col = index % cur.cols;
      var row = (index / cur.cols) | 0;
      var pos =
        (cur.cols > 1 ? (col * 100) / (cur.cols - 1) : 0) + '% ' +
        (cur.rows > 1 ? (row * 100) / (cur.rows - 1) : 0) + '%';
      el.style.backgroundPosition = pos;
      for (var i = 0; i < mirrors.length; i++) mirrors[i].style.backgroundPosition = pos;
    }

    function tick() {
      if (!cur) { raf = 0; return; }
      /* Still waiting on its sheet: the last frame painted stays up, and
         the clock has not started -- see play. */
      if (!cur.live) { raf = requestAnimationFrame(tick); return; }
      var elapsed = performance.now() - cur.t0;
      var n = Math.floor(elapsed / (1000 / FPS));

      if (n >= cur.frames && !cur.loop) {
        paint(cur.frames - 1);                 /* rest on the last frame */
        var done = cur.onEnd;
        cur.onEnd = null;
        raf = 0;
        if (done) done();
        return;
      }
      paint(cur.loop ? (cur.from + n) % cur.frames : Math.min(n, cur.frames - 1));
      raf = requestAnimationFrame(tick);
    }

    /* Put the clip's sheet on the bird, on its first frame, in one go --
       image, size, cell and the mirrors with it -- and start its clock. Only
       ever called once the sheet is decoded, so there is never a frame in
       which the element shows a sheet it cannot paint. A sheet that failed
       to load is never put up at all: the bird holds the frame it has. */
    function goLive(c) {
      c.live = true;
      c.t0 = performance.now();
      shown = -1;
      var s = sheets[c.clip];
      /* A sheet that never loaded: its cells, read off the sheet still
         showing, would be noise. */
      if (s && !s.ok) { c.blind = true; return; }
      el.style.backgroundImage = 'url("' + url(c.clip) + '")';
      el.style.backgroundSize = (c.cols * 100) + '% ' + (c.rows * 100) + '%';
      paint(c.loop ? c.from : 0);
      mirrors.forEach(dress);        /* the new sheet, not just the new cell */
    }

    /* Play one clip. Resolves when a one-shot reaches its last frame; a loop
       resolves as soon as it is running, because it has no end to wait for.
       vars: loop, hold (see below), from (the frame a loop is entered on). */
    function play(clip, vars) {
      var v = vars || {};
      var sheet = SHEETS[clip];
      if (!sheet) return Promise.resolve();

      /* Asked for the loop that is already playing: carry on with it. A
         restart would snap it back to its first frame -- a visible jump in
         the middle of a pose that was meant to be held. */
      if (v.loop && cur && cur.loop && cur.clip === clip) return Promise.resolve();

      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      /* A one-shot cut short by this call still has somebody awaiting it.
         Settle it now -- a promise abandoned mid-clip would hang whatever
         beat was waiting on the bird to finish speaking. */
      if (cur && cur.onEnd) { var abandoned = cur.onEnd; cur.onEnd = null; abandoned(); }

      var c = cur = {
        clip: clip,
        frames: sheet[0], cols: sheet[1], rows: sheet[2],
        loop: !!v.loop,
        from: v.loop ? ((v.from != null ? v.from : ENTRY[clip]) | 0) % sheet[0] : 0,
        live: false,
        blind: false,
        t0: 0,
        onEnd: null
      };
      /* Decoded: up at once, in this same statement. Not yet: the frame
         already on screen is held -- not blanked -- until it is, and the
         clip then starts from its own first frame. */
      var s = sheets[clip];
      if (s && s.ready) goLive(c);
      else load(clip).then(function () { if (cur === c && !c.live) goLive(c); });

      if (v.loop) {
        raf = requestAnimationFrame(tick);
        return Promise.resolve();
      }
      return new Promise(function (resolve) {
        cur.onEnd = resolve;
        raf = requestAnimationFrame(tick);
      }).then(function () {
        /* A one-shot that nothing follows would freeze on its last frame,
           and a frozen character reads as a crash. Fall back to the idle. */
        if (v.hold !== true && cur === c) idle();
      });
    }

    /* Enter a state: its start clip once, then its loop held open.
       Asked for the state it is already in -- on its way in, or holding its
       loop -- it carries on: played again, the start clip would snap the
       bird back to the top of it in the middle of a line. */
    function enter(name) {
      var s = STATES[name];
      if (!s) return Promise.resolve();
      if (state === name && entering) return entering;
      state = name;
      var run = s.start ? play(s.start, { hold: true }) : Promise.resolve();
      var mine = entering = run.then(function () {
        if (entering !== mine) return;         /* something else took over */
        return play(s.loop, { loop: true });
      });
      return mine;
    }

    /* Leave the state we are in -- its stop clip once -- and settle back into
       the idle. Called with nothing held, this is just the idle.
       The idle follows only a stop clip that played OUT: one cut short by
       the next line has handed the bird on already, and an idle forced in
       behind it would cut that line's own entrance off. */
    function settle() {
      var s = STATES[state];
      state = null;
      entering = null;
      if (!s || !s.stop) return idle();
      var run = play(s.stop, { hold: true });
      var c = cur;
      return run.then(function () { if (cur === c) return idle(); });
    }

    /* Idempotent: the idle already playing is left to play on. */
    function idle() {
      state = 'idle';
      entering = null;
      return play('blinking', { loop: true });
    }

    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (cur && cur.onEnd) { var abandoned = cur.onEnd; cur.onEnd = null; abandoned(); }
      cur = null;
      state = null;
      entering = null;
    }

    /* ---- placing the bird ----------------------------------------------
       One bird for the whole lesson, re-parented between slots. Flip measures
       where it was and where it now is and plays the difference, so welcome
       screen -> its mark on the field -> board header reads as one
       continuous character rather than three that appear and disappear. */
    function moveTo(slot, vars) {
      if (!slot || el.parentNode === slot) {
        if (slot && el.parentNode !== slot) slot.appendChild(el);
        return null;
      }
      if (!el.parentNode || !global.Motion) {
        slot.appendChild(el);
        return null;
      }
      return global.Motion.relayout(el, function () {
        slot.appendChild(el);
      }, vars || { vars: { duration: 0.55, ease: 'power2.inOut' } });
    }

    /* Put the bird somewhere with no move at all -- used when the board has
       just covered it and the jump must not be seen. */
    function placeIn(slot) {
      if (slot) slot.appendChild(el);
    }

    if (o.slot) placeIn(o.slot);
    if (o.idle !== false) idle();

    return {
      el: el,
      play: play,
      state: enter,
      settle: settle,
      idle: idle,
      stop: stop,
      moveTo: moveTo,
      placeIn: placeIn,
      mirror: mirror,
      unmirror: unmirror,
      current: function () { return state; }
    };
  }

  global.Mascot = {
    FPS: FPS,
    SHEETS: SHEETS,
    STATES: STATES,
    url: url,
    preload: preload,
    create: create
  };
})(window);
