/* ==========================================================================
 * scenery.js -- the sky over the swamp, and the mist on it, kept alive
 * --------------------------------------------------------------------------
 * The clouds painted into background.png are cut out into images of their
 * own (assets/new/scenery/cloud-*.png) over a sky with them taken out
 * (sky.png), and drift from where they were painted, left to right, very
 * slowly. A cloud that leaves the artwork's right edge comes back in at its
 * left, so the sky never empties.
 *
 * The two banks of mist sway to and fro about where they lie instead, the
 * near one against the far, each thinning and thickening a little as it
 * goes: mist that drifted right off would show its soft ends.
 *
 * The water's ripples flow slowly right, the way the clouds go: the near
 * water's faster than the far's, as near water passes the eye faster, so
 * the two drift through each other and the light on the water shifts.
 *
 * Read off a clock, as the text reveal and the bird are: how far anything
 * has moved is what the time elapsed says, so a slow frame never slows the
 * sky. Moved by transform only, in percentages of each piece's own width:
 * a piece is sized and placed in percentages too, so the motion holds its
 * shape at any window size with nothing re-measured.
 *
 * Reduced motion holds the sky where it is, and is read every frame, so
 * turning it on or off mid-lesson takes effect at once.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* How fast the sky moves: a fraction of the artwork's width per second.
     1/600 is ten minutes to cross the whole sky -- slow enough that the
     clouds are noticed having moved rather than seen moving. */
  var SPEED = 1 / 600;
  /* Each cloud's own pace, in page order, so they drift past one another
     rather than as one sheet. */
  var PACE = [1, 0.8, 0.9, 1.15];
  /* Each bank of mist, in page order (far, near): how far it sways, in
     percent of its own width, either way; how long one sway takes, in
     seconds; and how much its opacity rises and falls, as a fraction of
     what the stylesheet gives it, over a period of its own. Opposite
     directions and unrelated periods, so the two never move as one. */
  var MIST = [
    { sway: 3,    period: 74, breathe: 0.15, every: 27 },
    { sway: -4.5, period: 57, breathe: 0.2,  every: 19 }
  ];
  /* Each strip of ripples, in page order (far, near): how fast it flows,
     in strips -- the artwork's width -- per second; and how much it dims
     at most, over a period of its own in seconds, so the light on the
     water glints rather than only slides. */
  var WATER = [
    { speed: 1 / 400, dim: 0.12, every: 11 },
    { speed: 1 / 160, dim: 0.1,  every: 7 }
  ];
  /* ms: a gap between frames longer than this -- a hidden tab, a stall --
     counts as this long, so the sky carries on from where it was. */
  var MAX_STEP = 100;

  function start() {
    var art = document.querySelector('.scenery__art');
    if (!art) return;
    var aw = art.offsetWidth || 1;

    /* Where each cloud was painted, as fractions of the artwork's width. */
    var clouds = Array.prototype.map.call(art.querySelectorAll('.cloud'), function (el, i) {
      return {
        el: el,
        pace: PACE[i % PACE.length],
        x: el.offsetLeft / aw,
        w: el.offsetWidth / aw || 0.1
      };
    });

    var mists = Array.prototype.map.call(document.querySelectorAll('.scenery .mist'), function (el, i) {
      var m = MIST[i % MIST.length];
      return {
        el: el,
        sway: m.sway,
        period: m.period,
        breathe: m.breathe,
        every: m.every,
        opacity: parseFloat(getComputedStyle(el).opacity) || 1
      };
    });

    var waters = Array.prototype.map.call(art.querySelectorAll('.water'), function (el, i) {
      var w = WATER[i % WATER.length];
      return { el: el, speed: w.speed, dim: w.dim, every: w.every };
    });

    var travel = 0;
    var clock = 0;
    var last = 0;
    var still = null;

    function frame(now) {
      var dt = last ? Math.min(now - last, MAX_STEP) : 0;
      last = now;

      var hold = !!(global.Motion && global.Motion.reducedMotion());
      if (hold !== still) {
        still = hold;
        clouds.forEach(function (c) { c.el.style.willChange = hold ? '' : 'transform'; });
        mists.concat(waters).forEach(function (m) {
          m.el.style.willChange = hold ? '' : 'transform, opacity';
        });
      }

      if (!hold) {
        clock += dt / 1000;
        travel += (dt / 1000) * SPEED;
        clouds.forEach(function (c) {
          /* The left edge runs from fully off the left (-w) to fully off
             the right (1), then round again. */
          var span = 1 + c.w;
          var left = ((c.x + c.w + travel * c.pace) % span) - c.w;
          c.el.style.transform =
            'translate3d(' + ((left - c.x) / c.w * 100).toFixed(3) + '%,0,0)';
        });
        mists.forEach(function (m) {
          var x = m.sway * Math.sin(clock / m.period * 2 * Math.PI);
          var o = m.opacity * (1 + m.breathe * Math.sin(clock / m.every * 2 * Math.PI));
          m.el.style.transform = 'translate3d(' + x.toFixed(3) + '%,0,0)';
          m.el.style.opacity = o.toFixed(3);
        });
        waters.forEach(function (w) {
          /* A strip is half the element, so a strip's width is 50%; at
             50% the next strip lies where this one started. */
          var x = ((clock * w.speed) % 1) * 50;
          var o = 1 - w.dim * (1 - Math.cos(clock / w.every * 2 * Math.PI)) / 2;
          w.el.style.transform = 'translate3d(' + x.toFixed(3) + '%,0,0)';
          w.el.style.opacity = o.toFixed(3);
        });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
