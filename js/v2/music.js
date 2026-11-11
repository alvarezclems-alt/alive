/* ALIVE V2/V3 - music.js : adaptive music, synthesised in the browser (WebAudio), composed for the port.
 *  - instruments : choir and string pads, FM bells, flute, plucked strings, marimba, electric piano,
 *    synth bass and leads, a drum kit (kick, snare, hats, toms, frame drum, shaker) ;
 *  - a hall reverb and a stereo echo, every voice placed in the stereo field ;
 *  - one theme per area : the ice, the swamp, the jungle, the desert, the city of New York,
 *    Porkus' bar, Necarex' lair ; themes have two sections and cross-fade when James changes area ;
 *  - a tension layer that rises during an encounter, and short stingers (encounter, wound, death,
 *    victory, new world) ;
 *  - the title keeps the 1991 melody (ALIVE.BAS DATA 65070), re-orchestrated.
 */
(function () {
  'use strict';
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11], phrygdom: [0, 1, 4, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11] };

  /* melody notation : "1:4 3:2 5,:2 -:4 #4':8" = degree (1-7), # or b, ' octave up / , octave down, : length in 16ths */
  function mel(str, root, scale, start = 0, vel = 0.8) {
    const out = []; let t = start; const sc = SCALES[scale];
    str.trim().split(/\s+/).forEach(tok => {
      if (tok === '|') return;
      const [d, l] = tok.split(':'); const len = +l || 4;
      if (d !== '-') {
        let m = d.match(/^([#b]?)(\d)(['",]*)$/); if (!m) { t += len; return; }
        const deg = +m[2] - 1, oct = (m[3].match(/'/g) || []).length - (m[3].match(/,/g) || []).length;
        let n = root + sc[deg % 7] + 12 * (Math.floor(deg / 7) + oct) + (m[1] === '#' ? 1 : m[1] === 'b' ? -1 : 0);
        out.push([t, n, len, vel]);
      }
      t += len;
    });
    return out;
  }
  /* chords : names relative to MIDI, e.g. 'A3m', 'F3', 'E3', 'G3maj7', 'D3m7', 'B2' */
  const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function chordNotes(name) {
    const m = name.match(/^([A-G])([#b]?)(\d)(.*)$/); let r = 12 * (+m[3] + 1) + ROOTS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const q = m[4];
    const iv = q === 'm' ? [0, 3, 7] : q === 'm7' ? [0, 3, 7, 10] : q === 'maj7' ? [0, 4, 7, 11] : q === '7' ? [0, 4, 7, 10] : q === 'sus4' ? [0, 5, 7] : q === 'dim' ? [0, 3, 6] : q === '5' ? [0, 7] : [0, 4, 7];
    return iv.map(i => r + i);
  }
  const bar = 16;
  const padT = (prog, vel = 0.5, len = bar) => prog.flatMap((c, i) => chordNotes(c).map(n => [i * len, n, len, vel]));
  const bassT = (prog, pat, vel = 0.8, oct = -12) => prog.flatMap((c, i) => pat.map(([s, l, o]) => [i * bar + s, chordNotes(c)[0] + oct + (o || 0), l, vel]));
  const arpT = (prog, pat, vel = 0.5, oct = 12) => prog.flatMap((c, i) => { const n = chordNotes(c); return pat.map((k, j) => (k < 0 ? null : [i * bar + j * 2, n[k % n.length] + oct + 12 * Math.floor(k / n.length), 2, vel])).filter(Boolean); });
  const hits = (steps, vel = 0.8, bars = 1) => { const o = []; for (let b = 0; b < bars; b++) steps.forEach(s => o.push([b * bar + s, 0, 1, vel])); return o; };
  const cat = (...secs) => { const out = {}; let off = 0; secs.forEach(sec => { Object.entries(sec.tracks).forEach(([k, notes]) => { (out[k] = out[k] || []).push(...notes.map(([s, n, l, v]) => [s + off, n, l, v])); }); off += sec.len; }); return { tracks: out, steps: off }; };

  /* ================= the themes ================= */
  const T = {};
  { // THE ICE : choir, FM bells, wind, a distant taiko — A minor, slow
    const A = ['A2m', 'F2', 'C3', 'G2', 'A2m', 'F2', 'D3m', 'E2'], B = ['F2', 'G2', 'E2m', 'A2m', 'F2', 'G2', 'E2sus4', 'E2'];
    const mA = mel("5:8 4:4 3:4 | 1:8 3:4 4:4 | 5:12 6:4 | 5:16 | 5:8 4:4 3:4 | 1:8 2:4 3:4 | 4:8 3:4 2:4 | #7,:16", 69, 'minor');
    const mB = mel("6:8 5:4 6:4 | 7:8 6:4 5:4 | 5:12 3:4 | 1:16 | 6:8 5:4 6:4 | 7:4 1':4 2':8 | 1':8 7:4 6:4 | #7:16", 69, 'minor');
    const secA = { len: 8 * bar, tracks: { choir: padT(A, 0.45), bell: mA.map(([s, n, l, v]) => [s, n + 12, l, v * 0.6]), bass: bassT(A, [[0, 16]], 0.5), wind: [[0, 0, 64, 0.35], [64, 0, 64, 0.35]], taiko: hits([0], 0.35, 8).filter((_, i) => i % 2 === 0) } };
    const secB = { len: 8 * bar, tracks: { choir: padT(B, 0.5), flute: mB.map(([s, n, l, v]) => [s, n, l, v * 0.8]), bell: arpT(B, [0, -1, 2, -1, 1, -1, 2, -1], 0.25, 24), bass: bassT(B, [[0, 16]], 0.55), wind: [[0, 0, 128, 0.3]], taiko: hits([0, 10], 0.35, 8) } };
    T.ice = Object.assign({ bpm: 72, tension: { taiko: hits([0, 6, 8, 12], 0.7, 8), strings: padT(['A2m', 'A2m', 'F2', 'E2', 'A2m', 'A2m', 'F2', 'E2'], 0.35).map(([s, n, l, v]) => [s, n + 12, l, v]) }, reverb: 0.55 }, cat(secA, secB));
  }
  { // THE SWAMP : drones, slow heartbeat, sparse eerie bells — C minor, very slow
    const D = ['C2m', 'C2m', 'Db2', 'C2m', 'C2m', 'Ab1', 'G1', 'C2m'];
    const bells = mel("5':6 -:10 | -:8 b6':4 5':4 | -:16 | 2':6 -:10 | 5':4 -:4 b2'':8 | -:16 | 7:8 -:8 | 1':16", 60, 'minor');
    const sec = { len: 8 * bar, tracks: { drone: D.map((c, i) => [i * bar, chordNotes(c)[0] - 12, bar, 0.6]), choir: padT(D, 0.3).map(([s, n, l, v]) => [s, n + 12, l, v]), bell: bells.map(([s, n, l, v]) => [s, n, l, 0.4]), heart: hits([0, 3], 0.55, 8), wind: [[0, 0, 128, 0.25]] } };
    T.swamp = Object.assign({ bpm: 56, reverb: 0.7, gain: 1.4, tension: { heart: hits([0, 3, 8, 11], 0.8, 8), strings: D.map((c, i) => [i * bar, chordNotes(c)[0] + 13, bar, 0.3]) } }, cat(sec));
  }
  { // THE JUNGLE : marimba, flute, toms and shakers — D dorian
    const A = ['D3m', 'C3', 'Bb2', 'A2', 'D3m', 'C3', 'G2m', 'A2'], B = ['F2', 'C3', 'G2m', 'D3m', 'Bb2', 'F2', 'G2m', 'A2'];
    const mA = mel("5:4 6:2 5:2 4:4 3:4 | 2:6 3:2 4:8 | 3:4 4:2 3:2 2:4 1:4 | #7,:12 -:4 | 5:4 6:2 5:2 4:4 3:4 | 2:6 3:2 4:4 5:4 | 6:4 5:4 4:4 2:4 | #3:16", 62, 'dorian');
    const mB = mel("1':6 7:2 6:8 | 5:6 4:2 5:8 | 4:4 5:4 6:4 7:4 | 1':12 -:4 | 2':6 1':2 7:8 | 6:6 5:2 4:8 | 3:4 4:4 5:4 3:4 | #3:16", 62, 'dorian');
    const groove = { tom: hits([0, 6, 10], 0.7, 8), shaker: hits([2, 6, 10, 14], 0.3, 8).concat(hits([4, 12], 0.2, 8)), conga: hits([3, 11, 14], 0.45, 8) };
    const secA = { len: 8 * bar, tracks: Object.assign({ marimba: arpT(A, [0, 2, 1, 2, 0, 2, 1, 3], 0.45, 12), bass: bassT(A, [[0, 3], [6, 2], [10, 3]], 0.7), pad: padT(A, 0.22), flute: mA.map(([s, n, l, v]) => [s, n + 12, l, v * 0.7]) }, groove) };
    const secB = { len: 8 * bar, tracks: Object.assign({ marimba: arpT(B, [0, 1, 2, 1, 0, 1, 2, 3], 0.4, 12), bass: bassT(B, [[0, 3], [6, 2], [10, 3]], 0.7), pad: padT(B, 0.25), flute: mB.map(([s, n, l, v]) => [s, n + 12, l, v * 0.75]) }, groove) };
    T.jungle = Object.assign({ bpm: 100, reverb: 0.4, tension: { taiko: hits([0, 4, 8, 12], 0.7, 16), stab: padT(['D3m', 'D3m', 'C3', 'A2', 'D3m', 'D3m', 'Bb2', 'A2'], 0.3).filter(([s]) => s % 32 === 0).map(([s, n, l, v]) => [s, n, 2, 0.5]) } }, cat(secA, secB));
  }
  { // THE DESERT : plucked oud, ney flute, frame drum — D phrygian dominant
    const A = ['D3', 'Eb3', 'D3', 'C3m', 'D3', 'Eb3', 'C3m', 'D3'];
    const m = mel("1':4 b2':2 3':2 4':8 | 3':4 b2':4 1':8 | 7:4 1':2 b2':2 3':4 b2':4 | 1':16 | 5':6 4':2 3':8 | 4':4 3':4 b2':8 | 1':4 b2':2 1':2 7:4 b6:4 | 1':16", 62, 'phrygdom');
    const oud = A.flatMap((c, i) => [[0, 0], [3, 0], [6, 7], [8, 0], [11, 3], [14, 7]].map(([s, k]) => [i * bar + s, chordNotes(c)[0] + k, 2, 0.5]));
    const sec = { len: 8 * bar, tracks: { oud, ney: m.map(([s, n, l, v]) => [s, n, l, v * 0.75]), drone: A.map((c, i) => [i * bar, 38, bar, 0.4]), frame: hits([0, 6, 8], 0.65, 8), riq: hits([2, 4, 10, 12, 14], 0.25, 8) } };
    T.desert = Object.assign({ bpm: 88, reverb: 0.5, tension: { taiko: hits([0, 3, 6, 8, 12], 0.7, 8) } }, cat(sec, { len: 8 * bar, tracks: { oud, drone: sec.tracks.drone, frame: sec.tracks.frame, riq: sec.tracks.riq, ney: mel("5:8 4:4 3:4 | b2:8 1:8 | 3:4 4:4 5:4 b6:4 | 5:16 | 1':8 7:4 b6:4 | 5:8 4:8 | 3:4 b2:4 1:8 | 1:16", 74, 'phrygdom') } }));
  }
  { // NEW YORK : dark synthwave — E minor
    const A = ['E2m', 'C3', 'G2', 'D3', 'E2m', 'C3', 'A2m', 'B2'];
    const lead = mel("5:6 4:2 3:4 2:4 | 3:8 -:4 1:4 | 2:6 3:2 4:4 5:4 | 4:12 -:4 | 5:6 6:2 7:4 1':4 | 7:8 5:8 | 6:4 5:4 4:4 3:4 | #7,:16", 64, 'minor');
    const drums = { kick: hits([0, 8], 0.9, 8), snare: hits([4, 12], 0.6, 8), hat: hits([2, 6, 10, 14], 0.3, 8) };
    const secA = { len: 8 * bar, tracks: Object.assign({ synbass: bassT(A, [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]], 0.6), pad: padT(A, 0.3), arp: arpT(A, [0, 1, 2, 3, 2, 1, 0, 1], 0.25, 24) }, drums) };
    const secB = { len: 8 * bar, tracks: Object.assign({ synbass: secA.tracks.synbass, pad: padT(A, 0.32), lead: lead.map(([s, n, l, v]) => [s, n + 12, l, v * 0.6]), arp: secA.tracks.arp }, drums) };
    T.city = Object.assign({ bpm: 108, reverb: 0.45, tension: { snare: hits([2, 10, 14], 0.4, 16), stab: padT(A, 0.3).map(([s, n, l, v]) => [s + 6, n + 12, 2, 0.5]) } }, cat(secA, secB));
  }
  { // PORKUS' BAR : lounge — electric piano, walking bass, brushes (a little swing)
    const A = ['G2maj7', 'E2m7', 'A2m7', 'D3'], B = ['C3maj7', 'B2m7', 'E2m7', 'A2m7', 'A2m7', 'D3'];
    const walk = (prog) => prog.flatMap((c, i) => { const r = chordNotes(c)[0] - 12; return [[0, r], [4, r + 4], [8, r + 7], [12, r + 9]].map(([s, n]) => [i * bar + s, n, 4, 0.6]); });
    const sax = mel("3:6 5:2 6:4 5:4 | 3:8 2:4 1:4 | 2:6 3:2 5:4 6:4 | 5:16", 67, 'major');
    const comp = prog => prog.flatMap((c, i) => chordNotes(c).flatMap(n => [[i * bar + 0, n + 12, 3, 0.35], [i * bar + 7, n + 12, 2, 0.28], [i * bar + 10, n + 12, 3, 0.3]]));
    const brush = { hat: hits([0, 5, 8, 13], 0.25, 4), snare: hits([4, 12], 0.18, 4) };
    T.bar = Object.assign({ bpm: 92, reverb: 0.3, swing: 0.16, gain: 1.7, tension: {} }, cat({ len: 4 * bar, tracks: Object.assign({ epiano: comp(A), upright: walk(A), sax: sax.map(([s, n, l, v]) => [s, n, l, 0.5]) }, brush) }, { len: 4 * bar, tracks: Object.assign({ epiano: comp(A), upright: walk(A) }, brush) }));
  }
  { // NECAREX' LAIR, the generator : machine pulse, cold choir clusters
    const sec = { len: 8 * bar, tracks: { synbass: hits([0, 2, 4, 6, 8, 10, 12, 14], 0.55, 8).map(([s, , l, v]) => [s, 28, l, v]), choir: [[0, 64, 64, 0.35], [0, 65, 64, 0.25], [64, 63, 64, 0.35], [64, 64, 64, 0.25]], tick: hits([0, 4, 8, 12], 0.3, 8), bell: mel("1'':4 -:28 | b2'':4 -:28 | 1'':4 -:12 #4':4 -:12", 64, 'minor').map(([s, n, l, v]) => [s, n, l, 0.3]) } };
    T.lair = Object.assign({ bpm: 90, reverb: 0.6, gain: 1.3, tension: { kick: hits([0, 4, 8, 12], 0.8, 8), strings: [[0, 52, 128, 0.35]] } }, cat(sec));
  }

  /* ================= engine ================= */
  const M = {
    ctx: null, enabled: true, volume: 0.5, zone: null, intensity: 0, buses: [], timer: null, theme: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
      const ac = this.ctx;
      this.master = ac.createGain(); this.master.gain.value = 0.55 * this.volume;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      this.master.connect(comp); comp.connect(ac.destination);
      // hall reverb : a generated, decaying stereo impulse
      this.reverb = ac.createConvolver(); const len = Math.floor(ac.sampleRate * 2.8), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.reverb.buffer = ir; this.revGain = ac.createGain(); this.revGain.gain.value = 0.5; this.reverb.connect(this.revGain); this.revGain.connect(this.master);
      // stereo echo
      this.echo = ac.createDelay(1); this.echo.delayTime.value = 0.36; const fb = ac.createGain(); fb.gain.value = 0.28; const ew = ac.createGain(); ew.gain.value = 0.22;
      this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(ew); ew.connect(this.master);
      const nl = ac.sampleRate; this.noise = ac.createBuffer(1, nl, ac.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
      return true;
    },
    /* one note of one instrument, scheduled at time t into a bus */
    voice(bus, type, t, n, dur, vel) {
      const ac = this.ctx, out = ac.createGain(), pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
      const PAN = { flute: 0.25, ney: 0.25, marimba: -0.3, oud: -0.35, bell: 0.4, arp: -0.4, lead: 0.15, sax: 0.2, epiano: -0.2, shaker: 0.5, riq: 0.45, hat: 0.35, conga: -0.45, tick: 0.5, stab: -0.15 };
      if (pan) { pan.pan.value = PAN[type] || 0; out.connect(pan); pan.connect(bus); } else out.connect(bus);
      const wet = { choir: 0.6, pad: 0.5, strings: 0.55, bell: 0.6, flute: 0.4, ney: 0.45, drone: 0.4, sax: 0.3, epiano: 0.25, lead: 0.35, taiko: 0.5, heart: 0.3 }[type] || 0.12;
      const rs = ac.createGain(); rs.gain.value = wet; out.connect(rs); rs.connect(this.reverb);
      if (['bell', 'arp', 'lead', 'flute', 'marimba'].includes(type)) { const es = ac.createGain(); es.gain.value = 0.25; out.connect(es); es.connect(this.echo); }
      const g = out.gain, f0 = NOTE(n);
      const env = (a, peak, r) => { g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(peak, t + a); g.setValueAtTime(peak, t + Math.max(a, dur - r)); g.linearRampToValueAtTime(0.0001, t + dur + 0.02); };
      const osc = (wave, f, det = 0, dest = out, st = t, en = t + dur + 0.1) => { const o = ac.createOscillator(); o.type = wave; o.frequency.value = f; o.detune.value = det; o.connect(dest); o.start(st); o.stop(en); return o; };
      const lp = (fr, q = 0.7) => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fr; f.Q.value = q; f.connect(out); return f; };
      const noise = (type2, fr, q, st, en) => { const s = ac.createBufferSource(); s.buffer = this.noise; const f = ac.createBiquadFilter(); f.type = type2; f.frequency.value = fr; f.Q.value = q || 1; s.connect(f); f.connect(out); s.start(st, Math.random() * 0.5); s.stop(en); return f; };
      switch (type) {
        case 'choir': case 'pad': case 'strings': { // detuned saws, vowel-like filter, slow attack
          const f = lp(type === 'choir' ? 1100 : 1500, type === 'choir' ? 4 : 1);
          [-9, 0, 8].forEach(d => osc('sawtooth', f0, d, f));
          if (type === 'choir') { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.2; lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); lfo.stop(t + dur + 0.1); }
          env(Math.min(1.6, dur * 0.4), vel * (type === 'choir' ? 0.07 : 0.06), Math.min(1.5, dur * 0.4)); break;
        }
        case 'drone': { const f = lp(400); osc('sawtooth', f0, -4, f); osc('sawtooth', f0 * 1.5, 3, f); env(2, vel * 0.09, 2); break; }
        case 'bell': { // FM bell
          const car = osc('sine', f0), mod = ac.createOscillator(), mg = ac.createGain(); mod.frequency.value = f0 * 3.5; mg.gain.setValueAtTime(f0 * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + dur * 1.6 + 0.5);
          mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(t + dur * 2 + 0.6); car.stop(t + dur * 2 + 0.6);
          g.setValueAtTime(vel * 0.18, t); g.exponentialRampToValueAtTime(0.0001, t + dur * 2 + 0.5); break;
        }
        case 'flute': case 'ney': { // sine with breath and vibrato
          const o = osc('sine', f0), o2 = osc('triangle', f0 * 2, 0); o2.disconnect(); const g2 = ac.createGain(); g2.gain.value = 0.15; o2.connect(g2); g2.connect(out);
          const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.012, t + 0.4); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
          if (type === 'ney') o.frequency.setValueAtTime(f0 * 0.97, t), o.frequency.linearRampToValueAtTime(f0, t + 0.08);
          noise('bandpass', f0 * 2, 3, t, t + Math.min(0.25, dur));
          env(0.06, vel * 0.16, Math.min(0.3, dur * 0.3)); break;
        }
        case 'marimba': { osc('sine', f0); const h = osc('sine', f0 * 4); h.disconnect(); const hg = ac.createGain(); hg.gain.setValueAtTime(0.4, t); hg.gain.exponentialRampToValueAtTime(0.001, t + 0.08); h.connect(hg); hg.connect(out); g.setValueAtTime(vel * 0.28, t); g.exponentialRampToValueAtTime(0.0001, t + 0.5); break; }
        case 'oud': { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.3); f.connect(out); osc('sawtooth', f0, 0, f); osc('triangle', f0 * 2, 3, f); g.setValueAtTime(vel * 0.2, t); g.exponentialRampToValueAtTime(0.0001, t + 0.7); break; }
        case 'epiano': { osc('sine', f0); const tn = osc('sine', f0 * 7); tn.disconnect(); const tg = ac.createGain(); tg.gain.setValueAtTime(0.25, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.15); tn.connect(tg); tg.connect(out); g.setValueAtTime(vel * 0.16, t); g.exponentialRampToValueAtTime(0.0001, t + dur + 0.6); break; }
        case 'sax': case 'lead': { const f = lp(type === 'sax' ? 1800 : 2600, 2); osc('sawtooth', f0, 0, f); osc('square', f0, -6, f); const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5.5; lg.gain.value = type === 'sax' ? 12 : 6; lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); lfo.stop(t + dur + 0.1); env(0.04, vel * 0.09, 0.15); break; }
        case 'arp': case 'stab': { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.25); f.connect(out); osc('sawtooth', f0, 0, f); osc('sawtooth', f0, 7, f); g.setValueAtTime(vel * 0.12, t); g.exponentialRampToValueAtTime(0.0001, t + Math.max(0.3, dur)); break; }
        case 'bass': case 'synbass': case 'upright': { const f = lp(type === 'synbass' ? 700 : 420, type === 'synbass' ? 5 : 1); osc(type === 'upright' ? 'triangle' : 'sawtooth', f0, 0, f); osc('sine', f0 / 2 * (type === 'synbass' ? 2 : 1), 0, f); env(0.01, vel * 0.22, type === 'upright' ? 0.2 : 0.05); break; }
        case 'kick': case 'heart': case 'tom': case 'taiko': case 'frame': case 'conga': {
          const fr = { kick: [140, 45, 0.3], heart: [90, 40, 0.35], tom: [200, 90, 0.35], taiko: [110, 50, 0.9], frame: [160, 70, 0.4], conga: [320, 220, 0.2] }[type];
          const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(fr[0], t); o.frequency.exponentialRampToValueAtTime(fr[1], t + fr[2] * 0.6); o.connect(out); o.start(t); o.stop(t + fr[2] + 0.05);
          g.setValueAtTime(vel * (type === 'taiko' ? 0.9 : 0.7), t); g.exponentialRampToValueAtTime(0.0001, t + fr[2]);
          if (type === 'frame' || type === 'taiko') noise('lowpass', 900, 1, t, t + 0.06);
          if (type === 'heart') { const o2 = ac.createOscillator(); o2.frequency.setValueAtTime(80, t + 0.18); o2.frequency.exponentialRampToValueAtTime(40, t + 0.4); const g2 = ac.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.setValueAtTime(vel * 0.5, t + 0.18); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o2.connect(g2); g2.connect(out); o2.start(t + 0.18); o2.stop(t + 0.5); }
          break;
        }
        case 'snare': { noise('highpass', 1800, 0.7, t, t + 0.2); const o = osc('triangle', 190, 0, out, t, t + 0.1); g.setValueAtTime(vel * 0.45, t); g.exponentialRampToValueAtTime(0.0001, t + 0.18); break; }
        case 'hat': case 'shaker': case 'riq': case 'tick': { noise(type === 'tick' ? 'bandpass' : 'highpass', type === 'tick' ? 3000 : type === 'hat' ? 8000 : 5000, type === 'tick' ? 8 : 0.7, t, t + 0.12); g.setValueAtTime(vel * 0.3, t); g.exponentialRampToValueAtTime(0.0001, t + (type === 'shaker' ? 0.09 : 0.05)); break; }
        case 'wind': { const f = noise('bandpass', 500, 0.9, t, t + dur + 0.1); f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(950, t + dur / 2); f.frequency.linearRampToValueAtTime(330, t + dur); env(dur * 0.35, vel * 0.25, dur * 0.35); break; }
        default: { osc('triangle', f0); env(0.02, vel * 0.15, 0.1); }
      }
    },
    /* a bus plays one theme ; buses fade in and out when the area changes */
    startBus(name) {
      const ac = this.ctx, th = T[name]; if (!th) return null;
      const gain = ac.createGain(), ten = ac.createGain(); gain.gain.setValueAtTime(0.0001, ac.currentTime); gain.gain.linearRampToValueAtTime(th.gain || 1, ac.currentTime + 2.5);
      ten.gain.value = this.intensity ? 1 : 0.0001; ten.connect(gain); gain.connect(this.master);
      const bus = { name, th, gain, ten, step: 0, next: ac.currentTime + 0.12, dead: false };
      this.revGain.gain.setTargetAtTime(th.reverb != null ? th.reverb : 0.5, ac.currentTime, 1);
      return bus;
    },
    tick() {
      const ac = this.ctx;
      this.buses.forEach(b => {
        if (b.dead) return;
        const th = b.th, sp = 60 / th.bpm / 4;
        while (b.next < ac.currentTime + 0.3) {
          const sw = th.swing && b.step % 2 ? sp * th.swing : 0;
          for (const [type, notes] of Object.entries(th.tracks)) for (const [s, n, l, v] of notes) if (s === b.step) this.voice(b.gain, type, b.next + sw, n, l * sp, v);
          if (th.tension) { const len = 8 * bar; for (const [type, notes] of Object.entries(th.tension)) for (const [s, n, l, v] of notes) if (s === b.step % len) this.voice(b.ten, type, b.next + sw, n, l * sp, v); }
          b.step = (b.step + 1) % th.steps; b.next += sp;
        }
      });
    },
    setZone(zone, intensity = 0) {
      if (!this.enabled || !this.init()) return;
      const ac = this.ctx;
      if (intensity !== this.intensity) { this.intensity = intensity; this.buses.forEach(b => b.ten.gain.setTargetAtTime(intensity ? 1 : 0.0001, ac.currentTime, 0.8)); }
      if (zone === this.zone && this.buses.some(b => !b.dead)) return;
      this.zone = zone; this.theme = zone;
      this.buses.forEach(b => { if (!b.dead) { b.dead = true; b.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.9); const g = b.gain; setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 6000); } });
      this.buses = this.buses.filter(b => !b.dead).concat([this.startBus(zone)].filter(Boolean));
      if (!this.timer) this.timer = setInterval(() => this.tick(), 90);
      this.tick();
    },
    play(world) { this.setZone({ 1: 'ice', 2: 'jungle', 3: 'city' }[world] || 'ice', this.intensity); }, // compatibility
    /* short musical punctuation */
    stinger(name) {
      if (!this.enabled || !this.init()) return;
      const ac = this.ctx, t = ac.currentTime + 0.02, bus = this.master;
      const seq = {
        encounter: [['strings', 0, 50, 1.2, 0.8], ['strings', 0, 53, 1.2, 0.7], ['strings', 0, 56, 1.2, 0.7], ['taiko', 0, 0, 1, 1]],
        hurt: [['taiko', 0, 0, 1, 0.9], ['stab', 0, 46, 0.3, 0.6], ['stab', 0, 47, 0.3, 0.6]],
        death: [['strings', 0, 57, 2.4, 0.7], ['strings', 0.6, 56, 2.4, 0.7], ['strings', 1.2, 55, 2.4, 0.7], ['strings', 1.8, 52, 3.5, 0.8], ['bell', 1.8, 64, 3, 0.6], ['taiko', 1.8, 0, 1, 0.9]],
        win: [['lead', 0, 67, 0.25, 0.8], ['lead', 0.25, 72, 0.25, 0.8], ['lead', 0.5, 76, 0.25, 0.8], ['lead', 0.75, 79, 1.2, 0.9], ['strings', 0.75, 60, 1.6, 0.6], ['strings', 0.75, 64, 1.6, 0.6], ['strings', 0.75, 67, 1.6, 0.6], ['taiko', 0.75, 0, 1, 0.8]],
        world: [['choir', 0, 57, 3, 0.8], ['choir', 0, 64, 3, 0.7], ['bell', 0, 76, 2.5, 0.6], ['bell', 0.4, 81, 2.5, 0.5], ['bell', 0.8, 83, 2.5, 0.5]],
        treasure: [['bell', 0, 84, 0.8, 0.5], ['bell', 0.12, 88, 0.8, 0.5], ['bell', 0.24, 91, 1.2, 0.5]]
      }[name];
      if (!seq) return;
      seq.forEach(([type, dt, n, dur, vel]) => this.voice(bus, type, t + dt, n, dur, vel));
    },
    /* the 1991 title melody (periods / durations of DATA 65070), re-orchestrated : lead, choir, bass, bells */
    playTitle() {
      if (!this.enabled || !this.init()) return;
      this.stop(); this.theme = 'title';
      const data = window.AliveRules && window.AliveRules.MUSIC_DATA; if (!data) return;
      const bus = this.ctx.createGain(); bus.connect(this.master); this.titleBus = bus; this.revGain.gain.value = 0.6;
      let t = this.ctx.currentTime + 0.15; const start = t;
      for (let i = 0; i < data.length; i += 2) {
        const x = data[i], y = data[i + 1]; if (x === 1 && y === 0) break;
        const dur = y / 100;
        if (x > 1) {
          const f = 125000 / x, n = Math.round(69 + 12 * Math.log2(f / 440));
          this.voice(bus, 'lead', t, n, dur * 0.95, 0.8);
          if (dur >= 0.5) { this.voice(bus, 'choir', t, n - 12, dur * 1.2, 0.7); this.voice(bus, 'bass', t, n - 24, dur, 0.6); }
          if (dur >= 0.8) this.voice(bus, 'bell', t, n + 12, dur, 0.4);
        }
        t += dur;
      }
      this.timer = setTimeout(() => { this.timer = null; if (this.theme === 'title') this.playTitle(); }, (t - start) * 1000 + 1500);
    },
    stop() {
      clearInterval(this.timer); clearTimeout(this.timer); this.timer = null; this.theme = null; this.zone = null;
      if (this.ctx) { const now = this.ctx.currentTime; this.buses.forEach(b => { b.dead = true; b.gain.gain.setTargetAtTime(0.0001, now, 0.3); }); if (this.titleBus) this.titleBus.gain.setTargetAtTime(0.0001, now, 0.2); }
      this.buses = []; this.titleBus = null;
    },
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = 0.55 * v; },
    themes: T
  };
  window.AliveV2Music = M;
})();
