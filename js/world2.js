/* ALIVE - Web port. world2.js : MONDE II (la jungle, les marais, le desert).
 * Sources :
 *   - views  : dispatcher of COMMENT2.BIN (&99F2..&9D29), pictures from disk 2
 *   - map    : CARTE2.BIN
 *   - start  : OPTIONS.BAS 25006-25016 (objects, 3000 Necacredits, cell 14)
 *   - story  : D2.BAS ; OPTIONS.BAS 11568-11579, 16002, 17300, 21030-21060 ; COMBAT.BAS 32-35, 501-515
 * People : 21 Varlox (enigme de Khaal), 55 mutant a l'epee, 70 l'Aurigouane, 85 Oktar le nomade ;
 * monsters ("Surprise...") at 37 41 48 52 58 ; "remous dans la vase" at 20 22 23 24.
 */
(function () {
  'use strict';
  const R = () => window.AliveRules;
  const V = (img, inks, text, extra) => Object.assign({ img: 'D2/' + img, inks, text }, extra || {});
  const ENC = { encounter: true }, RAW = { raw: true };
  const views = {
    0: { text: ['AHHH ! Vous tombez dans le vide.'], death: true },
    20: V('ALIV30', [9, 15, 12], ['Le sol parait meuble.']),
    21: V('ALIV25', [13, 9, 10], ['Le silence des marais...']),
    22: V('ALIVE7', [13, 9, 10], ['Des remous dans la vase !'], ENC),
    23: V('ALIV32', [6, 10, 9], ['Un mutant surgit devant', 'vous.'], ENC),
    24: V('ALIV28', [9, 13, 15], ['Un mutant vous menace', "d'une epee."], { encounter: true, raw: true }),
    25: V('ALIVE8', [15, 4, 14], ['Un mutant vous fait face.'], ENC),
    26: V('ALIV12', [24, 15, 2], ['Un etrange nomade...'], ENC),
    27: V('ALIVE1', [15, 3, 9], ['La jungle et ses charmes.']),
    28: V('ALIV31', [13, 4, 9], ['Surprise...'], ENC),
    29: V('ALIV27', [9, 15, 10], ['Vous decouvrez une epave.'], RAW),
    30: V('ALIV26', [15, 2, 9], ['Une riviere limpide coule', 'a vos  pieds.']),
    31: V('ALIV24', [3, 15, 4], ['Du sable et des roches.']),
    32: V('ALIV11', [25, 2, 15], ["Vous etes au pied d'un precipice,au loin le desert s'etend a l'in-fini."]),
    34: V('ALIV29', [2, 25, 15], ['Le desert, spectacle fascinant.']),
    35: { text: ['La chaleur, trop forte vous tue...!'], death: true },
    36: { text: ['Vous vous enfoncez dans des sa   -bles mouvants...'], death: true },
    37: { text: ["Le courant de l'eau vous", 'emporte.Dommage !'], death: true }
  };
  const VARLOX = 21, EPEE = 55, AURI = 70, OKTAR = 85;
  const MONSTERS = [37, 41, 48, 52, 58, 74, 78];
  const PEOPLE = [VARLOX, EPEE, AURI, OKTAR];
  const ALL = MONSTERS.concat(PEOPLE);

  /* ---------------- D2.BAS ---------------- */
  async function dialogue(g) {
    const st = g.st;
    const leave = async () => { await g.waitKey(); return 'nowait'; }; // line 25 -> 40000
    for (;;) {
      g.redrawScene(); // no leftover window under the dialogue menu
      const a = await g.menu(['Dire', 'Menacer', 'Supplier', 'Offrir', 'Demander', 'Ordonner', 'Retour'], 8, 5, 9);
      const x2 = st.pos; // 400
      let r;
      if (a === 1) r = await dire(g, x2);
      else if (a === 2) r = await menacer(g, x2);
      else if (a === 3) r = await supplier(g, x2);
      else if (a === 4) { await R().verbs.deposer(g, true); await g.waitKey(); continue; }
      else if (a === 5) r = await demander(g, x2);
      else if (a === 6) r = await ordonner(g, x2);
      else return await leave();
      if (r === 'menu') continue;
      if (r === 'leave') return await leave();
      return r;
    }
  }
  const combat = (g, who) => R().combat(g, who);

  async function dire(g, x2) { // 1000
    const st = g.st;
    const a = await g.menu(['Salut ! Ca va ? ', "Moi,c'est James. ", 'Sale temps,hein ?', 'Vous etes moche !', "L'air est malsain"], 6, 6, 18);
    g.cls(33);
    if (st.enc === 0) { g.out("Vous vous mettez a parler tout  seul...La folie vous guette !"); return 'leave'; } // 1160
    if (MONSTERS.includes(x2)) { g.out('GROUMF !'); return 'menu'; }
    if (x2 === EPEE) { g.out("Ne t'occupe pas de moi !        Bats-toi !"); await g.waitKey(); return await combat(g, 3); } // 1181 (&6DA4=21 -> defensive)
    const T = {
      [VARLOX]: ['Oui,Khaal est avec moi.', "C'est un nom ancien.Moi,c'est   Varlox.", 'Ici,c\'est comme ca tous les     jours.', null, "Dans les marais,rien d'etonnant a ca..."],
      [AURI]: ["Je n'ai rien a te dire ! Passe  ton chemin !", 'Que veux-tu que cela me fasse ?', 'Mefie-toi du temps,il est notre ennemi a tous.', null, "C'est ca ! Dis tout de suite queje pue !"],
      [OKTAR]: ['Non.', 'Et moi,Oktar.', "C'est vrai qu'il fait un peu    chaud.", null, 'Et alors ?']
    };
    if (a === 4) {
      if (x2 === VARLOX) { // 1190
        if (!g.flag('varloxInsult')) { g.setFlag('varloxInsult', 1); g.out("L'insulte ne mene a rien..."); } else g.out("Je t'ai dit que ca ne servait a rien !");
        return 'menu';
      }
      if (x2 === AURI) { g.out("Mais c'est qu'il m'insulte !    Bats-toi,si t'as des (CENSURE) !"); await g.waitKey(); return await combat(g, 1); }
      if (x2 === OKTAR) { // 1192
        const j = g.flag('oktar'); g.setFlag('oktar', j + 1);
        if (j === 0) { g.out('Ne sois pas insolent,petit ! Montromblon est susceptible !'); return 'menu'; }
        g.out('Je ne plaisantais pas !'); return await combat(g, 1);
      }
    }
    if (T[x2] && T[x2][a - 1]) { g.out(T[x2][a - 1]); return 'menu'; }
    return await menacer(g, x2); // no handler : the BASIC falls through to line 2000
  }

  async function menacer(g, x2) { // 2000
    const a = await g.menu(["P'tite tete,va !", 'Tu fais pas le poids !', 'Retourne chez ta mere !', 'Numerote tes os,nabot !'], 3, 7, 24);
    g.cls(33);
    if (!ALL.includes(x2)) { g.out('A qui dites-vous cela ?'); return 'leave'; }
    if (!PEOPLE.includes(x2)) { g.out('GROOOO !!!'); await g.waitKey(); return await combat(g, 1); }
    if (x2 === VARLOX) {
      const q = R().rnd(3);
      if (q === 1) { g.out('Des insultes,toujours des insultes !'); return 'menu'; }
      if (q === 2) { g.out("L'insulte est source de conflits..."); return await combat(g, 1); }
      g.out('Miserable...tu va offenser Khaal !'); return 'menu';
    }
    if (x2 === EPEE) { g.out('Personne ne me parle ainsi !    Bats-toi !'); await g.waitKey(); return await combat(g, 2); }
    if (x2 === AURI) { g.out('Comment oses-tu ? En garde !'); await g.waitKey(); return await combat(g, 2); }
    const c = g.flag('oktar'); // 2135-2137 (&6DC3)
    if (c === 0) { g.out('Mefie-toi de moi ...'); g.setFlag('oktar', 1); return 'menu'; }
    if (c === 1) { g.out('Je ne plaisante pas !'); g.setFlag('oktar', 2); return 'menu'; }
    g.out('Suicidaire,hein ?'); await g.waitKey();
    g.out('Il charge son tromblon,et vous  fait sauter la tete.'); await g.waitKey();
    g.st.dead = 'story'; return 'dead';
  }

  async function supplier(g, x2) { // 3000
    const a = await g.menu(['Non,pas les dents !', 'Pitie,ne me tue pas !', 'Pense a mes gosses !', 'Ne me frappe pas !', 'Moi pas bon a manger!'], 5, 6, 22);
    g.cls(33);
    if (!ALL.includes(x2)) { g.out("Vous vous mettez a parler tout  seul...La folie vous guette !"); return 'leave'; }
    if (!PEOPLE.includes(x2)) { g.out("Ne vous fatiguez pas,il n'a pas l'air bien fin..."); return 'menu'; }
    if (x2 === VARLOX) {
      g.out('Je veux bien te laisser la vie, mais reponds a mon enigme.'); await g.waitKey();
      g.cls(33); g.out('Si tu reponds,je te donnerai monbien le plus precieux.'); await g.waitKey();
      g.cls(33); g.out('Mais si tu ne reponds pas...'); await g.waitKey();
      return await enigme(g);
    }
    if (x2 === EPEE) { g.out(a === 5 ? 'Calme-toi,je vais pas te bouffer !' : a === 2 ? "J'hesite..." : a === 3 ? "T'as des gosses,toi ?" : 'Pffft ! Aucune dignite !'); return 'menu'; }
    if (x2 === AURI) { g.out(a === 1 || a === 4 ? 'Pour supplier,tu es fort !' : "C'est bon,calme-toi !"); return 'menu'; }
    g.out("Tu n'as donc aucun amour-propre?"); return 'menu';
  }

  async function enigme(g) { // 3094-3104
    const st = g.st;
    const w = g.frameWindow(2, 3, 25, 5);
    w.println(''); w.println(' Il detruit des montagnes'); w.println(' Il tue des rois'); w.println(' Il enleve des vies'); w.println(' De qui s\'agit-il ?');
    g.sfx('riddle');
    const box = g.frameWindow(4, 11, 15, 2);
    const answer = await g.inputLine(box, 14);
    g.cls(33);
    if (answer.includes('TEMPS')) {
      g.sfx('treasure'); g.out('Helas,tu as trouve...Tu as gagnele Talisman de Khaal !'); await g.waitKey();
      g.cls(33); g.out('(Il vous remet une pile.)');
      await g.waitKey();
      g.setFlag('enigme', 1); g.setCell(VARLOX, 21); st.enc = 0;
      st.piles++;
      if (st.piles === 4) { g.cls(34); g.out('Vous avez les quatre piles !', 34); }
      return 'leave';
    }
    g.cls(33); g.out('Khaal,tu as un nouveau serviteur...'); await g.waitKey();
    g.out('Un sourire sadique se dessine   sur ses levres...'); await g.waitKey();
    g.out("Vous n'avez pas trouve...Un brefetourdissement...Vous perdez con-naissance."); await g.waitKey();
    st.dead = 'story'; return 'dead';
  }

  async function demander(g, x2) { // 5000
    const a = await g.menu(['Ou suis-je ?', 'Qui es-tu ?', 'Que veux-tu ?', 'Comment fuir ?'], 5, 5, 15);
    g.cls(33);
    if (!ALL.includes(x2)) { g.cls(33); g.out('Navre de ne pouvoir vous repon  -dre.'); return 'menu'; }
    if (MONSTERS.includes(x2)) { g.out('SNOORT !!!'); return 'menu'; }
    if (a === 1) { g.out({ [VARLOX]: 'Tu es dans les Marais Maudits.', [EPEE]: 'Tu es dans la Foret Sauvage !   Que fais-tu la ?', [AURI]: 'Tu es sur la Crete de Necarex.', [OKTAR]: 'Apparemment,dans le desert...' }[x2]); return 'menu'; }
    if (a === 2) {
      if (x2 === VARLOX) {
        const k = g.flag('varloxName'); // &6DC4
        if (k === 0) { g.out('Je suis Varlox,Messager Cerebraldu Grand Maitre.'); g.setFlag('varloxName', 1); }
        else if (k === 1) { g.out("Je suis Varlox,et je n'aime pas me repeter."); g.setFlag('varloxName', 2); }
        else g.out('Si tu es bouche,je ne peux rien pour toi.');
        return 'menu';
      }
      if (x2 === EPEE) { g.out("Tu n'as pas a le savoir !"); return 'menu'; }
      if (x2 === AURI) {
        if (!g.flag('auriName')) { g.out("Je suis l'Aurigouane,Envoye par Necarex."); g.setFlag('auriName', 1); } else g.out('Tu as deja oublie ? Memoire     courte...');
        return 'menu';
      }
      if (!g.flag('oktarName')) { g.out('Je suis Oktar.'); g.setFlag('oktarName', 1); } else g.out('Je te l\'ai dit,il fallait       ecouter !');
      return 'menu';
    }
    if (a === 3) {
      if (x2 === VARLOX && !g.flag('enigme')) { g.out('Je veux que tu repondes a ma    question.'); await g.waitKey(); return await enigme(g); }
      const t = { [EPEE]: 'Me mesurer a toi !', [AURI]: 'Etre riche !', [OKTAR]: 'Le pouvoir,la gloire et la      richesse !' }[x2];
      if (t) g.out(t);
      return 'menu';
    }
    g.out({ [VARLOX]: 'Tu ne peux pas t\'enfuir.', [EPEE]: "Ce n'est pas possible.", [AURI]: "Je n'en sais rien.", [OKTAR]: "Pourquoi ? Tu n'es pas bien,ici?" }[x2]);
    return 'menu';
  }

  async function ordonner(g, x2) { // 6000
    const a = await g.menu(['Rends-toi !', 'Aide-moi .', 'Donne-moi...'], 7, 8, 13);
    g.cls(33);
    if (!ALL.includes(x2)) { g.out('Et puis quoi encore ?'); return 'leave'; }
    if (x2 === VARLOX && a === 1) { g.out("C'est a mon Dieu que je me      rends..."); return 'menu'; }
    if (x2 === EPEE) { g.out('Jamais ! Bats-toi !'); await g.waitKey(); return await combat(g, 3); }
    if (x2 === AURI && a === 1) {
      const k = g.flag('auriOrder'); // &6DC7
      if (k === 0) { g.out('De quoi ?'); g.setFlag('auriOrder', 1); return 'menu'; }
      if (k === 1) { g.out("Ah ben oui,j'avais bien         entendu...Tu plaisantes,non ?"); g.setFlag('auriOrder', 2); return 'menu'; }
      g.out('Visiblement,tu ne rigoles pas...Moi non plus !'); await g.waitKey();
      g.out('De sa lance,il vous eperonne a  la gorge...'); await g.waitKey();
      g.st.dead = 'story'; return 'dead';
    }
    if (x2 === OKTAR && a === 1) { g.out('Des clous !'); return 'menu'; }
    if (x2 === VARLOX) {
      g.out(a === 2 ? "Si tu reponds a mon enigme,j'y  consentirai." : 'Si tu veux la Pierre de Khaal,tudois repondre a mon enigme.');
      await g.waitKey(); return await enigme(g);
    }
    if (x2 === AURI && a === 2) { g.out("Tu vois ces monts ? D'ici       quelques siecles,le temps les   aura aneanties..."); return 'menu'; }
    if (x2 === OKTAR && a === 2) { g.out("Je n'en ai pas envie !"); return 'menu'; }
    if (x2 === AURI) { g.out('Donne-moi quelque chose de      precieux,et je te donnerai ma   pile.'); return 'menu'; }
    if (x2 === OKTAR) { g.out("Si tu veux quelque chose de moi,trouve-moi de l'or,parce qu'ici,y'en a pas des masses..."); return 'menu'; }
    return 'menu';
  }

  /* ---------------- walkman : D2.BAS 35503-35530 ---------------- */
  async function useWalkman(g) {
    const W = () => g.waitKey();
    g.say('Vous mettez en route votre walk -man...'); await W();
    let big = g.bigWindow(); await g.bp(big, '');
    await g.bp(big, " J'espere que cette cassetteest entre de bonnes mains...");
    await g.bp(big, "Notre camp vient d'etre as  -siege par des hommes a la  solde...de Necarex.Nous ne  pensons resister que tres   peu de temps...");
    await g.bp(big, "(Des bruits d'explosions se font entendre.).");
    await W();
    await g.bp(big, " Cette cassette est un appelau secours.Venez nous aider.Je suis conscient du fait   que vous viendrez trop tard maintenant, mais la resistan-ce des Korkors ne doit pas mourir !");
    await g.bp(big, " ...Je sais qu'il existe unetribu d'hommes libres par dela les marais maudits...    C'est a eux que je m'adresse...Si jamais vous entendez  cette cassette...(Des bruitsassourdissants d'explosions couvrent la voix du resis   -tant).");
    await W();
    await g.bp(big, "...J'ai..ai...ete...touche...contac..tez le vieux...aah...Steven...Ward...a New York...il vous aidera...(Vous n'entendez plus que des bruitsd'explosions et de mitrail  -leuses).");
    await W(); big.cls();
    g.say('La cassette est terminee...machi-nalement vous la retournez...'); await W();
    g.out('(Le son est meilleur.).'); g.out('Vous entendez une celebre chan- -son des BEE GEES !'); await W();
    g.cls(33); g.out('...puis:'); await W();
    big = g.bigWindow();
    await g.bp(big, 'Nous avons dissimule ce mes -sage car il ne doit pas tom-ber entre n\'importe quellesmains!');
    await g.bp(big, '');
    await g.bp(big, "  Si tu veux te joindre a laresistance des Korkors...tu trouveras dans le boitier decette cassette des faux pa  -piers ainsi qu'une carte   pour trouver la ville de NewYork et y penetrer.La au mil-ieu de son Eden tu tueras  Necarex...!");
    await W(); big.cls();
    g.say("La prophetie des Gouarks s'accom-plit a nouveau !"); await W();
    g.out('Vous traversez le desert,et vousarrivez au pied de la Ville...'); await W();
    // 35519 : the walkman becomes "De vrais-faux papiers"
    g.st.inv = g.st.inv.map(o => (o === 7 ? 28 : o)); if (g.st.hand === 7) g.st.hand = 28;
    return 'world-end';
  }

  const world2 = {
    id: 2, name: 'Monde II : la jungle', mapKey: '2',
    start: { pos: 14, dir: 0, inks: [13, 9, 10] },
    // Arrival facing east, in the marshes ("En face l'Est. Le silence des marais...", period screenshot).
    // The 1991 code kept the direction James faced at the lake : facing south, cell 14 shows
    // "Le sol parait meuble", a green picture easily taken for the jungle (reported by the author).
    enterDir: 3,
    // OPTIONS.BAS 25007 (cell in hex, object number)
    objects: { 28: 19, 30: 19, 42: 19, 40: 19, 12: 20, 38: 20, 60: 20, 31: 17, 34: 17, 46: 17, 79: 17, 49: 21, 50: 1, 77: 22,
      64: 6, 56: 6, 66: 6, 67: 6, 59: 6, 48: 8, 51: 23, 47: 19, 73: 6, 65: 6, 75: 6, 76: 6, 68: 6 },
    inventory: [13], hand: 13,
    views, dialogue, useWalkman,
    enter(g) { g.st.credits = 30; }, // 25006 : POKE &6DB7,30 (3000 Necacredits)
    adversary(g) { // COMBAT.BAS 32-35
      const x2 = g.st.pos, c = g.codeAt(x2);
      if ([20, 22, 23, 24].includes(x2) && c === 22) return 2;
      if ([37, 41, 48, 52, 58].includes(x2) && c === 28) return 3;
      if (x2 === AURI && c === 25) return 6;
      if (x2 === OKTAR && c === 26) return 7;
      if (x2 === VARLOX && c === 23) return 4;
      if (x2 === EPEE && c === 24) return 5;
      return 0;
    },
    async afterCombat(g, av) { // 515
      if (av >= 4 && av <= 7) { await g.waitKey(); g.out('Vous voyez une pile.'); g.st.objs[g.st.pos] = 18; }
    },
    threatConvincing(g) { // OPTIONS.BAS 21030-21060 (&6DB8)
      const x2 = g.st.pos;
      if (x2 === OKTAR || x2 === AURI) return 1;
      if (MONSTERS.includes(x2)) return Math.floor(Math.random() * 2);
      return 0;
    },
    async offer(g, name) { // OPTIONS.BAS 11568-11579
      const st = g.st, x2 = st.pos;
      if (x2 === VARLOX) { g.say("Merci...mais pourquoi s'attacherau materiel,quand le spirituel  est infiniment plus enrichissant?..."); return 'wait'; }
      if (x2 === EPEE) { g.say("Tu essaies de m'amadouer ? Tu   tombes assez mal !"); return 'wait'; }
      const pay = async () => { g.out('Je vois qu\'on s\'est compris...'); await g.waitKey(); g.out('Il vous remet une pile,avant de disparaitre.'); await g.waitKey(); st.enc = 0; };
      if (x2 === AURI && (name === "Une pepite d'or" || name === 'Des Necacredits')) {
        g.cls(33);
        if (name === "Une pepite d'or") R().removeObj(st, 23);
        await pay();
        st.piles++; g.setCell(AURI, 31);
        if (st.credits > 10 && name === 'Des Necacredits') st.credits -= 10; else st.credits = 0; // 11571
        if (st.piles === 4) { g.say('Ayant les quatre piles en votre possession,vous pouvez utiliser votre walkman...'); return 'wait'; }
        return 'nowait';
      }
      if (x2 === AURI) { g.say("Tu n'as rien de plus precieux ?"); return 'wait'; }
      if (x2 === OKTAR && name === "Une pepite d'or") {
        g.say('La,tu m\'interesses !'); await g.waitKey();
        g.out('Il vous remet une pile, avant dereprendre sa route.'); await g.waitKey();
        R().removeObj(st, 23); st.enc = 0; st.piles++; g.setCell(OKTAR, 34);
        if (st.piles === 4) { g.say('Ayant les quatre piles en votre possession,vous pouvez utiliser votre walkman...'); return 'wait'; }
        return 'nowait';
      }
      if (x2 === OKTAR) { g.say("Je n'aime pas ton present !"); return 'wait'; }
      return null;
    },
    look(g) { return g.st.pos === 14 ? 'Les Gouarks vous ont laisse un  message...' : null; }, // 16002
    async read(g) { // 17300
      if (g.st.pos !== 14) return null;
      g.say('C\'est une lettre du Chef des    Gouarks.'); await g.waitKey();
      const big = g.bigWindow();
      await g.bp(big, "   Nous savons maintenant   que tu es l'Elu,puisque tu  as reussi l'Epreuve du Dra- -gon.");
      await g.bp(big, "   La fumee blanche qu tu asrespiree est un puissant    somnifere.Aussi,nous t'avonstransporte dans le domaine  de Necarex durant ton somme.");
      await g.bp(big, '   Comme tu ne connais pas  le chemin qui mene au vil-  -lage des Gouarks,ta        capture ne represente en    aucun cas une menace pour   mon peuple...');
      await g.waitKey(); big.cls();
      await g.bp(big, '   PS:Tu trouveras dans une bourse 3000 Necacredits poursubvenir a tes besoins.');
      return 'wait';
    }
  };

  window.ALIVE_WORLDS = window.ALIVE_WORLDS || [];
  window.ALIVE_WORLDS.push(world2);
})();
