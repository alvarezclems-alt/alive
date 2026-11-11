/* ALIVE - Web port. world3.js : MONDE III (New York en ruine, la cite interdite, Necarex).
 * Sources :
 *   - views  : dispatcher of COMMENT3.BIN, pictures from disk 2 ; map CARTE3.BIN
 *   - start  : D2.BAS 35513-35520 (cell 11, objects, walkman -> vrais-faux papiers)
 *   - story  : D3.BAS (rues), D4.BAS (bar de Porkus, magasin clandestin, Necarex) ;
 *              OPTIONS.BAS 11529, 11623, 12000, 16003, 17500, 21010-21090, 30000 ; COMBAT.BAS 2-9, 31-33, 509-513
 * People : 34 voyou, 27 45 63 81 92 gardes de la cite interdite (carte Hx), 48 police, 50 Porkus (bar),
 *          69 Steven Ward, 74 la secte en procession, 77 gardien du sanctuaire (carte Nx), 95 Necarex.
 * 85 = salle du generateur (y poser la bombe).
 */
(function () {
  'use strict';
  const R = () => window.AliveRules;
  const V = (img, inks, text, extra) => Object.assign({ img: 'D2/' + img, inks, text }, extra || {});
  const ENC = { encounter: true };
  const views = {
    34: V('ALIV29', [2, 25, 15], ['Le sable,puis la mort...']),
    35: { text: ['La chaleur trop fortevous tue.'], death: true },
    38: V('ALIV36', [10, 1, 3], ['Une facade bien vetuste.']),
    39: V('ALIV33', [10, 1, 3], ['La rue et ses ruines.'], { raw: true }),
    41: V('ALIV19', [1, 10, 13], ['Un homme inquietant vous', 'fait    face...'], ENC),
    42: { text: ['Le plancher se derobe', 'sous vos   pieds...!'], death: true },
    43: V('ALIV42', [2, 23, 4], ["Prudence...tout peut s'ecrouler!"]),
    44: V('ALIV38', [14, 16, 1], ['Police...vos papiers !'], ENC),
    45: V('ALIV38', [14, 16, 1], ['Stop ! ici commence la', 'cite      interdite...'], ENC),
    46: V('ALIV38', [14, 16, 1], ["Qui ose approcher l'antre", 'de     Necarex ?!!'], ENC),
    47: V('ALIV41', [15, 9, 4], ["Qu'est ce que j'te sers humain ?"]),
    48: V('ALIV40', [15, 13, 3], ['Un vieil homme,au regard vide,   fume sa pipe.'], ENC),
    49: V('ALIV34', [15, 10, 2], ['Le port est desert...']),
    50: V('ALIV35', [9, 2, 10], ['La statue a t-elle encore', 'un sensici ?']),
    51: { text: ['Baignade radioactive...!'], death: true },
    52: { text: ['Cette piece a un taux tres eleve de radioactivite...'], death: true },
    53: V('ALIV20', [16, 4, 3], ['Toute la secte de Necarex', 'defile dans cette rue...'], ENC),
    54: V('ALIV37', [10, 2, 6], ['Un bruit sourd regne dans', 'cette  piece.']),
    55: V('ALIV39', [13, 24, 15], ['Necarex...en personne !'], ENC)
  };
  const VOYOU = 34, POLICE = 48, BAR = 50, WARD = 69, SECTE = 74, GARDIEN = 77, NECAREX = 95, GENERATEUR = 85;
  const GARDES = [27, 45, 63, 81, 92];
  const PEOPLE = [27, 34, 45, 48, 50, 63, 69, 74, 77, 81, 92];

  const W = g => g.waitKey();
  const die = async (g, ...lines) => { for (const l of lines) { g.out(l); await W(g); } g.st.dead = 'story'; return 'dead'; };
  const shoot = g => die(g, "Tant pis pour toi ! Tu l'auras  voulu !", 'Il arme son plasma gun,vous met en joue...et tire.');
  async function arrest(g) { // D3.BAS 20000
    await W(g); g.out("Il sort une paire de menottes   magnetiques.En un rien de temps,vous vous retrouvez les poings  lies."); await W(g);
    g.cls(33); g.out("Conduit au poste,vous etes jete dans une geole d'ou vous n'etes pas pres de ressortir..."); await W(g);
    g.cls(33); g.out('Un peu humiliant,comme fin,non ?'); await W(g);
    g.st.dead = 'story'; return 'dead';
  }
  // counters of the original (&6DB2 police, &6DB3 gardes, &6DB4 gardien)
  const bump = (g, k) => { const v = g.flag(k); g.setFlag(k, v + 1); return v; };

  /* ================= D3.BAS ================= */
  async function dialogue(g) {
    const st = g.st;
    for (;;) {
      const x2 = st.pos;
      if (x2 === BAR || x2 === NECAREX) return await d4(g); // line 100
      if (st.enc === 0) { g.cls(34); g.out('Vous parlez,parlez...et si on   jouait !', 34); await W(g); return 'nowait'; }
      g.redrawScene(); // no leftover window under the dialogue menu
      const a = await g.menu(['Dire', 'Menacer', 'Supplier', 'Offrir', 'Demander', 'Ordonner', 'Retour'], 8, 5, 9);
      let r;
      if (a === 1) r = await dire(g, x2);
      else if (a === 2) r = await menacer(g, x2);
      else if (a === 3) r = await supplier(g, x2);
      else if (a === 4) r = await offrir(g);
      else if (a === 5) r = await demander(g, x2);
      else if (a === 6) r = await ordonner(g, x2);
      else { await W(g); return 'nowait'; }
      if (r === 'menu') continue;
      if (r === 'leave') { await W(g); return 'nowait'; }
      return r;
    }
  }
  const notHere = g => { g.out('Cessez de parler tout seul,ca   fait debile !'); return 'leave'; };
  const gardien = async g => { // 1400 / 2400 / 3400 / 5400 / 6400
    if (g.flag('nbdn') === 2) return await die(g, 'Joignant le geste a la parole,  il vous abat froidement.');
    bump(g, 'nbdn'); g.out('Veuillez presenter votre carte, ou je vous abats !'); return 'menu';
  };
  const policeCount = async g => { // 1600 ... : the 4th exchange ends at the police station
    if (g.flag('nbd') === 3) { g.out("Toi,mon p'tit gars,t'as pas la  conscience tranquille ! Suis-moiau poste !"); return await arrest(g); }
    bump(g, 'nbd'); return null;
  };

  async function dire(g, x2) {
    const a = await g.menu(['Salut ! Ca va ? ', "Moi,c'est James. ", 'Sale temps,hein ?', 'Vous etes moche !', "L'air est malsain"], 6, 6, 18);
    g.cls(33);
    if (!PEOPLE.includes(x2)) return notHere(g);
    if (x2 === VOYOU) {
      if (a === 4 && !g.flag('voyou')) { g.out('Repete un peu,pour voir !'); g.setFlag('voyou', 1); return 'menu'; }
      if (a === 4) { g.out("Mais c'est qu'il repete,en plus!Bats-toi,pauvre type !"); await W(g); return await R().combat(g, 3); }
      g.out(['', 'Et ta soeur ?', 'Que veux-tu que ca me foute ?', "Le temps,je m'en fous !", '', 'Ferme la bouche,ca ira mieux.'][a]); return 'menu';
    }
    if (GARDES.includes(x2)) {
      if (g.flag('nbdh') === 3) return await shoot(g);
      bump(g, 'nbdh');
      g.out(['', "Je ne te connais pas ! T'as ta  carte Hx ?", "Je ne te connais pas ! T'as ta  carte Hx ?", 'Le temps ne change jamais,ici ! Ta carte !', "Tu t'es vu,avec ta tronche en   biais ? Ta carte !", 'Espece de pouilleux,tu pues a   vingt metres !'][a]);
      return 'menu';
    }
    if (x2 === GARDIEN) return await gardien(g);
    if (x2 === WARD) {
      g.out(['', "Avec l'age,on essaie de faire   aller ...", 'Bienvenue,James.Je suis Steven  Ward.', 'Oui,depuis que Necarex mene sa  dictature.', "La beaute n'est que le reflet   d'une ame pure,nous sommes tous moches !", 'Cette odeur est due aux produitspour tuer les rats.'][a]);
      return 'menu';
    }
    if (x2 === POLICE) {
      const r = await policeCount(g); if (r) return r;
      g.out(['', 'Au diable les politesses ! Tes  papiers !', "James ? Tes papiers ou je t'em- barque !", 'Ah ! Ah ! Sacre rigolo ! File-  moi tes papiers !', 'Change pas de sujet,morveux !   Envoie tes papiers !', "L'air est plus sain ici qu'en   prison,alors grouille-toi de me filer tes papiers !"][a]);
      return 'menu';
    }
    g.out('Les moines en transes vous      ignorent ...'); return 'leave'; // 74
  }

  async function menacer(g, x2) {
    const a = await g.menu(["P'tite tete,va !", 'Tu fais pas le poids !', 'Retourne chez ta mere !', 'Numerote tes os,nabot !'], 3, 7, 24);
    g.cls(33);
    if (!PEOPLE.includes(x2)) return notHere(g);
    if (x2 === VOYOU) { // 2200
      if (g.flag('voyou')) { g.out("Mais c'est qu'il repete,en plus!Bats-toi,pauvre type !"); await W(g); return await R().combat(g, 3); }
      g.setFlag('voyou', 1); g.out(a === 1 ? 'Fais gaffe a ce que tu dis !' : "Eh,m'insulte pas,sale niais !"); return 'menu';
    }
    if (GARDES.includes(x2)) { // 2300 (a=3 falls through to 2400 in the original)
      if (g.flag('nbdh') === 3) return await shoot(g);
      if (a === 1) { g.out("Eh,j'aime pas tes commentaires, nabot ! File ta carte ou ca va  mal aller !"); return 'menu'; }
      if (a === 2) { g.out('Tu paries ? Avec mon plasma gun,je te propulse a quinze metres !'); return 'menu'; }
      if (a === 4) { g.out("Nabot ? Tu t'es vu,sale gnome ?"); return 'menu'; }
      return await gardien(g);
    }
    if (x2 === SECTE) { g.out('Ils ne vous entendent meme pas !'); return 'menu'; }
    if (x2 === GARDIEN) return await gardien(g);
    if (x2 === WARD) { g.out('Pitie,ne me fais pas de mal !'); return 'menu'; }
    const r = await policeCount(g); if (r) return r; // 2600
    g.out(['', "Eh,j'aime pas tes commentaires, nabot ! File tes papiers ou je  me fache !", 'Tu paries ? Avec mon plasma gun,je te propulse a vingt metres !', 'Ho ! Laisse ma mere en dehors deca,batard !', "Qui t'a dit que j'avais des pro-theses ?"][a]);
    return 'menu';
  }

  async function supplier(g, x2) {
    const a = await g.menu(['Non,pas les dents !', 'Pitie,ne me tue pas !', 'Pense a mes gosses !', 'Ne me frappe pas !', 'Moi pas bon a manger!'], 5, 6, 22);
    g.cls(33);
    if (!PEOPLE.includes(x2)) return notHere(g);
    if (x2 === VOYOU) { g.out(a === 5 ? 'Tu te crois appetissant,peut-   etre ? Beurk !' : a === 3 ? 'Si tu veux les revoir,file-moi  ton fric !' : "Oh,mais c'est qu'il va pleurer !Ton fric !"); return 'menu'; }
    if (GARDES.includes(x2)) {
      if (g.flag('nbdh') === 3) return await shoot(g);
      bump(g, 'nbdh');
      if (a === 1 || a === 2 || a === 4) return await die(g, 'Oh,quelle bonne idee...', 'Il arme son bazooka,et vous     liquefie sur place.');
      g.out(a === 5 ? 'De toutes facons,je suis au regi-me !' : 'Tes gosses,je m\'en fous !'); return 'menu';
    }
    if (x2 === SECTE) { g.out('Aucun ne detourne la tete.'); return 'menu'; }
    if (x2 === GARDIEN) return await gardien(g);
    if (x2 === WARD) { g.out('Allons,mon brave,je ne suis pas si mechant que ca !'); return 'menu'; }
    const r = await policeCount(g); if (r) return r;
    g.out(a === 1 || a === 4 ? "J'aime pas les pleurnichards !  Tes papiers !" : a === 2 ? "J'ai envie de faire un beau car-ton avec toi..." : a === 5 ? 'Si tu te crois appetissant ...' : "A d'autres ! Les enfants ne sontpas loges dans ce bloc !");
    return 'menu';
  }

  async function demander(g, x2) {
    const a = await g.menu(['Ou suis-je ?', 'Qui es-tu ?', 'Que veux-tu ?', 'Comment fuir ?'], 5, 5, 15);
    g.cls(33);
    if (!PEOPLE.includes(x2)) return notHere(g);
    if (x2 === VOYOU) {
      if (a === 2) { g.out("T'es de la police ? J'vais t'cre-ver,fumier !"); await W(g); return await R().combat(g, 3); }
      g.out(['', "Bienvenue dans mon bled ! Ton   pognon ou je te fais la peau !", '', 'TON FRIC !', "Envoie d'abord le ble !"][a]); return 'menu';
    }
    if (GARDES.includes(x2)) {
      if (g.flag('nbdh') === 3) return await shoot(g);
      bump(g, 'nbdh');
      if (a === 4) return await die(g, 'Ainsi donc,tu cherches a fuir !', "Il appelle du renfort.", "Vous ne resistez pas a l'interrogatoire muscle...");
      g.out(['', 'Ici commence la cite interdite. Ta carte !', 'Blanche-Neige ! Allez,comique,  montre-moi ta carte !', 'Ta carte ! Comique !'][a]); return 'menu';
    }
    if (x2 === GARDIEN) return await gardien(g);
    if (x2 === SECTE) { g.out('Ils ne se sentent pas vraiment  concernes...'); return 'menu'; }
    if (x2 === WARD) {
      g.out(['', "En enfer ! Il n'existe pas d'en-droit plus atroce que cette vil-le !", 'Je suis Steven Ward,ancien mem- bre de la CIA,si ca vous dit    quelque chose...', "Mon souhait serait que la dicta-ture de Necarex s'acheve !", "Helas,cette ville est une prisonou l'on ne peut que survivre !"][a]);
      return 'menu';
    }
    const r = await policeCount(g); if (r) return r;
    g.out(['', 'Encore un ivrogne ! Envoie tes  papiers ou tu vas decuver en pri-son !', 'Eh ! Si tu veux plaisanter,on vaetre deux ! Tes papiers !', "J'aime pas repeter ! Papiers !", "Ainsi,tu essaies de fuir ? Arre-te de faire le comique ou je    t'embarque !"][a]);
    return 'menu';
  }

  async function ordonner(g, x2) {
    const st = g.st;
    const a = await g.menu(['Rends-toi !', 'Aide-moi .', 'Donne-moi...'], 7, 8, 13);
    g.cls(33);
    if (!PEOPLE.includes(x2)) return notHere(g);
    if (x2 === VOYOU) {
      if (a === 1) { g.out("Mais c'est qu'il me provoque !  Bats-toi !"); await W(g); return await R().combat(g, 3); }
      g.out(a === 2 ? 'Je travaille pas gratos !' : "Ho ! Mais je reve ! Ici,c'est   moi qui rackette !"); return 'menu';
    }
    if (GARDES.includes(x2)) {
      if (g.flag('nbdh') === 3) return await shoot(g);
      bump(g, 'nbdh');
      g.out(['', "Mais c'est qu'il mordrait !     Montre ta carte pour passer !", 'Pas question,moi je veux ta car-te Hx c\'est tout !', "Est-ce que j'ai une tete a fairel'aumone ? Ta carte !"][a]); return 'menu';
    }
    if (x2 === GARDIEN) return await gardien(g);
    if (x2 === SECTE) { g.out('Ils defilent sans vous ecouter..'); return 'menu'; }
    if (x2 === WARD) { // 6500 : the original tests object 29 (the glaive) for "the quality of the paper"
      const pap = st.inv.includes(29) || st.hand === 29;
      if (a === 2 && !pap) { g.out('Je suis vieux,je ne peux pas    grand-chose pour toi.'); return 'menu'; }
      if (a === 2) { g.out('Tu fais partie de la resistance des Korkors,je le reconnais a laqualite du papier ! Que veux-tu savoir ?'); return await wardQuestions(g); }
      if (a === 3) { g.out("Je ne peux t'offrir qu'un peu   d'eau et de nourriture."); st.soif = 40; st.faim = 50; return 'menu'; }
      g.out('Pourquoi veux-tu que je me ren- de ?'); return 'menu';
    }
    const r = await policeCount(g); if (r) return r;
    g.out(['', "Ha ! Ha ! Tu sais que t'es mar- rant,guignol ? Tes papiers !", 'Ah,mon pauvre,si tu crois que jevais m\'abaisser a ca ! Papiers !', "Espece de zouave ! C'est a toi  de me montrer tes papiers !"][a]);
    return 'menu';
  }

  async function wardQuestions(g) { // 6900-6990
    for (;;) {
      const a = await g.menu(['Qui est Necarex ?', 'Ou loge-t-il ?', 'Comment le tuer ?', 'Retour'], 5, 8, 17);
      g.cls(33);
      if (a === 1) g.out('Nul ne l\'a rellement vu,mais lesmoines de la secte possedent la carte Nx permettant de penetrer dans le sanctuaire.');
      else if (a === 2) g.out("Dans la partie centrale au nord de la ville.Mais a l'entree du  sanctuaire,se trouve un gardien d'une force prodigieuse.");
      else if (a === 3) g.out("A mon avis,le meilleur moyen estde poser une bombe a proximite. Tu en trouveras une au magasin,ala sortie du port.");
      else {
        g.out('Maintenant file,si on nous voit ensemble,le complot echouera.   Bonne chance,James !');
        g.setCell(WARD, 43); g.st.enc = 0; return 'leave';
      }
      await W(g);
    }
  }

  async function offrir(g) { return await R().verbs.deposer(g, true); } // 4000 -> 10000

  /* D3.BAS 10000-10150 : what each person does with a present */
  async function offer(g, name) {
    const st = g.st, x2 = st.pos;
    g.cls(33);
    if (x2 === BAR) { g.cls(34); g.out('Inutile je ne fais pas le troc !', 34); return 'wait'; }
    if (x2 === NECAREX) { g.cls(34); g.out('Miserable...que veux tu que je   fasse de tes objets !', 34); return 'wait'; }
    if (x2 === POLICE && name === 'De vrais-faux papiers') { g.out('OK,c\'est bon,tu peux circuler...'); st.enc = 0; g.setCell(POLICE, [38, 39, 38, 39]); return 'wait'; }
    if (x2 === POLICE) { g.out('Si tu crois me soudoyer,tu as   frappe a la mauvaise porte !'); return await arrest(g); }
    if (GARDES.includes(x2) && name === 'Une carte Hx') { await W(g); return await die(g, "Cette carte ne t'appartient pas ! Voleur !", 'Il arme son plasma gun,vous met en joue...et tire.'); }
    if (x2 === SECTE) { g.out('Ils ne vous voient meme pas !'); return 'wait'; }
    if (GARDES.includes(x2)) return await die(g, "On ne m'achete pas,moi !", 'Il arme son plasma gun,vous met en joue...et tire.');
    if (x2 === GARDIEN && name === 'Une carte Nx') { // 10070 (the original forgets one of the 4 layers ; all 4 are opened here)
      g.out('Necarex va te recevoir...Avance!'); st.enc = 0; g.setCell(GARDIEN, [39, 38, 39, 38]); return 'wait';
    }
    if (x2 === GARDIEN) { g.out("Necarex n'aime pas les importunsaux offrandes inutiles !"); return 'wait'; }
    if (x2 === WARD && name === 'De vrais-faux papiers') {
      g.out('Tu fais partie de la resistance des Korkors,je le reconnais a laqualite du papier...'); await W(g);
      g.out('Que veux-tu savoir ?'); await W(g);
      const r = await wardQuestions(g); return r === 'leave' ? 'wait' : r;
    }
    if (x2 === WARD) { g.out('Tu es genereux,mais je n\'ai be- soin de rien...'); return 'wait'; }
    if (x2 === VOYOU && name === 'Des Necacredits') { // 10120 + 10150 (one layer was forgotten too ; fixed)
      g.out('OK,on est des potes ! Tu trou-  -veras un bar pres du port.Com- -mande du SPINA SANS GLACONS.'); await W(g);
      g.cls(33); g.out("Eh ! Tu m'as jamais vu,OK ?");
      st.credits = Math.max(0, st.credits - 10); g.setCell(VOYOU, [38, 39, 38, 38]); st.enc = 0; return 'wait';
    }
    if (x2 === VOYOU && name === "Une pepite d'or") { g.out("Ouah ! c'est beau mais dangereuxici, garde le !"); return 'wait'; }
    if (x2 === VOYOU) { g.out("J'aime pas les radins !"); return await R().combat(g, 2); }
    g.out("Et c'est pour qui,le cadeau ?"); return 'wait';
  }

  /* ================= D4.BAS : Porkus' bar (50) and Necarex (95) ================= */
  async function d4(g) {
    const st = g.st;
    for (;;) {
      const x2 = st.pos;
      g.redrawScene(); // no leftover window under the dialogue menu
      const a = await g.menu(['Dire', 'Menacer', 'Supplier', 'Offrir', 'Demander', 'Ordonner', 'Retour'], 8, 5, 8);
      let r;
      if (a === 7) { await W(g); return 'nowait'; }
      if (a === 4) { await offer(g); continue; } // 4000
      if (x2 === BAR) r = await porkus(g, a); else r = await necarex(g, a);
      if (r === 'menu') continue;
      if (r === 'leave') { await W(g); return 'nowait'; }
      return r;
    }
  }
  const MENUS = {
    1: [['Salut ! Ca va ? ', "Moi,c'est James. ", 'Sale temps,hein ?', 'Vous etes moche !', "L'air est malsain"], 6, 6, 18],
    2: [["P'tite tete,va !", 'Tu fais pas le poids !', 'Retourne chez ta mere !', 'Numerote tes os,nabot !'], 3, 7, 24],
    3: [['Non,pas les dents !', 'Pitie,ne me tue pas !', 'Pense a mes gosses !', 'Ne me frappe pas !', 'Moi pas bon a manger!'], 5, 6, 24],
    5: [['Ou suis-je ?', 'Qui es-tu ?', 'Que veux-tu ?', 'Comment fuir ?'], 5, 5, 15],
    6: [['Rends-toi !', 'Aide-moi .', 'Donne-moi...'], 7, 8, 13]
  };
  async function porkus(g, verb) {
    const [items, x, y, lm] = MENUS[verb];
    const a = await g.menu(items, x, y, lm);
    g.cls(33);
    if (verb === 1) {
      if (a <= 3) { g.out(['', "Ca va bien,merci.Qu'est-ce que  vous buvez ?", "Enchante.Porkus.Qu'est-ce que jevous sers ?", 'En effet.Vous buvez quoi ?'][a]); return await bar(g); }
      g.out(a === 4 ? 'Eh,si vous voulez pas consommer,allez-vous en !' : 'Si ma taverne ne vous plait pas,sortez !'); return 'menu';
    }
    if (verb === 2) { // 2129 (&5FFF)
      const kw = g.flag('kw') + 1; g.setFlag('kw', kw);
      if (kw <= 3) { g.out(['', 'Visiblement,vous etes deja saoul...Dehors !', "Sors ou je t'aide !", '(Il pointe une lame) Dehors !'][kw]); return 'menu'; }
      g.out("Tu l'as cherche !"); return await R().combat(g, 1);
    }
    if (verb === 3) { g.out(a === 2 || a === 4 ? "Du calme,c'est pas du NUKIS que je vais te servir !" : a === 5 ? 'Ici,on mange pas,on boit !' : a === 3 ? 'Navre,on ne sert rien pour les gamins,ici !' : 'Si t\'as un probleme,tu sors !'); return 'menu'; }
    if (verb === 5) { g.out(['', "T'as bu ou quoi ?", "Je suis Porkus,patron de 'Chez  Porkus'.", 'Te servir a boire.', 'Je n\'en sais rien,et je ne veux pas le savoir !'][a]); return 'menu'; }
    g.out(['', 'Pourquoi ? Tu veux te battre ?', 'Je ne peux rien pour toi.', 'Je ne donne pas,je vends !'][a]); return 'menu';
  }

  async function bar(g) { // 21000-23010
    const st = g.st;
    let withSpina = true;
    for (;;) {
      const drinks = withSpina ? ['Vin', 'Spina', 'Eau', 'Niack', 'Nukis', 'Sortir'] : ['Vin', 'Eau', 'Niack', 'Nukis', 'Sortir'];
      const b = drinks[(await g.menu(drinks, withSpina ? 8 : 7, withSpina ? 4 : 3, 6)) - 1];
      g.cls(34);
      if (b === 'Sortir') { g.out('Au revoir...', 34); return 'leave'; }
      g.out('C\'est 100 Necacredits .', 34);
      if (st.credits < 1) { g.out('Mais tu ne les as pas ! Dehors ! Ivrogne !', 34); return 'leave'; }
      if (b === 'Spina') {
        g.out('Avec ou sans glacons ?', 34);
        const gsel = await g.menu(['AVEC', 'SANS'], 7, 6, 4); // 22100 : WINDOW 7,12,6,9
        g.cls(33);
        if (gsel === 1) { st.credits--; g.out("Navre,je crois que je n'en ai   plus !"); withSpina = false; continue; }
        if (g.flag('banned')) { g.out("Je t'ai dit de ne plus revenir !Tu veux me faire reperer,ou     quoi ?"); return 'leave'; }
        st.credits--;
        g.out('Tu fais partie des Korkors ?    Suis-moi.'); await W(g);
        g.cls(33); g.out("Il vous introduit dans l'arriereboutique,qui est un magasin     clandestin.Faites vos emplettes!"); await W(g);
        return await shop(g);
      }
      st.credits--; // 22000
      if (b === 'Vin') { // 21090-21110 (the original writes the thirst into the hunger byte)
        st.vigil = Math.max(1, st.vigil - 5); st.faim = Math.min(40, st.soif + 15);
        g.out('Gloup,gloup,vous l\'avez bu !', 34);
      } else if (b === 'Eau') { st.soif = 40; g.out('Aaah ! Ca dessoiffe !', 34); }
      else if (b === 'Niack') {
        const n = g.flag('niack') + 1; g.setFlag('niack', n);
        if (n >= 3) { if (n % 3 === 0 && st.force > 2) st.force -= 2; g.out('Vous allez vous taper la cloche longtemps ?', 34); }
        else g.out("C'est fort,mais c'est bon !", 34);
      } else { // Nukis
        g.cls(34); return await die(g, "Helas...Seuls les mutants suppor-tent ce breuvage...Vous vous   couvrez de cloques vertes,et de-cedez sur place en suffoquant   dans d'atroces souffrances...");
      }
      await W(g);
    }
  }

  async function shop(g) { // 24000-25120
    const st = g.st;
    for (;;) {
      g.cls(33); g.out('Tout est a 100 Necacredits.');
      if (st.credits < 1) { g.out("Tu n'as pas d'argent pour payer!"); return 'leave'; }
      const a = await g.menu(['Armes', 'Drogues', 'Vivres', 'Sortir'], 9, 8, 7);
      if (a === 4) return 'leave';
      if (a === 1) {
        const w = await g.menu(['Detonateur', 'Grenade', 'Bazooka', 'Chrono', 'Uzi', 'Revolver', 'Chargeur', 'Plastique', 'Poignard'], 5, 4, 10);
        g.cls(33);
        if (st.inv.length >= 8) { g.out("C'est impossible,vous etes trop charge !"); return 'leave'; }
        st.credits = Math.max(0, st.credits - 1);
        st.inv.push([0, 31, 11, 32, 33, 12, 2, 1, 34, 14][w]);
        if ([31, 33, 34].every(o => st.inv.includes(o))) { // 24161-24166
          g.cls(33); g.out("Vous avez tous les composants   d'une bombe !"); await W(g);
          st.inv = st.inv.filter(o => ![31, 33, 34].includes(o)); st.inv.push(36);
          if ([31, 33, 34].includes(st.hand)) st.hand = 36;
        }
        const nbar = g.flag('nbar');
        if (nbar === 2) { g.setFlag('banned', 1); g.out('C\'est trop risque de te vendre  plus,alors pars et ne reviens   pas !'); return 'leave'; }
        g.setFlag('nbar', nbar + 1); continue;
      }
      if (a === 2) {
        if (g.flag('nbm') === 2) { g.cls(33); g.out("Je t'ai dit que tu n'en aurais  plus !"); await W(g); continue; }
        const d = await g.menu(['Kiful', 'Mistic', 'Pourkof', 'Korkus'], 6, 5, 7);
        st.credits = Math.max(0, st.credits - 1); g.cls(33);
        if (d === 2) return await die(g, 'Le Mistic est une drogue mortel-le.Pas de chance !');
        st.force = Math.min(10, st.force + [0, 2, 0, 1, 3][d]);
        g.out(['', 'Vous reprenez des forces.', '', 'Vous voila un peu fortifie.', "Whaow ! C'est la forme !"][d]); await W(g);
        if (g.flag('nbm') === 1) { g.setFlag('nbm', 2); g.cls(33); g.out('Je refuse de te vendre davantagede ces drogues desormais,c\'est  nocif !'); await W(g); }
        else g.setFlag('nbm', 1);
        continue;
      }
      await g.menu(['Viande', 'Biscuits', 'Fruits', 'Cereales', 'Legumes'], 7, 4, 8);
      st.credits = Math.max(0, st.credits - 1); st.faim = Math.min(50, st.faim + 15);
      if (g.flag('nbv') === 2) { g.setFlag('banned', 1); g.cls(34); g.out("La nourriture est rare,je ne peuxt'en vendre plus !", 34); await W(g); }
      else g.setFlag('nbv', g.flag('nbv') + 1);
    }
  }

  async function necarex(g, verb) {
    const [items, x, y, lm] = MENUS[verb];
    const a = await g.menu(items, x, y, lm);
    g.cls(33);
    const guards = async () => {
      g.cls(33); g.out('Humain,ta presence ici m\'agace !Gardes ! Mettez-le au neutrali- -seur macro-moleculaire !'); await W(g);
      return await neutralise(g);
    };
    const zombie = async () => {
      await W(g); g.cls(33); g.out("A l'instant ou il emet ces mots,vous etes pris par un engourdis--sement qui commence par le     thorax."); await W(g);
      g.cls(33); g.out('Vous vous endormez sur place...'); await W(g);
      g.cls(33); g.out('Vous vous reveillez,beaucoup    plus tard,sans realiser que     votre crane porte vingt-quatre  points de suture...'); await W(g);
      g.cls(33); g.out('Vous avez ete trepane...'); await W(g);
      g.cls(33); return await die(g, 'Desormais,vous faites partie a  jamais des esclaves zombies de  Necarex ...');
    };
    if (verb === 3) { g.out("Aaaah ... Qu'il est doux de se  sentir craint..."); await W(g); g.cls(33); g.out('Viens,humain,ne crains rien...  Donne-moi ton corps,et je ferai de toi un de mes serviteurs...'); return await zombie(); }
    if (g.flag('nbdn4') === 5) return await guards(); // &6DC1
    g.setFlag('nbdn4', g.flag('nbdn4') + 1);
    if (verb === 1) { g.out(['', 'Je suis operationnel a 100 %.', 'Silence ! Un etre organique ne  merite pas d\'identite nominale !', 'Les conditions meteorogiques et atmospheriques sont programmees a l\'annee.', 'Moche ? Que signifie ?', "C'est impossible ce bloc antisis-mique est aseptise."][a]); return 'menu'; }
    if (verb === 2) {
      const w = g.flag('arrogant'); // &6DC0
      if (w === 0) { g.out('Ne prends pas ce ton arrogant,  humain !'); g.setFlag('arrogant', 1); return 'menu'; }
      if (w === 1) { g.out('Humain,ta presence ici constitueun outrage !'); g.setFlag('arrogant', 2); return 'menu'; }
      g.out("C'en est trop ! Gardes ! Empa-  -rez-vous de lui !"); await W(g); return await neutralise(g);
    }
    if (verb === 5) {
      if (a === 3) { g.out('Donne-moi ton ame,humain,et tu  seras en communion avec moi a   jamais ...'); return await zombie(); }
      g.out(['', "Comment oses-tu,miserable ver,  renier de la sorte l'antre de   ton maitre ?", 'Tu ne me reconnais donc pas ? Jesuis pourtant le Dieu Supreme,  que l\'on venere et que l\'on     craint...', '', "Tu ne sortiras d'ici que lorsqueje l'aurai decide."][a]); return 'menu';
    }
    if (a === 3) { g.out("Je n'ai rien a t'offrir que la  plenitude sprituelle...Viens a  moi ... Viens a moi ..."); return await zombie(); }
    if (a === 2) { g.out('Moi ? T\'aider ? Decidement,je neme ferai jamais a la logique    humaine ...'); return 'menu'; }
    const k = g.flag('plait'); g.setFlag('plait', Math.min(2, k + 1));
    g.out(['Plait-il ?', "Serait-ce de l'humour ?", 'Je te trouve un peu repetitif,  humain ...'][k]); return 'menu';
  }
  async function neutralise(g) { // 20001-20002
    g.cls(33); g.out('Six gardes surgissent,vous      empoignent,et vous enferment    dans une cabine en plexiglas.'); await W(g);
    g.cls(33); g.out('En moins de quinze secondes,vousvous liquefiez en une atroce    bouillie jaunatre...'); await W(g);
    g.cls(33); g.out(''); return await die(g, 'Triste fin pour un heros...');
  }

  /* ================= OPTIONS.BAS 11623 + 30000 : the bomb ================= */
  async function dropped(g, o) {
    if (o !== 36 || g.st.pos !== GENERATEUR) return null;
    await W(g);
    g.say('La bombe est posee...'); await W(g);
    g.out('Il s\'agit a present de vous     mettre a l\'abri des deflagra-   -tions,mais ou ?');
    const a = await g.menu(['Maison avoisinante', 'Hors de la ville', 'Dans cette piece', 'Chez Necarex'], 5, 4, 18);
    g.cls(33);
    if (a === 1) { g.out('La batisse,trop fragile,s\'ef-   -fondre...'); await W(g); g.cls(33); return await die(g, 'Vous mourez,enseveli sous les   decombres.'); }
    if (a === 2) return await die(g, "Vous n'avez pas le temps d'at-  -teindre les portes de la cite, et etes litteralement souffle   par l'explosion.");
    if (a === 3) return await die(g, "C'est un veritable suicide !    Pourquoi,si pres du but ?");
    return 'victory';
  }

  const world3 = {
    id: 3, name: 'Monde III : New York', mapKey: '3',
    start: { pos: 11, dir: 0, inks: [10, 1, 3] },
    objects: { 19: 11, 22: 19, 32: 24, 38: 19, 43: 25, 55: 4, 78: 24 }, // D2.BAS 35518
    inventory: [13], hand: 13,
    views, dialogue, offer, dropped,
    offerAnywhere: true, // OPTIONS.BAS 11529 : in this world, Offrir goes straight to D3.BAS 10000
    noRest(g) { return g.st.pos === BAR; }, // 12000
    adversary(g) { // COMBAT.BAS 31-33
      const x2 = g.st.pos, c = g.codeAt(x2);
      if (x2 === VOYOU && c === 41) return 9;
      if (x2 === WARD && c === 48) return 12;
      if (x2 === BAR && c === 47) return 11;
      if (x2 === POLICE && c === 44) return 10;
      return 0;
    },
    async combatPrecheck(g) { // COMBAT.BAS 2-8
      const st = g.st, x2 = st.pos;
      if (x2 === NECAREX) { g.say('Gardes ! Gardes ! Emparez-vous  de ce profane ! Il a ose !      TUEZ-LE !!!'); await W(g); st.dead = 'story'; return 'dead'; }
      if (GARDES.includes(x2) || x2 === GARDIEN || x2 === POLICE) { g.say("Vous avez juste pense votre acteque vous etes...abattu !"); await W(g); st.dead = 'story'; return 'dead'; }
      if (x2 === SECTE && g.codeAt(SECTE) === 53) {
        if (st.hand === 11) {
          g.say('Vous jetez une grenade dans le  defile...'); await W(g);
          g.out('Tous les membres sont morts !'); st.hand = 0; R().removeObj(st, 11);
          g.setCell(SECTE, [39, 38, 39, 38]); st.enc = 0; await W(g);
          g.out('Au milieu des cadavres,brille unobjet metallique.'); st.objs[SECTE] = 27;
          return 'wait';
        }
        g.say(" 'Par Necarex !...Cet homme veutnotre mort ! Tuons le !!!'"); g.out('Toute la secte se rue sur vous !Vous etes lynche !'); await W(g);
        st.dead = 'story'; return 'dead';
      }
      return null;
    },
    grenadeRoof(g) { return g.st.pos === BAR || g.st.pos === WARD; },
    threatConvincing(g) { return g.st.pos === WARD ? 1 : 0; }, // 21010-21020
    async threatAlone(g) { // 21090
      if (g.st.pos !== BAR) return null;
      g.say('Sale ivrogne...bats toi !'); await W(g); return await R().combat(g, 2);
    },
    look(g) { return g.st.pos === 57 ? 'Un bout de papier traine par    terre...' : null; }, // 16003
    async read(g) { // 17500
      if (g.st.pos !== 57) return null;
      g.say("C'est une lettre emanant du     Pentagone."); await W(g);
      const big = g.bigWindow();
      await g.bp(big, 'Ct. Rawells        20/06/93.');
      await g.bp(big, "   Le projet NECAREX est en bonne voie.Sa mise en fonc- -tion aura lieu dans un an  au plus tard.");
      await g.bp(big, ''); await g.bp(big, '   La seule faille reside   dans la salle du generateur,je vous en parlerai ulteri- -eurement.');
      await W(g);
      await g.bp(big, ''); await g.bp(big, '   Demain,comme prevu,vous  recevrez les plans du micro--processeur et de son compartiment anti-atomique.');
      await g.bp(big, ''); await g.bp(big, '        Cordialement,'); await g.bp(big, ''); await g.bp(big, '              Ct.Burtis');
      return 'wait';
    }
  };

  window.ALIVE_WORLDS = window.ALIVE_WORLDS || [];
  window.ALIVE_WORLDS.push(world3);
})();
