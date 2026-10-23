/* i18n.js -- every word and clip by KEY, from one locale:
 *   locales/locales.json   (clips in assets/VO/en)
 *   T('p01Hey')                    -> "Hey there!"
 *   T('s2SinIs', { v: '1⁄√2' })    -> "sin 45° = 1⁄√2"
 *   T('p20Work.0')                 -> first item of an array key
 *   I18n.voice('p01Hey')           -> "assets/VO/en/p01Hey.webm?v=1"
 *   I18n.say('p01Hey')             -> plays it (js/audio.js); resolves true/false
 *   I18n.clips()                   -> every clip's url, for js/loader.js
 *   I18n.cues('p01Hey')            -> [ms, ...]: when each word of the line
 *                                     is heard, from the clip's start
 *   I18n.applyStatic()             -> fills data-i18n / data-i18n-html /
 *                                     data-i18n-attr="title:key" in HTML
 * Language: ?lan=xx on the URL, else defaultLanguage. A language without
 * recordings speaks the default language's clips. English only for now.
 * Served over http the JSON is fetched; from file:// it reads
 * locales/locales.js instead. Regenerate it after editing the JSON:
 *   (printf 'window.GAME_LOCALES='; cat locales/locales.json; echo ';') > locales/locales.js
 */
var I18n = (function () {
  'use strict';

  var PARAM     = 'lan';  /* ?lan=hi */
  var PARAM_ALT = 'lang'; /* ...and ?lang=hi */
  /* one locale for the whole game; the .js copy (the generated fallback
     for file://) sets its own global */
  var PARTS = [
    { json: 'locales/locales.json', js: 'locales/locales.js', global: 'GAME_LOCALES' }
  ];
  var CLIP_EXT  = '.webm';                    /* Opus in WebM, see media rules */
  /* the file's own codes, and what <html lang> should say where they differ */
  var BCP47 = { od: 'or' };
  /* keys of the file that are not languages */
  var META = { defaultLanguage: 1, languageLabels: 1, voiceOver: 1 };

  var _data = null;
  var _lang = 'en';

  /* ---------- which language ---------- */
  function _urlLang() {
    try {
      var p = new URLSearchParams(window.location.search);
      return String(p.get(PARAM) || p.get(PARAM_ALT) || '').trim().toLowerCase();
    } catch (e) { return ''; }
  }
  function _isLang(code) {
    return !!(code && _data && !META[code] && _data[code] && typeof _data[code] === 'object');
  }
  function _default() {
    var def = _data && _data.defaultLanguage;
    return _isLang(def) ? def : 'en';
  }
  function _pick() {
    var want = _urlLang();
    return _isLang(want) ? want : _default();
  }

  /* ---------- loading ---------- */
  function _readJson(path, cb) {
    var xhr;
    try { xhr = new XMLHttpRequest(); xhr.open('GET', path, true); }
    catch (e) { return cb(null); }
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200 && xhr.status !== 0) return cb(null);
      try { cb(JSON.parse(xhr.responseText)); } catch (e) { cb(null); }
    };
    try { xhr.send(); } catch (e) { cb(null); }
  }
  function _readScript(part, cb) {
    if (window[part.global]) return cb(window[part.global]);
    var s = document.createElement('script');
    s.src = part.js;
    s.onload  = function () { cb(window[part.global] || null); };
    s.onerror = function () { cb(null); };
    (document.head || document.documentElement).appendChild(s);
  }
  function _warn(msg) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[i18n] ' + msg);
  }
  /* the locale: the JSON over http, its .js copy from file:// or when the
     JSON cannot be read */
  function _readPart(part, local, cb) {
    var fromScript = function () {
      _readScript(part, function (js) {
        if (!js) _warn('could not read ' + part.json + ' or ' + part.js + '; its keys will show');
        cb(js);
      });
    };
    if (local) return fromScript();          /* file:// cannot fetch the JSON */
    _readJson(part.json, function (json) { return json ? cb(json) : fromScript(); });
  }
  /* The locales as one: every language's lines, every language's
     recordings. A clip is kept as its full url, built with its own file's
     dir and rev. */
  function _merge(parts) {
    var out = { voiceOver: {} };
    parts.forEach(function (data, i) {
      if (!data) return;
      Object.keys(data).forEach(function (code) {
        var val = data[code];
        if (code === 'defaultLanguage') { if (!out.defaultLanguage) out.defaultLanguage = val; return; }
        if (code === 'languageLabels') {
          out.languageLabels = out.languageLabels || {};
          Object.keys(val || {}).forEach(function (l) {
            if (!out.languageLabels[l]) out.languageLabels[l] = val[l];
          });
          return;
        }
        if (code === 'voiceOver') {
          Object.keys(val || {}).forEach(function (l) {
            var src = val[l] || {};
            var dst = out.voiceOver[l] = out.voiceOver[l] ||
              { dir: src.dir, rev: src.rev, files: {}, cues: {}, urls: {} };
            Object.keys(src.files || {}).forEach(function (k) {
              if (k in dst.files) return;
              dst.files[k] = src.files[k];
              dst.urls[k] = (src.dir || '') + src.files[k] + (src.rev ? '?v=' + src.rev : '');
            });
            Object.keys(src.cues || {}).forEach(function (k) {
              if (!(k in dst.cues)) dst.cues[k] = src.cues[k];
            });
          });
          return;
        }
        if (!val || typeof val !== 'object') return;
        var dict = out[code] = out[code] || {};
        Object.keys(val).forEach(function (k) {
          if (k in dict) return _warn('"' + k + '" is in more than one locale; ' + PARTS[i].json + ' is ignored');
          dict[k] = val[k];
        });
      });
    });
    return out.defaultLanguage ? out : null;
  }
  function _finish(data, cb) {
    _data = data || { defaultLanguage: 'en', en: {} };
    _lang = _pick();
    try { document.documentElement.lang = BCP47[_lang] || _lang; } catch (e) {}
    if (cb) cb(_lang);
  }
  /* Load the locale and call back with the language code. The game goes
     on showing keys if nothing can be read -- never a blocked screen. */
  function load(cb) {
    var local = false;
    try { local = window.location.protocol === 'file:'; } catch (e) {}
    var got = new Array(PARTS.length), left = PARTS.length;
    PARTS.forEach(function (part, i) {
      _readPart(part, local, function (data) {
        got[i] = data;
        if (--left === 0) _finish(_merge(got), cb);
      });
    });
  }

  /* ---------- text by key ---------- */
  function _sub(str, repl) {
    if (!repl) return str;
    Object.keys(repl).forEach(function (k) {
      str = str.split('{' + k + '}').join(String(repl[k]));
    });
    return str;
  }
  /* the raw value of a key: the language's own, else the default's */
  function _raw(key) {
    var dict = (_data && _data[_lang]) || {};
    var def  = (_data && _data[_default()]) || {};
    if (key in dict) return dict[key];
    if (key in def)  return def[key];
    /* 'p20Work.0' reaches into an array */
    var dot = key.lastIndexOf('.');
    if (dot > 0) {
      var arr = _raw(key.slice(0, dot)), i = +key.slice(dot + 1);
      if (Array.isArray(arr) && i in arr) return arr[i];
    }
    return undefined;
  }
  /* t(key, replacements): the line in the current language. An array key
     comes back as a fresh array. A missing key comes back as the key
     itself, so it can be seen and fixed. */
  function t(key, repl) {
    var val = _raw(key);
    if (Array.isArray(val)) return val.slice();
    if (typeof val !== 'string') return String(key);
    return _sub(val, repl);
  }
  function has(key) { return _raw(key) !== undefined; }
  /* "16 {unitCm}" -> "16 cm": every {key} in the template is a lookup */
  function fmt(template) {
    return String(template).replace(/\{(\w+)\}/g, function (m, k) { return has(k) ? t(k) : m; });
  }

  /* ---------- static markup ---------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function html(text) { return esc(text).split('²').join('<sup>2</sup>'); }
  function applyStatic(root) {
    root = root || document;
    var q = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
    q('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (has(key)) el.textContent = t(key);
    });
    q('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (has(key)) el.innerHTML = html(t(key));
    });
    q('[data-i18n-fmt]').forEach(function (el) {
      el.innerHTML = html(fmt(el.getAttribute('data-i18n-fmt')));
    });
    q('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var at = pair.indexOf(':');
        if (at < 0) return;
        var attr = pair.slice(0, at).trim(), key = pair.slice(at + 1).trim();
        if (attr && has(key)) el.setAttribute(attr, t(key));
      });
    });
    if (root === document && has('pageTitle')) document.title = t('pageTitle');
  }

  /* ---------- voice-over by key ---------- */
  /* the recordings of the current language, else the default language's */
  function _pack() {
    var vo = (_data && _data.voiceOver) || {};
    return vo[_lang] || vo[_default()] || null;
  }
  function hasVoice() { return !!_pack(); }
  /* the clip for a key: assets/VO/en/<key>.webm, or an entry of the pack's
     "files" map when a clip is named otherwise. null when the language has
     no recordings at all. The file itself may still be missing (not yet
     recorded) -- say() treats that as silence. */
  function voice(key) {
    var p = _pack();
    if (!p || !key) return null;
    if (p.urls && p.urls[key]) return p.urls[key];
    var file = (p.files && p.files[key]) || (key + CLIP_EXT);
    return (p.dir || '') + file + (p.rev ? '?v=' + p.rev : '');
  }

  /* The clips are fetched by the loader before Start (js/loader.js) and
     played by js/audio.js; preload() decodes a few ahead of their lines. */
  var _playing = null;                        /* GameAudio handle */
  function preload(keys) {
    if (!window.GameAudio) return;
    (keys || []).forEach(function (k) { GameAudio.warm(voice(k)); });
  }
  /* every key the current language has a recording of */
  function voiced() {
    var p = _pack();
    return p && p.files ? Object.keys(p.files) : [];
  }
  /* cues(key): when each word of the key's line is heard, in ms from the
     start of its clip -- one entry per word as the Typer cuts the line
     (a word with the spaces after it). null when the clip has no cues, or
     the line no longer has that many words: its text was changed after it
     was recorded, and a word-for-word match can no longer be trusted.
     cues(key, text) counts the words of `text` instead of the key's. */
  function cues(key, text) {
    var p = _pack();
    var list = p && p.cues && p.cues[key];
    if (!Array.isArray(list)) return null;
    var words = String(text != null ? text : t(key)).match(/\S+\s*/g) || [];
    return words.length === list.length ? list.slice() : null;
  }
  /* every clip the locale names, for the loader to fetch */
  function clips() {
    var p = _pack();
    return p && p.urls ? Object.keys(p.urls).map(function (k) { return p.urls[k]; }) : [];
  }
  function stop() {
    var h = _playing;
    _playing = null;
    if (h) h.stop();
  }
  /* say(key): play the key's clip; one clip at a time. Resolves with true
     when it has ended, false when there was no clip, it could not play
     (autoplay blocked, file not recorded yet) or it was cut by a later say
     or by stop(). */
  function say(key) {
    var p = _pack();
    /* only a recorded line: a key with no clip yet is silence, not a 404 */
    var url = p && p.urls && p.urls[key];
    stop();
    if (!url || !window.GameAudio) return Promise.resolve(false);
    var h = _playing = GameAudio.play(url);
    return h.done.then(function (ok) {
      if (_playing === h) _playing = null;
      return ok;
    });
  }

  /* ---------- the language, read and changed ---------- */
  function getLang() { return _lang; }
  function getLanguages() {
    return Object.keys(_data || {}).filter(_isLang);
  }
  /* a new language is a reload with ?lan=xx, so every line and clip is
     built for it from the first frame */
  function setLang(code) {
    code = String(code || '').toLowerCase();
    if (!_isLang(code) || code === _lang) return false;
    try {
      var url = new URL(window.location.href);
      url.searchParams.set(PARAM, code);
      url.searchParams.delete(PARAM_ALT);
      window.location.href = url.toString();
      return true;
    } catch (e) { return false; }
  }

  return {
    load: load,
    t: t, has: has, fmt: fmt, html: html, applyStatic: applyStatic,
    hasVoice: hasVoice, voice: voice, say: say, stop: stop, preload: preload,
    voiced: voiced, cues: cues, clips: clips,
    getLang: getLang, getLanguages: getLanguages, setLang: setLang
  };
})();

/* the one short name the game uses for its words */
function T(key, repl) { return I18n.t(key, repl); }
