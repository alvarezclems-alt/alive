/* ALIVE - Web port. sound.js : sound effects in the style of the CPC sound chip (AY-3-8912):
 * square-wave tones, white noise and volume envelopes, synthesised with WebAudio.
 *
 * Authentic (from the 1991 code) : 'victory' (ALIVE.BAS 1010 : SOUND 129,2000,0,0,3,0,30 + ENV 3),
 *                                  'beep' (CHR$(7) on disk errors).
 * Added for this port (no sound effects in the original game), can be switched off : everything else.
 */
(function () {
  'use strict';
  const S = {
    ctx: null, enabled: true, master: null, noiseBuf: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
      this.master = this.ctx.createGain(); this.master.gain.value = 0.16; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      return true;
    },
    // AY tone period (CPC SOUND units) -> Hz
    hz: period => 125000 / period,
    tone(freq, t0, dur, vol = 0.5, glideTo) {
      const ac = this.ctx, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(freq, t0);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise(t0, dur, vol = 0.5, cutoff = 4000, attack = 0) {
      const ac = this.ctx, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = this.noiseBuf; f.type = 'lowpass'; f.frequency.value = cutoff;
      g.gain.setValueAtTime(attack ? 0.0001 : vol, t0);
      if (attack) g.gain.linearRampToValueAtTime(vol, t0 + attack);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(this.master); src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
    },
    play(name, authentic) {
      if (!this.enabled && !authentic) return;
      if (!this.init()) return;
      const t = this.ctx.currentTime + 0.01, fx = FX[name];
      if (fx) fx.call(this, t);
    }
  };
  const FX = {
    /* --- authentic --- */
    beep(t) { this.tone(this.hz(239), t, 0.3, 0.35); },                       // CHR$(7)
    rumble(t) { this.tone(this.hz(2000), t, 0.35, 0.25); this.noise(t, 0.35, 0.6, 1800, 0.02); }, // SOUND 129,2000,0,0,3,0,30
    /* --- added --- */
    step(t) { this.noise(t, 0.06, 0.35, 2500); this.noise(t + 0.13, 0.05, 0.25, 2200); },
    turn(t) { this.noise(t, 0.04, 0.18, 6000); },
    cursor(t) { this.tone(this.hz(160), t, 0.03, 0.15); },
    select(t) { this.tone(this.hz(120), t, 0.05, 0.22); this.tone(this.hz(80), t + 0.05, 0.06, 0.2); },
    icon(t) { this.tone(this.hz(200), t, 0.04, 0.18); },
    encounter(t) { this.tone(this.hz(426), t, 0.12, 0.35); this.tone(this.hz(319), t + 0.13, 0.12, 0.35); this.tone(this.hz(426), t + 0.26, 0.2, 0.3); },
    pickup(t) { this.tone(this.hz(253), t, 0.07, 0.3); this.tone(this.hz(190), t + 0.08, 0.1, 0.3); },
    drop(t) { this.tone(this.hz(190), t, 0.07, 0.25); this.tone(this.hz(253), t + 0.08, 0.1, 0.25); },
    treasure(t) { [319, 253, 213, 160].forEach((p, i) => this.tone(this.hz(p), t + i * 0.09, 0.12, 0.3)); },
    drink(t) { [0, 0.15, 0.3].forEach(d => this.tone(this.hz(500), t + d, 0.08, 0.2, this.hz(350))); },
    eat(t) { [0, 0.12, 0.24].forEach(d => this.noise(t + d, 0.07, 0.3, 1500)); },
    rest(t) { this.tone(this.hz(640), t, 0.6, 0.15, this.hz(900)); },
    hit(t) { this.noise(t, 0.18, 0.7, 3000); this.tone(this.hz(1200), t, 0.12, 0.3, this.hz(2400)); },
    miss(t) { this.noise(t, 0.25, 0.35, 8000, 0.05); },
    hurt(t) { this.noise(t, 0.25, 0.7, 1200); this.tone(this.hz(900), t, 0.25, 0.3, this.hz(1800)); },
    win(t) { [319, 253, 213].forEach((p, i) => this.tone(this.hz(p), t + i * 0.1, 0.12, 0.3)); this.tone(this.hz(160), t + 0.3, 0.35, 0.3); },
    grenade(t) { this.noise(t, 1.2, 0.9, 900, 0.01); this.tone(this.hz(3000), t, 0.6, 0.3, this.hz(4000)); },
    fall(t) { this.tone(this.hz(150), t, 1.1, 0.35, this.hz(2500)); this.noise(t + 1.1, 0.4, 0.8, 900); },
    death(t) { [213, 253, 319, 426, 568].forEach((p, i) => this.tone(this.hz(p), t + i * 0.22, 0.24, 0.3)); this.noise(t + 1.1, 0.8, 0.4, 600, 0.1); },
    world(t) { this.noise(t, 2.2, 0.35, 1400, 0.8); this.tone(this.hz(800), t, 2.2, 0.15, this.hz(200)); },
    riddle(t) { [426, 319, 284, 426].forEach((p, i) => this.tone(this.hz(p), t + i * 0.16, 0.18, 0.25)); }
  };
  window.AliveSound = S;
})();
