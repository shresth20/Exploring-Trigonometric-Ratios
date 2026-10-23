/* ==========================================================================
 * audio.js -- every sound the game makes: the voice-over and the chimes
 * --------------------------------------------------------------------------
 * Played through ONE AudioContext from clips fetched before Start is shown
 * (see js/loader.js), not through an <audio> element per clip.
 *
 * Why: an <audio> element is a whole media player. It starts late -- on
 * Windows the first syllable could be heard a beat after its words were
 * typed, or lost -- because each play() has to wake the player (Chrome
 * suspends an idle one after a few seconds) and reopen the sound card
 * (Windows closes an idle output). With ~400 clips that is ~400 players,
 * more than some browsers will even make. A decoded clip on a context that
 * is already running starts on the next audio block, a few ms.
 *
 * Memory: a clip is kept as its Opus bytes (~15MB for every clip) and
 * decoded when it is first played (~3ms a clip). Decoded sound is ~200KB a
 * second, so only the most recently played clips stay decoded, up to
 * DECODED_BUDGET; the chimes are kept for good.
 *
 * Where the bytes cannot be read -- a page opened from file://, where
 * fetch() is refused, or a browser that cannot decode WebM/Opus -- the
 * clips are played through <audio> elements as before, a few dozen kept
 * at a time, and the context is still kept running so the sound card does
 * not fall asleep between lines.
 *
 *   GameAudio.load(url)            -> Promise<bool>: the clip is here
 *   GameAudio.play(url, {volume, rate, keep})
 *                                   -> { done: Promise<bool>, stop() }
 *                                      done: true when it ran to its end,
 *                                      false when it could not play or
 *                                      was stopped
 *   GameAudio.warm(url)            -> decode ahead of time
 *
 * Load order: before js/i18n.js and js/animations.js
 * ========================================================================== */
var GameAudio = (function (global) {
  'use strict';

  var AC = global.AudioContext || global.webkitAudioContext;
  var FETCH_TRIES = 2;
  var DECODED_BUDGET = 48 * 1024 * 1024;    /* bytes of decoded sound kept   */
  var MAX_ELEMENTS = 48;                    /* <audio> elements kept (file:) */
  var RESUME_WAIT = 600;                    /* ms a play waits for the context */
  var READY_WAIT = 15000;                   /* ms an <audio> load may take   */

  var local = false;
  try { local = global.location.protocol === 'file:'; } catch (e) {}
  /* Bytes, decoded by the context: the way every clip is played, unless
     this turns out to be impossible (see probe). */
  var byBuffer = !!AC && !local && typeof global.fetch === 'function';

  /* ---- the context ------------------------------------------------------ */
  /* Made by the first tap (see wake): a context made before one starts
     suspended, and the browser warns about it in the console. */
  var ctx = null;
  var out = null;
  function context() {
    if (ctx || !AC) return ctx;
    try { ctx = new AC({ latencyHint: 'interactive' }); }
    catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } }
    if (ctx) {
      out = ctx.createGain();
      out.connect(ctx.destination);
    }
    return ctx;
  }
  /* What decodes the clips loaded before that tap: an offline context needs
     no tap, and its sound plays on the live one all the same. 48 kHz is the
     rate Opus is recorded at. */
  var decoder = null;
  function decodingContext() {
    if (ctx) return ctx;
    if (!decoder) {
      var OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
      try { decoder = OAC ? new OAC(1, 1, 48000) : null; } catch (e) { decoder = null; }
    }
    return decoder || context();
  }

  /* A browser only lets sound start from a tap or a key, so the context is
     woken by every one of them -- not just the first: a phone call or a
     backgrounded tab can put it back to sleep. Capture phase, so it is
     running before the tap's own handler asks for a sound. */
  function wake(ev) {
    /* a click the game dispatches itself is no tap, and the browser
       would refuse it */
    if (ev && ev.isTrusted === false) return;
    var c = context();
    if (!c || c.state === 'running' || c.state === 'closed') return;
    try { c.resume(); } catch (e) {}
    /* Safari only unlocks on a sound actually started inside the gesture */
    try {
      var s = c.createBufferSource();
      s.buffer = c.createBuffer(1, 1, c.sampleRate);
      s.connect(c.destination);
      s.start(0);
    } catch (e) {}
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(function (type) {
    global.addEventListener(type, wake, true);
  });
  /* iOS: through the media channel, so the ring/silent switch does not
     mute the lesson the way it mutes a ringtone */
  try {
    if (global.navigator.audioSession) global.navigator.audioSession.type = 'playback';
  } catch (e) {}

  /* Resolves true once the context is running, false if it is not allowed
     to (no tap yet) within RESUME_WAIT. */
  function running() {
    /* No tap yet: the browser would refuse, and say so in the console. */
    var ua = global.navigator.userActivation;
    if (!ctx && ua && !ua.hasBeenActive) return Promise.resolve(false);
    var c = context();
    if (!c) return Promise.resolve(false);
    if (c.state === 'running') return Promise.resolve(true);
    return new Promise(function (resolve) {
      var t = setTimeout(function () { resolve(c.state === 'running'); }, RESUME_WAIT);
      var done = function () { clearTimeout(t); resolve(c.state === 'running'); };
      try { c.resume().then(done, done); } catch (e) { done(); }
    });
  }

  /* ---- bytes ------------------------------------------------------------ */
  var bytes = Object.create(null);          /* url -> ArrayBuffer (encoded)  */
  var fetching = Object.create(null);       /* url -> Promise<bool>          */

  function fetchBytes(url, tries) {
    return global.fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return r.arrayBuffer();
    }).then(function (b) {
      if (!b || !b.byteLength) throw new Error('empty ' + url);
      bytes[url] = b;
      return true;
    }).catch(function () {
      return tries > 1 ? fetchBytes(url, tries - 1) : false;
    });
  }

  /* ---- decoded sound, most recently played first ------------------------ */
  var decoded = new Map();                  /* url -> AudioBuffer (LRU)      */
  var kept = Object.create(null);           /* url -> true: never let go     */
  var decodedSize = 0;
  var decoding = Object.create(null);       /* url -> Promise<AudioBuffer>   */

  function sizeOf(buf) { return buf.length * buf.numberOfChannels * 4; }
  function remember(url, buf) {
    decoded.set(url, buf);
    decodedSize += sizeOf(buf);
    var it = decoded.keys();
    while (decodedSize > DECODED_BUDGET && decoded.size > 1) {
      var old = it.next();
      if (old.done) break;
      if (kept[old.value] || old.value === url) continue;
      decodedSize -= sizeOf(decoded.get(old.value));
      decoded.delete(old.value);
    }
  }
  function decodeBytes(b) {
    var c = decodingContext();
    if (!c) return Promise.reject(new Error('no audio'));
    return new Promise(function (resolve, reject) {
      /* the callback form as well: older Safari has no promise here */
      var p = c.decodeAudioData(b, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }
  /* The clip as sound, or null when it cannot be had. Its bytes are kept
     encoded: decodeAudioData takes the buffer it is given away, so it is
     handed a copy. */
  function decode(url) {
    var hit = decoded.get(url);
    if (hit) {
      decoded.delete(url);                  /* to the fresh end of the LRU   */
      decoded.set(url, hit);
      return Promise.resolve(hit);
    }
    if (decoding[url]) return decoding[url];
    var got = bytes[url] ? Promise.resolve(true) : load(url);
    var p = decoding[url] = got.then(function (ok) {
      if (!ok || !bytes[url]) return null;
      return decodeBytes(bytes[url].slice(0)).then(function (buf) {
        remember(url, buf);
        return buf;
      }, function () { return null; });
    }).then(function (buf) {
      delete decoding[url];
      return buf;
    });
    return p;
  }

  /* One clip decoded before anything else, to learn whether this browser
     can decode WebM/Opus at all; if not, every clip goes by <audio>. */
  var probed = null;
  function probe(url) {
    if (!probed) {
      probed = decode(url).then(function (buf) {
        if (!buf) byBuffer = false;
        return byBuffer;
      });
    }
    return probed;
  }

  /* ---- <audio> elements (file://, or no Web Audio) ----------------------- */
  /* Kept most recently played last, and never more than MAX_ELEMENTS: each
     one is a media player, and a phone will not make more than a few dozen. */
  var elements = new Map();                 /* url -> HTMLAudioElement (LRU) */
  function release(a) {
    try { a.removeAttribute('src'); a.load(); } catch (e) {}
  }
  function keepElement(url, a) {
    elements.set(url, a);
    var it = elements.keys();
    while (elements.size > MAX_ELEMENTS) {
      var old = it.next();
      if (old.done) break;
      var el = elements.get(old.value);
      if (old.value === url || !el.paused) continue;
      elements.delete(old.value);
      release(el);
    }
  }
  function element(url) {
    var a = elements.get(url);
    if (a) { elements.delete(url); elements.set(url, a); return a; }
    a = new global.Audio();
    a.preload = 'auto';
    a.src = url;
    keepElement(url, a);
    return a;
  }
  /* true once a player could play the clip through; false on an error. A
     slow disk is not a broken clip, so a wait that runs out counts as
     loaded. The player is kept while there is room, for the first lines. */
  function elementReady(url) {
    return new Promise(function (resolve) {
      var a = new global.Audio();
      var t = setTimeout(function () { finish(!a.error); }, READY_WAIT);
      function finish(ok) {
        clearTimeout(t);
        a.removeEventListener('canplaythrough', yes);
        a.removeEventListener('error', no);
        if (ok && !elements.has(url) && elements.size < MAX_ELEMENTS) keepElement(url, a);
        else release(a);
        resolve(ok);
      }
      function yes() { finish(true); }
      function no() { finish(false); }
      a.addEventListener('canplaythrough', yes);
      a.addEventListener('error', no);
      a.preload = 'auto';
      a.src = url;
    });
  }

  /* ---- loading ---------------------------------------------------------- */
  /* load(url): the clip fetched (or, without fetch, readied by an element).
     Resolves true when it is here and playable, false when it is missing. */
  function load(url) {
    if (!url) return Promise.resolve(false);
    if (bytes[url]) return Promise.resolve(true);
    if (fetching[url]) return fetching[url];
    var p = fetching[url] = (byBuffer ? fetchBytes(url, FETCH_TRIES) : elementReady(url))
      .then(function (ok) {
        delete fetching[url];
        /* the first clip in also tells whether this browser decodes them */
        if (ok && byBuffer && !probed) return probe(url).then(function () { return ok; });
        return ok;
      });
    return p;
  }
  function warm(url) {
    if (url && byBuffer) decode(url);
  }

  /* ---- playing ---------------------------------------------------------- */
  function silent() {
    return { done: Promise.resolve(false), stop: function () {} };
  }

  function playBuffer(url, o) {
    var source = null, gain = null, cut = false, resolveDone;
    var done = new Promise(function (r) { resolveDone = r; });
    var settled = false;
    function settle(ok) {
      if (settled) return;
      settled = true;
      if (source) { source.onended = null; try { source.disconnect(); } catch (e) {} }
      if (gain) { try { gain.disconnect(); } catch (e) {} }
      resolveDone(ok);
    }
    Promise.all([decode(url), running()]).then(function (r) {
      var buf = r[0], live = r[1];
      if (cut) return;
      if (!buf && !bytes[url]) return settle(false);   /* missing: silence */
      if (!buf) {
        /* here but would not decode: let a player try this one clip */
        var h = playElement(url, o);
        handle.stop = function () { cut = true; h.stop(); };
        return h.done.then(settle);
      }
      if (!live) return settle(false);
      var c = context();
      source = c.createBufferSource();
      source.buffer = buf;
      if (o.rate) source.playbackRate.value = o.rate;
      gain = c.createGain();
      gain.gain.value = o.volume != null ? o.volume : 1;
      source.connect(gain);
      gain.connect(out);
      source.onended = function () { settle(!cut); };
      source.start(0);
    });
    var handle = {
      done: done,
      stop: function () {
        if (cut) return;
        cut = true;
        if (source) { try { source.stop(0); } catch (e) {} }
        settle(false);
      }
    };
    return handle;
  }

  function playElement(url, o) {
    var a = element(url);
    var settled = false, resolveDone;
    var done = new Promise(function (r) { resolveDone = r; });
    function settle(ok) {
      if (settled) return;
      settled = true;
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
      resolveDone(ok);
    }
    function onEnd() { settle(true); }
    function onErr() { settle(false); }
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    try {
      a.volume = o.volume != null ? o.volume : 1;
      a.playbackRate = o.rate || 1;
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () { settle(false); });
    } catch (e) { settle(false); }
    return {
      done: done,
      stop: function () {
        if (settled) return;
        try { a.pause(); a.currentTime = 0; } catch (e) {}
        settle(false);
      }
    };
  }

  /* play(url, opts): one sound, from its start. Sounds may overlap; the
     caller stops the one it is replacing. opts.keep: never let its decoded
     copy go (the chimes, played over and over). */
  function play(url, opts) {
    var o = opts || {};
    if (!url) return silent();
    if (o.keep) kept[url] = true;
    return byBuffer ? playBuffer(url, o) : playElement(url, o);
  }

  /* has(url): whether the clip is here to be played -- fetched, or readied
     by an element. False for a clip that is not recorded yet. */
  function has(url) {
    return !!url && (!!bytes[url] || elements.has(url));
  }

  return {
    load: load,
    play: play,
    warm: warm,
    has: has,
    /* how the clips are being played: 'buffer' or 'element' */
    mode: function () { return byBuffer ? 'buffer' : 'element'; },
    context: context
  };
})(window);
