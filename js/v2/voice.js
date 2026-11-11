/* ALIVE V2 - voice.js : spoken lines (Web Speech API, French voices of the system).
 * One voice profile per character : pitch and speed change, a female voice for Cilla / Bonnie when
 * the system has one. Narration lines in brackets are not spoken by the characters.
 */
(function () {
  'use strict';
  const S = window.speechSynthesis;
  const FEMALE = /amelie|amélie|audrey|aurelie|aurélie|denise|julie|hortense|marie|virginie|celine|céline|sylvie|elsa|eloise|léa|lea|female|femme|google français/i;
  const PROFILES = {
    narrateur: { pitch: 1.0, rate: 1.0 },
    james: { pitch: 0.95, rate: 1.05 },
    cilla: { pitch: 1.35, rate: 1.05, female: true },
    bonnie: { pitch: 1.4, rate: 1.1, female: true },
    sage: { pitch: 0.75, rate: 0.88 },
    general: { pitch: 0.7, rate: 0.95 },
    gilmore: { pitch: 1.15, rate: 1.2 },
    clarck: { pitch: 1.05, rate: 1.1 },
    radio: { pitch: 1.1, rate: 1.15 },
    mutant: { pitch: 0.45, rate: 0.95 },
    monstre: { pitch: 0.1, rate: 0.7 },
    garde: { pitch: 0.8, rate: 1.05 },
    porkus: { pitch: 0.65, rate: 1.0 },
    ward: { pitch: 0.8, rate: 0.9 },
    necarex: { pitch: 0.05, rate: 0.8 }
  };
  const V = {
    enabled: true, voices: [],
    load() { if (!S) return; this.voices = S.getVoices().filter(v => /^fr/i.test(v.lang)); },
    pick(female) {
      if (!this.voices.length) this.load();
      const fr = this.voices; if (!fr.length) return null;
      const f = fr.find(v => FEMALE.test(v.name)), m = fr.find(v => !FEMALE.test(v.name));
      return female ? (f || fr[0]) : (m || fr[0]);
    },
    say(text, who = 'narrateur') {
      if (!this.enabled || !S || !text) return;
      let t = String(text).replace(/\x18/g, '').replace(/\([^)]*\)/g, ' ').replace(/\s+-/g, '').replace(/\s{2,}/g, ' ').trim();
      if (window.AliveV2 && window.AliveV2.accent) t = window.AliveV2.accent(t);
      if (!t || !/[A-Za-zÀ-ÿ]/.test(t)) return;
      const p = PROFILES[who] || PROFILES.narrateur;
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'fr-FR'; u.pitch = p.pitch; u.rate = p.rate; u.volume = 0.95;
      const v = this.pick(p.female); if (v) u.voice = v;
      S.speak(u);
      return u;
    },
    stop() { if (S) S.cancel(); },
    available() { return !!S; }
  };
  if (S) { V.load(); S.onvoiceschanged = () => V.load(); }
  window.AliveV2Voice = V;
})();
