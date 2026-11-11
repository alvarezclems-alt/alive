/* ALIVE - Web port. rules.js : global rules of the 1991 game, ported line by line from
 *   OPTIONS.BAS (verbs : prendre, deposer, inventaire, repos, boire, manger, tenir, offrir,
 *                utiliser, soigner, voir, lire, physique, fichier, combattre, menacer)
 *   COMBAT.BAS  (combat formula)
 *   ALIVE.BAS   (title screen, death screen, music)
 * Line numbers of the original BASIC are given in comments. Texts are verbatim (no accents on CPC).
 * World specific behaviour is delegated to the world module hooks.
 */
(function () {
  'use strict';
  const { scene, fullScreen } = window.CPC;

  // OPTIONS.BAS 65001-65003
  const OBJ = [null, 'Des munitions', 'Un pistolet', 'Un pistolet', 'Une gourde (vide)', 'Une gourde (pleine)', "De l'eau",
    'Un walkman', 'Un os long', 'Un baton', 'Un message', 'Une grenade', 'Un uzi', 'Un couteau', 'Un poignard', 'Une hache',
    'Une lance', 'Une plante medicinale', 'Une pile', 'Un fruit', 'Un fruit mur', 'Un bout de papier', 'Une canette',
    "Une pepite d'or", 'Une carte Hx', 'Du poisson', 'Une lettre', 'Une carte Nx', 'De vrais-faux papiers',
    "Un glaive d'argent", 'Une tete de dragon', 'Un detonateur', 'Un bazooka', 'Un chrono', 'Du plastique',
    'Des Necacredits', 'Une bombe au Semtex'];
  const objName = n => OBJ[n] || '';
  const rnd = n => Math.floor(Math.random() * n) + 1;

  /* ------------------------------------------------------------------ */
  /* COMBAT.BAS                                                          */
  /* ------------------------------------------------------------------ */
  const AV = [0, 11, 12, 8, 13, 14, 10, 13, 14, 10, 15, 20, 5, 12]; // DATA 160
  // 500-513 : what the cell becomes after a won fight, per adversary
  const AFTER = { 1: [9, 16, 16, 16], 2: [21, 21, 21, 21], 3: [27, 27, 27, 27], 4: [21, 21, 21, 21], 5: [27, 27, 27, 27],
    6: [31, 31, 31, 31], 7: [34, 34, 34, 34], 8: [8, 8, 8, 8], 9: [38, 39, 38, 38], 10: [38, 39, 38, 39], 11: [43, 43, 43, 43], 12: [43, 43, 43, 43] };

  async function combat(g, who) { // who = PEEK(&6DA4): 0 you attack, 1 adversary first, 2/3 defensive
    const st = g.st, w = g.world, x2 = st.pos;
    const say = (...l) => g.say(...l);
    const wait = () => g.waitKey();
    if (w.combatPrecheck) { const r = await w.combatPrecheck(g, who); if (r) return r; }
    let ar = st.hand;
    if (![3, 2, 32, 29, 11, 12, 13, 14, 15, 16].includes(ar)) ar = 0; // 30
    const av = (w.adversary && w.adversary(g)) || 200; // 31-35
    const avv = AV[av] || 0;
    if (avv < 5 || [6, 7, 9, 16, 17].includes(avv) || avv > 18) { // 37 -> 11
      const q = rnd(3);
      say(q === 3 ? 'La paranoia ca se soigne !' : q === 2 ? 'Tu chasses des mouches ?' : 'Pourquoi tant de haine ?');
      return 'wait';
    }
    let f = st.force - 1; st.force = f; // 38
    let af = 0, ab = 0, po = 0;
    if (ar !== 0 && [2, 3, 11, 12, 32].includes(ar)) af = 1;
    if (st.hand === 11) { // 40 grenade
      st.hand = 0; removeObj(st, 11);
      say('Vous jetez une grenade...'); g.sfx('grenade'); await wait();
      if (w.grenadeRoof && w.grenadeRoof(g)) { g.out("Le toit s'effondre !"); st.dead = 'combat'; return 'dead'; }
      g.out('Vous eclatez votre adversaire !');
      return await combatEnd(g, av, ar);
    }
    if (ar !== 0 && [13, 14, 15, 16, 29].includes(ar)) ab = 1; // 42
    if (af === 1 && !ab) { // 43-45 : firearms need ammunition
      const i = st.inv.indexOf(1);
      if (i >= 0) st.inv.splice(i, 1); else { ar = 0; af = 0; }
    }
    if (ar === 0) { po = 4 - (10 - f) * 0.5; say("C'est a mains nues que vous vousbattez..."); }
    if (ab && (ar === 13 || ar === 14)) { po = 6 - (10 - f) * 0.5; say("C'est arme d'une petite lame quevous vous battez..."); }
    if (ab && ar !== 13 && ar !== 14) { po = 7 - (10 - f) * 0.5; say("C'est avec une arme blanche que vous vous battez..."); }
    if (af && [11, 12, 32].includes(ar)) { po = 10 - (10 - f) * 0.5; say("C'est avec une arme lourde que  vous vous battez..."); }
    if (af && [2, 3, 13].includes(ar)) { po = 8 - (10 - f) * 0.5; say("C'est avec une arme a feu que   vous vous battez..."); }
    await wait();
    let s = who, l = 0; // 120
    if (s === 1) { s = 0; g.out('Votre adversaire attaque le pre-mier...'); }
    else {
      if (s === 0) { s = 5; g.out('Vous attaquez le premier...'); } else { g.out('Vous etes sur la defensive...'); s = 3; }
      await wait(); // 130
      l = rnd(5); g.sfx(l >= 3 ? 'hit' : 'miss');
      g.out(['', 'Votre coup manque sa cible...et vous trebuchez !', 'Vous manquez de peu votre adver -saire...!',
        'Vous touchez legerement votre ad-versaire !', 'Vous avez atteint votre adversai-re...!', 'Vous frappez mechamment votre   adversaire !!!'][l]);
    }
    await wait(); // 140
    const t = po + l + s;
    if (t < 7) g.out('Votre adversaire execute une at-taque mortelle...!');
    else if (t < 11) g.out("Votre adversaire s'enerve...il  deploie toute sa force !");
    else if (t < 14) g.out('Votre adversaire essaie de vous frapper mortellement...!');
    else if (t < 17) g.out('Votre adversaire vous attaque   avec rage !');
    else if (t < 21) g.out('Votre adversaire tente le tout  pour le tout !');
    await wait(); // 150
    g.out(['', 'Votre adversaire vous fixe dans les yeux.', 'Vous avez les mains moites.', 'Vous avez la gorge serree.', 'Votre adversaire hurle !'][rnd(4)]);
    await wait(); // 171-177
    const fl = { 5: 'Vous frappez...sur de vous !', 8: 'Vous frappez...sur de vous !', 10: 'Vous attaquez la rage au coeur.', 11: "Vous amochez l'adversaire !",
      12: 'Vous tentez une frappe mortelle.', 13: 'Vous tenez tete a votre adversai-re !', 14: 'Vous vous battez aveuglement !', 15: "C'est le desespoir qui vous ani-me !" }[avv];
    if (fl) g.out(fl);
    await wait(); // 180
    const r = t - avv;
    g.sfx(r >= 0 ? 'hit' : 'hurt');
    if (r >= 0) g.out(['', 'Vous frappez mortellement votre adversaire !', 'Votre adversaire ecarquille les yeux !', "Votre adversaire s'ecroule !", 'Du sang gicle...!', 'Une tete vole !'][rnd(5)]);
    else g.out(['', 'Vous ressentez une forte douleur...', "Vous perdez l'equilibre...!", 'Un voile obscur apparait devant vos yeux...!', 'Du sang gicle...!', 'Une tete vole !'][rnd(5)]);
    await wait(); // 190
    if (r > 0) { g.sfx('win'); say('Vous sortez vainqueur du combat.'); return await combatEnd(g, av, ar); }
    if (r === 0) { // 200 / 1000
      say('Ce combat vous a epuise.');
      st.force -= 5;
      if (st.force < 0) { st.force = 0; g.out('Helas,vous mourez des suites de vos blessures...'); st.dead = 'combat'; return 'dead'; }
      g.out('Neanmoins,vous etes vivant !');
      return await combatEnd(g, av, ar);
    }
    say('Helas ! Votre adversaire vous a terrasse...Vous pouvez reserver votre place au Paradis ...'); // 210
    st.dead = 'combat';
    return 'dead';
  }
  async function combatEnd(g, av, ar) { // 500-600
    const st = g.st;
    if (g.world.afterCombat) await g.world.afterCombat(g, av, ar);
    if (AFTER[av]) g.setCell(st.pos, AFTER[av]);
    st.enc = 0;
    return 'wait';
  }

  /* ------------------------------------------------------------------ */
  /* OPTIONS.BAS                                                         */
  /* ------------------------------------------------------------------ */
  function removeObj(st, o) { const i = st.inv.indexOf(o); if (i >= 0) st.inv.splice(i, 1); if (st.hand === o && !st.inv.includes(o)) st.hand = 0; }

  const verbs = {
    async prendre(g) { // 10000
      const st = g.st, o = st.objs[st.pos] || (g.world.isWater && g.world.isWater(g) ? 6 : 0);
      if (!o) { g.say("Il n'y a rien d'interessant ici."); return 'wait'; }
      if (o === 18) { g.sfx('treasure'); st.piles++; g.say('Vous prenez une pile.'); st.objs[st.pos] = 0; await g.waitKey(); return pileCheck(g); }
      if (o === 6) { // 10051-10063 : remplir la gourde
        if (st.inv.includes(5) || st.hand === 5) { g.say('Votre gourde est deja pleine.'); return 'nowait'; }
        if (st.inv.includes(4)) { g.say("Voila de quoi remplir votre     gourde..."); st.inv = st.inv.map(x => x === 4 ? 5 : x); if (st.hand === 4) st.hand = 5; return 'wait'; }
        g.say("Et avec quoi allez-vous porter  cette eau ?"); return 'nowait';
      }
      if (st.inv.length >= 8) { g.say('Vous etes un tantinet trop char-ge pour ca...'); return 'wait'; } // 10050
      g.sfx([23, 27, 29, 30, 36].includes(o) ? 'treasure' : 'pickup');
      g.say('Vous avez ' + objName(o).toLowerCase() + ' en main.'); // 10060
      st.inv.push(o); st.hand = o; st.objs[st.pos] = 0;
      return 'wait';
    },
    async deposer(g, offering) { // 11500
      const st = g.st;
      if (st.objs[st.pos] !== 0 && !(offering && g.world.offerAnywhere)) { g.say("Ne jetez donc pas n'importe quoi n'importe ou !"); return 'wait'; }
      if (st.inv.length === 0) { g.say("Vous n'avez plus rien !"); return 'wait'; }
      const items = st.inv.map(objName);
      if (st.credits) items.push('Des Necacredits');
      items.push('Retour');
      const a = await g.menu(items, 3, 5, 21);
      if (a === items.length) return 'wait';
      const name = items[a - 1];
      if (offering) { // 11562-11575
        const r = g.world.offer ? await g.world.offer(g, name, a) : null;
        if (r) return r;
        g.say('Et a qui allez-vous faire ce    somptueux cadeau ?'); return 'wait';
      }
      if (name === 'Des Necacredits') { g.say('Voila qui est fait !'); return 'wait'; }
      const o = st.inv[a - 1]; // 11620
      st.objs[st.pos] = o; st.inv.splice(a - 1, 1);
      g.say('Voila qui est fait !'); g.sfx('drop');
      if (st.hand === o) st.hand = 0;
      if (g.world.dropped) { const r = await g.world.dropped(g, o); if (r) return r; }
      return 'wait';
    },
    async inventaire(g) { // 11000
      const st = g.st;
      let w = g.frameWindow(3, 3, 22, 10);
      w.println('\x18 VOUS PORTEZ :\x18');
      st.inv.forEach(o => w.println(' ' + objName(o)));
      if (st.piles === 1) { w.locate(2, 10); w.print('Et 1 pile.'); }
      if (st.piles > 1) { w.locate(2, 10); w.print('Et ' + st.piles + ' piles.'); }
      if (st.credits) { w.locate(2, 11); w.print('Argent: ' + st.credits * 100 + ' Credits.'); }
      w = g.frameWindow(3, 14, 22, 1);
      w.println('\x18 EN MAIN :\x18'); w.println(' ' + objName(st.hand));
      return 'wait';
    },
    async repos(g) { // 12000
      const st = g.st;
      if (st.enc !== 0 || (g.world.noRest && g.world.noRest(g))) { g.say("Vous croyez que c'est le moment de dormir ?!!"); return 'wait'; }
      st.vigil = Math.min(50, st.vigil + 15); g.sfx('rest');
      g.say('Ces quelques heures de repos    vous ont fait du bien...'); return 'wait';
    },
    async boire(g) { // 12500
      const st = g.st;
      if (st.objs[st.pos] === 6 || (g.world.isWater && g.world.isWater(g))) { st.soif = 40; g.sfx('drink'); g.say('A la votre !'); return 'wait'; }
      const i = st.inv.indexOf(5);
      if (i < 0) { g.say("Vous n'avez rien a boire !"); return 'wait'; }
      st.inv[i] = 4; if (st.hand === 5) st.hand = 4; st.soif = 40; g.sfx('drink');
      g.say("Aaah ! Ca fait du bien !"); return 'wait';
    },
    async manger(g) { // 13000
      const st = g.st;
      if (!st.inv.length) { g.say("Vous n'avez rien a manger !"); return 'wait'; }
      const items = st.inv.map(objName).concat('Retour');
      const a = await g.menu(items, 3, 5, 21);
      if (a === items.length) return 'wait';
      const z = items[a - 1]; g.cls(33);
      const eat = () => { st.inv.splice(a - 1, 1); st.hand = 0; g.sfx('eat'); }; // 62000
      if (!['Une plante medicinale', 'Un fruit', 'Un fruit mur', 'Du poisson', 'Une tete de dragon'].includes(z)) { g.out("Vu vos gouts,n'invitez personne a dejeuner chez vous !"); return 'wait'; }
      if (z === 'Une plante medicinale') { g.out('Vous reprenez des forces...'); eat(); st.force = Math.min(10, st.force + 2); return 'wait'; }
      if (z === 'Un fruit') { g.out('Scrountch miam,votre estomac    cesse momentanement de gar-     -gouiller...'); eat(); st.faim = Math.min(50, st.faim + 15); return 'wait'; }
      if (z === 'Un fruit mur') { g.out("Il a beau etre mur,il n'en est  pas moins empoisonne pour       autant..."); await g.waitKey(); g.out("Vous etes pris de crampes       d'estomac violentes,et vous     crevez sur place..."); st.dead = 'eat'; return 'dead'; }
      if (z === 'Du poisson') { g.out("Parce qu'etant radioactif,ce    poisson fut un vrai poison..."); st.dead = 'eat'; return 'dead'; }
      g.out('Ho ? Avec du persil dans les    oreilles ? Mefiez-vous,c\'est    tres lourd,le soir...'); return 'wait';
    },
    async tenir(g) { // 11700
      const st = g.st;
      if (!st.inv.length) { g.say('Que voulez-vous tenir en main ?'); return 'wait'; }
      const items = st.inv.map(objName).concat('Retour');
      const a = await g.menu(items, 3, 5, 21);
      if (a === items.length) return 'wait';
      st.hand = st.inv[a - 1]; g.say('OK !'); return 'wait';
    },
    async utiliser(g) { // 14000
      const st = g.st;
      const items = st.inv.map(objName).concat('Retour');
      const a = await g.menu(items, 3, 5, 21);
      g.cls(33);
      if (a === items.length) return 'wait';
      const o = st.inv[a - 1];
      if (o === 7 && st.piles !== 4) { g.say('Il manque ' + (4 - st.piles) + ' piles !'); return 'wait'; }
      if (o === 7 && st.piles === 4) { return g.world.useWalkman ? await g.world.useWalkman(g) : 'wait'; }
      if (g.world.useItem) { const r = await g.world.useItem(g, o); if (r) return r; } // additions asked by the author
      if (o === 4 && (st.objs[st.pos] === 6 || (g.world.isWater && g.world.isWater(g)))) { // gourde vide + eau
        st.inv = st.inv.map(x => (x === 4 ? 5 : x)); if (st.hand === 4) st.hand = 5; g.sfx('drink');
        g.say("Voila de quoi remplir votre     gourde..."); return 'wait';
      }
      if ([2, 3, 11, 12, 13, 14, 15, 16].includes(o)) { g.say('Pour cela,il faut etre en mode  COMBAT.'); return 'wait'; }
      g.say('Je suis navre,mais je ne vois   pas comment.'); return 'wait';
    },
    async soigner(g) { // 15000
      const st = g.st;
      if (!st.inv.includes(17)) { g.say('Avec quoi ?'); return 'wait'; }
      const fo = Math.min(10, st.force + 4);
      g.cls(33);
      if (fo > st.force) { st.force = fo; g.out("Ces plantes medicinales font de l'effet ..."); }
      removeObj(st, 17);
      return 'wait';
    },
    async voir(g) { // 16000
      const st = g.st, o = st.objs[st.pos];
      g.cls(33);
      if (o) g.out('Il y a ' + objName(o).toLowerCase() + '.');
      const extra = g.world.look && g.world.look(g);
      if (extra) { g.out(extra); return 'wait'; }
      if (!o) g.out('Rien de particulier.');
      return 'wait';
    },
    async lire(g) { // 17000
      if (g.world.read) { const r = await g.world.read(g); if (r) return r; }
      g.say('Rien a lire ici.'); return 'wait';
    },
    async physique(g) { // 18000
      const st = g.st, s = g.screen;
      const w = g.frameWindow(4, 5, 18, 6);
      w.println('\x18BILAN PHYSIQUE\x18'); w.println(''); w.println(' Force '); w.println(' Vigilance '); w.println(' Faim '); w.println(' Soif ');
      [300, 284, 268, 252].forEach(y => { s.gline(314, y, 232, y, 3); s.gline(232, y, 232, y - 8, 3); s.gline(232, y - 8, 314, y - 8, 3); });
      for (let a = -4; a <= 0; a += 2) {
        s.gline(234, a + 298, 234 + st.force * 8, a + 298, 1);
        s.gline(234, a + 282, 234 + st.vigil * 1.6, a + 282, 1);
        s.gline(234, a + 266, 234 + st.faim * 1.6, a + 266, 1);
        s.gline(234, a + 250, 234 + st.soif * 2, a + 250, 1);
      }
      return 'wait';
    },
    async fichier(g) { // 19000
      const w = g.frameWindow(6, 10, 15, 2);
      w.println('');
      const dis = await g.choice2(w, ' ', 'CHARGER', 'SAUVER', 2);
      const items = [1, 2, 3, 4, 5].map(n => 'Sauvegarde ' + n + (g.slotInfo(n) ? '' : ' -')).concat('Retour');
      const a = await g.menu(items, 5, 5, 13);
      if (a === 6) return 'wait';
      if (dis === 1) {
        const st = g.loadSlot(a);
        if (!st) { g.sfx('beep', true); g.say("Cette sauvegarde n'est pas      presente sur la D7 !"); return 'wait'; }
        g.st = st; g.restoreScreen();
        g.say("C'est OK !"); return 'wait';
      }
      g.say(g.saveSlot(a) ? "C'est OK !" : '\x18 ERREUR DISQUE !!! \x18'); return 'wait';
    },
    async combattre(g) { return await combat(g, 0); }, // 20000
    async menacer(g) { // 21000
      const st = g.st;
      const conv = g.world.threatConvincing ? g.world.threatConvincing(g) : 0;
      if (!conv && st.enc !== 0) { g.say("Vous n'etes guere convaincant,etvotre interlocuteur vous oblige a vous battre."); await g.waitKey(); return await combat(g, 2); }
      if (conv) { // 21080 -> COMBAT.BAS 36 / 514 : the adversary runs away without fighting
        const av = (g.world.adversary && g.world.adversary(g)) || 200;
        g.say('Votre ton agressif le fait decam-per !');
        return await combatEnd(g, av, st.hand);
      }
      if (g.world.threatAlone) { const r = await g.world.threatAlone(g); if (r) return r; }
      g.say("Vous etes seul...mais apparem-  ment,c'est deja trop !"); return 'nowait';
    }
  };
  async function pileCheck(g) { // 11900
    if (g.st.piles !== 4) return 'nowait';
    g.say('Ayant les quatre piles en votre possession,vous pouvez utiliser votre walkman...'); return 'wait';
  }

  /* ------------------------------------------------------------------ */
  /* ALIVE.BAS : title, death, music                                     */
  /* ------------------------------------------------------------------ */
  const TITLE_LOGO = [140, 150, 180, 300, 182, 300, 216, 100, 144, 218, 200, 208, 216, 170, 224, 276, 216, 168, 284, 164, 298, 164, 296, 270, 298, 280, 298, 286, 308, 242, 332, 128, 334, 127, 370, 296, 372, 270, 370, 156, 372, 158, 470, 168, 374, 268, 460, 280, 374, 228, 426, 234]; // DATA 850
  const DEATH_ART = [0, 220, 105, 270, 0, 222, 105, 272, 60, 120, 55, 255, 95, 120, 110, 250, 100, 210, 170, 215, 160, 270, 165, 115,
    180, 140, 255, 155, 180, 135, 210, 270, 194, 252, 275, 263, 186, 200, 255, 220, 192, 200, 255, 220,
    340, 138, 430, 154, 345, 134, 360, 270, 340, 258, 425, 272, 336, 210, 400, 215,
    440, 122, 460, 265, 450, 260, 490, 137, 452, 260, 490, 137, 485, 128, 500, 262,
    520, 124, 530, 270, 525, 255, 585, 260, 585, 260, 595, 240, 595, 240, 600, 230, 600, 230, 602, 210, 600, 230, 600, 200, 600, 200, 598, 190, 598, 190, 598, 190, 598, 190, 596, 180, 596, 180, 594, 170, 594, 170, 592, 160, 592, 160, 590, 150,
    515, 130, 565, 134, 565, 134, 590, 140]; // DATA 100-605
  // DATA 65070-65120 : (periode, duree) ; 0 = silence ; 1,0 = fin
  const MUSIC = [426, 100, 851, 180, 478, 100, 956, 180, 426, 40, 851, 40, 478, 40, 956, 40, 426, 40, 851, 40, 478, 40, 956, 40, 426, 40, 851, 40, 478, 80, 956, 150, 319, 20, 284, 20, 253, 20, 239, 20, 213, 80, 319, 100, 213, 40, 319, 40, 239, 80, 319, 100, 253, 40, 319, 40, 213, 80, 319, 100, 213, 40, 319, 40, 239, 80,
    319, 100, 239, 40, 253, 40, 284, 80, 379, 100, 239, 40, 253, 40, 284, 80, 358, 100, 239, 40, 253, 40, 284, 80, 379, 100, 239, 40, 284, 40, 319, 150, 213, 80, 319, 100, 213, 40, 319, 40, 239, 80, 319, 100, 253, 40, 319, 40, 213, 80, 319, 100, 213, 40, 319, 40, 239, 80, 319, 100,
    239, 40, 253, 40, 284, 80, 379, 100, 239, 40, 253, 40, 284, 80, 358, 100, 239, 40, 253, 40, 284, 80, 379, 100, 239, 80, 213, 150, 253, 50, 239, 50, 213, 50, 190, 60, 284, 30, 0, 2, 284, 30, 190, 50,
    284, 30, 0, 2, 284, 30, 190, 40, 284, 40, 239, 50, 358, 30, 0, 2, 358, 30, 239, 50, 358, 30, 0, 2, 358, 30, 239, 50, 358, 30, 0, 2, 358, 30, 239, 50, 213, 50, 190, 60, 284, 30, 0, 2, 284, 30, 190, 50, 284, 30, 0, 2, 284, 30, 190, 50,
    284, 30, 0, 2, 284, 30, 179, 50, 190, 50, 213, 60, 319, 30, 0, 2, 319, 30, 213, 50, 319, 30, 0, 2, 319, 30, 213, 50,
    319, 30, 0, 2, 319, 30, 190, 50, 213, 50, 239, 60, 379, 30, 0, 2, 379, 30, 239, 50, 379, 30, 0, 2, 379, 30, 239, 50, 379, 30, 0, 2, 379, 30, 213, 50, 253, 50, 239, 60, 379, 30, 0, 2, 379, 30, 239, 50, 379, 30, 0, 2, 379, 30, 239, 50, 379, 30, 0, 2, 379, 30, 426, 30, 1, 0];

  const Music = {
    ctx: null, nodes: [], timer: null, enabled: true,
    play() {
      if (!this.enabled) return;
      this.stop();
      try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      const ac = this.ctx; if (ac.state === 'suspended') ac.resume();
      const master = ac.createGain(); master.gain.value = 0.07; master.connect(ac.destination);
      let t = ac.currentTime + 0.1;
      const start = t;
      for (let i = 0; i < MUSIC.length; i += 2) {
        const x = MUSIC[i], y = MUSIC[i + 1];
        if (x === 1 && y === 0) break;
        const dur = y / 100;
        if (x > 1) {
          [[x, 1], [x + 0.5, 0.75], [x - 0.5, 0.8]].forEach(([per, vol]) => {
            const o = ac.createOscillator(), gn = ac.createGain();
            o.type = 'square'; o.frequency.value = 125000 / per;
            gn.gain.setValueAtTime(vol, t); gn.gain.linearRampToValueAtTime(vol * 0.6, t + dur);
            gn.gain.setValueAtTime(0, t + dur);
            o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.01);
            this.nodes.push(o);
          });
        }
        t += dur;
      }
      this.master = master;
      this.timer = setTimeout(() => this.play(), (t - start) * 1000);
    },
    stop() {
      clearTimeout(this.timer); this.timer = null;
      this.nodes.forEach(o => { try { o.stop(); } catch (e) { /* already stopped */ } });
      this.nodes = [];
      if (this.master) { try { this.master.disconnect(); } catch (e) { /* ignore */ } this.master = null; }
    }
  };

  function drawTitle(g) { // ALIVE.BAS 810-830
    const s = g.screen;
    s.clearAll(); s.setInks(12, 23, 5);
    s.showScene(scene('D1/ALIVE8'));
    // 3 x CHR$(11) at the top line : the whole screen scrolls down 3 character lines
    s.pens.copyWithin(24 * 320, 0, 176 * 320); s.pens.fill(0, 0, 24 * 320);
    for (let a = 48; a <= 58; a += 2) s.gline(0, a, 640, a, 0);
    for (let t = 0; t < 13; t++) {
      let [a, b, c, d] = TITLE_LOGO.slice(t * 4, t * 4 + 4);
      a += 140; b += 90; c += 140; d += 90;
      if (a <= 460) for (let n = 1; n <= 7; n++) s.gline(a + n, b + n, c + n, d + n, 0);
    }
    for (let t = 0; t < 13; t++) {
      let [a, b, c, d] = TITLE_LOGO.slice(t * 4, t * 4 + 4);
      a += 150; b += 100; c += 150; d += 100;
      let e = 1;
      for (let n = 1; n <= 7; n++) { s.gline(a + n, b + n, c + n, d + n, e); if (++e === 4) e = 1; }
    }
    const put = (x, y, str) => { for (let i = 0; i < str.length; i++) s.putChar(x + i, y, str[i], 1, 0); };
    put(32, 14, 'J.Alvarez'); put(32, 16, 'A.Laplace'); put(32, 19, '© Lankhor'); put(35, 21, '1991');
  }
  function drawDeathArt(g) { // ALIVE.BAS 1-10
    const s = g.screen; s.clearAll(); s.setInks(0, 6, 0);
    for (let t = 0; t < 33; t++) {
      const [a, b, c, d] = DEATH_ART.slice(t * 4, t * 4 + 4);
      for (let n = 1; n <= 7; n++) s.gline(a + n, b + n, c + n, d + n, 2);
    }
  }
  /* ALIVE.BAS 1000-1130 : Necarex s'eteint */
  const VICTORY = [['Whatever   the     time ,', "Quelle que soit l'epoque,"], ['Whatever   the    place ,', "Quel que soit l'endroit,"],
    ['Against all repressions ,', 'Contre toutes les repressions,'], ['Against  all  dictators ,', 'Contre tous les dictateurs,'],
    ['There will always  be men', 'Il y aura toujours des hommes'], ['To keep peace and justice', 'Pour conserver la paix et la justice...'],
    [' ', ' '], ['ALIVE.', 'intactes.']];
  async function victory(g) {
    const s = g.screen, sleep = ms => g.pause(ms);
    s.setInks(13, 24, 15); await sleep(1200);
    for (const pen of [2, 3, 1]) { // 1010 : each ink runs through the 27 colours, then goes black
      for (let a = 1; a <= 26; a++) { const k = s.inks.slice(1); k[pen - 1] = a; s.setInks(...k); if (a % 3 === 1) g.sfx('rumble', true); await sleep(40); }
      const k = s.inks.slice(1); k[pen - 1] = 0; s.setInks(...k);
    }
    await sleep(2000);
    s.clearAll(); s.setInks(14, 6, 26);
    for (let a = 1; a <= 8; a++) {
      const [e, f] = VICTORY[a - 1], p = a < 7 ? 1 : 2;
      if (e === ' ') continue;
      const xe = Math.round((40 - e.length) / 2);
      for (let t = 0; t < e.length; t++) { s.putChar(xe + t, a + 5, e[t], p, 0); await sleep(45); }
      for (let c = 1; c <= 40; c++) s.putChar(c, 25, ' ', 3, 0);
      const xf = Math.round((40 - f.length) / 2);
      for (let t = 0; t < f.length; t++) s.putChar(xf + t, 25, f[t], 3, 0);
      await sleep(1500);
    }
    await sleep(2500);
  }
  function drawFrame(g) { const s = g.screen; g.frameImg = fullScreen('D1/MATRICE'); s.clearAll(); s.blit(g.frameImg, 0, 0); s.lastScene = null; s.framed = true; }

  window.AliveRules = { MUSIC_DATA: MUSIC, victory, OBJ, objName, verbs, combat, removeObj, Music, drawTitle, drawDeathArt, drawFrame, rnd };
})();
