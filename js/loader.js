/* ==========================================================================
 * loader.js -- the loading line on the welcome screen, where Start will be
 * --------------------------------------------------------------------------
 * Everything the lesson will show or play is fetched before Start is
 * offered: the artwork, the bird's sprite sheets, the fonts, the chimes and
 * every voice clip. A line that has to wait for its clip is heard late
 * against its words, so nothing is left to be fetched mid-lesson.
 *
 * A file that is missing or never answers does not hold the lesson hostage:
 * it is given up on after TASK_DEADLINE, counted as done, and named in the
 * console. The lesson runs without it, as it always has.
 *
 *   Loader.run(tasks)  tasks: [{ weight, run() -> Promise<bool>, queued }]
 *                      `queued` tasks share PARALLEL slots (the clips);
 *                      the rest all start at once.
 *   Loader.ready()     resolves once everything has settled and the line
 *                      has left -- the welcome scene shows Start then.
 *
 * Load order: after js/i18n.js and js/audio.js, before js/script.js
 * ========================================================================== */
var Loader = (function (global) {
  'use strict';

  var PARALLEL = 8;             /* clips in flight at once                    */
  var TASK_DEADLINE = 30000;    /* ms: a file that never answers is let go     */
  var HOLD_FULL = 280;          /* ms the full line is seen before it leaves   */
  var LEAVE_MS = 260;           /* = .loader.is-done's transition in style.css */

  var box = null, fill = null, pct = null;
  var total = 0, got = 0, shown = -1;
  var missing = [];
  var finished = null;
  var finish = null;

  function reducedMotion() {
    try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  /* The fill is slid, not resized (transform only); the CSS transition
     eases each step so a burst of small files reads as one smooth run. */
  function paint() {
    var p = total ? Math.min(1, got / total) : 1;
    var n = Math.floor(p * 100);
    if (fill) fill.style.transform = 'translateX(' + ((p - 1) * 100).toFixed(2) + '%)';
    if (n === shown) return;
    shown = n;
    if (pct) pct.textContent = global.T ? global.T('loadPercent', { n: n }) : n + '%';
    if (box) box.setAttribute('aria-valuenow', String(n));
  }

  function timeout(ms) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(false); }, ms); });
  }
  /* one task, settled: true loaded, false missing or too slow */
  function settle(task) {
    var p;
    try { p = Promise.resolve(task.run()); } catch (e) { p = Promise.resolve(false); }
    return Promise.race([
      p.then(function (ok) { return ok !== false; }, function () { return false; }),
      timeout(TASK_DEADLINE)
    ]).then(function (ok) {
      if (!ok) missing.push(task.name || '?');
      got += task.weight || 1;
      paint();
    });
  }

  /* The queued tasks run PARALLEL at a time, in order: the clips of the
     first skill land first. */
  function drain(queue) {
    var next = 0;
    function worker() {
      if (next >= queue.length) return Promise.resolve();
      return settle(queue[next++]).then(worker);
    }
    var workers = [];
    for (var i = 0; i < Math.min(PARALLEL, queue.length); i++) workers.push(worker());
    return Promise.all(workers);
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* The line full, held a moment, and away; Start takes its place. */
  function leave() {
    var calm = reducedMotion();
    return wait(calm ? 0 : HOLD_FULL).then(function () {
      if (box) box.classList.add('is-done');
      return wait(calm ? 0 : LEAVE_MS);
    }).then(function () {
      if (box) box.setAttribute('hidden', '');
    });
  }

  function run(tasks) {
    if (finished) return finished;
    finished = new Promise(function (resolve) { finish = resolve; });
    box = document.getElementById('loader');
    fill = document.getElementById('loaderFill');
    pct = document.getElementById('loaderPct');

    tasks = tasks || [];
    total = tasks.reduce(function (s, t) { return s + (t.weight || 1); }, 0);
    paint();

    var now = tasks.filter(function (t) { return !t.queued; }).map(settle);
    now.push(drain(tasks.filter(function (t) { return t.queued; })));

    Promise.all(now).then(function () {
      got = total;
      paint();
      if (missing.length && global.console) {
        console.warn('[loader] could not load ' + missing.length + ' file(s); the lesson runs without them:', missing);
      }
      return leave();
    }).then(function () { finish(); });
    return finished;
  }

  function ready() {
    return finished || Promise.resolve();
  }

  return { run: run, ready: ready };
})(window);
