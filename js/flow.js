/* ==========================================================================
 * flow.js -- the scene clock
 * --------------------------------------------------------------------------
 * A scene here is one long `await` chain: say a line, wait a beat, draw a
 * shape, wait for a tap. That reads well, but it needs an answer to one
 * question -- what happens to the rest of the chain when the scene is
 * abandoned half way through?
 *
 * Every wait in the game is taken out through this file and stamped with the
 * scene token that was current when it was asked for. Flow.reset() bumps the
 * token and REJECTS every wait still outstanding, which unwinds the whole
 * chain in one go: no orphaned line ever writes into a box the next scene now
 * owns, and no timeout fires into a torn-down board.
 *
 * Skip is the other half of the same idea and the opposite answer: the waits
 * RESOLVE, immediately, and everything already in the air is jumped to its
 * end by Motion.skip(). The chain then plays itself out in a handful of
 * frames and lands in exactly the state it would have reached anyway -- with
 * no special case anywhere in the scenes themselves.
 *
 * Load order: libs/gsap.min.js -> js/motion.js -> js/flow.js
 * ========================================================================== */
(function (global) {
  'use strict';

  /* The rejection a cancelled scene unwinds with. An object rather than an
     Error: this is control flow, not a fault, and it must never end up in a
     console with a stack trace attached. */
  var CANCELLED = { cancelled: true, toString: function () { return 'Flow: cancelled'; } };

  var token = 0;
  var fast = false;

  /* Everything currently waiting on this file, whatever it is waiting for.
     Entries drop out as they settle, so the set stays the size of what is
     genuinely outstanding -- one or two, almost always. */
  var pending = new Set();

  function settle(entry, how) {
    if (!pending.has(entry)) return;
    pending.delete(entry);
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = 0; }
    if (how === 'cancel') entry.reject(CANCELLED);
    else entry.resolve();
  }

  /* ---- waiting ---------------------------------------------------------- */

  /* The pacing primitive. Resolves after ms, rejects with CANCELLED if the
     scene is retired first, and resolves at once while Skip is on. */
  function wait(ms) {
    if (fast || !(ms > 0)) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var entry = { resolve: resolve, reject: reject, timer: 0 };
      entry.timer = setTimeout(function () { settle(entry, 'done'); }, ms);
      pending.add(entry);
    });
  }

  /* The same contract, for a GSAP animation rather than a stretch of time.
     A GSAP animation is thenable, so this could be a bare await -- but a
     bare await on a killed animation is a promise that never settles, and
     the scene behind it would hang forever. */
  function anim(a) {
    if (!a) return Promise.resolve();
    if (fast) {
      /* Land it HERE, in this statement, rather than leaving it to render a
         frame later. The chain is already moving on -- that is what a skip
         is -- and a tween that writes its end state a tick after the beat
         that tidied up behind it leaves that write standing: a group faded
         out by a wipe, cleared, and then faded out again by the tween that
         had not run yet, which is a piece of the picture gone for good.
           Endless animations have no end to jump one to; they are left to
         the scene that owns them. */
      if (!a.__motionEndless && a.totalProgress && a.totalProgress() < 1) {
        a.totalProgress(1, false);
      }
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var entry = { resolve: resolve, reject: reject, timer: 0 };
      pending.add(entry);
      var done = function () { settle(entry, 'done'); };
      Promise.resolve(a).then(done, done);
    });
  }

  /* One frame, then the next. The reliable way to let the browser apply a
     style write before the following one reads it back. */
  function frame() {
    return new Promise(function (resolve) {
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(resolve);
      });
    });
  }

  /* ---- waiting on a person ---------------------------------------------- */

  /* Resolves the first time `el` is activated -- pointer or keyboard -- and
     rejects with the rest of the chain if the scene is retired while it is
     still waiting. The listeners come off whichever way it ends, so a control
     left on screen from a previous scene can never fire into this one. */
  function once(el, opts) {
    var o = opts || {};
    if (!el) return Promise.resolve(null);
    /* A skip is in flight, and there are two kinds of wait it can meet.
         One the caller can honestly answer FOR the learner -- a dot whose
       only possible answer is "tapped", a question whose right answer the
       caller knows. Those pass `auto`: the wait is taken as answered and the
       caller fills in what the person would have done, so the chain runs on
       with the board in the state the beats after it describe.
         The other is a thing only a person can do: the hand-over at the end
       of a scene, and an activity with something to place. There the skip
       ENDS -- fast off, full speed again -- and the beat is put in front of
       the learner properly. That is what makes Skip stop ON the Next button
       instead of running through it. */
    if (fast) {
      if (o.auto) return Promise.resolve(null);
      resume();
    }
    return new Promise(function (resolve, reject) {
      var entry = {
        timer: 0,
        resolve: function () { off(); resolve(entry.detail || null); },
        reject: function (e) { off(); reject(e); }
      };
      pending.add(entry);

      function fire(ev) {
        entry.detail = ev;
        if (o.before) o.before(ev);
        settle(entry, 'done');
      }
      function onKey(ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
        ev.preventDefault();
        fire(ev);
      }
      function off() {
        el.removeEventListener('click', fire);
        el.removeEventListener('keydown', onKey);
      }
      el.addEventListener('click', fire);
      el.addEventListener('keydown', onKey);
    });
  }

  /* ---- lifecycle -------------------------------------------------------- */

  /* Start a scene. Anything the previous one still had in the air -- waits,
     tweens, listeners -- is cancelled and handed back first. */
  function reset() {
    token++;
    fast = false;
    Array.from(pending).forEach(function (entry) { settle(entry, 'cancel'); });
    pending.clear();
    if (global.Motion) global.Motion.retire();
    return token;
  }

  /* Run a scene to the end. A cancellation unwinds quietly -- that is what it
     is for -- and anything else is a real fault and is re-thrown. */
  function run(scene) {
    reset();
    var mine = token;
    return Promise.resolve()
      .then(scene)
      .catch(function (err) {
        if (err === CANCELLED) return;
        throw err;
      })
      .then(function () { return mine === token; });
  }

  /* Fast-forward: every outstanding wait resolves now, everything moving
     lands on its last frame, and every duration asked for from here on is
     built at Motion's NEAR_ZERO. */
  function skip() {
    if (fast) return;
    fast = true;
    Array.from(pending).forEach(function (entry) { settle(entry, 'done'); });
    if (global.Motion) global.Motion.skip();
  }
  function resume() { fast = false; }

  /* A guard a long-running effect can poll instead of awaiting: true for as
     long as the scene that asked for it is still the current one. */
  function alive() {
    var mine = token;
    return function () { return mine === token; };
  }

  global.Flow = {
    CANCELLED: CANCELLED,
    wait: wait,
    anim: anim,
    frame: frame,
    once: once,
    reset: reset,
    run: run,
    skip: skip,
    resume: resume,
    alive: alive,
    isFast: function () { return fast; },
    token: function () { return token; }
  };

  /* motion.js scales every duration it is asked for through these two. */
  if (global.Motion) {
    global.Motion.bind({
      token: function () { return token; },
      fast: function () { return fast; }
    });
  }
})(window);
