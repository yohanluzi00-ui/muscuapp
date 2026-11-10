// Fiitday · onglet Exercices : bibliothèque d'exercices avec un mannequin 3D animé.
// Chargé seulement à l'ouverture de l'onglet (import dynamique depuis app.js). Mannequin, matériel et animations
// sont entièrement générés ici (aucune image externe) ; seul three.js (licence MIT) est utilisé pour l'affichage 3D.
import * as THREE from "./three.module.min.js";

const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// proportions du mannequin (mètres) : environ 1,80 m
const L = { lumbar: 0.22, thorax: 0.30, shDrop: 0.045, shW: 0.185, hipDrop: 0.05, hipW: 0.088, ua: 0.30, fa: 0.265, th: 0.44, sh: 0.43, neck: 0.07 };

/* =====================================================================
   Muscles : nom, groupe
   ===================================================================== */
export const MUSCLES = {
  pectoraux: ["Pectoraux", "pectoraux"],
  deltoides_ant: ["Deltoïdes antérieurs", "epaules"], deltoides_lat: ["Deltoïdes latéraux", "epaules"], deltoides_post: ["Deltoïdes postérieurs", "epaules"],
  trapezes: ["Trapèzes", "dos"], dorsaux: ["Dorsaux", "dos"], lombaires: ["Lombaires", "dos"],
  biceps: ["Biceps", "bras"], triceps: ["Triceps", "bras"], avantbras: ["Avant-bras", "bras"],
  abdos: ["Abdominaux", "abdos"], obliques: ["Obliques", "abdos"],
  quadriceps: ["Quadriceps", "jambes"], ischios: ["Ischio-jambiers", "jambes"], fessiers: ["Fessiers", "jambes"],
  adducteurs: ["Adducteurs", "jambes"], abducteurs: ["Abducteurs (moyen fessier)", "jambes"], mollets: ["Mollets", "jambes"],
};
const GROUPS = [["tous", "Tous"], ["pectoraux", "Pectoraux"], ["dos", "Dos"], ["epaules", "Épaules"], ["bras", "Bras"], ["jambes", "Jambes"], ["abdos", "Abdos"]];

/* =====================================================================
   Bibliothèque d'exercices
   Pose : a = position de départ, b = autre extrémité du mouvement.
   Repère : x vers l'avant, y vers le haut, w = écart latéral (vers l'extérieur, de chaque côté).
   th : inclinaison du buste (0 debout, 90 allongé sur le ventre, -90 sur le dos)
   main / pied : [x, y, w] fixe, {t:[avant, haut, w]} lié au buste, {c: centre, r, d: direction} sur un arc
   ===================================================================== */
const STAND = { foot: [0, 0.085, 0.13], knee: [1, 0, 0.1], fdir: [1, 0, 0.15] };
const HANG = { t: [0.0, -0.6, 0.235] };
const ST = (o) => Object.assign({ pc: [-0.02, 0.975], th: 0 }, STAND, o);
const BENCH = { pc: [0, 0.565], th: -90, cp: 3, hp: -3, foot: [0.5, 0.085, 0.2], knee: [0.4, 1, 0.25], fdir: [1, 0, 0.25] };
const SEATED = (o) => Object.assign({ pc: [0, 0.6], th: -6, foot: [0.42, 0.085, 0.2], knee: [0.3, 1, 0.2], fdir: [1, 0, 0.2] }, o);
const PUSHUP_A = { pc: [-0.458, 0.403], th: 70.7, foot: [-1.32, 0.205, 0.10], fdir: [0.55, -0.84, 0.03], knee: [0, -1, 0], hdir: [1, 0, -0.1], hpose: "flat", palm: [0, -1, 0] };
const PUSHUP_B = { pc: [-0.398, 0.166], th: 85.9 };
const m = (o, p) => Object.assign({}, o, p);

export const EXOS = [
  /* ---------------- Pectoraux ---------------- */
  { id: "developpe-couche", n: "Développé couché", gear: "Barre et banc plat", lvl: "Débutant à confirmé", p: ["pectoraux"], s: ["triceps", "deltoides_ant"], reps: "6-10", rest: 120,
    tips: ["Omoplates serrées et basses, bien collées au banc", "Pieds à plat au sol, léger cambré naturel du bas du dos", "Descends la barre au bas des pectoraux, coudes à environ 45° du buste", "Pousse en soufflant, sans verrouiller brutalement les coudes"],
    err: ["Faire rebondir la barre sur la poitrine", "Décoller les fesses du banc", "Écarter les coudes à 90° (les épaules souffrent)"],
    vars: ["Développé incliné", "Développé couché haltères", "Développé à la machine", "Pompes"], order: "exc", ph: { exc: "Descente contrôlée", con: "Poussée" },
    a: m(BENCH, { hand: [-0.445, 1.02, 0.3], elbow: [0.85, -0.5, 0.85], hdir: [0, 1, 0], palm: [1, 0, 0] }), b: { hand: [-0.34, 0.665, 0.3] },
    props: P => { P.bench(-0.85, 0.35); P.rack(-0.82); }, imp: [{ t: "bar", r: 0.17 }] },
  { id: "developpe-incline", n: "Développé incliné", gear: "Barre et banc incliné", lvl: "Intermédiaire", p: ["pectoraux"], s: ["deltoides_ant", "triceps"], reps: "6-10", rest: 120,
    tips: ["Banc incliné à 30° environ, pas plus", "Omoplates serrées, poitrine sortie", "Descends la barre sur le haut des pectoraux", "Pousse à la verticale, au-dessus des épaules"],
    err: ["Incliner le banc trop fort (ça devient un exercice d'épaules)", "Décoller les fesses du banc", "Rebondir sur la poitrine"],
    vars: ["Développé couché", "Développé incliné haltères", "Développé à la machine"], order: "exc", ph: { exc: "Descente contrôlée", con: "Poussée" },
    a: { pc: [0.02, 0.58], th: -60, hand: [-0.38, 1.33, 0.29], elbow: [0.9, -0.6, 0.8], hdir: [0, 1, 0], palm: [1, 0, 0], foot: [0.45, 0.085, 0.2], knee: [0.3, 1, 0.2], fdir: [1, 0, 0.2] }, b: { hand: [-0.29, 0.89, 0.29] },
    props: P => { P.inclineBench(-60, 0.02, 0.58); P.rack(-0.66); }, imp: [{ t: "bar", r: 0.17 }] },
  { id: "developpe-couche-halteres", n: "Développé couché haltères", gear: "Haltères et banc plat", lvl: "Débutant", p: ["pectoraux"], s: ["triceps", "deltoides_ant"], reps: "8-12", rest: 90,
    tips: ["Haltères au-dessus des épaules au départ, bras presque tendus", "Descends en ouvrant les coudes à 45°, haltères au niveau de la poitrine", "Remonte en rapprochant légèrement les haltères", "Garde les omoplates serrées pendant toute la série"],
    err: ["Descendre trop bas et tirer sur les épaules", "Laisser tomber les haltères en fin de série", "Taper les haltères l'un contre l'autre en haut"],
    vars: ["Développé couché", "Développé incliné haltères", "Écarté couché haltères"], order: "exc", ph: { exc: "Descente contrôlée", con: "Poussée" },
    a: m(BENCH, { hand: [-0.47, 1.02, 0.2], elbow: [0.85, -0.5, 0.85], hdir: [0, 1, 0], palm: [1, 0, 0] }), b: { hand: [-0.36, 0.67, 0.33] },
    props: P => P.bench(-0.85, 0.35), imp: [{ t: "db", grip: "R" }] },
  { id: "developpe-incline-halteres", n: "Développé incliné haltères", gear: "Haltères et banc incliné", lvl: "Débutant", p: ["pectoraux"], s: ["deltoides_ant", "triceps"], reps: "8-12", rest: 90,
    tips: ["Banc à 30°, dos et fesses en appui", "Haltères au-dessus des épaules, paumes vers l'avant", "Descends jusqu'à sentir l'étirement du haut des pectoraux", "Remonte sans verrouiller les coudes"],
    err: ["Banc trop incliné", "Coudes trop écartés", "Amplitude trop courte"],
    vars: ["Développé incliné", "Développé couché haltères", "Écarté à la poulie"], order: "exc", ph: { exc: "Descente contrôlée", con: "Poussée" },
    a: { pc: [0.02, 0.58], th: -60, hand: [-0.39, 1.32, 0.19], elbow: [0.9, -0.6, 0.8], hdir: [0, 1, 0], palm: [1, 0, 0], foot: [0.45, 0.085, 0.2], knee: [0.3, 1, 0.2], fdir: [1, 0, 0.2] }, b: { hand: [-0.32, 0.90, 0.36] },
    props: P => P.inclineBench(-60, 0.02, 0.58), imp: [{ t: "db", grip: "R" }] },
  { id: "ecarte-couche", n: "Écarté couché haltères", gear: "Haltères et banc plat", lvl: "Débutant", p: ["pectoraux"], s: ["deltoides_ant"], reps: "10-15", rest: 60,
    tips: ["Coudes légèrement fléchis, ils restent ainsi tout le mouvement", "Ouvre les bras en arc de cercle jusqu'à l'étirement des pectoraux", "Referme comme si tu enlaçais un tronc d'arbre", "Charge légère : c'est un exercice d'étirement, pas de force"],
    err: ["Plier et tendre les coudes (ça devient un développé)", "Descendre les haltères trop bas", "Prendre trop lourd"],
    vars: ["Pec deck (butterfly)", "Écarté à la poulie", "Développé couché haltères"], order: "exc", ph: { exc: "Ouverture", con: "Fermeture" },
    a: m(BENCH, { hand: { c: "sh", r: 0.53, d: [0.05, 1, -0.19] }, elbow: [0.25, -1, 0.3], palm: [0, 0, -1] }), b: { hand: { c: "sh", r: 0.53, d: [0.05, 0.17, 1] }, palm: [0, 1, -0.3] },
    props: P => P.bench(-0.85, 0.35), imp: [{ t: "db", grip: "U" }] },
  { id: "pompes", n: "Pompes", gear: "Poids du corps", lvl: "Débutant", p: ["pectoraux"], s: ["triceps", "deltoides_ant", "abdos"], reps: "10-20", rest: 60,
    tips: ["Mains un peu plus larges que les épaules", "Corps gainé et aligné des talons à la tête", "Descends jusqu'à frôler le sol avec la poitrine", "Coudes à 45° du buste, pas complètement écartés"],
    err: ["Bassin qui s'affaisse ou qui monte", "Amplitude trop courte", "Tête qui tombe vers le sol"],
    vars: ["Pompes diamant", "Développé couché", "Dips"], order: "exc", ph: { exc: "Descente", con: "Poussée" },
    a: m(PUSHUP_A, { hand: [0, 0.022, 0.3], elbow: [-0.8, 0.6, 0.65] }), b: PUSHUP_B, props: P => P.mat(-1.5, 0.4) },
  { id: "dips", n: "Dips", gear: "Barres parallèles", lvl: "Intermédiaire", p: ["pectoraux", "triceps"], s: ["deltoides_ant"], reps: "6-12", rest: 90,
    tips: ["Bras tendus au départ, épaules basses", "Penche légèrement le buste vers l'avant pour travailler les pectoraux", "Descends jusqu'à ce que les bras soient parallèles au sol", "Remonte en poussant fort, sans à-coups"],
    err: ["Descendre trop bas (épaules en danger)", "Hausser les épaules vers les oreilles", "Se balancer avec les jambes"],
    vars: ["Dips entre deux bancs", "Pompes", "Développé couché"], order: "exc", ph: { exc: "Descente", con: "Poussée" },
    a: { pc: [-0.08, 1.392], th: 10, hand: [0, 1.31, 0.25], elbow: [-1, 0, 0.25], hdir: [0, 1, 0], palm: [0, 0, -1], foot: [-0.40, 0.75, 0.08], knee: [1, 0, 0.1], fdir: [-0.6, -0.8, 0.05] },
    b: { pc: [-0.094, 1.136], th: 28, elbow: [-1, 0.1, 0.25], foot: [-0.42, 0.50, 0.08] },
    props: P => P.dips(1.37, 0.25) },
  { id: "pec-deck", n: "Pec deck (butterfly)", gear: "Machine", lvl: "Débutant", p: ["pectoraux"], s: ["deltoides_ant"], reps: "10-15", rest: 60,
    tips: ["Règle le siège pour avoir les poignées à hauteur de poitrine", "Dos bien plaqué contre le dossier", "Ramène les poignées devant toi en serrant les pectoraux", "Reviens lentement jusqu'à l'étirement"],
    err: ["Décoller le dos du dossier", "Laisser les poids claquer au retour", "Ouvrir trop loin derrière les épaules"],
    vars: ["Écarté couché haltères", "Écarté à la poulie", "Développé à la machine"], order: "con", ph: { con: "Fermeture", exc: "Ouverture lente" },
    a: SEATED({ th: -3, hand: { c: "sh", r: 0.5, d: [-0.05, -0.05, 1] }, elbow: [-0.2, -1, 0.3], palm: [1, 0, -0.2] }), b: { hand: { c: "sh", r: 0.5, d: [1, -0.08, -0.22] }, palm: [0, 0, -1] },
    props: P => { P.seat(0.02, 0.49); P.backPad(-3, 0, 0.6); P.frame(-0.42, 1.95); P.box([0.5, 0.06, 0.6], [-0.2, 1.86, 0]); P.stack(-0.62, 0); },
    imp: [{ t: "link", piv: [-0.03, 1.82, 0.22], to: "hand", pad: "grip" }, { t: "stackmove", ref: "hands", k: 0.5 }] },
  { id: "ecarte-poulie", n: "Écarté à la poulie", gear: "Poulies hautes (vis-à-vis)", lvl: "Intermédiaire", p: ["pectoraux"], s: ["deltoides_ant"], reps: "12-15", rest: 60,
    tips: ["Un pas en avant, buste légèrement penché", "Bras légèrement fléchis, ramène les poignées en arc de cercle", "Croise un peu les mains en fin de mouvement pour bien contracter", "Reviens lentement en gardant la tension"],
    err: ["Tirer avec les bras au lieu de serrer les pectoraux", "Se laisser emporter par les câbles au retour", "Hausser les épaules"],
    vars: ["Pec deck (butterfly)", "Écarté couché haltères"], order: "con", ph: { con: "Fermeture", exc: "Ouverture lente" },
    a: ST({ pc: [-0.03, 0.97], th: 12, hand: { c: "sh", r: 0.53, d: [-0.15, 0.35, 1] }, elbow: [-0.4, 0.5, 0.8], palm: [1, 0, 0], foot: [[0.2, 0.085, 0.13], [-0.22, 0.085, 0.13]], knee: [1, 0, 0.1] }), b: { hand: { c: "sh", r: 0.53, d: [0.85, -0.45, -0.2] }, palm: [0.3, 0, -1] },
    props: P => { P.tower(0.05, -1.05, 1.95); P.tower(0.05, 1.05, 1.95); }, imp: [{ t: "cable", from: [0.05, 1.95, 1.05], to: "hands", handle: "d", stacks: [0, 1] }], view: [1, 0.35, 0.45] },
  { id: "developpe-machine", n: "Développé à la machine", gear: "Machine (chest press)", lvl: "Débutant", p: ["pectoraux"], s: ["triceps", "deltoides_ant"], reps: "8-12", rest: 90,
    tips: ["Poignées à hauteur du milieu de la poitrine", "Dos plaqué, omoplates serrées", "Pousse devant toi sans verrouiller les coudes", "Reviens lentement jusqu'à l'étirement"],
    err: ["Décoller le dos du dossier", "Siège mal réglé (poignées trop hautes)", "Retour trop rapide"],
    vars: ["Développé couché", "Pec deck (butterfly)"], order: "con", ph: { con: "Poussée", exc: "Retour contrôlé" },
    a: SEATED({ th: -8, hand: [0.10, 1.03, 0.3], elbow: [-0.5, -0.6, 1], hdir: [0, 1, 0], palm: [1, 0, 0] }), b: { hand: [0.45, 1.06, 0.26] },
    props: P => { P.seat(0.02, 0.49); P.backPad(-8, 0, 0.6); P.frame(-0.5, 1.7); P.stack(-0.7, 0); },
    imp: [{ t: "link", piv: [-0.3, 1.6, 0.42], to: "hand", pad: "grip" }, { t: "stackmove", ref: "hands", k: 0.5 }] },

  /* ---------------- Dos ---------------- */
  { id: "tractions", n: "Tractions", gear: "Barre de traction", lvl: "Intermédiaire", p: ["dorsaux"], s: ["biceps", "trapezes", "avantbras"], reps: "5-10", rest: 120,
    tips: ["Prise un peu plus large que les épaules, paumes vers l'avant", "Pars bras tendus, épaules engagées", "Tire la poitrine vers la barre en abaissant les coudes", "Redescends lentement jusqu'aux bras tendus"],
    err: ["Se balancer pour monter", "Remonter à moitié", "Lâcher la descente"],
    vars: ["Tirage vertical", "Tirage horizontal"], order: "con", ph: { con: "Tirage", exc: "Descente lente" },
    a: { pc: [-0.02, 1.195], th: -8, hand: [0, 2.105, 0.36], elbow: [0, -1, 1], hdir: [0, 1, 0], palm: [1, 0, 0], foot: [-0.12, 0.305, 0.09], knee: [1, 0, 0], fdir: [0.3, -0.95, 0.05] },
    b: { pc: [-0.02, 1.62], th: -10, foot: [-0.12, 0.73, 0.09] }, props: P => P.pullup(2.17) },
  { id: "tirage-vertical", n: "Tirage vertical", gear: "Machine à poulie haute", lvl: "Débutant", p: ["dorsaux"], s: ["biceps", "trapezes", "deltoides_post"], reps: "8-12", rest: 90,
    tips: ["Cuisses bien calées sous les boudins", "Prise un peu plus large que les épaules", "Tire la barre vers le haut de la poitrine en abaissant les épaules", "Buste légèrement penché en arrière, poitrine sortie"],
    err: ["Tirer la barre derrière la nuque", "Se jeter en arrière pour tirer", "Laisser remonter la barre d'un coup"],
    vars: ["Tractions", "Tirage horizontal"], order: "con", ph: { con: "Tirage", exc: "Retour contrôlé" },
    a: { pc: [0, 0.555], th: -10, hp: 12, hand: [0.02, 1.52, 0.36], elbow: [-0.3, -1, 0.9], hdir: [0, 1, 0], palm: [1, 0, 0], foot: [0.47, 0.085, 0.15], knee: [0.5, 1, 0.1], fdir: [1, 0, 0.15] },
    b: { th: -17, cp: -6, hp: 4, hand: [0.11, 1.05, 0.36] },
    props: P => { P.seat(0.02, 0.45); P.box([1.15, 0.05, 0.4], [0.45, 0.025, 0]); P.box([0.06, 0.32, 0.06], [0.44, 0.47, 0]); P.roller(0.46, 0.655, 0.115, 0.17); P.roller(0.46, 0.655, -0.115, 0.17);
      P.box([0.08, 2.38, 0.12], [0.98, 1.19, 0]); P.box([1.02, 0.08, 0.1], [0.5, 2.36, 0]); P.wheel(0.08, 2.3, 0); P.stack(1.1, 0, [1.1, 2.36, 0]); },
    imp: [{ t: "cable", from: [0.08, 2.25, 0], to: "mid", handle: "lat", stacks: [0] }] },
  { id: "tirage-horizontal", n: "Tirage horizontal", gear: "Poulie basse (assis)", lvl: "Débutant", p: ["dorsaux", "trapezes"], s: ["biceps", "deltoides_post"], reps: "8-12", rest: 90,
    tips: ["Pieds sur les cales, genoux légèrement fléchis", "Dos droit, poitrine sortie", "Tire la poignée vers le nombril en serrant les omoplates", "Reviens bras tendus sans arrondir le dos"],
    err: ["Se balancer d'avant en arrière", "Arrondir le dos au retour", "Tirer avec les bras seulement"],
    vars: ["Tirage vertical", "Rowing barre", "Rowing haltère"], order: "con", ph: { con: "Tirage", exc: "Retour contrôlé" },
    a: { pc: [0, 0.51], th: 18, hand: [0.62, 0.86, 0.07], elbow: [-0.5, -1, 0.3], palm: [0, 0, -1], foot: [0.80, 0.22, 0.13], knee: [0.2, 1, 0.1], fdir: [0.1, 1, 0.1] },
    b: { th: -6, hand: [0.17, 0.71, 0.07], elbow: [-1, -0.2, 0.25] },
    props: P => { P.bench(-0.35, 0.85, 0.4); P.box([0.03, 0.32, 0.4], [0.9, 0.24, 0]); P.tower(1.12, 0, 0.55, 0.95); },
    imp: [{ t: "cable", from: [0.95, 0.55, 0], to: "mid", handle: "v", stacks: [0] }] },
  { id: "rowing-barre", n: "Rowing barre", gear: "Barre", lvl: "Intermédiaire", p: ["dorsaux", "trapezes"], s: ["biceps", "lombaires", "deltoides_post"], reps: "6-10", rest: 120,
    tips: ["Buste penché à 45°, dos bien droit", "Genoux légèrement fléchis, barre près des jambes", "Tire la barre vers le bas du ventre, coudes le long du corps", "Redescends lentement, bras tendus"],
    err: ["Arrondir le dos", "Se relever pour tirer", "Tirer la barre vers la poitrine (trop haut)"],
    vars: ["Rowing haltère", "Tirage horizontal", "Soulevé de terre"], order: "con", ph: { con: "Tirage", exc: "Descente contrôlée" },
    a: ST({ pc: [-0.18, 0.90], th: 50, hp: -20, hand: [0.19, 0.66, 0.25], elbow: [-0.6, 1, 0.15], palm: [-1, 0, 0], foot: [0, 0.085, 0.15], knee: [1, 0, 0.15] }), b: { hand: [0.0, 0.83, 0.25], elbow: [-1, 0.9, 0.12] },
    imp: [{ t: "bar", r: 0.2 }] },
  { id: "rowing-haltere", n: "Rowing haltère", gear: "Haltère et banc", lvl: "Débutant", p: ["dorsaux"], s: ["biceps", "trapezes", "deltoides_post"], reps: "8-12 par bras", rest: 60,
    tips: ["Une main et un genou sur le banc, dos plat", "Bras tendu sous l'épaule au départ", "Tire l'haltère vers la hanche, coude près du corps", "Redescends lentement sans tourner le buste"],
    err: ["Tourner le buste pour monter l'haltère", "Tirer vers l'épaule au lieu de la hanche", "Dos rond"],
    vars: ["Rowing barre", "Tirage horizontal"], order: "con", ph: { con: "Tirage", exc: "Descente contrôlée" },
    a: { pc: [-0.12, 0.85], th: 78, hand: [[0.40, 0.475, 0.20], [0.36, 0.42, 0.24]], elbow: [[0, 0, 1], [-0.3, 1, 0.3]], hdir: [[1, 0, -0.1], null], hpose: ["flat", "grip"], palm: [[0, -1, 0], [0, 0, -1]], foot: [[-0.55, 0.53, 0.17], [-0.05, 0.085, 0.36]], knee: [[0, -1, 0], [1, 0, 0.3]], fdir: [[-1, -0.15, 0], [1, 0, 0.2]] },
    b: { hand: [[0.40, 0.475, 0.20], [0.10, 0.80, 0.21]], elbow: [[0, 0, 1], [-0.6, 1, 0.1]] },
    props: P => P.bench(-0.75, 0.6, 0.45, -0.17), imp: [{ t: "db", grip: "F", hands: [1] }] },
  { id: "souleve-de-terre", n: "Soulevé de terre", gear: "Barre", lvl: "Confirmé", g: "dos", p: ["lombaires", "fessiers", "ischios"], s: ["trapezes", "quadriceps", "avantbras", "dorsaux"], reps: "3-6", rest: 150,
    tips: ["Barre au-dessus du milieu des pieds, contre les tibias", "Dos plat, poitrine sortie, regard devant", "Pousse dans le sol avec les jambes, la barre frôle les jambes", "Finis debout, hanches en avant, sans te cambrer"],
    err: ["Dos rond au départ", "Barre qui s'éloigne des jambes", "Tirer avec les bras pliés"],
    vars: ["Soulevé de terre roumain", "Rowing barre", "Hip thrust"], order: "con", ph: { con: "Montée", exc: "Descente contrôlée" },
    a: ST({ pc: [-0.301, 0.604], th: 61.6, hp: -30, hand: [0.12, 0.29, 0.27], elbow: [-0.3, 0, 0.3], palm: [-1, 0, 0], foot: [0, 0.085, 0.13], knee: [1, 0.1, 0.08] }),
    m: { pc: [-0.297, 0.876], th: 59, hp: -25, hand: [0.11, 0.57, 0.27] }, mt: 0.45, b: { pc: [-0.03, 0.975], th: 0, hp: 0, hand: [0.09, 0.895, 0.27] },
    imp: [{ t: "bar", r: 0.225 }] },
  { id: "pull-over", n: "Pull-over haltère", gear: "Haltère et banc plat", lvl: "Intermédiaire", g: "dos", p: ["dorsaux", "pectoraux"], s: ["triceps"], reps: "10-12", rest: 60,
    tips: ["Allongé, un haltère tenu à deux mains au-dessus de la poitrine", "Bras légèrement fléchis, descends l'haltère derrière la tête", "Va jusqu'à sentir l'étirement sous les bras", "Remonte en arc de cercle au-dessus de la poitrine"],
    err: ["Plier et tendre les coudes", "Descendre trop bas et forcer sur les épaules", "Cambrer fortement le bas du dos"],
    vars: ["Tirage vertical", "Écarté couché haltères"], order: "exc", ph: { exc: "Descente derrière la tête", con: "Retour" },
    a: m(BENCH, { hand: { c: "sh", r: 0.52, d: [0.02, 1, -0.17] }, elbow: [0, 0.2, 1], palm: [0, 0, -1] }), b: { hand: { c: "sh", r: 0.52, d: [-1, 0.12, -0.17] } },
    props: P => P.bench(-0.85, 0.35), imp: [{ t: "db1", axis: "fore" }] },
  { id: "shrugs", n: "Shrugs", gear: "Haltères", lvl: "Débutant", p: ["trapezes"], s: ["avantbras"], reps: "12-15", rest: 60,
    tips: ["Debout, haltères le long du corps", "Monte les épaules vers les oreilles, bras tendus", "Marque une pause en haut", "Redescends lentement"],
    err: ["Rouler les épaules", "Plier les bras", "Mouvement trop rapide"],
    vars: ["Rowing menton", "Soulevé de terre"], order: "con", ph: { con: "Élévation des épaules", exc: "Descente lente" },
    a: ST({ hand: HANG, palm: [0, 0, -1] }), b: { shrug: 0.06, hand: { t: [0, -0.54, 0.235] } }, imp: [{ t: "db", grip: "F" }] },
  { id: "extensions-lombaires", n: "Extensions lombaires", gear: "Banc à 45°", lvl: "Débutant", p: ["lombaires"], s: ["fessiers", "ischios"], reps: "12-15", rest: 60,
    tips: ["Bassin calé sur le boudin, pieds bloqués", "Bras croisés sur la poitrine", "Descends le buste en gardant le dos droit", "Remonte jusqu'à aligner le buste avec les jambes, pas plus"],
    err: ["Monter plus haut que l'alignement (cambrure)", "Arrondir le dos en bas", "Mouvement trop rapide"],
    vars: ["Soulevé de terre roumain", "Hip thrust"], order: "exc", ph: { exc: "Descente du buste", con: "Remontée" },
    a: { hipAt: [0, 0.95, 0], th: 45, hp: -10, hand: [{ t: [0.12, -0.1, -0.02] }, { t: [0.21, -0.19, -0.02] }], elbow: { t: [0, -0.3, 1] }, hpose: "flat", palm: { t: [-1, 0, 0] }, foot: [-0.59, 0.36, 0.11], knee: [0.7, -0.7, 0], fdir: [0.7, -0.7, 0.1] }, b: { th: 135, hp: 10 },
    props: P => P.hyperBench(0, 0.95) },

  /* ---------------- Épaules ---------------- */
  { id: "developpe-militaire", n: "Développé militaire", gear: "Barre", lvl: "Intermédiaire", p: ["deltoides_ant", "deltoides_lat"], s: ["triceps", "trapezes"], reps: "6-10", rest: 120,
    tips: ["Debout, barre posée sur le haut de la poitrine", "Abdos et fessiers serrés pour ne pas te cambrer", "Pousse la barre à la verticale, la tête recule un peu pour la laisser passer", "Finis bras tendus, barre au-dessus de la tête"],
    err: ["Se cambrer fortement", "Pousser la barre devant soi", "Utiliser les jambes pour lancer la barre"],
    vars: ["Développé haltères assis", "Développé épaules à la machine"], order: "con", ph: { con: "Poussée", exc: "Descente contrôlée" },
    a: ST({ pc: [-0.03, 0.975], th: -3, hand: [0.13, 1.42, 0.26], elbow: [1, -1, 0.5], hdir: [0, 1, 0], palm: [1, 0, 0] }), m: { hp: -14, hand: [0.09, 1.66, 0.25], elbow: [0.6, -0.5, 0.8] }, mt: 0.4, b: { hp: 0, hand: [-0.02, 1.99, 0.24], elbow: [0.2, 0, 1] },
    imp: [{ t: "bar", r: 0.2 }] },
  { id: "developpe-halteres-assis", n: "Développé haltères assis", gear: "Haltères et banc", lvl: "Débutant", p: ["deltoides_ant", "deltoides_lat"], s: ["triceps"], reps: "8-12", rest: 90,
    tips: ["Dossier presque vertical, dos bien en appui", "Haltères à hauteur des oreilles, paumes vers l'avant", "Pousse vers le haut en rapprochant légèrement les haltères", "Redescends jusqu'à hauteur des oreilles"],
    err: ["Cambrer le dos", "Descendre trop bas", "Taper les haltères en haut"],
    vars: ["Développé militaire", "Développé épaules à la machine", "Élévations latérales"], order: "con", ph: { con: "Poussée", exc: "Descente contrôlée" },
    a: SEATED({ hand: [0, 1.21, 0.38], elbow: [0.1, -1, 1], hdir: [0, 1, 0], palm: [1, 0, 0] }), b: { hand: [-0.02, 1.63, 0.2], elbow: [0, -0.2, 1] },
    props: P => { P.seat(0.02, 0.49); P.backPad(-6, 0, 0.6, 0.85); }, imp: [{ t: "db", grip: "R" }] },
  { id: "elevations-laterales", n: "Élévations latérales", gear: "Haltères", lvl: "Débutant", p: ["deltoides_lat"], s: ["deltoides_ant", "trapezes"], reps: "12-15", rest: 60,
    tips: ["Debout, haltères le long du corps, coudes légèrement fléchis", "Monte les bras sur les côtés jusqu'à l'horizontale", "Les coudes restent un peu plus hauts que les mains", "Redescends lentement"],
    err: ["Monter plus haut que les épaules", "Balancer le buste", "Hausser les épaules"],
    vars: ["Élévations frontales", "Oiseau", "Rowing menton"], order: "con", ph: { con: "Montée", exc: "Descente lente" },
    a: ST({ hand: { c: "sh", r: 0.53, d: [0.12, -1, 0.18] }, elbow: [-0.3, 1, 0.2], palm: [0, 0, -1] }), b: { hand: { c: "sh", r: 0.53, d: [0.12, -0.05, 1] }, palm: [0, -1, 0] },
    imp: [{ t: "db", grip: "F" }], view: [1, 0.3, 0.3] },
  { id: "elevations-frontales", n: "Élévations frontales", gear: "Haltères", lvl: "Débutant", p: ["deltoides_ant"], s: ["deltoides_lat", "pectoraux"], reps: "12-15", rest: 60,
    tips: ["Debout, haltères devant les cuisses", "Monte les bras devant toi jusqu'à hauteur des yeux", "Coudes très légèrement fléchis", "Redescends lentement sans balancer"],
    err: ["Se pencher en arrière pour monter", "Monter trop haut", "Mouvement trop rapide"],
    vars: ["Élévations latérales", "Développé militaire"], order: "con", ph: { con: "Montée", exc: "Descente lente" },
    a: ST({ hand: { c: "sh", r: 0.53, d: [0.33, -0.94, 0.05] }, elbow: [0, 0.4, 1], palm: [-1, 0, 0] }), b: { hand: { c: "sh", r: 0.53, d: [1, 0.12, 0.05] }, palm: [0, -1, 0] },
    imp: [{ t: "db", grip: "R" }] },
  { id: "oiseau", n: "Oiseau", gear: "Haltères", lvl: "Débutant", p: ["deltoides_post"], s: ["trapezes"], reps: "12-15", rest: 60,
    tips: ["Buste penché vers l'avant, dos plat", "Bras pendants, coudes légèrement fléchis", "Écarte les bras sur les côtés en serrant les omoplates", "Redescends lentement"],
    err: ["Se redresser pendant le mouvement", "Tirer avec les bras pliés (ça devient un rowing)", "Prendre trop lourd"],
    vars: ["Face pull", "Élévations latérales"], order: "con", ph: { con: "Ouverture", exc: "Descente lente" },
    a: ST({ pc: [-0.2, 0.88], th: 70, hp: -25, hand: { c: "sh", r: 0.53, d: [0.05, -1, 0.15] }, elbow: [0, 1, 0.5], palm: [0, 0, -1], foot: [0, 0.085, 0.14], knee: [1, 0, 0.15] }), b: { hand: { c: "sh", r: 0.53, d: [-0.05, -0.12, 1] }, palm: [0, -1, 0] },
    imp: [{ t: "db", grip: "F" }], view: [0.9, 0.45, 0.6] },
  { id: "face-pull", n: "Face pull", gear: "Poulie haute et corde", lvl: "Débutant", p: ["deltoides_post"], s: ["trapezes", "deltoides_lat"], reps: "12-15", rest: 60,
    tips: ["Poulie à hauteur du visage, corde prise à deux mains", "Tire la corde vers le front en écartant les mains", "Coudes hauts, au niveau des épaules", "Reviens lentement bras tendus"],
    err: ["Coudes trop bas", "Se pencher en arrière", "Tirer trop lourd"],
    vars: ["Oiseau", "Tirage horizontal"], order: "con", ph: { con: "Tirage", exc: "Retour contrôlé" },
    a: ST({ pc: [-0.05, 0.975], th: -6, hand: [0.42, 1.55, 0.08], elbow: [0, -0.3, 1], palm: [0, 0, -1] }), b: { hand: [0.14, 1.64, 0.26], elbow: [-0.4, 0.4, 1] },
    props: P => P.tower(1.08, 0, 1.72, 0.95), imp: [{ t: "cable", from: [0.95, 1.72, 0], to: "mid", handle: "rope", stacks: [0] }] },
  { id: "developpe-epaules-machine", n: "Développé épaules à la machine", gear: "Machine", lvl: "Débutant", p: ["deltoides_ant", "deltoides_lat"], s: ["triceps"], reps: "8-12", rest: 90,
    tips: ["Poignées à hauteur des épaules au départ", "Dos plaqué contre le dossier", "Pousse vers le haut sans verrouiller les coudes", "Redescends lentement"],
    err: ["Siège trop bas ou trop haut", "Cambrer le dos", "Retour trop rapide"],
    vars: ["Développé haltères assis", "Développé militaire"], order: "con", ph: { con: "Poussée", exc: "Descente contrôlée" },
    a: SEATED({ th: -8, hand: [0.06, 1.14, 0.36], elbow: [0.3, -1, 1], hdir: [0, 1, 0], palm: [1, 0, 0] }), b: { hand: [0.03, 1.60, 0.30], elbow: [0, -0.3, 1] },
    props: P => { P.seat(0.02, 0.49); P.backPad(-8, 0, 0.6, 0.85); P.frame(-0.45, 1.9); P.stack(-0.65, 0); },
    imp: [{ t: "link", piv: [-0.38, 1.25, 0.42], to: "hand", pad: "grip" }, { t: "stackmove", ref: "hands", k: 0.6 }] },
  { id: "rowing-menton", n: "Rowing menton", gear: "Barre", lvl: "Intermédiaire", p: ["deltoides_lat", "trapezes"], s: ["deltoides_ant", "biceps"], reps: "10-12", rest: 60,
    tips: ["Prise serrée, mains un peu plus étroites que les épaules", "Monte la barre le long du corps jusqu'en bas de la poitrine", "Les coudes montent plus haut que les mains", "Redescends lentement"],
    err: ["Monter la barre jusqu'au menton (épaules en souffrance)", "Balancer le buste", "Prise trop serrée"],
    vars: ["Élévations latérales", "Shrugs"], order: "con", ph: { con: "Montée", exc: "Descente lente" },
    a: ST({ hand: [0.09, 0.91, 0.12], elbow: [0, 0.2, 1], palm: [-1, 0, 0] }), b: { hand: [0.15, 1.36, 0.13], elbow: [-0.1, 1, 1] }, imp: [{ t: "bar", r: 0.15 }] },

  /* ---------------- Bras ---------------- */
  { id: "curl-halteres", n: "Curl biceps haltères", gear: "Haltères", lvl: "Débutant", p: ["biceps"], s: ["avantbras"], reps: "10-12", rest: 60,
    tips: ["Coudes collés au corps : ils ne bougent pas", "Paumes vers l'avant, monte jusqu'à bien contracter le biceps", "Redescends lentement jusqu'aux bras presque tendus"],
    err: ["Balancer le buste pour monter la charge", "Avancer les coudes en haut du mouvement", "Laisser retomber les haltères"],
    vars: ["Curl barre", "Curl marteau", "Curl à la poulie", "Curl pupitre"], order: "con", ph: { con: "Montée", exc: "Descente lente" },
    a: ST({ th: 1, hand: { c: { el: [0.02, -1, 0] }, r: L.fa, d: [0.5, -0.86, 0.18] }, elbow: [-1, 0, 0], palm: "sup" }), b: { th: -2, hand: { c: { el: [0.03, -1, 0] }, r: L.fa, d: [0.68, 0.73, -0.06] } },
    imp: [{ t: "db", grip: "R" }] },
  { id: "curl-barre", n: "Curl barre", gear: "Barre", lvl: "Débutant", p: ["biceps"], s: ["avantbras"], reps: "8-12", rest: 60,
    tips: ["Mains largeur d'épaules, paumes vers le haut", "Coudes fixes le long du corps", "Monte la barre jusqu'aux épaules sans balancer", "Redescends lentement, bras presque tendus"],
    err: ["Se cambrer pour monter la barre", "Coudes qui avancent", "Descente trop rapide"],
    vars: ["Curl biceps haltères", "Curl pupitre", "Curl à la poulie"], order: "con", ph: { con: "Montée", exc: "Descente lente" },
    a: ST({ th: 1, hand: { c: { el: [0.02, -1, 0] }, r: L.fa, d: [0.32, -0.95, 0] }, elbow: [-1, 0, 0], palm: "sup" }), b: { th: -2, hand: { c: { el: [0.03, -1, 0] }, r: L.fa, d: [0.68, 0.73, 0] } },
    imp: [{ t: "bar", r: 0.13, len: 1.3 }] },
  { id: "curl-marteau", n: "Curl marteau", gear: "Haltères", lvl: "Débutant", p: ["biceps", "avantbras"], s: [], reps: "10-12", rest: 60,
    tips: ["Pouces vers le haut, paumes face à face", "Coudes collés au corps", "Monte l'haltère jusqu'à l'épaule", "Redescends lentement"],
    err: ["Balancer le buste", "Décoller les coudes du corps", "Tourner les poignets"],
    vars: ["Curl biceps haltères", "Curl barre"], order: "con", ph: { con: "Montée", exc: "Descente lente" },
    a: ST({ th: 1, hand: { c: { el: [0.02, -1, 0] }, r: L.fa, d: [0.5, -0.86, 0.18] }, elbow: [-1, 0, 0], palm: [0, 0, -1] }), b: { th: -2, hand: { c: { el: [0.03, -1, 0] }, r: L.fa, d: [0.68, 0.73, -0.06] } },
    imp: [{ t: "db", grip: "F" }] },
  { id: "curl-poulie", n: "Curl à la poulie", gear: "Poulie basse et barre", lvl: "Débutant", p: ["biceps"], s: ["avantbras"], reps: "10-15", rest: 60,
    tips: ["Face à la poulie, barre prise paumes vers le haut", "Coudes fixes le long du corps", "Monte la barre jusqu'aux épaules", "Garde la tension en redescendant lentement"],
    err: ["Reculer le buste pour tirer", "Coudes qui avancent", "Lâcher la descente"],
    vars: ["Curl barre", "Curl biceps haltères"], order: "con", ph: { con: "Montée", exc: "Descente lente" },
    a: ST({ th: 1, hand: { c: { el: [0.02, -1, 0] }, r: L.fa, d: [0.32, -0.95, 0] }, elbow: [-1, 0, 0], palm: "sup" }), b: { th: -2, hand: { c: { el: [0.03, -1, 0] }, r: L.fa, d: [0.68, 0.73, 0] } },
    props: P => P.tower(0.66, 0, 0.12, 0.52), imp: [{ t: "bar", r: 0, len: 0.5 }, { t: "cable", from: [0.52, 0.12, 0], to: "mid", stacks: [0] }] },
  { id: "curl-pupitre", n: "Curl pupitre", gear: "Pupitre et barre EZ", lvl: "Débutant", p: ["biceps"], s: ["avantbras"], reps: "10-12", rest: 60,
    tips: ["Haut des bras bien à plat sur le pupitre", "Pars bras presque tendus", "Monte la barre en gardant les coudes sur le pupitre", "Redescends lentement, sans tendre complètement"],
    err: ["Décoller les coudes du pupitre", "Tendre brutalement les bras en bas", "Lever les fesses du siège"],
    vars: ["Curl barre", "Curl biceps haltères"], order: "con", ph: { con: "Montée", exc: "Descente lente" },
    a: { pc: [-0.05, 0.64], th: 8, hand: { c: { el: [0.62, -0.78, 0.05] }, r: L.fa, d: [0.75, -0.62, 0] }, elbow: [-0.6, -0.5, 0.1], palm: "sup", foot: [0.30, 0.085, 0.18], knee: [0.3, 1, 0.2], fdir: [1, 0, 0.2] },
    b: { hand: { c: { el: [0.62, -0.78, 0.05] }, r: L.fa, d: [-0.25, 0.97, 0] } },
    props: P => P.preacher(), imp: [{ t: "bar", r: 0.12, len: 1.35 }] },
  { id: "extension-poulie", n: "Extension triceps à la poulie", gear: "Poulie haute et barre", lvl: "Débutant", p: ["triceps"], s: [], reps: "10-15", rest: 60,
    tips: ["Coudes collés au corps, ils ne bougent pas", "Buste légèrement penché vers l'avant", "Pousse la barre vers le bas jusqu'à tendre les bras", "Remonte lentement jusqu'à hauteur de poitrine"],
    err: ["Décoller les coudes", "Se pencher sur la barre pour pousser", "Remonter trop haut"],
    vars: ["Barre au front", "Extension nuque haltère", "Dips entre deux bancs"], order: "con", ph: { con: "Extension", exc: "Remontée lente" },
    a: ST({ pc: [-0.06, 0.975], th: 12, hand: { c: { el: [-0.12, -1, 0] }, r: L.fa, d: [0.72, 0.68, -0.05] }, elbow: [-1, 0.1, 0], palm: "pro" }), b: { hand: { c: { el: [-0.12, -1, 0] }, r: L.fa, d: [0.22, -1, -0.03] } },
    props: P => P.tower(0.55, 0, 2.0, 0.4), imp: [{ t: "bar", r: 0, len: 0.5 }, { t: "cable", from: [0.4, 2.0, 0], to: "mid", stacks: [0] }] },
  { id: "barre-au-front", n: "Barre au front", gear: "Barre EZ et banc plat", lvl: "Intermédiaire", p: ["triceps"], s: [], reps: "8-12", rest: 90,
    tips: ["Allongé, barre au-dessus du visage, bras tendus", "Les coudes restent fixes et pointent vers le plafond", "Descends la barre vers le front en pliant les coudes", "Remonte en tendant les bras"],
    err: ["Écarter les coudes", "Bouger les bras d'avant en arrière", "Charge trop lourde (coudes douloureux)"],
    vars: ["Extension triceps à la poulie", "Extension nuque haltère"], order: "exc", ph: { exc: "Descente vers le front", con: "Extension" },
    a: m(BENCH, { hand: { c: { el: [-0.28, 1, 0.05] }, r: L.fa, d: [-0.28, 1, 0] }, elbow: [0.6, 1, 0.1], palm: "pro" }), b: { hand: { c: { el: [-0.28, 1, 0.05] }, r: L.fa, d: [-0.95, -0.3, 0] } },
    props: P => P.bench(-0.85, 0.35), imp: [{ t: "bar", r: 0.12, len: 1.35 }] },
  { id: "extension-nuque", n: "Extension nuque haltère", gear: "Haltère", lvl: "Débutant", p: ["triceps"], s: [], reps: "10-12", rest: 60,
    tips: ["Haltère tenu à deux mains au-dessus de la tête", "Coudes serrés, pointés vers le haut", "Descends l'haltère derrière la tête", "Remonte en tendant les bras"],
    err: ["Écarter les coudes", "Se cambrer", "Descendre trop vite"],
    vars: ["Barre au front", "Extension triceps à la poulie"], order: "exc", ph: { exc: "Descente derrière la tête", con: "Extension" },
    a: ST({ th: -3, hand: { c: { el: [-0.02, 1, -0.12] }, r: L.fa, d: [0.02, 1, -0.22] }, elbow: [0, 0, 1], palm: [0, 0, -1] }), b: { hand: { c: { el: [-0.02, 1, -0.12] }, r: L.fa, d: [-0.62, -0.75, -0.24] } }, imp: [{ t: "db1", axis: "up" }] },
  { id: "dips-banc", n: "Dips entre deux bancs", gear: "Banc", lvl: "Débutant", p: ["triceps"], s: ["pectoraux", "deltoides_ant"], reps: "10-15", rest: 60,
    tips: ["Mains sur le bord du banc, doigts vers l'avant", "Jambes tendues devant, talons au sol", "Descends en pliant les coudes vers l'arrière", "Remonte en tendant les bras"],
    err: ["Descendre trop bas", "Écarter les coudes", "Éloigner le dos du banc"],
    vars: ["Dips", "Extension triceps à la poulie"], order: "exc", ph: { exc: "Descente", con: "Poussée" },
    a: { pc: [0.02, 0.56], th: 0, hand: [-0.17, 0.475, 0.2], hdir: [1, -0.1, 0], hpose: "flat", palm: [0, -1, 0], elbow: [-1, 0.1, 0.2], foot: [0.75, 0.085, 0.12], knee: [0, 1, 0], fdir: [0.35, 0.94, 0.1] }, b: { pc: [0.04, 0.34] },
    props: P => P.benchZ(-0.3, 0.45) },
  { id: "kickback", n: "Kickback triceps", gear: "Haltères", lvl: "Débutant", p: ["triceps"], s: [], reps: "12-15", rest: 60,
    tips: ["Buste penché, dos plat", "Haut des bras le long du corps, immobile", "Tends les bras vers l'arrière", "Reviens lentement, avant-bras vers le sol"],
    err: ["Bouger le haut du bras", "Balancer les haltères", "Dos rond"],
    vars: ["Extension triceps à la poulie", "Barre au front"], order: "con", ph: { con: "Extension", exc: "Retour lent" },
    a: ST({ pc: [-0.24, 0.84], th: 78, hp: -30, hand: { c: { el: [-0.98, -0.2, 0.02] }, r: L.fa, d: [0.6, -0.8, 0] }, elbow: [0, 1, 0.1], palm: [0, 0, -1], foot: [0, 0.085, 0.14], knee: [1, 0, 0.15] }),
    b: { hand: { c: { el: [-0.98, -0.2, 0.02] }, r: L.fa, d: [-0.98, -0.2, 0] } }, imp: [{ t: "db", grip: "F" }] },
  { id: "pompes-diamant", n: "Pompes diamant", gear: "Poids du corps", lvl: "Intermédiaire", p: ["triceps"], s: ["pectoraux", "deltoides_ant"], reps: "8-15", rest: 60,
    tips: ["Mains rapprochées sous la poitrine, pouces et index qui se touchent", "Corps gainé des talons à la tête", "Descends en gardant les coudes près du corps", "Pousse jusqu'aux bras tendus"],
    err: ["Écarter les coudes", "Bassin qui s'affaisse", "Amplitude trop courte"],
    vars: ["Pompes", "Dips entre deux bancs"], order: "exc", ph: { exc: "Descente", con: "Poussée" },
    a: m(PUSHUP_A, { hand: [0, 0.022, 0.06], elbow: [-1, 0.5, 0.2] }), b: PUSHUP_B, props: P => P.mat(-1.5, 0.4) },

  /* ---------------- Jambes ---------------- */
  { id: "squat", n: "Squat", gear: "Barre", lvl: "Intermédiaire", p: ["quadriceps", "fessiers"], s: ["ischios", "lombaires", "abdos"], reps: "5-8", rest: 150,
    tips: ["Barre posée sur les trapèzes, jamais sur la nuque", "Pieds largeur d'épaules, pointes légèrement ouvertes", "Descends en poussant les fesses en arrière, genoux dans l'axe des pieds", "Dos droit et regard devant, remonte en poussant dans les talons"],
    err: ["Genoux qui rentrent vers l'intérieur", "Talons qui décollent du sol", "Dos qui s'arrondit en bas du mouvement"],
    vars: ["Squat goblet", "Presse à cuisses", "Hack squat", "Fentes"], order: "exc", ph: { exc: "Descente", con: "Remontée" },
    a: { pc: [-0.03, 0.975], th: 4, hand: { t: [-0.12, -0.075, 0.44] }, palm: [1, 0.2, 0], elbow: [-0.5, -1, 0.4], foot: [0, 0.085, 0.17], knee: [1, 0.05, 0.35], fdir: [1, 0, 0.28] },
    b: { pc: [-0.25, 0.53], th: 42, cp: -6, hp: -22 }, imp: [{ t: "bar", r: 0.225 }] },
  { id: "squat-goblet", n: "Squat goblet", gear: "Haltère", lvl: "Débutant", p: ["quadriceps", "fessiers"], s: ["ischios", "abdos"], reps: "10-12", rest: 90,
    tips: ["Haltère tenu à la verticale contre la poitrine", "Pieds un peu plus larges que les épaules", "Descends entre tes jambes, buste bien droit", "Remonte en poussant dans les talons"],
    err: ["Buste qui s'effondre vers l'avant", "Talons qui décollent", "Genoux qui rentrent"],
    vars: ["Squat", "Fentes", "Presse à cuisses"], order: "exc", ph: { exc: "Descente", con: "Remontée" },
    a: { pc: [-0.03, 0.975], th: 3, hand: { t: [0.2, -0.2, 0.06] }, hdir: { t: [0, 1, 0] }, palm: [0, 0, -1], elbow: { t: [0, -1, 0.4] }, foot: [0, 0.085, 0.2], knee: [1, 0, 0.4], fdir: [1, 0, 0.35] },
    b: { pc: [-0.15, 0.50], th: 22, hp: -10 }, imp: [{ t: "db1", axis: "torso" }] },
  { id: "presse-cuisses", n: "Presse à cuisses", gear: "Machine (presse à 45°)", lvl: "Débutant", p: ["quadriceps", "fessiers"], s: ["ischios", "adducteurs"], reps: "10-12", rest: 120,
    tips: ["Dos et fesses bien plaqués contre le dossier", "Pieds largeur de hanches au milieu de la plateforme", "Descends jusqu'à ce que les genoux forment un angle droit", "Pousse sans verrouiller les genoux"],
    err: ["Décoller les fesses en bas du mouvement", "Verrouiller les genoux en haut", "Genoux qui rentrent"],
    vars: ["Squat", "Hack squat", "Leg extension"], order: "exc", ph: { exc: "Descente contrôlée", con: "Poussée" },
    a: { pc: [0, 0.48], th: -45, hp: 20, hand: [0.10, 0.52, 0.30], elbow: [0, -1, 0.5], palm: [0, 0, -1], foot: [0.615, 1.025, 0.16], knee: [-0.707, 0.707, 0.2], fdir: [-0.707, 0.707, 0.12] },
    b: { foot: [0.47, 0.88, 0.16] }, props: P => P.legPress(), imp: [{ t: "platform" }], view: [0.25, 0.3, 1] },
  { id: "fentes", n: "Fentes", gear: "Haltères", lvl: "Débutant", p: ["quadriceps", "fessiers"], s: ["ischios", "adducteurs"], reps: "8-12 par jambe", rest: 90,
    tips: ["Un grand pas en avant, buste droit", "Descends jusqu'à ce que le genou arrière frôle le sol", "Le genou avant reste au-dessus de la cheville", "Remonte en poussant sur le talon avant"],
    err: ["Genou avant qui dépasse loin devant les orteils", "Buste qui penche vers l'avant", "Pas trop court"],
    vars: ["Squat bulgare", "Squat", "Presse à cuisses"], order: "exc", ph: { exc: "Descente", con: "Remontée" },
    a: { pc: [-0.05, 0.90], th: 0, hand: HANG, palm: [0, 0, -1], foot: [[0.38, 0.085, 0.12], [-0.50, 0.205, 0.12]], knee: [[1, 0, 0.1], [1, -0.2, 0.1]], fdir: [[1, 0, 0.12], [0.55, -0.84, 0.05]] },
    b: { pc: [-0.05, 0.565], th: 2 }, imp: [{ t: "db", grip: "F" }] },
  { id: "souleve-roumain", n: "Soulevé de terre roumain", gear: "Barre", lvl: "Intermédiaire", p: ["ischios", "fessiers"], s: ["lombaires"], reps: "8-10", rest: 120,
    tips: ["Genoux légèrement fléchis, ils restent ainsi", "Pousse les fesses en arrière, la barre glisse le long des cuisses", "Descends jusqu'au milieu des tibias, dos plat", "Remonte en poussant les hanches vers l'avant"],
    err: ["Arrondir le dos", "Plier les genoux comme un squat", "Barre qui s'éloigne des jambes"],
    vars: ["Soulevé de terre", "Leg curl allongé", "Hip thrust"], order: "exc", ph: { exc: "Descente", con: "Remontée" },
    a: ST({ pc: [-0.03, 0.97], hand: [0.075, 0.90, 0.22], elbow: [-0.3, 0, 0.2], palm: [-1, 0, 0], foot: [0, 0.085, 0.14], knee: [1, 0, 0.15] }), b: { pc: [-0.33, 0.87], th: 80, hp: -30, hand: [0.08, 0.405, 0.22] },
    imp: [{ t: "bar", r: 0.2 }] },
  { id: "leg-extension", n: "Leg extension", gear: "Machine", lvl: "Débutant", p: ["quadriceps"], s: [], reps: "12-15", rest: 60,
    tips: ["Genoux alignés avec l'axe de la machine", "Boudin sur le bas des tibias", "Tends les jambes en contractant les cuisses", "Redescends lentement sans laisser claquer les poids"],
    err: ["Décoller les fesses du siège", "Donner des à-coups", "Amplitude trop courte"],
    vars: ["Presse à cuisses", "Squat", "Leg curl allongé"], order: "con", ph: { con: "Extension", exc: "Retour lent" },
    a: { pc: [0, 0.68], th: -12, hand: [0.08, 0.64, 0.30], elbow: [0, -1, 0.5], palm: [0, 0, -1], foot: { c: { kn: [1, -0.03, 0.02] }, r: L.sh, d: [0.2, -1, 0] }, knee: [0.5, 1, 0], fdir: [1, 0.15, 0.1] },
    b: { foot: { c: { kn: [1, -0.03, 0.02] }, r: L.sh, d: [1, 0.12, 0] }, fdir: [-0.15, 1, 0.1] },
    props: P => P.legExtension(), imp: [{ t: "link", piv: [0.45, 0.62, 0.3], to: "ankle", pad: "roller", side: "front" }, { t: "stackmove", ref: "ankles", k: 0.5 }] },
  { id: "leg-curl", n: "Leg curl allongé", gear: "Machine", lvl: "Débutant", p: ["ischios"], s: ["mollets"], reps: "10-15", rest: 60,
    tips: ["Allongé sur le ventre, genoux juste après le bord du banc", "Boudin au-dessus des talons", "Ramène les talons vers les fesses", "Redescends lentement sans lever le bassin"],
    err: ["Bassin qui se soulève", "À-coups au départ", "Retour trop rapide"],
    vars: ["Soulevé de terre roumain", "Leg extension"], order: "con", ph: { con: "Flexion", exc: "Retour lent" },
    a: { pc: [0, 0.73], th: 90, hp: -25, hand: [0.75, 0.55, 0.22], elbow: [-0.3, 0.3, 1], palm: [0, 0, -1], foot: { c: { kn: [-1, -0.02, 0.01] }, r: L.sh, d: [-1, 0.06, 0] }, knee: [0, -1, 0], fdir: [0, -1, 0.05] },
    b: { foot: { c: { kn: [-1, -0.02, 0.01] }, r: L.sh, d: [0.3, 0.95, 0] }, fdir: [-0.95, 0.3, 0.05] },
    props: P => P.legCurl(), imp: [{ t: "link", piv: [-0.49, 0.70, 0.3], to: "ankle", pad: "roller", side: "back" }, { t: "stackmove", ref: "ankles", k: 0.4 }] },
  { id: "hip-thrust", n: "Hip thrust", gear: "Barre et banc", lvl: "Intermédiaire", p: ["fessiers"], s: ["ischios", "quadriceps"], reps: "8-12", rest: 90,
    tips: ["Haut du dos appuyé sur le bord du banc", "Barre sur le pli des hanches (avec une mousse)", "Monte les hanches jusqu'à aligner genoux, hanches et épaules", "Serre fort les fessiers en haut, puis redescends lentement"],
    err: ["Se cambrer en haut au lieu de serrer les fessiers", "Pieds trop loin ou trop près", "Pousser sur la pointe des pieds"],
    vars: ["Pont fessier", "Soulevé de terre roumain"], order: "con", ph: { con: "Montée des hanches", exc: "Descente contrôlée" },
    a: { shAt: [-0.45, 0.56, 0], th: -49, hand: { t: [0.25, -0.5, 0.33] }, palm: { t: [-1, 0, 0] }, elbow: { t: [0, 0, 1] }, foot: [0.42, 0.085, 0.18], knee: [0, 1, 0.15], fdir: [1, 0, 0.15] },
    b: { th: -90 }, props: P => P.benchZ(-0.6, 0.45), imp: [{ t: "bar", r: 0.225 }] },
  { id: "mollets-debout", n: "Mollets debout", gear: "Haltères et marche", lvl: "Débutant", p: ["mollets"], s: [], reps: "12-20", rest: 60,
    tips: ["Avant des pieds sur une marche, talons dans le vide", "Descends les talons pour étirer les mollets", "Monte le plus haut possible sur la pointe des pieds", "Marque une pause en haut"],
    err: ["Plier les genoux", "Amplitude trop courte", "Rebondir en bas"],
    vars: ["Presse à cuisses", "Squat"], order: "con", ph: { con: "Montée sur les pointes", exc: "Descente lente" },
    a: ST({ pc: [-0.03, 1.037], hand: HANG, palm: [0, 0, -1], foot: [-0.019, 0.127, 0.12], fdir: [0.94, 0.34, 0.1] }), b: { pc: [0.06, 1.156], th: 3, foot: [0.071, 0.246, 0.12], fdir: [0.82, -0.57, 0.1] },
    props: P => P.box([0.32, 0.1, 0.62], [0.26, 0.05, 0], "dark"), imp: [{ t: "db", grip: "F" }] },
  { id: "hack-squat", n: "Hack squat", gear: "Machine", lvl: "Intermédiaire", p: ["quadriceps"], s: ["fessiers"], reps: "8-12", rest: 120,
    tips: ["Dos et épaules bien calés contre les appuis", "Pieds au milieu de la plateforme, largeur de hanches", "Descends jusqu'à ce que les cuisses soient parallèles à la plateforme", "Pousse sans verrouiller les genoux"],
    err: ["Décoller le bas du dos", "Descendre à moitié", "Genoux qui rentrent"],
    vars: ["Squat", "Presse à cuisses"], order: "exc", ph: { exc: "Descente", con: "Poussée" },
    a: { pc: [-0.15, 1.02], th: -25, hp: 10, hand: { t: [-0.02, 0.05, 0.30] }, hdir: { t: [1, 0, 0] }, palm: { t: [0, -1, 0] }, elbow: { t: [0.5, -1, 0.6] }, foot: [0.20, 0.17, 0.16], knee: [1, 0.3, 0.3], fdir: [0.94, 0.34, 0.15] },
    b: { pc: [0.04, 0.61] }, props: P => P.hack(), imp: [{ t: "sled" }] },
  { id: "squat-bulgare", n: "Squat bulgare", gear: "Haltères et banc", lvl: "Intermédiaire", p: ["quadriceps", "fessiers"], s: ["ischios", "adducteurs"], reps: "8-10 par jambe", rest: 90,
    tips: ["Pied arrière posé sur le banc, pied avant bien en avant", "Buste droit ou légèrement penché", "Descends à la verticale jusqu'à ce que la cuisse avant soit parallèle au sol", "Remonte en poussant sur le talon avant"],
    err: ["Pied avant trop près du banc", "Genou avant qui rentre", "Perdre l'équilibre en allant trop vite"],
    vars: ["Fentes", "Squat"], order: "exc", ph: { exc: "Descente", con: "Remontée" },
    a: { pc: [-0.25, 0.92], th: 6, hand: HANG, palm: [0, 0, -1], foot: [[0.15, 0.085, 0.12], [-0.72, 0.52, 0.12]], knee: [[1, 0, 0.1], [0, -1, 0.05]], fdir: [[1, 0, 0.12], [-0.95, -0.3, 0]] },
    b: { pc: [-0.22, 0.55], th: 18 }, props: P => P.bench(-1.25, -0.62, 0.45, 0.12), imp: [{ t: "db", grip: "F" }] },
  { id: "adducteurs", n: "Adducteurs à la machine", gear: "Machine", lvl: "Débutant", p: ["adducteurs"], s: [], reps: "12-15", rest: 60,
    tips: ["Dos plaqué contre le dossier", "Appuis à l'intérieur des genoux", "Serre les jambes jusqu'à ce que les appuis se touchent", "Rouvre lentement"],
    err: ["Ouvrir trop loin au départ", "Laisser claquer les poids", "Se pencher en avant"],
    vars: ["Abducteurs à la machine", "Squat goblet"], order: "con", ph: { con: "Fermeture", exc: "Ouverture lente" },
    a: { pc: [0, 0.62], th: -12, hand: [0, 0.62, 0.32], elbow: [0, -1, 0.5], palm: [0, 0, -1], foot: { c: "hip", r: L.th, d: [0.78, -0.08, 0.62], plus: [0.04, -0.425, 0] }, knee: [1, 0.6, 0], fdir: [1, 0.1, 0.15] },
    b: { foot: { c: "hip", r: L.th, d: [1, -0.08, 0.06], plus: [0.04, -0.425, 0] } },
    props: P => P.hipMachine(), imp: [{ t: "link", piv: [0.42, 0.33, 0.12], to: "knee", pad: "pad", side: "in" }, { t: "stackmove", ref: "knees", k: 0.6 }], view: [1, 0.45, 0.35] },
  { id: "abducteurs", n: "Abducteurs à la machine", gear: "Machine", lvl: "Débutant", p: ["abducteurs"], s: ["fessiers"], reps: "12-15", rest: 60,
    tips: ["Dos plaqué contre le dossier", "Appuis à l'extérieur des genoux", "Écarte les jambes le plus loin possible", "Referme lentement"],
    err: ["Se pencher en avant", "À-coups", "Amplitude trop courte"],
    vars: ["Adducteurs à la machine", "Hip thrust"], order: "con", ph: { con: "Ouverture", exc: "Fermeture lente" },
    a: { pc: [0, 0.62], th: -12, hand: [0, 0.62, 0.32], elbow: [0, -1, 0.5], palm: [0, 0, -1], foot: { c: "hip", r: L.th, d: [1, -0.08, 0.06], plus: [0.04, -0.425, 0] }, knee: [1, 0.6, 0], fdir: [1, 0.1, 0.15] },
    b: { foot: { c: "hip", r: L.th, d: [0.78, -0.08, 0.62], plus: [0.04, -0.425, 0] } },
    props: P => P.hipMachine(), imp: [{ t: "link", piv: [0.42, 0.33, 0.12], to: "knee", pad: "pad", side: "out" }, { t: "stackmove", ref: "knees", k: 0.6 }], view: [1, 0.45, 0.35] },
  { id: "pont-fessier", n: "Pont fessier", gear: "Poids du corps", lvl: "Débutant", p: ["fessiers"], s: ["ischios"], reps: "12-20", rest: 60,
    tips: ["Allongé sur le dos, genoux pliés, pieds à plat", "Pousse dans les talons pour monter les hanches", "Serre les fessiers en haut, sans te cambrer", "Redescends lentement"],
    err: ["Pousser sur les pointes de pieds", "Cambrer le bas du dos", "Monter trop vite"],
    vars: ["Hip thrust"], order: "con", ph: { con: "Montée des hanches", exc: "Descente contrôlée" },
    a: { shAt: [-0.45, 0.125, 0], th: -90, hp: 12, hand: [0.06, 0.022, 0.25], hdir: [1, 0, 0], hpose: "flat", palm: [0, -1, 0], elbow: [0, 0.15, 1], foot: [0.38, 0.085, 0.15], knee: [0, 1, 0.1], fdir: [1, 0, 0.12] },
    b: { th: -125 }, props: P => P.mat(-0.9, 0.6) },
  { id: "kettlebell-swing", n: "Kettlebell swing", gear: "Kettlebell", lvl: "Intermédiaire", p: ["fessiers", "ischios"], s: ["lombaires", "abdos"], reps: "15-20", rest: 60, tempo: 1.5,
    tips: ["Pieds un peu plus larges que les épaules", "Le mouvement vient des hanches, pas des bras", "Pousse les hanches vers l'avant pour lancer la kettlebell", "Laisse-la redescendre entre les jambes, dos plat"],
    err: ["Soulever la kettlebell avec les bras", "Arrondir le dos en bas", "Faire un squat au lieu d'une flexion de hanches"],
    vars: ["Soulevé de terre roumain", "Hip thrust"], order: "con", ph: { con: "Extension des hanches", exc: "Retour entre les jambes" },
    a: { pc: [-0.25, 0.86], th: 55, hp: -25, hand: { c: "sh", r: 0.55, d: [-0.25, -1, -0.2] }, elbow: [0, 1, 0.5], palm: [-1, 0, 0], foot: [0, 0.085, 0.22], knee: [1, 0, 0.35], fdir: [1, 0, 0.3] },
    b: { pc: [-0.04, 0.975], th: -4, hp: 0, palm: [0, -1, 0], hand: { c: "sh", r: 0.55, d: [1, 0.05, -0.2] } }, imp: [{ t: "kb" }] },

  /* ---------------- Abdos ---------------- */
  { id: "crunch", n: "Crunch", gear: "Poids du corps", lvl: "Débutant", p: ["abdos"], s: ["obliques"], reps: "15-20", rest: 45,
    tips: ["Allongé, genoux pliés, pieds à plat", "Bas du dos collé au sol", "Enroule le haut du dos en rapprochant les côtes du bassin", "Redescends lentement sans reposer complètement la tête"],
    err: ["Tirer sur la nuque", "Décoller le bas du dos", "Aller trop vite"],
    vars: ["Crunch à la poulie", "Relevé de jambes allongé", "Gainage"], order: "con", ph: { con: "Enroulement", exc: "Retour lent" },
    a: { pc: [0, 0.12], th: -90, hand: [{ t: [0.12, -0.1, -0.02] }, { t: [0.21, -0.19, -0.02] }], elbow: { t: [0.3, 0, 1] }, hpose: "flat", palm: { t: [-1, 0, 0] }, foot: [0.42, 0.085, 0.13], knee: [0, 1, 0.1], fdir: [1, 0, 0.12] },
    b: { cp: 38, hp: 15 }, props: P => P.mat(-1.0, 0.6) },
  { id: "gainage", n: "Gainage (planche)", gear: "Poids du corps", lvl: "Débutant", p: ["abdos"], s: ["obliques", "lombaires", "fessiers"], time: true, rest: 60,
    tips: ["Avant-bras au sol, coudes sous les épaules", "Corps aligné des talons à la tête", "Serre les abdos et les fessiers", "Respire calmement pendant tout le maintien"],
    err: ["Bassin trop haut ou qui s'affaisse", "Retenir sa respiration", "Regarder devant soi (nuque cassée)"],
    vars: ["Crunch", "Roue abdominale", "Mountain climbers"], order: "iso", ph: { iso: "Maintien de la position" },
    a: { pc: [-0.467, 0.264], th: 77, hand: [0.265, 0.022, 0.10], hdir: [1, 0, -0.15], hpose: "flat", palm: [0, -1, 0], elbow: [-0.3, -1, 0.2], foot: [-1.35, 0.205, 0.10], fdir: [0.55, -0.84, 0.03], knee: [0, -1, 0] },
    b: { pc: [-0.467, 0.272] }, props: P => P.mat(-1.6, 0.5) },
  { id: "releve-jambes-suspendu", n: "Relevé de jambes suspendu", gear: "Barre de traction", lvl: "Confirmé", p: ["abdos"], s: ["obliques"], reps: "8-12", rest: 60,
    tips: ["Suspendu à la barre, bras tendus", "Monte les jambes tendues jusqu'à l'horizontale", "Enroule légèrement le bassin en haut", "Redescends lentement sans te balancer"],
    err: ["Se balancer pour monter les jambes", "Redescendre en laissant tomber les jambes", "Cambrer le dos"],
    vars: ["Relevé de jambes allongé", "Crunch"], order: "con", ph: { con: "Montée des jambes", exc: "Descente lente" },
    a: { pc: [-0.02, 1.195], th: -8, hand: [0, 2.105, 0.30], elbow: [0, -1, 1], hdir: [0, 1, 0], palm: [1, 0, 0], foot: { c: "hip", r: 0.86, d: [0.08, -1, 0.02] }, knee: [1, 0.3, 0], fdir: [0.6, -0.8, 0.05] },
    b: { th: -14, foot: { c: "hip", r: 0.86, d: [1, 0.12, 0.02] }, fdir: [0.3, 0.95, 0.05] }, props: P => P.pullup(2.17) },
  { id: "releve-jambes-allonge", n: "Relevé de jambes allongé", gear: "Poids du corps", lvl: "Débutant", p: ["abdos"], s: ["obliques"], reps: "12-15", rest: 45,
    tips: ["Allongé sur le dos, mains sous les fesses ou le long du corps", "Jambes tendues, monte-les jusqu'à la verticale", "Garde le bas du dos collé au sol", "Redescends lentement sans toucher le sol"],
    err: ["Bas du dos qui se décolle", "Laisser retomber les jambes", "Plier les jambes pour tricher"],
    vars: ["Relevé de jambes suspendu", "Crunch"], order: "con", ph: { con: "Montée des jambes", exc: "Descente lente" },
    a: { pc: [0, 0.12], th: -90, hand: [0, 0.022, 0.27], hdir: [1, 0, 0], hpose: "flat", palm: [0, -1, 0], elbow: [0, 1, 0.3], foot: { c: "hip", r: 0.86, d: [1, 0.1, 0.02] }, knee: [0, 1, 0], fdir: [-0.1, 1, 0.05] },
    b: { foot: { c: "hip", r: 0.86, d: [0.12, 1, 0.02] }, fdir: [-1, 0.12, 0.05] }, props: P => P.mat(-1.0, 0.95) },
  { id: "roue-abdominale", n: "Roue abdominale", gear: "Roue", lvl: "Confirmé", p: ["abdos"], s: ["dorsaux", "obliques"], reps: "8-12", rest: 60,
    tips: ["À genoux, mains sur les poignées de la roue", "Abdos serrés, dos légèrement arrondi", "Roule vers l'avant aussi loin que possible sans creuser le dos", "Reviens en contractant les abdos"],
    err: ["Creuser le bas du dos", "Aller trop loin au début", "Revenir en pliant les hanches seulement"],
    vars: ["Gainage", "Crunch"], order: "exc", ph: { exc: "Déroulé vers l'avant", con: "Retour" },
    a: { hipAt: { c: [0, 0.06, 0], r: 0.44, d: [0.02, 1, 0] }, th: 65, cp: 8, hp: -10, hand: [0.50, 0.16, 0.10], elbow: [-1, 0.4, 0.3], palm: [-1, 0, 0], foot: [-0.43, 0.07, 0.10], knee: [0.4, -1, 0], fdir: [-0.95, -0.2, 0] },
    b: { hipAt: { c: [0, 0.06, 0], r: 0.44, d: [0.64, 0.77, 0] }, th: 84, hp: -30, hand: [1.29, 0.16, 0.10] }, props: P => P.mat(-0.7, 1.5), imp: [{ t: "wheel" }] },
  { id: "mountain-climbers", n: "Mountain climbers", gear: "Poids du corps", lvl: "Débutant", p: ["abdos"], s: ["obliques", "quadriceps", "deltoides_ant"], time: true, rest: 60,
    tips: ["Position de pompe, bras tendus sous les épaules", "Ramène un genou vers la poitrine, puis l'autre", "Garde le bassin bas et le dos plat", "Rythme régulier, respiration continue"],
    err: ["Bassin qui monte", "Mains trop en avant des épaules", "Mouvement trop court"],
    vars: ["Gainage", "Pompes"], order: "alt", ph: { con: "Genou gauche", exc: "Genou droit" },
    a: { pc: [-0.485, 0.58], th: 90, hp: -15, hand: [0, 0.022, 0.28], hdir: [1, 0, -0.1], hpose: "flat", palm: [0, -1, 0], elbow: [-0.8, 0.6, 0.65], foot: [{ c: { kn: [0.6, -0.8, 0.05] }, r: L.sh, d: [-0.9, 0.3, 0] }, { c: { kn: [-0.891, -0.454, 0] }, r: L.sh, d: [-0.891, -0.454, 0] }], knee: [0, -1, 0], fdir: [[0.35, -0.94, 0.03], [0.55, -0.84, 0.03]] },
    b: { foot: [{ c: { kn: [-0.891, -0.454, 0] }, r: L.sh, d: [-0.891, -0.454, 0] }, { c: { kn: [0.6, -0.8, 0.05] }, r: L.sh, d: [-0.9, 0.3, 0] }], fdir: [[0.55, -0.84, 0.03], [0.35, -0.94, 0.03]] }, props: P => P.mat(-1.5, 0.4) },
  { id: "crunch-poulie", n: "Crunch à la poulie", gear: "Poulie haute et corde", lvl: "Intermédiaire", p: ["abdos"], s: ["obliques"], reps: "12-15", rest: 60,
    tips: ["À genoux face à la poulie, corde tenue près de la tête", "Les hanches ne bougent pas", "Enroule le buste vers le sol en contractant les abdos", "Reviens lentement"],
    err: ["Tirer avec les bras", "S'asseoir sur les talons", "Garder le dos droit (pas d'enroulement)"],
    vars: ["Crunch", "Roue abdominale"], order: "con", ph: { con: "Enroulement", exc: "Retour lent" },
    a: { hipAt: { c: [0, 0.06, 0], r: 0.44, d: [0.05, 1, 0] }, th: 15, hand: { t: [0.07, 0.12, 0.10] }, hdir: { t: [0, 1, 0] }, palm: [0, 0, -1], elbow: { t: [0.6, -0.6, 0.6] }, foot: [-0.43, 0.07, 0.10], knee: [0.4, -1, 0], fdir: [-0.95, -0.2, 0] },
    b: { th: 55, cp: 30, hp: 15 }, props: P => { P.mat(-0.7, 0.6); P.tower(0.62, 0, 2.0, 0.45); }, imp: [{ t: "cable", from: [0.45, 2.0, 0], to: "mid", handle: "rope", stacks: [0] }] },
];

/* =====================================================================
   Moteur 3D
   ===================================================================== */
let G = null; // scène créée au premier affichage
const MAT = {};
function materials() {
  const P = (c, o) => new THREE.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.5 }, o));
  Object.assign(MAT, {
    body: P(0xd9d3cd), pad: P(0xccc4bd, { roughness: 0.52 }), palm: P(0xc4aca2, { roughness: 0.6, clearcoat: 0.2 }), joint: P(0x9c958f, { roughness: 0.42, clearcoat: 0.5 }),
    primary: P(0xff3d7f, { emissive: 0xff2d6f, emissiveIntensity: 0.25, roughness: 0.38, clearcoat: 0.6 }),
    secondary: P(0xffa04f, { emissive: 0xff8a32, emissiveIntensity: 0.12, roughness: 0.42, clearcoat: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9ccd3, metalness: 0.9, roughness: 0.28 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24222b, metalness: 0.2, roughness: 0.75 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x3a3745, metalness: 0.6, roughness: 0.45 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x1c1b21, metalness: 0.1, roughness: 0.85 }),
    pink: new THREE.MeshStandardMaterial({ color: 0xff3d7f, metalness: 0.3, roughness: 0.45 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x15141a, metalness: 0.5, roughness: 0.5 }),
    mat: new THREE.MeshStandardMaterial({ color: 0x3a3546, roughness: 0.95 }),
  });
}
const SPH = () => G.geo.sph;
// fuseau musculaire : bouts effilés, dos aplati contre l'os
function spindleGeo(flat) {
  const g = new THREE.SphereGeometry(1, 28, 20), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = flat ? 1 : Math.sqrt(Math.max(0, 1 - y * y)) * 0.55 + 0.45;
    let z = p.getZ(i) * k; if (z < 0) z *= 0.3;
    p.setXYZ(i, p.getX(i) * k, y, z);
  }
  g.computeVertexNormals(); return g;
}
function limbGeo(len, r0, r1, bulge, at) {
  const pts = [], N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N, cap = Math.min(1, Math.sqrt(t / 0.07), Math.sqrt((1 - t) / 0.07));
    pts.push(new THREE.Vector2(limbR(r0, r1, bulge, at, t) * cap, t * len));
  }
  return new THREE.LatheGeometry(pts, 28);
}
const limbR = (r0, r1, bulge, at, t) => r0 + (r1 - r0) * t + bulge * Math.exp(-(((t - at) / 0.24) ** 2));
const _m = new THREE.Matrix4();
function orient(obj, origin, yDir, zHint) {
  const y = yDir.clone().normalize();
  let z = zHint.clone().addScaledVector(y, -zHint.dot(y));
  if (z.lengthSq() < 1e-6) { z = Math.abs(y.x) < 0.9 ? V(1, 0, 0) : V(0, 0, 1); z.addScaledVector(y, -z.dot(y)); }
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  _m.makeBasis(x, y, z); obj.quaternion.setFromRotationMatrix(_m); obj.position.copy(origin);
}
function ik(root, target, a, b, pole) {
  const d0 = target.clone().sub(root); let d = d0.length(); const u = d0.normalize();
  d = Math.min(Math.max(d, 1e-3), a + b - 1e-4);
  const cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const v = pole.clone().addScaledVector(u, -pole.dot(u)); if (v.lengthSq() < 1e-8) v.copy(UP); v.normalize();
  return { mid: root.clone().addScaledVector(u, a * cosA).addScaledVector(v, a * sinA), end: root.clone().addScaledVector(u, d), bend: v };
}
const shadowy = o => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

/* ---------- Mannequin avec muscles détaillés ---------- */
function buildMan() {
  const man = new THREE.Group(), muscles = {}, fists = [], flats = [];
  const add = (name, mesh) => { if (name) (muscles[name] = muscles[name] || []).push(mesh); return mesh; };
  const part = () => { const g = new THREE.Group(); man.add(g); return g; };
  const mesh = (parent, geo, mat, pos, scl, rot) => { const o = new THREE.Mesh(geo, mat); o.position.set(...pos); o.scale.set(...scl); if (rot) o.rotation.set(...rot); parent.add(o); return o; };
  const sph = G.geo.sph, soft = G.geo.soft, spin = G.geo.spin;
  const pad = (parent, name, pos, scl, rot, geo) => add(name, mesh(parent, geo || soft, MAT.pad, pos, scl, rot));
  const P = { pelvis: part(), abdomen: part(), chest: part(), neck: part(), head: part(), ua: [part(), part()], fa: [part(), part()], hand: [part(), part()], th: [part(), part()], sh: [part(), part()], foot: [part(), part()] };
  // bassin (x local = gauche)
  mesh(P.pelvis, sph, MAT.body, [0, -0.02, 0], [0.16, 0.1, 0.105]);
  [1, -1].forEach(s => {
    pad(P.pelvis, "fessiers", [0.068 * s, -0.045, -0.072], [0.072, 0.082, 0.052]);
    pad(P.pelvis, "abducteurs", [0.125 * s, 0.02, -0.03], [0.045, 0.05, 0.032], [0, 0.9 * s, 0]);
  });
  // ventre : abdominaux en tablette, obliques, lombaires
  mesh(P.abdomen, sph, MAT.body, [0, 0.12, 0], [0.135, 0.13, 0.092]);
  [0.1, 0.145, 0.19].forEach((y, k) => [1, -1].forEach(s => pad(P.abdomen, "abdos", [0.029 * s, y, [0.084, 0.082, 0.072][k]], [0.025, 0.021, 0.016])));
  [1, -1].forEach(s => {
    pad(P.abdomen, "abdos", [0.026 * s, 0.055, 0.08], [0.024, 0.03, 0.016]);
    pad(P.abdomen, "obliques", [0.108 * s, 0.11, 0.04], [0.036, 0.085, 0.026], [0, 0.75 * s, 0.12 * s]);
    pad(P.abdomen, "lombaires", [0.036 * s, 0.12, -0.08], [0.03, 0.12, 0.026], [0, Math.PI, 0]);
  });
  // thorax : pectoraux (2 faisceaux), dorsaux, trapèzes
  mesh(P.chest, sph, MAT.body, [0, 0.16, 0], [0.17, 0.175, 0.108]);
  mesh(P.chest, sph, MAT.body, [0, 0.27, -0.005], [0.2, 0.055, 0.08]);
  [1, -1].forEach(s => {
    pad(P.chest, "pectoraux", [0.074 * s, 0.205, 0.078], [0.085, 0.075, 0.04], [0, 0.18 * s, -0.12 * s]);
    pad(P.chest, null, [0.142 * s, 0.12, 0.045], [0.026, 0.06, 0.02], [0, 1.0 * s, 0]);
    pad(P.chest, "dorsaux", [0.118 * s, 0.11, -0.05], [0.06, 0.135, 0.045], [0, Math.PI - 0.35 * s, -0.32 * s]);
    pad(P.chest, null, [0.085 * s, 0.19, -0.085], [0.05, 0.045, 0.022], [0, Math.PI - 0.3 * s, 0]);
  });
  pad(P.chest, "trapezes", [0, 0.285, -0.04], [0.12, 0.05, 0.045], [0, Math.PI, 0]);
  pad(P.chest, "trapezes", [0, 0.2, -0.09], [0.075, 0.095, 0.028], [0, Math.PI, 0]);
  // cou et tête
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.12, 20), MAT.body); neck.position.y = 0.035; P.neck.add(neck);
  mesh(P.head, sph, MAT.body, [0, 0.105, 0.005], [0.088, 0.115, 0.1]);
  mesh(P.head, sph, MAT.body, [0, 0.045, 0.03], [0.066, 0.062, 0.072]);
  // membres : muscles placés autour de l'os (angle 0 = devant, 90 = extérieur)
  const LIMB = { ua: [0.047, 0.035, 0.006, 0.45, L.ua], fa: [0.039, 0.025, 0.006, 0.25, L.fa], th: [0.076, 0.05, 0.008, 0.3, L.th], sh: [0.052, 0.032, 0.01, 0.28, L.sh] };
  const lpad = (grp, i, kind, name, a, t, scl, geo) => {
    const [r0, r1, bu, at, len] = LIMB[kind], ai = (i === 1 ? a : -a) * D2R, r = limbR(r0, r1, bu, at, t) - scl[2] * 0.25;
    return add(name, mesh(grp, geo || spin, MAT.pad, [Math.sin(ai) * r, t * len, Math.cos(ai) * r], scl, [0, ai, 0]));
  };
  for (let i = 0; i < 2; i++) {
    for (const k of ["ua", "fa", "th", "sh"]) { const [r0, r1, bu, at, len] = LIMB[k]; P[k][i].add(new THREE.Mesh(limbGeo(len, r0, r1, bu, at), MAT.body)); }
    lpad(P.ua[i], i, "ua", "deltoides_ant", 15, 0.13, [0.045, 0.075, 0.036], soft);
    lpad(P.ua[i], i, "ua", "deltoides_lat", 90, 0.12, [0.046, 0.08, 0.038], soft);
    lpad(P.ua[i], i, "ua", "deltoides_post", 165, 0.13, [0.044, 0.072, 0.034], soft);
    lpad(P.ua[i], i, "ua", "biceps", 0, 0.58, [0.03, 0.1, 0.032]);
    lpad(P.ua[i], i, "ua", "triceps", 205, 0.45, [0.027, 0.11, 0.03]);
    lpad(P.ua[i], i, "ua", "triceps", 145, 0.4, [0.025, 0.085, 0.026]);
    lpad(P.fa[i], i, "fa", "avantbras", -10, 0.3, [0.036, 0.095, 0.03]);
    // repère de la main : y = vers les doigts, z = côté paume, x = pouce (main droite) ; t = côté du pouce
    const t = i === 1 ? 1 : -1, fist = new THREE.Group(), flatH = new THREE.Group(); P.hand[i].add(fist, flatH);
    mesh(fist, sph, MAT.body, [0, 0.04, 0], [0.04, 0.043, 0.018]);
    mesh(fist, sph, MAT.palm, [0, 0.036, 0.011], [0.033, 0.034, 0.01]);                         // paume
    const roll = new THREE.Mesh(G.geo.cap, MAT.body); roll.position.set(0, 0.078, 0.019); roll.rotation.z = Math.PI / 2; fist.add(roll); // doigts repliés
    [-0.027, -0.009, 0.009, 0.027].forEach(x => { mesh(fist, sph, MAT.body, [x, 0.085, -0.004], [0.011, 0.011, 0.011]); mesh(fist, sph, MAT.body, [x, 0.06, 0.036], [0.0105, 0.012, 0.009]); }); // jointures, bouts des doigts
    mesh(fist, sph, MAT.body, [t * 0.036, 0.045, 0.026], [0.012, 0.03, 0.012], [0, 0, -t * 0.95]);  // pouce replié sur les doigts
    mesh(flatH, sph, MAT.body, [0, 0.042, 0], [0.042, 0.045, 0.013]);
    mesh(flatH, sph, MAT.palm, [0, 0.04, 0.008], [0.034, 0.036, 0.008]);
    [-0.027, -0.009, 0.009, 0.027].forEach((x, k) => { const f = new THREE.Mesh(G.geo.finger, MAT.body); f.position.set(x * 1.05, 0.1 + [0, 0.008, 0.006, -0.004][k], 0); flatH.add(f); });
    const th2 = new THREE.Mesh(G.geo.finger, MAT.body); th2.position.set(t * 0.047, 0.045, 0.006); th2.rotation.z = -t * 0.75; th2.scale.set(1.15, 0.8, 1.15); flatH.add(th2);
    fists.push(fist); flats.push(flatH);
    lpad(P.th[i], i, "th", "quadriceps", 10, 0.52, [0.06, 0.18, 0.045]);
    lpad(P.th[i], i, "th", "ischios", 180, 0.5, [0.052, 0.165, 0.04]);
    lpad(P.th[i], i, "th", "adducteurs", -100, 0.3, [0.042, 0.12, 0.03]);
    lpad(P.sh[i], i, "sh", "mollets", 180, 0.3, [0.044, 0.125, 0.04]);
    lpad(P.sh[i], i, "sh", null, 25, 0.33, [0.02, 0.11, 0.016]);
    mesh(P.foot[i], sph, MAT.body, [0, 0.06, -0.047], [0.046, 0.13, 0.034]);
  }
  const J = {}; const joint = r => { const o = new THREE.Mesh(sph, MAT.joint); o.scale.setScalar(r); man.add(o); return o; };
  for (const [k, r] of [["sh", 0.05], ["el", 0.037], ["wr", 0.027], ["hip", 0.058], ["kn", 0.047], ["an", 0.033]]) J[k] = [joint(r), joint(r)];
  shadowy(man);
  return { man, P, J, muscles, fist: fists, flatHand: flats };
}

/* ---------- Résolution d'une pose ---------- */
function lerpSpec(a, b, t, key) {
  if (b === undefined) return a;
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (key === "d" && typeof a[0] === "number") return slerp(a, b, t);
    return a.map((x, i) => lerpSpec(x, b[i], t, key));
  }
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) { const o = {}; for (const k in a) o[k] = lerpSpec(a[k], b[k], t, k); return o; }
  return t < 0.5 ? a : b;
}
function slerp(a, b, t) {
  const u = V(...a).normalize(), v = V(...b).normalize(), d = Math.min(1, Math.max(-1, u.dot(v))), w = Math.acos(d);
  if (w < 1e-4) return [u.x, u.y, u.z];
  const s = Math.sin(w), r = u.multiplyScalar(Math.sin((1 - t) * w) / s).addScaledVector(v, Math.sin(t * w) / s);
  return [r.x, r.y, r.z];
}
const isPt = v => Array.isArray(v) && typeof v[0] === "number";
const side = (v, i) => (Array.isArray(v) && v.length === 2 && !isPt(v)) ? v[i] : v;
// pose complète d'un exercice à l'instant s (0 → 1)
function keyAt(ex, s) {
  const a = Object.assign({ th: 0, cp: 0, hp: 0, shrug: 0 }, ex.a), b = Object.assign({}, a, ex.b || {});
  if (!ex.m) return lerpSpec(a, b, s);
  const mm = Object.assign({}, a, ex.m), t = ex.mt || 0.5;
  return s < t ? lerpSpec(a, mm, s / t) : lerpSpec(mm, b, (s - t) / (1 - t));
}
function solve(ex, s) {
  const k = keyAt(ex, s);
  const th = (k.th || 0) * D2R, cp = (k.cp || 0) * D2R, hp = (k.hp || 0) * D2R;
  const U = V(Math.sin(th), Math.cos(th), 0), F = V(Math.cos(th), -Math.sin(th), 0), R = V(0, 0, 1);
  const Uc = U.clone().multiplyScalar(Math.cos(cp)).addScaledVector(F, Math.sin(cp)), Fc = F.clone().multiplyScalar(Math.cos(cp)).addScaledVector(U, -Math.sin(cp));
  const Uh = Uc.clone().multiplyScalar(Math.cos(hp)).addScaledVector(Fc, Math.sin(hp)), Fh = Fc.clone().multiplyScalar(Math.cos(hp)).addScaledVector(Uc, -Math.sin(hp));
  const sg = i => (i === 0 ? -1 : 1);
  const W = (a, i) => V(a[0], a[1], sg(i) * (a[2] || 0));
  const ctx = { U, F, R, Uc, Fc, Uh, Fh, sh: [], hip: [] };
  const tor = (t, i) => ctx.neckBase.clone().addScaledVector(Fc, t[0]).addScaledVector(Uc, t[1]).addScaledVector(R, sg(i) * t[2]);
  const center = (c, i) => {
    if (c === "sh") return ctx.sh[i].clone();
    if (c === "hip") return ctx.hip[i].clone();
    if (isPt(c)) return W(c, i);
    if (c.el) return ctx.sh[i].clone().addScaledVector(W(c.el, i).normalize(), L.ua);
    if (c.kn) return ctx.hip[i].clone().addScaledVector(W(c.kn, i).normalize(), L.th);
    if (c.t) return tor(c.t, i);
    return V();
  };
  const point = (p, i) => {
    if (isPt(p)) return W(p, i);
    if (p.t) return tor(p.t, i);
    const o = center(p.c, i).addScaledVector(W(p.d, i).normalize(), p.r || 0.5);
    return p.plus ? o.add(W(p.plus, i)) : o;
  };
  const dir = (d, i) => (isPt(d) ? W(d, i) : Fc.clone().multiplyScalar(d.t[0]).addScaledVector(Uc, d.t[1]).addScaledVector(R, sg(i) * d.t[2])).normalize();
  let pc;
  if (k.pc) pc = V(k.pc[0], k.pc[1], 0);
  else if (k.hipAt) pc = point(k.hipAt, 1).setZ(0).addScaledVector(U, L.hipDrop);
  else pc = point(k.shAt, 1).setZ(0).addScaledVector(U, -L.lumbar).addScaledVector(Uc, -(L.thorax - L.shDrop)).addScaledVector(Fc, 0.01);
  ctx.pc = pc;
  ctx.chestBase = pc.clone().addScaledVector(U, L.lumbar);
  ctx.neckBase = ctx.chestBase.clone().addScaledVector(Uc, L.thorax);
  for (let i = 0; i < 2; i++) {
    ctx.sh[i] = ctx.neckBase.clone().addScaledVector(Uc, -(L.shDrop - (k.shrug || 0))).addScaledVector(R, sg(i) * L.shW).addScaledVector(Fc, -0.01);
    ctx.hip[i] = pc.clone().addScaledVector(U, -L.hipDrop).addScaledVector(R, sg(i) * L.hipW);
  }
  const out = Object.assign(ctx, { wr: [], el: [], hand: [], fd: [], hd: [], bendA: [], palm: [], flat: [], hx: [], kn: [], an: [], bendL: [], fdir: [] });
  // articulation intermédiaire imposée (coude ou genou fixe) : pas de calcul, position exacte
  const fixed = (root, midP, end, pole) => {
    const u = end.clone().sub(root).normalize(), v = midP.clone().sub(root); v.addScaledVector(u, -v.dot(u));
    return { mid: midP, end, bend: v.lengthSq() > 1e-6 ? v.normalize() : pole.clone().addScaledVector(u, -pole.dot(u)).normalize() };
  };
  for (let i = 0; i < 2; i++) {
    const hs = side(k.hand || HANG, i), hp = dir(side(k.elbow || [-1, 0, 0.2], i), i);
    let a;
    if (hs.c && hs.c.el) { const E = center(hs.c, i); a = fixed(ctx.sh[i], E, E.clone().addScaledVector(W(hs.d, i).normalize(), L.fa), hp); }
    else a = ik(ctx.sh[i], point(hs, i), L.ua, L.fa, hp);
    const fd = a.end.clone().sub(a.mid).normalize();
    const hds = k.hdir ? side(k.hdir, i) : null, hd = hds ? dir(hds, i) : fd;
    // paume : "sup" = supination (côté des fléchisseurs), "pro" = pronation, sinon une direction
    const ps = side(k.palm, i);
    let pv = ps === "pro" ? a.bend.clone() : (!ps || ps === "sup") ? a.bend.clone().negate() : dir(ps, i);
    pv.addScaledVector(hd, -pv.dot(hd));
    if (pv.lengthSq() < 1e-4) { pv = a.bend.clone().negate().addScaledVector(hd, -a.bend.clone().negate().dot(hd)); if (pv.lengthSq() < 1e-4) pv = Math.abs(hd.y) < 0.9 ? UP.clone().addScaledVector(hd, -hd.y) : V(1, 0, 0); }
    pv.normalize();
    const flat = side(k.hpose, i) === "flat";
    out.wr.push(a.end); out.el.push(a.mid); out.fd.push(fd); out.hd.push(hd); out.bendA.push(a.bend); out.palm.push(pv); out.flat.push(flat);
    out.hx.push(new THREE.Vector3().crossVectors(hd, pv).normalize()); // axe de la prise (barre, poignée d'haltère)
    out.hand.push(a.end.clone().addScaledVector(hd, flat ? 0.06 : 0.062).addScaledVector(pv, flat ? 0 : 0.02));
    const fs = side(k.foot || STAND.foot, i), kp = dir(side(k.knee || STAND.knee, i), i);
    let l;
    if (fs.c && fs.c.kn) { const K = center(fs.c, i); l = fixed(ctx.hip[i], K, K.clone().addScaledVector(W(fs.d, i).normalize(), L.sh), kp); }
    else l = ik(ctx.hip[i], point(fs, i), L.th, L.sh, kp);
    out.kn.push(l.mid); out.an.push(l.end); out.bendL.push(l.bend);
    const fdv = dir(side(k.fdir || STAND.fdir, i), i); out.fdir.push(fdv);
  }
  return out;
}
function applyPose(H, o) {
  const { P, J } = H;
  orient(P.pelvis, o.pc, o.U, o.F); orient(P.abdomen, o.pc, o.U, o.F); orient(P.chest, o.chestBase, o.Uc, o.Fc);
  orient(P.neck, o.neckBase, o.Uh, o.Fh); orient(P.head, o.neckBase.clone().addScaledVector(o.Uh, L.neck), o.Uh, o.Fh);
  for (let i = 0; i < 2; i++) {
    const front = o.bendA[i].clone().negate();
    orient(P.ua[i], o.sh[i], o.el[i].clone().sub(o.sh[i]), front);
    orient(P.fa[i], o.el[i], o.fd[i], front);
    orient(P.hand[i], o.wr[i], o.hd[i], o.palm[i]);
    H.fist[i].visible = !o.flat[i]; H.flatHand[i].visible = o.flat[i];
    orient(P.th[i], o.hip[i], o.kn[i].clone().sub(o.hip[i]), o.bendL[i]);
    orient(P.sh[i], o.kn[i], o.an[i].clone().sub(o.kn[i]), o.bendL[i]);
    const fd = o.fdir[i], fup = V(-fd.y, fd.x, 0); if (fup.lengthSq() < 1e-4) fup.copy(UP);
    orient(P.foot[i], o.an[i], fd, fup);
    J.sh[i].position.copy(o.sh[i]); J.el[i].position.copy(o.el[i]); J.wr[i].position.copy(o.wr[i]);
    J.hip[i].position.copy(o.hip[i]); J.kn[i].position.copy(o.kn[i]); J.an[i].position.copy(o.an[i]);
  }
}

/* ---------- Matériel ---------- */
function kitBuilder(g) {
  const box = (s, p, m, rz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(...s), MAT[m || "frame"]); o.position.set(...p); if (rz) o.rotation.z = rz; g.add(o); return o; };
  const cyl = (r, h, p, rot, m, seg) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 24), MAT[m || "frame"]); o.position.set(...p); if (rot) o.rotation.set(...rot); g.add(o); return o; };
  // pad rembourré orienté dans le plan x-y (ang : direction de la longueur, en degrés depuis la verticale)
  const padAt = (cx, cy, ang, len, thk, wd, z) => box([thk, len, wd], [cx, cy, z || 0], "dark", -ang * D2R);
  const stacks = [];
  const P = {
    box: (s, p, m) => box(s, p, m),
    bench(x0, x1, h = 0.45, z = 0) {
      box([x1 - x0, 0.075, 0.29], [(x0 + x1) / 2, h - 0.0375, z], "dark");
      [x0 + 0.12, x1 - 0.12].forEach(x => { box([0.05, h - 0.08, 0.05], [x, (h - 0.08) / 2, z]); box([0.06, 0.03, 0.42], [x, 0.015, z]); });
      box([x1 - x0 - 0.24, 0.04, 0.05], [(x0 + x1) / 2, h - 0.09, z]);
    },
    benchZ(x, h = 0.45) { box([0.32, 0.08, 1.1], [x, h - 0.04, 0], "dark"); [-0.4, 0.4].forEach(z => box([0.05, h - 0.08, 0.05], [x, (h - 0.08) / 2, z])); box([0.3, 0.03, 0.06], [x, 0.015, -0.4]); box([0.3, 0.03, 0.06], [x, 0.015, 0.4]); },
    rack(x) { [1, -1].forEach(s => { box([0.06, 1.25, 0.06], [x, 0.625, 0.56 * s]); box([0.08, 0.05, 0.07], [x + 0.05, 1.12, 0.56 * s]); box([0.4, 0.04, 0.06], [x, 0.02, 0.56 * s]); }); },
    seat(x, h) { box([0.4, 0.07, 0.38], [x, h - 0.035, 0], "dark"); box([0.07, h - 0.07, 0.07], [x, (h - 0.07) / 2, 0]); box([0.5, 0.04, 0.4], [x - 0.05, 0.02, 0]); },
    backPad(thDeg, x, pcy, len = 0.75) {
      const t = thDeg * D2R, U = V(Math.sin(t), Math.cos(t)), F = V(Math.cos(t), -Math.sin(t));
      const c = V(x, pcy).addScaledVector(U, 0.36).addScaledVector(F, -0.15);
      padAt(c.x, c.y, thDeg, len, 0.07, 0.3); box([0.05, c.y, 0.05], [c.x - 0.04, c.y / 2, 0]);
    },
    inclineBench(thDeg, x, pcy) {
      P.backPad(thDeg, x, pcy, 0.9); box([0.4, 0.07, 0.3], [x - 0.02, 0.435, 0], "dark");
      box([0.06, 0.4, 0.06], [x, 0.2, 0]); box([1.1, 0.04, 0.35], [x - 0.2, 0.02, 0]);
    },
    frame(x, h) { box([0.08, h, 0.1], [x, h / 2, 0]); box([0.6, 0.04, 0.6], [x, 0.02, 0]); },
    stack(x, z, top) {
      const st = new THREE.Group(); g.add(st);
      [1, -1].forEach(s => cyl(0.01, 1.4, [x, 0.75, z + 0.085 * s], null, "steel", 10));
      const plates = [];
      for (let k = 0; k < 12; k++) { const o = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.042, 0.24), MAT[k < 6 ? "plate" : "frame"]); o.position.set(x, 0.07 + k * 0.047, z); st.add(o); plates.push(o); }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.24), MAT.pink); st.add(cap);
      const cab = top ? cyl(0.006, 1, [0, 0, 0], null, "cable", 8) : null;
      const S = { rise(d) { d = Math.max(0, Math.min(0.8, d)); plates.slice(6).forEach((o, k) => { o.position.y = 0.07 + (k + 6) * 0.047 + d; }); cap.position.set(x, 0.07 + 12 * 0.047 - 0.01 + d, z);
        if (cab) segment(cab, V(x, cap.position.y, z), V(...top)); } };
      S.rise(0); stacks.push(S); return S;
    },
    tower(x, z, py, px) {
      box([0.1, 2.3, 0.12], [x, 1.15, z]); box([0.5, 0.04, 0.4], [x, 0.02, z]);
      cyl(0.045, 0.03, [px != null ? px : x, py, z], [Math.PI / 2, 0, 0], "steel", 24);
      P.stack(x + (x >= 0 ? 0.16 : -0.16) * (Math.abs(z) > 0.5 ? 0 : 1), z + (Math.abs(z) > 0.5 ? (z > 0 ? 0.14 : -0.14) : 0), [px != null ? px : x, py, z]);
    },
    wheel(x, y, z) { cyl(0.05, 0.03, [x, y, z], [Math.PI / 2, 0, 0], "steel", 32); },
    roller(x, y, z, len) { cyl(0.055, len, [x, y, z], [Math.PI / 2, 0, 0], "dark"); },
    pullup(h) { cyl(0.016, 1.3, [0, h, 0], [Math.PI / 2, 0, 0], "steel"); [1, -1].forEach(s => { box([0.07, h + 0.06, 0.07], [0, (h + 0.06) / 2, 0.65 * s]); box([0.7, 0.04, 0.08], [0, 0.02, 0.65 * s]); }); },
    dips(h, w) { [1, -1].forEach(s => { cyl(0.022, 0.8, [0.02, h, w * s], [0, 0, Math.PI / 2], "steel"); [-0.36, 0.4].forEach(x => box([0.06, h, 0.06], [x, h / 2, w * s])); box([0.9, 0.04, 0.08], [0.02, 0.02, w * s]); }); },
    mat(x0, x1) { box([x1 - x0, 0.012, 0.7], [(x0 + x1) / 2, 0.006, 0], "mat"); },
    hyperBench(hx, hy) {
      const n = V(0.707, -0.707), c = V(hx, hy).addScaledVector(n, 0.13).addScaledVector(V(-0.707, -0.707), 0.13);
      padAt(c.x, c.y, 45, 0.34, 0.08, 0.36); box([0.07, c.y, 0.07], [c.x + 0.08, c.y / 2, 0]); box([1.1, 0.04, 0.5], [hx - 0.25, 0.02, 0]);
      cyl(0.045, 0.3, [-0.64, 0.46, 0], [Math.PI / 2, 0, 0], "dark"); box([0.06, 0.62, 0.06], [-0.58, 0.31, 0], "frame", -0.4); box([0.2, 0.03, 0.3], [-0.68, 0.3, 0], "frame", -0.8);
    },
    preacher() {
      box([0.36, 0.07, 0.34], [-0.06, 0.505, 0], "dark"); box([0.07, 0.47, 0.07], [-0.06, 0.235, 0]); box([0.9, 0.04, 0.5], [0.15, 0.02, 0]);
      padAt(0.064, 0.941, 141.5, 0.36, 0.07, 0.52); box([0.07, 0.86, 0.07], [0.2, 0.43, 0]);
    },
    legPress() {
      const T = V(0.707, 0.707);
      P.backPad(-45, 0, 0.48, 0.8);
      padAt(-0.078, 0.332, 45, 0.36, 0.07, 0.36);
      box([1.9, 0.05, 0.7], [0.35, 0.025, 0]); box([0.08, 0.3, 0.3], [-0.1, 0.17, 0]);
      [1, -1].forEach(s => { const a = V(0.28, 0.42), b = V(1.25, 1.39); segment(cyl(0.025, 1, [0, 0, 0], null, "steel", 12), V(a.x, a.y, 0.27 * s), V(b.x, b.y, 0.27 * s)); box([0.06, 1.35, 0.06], [1.28, 0.68, 0.27 * s]); });
      P._T = T;
    },
    legExtension() {
      P.seat(0.02, 0.57); P.backPad(-12, 0, 0.68, 0.7); P.frame(-0.45, 1.5); P.stack(-0.62, 0);
      box([0.06, 0.62, 0.06], [0.45, 0.31, 0.3]); box([0.06, 0.62, 0.06], [0.45, 0.31, -0.3]);
    },
    legCurl() {
      box([1.3, 0.08, 0.34], [0.2, 0.58, 0], "dark"); box([0.3, 0.07, 0.3], [0.78, 0.5, 0], "dark");
      [-0.35, 0.75].forEach(x => box([0.06, 0.54, 0.06], [x, 0.27, 0])); box([1.5, 0.04, 0.5], [0.2, 0.02, 0]);
      box([0.06, 0.7, 0.06], [-0.49, 0.35, 0.3]); box([0.06, 0.7, 0.06], [-0.49, 0.35, -0.3]); P.frame(1.05, 1.5); P.stack(1.2, 0);
    },
    hipMachine() { P.seat(0.02, 0.51); P.backPad(-12, 0, 0.62, 0.7); P.frame(-0.45, 1.5); P.stack(-0.62, 0); box([0.06, 0.33, 0.06], [0.42, 0.165, 0.12]); box([0.06, 0.33, 0.06], [0.42, 0.165, -0.12]); },
    hack() {
      const U = V(-0.423, 0.906); const p0 = V(-0.331, 0.935);
      [1, -1].forEach(s => segment(cyl(0.025, 1, [0, 0, 0], null, "steel", 12), p0.clone().addScaledVector(U, -0.95).setZ(0.25 * s), p0.clone().addScaledVector(U, 1.0).setZ(0.25 * s)));
      box([0.5, 0.05, 0.6], [0.24, 0.12, 0], "dark", 20 * D2R); box([1.6, 0.05, 0.7], [-0.05, 0.025, 0]);
      [1, -1].forEach(s => box([0.07, 2.0, 0.07], [-0.78, 1.0, 0.3 * s]));
    },
  };
  return { P, stacks };
}
// cylindre étiré entre deux points
function segment(o, a, b) { const d = b.clone().sub(a); o.scale.set(1, Math.max(0.001, d.length()), 1); orient(o, a.clone().addScaledVector(d, 0.5), d, V(1, 0, 0)); return o; }
function barbell(r, len = 1.9) {
  const g = new THREE.Group(), cyl = (rad, h, y, m, seg) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, seg || 24), MAT[m]); o.position.y = y; g.add(o); };
  const half = len / 2;
  cyl(0.0135, len - (r ? 0.58 : 0), 0, "steel");
  if (r) [1, -1].forEach(s => { cyl(0.025, 0.3, (half - 0.15) * s, "steel"); cyl(0.034, 0.03, (half - 0.3) * s, "steel"); cyl(r, 0.045, (half - 0.25) * s, "plate", 40); cyl(r * 0.995, 0.006, (half - 0.225) * s, "pink", 40); cyl(r * 0.78, 0.04, (half - 0.2) * s, "plate", 40); });
  else [1, -1].forEach(s => cyl(0.02, 0.1, (half - 0.07) * s, "dark"));
  return shadowy(g);
}
function dumbbell() {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 16), MAT.steel); g.add(h);
  [1, -1].forEach(s => { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.065, 6), MAT.plate); o.position.y = 0.0925 * s; o.rotation.y = Math.PI / 6; g.add(o); });
  return shadowy(g);
}
function kettlebell() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), MAT.plate); b.position.y = -0.11; b.scale.y = 0.9; g.add(b);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 10, 24, Math.PI), MAT.plate); h.rotation.z = Math.PI; h.position.y = -0.02; g.add(h);
  return shadowy(g);
}

// matériel en mouvement : renvoie une fonction de mise à jour
function buildImplements(ex, g, stacks, o0) {
  const ups = [];
  const mid = o => o.hand[0].clone().add(o.hand[1]).multiplyScalar(0.5);
  const lat = o => o.hand[1].clone().sub(o.hand[0]);
  for (const im of ex.imp || []) {
    if (im.t === "bar") { const b = barbell(im.r, im.len); g.add(b); ups.push(o => orient(b, mid(o), lat(o), UP)); }
    else if (im.t === "db") {
      const ds = (im.hands || [0, 1]).map(i => { const d = dumbbell(); g.add(d); return [i, d]; });
      ups.push(o => ds.forEach(([i, d]) => {
        orient(d, o.hand[i], o.hx[i], o.hd[i]);
      }));
    } else if (im.t === "db1") {
      const d = dumbbell(); g.add(d);
      ups.push(o => { const ax = im.axis === "fore" ? o.fd[0].clone().add(o.fd[1]) : im.axis === "torso" ? o.Uc.clone() : UP.clone(); orient(d, mid(o).addScaledVector(ax.clone().normalize(), im.axis === "fore" ? 0.03 : 0), ax, o.F); });
    } else if (im.t === "kb") { const k = kettlebell(); g.add(k); ups.push(o => { const d = o.fd[0].clone().add(o.fd[1]).normalize(); orient(k, mid(o), d.clone().negate(), o.F); }); }
    else if (im.t === "wheel") {
      const w = new THREE.Group(); g.add(w);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 32), MAT.plate); w.add(disc);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 10), MAT.steel); w.add(hub); shadowy(w);
      ups.push(o => { const c = mid(o); c.y = 0.09; w.position.copy(c); w.rotation.set(Math.PI / 2, -c.x / 0.09, 0); });
    } else if (im.t === "cable") {
      const n = im.to === "hands" ? 2 : 1, cabs = [], len0 = [];
      for (let i = 0; i < n; i++) cabs.push(segment(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), MAT.cable), V(), V(0, 1, 0)));
      cabs.forEach(c => g.add(c));
      const ends = o => im.to === "hands" ? [0, 1].map(i => o.hand[i]) : [mid(o)];
      const froms = [0, 1].map(i => V(im.from[0], im.from[1], (i === 0 ? -1 : 1) * im.from[2]));
      let handle = null;
      if (im.handle === "lat") { handle = new THREE.Group(); const b = barbell(0, 1.0); handle.add(b); [1, -1].forEach(s => { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.19, 12), MAT.steel); e.position.set(0, 0.57 * s, -0.03); e.rotation.x = -0.35 * s; handle.add(e); }); g.add(shadowy(handle)); }
      if (im.handle === "rope") { handle = new THREE.Group(); [0, 1].forEach(() => handle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 10), MAT.dark))); g.add(handle); }
      if (im.handle === "v") { handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), MAT.steel); g.add(handle); }
      const dh = im.handle === "d" ? [0, 1].map(() => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 18), MAT.steel); g.add(t); return t; }) : null;
      const lens = o => ends(o).map((e, i) => e.distanceTo(n === 2 ? froms[i] : froms[1]));
      const base = lens(o0);
      ups.push(o => {
        const es = ends(o);
        es.forEach((e, i) => segment(cabs[i], n === 2 ? froms[i] : froms[1], e));
        if (handle && im.handle === "lat") orient(handle, mid(o), lat(o), UP);
        if (handle && im.handle === "rope") { const c = mid(o).lerp(froms[1], 0.04); [0, 1].forEach(i => segment(handle.children[i], c, o.hand[i])); }
        if (handle && im.handle === "v") { handle.position.copy(mid(o)); handle.rotation.set(0, 0, 0); }
        if (dh) dh.forEach((t, i) => { orient(t, o.hand[i], o.hd[i], o.R); t.rotateX(Math.PI / 2); });
        const L2 = lens(o); (im.stacks || []).forEach((si, k) => { if (stacks[si]) stacks[si].rise((L2[Math.min(k, L2.length - 1)] - base[Math.min(k, base.length - 1)]) * (im.k || 1)); });
      });
    } else if (im.t === "link") {
      const parts = [0, 1].map(i => {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 10), MAT.frame); g.add(rod);
        let pad;
        if (im.pad === "roller") { pad = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 20), MAT.dark); }
        else if (im.pad === "pad") { pad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.12), MAT.dark); }
        else { pad = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 12), MAT.dark); }
        g.add(pad); shadowy(rod); shadowy(pad); return { rod, pad, piv: V(im.piv[0], im.piv[1], (i === 0 ? -1 : 1) * im.piv[2]) };
      });
      ups.push(o => parts.forEach((p, i) => {
        let at;
        if (im.to === "hand") at = o.hand[i].clone();
        else if (im.to === "knee") { const out = V(0, 0, i === 0 ? -1 : 1); at = o.kn[i].clone().addScaledVector(out, im.side === "in" ? -0.075 : 0.075); }
        else { const sd = o.an[i].clone().sub(o.kn[i]).normalize(), fr = o.bendL[i].clone().addScaledVector(sd, -o.bendL[i].dot(sd)).normalize(); at = o.an[i].clone().addScaledVector(sd, -0.06).addScaledVector(fr, im.side === "back" ? -0.07 : 0.07); }
        segment(p.rod, p.piv, at);
        if (im.pad === "roller") { p.pad.position.copy(at); p.pad.rotation.set(Math.PI / 2, 0, 0); }
        else if (im.pad === "pad") { p.pad.position.copy(at); p.pad.rotation.set(0, 0, 0); }
        else { orient(p.pad, at, UP, V(1, 0, 0)); }
      }));
    } else if (im.t === "stackmove") {
      const ref = o => im.ref === "ankles" ? o.an[0].clone().add(o.an[1]).multiplyScalar(0.5) : im.ref === "knees" ? V(0, 0, Math.abs(o.kn[1].z - o.kn[0].z)) : mid(o);
      const r0 = ref(o0);
      ups.push(o => { if (stacks[0]) stacks[0].rise(ref(o).distanceTo(r0) * (im.k || 1)); });
    } else if (im.t === "platform") {
      const pl = new THREE.Group(); g.add(pl);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.04), MAT.frame); pl.add(plate);
      const sled = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.36, 0.1), MAT.dark); sled.position.set(0, -0.02, 0.07); pl.add(sled); shadowy(pl);
      const T = V(0.707, 0.707, 0);
      ups.push(o => { const c = o.an[0].clone().add(o.an[1]).multiplyScalar(0.5).setZ(0).addScaledVector(T, 0.105); orient(pl, c, V(-0.707, 0.707, 0), T); });
    } else if (im.t === "sled") {
      const s = new THREE.Group(); g.add(s);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.75, 0.07), MAT.dark); s.add(back);
      [1, -1].forEach(k => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), MAT.dark); p.position.set(0.13 * k, 0.4, 0.07); s.add(p); });
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.6, 0.05), MAT.frame); fr.position.set(0, 0, -0.07); s.add(fr); shadowy(s);
      ups.push(o => { const c = o.pc.clone().addScaledVector(o.U, 0.26).addScaledVector(o.F, -0.15); orient(s, c, o.U, o.F); });
    }
  }
  return (o, s) => ups.forEach(f => f(o, s));
}

/* ---------- Scène, caméra, rendu ---------- */
function initScene() {
  if (G) return G;
  materials();
  G = { geo: { sph: new THREE.SphereGeometry(1, 32, 22), soft: spindleGeo(true), spin: spindleGeo(false), cap: new THREE.CapsuleGeometry(0.019, 0.05, 6, 14), finger: new THREE.CapsuleGeometry(0.0085, 0.045, 4, 10) } };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { G.failed = true; return G; }
  const mobile = Math.min(screen.width, screen.height) < 700;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8299, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 4.5, 3); key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 12 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9e6, 0.9); rim.position.set(-3, 2.5, -2.5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.ShadowMaterial({ opacity: 0.22 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.565, 96), new THREE.MeshBasicMaterial({ color: 0x9b93ad, transparent: true, opacity: 0.35 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.001; scene.add(ring);
  const H = buildMan(); scene.add(H.man);
  const kit = new THREE.Group(); scene.add(kit);
  Object.assign(G, { renderer, scene, camera, H, kit, orbit: { az: 0, pol: 0, dist: 4, target: V(), goal: null } });
  setupOrbit(renderer.domElement);
  return G;
}
// rotation autour du mannequin au doigt ou à la souris
function setupOrbit(el) {
  let drag = null;
  el.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { el.setPointerCapture(e.pointerId); } catch (_) { } });
  el.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const o = G.orbit; o.az -= (e.clientX - drag.x) * 0.008; o.pol = Math.min(1.45, Math.max(0.08, o.pol - (e.clientY - drag.y) * 0.006)); o.goal = null;
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const end = () => { drag = null; }; el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", e => { e.preventDefault(); G.orbit.dist = Math.min(9, Math.max(1.6, G.orbit.dist * (1 + Math.sign(e.deltaY) * 0.08))); G.orbit.goal = null; }, { passive: false });
}
function placeCamera(dt) {
  const o = G.orbit;
  if (o.goal) { const k = Math.min(1, dt * 4); o.az += (o.goal.az - o.az) * k; o.pol += (o.goal.pol - o.pol) * k; o.dist += (o.goal.dist - o.dist) * k; o.target.lerp(o.goal.target, k); }
  const c = G.camera;
  c.position.set(o.target.x + o.dist * Math.cos(o.pol) * Math.cos(o.az), o.target.y + o.dist * Math.sin(o.pol), o.target.z + o.dist * Math.cos(o.pol) * Math.sin(o.az));
  c.lookAt(o.target);
}

/* ---------- Animation ---------- */
const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
function timeline(ex) {
  const k = 1 / (ex.tempo || 1);
  if (ex.order === "iso") return [{ k: "iso", f: 0, t: 1, d: 1.8 }, { k: "iso", f: 1, t: 0, d: 1.8 }];
  if (ex.order === "alt") return [{ k: "con", f: 0, t: 1, d: 0.55 }, { k: "exc", f: 1, t: 0, d: 0.55 }];
  return ex.order === "exc"
    ? [{ k: "exc", f: 0, t: 1, d: 1.9 * k }, { k: "hold", d: 0.35 * k }, { k: "con", f: 1, t: 0, d: 1.25 * k }, { k: "hold", d: 0.55 * k }]
    : [{ k: "con", f: 0, t: 1, d: 1.25 * k }, { k: "hold", d: 0.35 * k }, { k: "exc", f: 1, t: 0, d: 1.9 * k }, { k: "hold", d: 0.55 * k }];
}
function sample(ex, time) {
  const tl = timeline(ex), total = tl.reduce((n, p) => n + p.d, 0);
  let x = ((time % total) + total) % total, prevK = tl[tl.length - 1].k, prevS = 0;
  for (const p of tl) {
    if (p.k !== "hold") { if (x <= p.d) return { s: p.f + (p.t - p.f) * ease(x / p.d), k: p.k }; prevS = p.t; prevK = p.k; }
    else if (x <= p.d) return { s: prevS, k: prevK };
    x -= p.d;
  }
  return { s: 0, k: tl[0].k };
}

/* ---------- Affichage d'un exercice ---------- */
const view = { ex: null, time: 0, playing: true, speed: 1, last: 0, raf: 0, phase: "", update: null, stage: null };
function showExercise(ex) {
  initScene(); if (G.failed) return;
  const { H, kit } = G;
  kit.clear();
  const g = new THREE.Group(); kit.add(g);
  const { P, stacks } = kitBuilder(g); if (ex.props) ex.props(P); shadowy(g);
  for (const list of Object.values(H.muscles)) list.forEach(m => { m.material = MAT.pad; });
  ex.p.forEach(n => (H.muscles[n] || []).forEach(m => { m.material = MAT.primary; }));
  ex.s.forEach(n => (H.muscles[n] || []).forEach(m => { if (m.material !== MAT.primary) m.material = MAT.secondary; }));
  const o0 = solve(ex, 0);
  view.update = buildImplements(ex, g, stacks, o0);
  // cadrage automatique : mannequin aux deux extrémités du mouvement, plus le matériel
  const box = new THREE.Box3(), body = new THREE.Box3();
  for (const s of [0, 0.5, 1]) { const o = solve(ex, s); applyPose(H, o); view.update(o, s); H.man.updateMatrixWorld(true); body.expandByObject(H.man); }
  kit.updateMatrixWorld(true); box.copy(body).expandByObject(kit);
  const bs = body.getBoundingSphere(new THREE.Sphere()), as = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(bs.radius * 1.12, as.radius * 0.78), target = bs.center.clone().lerp(as.center, 0.25);
  target.y -= r * 0.1; // un peu de marge en bas pour l'étiquette de phase
  const lying = Math.abs(ex.a.th || 0) > 50 && !ex.view;
  const d = V(...(ex.view || (lying ? [0.45, 0.75, 1] : [1, 0.32, 1]))).normalize();
  const fov = G.camera.fov * D2R / 2, aspect = view.stage ? view.stage.clientWidth / Math.max(1, view.stage.clientHeight) : 1.2;
  const dist = r / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * aspect))) * 0.97;
  const goal = { az: Math.atan2(d.z, d.x), pol: Math.asin(d.y), dist, target };
  if (!view.ex) Object.assign(G.orbit, goal, { target: target.clone(), goal: null }); else G.orbit.goal = goal;
  view.ex = ex; view.time = 0; view.phase = "";
  frame(true);
}
function frame(force) {
  const now = performance.now(), dt = Math.min(0.05, (now - (view.last || now)) / 1000); view.last = now;
  if (!view.ex || !G || G.failed) return;
  if (view.playing) view.time += dt * view.speed;
  const { s, k } = sample(view.ex, view.time);
  const o = solve(view.ex, s); applyPose(G.H, o); view.update(o, s);
  const glow = k === "con" || k === "iso" ? 0.45 : 0.22; MAT.primary.emissiveIntensity += (glow - MAT.primary.emissiveIntensity) * (force ? 1 : 0.12);
  if (k !== view.phase && view.pill) {
    view.phase = k; const ph = view.ex.ph || {};
    view.pill.className = "exo-pill " + k;
    view.pill.innerHTML = k === "iso" ? "<i>●</i><span>Gainage · " + ph.iso + "</span>" : view.ex.order === "alt" ? "<i>↻</i><span>" + (k === "con" ? ph.con : ph.exc) + "</span>"
      : k === "con" ? "<i>↑</i><span>Phase concentrique · " + ph.con + "</span>" : "<i>↓</i><span>Phase excentrique · " + ph.exc + "</span>";
  }
  placeCamera(dt);
  G.renderer.render(G.scene, G.camera);
}
function loop() {
  view.raf = 0;
  if (!G || !G.renderer || !G.renderer.domElement.isConnected) return; // page quittée : on arrête
  if (!document.hidden) frame();
  view.raf = requestAnimationFrame(loop);
}
function resize() {
  if (!view.stage || !G || G.failed) return;
  const w = view.stage.clientWidth, h = view.stage.clientHeight; if (!w || !h) return;
  G.renderer.setSize(w, h, false); G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
}
let ro = null;

/* =====================================================================
   Interface (montée dans #exo-root par app.js)
   ===================================================================== */
const ui = { q: "", group: "tous" };
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const groupOf = ex => ex.g || MUSCLES[ex.p[0]][1];
const byName = {}; EXOS.forEach(e => { byName[norm(e.n)] = e; });
function matches(ex) {
  const mus = ex.p.concat(ex.s);
  if (ui.group !== "tous" && groupOf(ex) !== ui.group && !ex.p.some(mm => MUSCLES[mm][1] === ui.group)) return false;
  if (!ui.q) return true;
  return norm([ex.n, ex.gear, mus.map(mm => MUSCLES[mm][0]).join(" ")].join(" ")).includes(norm(ui.q));
}
function listHtml() {
  const v = EXOS.filter(matches);
  if (!v.length) return '<div class="card empty">Aucun exercice ne correspond à ta recherche.</div>';
  let h = "";
  for (const [gid, gname] of GROUPS.slice(1)) {
    const items = v.filter(e => groupOf(e) === gid); if (!items.length) continue;
    h += '<div class="section-title">' + gname + '</div><div class="list">' + items.map(e => '<a href="#/exercices/' + e.id + '"><div><b>' + esc(e.n) + '</b><div class="muted small">' +
      esc(e.p.map(mm => MUSCLES[mm][0]).join(", ")) + " · " + esc(e.gear) + '</div></div><span class="exo-go" aria-hidden="true">›</span></a>').join("") + "</div>";
  }
  return h;
}
function detailHtml(ex) {
  const chip = (mm, c) => '<span class="exo-mu ' + c + '">' + esc(MUSCLES[mm][0]) + "</span>";
  const vars = ex.vars.map(n => { const t = byName[norm(n)]; return t ? '<a class="exo-var" href="#/exercices/' + t.id + '">' + esc(n) + "</a>" : '<span class="exo-var">' + esc(n) + "</span>"; }).join("");
  const back = api && api.back ? '<a class="back" href="' + esc(api.back.href) + '">‹ ' + esc(api.back.label) + "</a>" : '<a class="back" href="#/exercices">‹ Exercices</a>';
  return back +
    '<div class="exo-main"><div class="exo-stage-col"><div class="exo-stage" id="exo-stage"><div class="exo-ctrl"><button class="btn sm" id="exo-slow" aria-pressed="' + (view.speed !== 1) + '">Ralenti</button><button class="btn sm" id="exo-play" aria-pressed="' + (!view.playing) + '">' + (view.playing ? "Pause" : "Lecture") + '</button></div>' +
    '<div class="exo-phase"><span class="exo-pill" id="exo-pill"></span></div></div>' +
    '<div class="exo-legend"><span class="p">Muscles principaux</span><span class="s">Muscles secondaires</span><em>Fais glisser l\'image pour tourner autour</em></div></div>' +
    '<article class="card exo-fiche"><div><h1 class="exo-title">' + esc(ex.n) + '</h1><div class="exo-tags"><span>' + esc(ex.gear) + "</span><span>" + esc(ex.lvl) + "</span><span>" + (ex.time ? "Temps" : esc(ex.reps) + " reps") + "</span></div></div>" +
    '<div><h3>Muscles travaillés</h3><div class="exo-mus">' + ex.p.map(mm => chip(mm, "p")).join("") + ex.s.map(mm => chip(mm, "s")).join("") + "</div></div>" +
    '<div><h3>Bien l\'exécuter</h3><ul class="exo-tips">' + ex.tips.map(t => "<li>" + esc(t) + "</li>").join("") + "</ul></div>" +
    '<div><h3>Erreurs fréquentes</h3><ul class="exo-tips bad">' + ex.err.map(t => "<li>" + esc(t) + "</li>").join("") + "</ul></div>" +
    '<div><h3>Variantes</h3><div class="exo-vars">' + vars + "</div></div>" +
    '<button class="btn primary block big" id="exo-add">Ajouter à une séance</button></article></div>';
}
let api = null, bound = false;
export function mount(root, id, appApi) {
  api = appApi;
  const ex = id ? EXOS.find(e => e.id === id) : null;
  if (!ex) {
    root.innerHTML = '<div class="page-head"><h1>Exercices</h1><span class="muted small">' + EXOS.length + ' exercices</span></div>' +
      '<input class="f exo-q" id="exo-q" type="search" placeholder="Rechercher un exercice, un muscle, une machine" autocomplete="off" aria-label="Rechercher un exercice" value="' + esc(ui.q) + '">' +
      '<div class="exo-chips" role="group" aria-label="Filtrer par muscle">' + GROUPS.map(([g, n]) => '<button class="chip-btn" data-exo-g="' + g + '" aria-pressed="' + (ui.group === g) + '">' + n + "</button>").join("") + "</div>" +
      '<div id="exo-list">' + listHtml() + "</div>";
    const q = root.querySelector("#exo-q");
    q.addEventListener("input", () => { ui.q = q.value.trim(); root.querySelector("#exo-list").innerHTML = listHtml(); });
    root.querySelectorAll("[data-exo-g]").forEach(b => b.addEventListener("click", () => {
      ui.group = b.dataset.exoG; root.querySelectorAll("[data-exo-g]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); root.querySelector("#exo-list").innerHTML = listHtml();
    }));
    return;
  }
  root.innerHTML = detailHtml(ex);
  const stage = root.querySelector("#exo-stage"); view.stage = stage; view.pill = root.querySelector("#exo-pill"); view.phase = "";
  initScene();
  if (G.failed) { stage.insertAdjacentHTML("beforeend", '<div class="exo-fallback">L\'animation 3D n\'est pas disponible sur cet appareil.</div>'); }
  else {
    stage.prepend(G.renderer.domElement);
    if (ro) ro.disconnect(); ro = new ResizeObserver(resize); ro.observe(stage); resize();
    if (view.ex !== ex) { if (matchMedia("(prefers-reduced-motion: reduce)").matches && !view.ex) { view.playing = false; } showExercise(ex); }
    else frame(true);
    if (!view.raf) view.raf = requestAnimationFrame(loop);
  }
  root.querySelector("#exo-play").addEventListener("click", e => { view.playing = !view.playing; e.currentTarget.textContent = view.playing ? "Pause" : "Lecture"; e.currentTarget.setAttribute("aria-pressed", String(!view.playing)); });
  root.querySelector("#exo-slow").addEventListener("click", e => { view.speed = view.speed === 1 ? 0.4 : 1; e.currentTarget.setAttribute("aria-pressed", String(view.speed !== 1)); });
  root.querySelector("#exo-add").addEventListener("click", () => api && api.add({ name: ex.n, time: !!ex.time, reps: ex.reps, rest: ex.rest }));
  window.scrollTo(0, 0);
}

// outil de vérification : contacts anormaux entre le corps, le matériel et le sol
function segDist(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r); let s = 0, t = 0;
  if (a < 1e-9 && e < 1e-9) return p1.distanceTo(p2);
  if (a < 1e-9) { t = Math.min(1, Math.max(0, f / e)); }
  else { const c = d1.dot(r); if (e < 1e-9) { s = Math.min(1, Math.max(0, -c / a)); } else { const b = d1.dot(d2), den = a * e - b * b;
    s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0; t = (b * s + f) / e;
    if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); } } }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
function bodyCaps(o) {
  const C = [], cap = (n, a, b, r) => C.push({ n, a, b, r });
  const hc = o.neckBase.clone().addScaledVector(o.Uh, L.neck + 0.105).addScaledVector(o.Fh, 0.01);
  cap("tête", hc, hc, 0.095);
  cap("thorax", o.chestBase.clone().addScaledVector(o.Uc, 0.07), o.chestBase.clone().addScaledVector(o.Uc, 0.25), 0.1);
  cap("ventre", o.pc.clone().addScaledVector(o.U, 0.04), o.pc.clone().addScaledVector(o.U, 0.2), 0.085);
  cap("bassin", o.pc.clone().addScaledVector(o.U, -0.05), o.pc.clone().addScaledVector(o.U, 0.0), 0.1);
  for (let i = 0; i < 2; i++) {
    const S = i ? "D" : "G";
    cap("bras" + S, o.sh[i].clone().lerp(o.el[i], 0.25), o.el[i], 0.04); cap("avant-bras" + S, o.el[i], o.wr[i], 0.03); cap("main" + S, o.wr[i], o.hand[i], 0.03);
    cap("cuisse" + S, o.hip[i].clone().lerp(o.kn[i], 0.2), o.kn[i], 0.065); cap("tibia" + S, o.kn[i], o.an[i], 0.045);
    const toe = o.an[i].clone().addScaledVector(o.fdir[i], 0.18), heel = o.an[i].clone().addScaledVector(o.fdir[i], -0.05), up = V(-o.fdir[i].y, o.fdir[i].x, 0);
    cap("pied" + S, heel.addScaledVector(up, -0.045), toe.addScaledVector(up, -0.045), 0.03);
  }
  return C;
}
function implCaps(ex, o) {
  const C = [], mid = o.hand[0].clone().add(o.hand[1]).multiplyScalar(0.5), lat = o.hand[1].clone().sub(o.hand[0]).normalize();
  for (const im of ex.imp || []) {
    if (im.t === "bar") { const h = (im.len || 1.9) / 2; C.push({ n: "barre", a: mid.clone().addScaledVector(lat, -h), b: mid.clone().addScaledVector(lat, h), r: 0.015, grip: true });
      if (im.r) [1, -1].forEach(sg => C.push({ n: "disques", a: mid.clone().addScaledVector(lat, sg * (h - 0.27)), b: mid.clone().addScaledVector(lat, sg * (h - 0.2)), r: im.r, grip: false, plate: true })); }
    if (im.t === "db") (im.hands || [0, 1]).forEach(i => { const ax = o.hx[i];
      [1, -1].forEach(sg => C.push({ n: "haltère", a: o.hand[i].clone().addScaledVector(ax, sg * 0.07), b: o.hand[i].clone().addScaledVector(ax, sg * 0.115), r: 0.05, own: i })); });
    if (im.t === "db1") C.push({ n: "haltère", a: mid.clone(), b: mid.clone(), r: 0.06, grip: true });
    if (im.t === "kb") { const d = o.fd[0].clone().add(o.fd[1]).normalize(); const c = mid.clone().addScaledVector(d, 0.11); C.push({ n: "kettlebell", a: c, b: c, r: 0.1, grip: true }); }
  }
  return C;
}
function check(ex) {
  const issues = {};
  const note = (k, v) => { if (!issues[k] || v > issues[k].v) issues[k] = { v: Math.round(v * 1000) / 10 }; };
  for (let k = 0; k <= 20; k++) {
    const s = k / 20, o = solve(ex, s), B = bodyCaps(o), I = implCaps(ex, o);
    for (const c of B) { const low = Math.min(c.a.y, c.b.y) - c.r; if (low < -0.012) note("sol/" + c.n, -low); }
    for (const c of I) { const low = Math.min(c.a.y, c.b.y) - c.r; if (low < -0.005) note("sol/" + c.n, -low); }
    for (const im of I) for (const b of B) {
      if (/main|avant-bras/.test(b.n) && (im.grip || im.own === (b.n.endsWith("D") ? 1 : 0))) continue;
      if (im.plate && /main/.test(b.n)) continue;
      const pen = im.r + b.r - segDist(im.a, im.b, b.a, b.b); if (pen > 0.01) note(im.n + "↔" + b.n, pen);
    }
    for (let x = 0; x < B.length; x++) for (let y = x + 1; y < B.length; y++) {
      const A = B[x], C2 = B[y];
      const pair = A.n + "|" + C2.n;
      // articulations voisines : contact normal
      if (/^(thorax\|ventre|ventre\|bassin|thorax\|bassin|tête\|thorax)$/.test(pair)) continue;
      if (/^(bras|avant-bras|main)(G|D)\|(bras|avant-bras|main)\2$/.test(pair)) continue;
      if (/^(cuisse|tibia|pied)(G|D)\|(cuisse|tibia|pied)\2$/.test(pair)) continue;
      if (/^(thorax|ventre|bassin)\|(cuisse)/.test(pair) && /bassin/.test(pair)) continue;
      if (/^bassin\|cuisse/.test(pair)) continue;
      if (/^(thorax)\|bras/.test(pair) && segDist(A.a, A.b, C2.a, C2.a) < 0.2) { /* épaule */ }
      const pen = A.r + C2.r - segDist(A.a, A.b, C2.a, C2.b); if (pen > 0.025) note(pair, pen);
    }
  }
  return issues;
}

// outil de vérification (captures d'écran des poses)
function metrics(ex) {
  const deg = r => Math.round(r / D2R), ang = (a, b, c) => deg(a.clone().sub(b).angleTo(c.clone().sub(b)));
  return [0, 0.5, 1].map(t => {
    const o = solve(ex, t), r = {};
    for (const i of [0, 1]) {
      const S = i ? "D" : "G", ua = o.el[i].clone().sub(o.sh[i]);
      r["abd" + S] = deg(Math.atan2(Math.abs(ua.dot(o.R)), -ua.dot(o.U)));        // écart du coude par rapport au buste
      r["coude" + S] = ang(o.sh[i], o.el[i], o.wr[i]);                             // angle du coude
      r["genou" + S] = ang(o.hip[i], o.kn[i], o.an[i]);                            // angle du genou
      r["cuisse" + S] = deg(Math.asin((o.hip[i].y - o.kn[i].y) / L.th));           // cuisse / horizontale (+ = genou plus bas)
      r["coudeW" + S] = Math.round(Math.abs(o.el[i].z) * 100);                     // écart latéral du coude (cm)
      r["coudeH" + S] = Math.round((o.el[i].y - o.wr[i].y) * 100);                 // coude au-dessus de la main (cm)
      r["genouY" + S] = Math.round(o.kn[i].y * 100);
    }
    r.shY = Math.round(o.sh[1].y * 100);
    return r;
  });
}
function handShot(id, s, viewDir, dist) {
  const ex = EXOS.find(e => e.id === id); initScene(); G.renderer.setSize(420, 360, false); G.camera.aspect = 420 / 360; G.camera.updateProjectionMatrix();
  view.stage = null; view.ex = null; showExercise(ex); view.playing = false;
  const o = solve(ex, s); applyPose(G.H, o); view.update(o, s);
  const d = V(...(viewDir || [1, 0.3, 1])).normalize();
  Object.assign(G.orbit, { az: Math.atan2(d.z, d.x), pol: Math.asin(d.y), dist: dist || 0.55, target: o.hand[1].clone(), goal: null });
  placeCamera(0); G.renderer.render(G.scene, G.camera); return G.renderer.domElement.toDataURL("image/png");
}
export const __debug = { solve, EXOS, handShot, metrics: id => metrics(EXOS.find(e => e.id === id)), check: id => check(EXOS.find(e => e.id === id)), shot(id, s, w = 360, h = 300, viewDir) {
  const ex = EXOS.find(e => e.id === id); initScene(); G.renderer.setSize(w, h, false); G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
  view.stage = null; view.ex = null; showExercise(ex); view.playing = false; view.time = 0;
  if (viewDir) { const d = V(...viewDir).normalize(); G.orbit.az = Math.atan2(d.z, d.x); G.orbit.pol = Math.asin(d.y); }
  const o = solve(ex, s); applyPose(G.H, o); view.update(o, s); placeCamera(0); G.renderer.render(G.scene, G.camera); return G.renderer.domElement.toDataURL("image/png");
} };
