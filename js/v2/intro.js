/* ALIVE V2 - intro.js : the story before the crash, after the 1991 manual (Lankhor).
 * Pentagon -> the F49 -> Bonnie -> Florida and Gilmore -> Cap Canaveral and Stan R. Clarck -> take-off -> the accident.
 * Animated scenes drawn on canvas (copper gradients, stars, the F49), captions, spoken lines.
 */
(function () {
  'use strict';
  const SCENES = [
    { draw: 'pentagone', lines: [
      ['narrateur', 'Washington, le Pentagone. Le Commandant James Butterfly est convoqué dans le bureau du Général Blakes.'],
      ['general', 'Asseyez-vous, Butterfly. Depuis combien de temps êtes-vous parmi nous ?'],
      ['james', 'Depuis cinq ans, mon Général.'],
      ['general', 'Butterfly, j\'irai droit au but. Vous êtes le meilleur. C\'est donc vous que nous avons choisi.']] },
    { draw: 'diapo', lines: [
      ['narrateur', 'La lumière s\'éteint. Sur l\'écran apparaît un avion de chasse d\'allure très futuriste.'],
      ['general', 'Voici le F49, le dernier prototype de la NASA. Le premier jet de combat capable de sortir de l\'atmosphère terrestre.'],
      ['general', 'Vous allez effectuer les premiers vols d\'essai de cette coûteuse merveille. Personne ne doit savoir.']] },
    { draw: 'bureau', lines: [
      ['bonnie', 'Encore une mission, James ? Dans quel coin du globe allez-vous voler, cette fois ?'],
      ['james', 'Je ne peux pas vous le dire, Bonnie. Je vous enverrai des cartes postales.']] },
    { draw: 'floride', lines: [
      ['narrateur', 'Vendredi 24 juin 1994. Sous le nom de George Clarksdale, Butterfly s\'envole pour Jacksonville, en Floride.'],
      ['gilmore', 'Mes respects, mon commandant. Je suis Jackie T. Gilmore, mais vous pouvez m\'appeler Jack.'],
      ['narrateur', 'Une vieille Ford croulante les conduit jusqu\'à Cap Canaveral.']] },
    { draw: 'piste', lines: [
      ['narrateur', 'Le lendemain matin, sur la piste, le copilote attend devant le bolide des airs.'],
      ['james', 'Stan ! Vieux salaud ! Qu\'est-ce que tu fais là ?'],
      ['clarck', 'James ! Toujours la forme ?'],
      ['narrateur', 'Stan R. Clarck. Ils ont fait le Vietnam ensemble.']] },
    { draw: 'decollage', lines: [
      ['james', 'F49 Z7U-3E à contrôle. Demande autorisation de décoller.'],
      ['radio', 'Autorisation accordée, piste 1. Bonne chance !'],
      ['narrateur', 'Huit heures du matin. Le F49 s\'envole vers l\'Est et quitte bientôt l\'atmosphère terrestre.']] },
    { draw: 'espace', lines: [
      ['narrateur', 'Soudain, tout le corps de l\'avion est brutalement secoué. Le compas devient fou.'],
      ['clarck', 'Le terminal est bloqué !'],
      ['narrateur', 'L\'avion pique. Une sirène hurle. Éjection impossible.'],
      ['narrateur', 'Une secousse, d\'une violence inouïe... Plus rien. C\'est fini...']] }
  ];

  const W = 640, H = 400;
  const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.8, s: Math.random() }));
  function copper(ctx, stops, y0, y1, bands = 28) { // stepped gradient, Amiga copper style
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1), c = mix(stops, t);
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(0, y0 + (y1 - y0) * i / bands, W, (y1 - y0) / bands + 1);
    }
  }
  function mix(stops, t) {
    const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i, a = stops[i], b = stops[i + 1];
    return [0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * f));
  }
  function f49(ctx, x, y, s, rot = 0, flame = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    if (flame) { ctx.fillStyle = `rgba(255,${150 + Math.random() * 80},60,0.9)`; ctx.beginPath(); ctx.moveTo(-58, -4); ctx.lineTo(-58 - flame * (18 + Math.random() * 10), 0); ctx.lineTo(-58, 4); ctx.fill(); }
    const body = ctx.createLinearGradient(0, -14, 0, 14); body.addColorStop(0, '#e8eef6'); body.addColorStop(0.5, '#8d9bb0'); body.addColorStop(1, '#3d4658');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(70, 0); ctx.quadraticCurveTo(40, -9, 0, -8); ctx.lineTo(-55, -6); ctx.lineTo(-60, 0); ctx.lineTo(-55, 6); ctx.lineTo(0, 7); ctx.quadraticCurveTo(40, 7, 70, 0); ctx.fill();
    ctx.fillStyle = '#5d6a80';
    ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-45, 30); ctx.lineTo(-58, 30); ctx.lineTo(-35, 4); ctx.fill(); // wing
    ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(-52, -28); ctx.lineTo(-60, -28); ctx.lineTo(-50, -6); ctx.fill(); // fin
    ctx.fillStyle = '#2a6fb0'; ctx.beginPath(); ctx.moveTo(42, -4); ctx.quadraticCurveTo(30, -12, 14, -7); ctx.lineTo(18, -3); ctx.fill(); // canopy
    ctx.restore();
  }
  function person(ctx, x, y, h, col, cap) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - h * 0.82, h * 0.11, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - h * 0.17, y); ctx.lineTo(x - h * 0.2, y - h * 0.62); ctx.quadraticCurveTo(x, y - h * 0.74, x + h * 0.2, y - h * 0.62); ctx.lineTo(x + h * 0.17, y); ctx.fill();
    if (cap) { ctx.fillRect(x - h * 0.13, y - h * 0.95, h * 0.26, h * 0.06); }
  }
  const DRAW = {
    pentagone(ctx, t) {
      copper(ctx, [[18, 24, 46], [52, 62, 92], [20, 22, 34]], 0, H);
      ctx.strokeStyle = 'rgba(200,210,235,0.25)'; ctx.lineWidth = 1;
      for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(W / 2, 150); ctx.lineTo(W / 2 + i * 120, H); ctx.stroke(); }
      for (let k = 0; k < 7; k++) { const y = 150 + Math.pow(1.6, k) * 6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = '#7b5a2c'; ctx.fillRect(170, 250, 300, 22); ctx.fillStyle = '#4e391b'; ctx.fillRect(180, 272, 12, 70); ctx.fillRect(448, 272, 12, 70);
      ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(W / 2, 90, 34, 0, 6.28); ctx.fill(); ctx.fillStyle = '#20293f'; ctx.font = 'bold 22px VT323, monospace'; ctx.textAlign = 'center'; ctx.fillText('US', W / 2, 98); ctx.textAlign = 'left';
      person(ctx, 250, 250, 120, '#1b2235', true); person(ctx, 420, 260 + Math.sin(t / 700) * 1.5, 130, '#2c3c22');
    },
    diapo(ctx, t) {
      ctx.fillStyle = '#05060b'; ctx.fillRect(0, 0, W, H);
      const beam = ctx.createLinearGradient(600, 380, 320, 160); beam.addColorStop(0, 'rgba(255,250,220,0.25)'); beam.addColorStop(1, 'rgba(255,250,220,0.02)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(610, 385); ctx.lineTo(110, 40); ctx.lineTo(530, 40); ctx.fill();
      ctx.fillStyle = '#e9ecef'; ctx.fillRect(110, 40, 420, 260);
      ctx.fillStyle = '#b3261e'; ctx.font = '22px VT323, monospace'; ctx.fillText('TOP SECRET', 410, 66);
      ctx.fillStyle = '#20232a'; ctx.font = '30px VT323, monospace'; ctx.fillText('F.49  -  EARTH CONTROL', 130, 70);
      f49(ctx, 320, 180 + Math.sin(t / 900) * 3, 2.3);
      ctx.strokeStyle = '#2a6fb0'; ctx.beginPath(); ctx.arc(470, 250, 26, 0, 6.28); ctx.stroke(); ctx.beginPath(); ctx.ellipse(470, 250, 40, 10, -0.4, 0, 6.28); ctx.stroke();
    },
    bureau(ctx, t) {
      copper(ctx, [[60, 52, 70], [120, 100, 90], [50, 40, 40]], 0, H);
      ctx.fillStyle = '#d8d0b8'; ctx.fillRect(60, 60, 140, 110); ctx.fillStyle = '#a99f86'; for (let i = 0; i < 6; i++) ctx.fillRect(72, 74 + i * 15, 116, 4);
      ctx.fillStyle = '#5b3d24'; ctx.fillRect(280, 260, 300, 20); ctx.fillStyle = '#2d2d33'; ctx.fillRect(360, 225, 80, 35);
      person(ctx, 400, 262, 120, '#7a2340'); person(ctx, 200, 330, 150, '#1b2235', true);
    },
    floride(ctx, t) {
      copper(ctx, [[30, 20, 70], [200, 70, 90], [255, 170, 90], [255, 220, 150]], 0, 250);
      ctx.fillStyle = '#ffde7a'; ctx.beginPath(); ctx.arc(470, 230, 46, 0, 6.28); ctx.fill();
      copper(ctx, [[40, 40, 60], [20, 20, 30]], 250, H, 10);
      ctx.fillStyle = '#152018'; for (let i = 0; i < 5; i++) { const x = 40 + i * 140; ctx.fillRect(x, 150, 6, 100); ctx.beginPath(); ctx.ellipse(x + 3, 150, 34, 10, 0.3, 0, 6.28); ctx.fill(); }
      const cx = ((t / 14) % 900) - 180; // the old Ford
      ctx.fillStyle = '#3a2f2a'; ctx.fillRect(cx, 300, 150, 30); ctx.fillRect(cx + 30, 280, 80, 24); ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx + 30, 332, 13, 0, 6.28); ctx.arc(cx + 120, 332, 13, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(200,190,170,0.4)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(cx - 10 - i * 12, 325 - i * 2, 4 + i * 2, 0, 6.28); ctx.stroke(); }
    },
    piste(ctx, t) {
      copper(ctx, [[120, 170, 230], [200, 220, 240], [250, 230, 200]], 0, 230);
      copper(ctx, [[110, 110, 105], [60, 60, 60]], 230, H, 10);
      ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 4; ctx.setLineDash([24, 18]); ctx.beginPath(); ctx.moveTo(W / 2, 232); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#d0d4da'; ctx.fillRect(40, 170, 120, 60); ctx.fillStyle = '#6b7380'; ctx.fillRect(80, 120, 30, 50);
      f49(ctx, 360, 300, 2.6);
      person(ctx, 160, 360, 90, '#2b3b55', true); person(ctx, 230, 365, 92, '#38442e');
    },
    decollage(ctx, t) {
      const k = Math.min(1, (t % 9000) / 9000);
      copper(ctx, [[40, 80, 170], [120, 170, 230], [250, 200, 140]], 0, H);
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(560, 120 + 40 * (1 - k), 40, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#3a4a3a'; ctx.fillRect(0, 330 + k * 60, W, 80);
      f49(ctx, 120 + k * 420, 300 - k * 230, 1.6 - k * 0.6, -0.35, 1);
    },
    espace(ctx, t) {
      ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
      stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${0.3 + s.s * 0.7})`; ctx.fillRect(s.x, s.y, 1 + s.s, 1 + s.s); });
      const g = ctx.createRadialGradient(W / 2, 760, 380, W / 2, 760, 470); g.addColorStop(0, '#1d5fa8'); g.addColorStop(0.92, '#6fb3ff'); g.addColorStop(1, 'rgba(111,179,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, 760, 470, 0, 6.28); ctx.fill();
      const alarm = (t % 900) < 450;
      f49(ctx, 330 + Math.sin(t / 60) * 6, 180 + Math.cos(t / 47) * 6, 1.8, Math.sin(t / 300) * 0.4, 0);
      if (alarm) { ctx.fillStyle = 'rgba(255,0,0,0.14)'; ctx.fillRect(0, 0, W, H); }
    }
  };

  const Intro = {
    running: false,
    async play(stage) {
      const V2 = window.AliveV2, Voice = window.AliveV2Voice, Music = window.AliveV2Music;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'intro-canvas';
      const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'intro-skip'; skip.textContent = 'Passer l\'introduction ▸▸';
      stage.appendChild(cv); stage.appendChild(skip);
      const ctx = cv.getContext('2d');
      this.running = true;
      let scene = SCENES[0], caption = null, who = '', t0 = performance.now(), flash = 0, stop = false, advance = null;
      const nextLine = () => { if (advance) { const a = advance; advance = null; a(); } };
      const onKey = e => { if (e.key === 'Escape') { stop = true; nextLine(); } else if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) { e.preventDefault(); nextLine(); } };
      cv.onclick = nextLine; skip.onclick = () => { stop = true; nextLine(); };
      document.addEventListener('keydown', onKey, true);
      if (Music) Music.playTitle();
      const NAMES = { general: 'Général Blakes', james: 'James Butterfly', bonnie: 'Bonnie', gilmore: 'Jack T. Gilmore', clarck: 'Stan R. Clarck', radio: 'Tour de contrôle' };
      const loop = () => {
        if (!this.running) return;
        const t = performance.now() - t0;
        ctx.save();
        if (scene.draw === 'espace' && t > 2500) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
        DRAW[scene.draw](ctx, t); ctx.restore();
        if (caption) {
          ctx.fillStyle = 'rgba(4,6,16,0.78)'; ctx.fillRect(0, H - 96, W, 96);
          ctx.fillStyle = '#ffcf5a'; ctx.font = '22px VT323, monospace'; if (NAMES[who]) ctx.fillText(NAMES[who], 18, H - 74);
          ctx.fillStyle = '#f2f5ff'; ctx.font = '24px VT323, monospace';
          wrap(ctx, caption, NAMES[who] ? H - 48 : H - 66, who === 'narrateur');
        }
        if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); flash = Math.max(0, flash - 0.02); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      for (const sc of SCENES) {
        if (stop) break;
        scene = sc; t0 = performance.now(); if (V2 && sc.draw === 'espace') V2.shake && 0;
        for (const [w, line] of sc.lines) {
          if (stop) break;
          who = w; caption = line;
          const wait = new Promise(res => {
            advance = res;
            const u = Voice && Voice.enabled ? Voice.say(line, w) : null;
            const min = Math.max(2600, line.length * 62);
            if (u) { let done = false; u.onend = () => { if (!done) { done = true; setTimeout(() => { if (advance === res) nextLine(); }, 500); } }; setTimeout(() => { if (!done && advance === res) nextLine(); }, min * 2.2); }
            else setTimeout(() => { if (advance === res) nextLine(); }, min);
          });
          await wait;
          if (Voice) Voice.stop();
        }
      }
      if (!stop) { flash = 1; caption = null; await new Promise(r => setTimeout(r, 1600)); }
      this.running = false;
      document.removeEventListener('keydown', onKey, true);
      if (Voice) Voice.stop();
      if (Music) Music.stop();
      cv.remove(); skip.remove();
    }
  };
  function wrap(ctx, text, y, italic) {
    const words = text.split(' '); let line = '', yy = y;
    ctx.font = (italic ? 'italic ' : '') + '24px VT323, monospace';
    for (const w of words) {
      const tryL = line ? line + ' ' + w : w;
      if (ctx.measureText(tryL).width > W - 36) { ctx.fillText(line, 18, yy); line = w; yy += 24; } else line = tryL;
    }
    if (line) ctx.fillText(line, 18, yy);
  }
  window.AliveV2Intro = Intro;
})();
