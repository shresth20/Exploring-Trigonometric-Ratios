/* ==========================================================================
 * script.js -- entry point
 * --------------------------------------------------------------------------
 * Builds the scene, fetches everything the lesson will show or play behind
 * the welcome screen's loading bar (js/loader.js), and starts the lesson.
 * Nothing here decides what happens: that is pages.js and the sections.
 * ========================================================================== */
(function (global) {
  'use strict';

  var kept = [];
  function imageReady(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      kept.push(img);
      function done() { resolve(true); }
      img.onload = function () {
        if (img.decode) img.decode().then(done, done); else done();
      };
      img.onerror = function () { resolve(false); };
      img.src = src;
    });
  }

  function boot() {
    if (!global.Motion || !global.Flow || !global.Typer ||
        !global.Mascot || !global.Beats || !global.Pages) {
      console.error('script.js: a module did not load. Check the <script> ' +
                    'order in index.html.');
      return;
    }

    global.Pages.init();

    var tasks = [];
    function add(name, weight, run, queued) {
      tasks.push({ name: name, weight: weight, run: run, queued: !!queued });
    }
    /* The artwork, decoded as well as fetched. */
    ['assets/images/welcome.png', 'assets/images/background.png',
     'assets/images/board.png'].forEach(function (src) {
      add(src, 3, function () { return imageReady(src); });
    });
    Object.keys(global.Mascot.SHEETS).forEach(function (clip) {
      add('sheet ' + clip, 8, function () { return global.Mascot.preload([clip]); });
    });
    if (document.fonts && document.fonts.forEach) {
      document.fonts.forEach(function (face) {
        add('font ' + face.family + ' ' + face.weight, 2, function () {
          return face.load().then(function () { return true; }, function () { return false; });
        });
      });
    }
    var A = global.GameAudio;
    var sounds = (global.Beats.sounds ? global.Beats.sounds() : [])
      .concat(global.I18n && global.I18n.clips ? global.I18n.clips() : []);
    if (A) sounds.forEach(function (url) {
      add(url, 1, function () { return A.load(url); }, true);
    });

    if (global.Loader) global.Loader.run(tasks);
    else Promise.all(tasks.map(function (t) { return t.run(); }));

    if (!global.Pages.started()) global.Pages.run();

    global.replay = function () { return global.Pages.run(); };
    global.skip = function () { return global.Flow.skip(); };
  }

  function start() {
    if (!global.I18n) { boot(); return; }
    global.I18n.load(function () {
      global.I18n.applyStatic();
      boot();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
