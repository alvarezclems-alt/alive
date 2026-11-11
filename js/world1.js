/* ALIVE - Web port. world1.js : MONDE I (les glaces).
 * Sources :
 *   - views  : dispatcher of PROG.BIN (&99D0..&9D06), texts at &9D46..&9FD4, files at &9FE0..
 *   - map    : CARTE.BIN (js/data/maps.js)
 *   - start  : ALIVE.BAS lines 930-940 (objects, inventory, statistics)
 *   - story  : D.BAS (dialogues), OPTIONS.BAS lines 11564-11567, 16001, 17100, 25000 ; COMBAT.BAS 9, 31, 500-510
 * Cells : 9*row+col (row 0 at the south). 39 = epave, 58 = Cilla, 65 = dragon, 78 = village Gouark, 60 = lac.
 */
(function () {
  'use strict';
  const R = () => window.AliveRules;

  // view code -> picture (original file), inks (firmware), text segments (joined by CHR$(9) like &9D12)
  const V = (img, inks, text, extra) => Object.assign({ img: 'D1/' + img, inks, text }, extra || {});
  const INK_A = [13, 23, 11], INK_FOREST = [11, 23, 14], INK_DESERT = [2, 23, 14], INK_DEAD = [14, 23, 11];
  const T = {
    epave: ["L'epave de votre avion."],
    desert: ['Vous etes dans un desert', 'ou la   glace est reine.'],
    foret: ['La foret se dessine au loin.']
  };
  const views = {
    0: { text: ['AHHH ! Vous tombez dans le vide.'], death: true },
    1: V('ALIVE2', INK_A, T.epave),
    3: V('ALIVE4', INK_A, ['De la neige a perte de', 'vue.']),
    4: V('ALIVE5', INK_FOREST, T.foret),
    5: V('ALIVE6', INK_FOREST, ['Vous approchez les lacs', 'glaces,  prudence !']),
    7: V('ALIVE8', [12, 23, 2], ['Vous etes dans une region', 'monta  -gneuse.']),
    8: V('ALIVE9', INK_DEAD, ['Vous etes dans la foret,tous les', 'arbres sont morts...']),
    9: V('ALIV10', INK_DESERT, T.desert),
    10: V('ALIV11', [23, 2, 14], ["Vous etes au pied d'une", 'falaise, un pas de plus', "et c'est la chute mortelle !"]),
    11: V('ALIV12', null, ['Une crevasse...']), // no INK change in the original: keeps the previous colours
    12: V('ALIV13', [12, 14, 15], ["Vous etes au pied d'un precipice,au loin vous apercevez un paysagetropical !"]),
    13: V('ALIV14', [9, 10, 13], ['Vous entrez dans un', 'village...'], { raw: true, encounter: true }),
    14: V('ALIV15', INK_DEAD, ['Une etrange rencontre !!!'], { encounter: true }),
    15: V('ALIV16', INK_DESERT, ['Un fracas de glace', 'brisee...'], { encounter: true }),
    16: V('ALIV17', INK_DESERT, T.desert),
    17: V('ALIV18', INK_FOREST, T.foret),
    18: V('ALIVE2', INK_A, T.epave),
    70: V('ALIV14', [9, 10, 13], ['Le village des Gouarks.'], { raw: true })
  };

  const CILLA = 58, DRAGON = 65, VILLAGE = 78, LAC = 60, EPAVE = 39;

  /* ---------------------------------------------------------------- */
  /* D.BAS                                                             */
  /* ---------------------------------------------------------------- */
  async function dialogue(g) {
    const st = g.st, F = k => g.flag(k), S = (k, v) => g.setFlag(k, v);
    const w = () => g.waitKey();
    let x2 = st.pos;
    const present = () => x2 === DRAGON || x2 === CILLA || x2 === VILLAGE;
    // line 1159 & co : 4 blank PRINTs in WINDOW 2,33,21,24 (scrolls the window clean)
    const blank = () => { const t = g.txt(33); for (let i = 0; i < 4; i++) t.println(''); };
    // line 25 : leave the dialogue unless the council is in session (&5FFB)
    const leave = async () => { if (F('council') !== 1) { await w(); return true; } return false; };

    for (;;) {
      g.redrawScene(); // no leftover window under the dialogue menu
      const a = await g.menu(['Dire', 'Menacer', 'Supplier', 'Offrir', 'Demander', 'Ordonner', 'Retour'], 8, 5, 8); // 130
      g.txt(34);
      x2 = st.pos; // line 400 : position re-read on every pass (Cilla may have moved James to the village)
      // 401-402
      if (x2 === VILLAGE && g.codeAt(VILLAGE) === 70) { g.say('Les villageois vous encouragent,en attendant votre depart.'); await w(); return 'nowait'; }
      if (x2 === DRAGON && g.codeAt(DRAGON) !== 15) { g.cls(34); g.out("Le dragon s'est decompose !", 34); if (await leave()) return 'nowait'; continue; }
      if (x2 === CILLA && g.codeAt(CILLA) === 8) { g.cls(34); g.out("Le parfum d'une femme vous enivret-il tant ?", 34); if (await leave()) return 'nowait'; continue; }
      let r;
      if (a === 1) r = await dire(g, blank, present);
      else if (a === 2) r = await menacer(g, blank);
      else if (a === 3) r = await supplier(g, blank);
      else if (a === 4) { r = await R().verbs.deposer(g, true); await w(); continue; } // 4000 -> OPTIONS aig 50 -> back to D
      else if (a === 5) r = await demander(g, blank);
      else if (a === 6) r = await ordonner(g, blank);
      else { if (await leave()) return 'nowait'; continue; } // Retour -> 25
      if (r === 'menu') continue;
      if (r === 'leave') { if (await leave()) return 'nowait'; continue; }
      return r; // 'dead', 'combat result', 'nowait'
    }
  }

  async function toCombat(g, who) { return await R().combat(g, who); }

  async function council(g) { // 1172 : "On vous conduit devant le Conseil des Trois Sages."
    g.cls(34); g.out('On vous conduit devant le Conseildes Trois Sages.', 34);
    await g.waitKey();
    g.screen.setInks(15, 13, 16); g.screen.showScene(window.CPC.scene('D1/ALIV21'));
    g.setFlag('council', 1);
  }
  async function welcome(g) { // 22015
    await g.waitKey(); g.cls(34); g.out('"Bienvenue, etranger !"', 34);
    g.setCell(CILLA, 8); g.st.enc = 0;
    await g.waitKey();
  }
  async function burn(g) { // 23000
    g.cls(34); g.out("Dommage ! Vous n'aurez pas fait long feu ...", 34); await g.waitKey();
    g.setFlag('council', 0); g.st.dead = 'story'; return 'dead';
  }

  async function dire(g, blank, present) { // 1000
    const st = g.st, x2 = st.pos;
    const a = await g.menu(['Salut ! Ca va ? ', "Moi,c'est James. ", 'Sale temps,hein ?', 'Vous etes moche !', "L'air est malsain"], 6, 6, 18);
    blank();
    if (!present()) { g.out('Ne delirez donc pas,vous voyez  bien que vous etes tout seul !'); return 'menu'; }
    if (x2 === DRAGON) { g.out("Il n'est pas tres loquace ..."); await g.waitKey(); return await toCombat(g, 1); } // 1161
    if (x2 === CILLA) g.setFlag('cilla', 1); // 1170 (&6DBA)
    if (x2 === VILLAGE && g.flag('cilla') !== 1) await council(g); // 1172
    if (x2 === VILLAGE && g.flag('cilla') === 2) { // 1173
      g.cls(34); g.out("Sale vermine! Mes gardes t'ont vutuer Cilla ma fille dans la foret...Tu seras brule vif !", 34);
      await g.waitKey(); st.dead = 'story'; return 'dead';
    } else if (x2 === VILLAGE && g.flag('cilla') === 0) { g.setFlag('cilla', 1); await welcome(g); return 'menu'; }
    if (x2 === CILLA) { // 1180-1185
      if (a === 1) { g.out('On fait aller...'); return 'menu'; }
      if (a === 2 && !g.flag('helmet')) { g.setFlag('helmet', 1); g.out("Le mysterieux chevalier enleve  son heaume;c'est une charmante  demoiselle !"); return 'menu'; }
      if (a === 2) { g.out("Bon,ca va,on le sait !"); return 'menu'; }
      if (a === 4) { g.out('Sale porc...Defends toi !'); await g.waitKey(); return await toCombat(g, 2); }
      if (a === 3) { g.out("C'est le temps habituel ici..."); return 'menu'; }
      if (a === 5) { g.out('Je ne trouve pas...'); return 'menu'; }
    }
    if (x2 === VILLAGE) { // 1200-1240
      if (a === 1) { g.out('Je vais bien,merci.'); return 'menu'; }
      if (a === 2) { g.out("Quel nom curieux ... Tu n'es pasd'ici ?"); return await story(g); }
      if (a === 3) { g.out('Il est vrai que le temps se gate...'); return 'menu'; }
      if (a === 4) { g.out("Quel impudent ! Qu'on brule ce  faquin !"); await g.waitKey(); return await burn(g); }
      if (a === 5) { g.out('Malsain ? Que voulez-vous dire ?'); return 'menu'; }
    }
    return 'menu';
  }

  async function menacer(g, blank) { // 2000
    const st = g.st, x2 = st.pos;
    const a = await g.menu(["P'tite tete,va !", 'Tu fais pas le poids !', 'Retourne chez ta mere !', 'Numerote tes os,nabot !'], 3, 7, 24);
    blank();
    if (x2 !== DRAGON && x2 !== CILLA && x2 !== VILLAGE) { // 2140
      const r = R().rnd(3);
      g.out(r === 1 ? 'Mesurez votre langage,mon ami !' : r === 2 ? "Il n'y a personne a menacer...  Vous etes grotesque !" : 'Ne soyez donc pas si agressif !');
      return 'menu';
    }
    if (x2 === DRAGON) { g.out("Visiblement,vous n'etes pas tresconvaincant ..."); await g.waitKey(); return await toCombat(g, 2); }
    if (x2 === VILLAGE && g.flag('council') === 1) { g.out("Quel impudent ! Qu'on brule ce  faquin !"); await g.waitKey(); return await burn(g); }
    if (x2 === VILLAGE) { g.out("Pourquoi effrayer ces braves    gens ?"); return 'menu'; }
    const nc = g.flag('threats'); // 2205 (&6DC9)
    if (nc === 1) { g.out('Sale vermine,defends ta graisse!'); await g.waitKey(); return await toCombat(g, 2); }
    g.setFlag('threats', nc + 1);
    g.out(['', 'Ne sois pas insolent !', 'Tu veux voir ?', "Elle est morte,je vis chez mon  pere.", 'Je vais m\'enerver...'][a]);
    return 'menu';
  }

  async function supplier(g, blank) { // 3000
    const st = g.st, x2 = st.pos;
    const a = await g.menu(['Non,pas les dents !', 'Pitie,ne me tue pas !', 'Pense a mes gosses !', 'Ne me frappe pas !', 'Moi pas bon a manger!'], 5, 6, 22);
    blank();
    if (x2 !== DRAGON && x2 !== CILLA && x2 !== VILLAGE) { g.out('Allons,mon brave,remettez vous !'); return 'menu'; }
    if (x2 === DRAGON) { g.out('Groo ?'); await g.waitKey(); return await toCombat(g, 1); }
    if (x2 === CILLA) {
      if (a === 1 || a === 2 || a === 4) g.out('Tu es bien couard !');
      else if (a === 3) g.out('Tu as des enfants ?');
      else g.out('Rassure-toi,je vais pas te bouf-fer !');
      return 'menu';
    }
    if (g.flag('council') === 1) { // 3140
      g.out("L'Elu n'a peur de rien..."); g.out('Reconduisez-moi cette Larve !'); await g.waitKey();
      g.cls(34); g.out('Loin du village,seul,epuise,mortde faim,vous mourez,anonyme,dans cet univers etrange...', 34);
      await g.waitKey(); st.dead = 'story'; return 'dead';
    }
    g.out('Les gens semblent decus.'); await g.waitKey(); return 'menu';
  }

  async function demander(g, blank) { // 5000
    const st = g.st, x2 = st.pos;
    const a = await g.menu(['Ou suis-je ?', 'Qui es-tu ?', 'Que veux-tu ?', 'Comment fuir ?'], 5, 5, 15);
    blank();
    if (x2 !== DRAGON && x2 !== CILLA && x2 !== VILLAGE) { g.out("C'est a moi que vous posez la   question ?"); return 'menu'; }
    if (x2 === DRAGON) { g.out('Grooo !!!!'); await g.waitKey(); return await toCombat(g, 1); }
    if (x2 === CILLA) {
      const h = g.flag('helmet');
      if (a === 1) { g.out('Tu es dans la foret des Gouarks.'); return 'menu'; }
      if (a === 2 && !h) { g.out('Presente-toi,toi d\'abord !'); return 'menu'; }
      if (a === 2) { g.out('Je suis Cilla,fille de Hourokos,le chef des Gouarks !'); return 'menu'; }
      if (a === 3 && !h) { g.out('Ta vie !'); return 'menu'; }
      if (a === 3) { g.out("Que tu acceptes mon hospitalite."); return await hospitality(g); }
      g.out("Je n'en sais rien."); return 'menu';
    }
    // VILLAGE
    if (g.flag('council') === 0) return await diresVillageEntry(g);
    g.out('Presente-toi, etranger !'); return 'menu';
  }
  // 5150 / 6017 : GOTO 1172 (asking or ordering in the village leads to the council too)
  async function diresVillageEntry(g) {
    const st = g.st;
    if (g.flag('cilla') !== 1) await council(g);
    if (g.flag('cilla') === 2) {
      g.cls(34); g.out("Sale vermine! Mes gardes t'ont vutuer Cilla ma fille dans la foret...Tu seras brule vif !", 34);
      await g.waitKey(); st.dead = 'story'; return 'dead';
    }
    if (g.flag('cilla') === 0) { g.setFlag('cilla', 1); await welcome(g); }
    return 'menu';
  }

  async function ordonner(g, blank) { // 6000
    const st = g.st, x2 = st.pos;
    const a = await g.menu(['Rends-toi !', 'Aide-moi .', 'Donne-moi...'], 7, 8, 13);
    g.txt(33); blank();
    if (x2 !== DRAGON && x2 !== CILLA && x2 !== VILLAGE) { g.out('A qui dites-vous cela ?'); return 'menu'; }
    if (x2 === DRAGON) { g.out('Graoumph !'); await g.waitKey(); return await toCombat(g, 1); }
    if (x2 === VILLAGE && g.flag('council') === 0) return await diresVillageEntry(g);
    if (x2 === VILLAGE) {
      g.out(a === 2 ? "Montre-moi que tu es l'Elu !" : a === 3 ? "Je n'ai rien pour toi." : 'Pour quoi faire ?');
      return 'menu';
    }
    g.cls(33); // 6080
    if (a === 1) { g.out('Plutot mourir ! Bats-toi !'); await g.waitKey(); return await toCombat(g, 2); }
    if (a === 2) { g.out("J'y suis prete,si tes intentionssont pures."); return 'menu'; }
    g.out("Je n'ai rien pour toi..."); return 'menu';
  }

  async function hospitality(g) { // 6090-6098
    const st = g.st;
    const win = g.frameWindow(4, 4, 14, 1);
    const su = await g.choice2(win, 'Acceptez-vous ?   ', 'OUI', 'NON', 1);
    if (su === 2) {
      g.say('Une autre fois, j\'espere...', "(Elle s'en va.)");
      g.setCell(CILLA, 8); st.enc = 0; g.setFlag('cilla', 0);
      return 'leave';
    }
    // 22000 : she takes you to the village (same facing direction)
    st.pos = VILLAGE; st.visited[VILLAGE] = 1;
    g.cls(34); g.out("Elle vous conduit,a travers la  foret,jusqu'a son village.", 34);
    await g.waitKey();
    g.cls(34); g.screen.setInks(9, 10, 13); g.screen.showScene(window.CPC.scene('D1/ALIV14', true));
    g.out('Vous entrez dans le village,pre-cede de Cilla qui vous mene au  Conseil des Trois Sages.', 34);
    g.setCell(CILLA, 8);
    await g.waitKey();
    g.screen.setInks(15, 13, 16); g.screen.showScene(window.CPC.scene('D1/ALIV21'));
    g.setFlag('council', 1);
    await welcome(g);
    return 'menu';
  }

  async function story(g) { // 24000 - 24531
    const st = g.st;
    const a = await g.menu(["Mon avion s'est ecrase.", "J'habite a New-York .", 'Si,pourquoi ?'], 3, 3, 24);
    g.txt(33);
    if (a === 2) { g.cls(33); g.out("C'est un envoye de Necarex !    Qu'on le brule !"); await g.waitKey(); return await burn(g); }
    if (a === 3) { g.cls(33); g.out("La vie hors du village est impos-sible ! Tu mens ! Brulez cet   espion de Necarex !"); await g.waitKey(); return await burn(g); }
    const W = () => g.waitKey();
    const low = (...l) => { const t = g.cls(33); l.forEach(x => t.println(x)); };
    let big;
    g.cls(33); g.setFlag('council', 0);
    g.out("- Un avion ? Je croyais que celan'existait plus ! (Les trois sa-ges se concertent)"); await W();
    low('(Le chef se retourne.)'); await W();
    g.cls(33); g.out('"...et il descendit de sa mon-  ture celeste pour aller liberer les peuples de l\'emprise du Mal..."'); await W();
    g.out(' Le plus vieux prend la parole:'); g.out('"L\'histoire des Gouarks,tu vas  connaitre..."'); await W();
    big = g.bigWindow();
    st.vigil = 50; st.faim = 50; st.soif = 40; // 24502 : POKE &6DA1,50:POKE &6DA2,50:POKE &6DA3,40
    await g.bp(big, " Il y a quatre-vingt annees que le Grand Cataclysme a   reduit la nature a neant...  Seuls,les Gouarks ont pu seregrouper pour survivre,tan-dis que s'est imposee au    monde la domination de l'in-humain Necarex...");
    await g.bp(big, "D'apres la prophetie,       l'Envoye du Passe detronera Necarex et liberera les     peuples asservis.(Une lueur d'espoir se reflete dans lesyeux des trois sages.)");
    await W(); big.cls();
    low(" (Le chef presente une espece decassette.)"); await W(); big.cls();
    await g.bp(big, " Vois...ceci est la clef de la liberte ! Si tu es l'elu de la prophetie tu en pos-  sedes la serrure...");
    await W();
    low("Les trois sages vous fixent d'unair anxieux, attendant un geste de votre part."); await W();
    if (!st.inv.includes(7)) { // 24507-24508
      big.cls();
      await g.bp(big, "Quelle n'est pas leur decep-tion lorsqu'ils constatent  qu'aucun de vos objets n'estcompatible avec la cassette...");
      await g.bp(big, "N'etant pas l'Elu,vous etes reconduit hors du village.");
      await W(); big.cls();
      await g.bp(big, 'Loin du village,seul,epuise,mort de faim,vous mourez,   anonyme,dans cet univers    etrange...');
      await W(); st.dead = 'story'; return 'dead';
    }
    low("Quelle n'est pas leur joie quandils apercoivent votre walkman !");
    big.cls();
    await g.bp(big, "Tu es arrive,tu es l'Elu !  La prophetie s'est enfin ac-complie ! Cette cassette quia coute la vie a tant de nosamis,va enfin pouvoir");
    await g.bp(big, 'reveler son secret.');
    await W();
    low("Mais la cassette ne peut malgre tout etre ecoutee:il manque les quatre piles du walkman !"); await W();
    g.cls(33); g.out('Comprenant cela,les sages vous  expliquent:'); await W();
    big.cls();
    await g.bp(big, "Quel malheur si pres du but!Tu seras donc bien seul a   affronter Necarex,comme     l'indique la prophetie...La cassette nous aurait permis de contacter la resistance  des Korkors, qui se bat     aussi contre Necarex.");
    await g.bp(big, 'Seuls les quatre emissaires de Necarex possedent des    piles.');
    await W(); big.cls();
    await g.bp(big, " Tu les reconnaitras aiseme-ment:ils ne sont pas hu-    mains ! Tu auras besoin de  force,de ruse et de sagacitepour t'approprier les piles et trouver la resistance.   Mais,une fois cela fait,il  te restera le plus dur...   NECAREX !!!!");
    await W();
    low('Le troisieme sage prend alors laparole:'); await W();
    big.cls(); await g.bp(big, " Pas si vite ! On ne connaitrien de cet homme...Il vientdu territoire sans vie !     Il doit prouver qu'il est  l'Elu !");
    await W();
    low("Les autres sages acquiescent    d'un hochement de la tete.Puis  le troisieme sage poursuit:");
    big.cls(); await g.bp(big, "  Si cet homme est vraiment l'Elu alors il est en mesurede reussir l'Epreuve des Gouarks.");
    await W();
    low('Les deux autres sages se taisentcomme si la mort etait apparue.', 'Les trois sages se concertent.'); await W();
    low('Les sages se retournent, et le  plus vieux prend la parole:'); await W();
    big.cls(); await g.bp(big, '  Puisqu\'il en est ainsi...'); await g.bp(big, "  Ecoute bien James,si tu esl'Elu cette epreuve tu reus-siras...");
    await W();
    low('Un des sages pose un enorme     glaive en argent sur la table.');
    st.inv.push(29); g.sfx('treasure'); // 24525
    big.cls(); await g.bp(big, '  Voici l\'epreuve:'); await W();
    big.cls();
    await g.bp(big, "   Lorsqu'en milieu du ciel, le soleil arrive,");
    await g.bp(big, '   Faisant face aux enfers,  en eclaire l\'entree,');
    await g.bp(big, '   Du dragon somnolent il    montre le repaire');
    await g.bp(big, '   Tout de glace et de neige en entier recouvert.');
    await g.bp(big, "   L'Elu,par sa presence,    doit le reveiller,");
    await g.bp(big, "   Et le sang de sa tete,    a l'eau pure mele,");
    await g.bp(big, "   Donnera a l'Elu la force  et le pouvoir");
    await g.bp(big, '   De vaincre Necarex,et se  couvrir de gloire.');
    await W();
    big.pen = 2; await g.bp(big, ''); await g.bp(big, '  Et maintenant prends ce     glaive,et va !'); big.pen = 1;
    low('Vous prenez le glaive et sortez.'); await W();
    g.setCell(VILLAGE, 70); st.enc = 0; // 24529
    return 'nowait';
  }

  /* ---------------------------------------------------------------- */
  /* hooks used by rules.js                                            */
  /* ---------------------------------------------------------------- */
  const world1 = {
    id: 1, name: 'Monde I : les glaces', mapKey: '1',
    start: { pos: EPAVE, dir: 0, inks: [13, 23, 11] },
    objects: { 30: 1, 40: 2, 48: 4, 49: 7, 67: 17, 77: 17 }, // ALIVE.BAS 930-940
    inventory: [13], hand: 13,
    views,
    dialogue,
    adversary(g) { // COMBAT.BAS 31
      const x2 = g.st.pos;
      if (x2 === DRAGON && g.codeAt(DRAGON) === 15) return 1;
      if (x2 === CILLA && g.codeAt(CILLA) === 14) return 8;
      return 0;
    },
    async combatPrecheck(g) { // COMBAT.BAS 9
      if (g.st.pos === VILLAGE) {
        g.say('En voyant votre hostilite,les   gardes se ruent sur vous et voustuent.');
        await g.waitKey(); g.st.dead = 'combat'; return 'dead';
      }
      return null;
    },
    async afterCombat(g, av, ar) { // COMBAT.BAS 508-510
      if (av === 8) g.setFlag('cilla', 2);
      if (g.st.pos === DRAGON && ar === 29) {
        await g.waitKey(); g.out('La tete du dragon roule a vos   pieds...'); g.st.objs[DRAGON] = 30;
      }
    },
    async offer(g) { // OPTIONS.BAS 11564-11567
      const x2 = g.st.pos;
      if (x2 === DRAGON) { g.say("J'ai l'inpression qu'il n'en a  que faire..."); return 'wait'; }
      if (x2 === VILLAGE) { g.say('Malgre la misere qui semble     regner,les villageois sont trop fiers pour accepter un don d\'un etranger...'); return 'wait'; }
      if (x2 === CILLA) { g.say("Merci,mais je n'en ai guere     besoin."); return 'wait'; }
      return null;
    },
    look(g) { return g.st.pos === EPAVE ? 'Votre journal de bord...' : null; }, // 16001
    async read(g) { // 17100
      if (g.st.pos !== EPAVE) return null;
      g.say('Message desespere ...'); await g.waitKey();
      const big = g.bigWindow();
      await g.bp(big, '  Voila une semaine que je  gis, maintenant, a cote de  la carcasse de mon avion.Ma radio et ma balise ont ete  detruites lors du crash.');
      await g.bp(big, ''); await g.bp(big, "  J'ai donc decide de ral-  lier la civilisation, en    laissant derriere moi le    corps de mon copilote et amiS.R. Clarck.");
      await g.bp(big, "  Mais ou aller ? Autour de moi ne s'offre qu'une eten- due de glace et de neige...                                     Ct. J.Butterfly.");
      return 'wait';
    },
    async dropped(g, o) { // 11622 -> 25000 : the dragon's head in the lake
      if (o !== 30 || g.st.pos !== LAC) return null;
      await g.waitKey();
      g.say('Vous jetez la tete dans le lac. Une mousse et une fumee blanche epaisse se degagent violemment.');
      await g.waitKey();
      g.out('Inhalant les emanations de gaz, vous perdez connaissance rapi-  -dement.');
      await g.waitKey();
      return 'world-end';
    },
    threatConvincing() { return 0; }, // OPTIONS.BAS 21001
    /* Added at the author's request (not in the 1991 code, where world I has no water at all) :
       the frozen lake can fill the gourde and be drunk from. */
    isWater(g) { return g.st.pos === LAC; },
    async useItem(g, o) { // "Utiliser" the dragon's head at the lake does the same as "Deposer" it there
      if (o !== 30 || g.st.pos !== LAC) return null;
      R().removeObj(g.st, 30); g.st.objs[LAC] = g.st.objs[LAC] || 30;
      return await world1.dropped(g, 30);
    }
  };

  window.ALIVE_WORLDS = window.ALIVE_WORLDS || [];
  window.ALIVE_WORLDS.push(world1);
})();
