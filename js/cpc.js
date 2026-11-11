/* ALIVE (Lankhor 1991) - Web port.
 * cpc.js : Amstrad CPC mode 1 screen model (320x200, 4 pens), Lankhor RLE decoders,
 * text windows that behave like the CPC firmware (WINDOW / CLS / PRINT / scroll / inverse CHR$(24)).
 * No game content here.
 */
(function () {
  'use strict';

  // Firmware ink numbers 0..26 -> RGB
  const PALETTE = [0x000000, 0x000080, 0x0000FF, 0x800000, 0x800080, 0x8000FF, 0xFF0000, 0xFF0080, 0xFF00FF,
    0x008000, 0x008080, 0x0080FF, 0x808000, 0x808080, 0x8080FF, 0xFF8000, 0xFF8080, 0xFF80FF,
    0x00FF00, 0x00FF80, 0x00FFFF, 0x80FF00, 0x80FF80, 0x80FFFF, 0xFFFF00, 0xFFFF80, 0xFFFFFF];
  const css = n => '#' + PALETTE[n].toString(16).padStart(6, '0');

  function fromBase64(s) {
    const bin = atob(s), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  /* Routine &A200 of COMPACT.BIN / SCREEN2.BIN: first byte skipped, then (value,count) pairs. */
  function decodeRLE(data, widthBytes, rows) {
    const out = new Uint8Array(widthBytes * rows);
    let o = 0, i = 1;
    while (o < out.length && i + 1 < data.length) {
      const v = data[i], c = data[i + 1] || 256;
      i += 2;
      for (let k = 0; k < c && o < out.length; k++) out[o++] = v;
    }
    return out;
  }
  /* Routine &A400: raw copy. */
  function decodeRaw(data, widthBytes, rows) {
    const out = new Uint8Array(widthBytes * rows);
    out.set(data.subarray(0, Math.min(data.length, out.length)));
    return out;
  }
  /* Mode 1 byte -> 4 pixels (pens 0..3) */
  function bytesToPens(bytes, widthBytes) {
    const w = widthBytes * 4, h = bytes.length / widthBytes, pens = new Uint8Array(w * h);
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i], p = i * 4;
      pens[p] = ((b >> 7) & 1) | (((b >> 3) & 1) << 1);
      pens[p + 1] = ((b >> 6) & 1) | (((b >> 2) & 1) << 1);
      pens[p + 2] = ((b >> 5) & 1) | (((b >> 1) & 1) << 1);
      pens[p + 3] = ((b >> 4) & 1) | ((b & 1) << 1);
    }
    return { w, h, pens };
  }

  const cache = {};
  /* Scenes: 58 bytes x 143 lines, displayed at screen byte 1 / line 14 (address &F051). */
  function scene(name, raw) {
    const key = name + (raw ? ':raw' : '');
    if (cache[key]) return cache[key];
    const src = window.ALIVE_FILES[name];
    if (!src) throw new Error('Fichier graphique absent : ' + name);
    const data = fromBase64(src);
    const bytes = raw ? decodeRaw(data, 58, 143) : decodeRLE(data, 58, 143);
    const r = bytesToPens(bytes, 58); r.name = name;
    return (cache[key] = r);
  }
  /* Full screen interface (MATRICE.BIN): 80 bytes x 200 lines from &C000. */
  function fullScreen(name) {
    if (cache[name]) return cache[name];
    const data = fromBase64(window.ALIVE_FILES[name]);
    return (cache[name] = bytesToPens(decodeRLE(data, 80, 200), 80));
  }

  /* ---------------- Screen ---------------- */
  class Screen {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.W = 320; this.H = 200;
      this.pens = new Uint8Array(320 * 200);
      this.covered = new Uint8Array(320 * 200); // pixels where a window was opened over the picture (V2 paintings)
      this.inks = [0, 13, 23, 11];
      this.text = []; // 25 rows x 40 cols of {ch, pen, paper}
      for (let r = 0; r < 25; r++) this.text.push(new Array(40).fill(null));
      this.img = this.ctx.createImageData(640, 400);
      this.font = '16px "Press Start 2P", "Courier New", monospace';
      this.dirty = true;
      this.overlay = null; // optional callback(ctx) for modern hints
    }
    setInks(a, b, c) { this.inks = [0, a, b, c]; this.dirty = true; }
    clearAll() { this.framed = false; this.covered.fill(0); this.pens.fill(0); this.text.forEach(r => r.fill(null)); this.dirty = true; }
    blit(img, x, y) {
      for (let j = 0; j < img.h; j++) {
        const yy = y + j; if (yy < 0 || yy >= 200) continue;
        this.pens.set(img.pens.subarray(j * img.w, (j + 1) * img.w), yy * 320 + x);
      }
      // text cells covered by the picture disappear (the CPC screen memory is overwritten)
      const c0 = Math.floor(x / 8), c1 = Math.ceil((x + img.w) / 8), r0 = Math.floor(y / 8), r1 = Math.ceil((y + img.h) / 8);
      for (let r = r0; r < r1 && r < 25; r++) for (let c = c0; c < c1 && c < 40; c++) this.text[r][c] = null;
      this.dirty = true;
    }
    showScene(img) { if (window.AliveV2) window.AliveV2.onScene(this); this.lastScene = img; this.blit(img, 4, 14); for (let y = 14; y < 157; y++) this.covered.fill(0, y * 320 + 4, y * 320 + 236); }
    /* Routine &99D0 : only the picture area (58 bytes x 143 lines at &F051) is cleared, the frame stays intact */
    clearScene() {
      for (let y = 14; y < 157; y++) this.pens.fill(0, y * 320 + 4, y * 320 + 236);
      this.dirty = true;
    }
    /* Puts back the interface frame (outside the picture and the text box) and removes leftover windows */
    restoreFrame(frame) {
      if (!frame) return;
      for (let y = 0; y < 160; y++) {
        for (let x = 0; x < 320; x++) {
          if (y >= 14 && y < 157 && x >= 4 && x < 236) continue;
          this.pens[y * 320 + x] = frame.pens[y * 320 + x];
        }
      }
      for (let r = 0; r < 20; r++) this.text[r].fill(null);
      this.dirty = true;
    }
    plot(x, y, pen) { if (x >= 0 && x < 320 && y >= 0 && y < 200) this.pens[(y | 0) * 320 + (x | 0)] = pen; }
    /* CPC graphics coordinates: 640x400, origin bottom-left */
    gline(x1, y1, x2, y2, pen) {
      let ax = x1 >> 1, ay = (399 - y1) >> 1, bx = x2 >> 1, by = (399 - y2) >> 1;
      const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.plot(ax, ay, pen);
        if (ax === bx && ay === by) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; ax += sx; }
        if (e2 <= dx) { err += dx; ay += sy; }
      }
      this.dirty = true;
    }
    fillCells(c0, r0, c1, r1, pen) { // 1-based inclusive char cells
      for (let y = (r0 - 1) * 8; y < r1 * 8; y++) { this.pens.fill(pen, y * 320 + (c0 - 1) * 8, y * 320 + c1 * 8); this.covered.fill(1, y * 320 + (c0 - 1) * 8, y * 320 + c1 * 8); }
      for (let r = r0 - 1; r < r1; r++) for (let c = c0 - 1; c < c1; c++) this.text[r][c] = null;
      this.dirty = true;
    }
    putChar(col, row, ch, pen, paper) { // 1-based
      if (row < 1 || row > 25 || col < 1 || col > 40) return;
      this.text[row - 1][col - 1] = ch === ' ' && paper === 0 ? null : { ch, pen, paper };
      for (let y = (row - 1) * 8; y < row * 8; y++) this.pens.fill(paper, y * 320 + (col - 1) * 8, y * 320 + col * 8);
      this.dirty = true;
    }
    render() {
      if (window.AliveV2 && window.AliveV2.on) { window.AliveV2.render(this); return; } // V2 presentation
      if (!this.dirty) return;
      this.dirty = false;
      const rgb = this.inks.map(n => PALETTE[n]);
      const d = this.img.data, p = this.pens;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 320; x++) {
          const c = rgb[p[y * 320 + x]];
          const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
          let o = ((y * 2) * 640 + x * 2) * 4;
          d[o] = d[o + 4] = r; d[o + 1] = d[o + 5] = g; d[o + 2] = d[o + 6] = b; d[o + 3] = d[o + 7] = 255;
          o += 640 * 4;
          d[o] = d[o + 4] = r; d[o + 1] = d[o + 5] = g; d[o + 2] = d[o + 6] = b; d[o + 3] = d[o + 7] = 255;
        }
      }
      const ctx = this.ctx;
      ctx.putImageData(this.img, 0, 0);
      ctx.font = this.font;
      ctx.textBaseline = 'top';
      for (let r = 0; r < 25; r++) for (let c = 0; c < 40; c++) {
        const t = this.text[r][c];
        if (!t || t.ch === ' ') continue;
        ctx.fillStyle = css(this.inks[t.pen]);
        ctx.fillText(t.ch, c * 16, r * 16 + 1);
      }
      if (this.overlay) this.overlay(ctx);
    }
  }

  /* ---------------- Text window (firmware-like stream) ---------------- */
  class Win {
    constructor(screen, l, r, t, b) { this.s = screen; this.set(l, r, t, b); this.pen = 1; this.paper = 0; this.inv = false; }
    set(l, r, t, b) { this.l = l; this.r = r; this.t = t; this.b = b; this.x = 1; this.y = 1; return this; }
    get width() { return this.r - this.l + 1; }
    get height() { return this.b - this.t + 1; }
    get rr() { return Math.max(this.r, this.scrollR || 0); } // right edge used for CLS / scroll
    cls() { this.s.fillCells(this.l, this.t, this.rr, this.b, this.paper); this.x = 1; this.y = 1; this.inv = false; }
    locate(x, y) { this.x = x; this.y = y; }
    scroll() {
      const s = this.s;
      for (let row = this.t; row < this.b; row++) {
        for (let c = this.l; c <= this.rr; c++) {
          const src = s.text[row][c - 1];
          s.text[row - 1][c - 1] = src;
          const paper = src ? src.paper : this.paper;
          for (let y = (row - 1) * 8; y < row * 8; y++) s.pens.fill(paper, y * 320 + (c - 1) * 8, y * 320 + c * 8);
        }
      }
      s.fillCells(this.l, this.b, this.rr, this.b, this.paper);
    }
    newline() { this.x = 1; if (++this.y > this.height) { this.y = this.height; this.scroll(); } }
    print(str) {
      for (const ch of String(str)) {
        if (ch === '\x18') { this.inv = !this.inv; continue; }
        if (ch === '\r') { this.x = 1; continue; }
        if (ch === '\n') { if (++this.y > this.height) { this.y = this.height; this.scroll(); } continue; }
        if (ch === '\x09') { this.x++; continue; } // cursor right (used by PROG.BIN between text segments)
        if (this.x > this.width) this.newline();
        const pen = this.inv ? this.paper : this.pen, paper = this.inv ? this.pen : this.paper;
        this.s.putChar(this.l + this.x - 1, this.t + this.y - 1, ch, pen, paper);
        this.x++;
      }
    }
    println(str = '') { this.print(str); this.x = 1; if (++this.y > this.height) { this.y = this.height; this.scroll(); } }
  }

  window.CPC = { PALETTE, css, fromBase64, decodeRLE, decodeRaw, bytesToPens, scene, fullScreen, Screen, Win };
})();
