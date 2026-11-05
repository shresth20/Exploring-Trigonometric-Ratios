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
        !global.Tank || !global.Beats || !global.Pages) {
      console.error('script.js: a module did not load. Check the <script> ' +
                    'order in index.html.');
      return;
    }

    global.Pages.init();

    var tasks = [];
    function add(name, weight, run, queued) {
      tasks.push({ name: name, weight: weight, run: run, queued: !!queued });
    }
    /* The artwork, decoded as well as fetched: the welcome's painting and
       its play key, the Next key, the swamp, its clouds, trees and mist,
       the commander, her tank and its causeway (index.html), and the plates
       the words are set on (the same files css/style.css names). */
    ['assets/images/welcome.webp', 'assets/images/play-btn.webp',
     'assets/images/next-btn.webp',
     'assets/new/scenery/sky.webp', 'assets/new/scenery/cloud-1.webp',
     'assets/new/scenery/cloud-2.webp', 'assets/new/scenery/cloud-3.webp',
     'assets/new/scenery/cloud-4.webp', 'assets/new/scenery/tree-big-a.webp',
     'assets/new/scenery/tree-big-b.webp', 'assets/new/scenery/fog-a.webp',
     'assets/new/scenery/fog-b.webp', 'assets/new/scenery/water-far.webp',
     'assets/new/scenery/water-near.webp', 'assets/new/header2.webp',
     'assets/new/box1.webp', 'assets/new/box2.webp',
     'assets/new/tank/parts/road.webp', 'assets/new/tank/parts/road-fill.webp',
     'assets/new/tank/parts/hull.webp',
     'assets/new/tank/parts/barrel.webp', 'assets/new/tank/parts/dome.webp',
     'assets/new/tank/parts/wheel.webp', 'assets/new/tank/commander.webp',
     'assets/new/tank/commander_face.webp', 'assets/new/tank/parts/lips.webp',
     'assets/new/tank/parts/mouth-patch.webp'].forEach(function (src) {
      add(src, 3, function () { return imageReady(src); });
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
