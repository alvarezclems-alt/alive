/* ALIVE V2 - amiga.js : "32-bit Amiga" presentation of the same game.
 * The game logic and the original pictures are unchanged ; only the way they are shown differs :
 *  - EPX smoothing of the 320x200 picture (2x), softer AGA-like palette, copper-style vertical shading,
 *    ordered dithering instead of flat CPC colours ; a steel-blue bevelled interface ;
 *  - animations : crossfade between views, weather particles per world, colour cycling on water,
 *    screen shake ; readable text with French accents restored.
 */
(function () {
  'use strict';
  const PAL = window.CPC.PALETTE;
  const V2 = { on: false, t0: performance.now(), shakeUntil: 0, shakeAmp: 0, particles: [], prev: null, fadeStart: 0, world: 1, code: 0 };

  /* softer, AGA-like version of a CPC ink : less saturation, warm shadows, cool highlights */
  function soften(rgb) {
    let r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    r = r * 0.8 + l * 0.2; g = g * 0.8 + l * 0.2; b = b * 0.8 + l * 0.2;
    if (l < 90) { r += 10; g += 4; b += 14; } else if (l > 170) { b += 8; }
    return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
  }
  const STEEL = [[14, 18, 34], [58, 74, 103], [184, 199, 218], [111, 134, 166]]; // interface frame pens 0..3
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v / 16 - 0.5) * 10);

  const base = document.createElement('canvas'); base.width = 640; base.height = 400;
  const bctx = base.getContext('2d');
  const prevCanvas = document.createElement('canvas'); prevCanvas.width = 640; prevCanvas.height = 400;
  let img = null, lastKey = '';
  /* V3 : where the 3D view may show (the picture area, minus the windows and menus opened over it) */
  const mask = document.createElement('canvas'); mask.width = 464; mask.height = 286;
  const mctx = mask.getContext('2d'); let mimg = null;
  const comp = document.createElement('canvas'); comp.width = 928; comp.height = 572;
  const cctx = comp.getContext('2d');

  const inScene = (x, y) => x >= 4 && x < 236 && y >= 14 && y < 157;
  const inTextBox = (x, y) => y >= 160 && y < 192 && x >= 8 && x < 280;

  /* EPX / Scale2x : 2x2 output pens for each source pen */
  function epx(p, x, y) {
    const P = p[y * 320 + x];
    const A = y > 0 ? p[(y - 1) * 320 + x] : P, D = y < 199 ? p[(y + 1) * 320 + x] : P;
    const C = x > 0 ? p[y * 320 + x - 1] : P, B = x < 319 ? p[y * 320 + x + 1] : P;
    return [C === A && C !== D && A !== B ? A : P, A === B && A !== C && B !== D ? B : P,
      D === C && D !== B && C !== A ? C : P, B === D && B !== A && D !== C ? D : P];
  }

  function cycleShift(t) { return Math.sin(t / 380) * 0.5 + 0.5; }

  /* Repainted backgrounds (assets/v2/manifest.json lists them, e.g. "D1_ALIVE2.png").
     A repainted picture replaces the original one ; menus and windows drawn over the picture stay on top,
     because the painting is only shown where the screen still holds the original picture. */
  const PAINTED = {};
  V2.painted = PAINTED;
  function loadPaintings() {
    fetch('assets/v2/manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).then(list => {
      (list || []).forEach(file => {
        const im = new Image();
        im.onload = () => {
          try {
            const c = document.createElement('canvas'); c.width = 464; c.height = 286;
            const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, 464, 286);
            PAINTED[file.replace(/\.[a-z]+$/i, '').replace('_', '/')] = x.getImageData(0, 0, 464, 286).data;
            V2.dirtyAll = true;
          } catch (e) { /* file:// : the browser refuses to read the pixels, the automatic rendering stays */ }
        };
        im.src = 'assets/v2/' + file;
      });
    }).catch(() => {});
  }
  loadPaintings();

  function buildBase(screen, t) {
    if (!img) img = bctx.createImageData(640, 400);
    const d = img.data, p = screen.pens;
    const ls = screen.lastScene, paint = V2.usePaintings !== false && ls && PAINTED[ls.name];
    const sc = screen.inks.map(n => soften(PAL[n]));
    const water = V2.waterPen; // colour cycling on the water pen of lake / river views
    const wv = cycleShift(t);
    if (!mimg) mimg = mctx.createImageData(464, 286);
    const md = mimg.data, V3 = window.AliveV3, full = !!(V3 && V3.fullMask);
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x < 320; x++) {
        const q = epx(p, x, y), scene = inScene(x, y), frame = screen.framed && !scene && !inTextBox(x, y);
        if (scene) {
          const show = !screen.covered[y * 320 + x] && (full || (ls && p[y * 320 + x] === ls.pens[(y - 14) * 232 + (x - 4)])) ? 255 : 0;
          const mo = ((y - 14) * 2 * 464 + (x - 4) * 2) * 4 + 3;
          md[mo] = md[mo + 4] = md[mo + 464 * 4] = md[mo + 464 * 4 + 4] = show;
        }
        for (let k = 0; k < 4; k++) {
          const ox = x * 2 + (k & 1), oy = y * 2 + (k >> 1), pen = q[k];
          let c;
          if (scene && paint && !screen.covered[y * 320 + x] && p[y * 320 + x] === ls.pens[(y - 14) * 232 + (x - 4)]) {
            const pi = ((oy - 28) * 464 + (ox - 8)) * 4;
            c = [paint[pi], paint[pi + 1], paint[pi + 2]];
          } else if (scene || (!frame)) {
            c = sc[pen];
            if (scene) {
              const f = 1.1 - ((oy - 28) / 286) * 0.22; // copper-like vertical shading
              const dith = BAYER[(oy & 3) * 4 + (ox & 3)];
              let m = f;
              if (water != null && pen === water && oy > 150) m *= 0.9 + 0.2 * Math.sin(ox / 23 + oy / 9 + wv * 6.28);
              c = [c[0] * m + dith, c[1] * m + dith, c[2] * m + dith * 1.2];
            }
          } else {
            const s = STEEL[pen], bev = 1.08 - (oy % 46) / 46 * 0.16 + BAYER[(oy & 3) * 4 + (ox & 3)] * 0.004;
            c = [s[0] * bev, s[1] * bev, s[2] * bev];
          }
          const o = (oy * 640 + ox) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
    }
    bctx.putImageData(img, 0, 0);
    mctx.putImageData(mimg, 0, 0);
    // soft vignette inside the picture
    const gr = bctx.createRadialGradient(240, 170, 60, 240, 170, 300);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,20,0.35)');
    bctx.fillStyle = gr; bctx.fillRect(8, 28, 464, 286);
  }

  /* accents restored for display (same length, so the CPC layout is unchanged) */
  const WORDS = { epave: 'épave', foret: 'forêt', etes: 'êtes', desert: 'désert', region: 'région', precipice: 'précipice', etrange: 'étrange', brisee: 'brisée', interessant: 'intéressant', delirez: 'délirez', tres: 'très', prophetie: 'prophétie', envoye: 'envoyé', detronera: 'détrônera', liberera: 'libérera', pere: 'père', mere: 'mère', ecrase: 'écrasé', prete: 'prête', entree: 'entrée', deja: 'déjà', epreuve: 'épreuve', decu: 'déçu', decus: 'déçus', celebre: 'célèbre', resistance: 'résistance', reveler: 'révéler', ecoutee: 'écoutée', emissaires: 'émissaires', sagacite: 'sagacité', generateur: 'générateur', piece: 'pièce', reponds: 'réponds', enigme: 'énigme', detruit: 'détruit', enleve: 'enlève', eleve: 'élevé', radioactivite: 'radioactivité', parait: 'paraît', riviere: 'rivière', decouvrez: 'découvrez', epee: 'épée', fumee: 'fumée', respiree: 'respirée', somnifere: 'somnifère', reussi: 'réussi', bientot: 'bientôt', ete: 'été', detruites: 'détruites', decide: 'décidé', derriere: 'derrière', etendue: 'étendue', numerote: 'numérote', mechant: 'méchant', tete: 'tête', etre: 'être', dejeuner: 'déjeuner', gouts: 'goûts', beaute: 'beauté', ame: 'âme', ca: 'ça', voila: 'voilà', apres: 'après', pres: 'près', ecoute: 'écoute', heros: 'héros', debile: 'débile', fache: 'fâche', geole: 'geôle', magnetiques: 'magnétiques', medicinale: 'médicinale', pepite: 'pépite', detonateur: 'détonateur', helas: 'hélas', decedez: 'décédez', cite: 'cité', repondre: 'répondre', repeter: 'répéter', qualite: 'qualité', meme: 'même', derniere: 'dernière', siecles: 'siècles', aneanties: 'anéanties', reveillez: 'réveillez', trepane: 'trépané', plenitude: 'plénitude', aseptise: 'aseptisé', operationnel: 'opérationnel', programmees: 'programmées', annee: 'année', glaces: 'glaces', reine: 'reine', village: 'village', elu: 'élu', reconnaitras: 'reconnaîtras', connaitre: 'connaître', recu: 'reçu', securite: 'sécurité', francais: 'français', dessinee: 'dessinée', eclaire: 'éclaire', repaire: 'repaire', recouvert: 'recouvert', reveiller: 'réveiller', mele: 'mêlé', necessaire: 'nécessaire', deflagrations: 'déflagrations', posee: 'posée', ecroule: 'écroule', ecroulee: 'écroulée', ecrouler: 'écrouler', derobe: 'dérobe', vetuste: 'vétuste', defile: 'défile', espece: 'espèce', zele: 'zèle', interdite: 'interdite', deesse: 'déesse', esperance: 'espérance', reflete: 'reflète', cataclysme: 'cataclysme', annees: 'années', reduit: 'réduit', neant: 'néant', regrouper: 'regrouper', imposee: 'imposée', inhumain: 'inhumain', asservis: 'asservis', lueur: 'lueur', reussiras: 'réussiras', glaive: 'glaive', tue: 'tue', etait: 'était', ecoutez: 'écoutez', fidele: 'fidèle', regle: 'règle', vehicule: 'véhicule', ecoeurant: 'écœurant' };
  const PHRASES = [['lacs glaces', 'lacs glacés'], ['Ou suis-je', 'Où suis-je'], ['a vos', 'à vos'], ['a perte', 'à perte'], ['a l\'eau', 'à l\'eau'], ['a jamais', 'à jamais'], ['a cote', 'à côté'], ['a la votre', 'à la vôtre'], ['A la votre', 'À la vôtre'], ['a toi', 'à toi'], ['a moi', 'à moi'], ['a mon', 'à mon'], ['a ma', 'à ma'], ['a son', 'à son'], ['a sa', 'à sa'], ['a ton', 'à ton'], ['a ta', 'à ta'], ['a tous', 'à tous'], ['a lui', 'à lui'], ['a qui', 'à qui'], ['A qui', 'À qui'], ['a la ', 'à la '], ['a manger', 'à manger'], ['a boire', 'à boire'], ['a dire', 'à dire'], ['a menacer', 'à menacer'], ['a dejeuner', 'à déjeuner'], ['a cuire', 'à cuire'], ['a croire', 'à croire'], ['a present', 'à présent'], ['a tenir', 'à tenir'], ['ou la ', 'où la '], ['ou aller', 'où aller'], ['ou je', 'où je']];
  function accent(line) {
    let s = line;
    PHRASES.forEach(([a, b]) => { s = s.split(a).join(b); });
    return s.replace(/[A-Za-z]+/g, w => {
      const low = w.toLowerCase(), r = WORDS[low];
      if (!r) return w;
      if (w === w.toUpperCase() && w.length > 1) return r.toUpperCase();
      if (w[0] === w[0].toUpperCase()) return r[0].toUpperCase() + r.slice(1);
      return r;
    });
  }
  V2.accent = accent;

  /* ---------------- particles per world ---------------- */
  function spawn(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: 8 + Math.random() * 464, y: 28 + Math.random() * 286, v: 0.3 + Math.random() * 0.9, s: Math.random(), ph: Math.random() * 6.28 });
    return out;
  }
  V2.particles = spawn(70);
  const INDOOR_SCENES = new Set(['D1/ALIV21', 'D2/ALIV41', 'D2/ALIV37', 'D2/ALIV39', 'D2/ALIV42', 'D2/ALIV40']); // council, bar, generator, Necarex, ruined interior, old man
  function drawParticles(ctx, t, screen) {
    if (V2.noFx) return;
    const w = V2.world, outdoor = V2.outdoor && !(screen && screen.lastScene && INDOOR_SCENES.has(screen.lastScene.name));
    if (!outdoor) return;
    ctx.save(); ctx.beginPath(); ctx.rect(8, 28, 464, 286); ctx.clip();
    for (const p of V2.particles) {
      if (w === 1) { // snow
        p.y += p.v * 0.9; p.x += Math.sin(t / 900 + p.ph) * 0.35;
        ctx.fillStyle = `rgba(240,248,255,${0.5 + p.s * 0.5})`; ctx.fillRect(p.x, p.y, 1.5 + p.s * 2, 1.5 + p.s * 2);
      } else if (w === 2) { // fireflies / spores in the marshes and the jungle
        p.x += Math.sin(t / 1300 + p.ph) * 0.4; p.y += Math.cos(t / 1700 + p.ph) * 0.3 - 0.05;
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(t / 400 + p.ph * 3));
        ctx.fillStyle = `rgba(214,255,140,${a * 0.8})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.2 + p.s * 1.4, 0, 6.28); ctx.fill();
      } else { // ash and dust over New York
        p.y += p.v * 0.35; p.x += Math.sin(t / 2000 + p.ph) * 0.5 + 0.15;
        ctx.fillStyle = `rgba(190,180,170,${0.25 + p.s * 0.35})`; ctx.fillRect(p.x, p.y, 1 + p.s * 1.5, 1 + p.s * 1.5);
      }
      if (p.y > 316) { p.y = 26; p.x = 8 + Math.random() * 464; }
      if (p.y < 26) p.y = 314;
      if (p.x > 474) p.x = 8; if (p.x < 6) p.x = 472;
    }
    ctx.restore();
  }

  /* ---------------- per frame ---------------- */
  V2.render = function (screen) {
    const t = performance.now();
    const ctx = screen.ctx;
    const ks = screen.canvas.width / 640; ctx.setTransform(ks, 0, 0, ks, 0, 0); // V3 : 2x canvas for a sharp 3D view
    const key = screen.inks.join(',') + ':' + screen.version + (V2.waterPen != null ? ':' + Math.floor(t / 90) : '');
    if (key !== lastKey || screen.dirty || V2.dirtyAll) { buildBase(screen, t); lastKey = key; screen.dirty = false; V2.dirtyAll = false; }
    let sx = 0, sy = 0;
    if (t < V2.shakeUntil) { sx = (Math.random() - 0.5) * V2.shakeAmp; sy = (Math.random() - 0.5) * V2.shakeAmp; }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 400);
    ctx.drawImage(base, sx, sy);
    const V3 = window.AliveV3, threeD = V3 && V3.active && V3.active(screen) && V3.renderFrame();
    if (threeD) { // the 3D view, cut out where windows and menus cover the picture
      cctx.globalCompositeOperation = 'copy'; cctx.drawImage(V3.canvas, 0, 0);
      cctx.globalCompositeOperation = 'destination-in'; cctx.imageSmoothingEnabled = false; cctx.drawImage(mask, 0, 0, 928, 572);
      cctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(comp, 8 + sx, 28 + sy, 464, 286);
      const gr = ctx.createRadialGradient(240, 170, 80, 240, 170, 300);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,20,0.28)');
      ctx.fillStyle = gr; ctx.fillRect(8, 28, 464, 286);
      if (V3.drawHud) V3.drawHud(ctx); // modern controls : compass, sight, prompts
    }
    if (!threeD && V2.fadeStart && t - V2.fadeStart < 420) { // crossfade from the previous picture
      ctx.save(); ctx.globalAlpha = 1 - (t - V2.fadeStart) / 420; ctx.beginPath(); ctx.rect(8, 28, 464, 286); ctx.clip();
      ctx.drawImage(prevCanvas, sx, sy); ctx.restore();
    }
    if (!threeD) drawParticles(ctx, t, screen);
    // text (readable font, accents)
    ctx.font = '20px "VT323", "Courier New", monospace'; ctx.textBaseline = 'top';
    for (let r = 0; r < 25; r++) {
      let chars = '', any = false;
      for (let c = 0; c < 40; c++) { const ce = screen.text[r][c]; chars += ce ? ce.ch : ' '; if (ce) any = true; }
      if (!any) continue;
      const shown = accent(chars);
      for (let c = 0; c < 40; c++) {
        const ce = screen.text[r][c];
        if (!ce || ce.ch === ' ') continue;
        const inv = ce.paper !== 0;
        if (inv) { ctx.fillStyle = '#ffcf5a'; ctx.fillRect(c * 16 + sx, r * 16 + sy, 16, 16); }
        ctx.fillStyle = inv ? '#141a2c' : (r >= 20 ? '#f2f5ff' : '#ffe9a8');
        ctx.fillText(shown[c], c * 16 + 2 + sx, r * 16 - 1 + sy);
      }
    }
    if (screen.overlay) screen.overlay(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  V2.onScene = function (screen) { // a new picture : remember the old one for the crossfade
    if (!V2.on) return;
    prevCanvas.getContext('2d').drawImage(base, 0, 0);
    V2.fadeStart = performance.now();
  };
  V2.shake = function (ms = 400, amp = 8) { V2.shakeUntil = performance.now() + ms; V2.shakeAmp = amp; };
  V2.setView = function (world, code, outdoor, waterPen) { V2.world = world; V2.code = code; V2.outdoor = outdoor; V2.waterPen = waterPen; };
  window.AliveV2 = V2;
})();
