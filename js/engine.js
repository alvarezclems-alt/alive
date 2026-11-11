/* ALIVE - Web port. engine.js : generic engine (no story content).
 * - grid exploration with 4 direction layers (logic of PROG.BIN &9566/&95DE/&964B/&96B4)
 * - async "BASIC-like" primitives: print, waitKey, menu, yes/no
 * - icon panel of the original interface, keyboard, touch
 * - saves (5 slots, like the original FICHIER icon) in localStorage
 */
(function () {
  'use strict';
  const { Screen, Win, scene, fullScreen } = window.CPC;

  const DIR_TEXT = ['En face le Nord.', "En face l'Ouest.", 'En face le Sud.', "En face l'Est."];
  const DIR_NAME = ['Nord', 'Ouest', 'Sud', 'Est'];
  const DELTA = [9, -1, -9, 1];
  // Icon panel (mode 1 pixels) : 3x3 grid as on the original screen
  const ICONS = [['C', 'N', 'P'], ['W', 'EYE', 'E'], ['U', 'S', 'D']];
  const ICON_X = [246, 270, 294, 318], ICON_Y = [3, 26, 49, 72];
  const SAVE_KEY = 'alive-port-1991.save.';

  /* Number of words cut in two when `s` is printed from column x0 in a window W columns wide.
     A break between two whole words of the game's vocabulary (the authors glued them on purpose,
     the line break standing for the space) is not a cut ; a line starting with a space counts a little. */
  function cuts(s, W, x0 = 1) {
    const voc = window.ALIVE_WORDS;
    let x = x0, n = 0;
    for (let i = 0; i < s.length; i++) {
      if (x > W) {
        if (/[A-Za-z]/.test(s[i - 1] || '') && /[A-Za-z]/.test(s[i])) {
          let a = i - 1, b = i;
          while (a > 0 && /[A-Za-z]/.test(s[a - 1])) a--;
          while (b < s.length && /[A-Za-z]/.test(s[b])) b++;
          const left = s.slice(a, i).toLowerCase(), right = s.slice(i, b).toLowerCase();
          n += voc && voc.has(left) && voc.has(right) ? 0 : 10;
        } else if (s[i] === ' ') n += 1;
        x = 1;
      }
      x++;
    }
    return n;
  }

  class Game {
    constructor(canvas, hooks) {
      this.screen = new Screen(canvas);
      this.canvas = canvas;
      this.hooks = hooks || {};
      this.tw = new Win(this.screen, 2, 34, 21, 24);
      this.tw.scrollR = 34;
      this.worlds = {};
      this.pending = null;
      this.busy = false;
      this.options = { moveMode: 'cpc', survival: 'original' };
      this.st = null;
      this._raf();
    }
    _raf() { const loop = () => { this.screen.render(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    registerWorld(w) { this.worlds[w.id] = w; }
    get world() { return this.worlds[this.st.world]; }
    get map() { return this.st.map; }
    get code() { return this.st.map[this.st.dir][this.st.pos]; }
    codeAt(cell, layer = 0) { return this.st.map[layer][cell]; }
    setCell(cell, codes) { for (let L = 0; L < 4; L++) this.st.map[L][cell] = Array.isArray(codes) ? codes[L] : codes; }

    /* ---------------- input ---------------- */
    dispatch(ev) {
      if (this.pending) { this.pending(ev); return; }
    }
    _ui(mode, extra) { if (this.hooks.mode) this.hooks.mode(mode, extra); }
    iconAt(px, py) { // canvas pixel (640x400) -> icon id
      const x = px / 2, y = py / 2;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        if (x >= ICON_X[c] && x < ICON_X[c + 1] && y >= ICON_Y[r] && y < ICON_Y[r + 1]) return ICONS[r][c];
      return null;
    }
    flashIcon(id) {
      let rr = -1, cc = -1;
      ICONS.forEach((row, r) => row.forEach((v, c) => { if (v === id) { rr = r; cc = c; } }));
      if (rr < 0) return;
      const s = this.screen, x0 = ICON_X[cc] + 1, x1 = ICON_X[cc + 1] - 1, y0 = ICON_Y[rr] + 1, y1 = ICON_Y[rr + 1] - 1;
      const inv = () => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s.pens[y * 320 + x] ^= 3; s.dirty = true; };
      inv(); setTimeout(inv, 130); this.sfx('icon');
    }
    waitKey() {
      return new Promise(res => {
        this._ui('continue');
        this.pending = ev => {
          if (['key', 'click', 'icon', 'dir', 'continue', 'select'].includes(ev.type)) { this.pending = null; this._ui('none'); res(); }
        };
      });
    }
    pause(ms) { const gen = this.gen; return new Promise(r => setTimeout(() => { if (this.gen === gen) r(); }, this.fast ? 0 : ms)); }
    command() { // idle: wait for an icon or direction
      return new Promise(res => {
        this._ui('command');
        this.pending = ev => {
          if (ev.type === 'icon' || ev.type === 'dir' || ev.type === 'walk' || ev.type === 'look') { this.pending = null; this._ui('none'); res(ev); }
        };
      });
    }
    /* GOSUB 61000 : framed window. x,y 1-based char coords, l = extra columns, h = extra rows */
    frameWindow(x, y, l, h) {
      const s = this.screen, gx = (x - 1) * 16 - 2, gy = 400 - (y - 1) * 16, w = (l + 1) * 16 + 2, hh = (h + 1) * 16 + 2;
      s.gline(gx, gy, gx + w, gy, 1); s.gline(gx + w, gy, gx + w, gy - hh, 1);
      s.gline(gx + w, gy - hh, gx, gy - hh, 1); s.gline(gx, gy - hh, gx, gy, 1);
      const win = new Win(s, x, x + l, y, y + h); win.cls();
      return win;
    }
    /* Big black "parchment" window used for long texts (WINDOW 2,29,3,18 + 17015 frame) */
    bigWindow() {
      const s = this.screen;
      for (let t = 0; t <= 8; t += 2) {
        s.gline(8 + t, 370 - t, 472 - t, 370 - t, 0); s.gline(472 - t, 370 - t, 472 - t, 104 + t, 0);
        s.gline(472 - t, 104 + t, 8 + t, 104 + t, 0); s.gline(8 + t, 104 + t, 8 + t, 370 - t, 0);
      }
      const w = new Win(s, 2, 29, 3, 18); w.cls(); return w;
    }
    /* GOSUB 50000 : vertical selection menu. returns 1-based index */
    menu(items, x, y, lm) {
      const nm = items.length, win = this.frameWindow(x, y, lm + 1, nm + 1);
      const draw = (a, on) => {
        win.locate(2, a + 1);
        const txt = items[a - 1] + ' '.repeat(Math.max(0, lm - items[a - 1].length));
        win.print(on ? '\x18' + txt + '\x18' : txt);
      };
      items.forEach((it, i) => { win.locate(1, i + 2); win.print(' ' + it); });
      let a = 1; draw(1, true);
      return new Promise(res => {
        this._ui('menu', { items });
        const done = k => { this.pending = null; this._ui('none'); this.sfx('select'); res(k); };
        this.pending = ev => {
          if (ev.type === 'up' || (ev.type === 'dir' && ev.dir === 0)) { if (a > 1) { draw(a, false); a--; draw(a, true); this.sfx('cursor'); } }
          else if (ev.type === 'down' || (ev.type === 'dir' && ev.dir === 2)) { if (a < nm) { draw(a, false); a++; draw(a, true); this.sfx('cursor'); } }
          else if (ev.type === 'select' || ev.type === 'key' && ev.key === 'Enter') done(a);
          else if (ev.type === 'pick' && ev.index >= 1 && ev.index <= nm) done(ev.index);
          else if (ev.type === 'cancel' && /^Retour/.test(items[nm - 1])) done(nm);
          else if (ev.type === 'click') {
            const col = Math.floor(ev.x / 16) + 1, row = Math.floor(ev.y / 16) + 1;
            const idx = row - y - 1 + 1;
            if (col >= x && col <= x + lm + 1 && idx >= 1 && idx <= nm) done(idx);
          }
        };
      });
    }
    /* horizontal two-choice selector ("OUI NON", "CHARGER SAUVER") */
    choice2(win, prefix, left, right, line) {
      const draw = sel => { win.locate(1, line); win.print(prefix + (sel === 1 ? '\x18' + left + '\x18' : ' ' + left + ' ') + (sel === 2 ? '\x18' + right + '\x18' : ' ' + right + ' ')); };
      let sel = 1; draw(1);
      return new Promise(res => {
        this._ui('choice', { items: [left, right] });
        const done = () => { this.pending = null; this._ui('none'); res(sel); };
        this.pending = ev => {
          if (ev.type === 'dir' && ev.dir === 3 || ev.type === 'right') { sel = 2; draw(2); }
          else if (ev.type === 'dir' && ev.dir === 1 || ev.type === 'left') { sel = 1; draw(1); }
          else if (ev.type === 'pick') { sel = ev.index; draw(sel); done(); }
          else if (ev.type === 'select' || ev.type === 'key' && ev.key === 'Enter') done();
          else if (ev.type === 'click') {
            // the 1991 windows are narrow : "OUI NON" or "CHARGER SAUVER" often wrap to the next line,
            // so the click is matched against the cells where each word was actually printed
            const col = Math.floor(ev.x / 16) + 1, row = Math.floor(ev.y / 16) + 1;
            const hit = word => {
              for (let r = win.t; r <= win.b; r++) {
                const line = this.screen.text[r - 1].map(c => (c ? c.ch : ' ')).join('');
                const i = line.indexOf(word, win.l - 1);
                if (i >= 0 && r === row && col >= i + 1 && col <= i + word.length) return true;
              }
              return false;
            };
            if (hit(left)) { sel = 1; draw(1); done(); }
            else if (hit(right)) { sel = 2; draw(2); done(); }
          }
        };
      });
    }

    /* keyboard entry (D2.BAS 3096-3101 : INKEY$ loop, 14 chars max, upper case, DEL, RETURN) */
    inputLine(win, max) {
      let s = '';
      const draw = () => { win.cls(); win.locate(2, 2); win.print(s); };
      draw();
      return new Promise(res => {
        this._ui('input');
        this.pending = ev => {
          if (ev.type === 'char' && s.length < max) { s += ev.ch.toUpperCase(); draw(); }
          else if (ev.type === 'backspace') { s = s.slice(0, -1); draw(); }
          else if (ev.type === 'set') { s = String(ev.text || '').toUpperCase().slice(0, max); draw(); }
          else if (ev.type === 'submit') {
            if (ev.text != null) { s = String(ev.text).toUpperCase().slice(0, max); draw(); }
            this.pending = null; this._ui('none'); res(s);
          }
        };
      });
    }
    /* new world : map, objects and start cell of the world ; James keeps his inventory and his state */
    enterWorld(id) {
      const w = this.worlds[id], st = this.st;
      st.world = id; st.map = JSON.parse(JSON.stringify(window.ALIVE_MAPS[w.mapKey]));
      st.objs = new Array(99).fill(0);
      Object.entries(w.objects).forEach(([c, o]) => { st.objs[+c] = o; });
      st.pos = w.start.pos; st.enc = 0; st.visited = {};
      if (w.enterDir != null) st.dir = w.enterDir;
      if (w.enter) w.enter(this);
    }

    /* ---------------- text helpers ---------------- */
    txt(w = 34) { this.tw.set(2, w, 21, 24); this.tw.pen = 1; return this.tw; }
    cls(w = 33) { const t = this.txt(w); t.cls(); return t; }
    /* PRINT after GOSUB 61050 : WINDOW 2,33,21,24:CLS */
    say(...lines) { if (this.hooks.line) lines.forEach(l => this.hooks.line(l)); const t = this.cls(this.fitR(lines[0], 1, 33)); lines.forEach(l => { t.r = this.fitR(l, t.x, t.r); t.println(l); }); }
    /* The 1991 texts are hand-hyphenated for a 32-column (WINDOW 2,33) or 33-column (WINDOW 2,34) window.
       For each message, use the width whose line breaks do not cut a word. Returns the right column. */
    fitR(text, x0 = 1, pref = 33) {
      const s = String(text == null ? '' : text).replace(/\x18/g, '');
      const bad = W => cuts(s, W, x0);
      const b32 = bad(32), b33 = bad(33);
      if (b32 === b33) return pref;
      return b33 < b32 ? 34 : 33;
    }
    /* Long texts in the black "parchment" window : paginated instead of scrolling out of sight */
    async bp(win, str = '') {
      const s = String(str), W = win.width, H = win.height, lines = [];
      if (!s.length) lines.push('');
      for (let i = 0; i < s.length; i += W) lines.push(s.slice(i, i + W));
      for (const ln of lines) {
        if (win.y > H) { await this.waitKey(); win.cls(); }
        win.locate(1, win.y); win.print(ln); win.x = 1; win.y++;
      }
    }
    sfx(name, authentic) { if (!this.fast && window.AliveSound) window.AliveSound.play(name, authentic); if (this.hooks.sfx) this.hooks.sfx(name); }
    /* PRINT in the current window without clearing : the cursor continues (no WINDOW re-issued),
       unless the window width has to change (a WINDOW command homes the cursor on the CPC) */
    out(line, w = 33) {
      const t = this.tw;
      if ((t.r !== 33 && t.r !== 34) || t.l !== 2 || t.t !== 21 || t.b !== 24) this.txt(w);
      t.r = this.fitR(line, t.x, w);
      if (this.hooks.line) this.hooks.line(line);
      t.pen = 1; t.println(line);
    }

    /* ---------------- state ---------------- */
    newState(worldId) {
      const w = this.worlds[worldId];
      const st = {
        version: 1, world: worldId, pos: w.start.pos, dir: w.start.dir,
        map: JSON.parse(JSON.stringify(window.ALIVE_MAPS[w.mapKey])),
        objs: new Array(99).fill(0), inv: [], hand: 0,
        force: 10, vigil: 50, faim: 50, soif: 40,
        enc: 0, piles: 0, credits: 0, flags: {}, visited: {}, steps: 0, dead: false,
        inks: w.start.inks.slice()
      };
      Object.entries(w.objects).forEach(([c, o]) => { st.objs[+c] = o; });
      st.inv = w.inventory.slice(); st.hand = w.hand;
      return st;
    }
    flag(k) { return this.st.flags[k] || 0; }
    setFlag(k, v) { this.st.flags[k] = v; }

    /* ---------------- view (PROG.BIN &9814 + dispatcher &99D0) ---------------- */
    drawView() {
      const v = this.world.views[this.code];
      const s = this.screen;
      s.restoreFrame(this.frameImg); s.clearScene(); // &99D0 : the picture area only
      if (!v) return v;
      if (v.inks) { this.st.inks = v.inks.slice(); }
      s.setInks(...this.st.inks);
      if (v.img) s.showScene(scene(v.img, v.raw));
      return v;
    }
    /* Redraws the current picture and the frame : old menus and windows disappear */
    redrawScene() {
      const s = this.screen;
      s.restoreFrame(this.frameImg); s.clearScene();
      if (s.lastScene) s.blit(s.lastScene, 4, 14);
    }
    async showView() {
      const st = this.st;
      st.visited[st.pos] = 1;
      const t = this.txt(34);
      t.locate(33, 4); t.print(' ');
      t.print(DIR_TEXT[st.dir]); t.print('\r\n');
      const v = this.world.views[this.code];
      if (v) t.print(v.text.join('\t'));
      this.drawView();
      if (!v || v.death) { st.dead = 'fall'; }
      if (v && v.encounter) st.enc = 1;
      if (this.hooks.status) this.hooks.status(this);
      if (this.hooks.view) this.hooks.view(this, v);
    }
    /* &953B : every turn or step costs vigilance, hunger and thirst */
    spend() {
      const st = this.st;
      st.steps++;
      const slow = this.options.survival === 'clemente' && st.steps % 2 === 0;
      if (slow) return;
      if (--st.vigil <= 0) { st.vigil = 0; st.dead = st.dead || 'stats'; return; }
      if (--st.faim <= 0) { st.faim = 0; st.dead = st.dead || 'stats'; return; }
      if (--st.soif <= 0) { st.soif = 0; st.dead = st.dead || 'stats'; }
    }
    /* &9566 (N) &95DE (S) &964B (O) &96B4 (E) */
    async direction(d) {
      const st = this.st;
      if (st.enc === 1) { if (this.hooks.blocked) this.hooks.blocked(this); return; }
      const steps = (st.dir === d) ? ['move'] : (this.options.moveMode === 'direct' ? ['turn', 'move'] : ['turn']);
      for (const kind of steps) {
        this.spend();
        if (kind === 'turn') st.dir = d; else st.pos += DELTA[d];
        this.sfx(kind === 'turn' ? 'turn' : 'step');
        const enc0 = st.enc;
        await this.showView();
        if (st.dead === 'fall') this.sfx('fall');
        else if (st.enc && !enc0) this.sfx('encounter');
        if (st.dead || st.enc) break;
        if (steps.length > 1 && kind === 'turn') await this.pause(250);
      }
    }

    /* V3, free movement : James walks into the next cell (one action, like a step in 1991) ... */
    async walk(d) {
      const st = this.st;
      if (st.enc === 1) { if (this.hooks.blocked) this.hooks.blocked(this); return; }
      st.dir = d; this.spend(); st.pos += DELTA[d]; this.sfx('step');
      const enc0 = st.enc;
      await this.showView();
      if (st.dead === 'fall') this.sfx('fall'); else if (st.enc && !enc0) this.sfx('encounter');
    }
    /* ... or looks towards another direction (free : turning in place costs nothing in the modern controls) */
    async look(d) {
      const st = this.st;
      if (st.enc === 1 || st.dir === d) return;
      st.dir = d;
      const enc0 = st.enc;
      await this.showView();
      if (st.dead === 'fall') this.sfx('fall'); else if (st.enc && !enc0) this.sfx('encounter');
    }

    /* ---------------- saves (FICHIER) ---------------- */
    saveSlot(n) {
      const data = JSON.stringify(Object.assign({ savedAt: new Date().toISOString() }, this.st));
      try { localStorage.setItem(SAVE_KEY + n, data); return true; } catch (e) { return false; }
    }
    loadSlot(n) {
      try {
        const raw = localStorage.getItem(SAVE_KEY + n); if (!raw) return null;
        const st = JSON.parse(raw);
        if (!st || !this.worlds[st.world] || !Array.isArray(st.map) || st.map.length !== 4) return null;
        return st;
      } catch (e) { return null; }
    }
    slotInfo(n) {
      const st = this.loadSlot(n); if (!st) return null;
      return { world: st.world, steps: st.steps, date: st.savedAt };
    }
  }

  window.AliveEngine = { cuts, Game, DIR_TEXT, DIR_NAME, DELTA, SAVE_KEY };
})();
