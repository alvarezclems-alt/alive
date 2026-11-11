/* ALIVE - Web port. main.js : game flow (title -> game -> death / end of world) and HTML interface. */
(function () {
  'use strict';
  const { Game, DIR_NAME } = window.AliveEngine;
  const Rules = window.AliveRules;
  const $ = s => document.querySelector(s);

  const canvas = $('#screen');
  const ui = {
    mode: 'none', items: [],
    setMode(mode, extra) { this.mode = mode; this.items = (extra && extra.items) || []; renderControls(); if (mode !== 'none') renderStatus(); }
  };
  const g = new Game(canvas, {
    mode: (m, e) => ui.setMode(m, e),
    status: () => renderStatus(),
    view: (game, v) => v2View(game, v),
    line: text => v2Line(text),
    sfx: name => v2Fx(name),
    blocked: () => { flashMsg('Quelqu\'un vous fait face : utilisez D (dialogue) ou C (combat).'); }
  });
  (window.ALIVE_WORLDS || []).forEach(w => g.registerWorld(w));
  window.aliveGame = g; // used by tests/

  // options (modern conveniences, stored per browser)
  try { Object.assign(g.options, JSON.parse(localStorage.getItem('alive-port-1991.options') || '{}')); } catch (e) { /* defaults */ }
  const saveOptions = () => { try { localStorage.setItem('alive-port-1991.options', JSON.stringify(g.options)); } catch (e) { /* ignore */ } };

  g.restoreScreen = function () { Rules.drawFrame(g); g.drawView(); };

  /* ------------------------------ flow ------------------------------ */
  async function titleScreen() {
    g.st = null;
    Rules.drawTitle(g);
    if (isV2()) { if (g.options.music !== false && window.AliveV2Music) window.AliveV2Music.playTitle(); } else Rules.Music.play();
    renderStatus();
    await g.waitKey();
    Rules.Music.stop(); if (window.AliveV2Music) window.AliveV2Music.stop();
  }
  async function startNew() {
    g.st = g.newState(1);
    Rules.drawFrame(g);
    g.screen.setInks(...g.st.inks);
    await g.showView();
  }
  const ICON_MENUS = {
    C: [['Combattre', 'combattre'], ['Menacer', 'menacer']],
    P: [['Prendre', 'prendre'], ['Deposer', 'deposer'], ['Inventaire', 'inventaire'], ['Repos', 'repos'], ['Boire', 'boire'], ['Manger', 'manger']],
    U: [['Tenir', 'tenir'], ['Offrir', 'offrir'], ['Utiliser', 'utiliser'], ['Soigner', 'soigner']],
    EYE: [['Voir', 'voir'], ['Lire', 'lire'], ['Physique', 'physique'], ['Fichier', 'fichier']]
  };
  async function icon(id) {
    g.flashIcon(id);
    const dirs = { N: 0, W: 1, S: 2, E: 3 };
    if (id in dirs) { await g.direction(dirs[id]); return null; }
    if (id === 'D') {
      g.inDialogue = true; g.speaker = speakerAt(g);
      try { return await g.world.dialogue(g); } finally { g.inDialogue = false; }
    }
    const m = ICON_MENUS[id];
    const items = m.map(x => x[0]).concat('Retour');
    const a = await g.menu(items, 19, 3, 10);
    if (a === items.length) { g.drawView(); return null; }
    g.drawView();
    const verb = m[a - 1][1];
    if (verb === 'offrir') return await Rules.verbs.deposer(g, true);
    return await Rules.verbs[verb](g);
  }
  g.events = [];
  async function death() {
    const st = g.st;
    g.events.push('death:' + st.dead);
    if (st.dead === 'stats') { // OPTIONS.BAS 60000
      g.cls(33);
      if (st.faim === 0) g.out('Regime alimentaire trop strict !Vous mourez de faim...');
      else if (st.vigil === 0) g.out("Vous mourez d'epuisement...");
      else g.out('Vous devriez boire un petit     coup...RECTIFICATION:vous AURIEZdu,maintenant c\'est trop tard...');
    }
    if (st.dead !== 'story') await g.waitKey();
    if (st.dead !== 'fall') g.sfx('death');
    Rules.drawDeathArt(g);
    await g.pause(2200);
    Rules.drawFrame(g); g.screen.setInks(6, 6, 3); // ALIVE.BAS 700
    const t = new window.CPC.Win(g.screen, 1, 40, 1, 25);
    t.locate(2, 21); t.print("Butterfly,dur a cuire ?"); t.locate(2, 22); t.print('Dur a croire !');
    g.st = null; renderStatus();
    await g.waitKey();
  }
  async function worldEnd() {
    g.events.push('world-end:' + g.st.world);
    const big = g.bigWindow();
    const n = g.st.world, roman = ['', 'I', 'II', 'III', 'IV'][n];
    await g.bp(big, ''); await g.bp(big, '     FIN DU MONDE ' + roman); await g.bp(big, '');
    await g.bp(big, ' (Le Monde ' + ['', 'I', 'II', 'III', 'IV'][n + 1] + ' est en cours de portage : la suite arrive dans une prochaine version.)');
    try { localStorage.setItem('alive-port-1991.world' + n + '-complete', JSON.stringify(Object.assign({ at: new Date().toISOString() }, g.st))); } catch (e) { /* ignore */ }
    await g.waitKey();
    g.st = null;
  }
  async function play(skipTitle) {
    for (;;) {
      if (!g.st) { if (!skipTitle) await titleScreen(); skipTitle = false; await startNew(); }
      const ev = await g.command();
      let r = null;
      if (ev.type === 'dir') await g.direction(ev.dir);
      else if (ev.type === 'walk') await g.walk(ev.dir);
      else if (ev.type === 'look') await g.look(ev.dir);
      else r = await icon(ev.icon);
      if (g.st && !g.st.dead && r === 'victory') {
        g.events.push('victory'); await Rules.victory(g); await g.waitKey(); g.st = null; continue;
      }
      if (g.st && !g.st.dead && r === 'world-end') {
        const next = g.st.world + 1;
        if (g.worlds[next]) { // no disk to turn over : straight into the next world
          g.events.push('world-end:' + g.st.world);
          g.sfx('world'); g.enterWorld(next); g.restoreScreen(); g.cls(34); await g.showView(); renderStatus();
          continue;
        }
        await worldEnd(); continue;
      }
      if (g.st && !g.st.dead && (r === 'wait' || r === 'nowait')) {
        if (r === 'wait') await g.waitKey();
        g.cls(34); await g.showView();
      }
      if (g.st && g.st.dead) await death();
      renderStatus();
    }
  }
  g.loadAndPlay = function (n) { // from the HTML panel
    const st = g.loadSlot(n);
    if (!st) return false;
    g.st = st; g.restoreScreen(); g.cls(34); g.showView(); renderStatus();
    return true;
  };

  /* ------------------------------ input ------------------------------ */
  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * 640 / r.width, y: (e.clientY - r.top) * 400 / r.height };
  }
  canvas.addEventListener('click', e => {
    if (window.AliveV3 && window.AliveV3.free && window.AliveV3.free.dragMoved) { window.AliveV3.free.dragMoved = false; return; } // it was a drag to look around
    const p = canvasPoint(e);
    const id = g.iconAt(p.x, p.y);
    if (ui.mode === 'command' && id) g.dispatch({ type: 'icon', icon: id });
    else g.dispatch({ type: 'click', x: p.x, y: p.y });
  });
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'z', 'q', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'];
  const freeOn = () => window.AliveV3 && window.AliveV3.isFree && window.AliveV3.isFree();
  document.addEventListener('keyup', e => { if (window.AliveV3 && window.AliveV3.key) window.AliveV3.key(e.key, false); });
  window.addEventListener('blur', () => { if (window.AliveV3 && window.AliveV3.free) window.AliveV3.free.keys = {}; });
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('dialog, input, select, textarea')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (freeOn() && (ui.mode === 'command' || ui.mode === 'continue')) { // modern controls (V3)
      const kk = k.length === 1 ? k.toLowerCase() : k;
      if (MOVE_KEYS.includes(kk)) { e.preventDefault(); window.AliveV3.key(k, true); return; }
      if (ui.mode === 'command' && kk === 'e') { g.dispatch({ type: 'icon', icon: 'D' }); return; }
      if (ui.mode === 'command' && kk === 'f') { g.dispatch({ type: 'icon', icon: 'C' }); return; }
    }
    const dirs = { ArrowUp: 0, ArrowLeft: 1, ArrowDown: 2, ArrowRight: 3 };
    if (k in dirs) { e.preventDefault(); g.dispatch({ type: 'dir', dir: dirs[k] }); return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); g.dispatch({ type: ui.mode === 'continue' ? 'continue' : 'select', key: k }); return; }
    if (ui.mode === 'input') {
      if (k === 'Enter') { e.preventDefault(); g.dispatch({ type: 'submit' }); }
      else if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); g.dispatch({ type: 'backspace' }); }
      else if (k.length === 1) { e.preventDefault(); g.dispatch({ type: 'char', ch: k }); }
      return;
    }
    if (k === 'Escape') { g.dispatch({ type: 'cancel' }); return; }
    if (/^[1-9]$/.test(k) && (ui.mode === 'menu' || ui.mode === 'choice')) { g.dispatch({ type: 'pick', index: +k }); return; }
    const icons = { c: 'C', p: 'P', u: 'U', d: 'D', v: 'EYE', o: 'EYE' };
    if (ui.mode === 'command' && icons[k.toLowerCase()]) { g.dispatch({ type: 'icon', icon: icons[k.toLowerCase()] }); return; }
    if (ui.mode === 'continue') g.dispatch({ type: 'key', key: k });
  });

  /* ------------------------------ HTML panel ------------------------------ */
  function renderControls() {
    const box = $('#contextual');
    box.replaceChildren();
    const btn = (label, ev, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = () => g.dispatch(ev); box.appendChild(b); return b; };
    if (ui.mode === 'continue') { btn('Continuer ▸', { type: 'continue' }, 'primary wide'); }
    else if (ui.mode === 'input') {
      const inp = document.createElement('input'); inp.type = 'text'; inp.id = 'answer'; inp.maxLength = 14; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', 'Votre réponse'); inp.placeholder = 'Votre réponse';
      inp.oninput = () => g.dispatch({ type: 'set', text: inp.value });
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); g.dispatch({ type: 'submit', text: inp.value }); } };
      box.appendChild(inp);
      btn('Valider', { type: 'submit' }, 'primary');
    }
    else if (ui.mode === 'menu' || ui.mode === 'choice') ui.items.forEach((it, i) => btn(it.trim(), { type: 'pick', index: i + 1 }, 'pickbtn'));
    document.body.dataset.mode = ui.mode;
    const cmd = ui.mode === 'command';
    document.querySelectorAll('[data-icon]').forEach(b => { b.disabled = !cmd; });
    document.querySelectorAll('[data-dir]').forEach(b => { b.disabled = ui.mode === 'none'; });
    $('#hint').textContent = ui.mode === 'input' ? 'Tapez votre réponse puis Entrée.' : ui.mode === 'continue' ? 'Appuyez sur une touche, touchez l\'écran ou « Continuer ».'
      : ui.mode === 'menu' ? 'Choisissez avec ↑ ↓ puis Entrée, ou touchez une option.'
        : ui.mode === 'choice' ? 'Choisissez avec ← → puis Entrée, ou touchez une option.'
          : cmd ? (g.st && g.st.enc ? (freeOn() ? 'Une rencontre bloque le passage : E = parler, F = combattre.' : 'Une rencontre bloque le passage : D = dialoguer, C = combattre.')
            : freeOn() ? 'ZQSD / WASD ou flèches : marcher · souris ou doigt : regarder · Maj : courir · E parler · F combattre · P U V : icônes.'
              : 'Flèches : se tourner puis avancer. C · P · U · D · V(œil) : icônes.') : '';
  }
  function renderStatus() {
    const st = g.st;
    const panel = $('#status');
    if (!st) { panel.classList.add('empty'); return; }
    panel.classList.remove('empty');
    const bar = (id, v, max) => { const el = $(id); el.style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; el.parentElement.title = v + ' / ' + max; el.parentElement.setAttribute('aria-valuenow', v); };
    bar('#b-force', st.force, 10); bar('#b-vigil', st.vigil, 50); bar('#b-faim', st.faim, 50); bar('#b-soif', st.soif, 40);
    $('#where').textContent = 'Case ' + st.pos + ' · face au ' + DIR_NAME[st.dir] + ' · ' + st.steps + ' actions';
    const inv = $('#inv'); inv.replaceChildren();
    st.inv.forEach(o => { const li = document.createElement('li'); li.textContent = Rules.objName(o) + (o === st.hand ? '  ← en main' : ''); inv.appendChild(li); });
    if (st.piles) { const li = document.createElement('li'); li.textContent = st.piles + ' pile(s)'; inv.appendChild(li); }
    if (st.credits) { const li = document.createElement('li'); li.textContent = st.credits * 100 + ' Necacredits'; inv.appendChild(li); }
    if (!st.inv.length) inv.innerHTML = '<li>(rien)</li>';
    drawAutomap();
  }
  function drawAutomap() {
    const c = $('#automap'), ctx = c.getContext('2d'), st = g.st;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!st || !g.options.automap) { c.hidden = true; return; }
    c.hidden = false;
    const cs = 16;
    for (let cell = 0; cell < 99; cell++) {
      const col = cell % 9, row = Math.floor(cell / 9), x = col * cs, y = (10 - row) * cs;
      const passable = [0, 1, 2, 3].some(L => st.map[L][cell] !== 0);
      if (!st.visited[cell]) { if (passable) { ctx.fillStyle = '#20304a'; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2); } continue; }
      ctx.fillStyle = '#7fd7e8'; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
    }
    const col = st.pos % 9, row = Math.floor(st.pos / 9), x = col * cs + cs / 2, y = (10 - row) * cs + cs / 2;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath();
    const a = [-Math.PI / 2, Math.PI, Math.PI / 2, 0][st.dir];
    ctx.moveTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
    ctx.lineTo(x + Math.cos(a + 2.4) * 6, y + Math.sin(a + 2.4) * 6);
    ctx.lineTo(x + Math.cos(a - 2.4) * 6, y + Math.sin(a - 2.4) * 6); ctx.fill();
  }
  let flashTimer;
  function flashMsg(m) { const h = $('#hint'); h.textContent = m; h.classList.add('warn'); clearTimeout(flashTimer); flashTimer = setTimeout(() => { h.classList.remove('warn'); renderControls(); }, 2500); }

  const PAD_KEY = { 0: 'ArrowUp', 1: 'ArrowLeft', 2: 'ArrowDown', 3: 'ArrowRight' };
  document.querySelectorAll('[data-dir]').forEach(b => {
    b.addEventListener('click', () => { if (!freeOn()) g.dispatch({ type: 'dir', dir: +b.dataset.dir }); });
    const hold = down => { if (freeOn()) window.AliveV3.key(PAD_KEY[+b.dataset.dir], down); };
    b.addEventListener('pointerdown', () => hold(true)); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => hold(false)));
  });
  document.querySelectorAll('[data-icon]').forEach(b => b.addEventListener('click', () => g.dispatch({ type: 'icon', icon: b.dataset.icon })));

  // text window mirror for screen readers
  let lastText = '';
  setInterval(() => {
    const rows = [];
    for (let r = 20; r < 24; r++) rows.push(g.screen.text[r].map(c => (c ? c.ch : ' ')).join('').trim());
    const txt = rows.filter(Boolean).join('\n');
    if (txt !== lastText) { lastText = txt; $('#log').textContent = txt; }
  }, 300);

  // settings
  const of = $('#opt-sfx');
  if (window.AliveSound) {
    window.AliveSound.enabled = g.options.sfx !== false; of.checked = window.AliveSound.enabled;
    of.onchange = () => { g.options.sfx = window.AliveSound.enabled = of.checked; saveOptions(); if (of.checked) window.AliveSound.play('select'); };
  }
  const om = $('#opt-move'), os = $('#opt-survival'), oa = $('#opt-automap'), ou = $('#opt-music');
  if (g.options.automap === undefined) g.options.automap = true;
  om.value = g.options.moveMode; os.value = g.options.survival; oa.checked = !!g.options.automap; ou.checked = Rules.Music.enabled = g.options.music !== false;
  om.onchange = () => { g.options.moveMode = om.value; saveOptions(); };
  os.onchange = () => { g.options.survival = os.value; saveOptions(); };
  oa.onchange = () => { g.options.automap = oa.checked; saveOptions(); renderStatus(); };
  ou.onchange = () => { g.options.music = Rules.Music.enabled = ou.checked; if (!ou.checked) Rules.Music.stop(); saveOptions(); };
  $('#btn-fullscreen').onclick = () => { const el = $('#stage'); (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen()); };

  // the CPC-like font may arrive after the first frame
  if (document.fonts) document.fonts.ready.then(() => { g.screen.dirty = true; });
  document.fonts && document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { g.screen.dirty = true; });

  // "Recommencer" : a new game at once (the saves are kept)
  const dlg = $('#confirm-reset');
  $('#btn-reset').onclick = () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); };
  $('#reset-no').onclick = () => dlg.close ? dlg.close() : dlg.removeAttribute('open');
  $('#reset-yes').onclick = () => {
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    g.gen = (g.gen || 0) + 1; // any waiting step of the previous game is abandoned
    g.pending = null; Rules.Music.stop();
    $('#intro').hidden = true;
    g.st = null; g.events && g.events.push('restart');
    if (window.AliveV3) window.AliveV3.reset();
    play(true);
  };

  /* ------------------------------ V2 (Amiga) ------------------------------ */
  function isV2() { return g.options.version === 'v2' || g.options.version === 'v3'; } // V3 (3D) builds on the V2 presentation
  function isV3() { return g.options.version === 'v3'; }
  const SPEAKERS = {
    1: { 58: 'cilla', 78: 'sage', 65: 'monstre' },
    2: { 21: 'mutant', 55: 'mutant', 70: 'mutant', 85: 'garde', 37: 'monstre', 41: 'monstre', 48: 'monstre', 52: 'monstre', 58: 'monstre', 74: 'monstre', 78: 'monstre' },
    3: { 34: 'garde', 27: 'garde', 45: 'garde', 63: 'garde', 81: 'garde', 92: 'garde', 48: 'garde', 77: 'garde', 50: 'porkus', 69: 'ward', 95: 'necarex', 74: 'narrateur' }
  };
  function speakerAt(game) { return (SPEAKERS[game.st.world] || {})[game.st.pos] || 'narrateur'; }
  function v2Line(text) {
    if (!isV2() || !g.inDialogue || g.fast || !window.AliveV2Voice || g.options.voice === false) return;
    window.AliveV2Voice.say(text, g.speaker);
  }
  const INDOOR = { 3: [47, 54, 55] }, WATER = { 1: [4, 5, 17], 2: [21, 22, 30] };
  function v2View(game, v) {
    const V2 = window.AliveV2; if (!V2 || !game.st) return;
    const code = game.code, w = game.st.world;
    let waterPen = null;
    if ((WATER[w] || []).includes(code)) { // the bluest pen of the picture shimmers (colour cycling)
      let best = -1; game.screen.inks.forEach((n, i) => { if (!i) return; const c = window.CPC.PALETTE[n], b = (c & 255) - ((c >> 16) & 255); if (b > best) { best = b; waterPen = i; } });
    }
    V2.setView(w, code, !!(v && v.img) && !(INDOOR[w] || []).includes(code), waterPen);
    if (window.AliveV3 && isV3() && !g.fast) window.AliveV3.onView(game, v);
    if (isV2() && g.options.music !== false && window.AliveV2Music && !g.fast) window.AliveV2Music.setZone(musicZone(w, code), game.st.enc === 1 ? 1 : 0);
  }
  /* which piece of music fits what James sees : the area of the world, the bar, the lair */
  function musicZone(w, code) {
    if (w === 2) return [21, 22, 23, 36].includes(code) ? 'swamp' : [25, 26, 31, 32, 34, 35].includes(code) ? 'desert' : 'jungle';
    if (w === 3) return code === 47 ? 'bar' : [52, 54, 55].includes(code) ? 'lair' : [34, 35].includes(code) ? 'desert' : 'city';
    return 'ice';
  }
  function v2Fx(name) {
    const Mu = window.AliveV2Music;
    if (isV2() && Mu && g.options.music !== false && !g.fast) {
      if (name === 'death') { Mu.stop(); Mu.stinger('death'); }
      else if (['encounter', 'hurt', 'win', 'world', 'treasure'].includes(name)) Mu.stinger(name);
    }
    if (window.AliveV3 && isV3()) window.AliveV3.onSfx(name);
    if (!isV2() || !window.AliveV2) return;
    if (name === 'hurt' || name === 'fall') window.AliveV2.shake(450, 10);
    if (name === 'grenade' || name === 'rumble') window.AliveV2.shake(900, 14);
    if (name === 'encounter' && g.st && g.code === 15) window.AliveV2.shake(700, 9); // the dragon breaks the ice
  }
  function applyVersion() {
    const v2 = isV2(), v3 = isV3();
    if (window.AliveV2) { window.AliveV2.on = v2; g.screen.dirty = true; window.AliveV2.dirtyAll = true; }
    if (window.AliveV3) { window.AliveV3.on = v3; if (window.AliveV3.setFree) window.AliveV3.setFree(v3 && g.options.controls !== 'classique'); if (v3 && g.st && g.world) window.AliveV3.onView(g, g.world.views[g.code]); renderControls(); }
    const k = v3 ? 2 : 1; // the 3D view is drawn at twice the CPC resolution
    if (canvas.width !== 640 * k) { canvas.width = 640 * k; canvas.height = 400 * k; g.screen.dirty = true; }
    document.body.classList.toggle('v2', v2);
    document.body.classList.toggle('v3', v3);
    document.querySelectorAll('[data-version]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.version === g.options.version)));
    if (!v2 && window.AliveV2Music) window.AliveV2Music.stop();
    if (!v2 && window.AliveV2Voice) window.AliveV2Voice.stop();
    if (v2 && g.st && g.world && g.options.music !== false && window.AliveV2Music) window.AliveV2Music.setZone(musicZone(g.st.world, g.code), g.st.enc === 1 ? 1 : 0);
    const iv = $('#intro-version'); if (iv) iv.textContent = v3 ? 'Version 3 (3D)' : v2 ? 'Version 2 (Amiga)' : 'Version 1991 (CPC)';
  }
  window.AliveV3Ready = () => {
    const V3 = window.AliveV3;
    V3.canWalk = () => ui.mode === 'command' && !!g.st && !g.st.dead;
    V3.uiMode = () => ui.mode;
    V3.onWalk = d => g.dispatch({ type: 'walk', dir: d });
    V3.onLook = d => g.dispatch({ type: 'look', dir: d });
    V3.onAction = a => { if (a === 'continue' || ui.mode === 'continue') g.dispatch({ type: 'continue' }); else if (ui.mode === 'command') g.dispatch({ type: 'icon', icon: a }); };
    V3.codeAt = (d, c) => g.st.map[d][c];
    V3.viewOf = code => g.world.views[code];
    V3.encounter = () => !!(g.st && g.st.enc === 1);
    applyVersion();
  };
  if (!g.options.version) g.options.version = 'v1';
  document.querySelectorAll('[data-version]').forEach(b => b.addEventListener('click', () => { g.options.version = b.dataset.version; saveOptions(); applyVersion(); }));
  if (!g.options.controls) g.options.controls = 'moderne';
  const oc = $('#opt-controls');
  if (oc) { oc.value = g.options.controls; oc.onchange = () => { g.options.controls = oc.value; saveOptions(); applyVersion(); }; }
  const ov = $('#opt-voice');
  if (ov) { ov.checked = g.options.voice !== false; ov.onchange = () => { g.options.voice = ov.checked; saveOptions(); if (!ov.checked && window.AliveV2Voice) window.AliveV2Voice.stop(); }; }
  async function playIntro() {
    if (!window.AliveV2Intro || window.AliveV2Intro.running) return;
    Rules.Music.stop();
    if (window.AliveV2Voice) window.AliveV2Voice.enabled = g.options.voice !== false;
    await window.AliveV2Intro.play($('#stage'));
    try { localStorage.setItem('alive-port-1991.intro-seen', '1'); } catch (e) { /* ignore */ }
    if (g.st === null && isV2() && g.options.music !== false && window.AliveV2Music) window.AliveV2Music.playTitle();
  }
  $('#btn-intro').onclick = () => { $('#intro').hidden = true; playIntro(); };
  applyVersion();

  // start
  $('#btn-play').onclick = async () => {
    $('#intro').hidden = true;
    if (window.AliveSound && window.AliveSound.enabled) window.AliveSound.init();
    let seen = false; try { seen = localStorage.getItem('alive-port-1991.intro-seen') === '1'; } catch (e) { /* ignore */ }
    if (isV2() && !seen) await playIntro();
    document.fonts && document.fonts.load('16px "Press Start 2P"').catch(() => {});
    play();
  };
  renderControls();
})();
