const APPS_SCRIPT_URL_L1 = 'https://script.google.com/macros/s/AKfycbzR9HcsOTeU7FLUtbNujUoIg63yB4t6zPNEsvu54sLZGMEFhJOLZx1iAwb8ka31fwDE/exec';

// ⚠️ PLACEHOLDER — Florian doit remplacer par la vraie liste de joueurs + mots de passe
// Les clés DOIVENT correspondre exactement au nom des onglets dans le Google Sheet.
const JOUEURS_MDP = {
  'Florian Bernigaud': 'changeme01',
  'Joueur 2': 'changeme02',
  'Joueur 3': 'changeme03',
  'Joueur 4': 'changeme04',
  'Joueur 5': 'changeme05',
  'Joueur 6': 'changeme06',
  'joueur 7': 'changeme07',
  'Joueur 8': 'changeme08',
  'Joueur 9': 'changeme09',
  'Joueur 10': 'changeme10',
  'Joueur 11': 'changeme11',
  'Joueur 12': 'changeme12',
  'Joueur 13': 'changeme13',
  'Joueur 14': 'changeme14',
  'Joueur 15': 'changeme15',
  'Joueur 16': 'changeme16',
  'Joueur 17': 'changeme17',
  'Joueur 18': 'changeme18',
  'Joueur 19': 'changeme19',
  'Joueur 20': 'changeme20',
};

// 18 équipes de Ligue 1 2025-26 (pour les pronostics de saison)
const EQUIPES_L1 = [
  'Paris SG', 'Lens', 'Lille', 'Lyon', 'Marseille', 'Rennes', 'Monaco',
  'Strasbourg', 'Toulouse', 'Lorient', 'Paris FC', 'Brest', 'Angers',
  'Le Havre', 'Auxerre', 'Nice', 'Troyes', 'Le Mans'
];

// Date/heure de début de la journée 1 = deadline pour les pronostics de saison
const DEADLINE_SAISON = '2026-07-12T21:00:00';

// ════════════════════════════════════════
// CALENDRIER DES MATCHS
// ════════════════════════════════════════
// ⚠️ À COMPLÉTER journée par journée par Florian directement sur GitHub.
// Structure : chaque journée a 9 matchs (m: 1 à 9). Le match m=9 est TOUJOURS
// le match "score exact" (bonus). row = ligne exacte dans le Sheet (voir data.js
// helper journeeRows ci-dessous si besoin de recalculer).
//
// Exemple pour Journée 1 :
const MATCHS_L1 = [
  { journee: 1, m: 1, row: 3,  date: '2026-07-12', heure: '21:00', dom: 'Marseille', ext: 'Lille', scoreExact: false },
  // { journee: 1, m: 2, row: 4,  date: '2026-07-12', heure: '21:00', dom: '', ext: '', scoreExact: false },
  // { journee: 1, m: 3, row: 5,  date: '2026-07-12', heure: '21:00', dom: '', ext: '', scoreExact: false },
  // { journee: 1, m: 4, row: 6,  date: '2026-07-12', heure: '21:00', dom: '', ext: '', scoreExact: false },
  // { journee: 1, m: 5, row: 7,  date: '2026-07-12', heure: '21:00', dom: '', ext: '', scoreExact: false },
  // { journee: 1, m: 6, row: 8,  date: '2026-07-12', heure: '21:00', dom: '', ext: '', scoreExact: false },
  // { journee: 1, m: 7, row: 9,  date: '2026-07-12', heure: '21:00', dom: '', ext: '', scoreExact: false },
  // { journee: 1, m: 8, row: 10, date: '2026-07-12', heure: '21:00', dom: '', ext: '', scoreExact: false },
  // { journee: 1, m: 9, row: 11, date: '2026-07-12', heure: '21:00', dom: '', ext: '', scoreExact: true },
];

// Calcule automatiquement la ligne du sheet pour une journée/match donné
// headerRow(n) = 2 + (n-1)*12 ; matchRow(n, m) = headerRow(n) + m
function matchRowL1(journee, m) {
  const header = 2 + (journee - 1) * 12;
  return header + m;
}
