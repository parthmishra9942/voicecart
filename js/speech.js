(function(){
/* =========================================================================
 * speech.js — Speech Recognition + Text-To-Speech wrappers
 * -------------------------------------------------------------------------
 * Uses the browser's on-device Web Speech API (SpeechRecognition for input,
 * SpeechSynthesis for spoken confirmations). Everything stays on-device —
 * no audio is sent to any server, matching the privacy-first design.
 *
 * Because SpeechRecognition is not available in every browser (notably
 * Firefox and Safari), every caller gets a graceful fallback path: the app
 * detects it and shows a text input instead of breaking.
 * ========================================================================= */
'use strict';

/* -- feature detection ---------------------------------------------------- */
function isSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/* -- ISO -> BCP-47 language code for the recognition engine --------------- */
const LANG_CODES = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  hi: 'hi-IN',
};

/* =========================================================================
 * SpeechRecorder — thin wrapper around SpeechRecognition with continuous
 * listening and re-start to avoid the 60s auto-stop.
 * ========================================================================= */
class SpeechRecorder {
  constructor(opts) {
    opts = opts || {};
    this.onResult = opts.onResult;     // (text) -> void
    this.onEnd = opts.onEnd;           // () -> void  (listening stopped)
    this.onError = opts.onError;       // (err) -> void
    this.recognition = null;
    this.lang = opts.lang || 'en-US';
    this.listening = false;
  }

  start(lang) {
    if (lang) this.lang = LANG_CODES[lang] || lang || 'en-US';
    if (!isSpeechSupported()) {
      if (this.onError) this.onError({ error: 'not-supported' });
      return false;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = this.lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    let finalText = '';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      // surface interim for live visual feedback, final on end
      if (this.onResult) this.onResult(finalText + interim, finalText);
    };

    rec.onerror = (e) => {
      if (this.onError) this.onError(e.error || e);
    };

    rec.onend = () => {
      this.listening = false;
      if (this.onResult && finalText) this.onResult(finalText, finalText);
      if (this.onEnd) this.onEnd();
    };

    this.recognition = rec;
    this.listening = true;
    try { rec.start(); } catch (e) { /* already started */ }
    return true;
  }

  stop() {
    this.listening = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) { /* ignore */ }
    }
  }
}

/* =========================================================================
 * Speaker — Text-To-Speech confirmations/phrases.
 * ========================================================================= */
function speak(text, opts) {
  opts = opts || {};
  if (!('speechSynthesis' in window)) {
    if (opts.onEnd) opts.onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const langMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', hi: 'hi-IN' };
  utter.lang = langMap[opts.lang] || opts.lang || 'en-US';
  utter.rate = opts.rate || 1.0;
  utter.onend = () => { if (opts.onEnd) opts.onEnd(); };
  window.speechSynthesis.speak(utter);
}

/* -- expose for browser ------------------------------------------------ */
if (typeof window !== 'undefined' && window) {
  window.VOICESPEECH = { isSpeechSupported, LANG_CODES, SpeechRecorder, speak };
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isSpeechSupported, LANG_CODES, SpeechRecorder, speak };
}

})();
