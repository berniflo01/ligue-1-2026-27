// ════ STATE ════
let currentUser = null;
let pronos = {};          // row -> '1'/'N'/'2' ou undefined
let scores = {};          // row -> {dom, ext} pour matchs score exact
let matchsVerrouilles = new Set();
let resultatsReels = {};  // row -> {resultat, scoreExtReel}
let cotesMap = {};        // row -> {c1, cn, c2}
let savingRows = new Set();
let pronosCharges = false;

let pronosticsSaisonData = {};
let pronosticsSaisonTousData = null;
const pronosticsSaisonVerrouilles = new Date() >= new Date(DEADLINE_SAISON);

// ════ INIT ════
function init() {
  const sel = document.getElementById('select-joueur');
  Object.keys(JOUEURS_MDP).sort().forEach(nom => {
    const opt = document.createElement('option');
    opt.value = nom; opt.textContent = nom;
    sel.appendChild(opt);
  });
  document.getElementById('input-mdp').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  const saved = localStorage.getItem('l1_user');
  if (saved && JOUEURS_MDP[saved]) {
    currentUser = saved;
    showApp();
  }
}

function login() {
  const joueur = document.getElementById('select-joueur').value;
  const mdp = document.getElementById('input-mdp').value;
  const errEl = document.getElementById('error-msg');
  if (!joueur) { errEl.textContent = 'Sélectionne ton nom.'; errEl.style.display = 'block'; return; }
  if (JOUEURS_MDP[joueur] !== mdp) {
    errEl.textContent = 'Mot de passe incorrect.';
    errEl.style.display = 'block';
    document.getElementById('input-mdp').value = '';
    return;
  }
  errEl.style.display = 'none';
  currentUser = joueur;
  localStorage.setItem('l1_user', joueur);
  showApp();
}

function logout() {
  localStorage.removeItem('l1_user');
  currentUser = null; pronos = {}; scores = {}; pronosCharges = false;
  matchsVerrouilles = new Set(); resultatsReels = {};
  document.getElementById('bottom-nav').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('input-mdp').value = '';
}

async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'flex';
  document.getElementById('header-name').textContent = currentUser;
  if (!pronosCharges) {
    await chargerInitL1();
    pronosCharges = true;
  }
  switchTab('pronos');
}

// Un seul appel qui regroupe matchs + pronos joueur + cotes (au lieu de 3 requêtes séparées)
async function chargerInitL1() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL_L1}?action=init_l1&joueur=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    if (!data.ok) { MATCHS_L1 = []; return; }

    MATCHS_L1 = Array.isArray(data.matchs) ? data.matchs : [];

    (data.cotes || []).forEach(c => { cotesMap[c.row] = { c1: c.c1, cn: c.cn, c2: c.c2 }; });

    (data.pronos || []).forEach(p => {
      if (p.prono) pronos[p.row] = String(p.prono);
      if (p.scoreExt !== '' && p.scoreExt !== null && p.scoreExt !== undefined && p.prono !== '') {
        const d = parseInt(p.prono), e = parseInt(p.scoreExt);
        if (!isNaN(d) && !isNaN(e)) scores[p.row] = { dom: d, ext: e };
      }
      if (p.verrouille) {
        matchsVerrouilles.add(p.row);
        resultatsReels[p.row] = { resultat: p.resultat, scoreExtReel: p.scoreExtReel };
      }
    });
  } catch(e) { MATCHS_L1 = []; }
}

// Convertit une date "dd/MM/yyyy" (format sheet FR) en objet Date
function parseDateFR(dateStr) {
  if (!dateStr) return null;
  const [jj, mm, aaaa] = dateStr.split('/');
  if (!jj || !mm || !aaaa) return null;
  return new Date(`${aaaa}-${mm}-${jj}T00:00:00`);
}

// ════ TABS ════
function switchTab(tab) {
  ['pronos','saison','historique','classement'].forEach(t => {
    const btn = document.getElementById(`nav-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
    const screen = document.getElementById(`${t}-screen`);
    if (screen) screen.classList.toggle('active', t === tab);
  });
  if (tab === 'pronos') renderPronos();
  else if (tab === 'saison') renderSaison();
  else if (tab === 'historique') chargerHistorique();
  else if (tab === 'classement') chargerClassement();
}

// ════ PRONOS (par journée) ════
function estMatchJoue(row) {
  return matchsVerrouilles.has(row) && resultatsReels[row] !== undefined;
}

function estJourneeComplete(matchsJournee) {
  if (matchsJournee.length < 9) return false; // journée pas encore entièrement définie
  return matchsJournee.every(m => estMatchJoue(m.row));
}

function renderPronos() {
  const container = document.getElementById('pronos-container');
  container.innerHTML = '';

  const parJournee = {};
  MATCHS_L1.forEach(m => {
    if (!parJournee[m.journee]) parJournee[m.journee] = [];
    parJournee[m.journee].push(m);
  });

  const journeesTriees = Object.keys(parJournee).map(Number).sort((a, b) => a - b);
  const journeesAffichables = journeesTriees.filter(n => !estJourneeComplete(parJournee[n]));

  if (journeesAffichables.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucune journée à pronostiquer pour l\'instant.<br>Regarde du côté de l\'historique !</div>';
    return;
  }

  journeesAffichables.forEach((n, idx) => {
    const matchs = parJournee[n].slice().sort((a, b) => a.m - b.m);
    const isOuverte = idx === 0; // seule la prochaine journée à jouer est ouverte par défaut

    const block = document.createElement('div');
    block.className = 'journee-block';
    const nbJouees = matchs.filter(m => estMatchJoue(m.row)).length;

    const titleBar = document.createElement('div');
    titleBar.className = 'journee-title-bar';
    titleBar.style.cursor = 'pointer';
    titleBar.style.userSelect = 'none';
    titleBar.innerHTML = `<div class="journee-title">Journée ${n}</div><div style="display:flex;align-items:center;gap:10px"><div class="journee-sub">${nbJouees}/${matchs.length} joués</div><span id="arrow-pj${n}" style="color:var(--green);font-size:14px">${isOuverte ? '▲' : '▼'}</span></div>`;
    block.appendChild(titleBar);

    const matchsContainer = document.createElement('div');
    matchsContainer.id = `matchs-j${n}`;
    matchsContainer.style.display = isOuverte ? 'block' : 'none';
    matchs.forEach(m => matchsContainer.appendChild(buildMatchCard(m)));
    block.appendChild(matchsContainer);

    titleBar.onclick = () => {
      const arrow = document.getElementById(`arrow-pj${n}`);
      const show = matchsContainer.style.display === 'none';
      matchsContainer.style.display = show ? 'block' : 'none';
      arrow.textContent = show ? '▲' : '▼';
    };

    container.appendChild(block);
  });
}

function buildMatchCard(match) {
  const row = match.row;
  const locked = estMatchJoue(row);
  const cote = cotesMap[row] || { c1: 0, cn: 0, c2: 0 };
  const prono = pronos[row];
  const score = scores[row];

  const card = document.createElement('div');
  let selClass = '';
  if (match.scoreExact && score) selClass = 'sel-score';
  else if (prono === '1') selClass = 'sel-1';
  else if (prono === 'N') selClass = 'sel-n';
  else if (prono === '2') selClass = 'sel-2';

  card.className = `match-card ${selClass} ${locked ? 'locked' : ''} ${match.scoreExact ? 'score-exact-card' : ''}`;
  card.id = `card-${row}`;

  let lockBadge = '';
  let teamDomStyle = 'font-size:17px;font-weight:700;color:var(--text);line-height:1.2;';
  let teamExtStyle = 'font-size:17px;font-weight:700;color:var(--text);line-height:1.2;';
  let vsContent = 'VS';
  let vsStyle = '';
  let cote1Color = 'var(--gold)', coteNColor = 'var(--gold)', cote2Color = 'var(--gold)';

  if (match.scoreExact && !locked && score) {
    const sd = parseInt(score.dom), se = parseInt(score.ext);
    if (!isNaN(sd) && !isNaN(se)) {
      if (sd > se) { teamDomStyle = 'font-size:17px;font-weight:800;color:var(--green);line-height:1.2;'; cote1Color = 'var(--green)'; }
      else if (se > sd) { teamExtStyle = 'font-size:17px;font-weight:800;color:var(--green);line-height:1.2;'; cote2Color = 'var(--green)'; }
      else { vsStyle = 'color:var(--green);font-weight:800;font-size:18px;'; coteNColor = 'var(--green)'; }
    }
  }
  if (!match.scoreExact && !locked && prono) {
    if (prono === '1') cote1Color = 'var(--green)';
    else if (prono === 'N') coteNColor = 'var(--green)';
    else if (prono === '2') cote2Color = 'var(--green)';
  }

  if (locked && resultatsReels[row]) {
    const r = resultatsReels[row];
    if (match.scoreExact) {
      vsContent = `<span style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;color:var(--text)">${r.resultat}<span style="color:var(--text-muted);font-size:16px;margin:0 3px;">—</span>${r.scoreExtReel}</span>`;
    } else {
      lockBadge = `<span class="match-badge badge-lock">✅ ${r.resultat}</span>`;
      if (String(r.resultat) === '1') { teamDomStyle = 'font-size:17px;font-weight:800;color:#000;background:var(--green);padding:2px 8px;border-radius:6px;line-height:1.4;'; }
      else if (String(r.resultat) === '2') { teamExtStyle = 'font-size:17px;font-weight:800;color:#000;background:var(--green);padding:2px 8px;border-radius:6px;line-height:1.4;'; }
    }
  } else if (locked) {
    lockBadge = '<span class="match-badge badge-lock">🔒 Commencé</span>';
  }

  let pronoColor = 'var(--text-muted)';
  if (locked && match.scoreExact && score && resultatsReels[row]) {
    const r = resultatsReels[row];
    const exact = String(score.dom) === String(r.resultat) && String(score.ext) === String(r.scoreExtReel);
    pronoColor = exact ? 'var(--green)' : 'var(--red)';
  }

  const scoreHtml = match.scoreExact ? (locked ? `
    <div class="score-input-zone"><div style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:${pronoColor};padding:6px 20px;">${score ? score.dom : '—'} – ${score ? score.ext : '—'}</div></div>
  ` : `
    <div class="score-input-zone">
      <div class="score-field"><input class="score-input" type="number" min="0" max="20" id="score-${row}-dom" placeholder="0" value="${score ? score.dom : ''}" oninput="handleScore(${row})"></div>
      <div class="score-sep">–</div>
      <div class="score-field"><input class="score-input" type="number" min="0" max="20" id="score-${row}-ext" placeholder="0" value="${score ? score.ext : ''}" oninput="handleScore(${row})"></div>
    </div>`) : '';

  const cotesHtml = cote.c1 > 0 ? `<div style="font-size:16px;font-weight:700;margin-top:3px;color:${cote1Color};">${cote.c1.toFixed(2)}</div><div class="cote-label">Victoire</div>` : '';
  const coteNHtml = cote.cn > 0 ? `<div style="font-size:16px;font-weight:700;margin-top:3px;color:${coteNColor};">${cote.cn.toFixed(2)}</div><div class="cote-label">Nul</div>` : '';
  const cote2Html = cote.c2 > 0 ? `<div style="font-size:16px;font-weight:700;margin-top:3px;color:${cote2Color};">${cote.c2.toFixed(2)}</div><div class="cote-label">Victoire</div>` : '';

  const btn1Class = prono === '1' ? 'a-1' : '', btnNClass = prono === 'N' ? 'a-n' : '', btn2Class = prono === '2' ? 'a-2' : '';
  const badgeExact = match.scoreExact ? '<span class="match-badge badge-finale">⭐ Score exact</span>' : '';

  card.innerHTML = `
    <div class="match-header">
      <span class="match-meta">${match.heure} · ${(parseDateFR(match.date) || new Date()).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}</span>
      <div style="display:flex;gap:5px;align-items:center">${lockBadge}${badgeExact}</div>
    </div>
    <div class="match-teams">
      <div class="team"><div class="team-name" style="${teamDomStyle}">${match.dom}</div>${cotesHtml}</div>
      <div style="display:flex;flex-direction:column;align-items:center"><div class="vs" style="${vsStyle}">${vsContent}</div>${coteNHtml}</div>
      <div class="team"><div class="team-name" style="${teamExtStyle}">${match.ext}</div>${cote2Html}</div>
    </div>
    ${!locked && !match.scoreExact ? `<div class="prono-buttons">
      <button class="prono-btn ${btn1Class}" onclick="handleProno(${row},'1')">1</button>
      <button class="prono-btn ${btnNClass}" onclick="handleProno(${row},'N')">N</button>
      <button class="prono-btn ${btn2Class}" onclick="handleProno(${row},'2')">2</button>
    </div>` : ''}
    ${scoreHtml}
    <div class="saving-indicator" id="saving-${row}" style="display:none">💾 Sauvegarde...</div>
  `;
  return card;
}

async function handleProno(row, val) {
  pronos[row] = val;
  refreshCard(row);
  await sauvegarder(row, val, null, null);
}

async function handleScore(row) {
  const domEl = document.getElementById(`score-${row}-dom`);
  const extEl = document.getElementById(`score-${row}-ext`);
  if (!domEl || !extEl) return;
  const dom = domEl.value, ext = extEl.value;
  if (dom === '' || ext === '') return;
  const d = parseInt(dom), e = parseInt(ext);
  if (isNaN(d) || isNaN(e)) return;
  scores[row] = { dom: d, ext: e };
  refreshCard(row, d, e);
  if (window[`scoreTimer_${row}`]) clearTimeout(window[`scoreTimer_${row}`]);
  window[`scoreTimer_${row}`] = setTimeout(() => sauvegarder(row, null, d, e), 800);
}

function refreshCard(row, presetDom, presetExt) {
  const match = MATCHS_L1.find(m => m.row === row);
  if (!match) return;
  const oldCard = document.getElementById(`card-${row}`);
  if (!oldCard) return;
  const newCard = buildMatchCard(match);
  oldCard.replaceWith(newCard);
  if (presetDom !== undefined) {
    const d = document.getElementById(`score-${row}-dom`);
    const e = document.getElementById(`score-${row}-ext`);
    if (d) d.value = presetDom;
    if (e) e.value = presetExt;
  }
}

// File d'attente : une seule sauvegarde à la fois envoyée à Apps Script,
// pour éviter les requêtes simultanées qui se marchent dessus.
let saveQueue = Promise.resolve();

async function sauvegarder(row, prono, scoredom, scoreext) {
  if (savingRows.has(row)) return;
  savingRows.add(row);
  const savEl = document.getElementById(`saving-${row}`);
  if (savEl) savEl.style.display = 'block';

  saveQueue = saveQueue.then(() => envoyerSauvegarde(row, prono, scoredom, scoreext));
  await saveQueue;
}

async function envoyerSauvegarde(row, prono, scoredom, scoreext) {
  const MAX_TENTATIVES = 2;
  let succes = false;
  for (let tentative = 1; tentative <= MAX_TENTATIVES && !succes; tentative++) {
    try {
      const payload = { joueur: currentUser, pronos: [scoredom !== null ? { row, scoredom, scoreext } : { row, prono }] };
      const res = await fetch(APPS_SCRIPT_URL_L1, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain' } });
      const data = await res.json();
      if (data?.error === 'VERROUILLE') {
        showToast('🔒 Match déjà commencé petit coquin 😄');
        delete pronos[row]; delete scores[row];
        refreshCard(row);
        succes = true;
      } else if (data?.ok) {
        succes = true;
      } else if (tentative === MAX_TENTATIVES) {
        showToast('⚠️ Échec de la sauvegarde, réessaie');
      }
    } catch(e) {
      if (tentative === MAX_TENTATIVES) showToast('⚠️ Échec de la sauvegarde, réessaie');
    }
  }
  savingRows.delete(row);
  const savEl2 = document.getElementById(`saving-${row}`);
  if (savEl2) savEl2.style.display = 'none';
}

// ════ SAISON (Top3 + Relégation) ════
async function renderSaison() {
  document.getElementById('saison-header-name').textContent = currentUser;
  const container = document.getElementById('saison-container');
  const locked = pronosticsSaisonVerrouilles;
  if (locked) {
    document.getElementById('saison-deadline-info').textContent = '🔒 Verrouillé depuis le coup d\'envoi de la J1';
    document.getElementById('saison-deadline-info').style.color = 'var(--red)';
  }

  const optsHtml = EQUIPES_L1.map(e => `<option value="${e}">${e}</option>`).join('');

  container.innerHTML = `
    <div class="saison-card">
      <div class="saison-card-title">🥇 1er de Ligue 1</div>
      ${locked ? renderLockedOrSelect('premier') : `<select class="saison-select" id="sel-premier" onchange="savePronosticSaison('premier')"><option value="">— Choisir une équipe —</option>${optsHtml}</select>`}
      ${locked ? '<button class="voir-pronos-btn" onclick="togglePronosticsSaisonTous(\'premier\',this)">👥 Voir les pronos des autres</button><div class="pronos-tous" id="saison-tous-premier"></div>' : ''}
    </div>
    <div class="saison-card">
      <div class="saison-card-title">🥈 2ème de Ligue 1</div>
      ${locked ? renderLockedOrSelect('deuxieme') : `<select class="saison-select" id="sel-deuxieme" onchange="savePronosticSaison('deuxieme')"><option value="">— Choisir une équipe —</option>${optsHtml}</select>`}
      ${locked ? '<button class="voir-pronos-btn" onclick="togglePronosticsSaisonTous(\'deuxieme\',this)">👥 Voir les pronos des autres</button><div class="pronos-tous" id="saison-tous-deuxieme"></div>' : ''}
    </div>
    <div class="saison-card">
      <div class="saison-card-title">🥉 3ème de Ligue 1</div>
      ${locked ? renderLockedOrSelect('troisieme') : `<select class="saison-select" id="sel-troisieme" onchange="savePronosticSaison('troisieme')"><option value="">— Choisir une équipe —</option>${optsHtml}</select>`}
      ${locked ? '<button class="voir-pronos-btn" onclick="togglePronosticsSaisonTous(\'troisieme\',this)">👥 Voir les pronos des autres</button><div class="pronos-tous" id="saison-tous-troisieme"></div>' : ''}
    </div>
    <div class="saison-card descente">
      <div class="saison-card-title">🔴 18ème (descend)</div>
      ${locked ? renderLockedOrSelect('dixHuit') : `<select class="saison-select" id="sel-dixHuit" onchange="savePronosticSaison('dixHuit')"><option value="">— Choisir une équipe —</option>${optsHtml}</select>`}
      ${locked ? '<button class="voir-pronos-btn" onclick="togglePronosticsSaisonTous(\'dixHuit\',this)">👥 Voir les pronos des autres</button><div class="pronos-tous" id="saison-tous-dixHuit"></div>' : ''}
    </div>
    <div class="saison-card descente">
      <div class="saison-card-title">🔴 17ème (barrage)</div>
      ${locked ? renderLockedOrSelect('dixSept') : `<select class="saison-select" id="sel-dixSept" onchange="savePronosticSaison('dixSept')"><option value="">— Choisir une équipe —</option>${optsHtml}</select>`}
      ${locked ? '<button class="voir-pronos-btn" onclick="togglePronosticsSaisonTous(\'dixSept\',this)">👥 Voir les pronos des autres</button><div class="pronos-tous" id="saison-tous-dixSept"></div>' : ''}
    </div>
    <div class="saison-card descente">
      <div class="saison-card-title">🟠 16ème (barrage L2)</div>
      ${locked ? renderLockedOrSelect('seize') : `<select class="saison-select" id="sel-seize" onchange="savePronosticSaison('seize')"><option value="">— Choisir une équipe —</option>${optsHtml}</select>`}
      ${locked ? '<button class="voir-pronos-btn" onclick="togglePronosticsSaisonTous(\'seize\',this)">👥 Voir les pronos des autres</button><div class="pronos-tous" id="saison-tous-seize"></div>' : ''}
    </div>
  `;
  await chargerPronosticsSaisonExistants();
}

function renderLockedOrSelect(type) {
  const val = pronosticsSaisonData[type];
  return val ? `<div class="saison-locked-val">${val}</div>` : '<div class="saison-locked-val" style="color:var(--text-muted)">— Non renseigné —</div>';
}

async function chargerPronosticsSaisonExistants() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL_L1}?action=get_pronostics_saison&joueur=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    if (!data.ok) return;
    pronosticsSaisonData = data.pronostics;
    ['premier','deuxieme','troisieme','dixHuit','dixSept','seize'].forEach(type => {
      const val = data.pronostics[type];
      if (val) {
        const sel = document.getElementById(`sel-${type}`);
        if (sel) sel.value = val;
      }
    });
  } catch(e) {}
}

async function savePronosticSaison(type) {
  if (pronosticsSaisonVerrouilles) return;
  const sel = document.getElementById(`sel-${type}`);
  if (!sel || !sel.value) return;
  pronosticsSaisonData[type] = sel.value;
  try {
    await fetch(APPS_SCRIPT_URL_L1, { method: 'POST', body: JSON.stringify({ joueur: currentUser, action: 'save_pronostic_saison', type, valeur: sel.value }), headers: { 'Content-Type': 'text/plain' } });
    showToast('✅ Sauvegardé !');
  } catch(e) { showToast('⚠️ Erreur de sauvegarde'); }
}

async function togglePronosticsSaisonTous(type, btn) {
  const container = document.getElementById(`saison-tous-${type}`);
  if (!container) return;
  const isOpen = container.classList.contains('open');
  if (isOpen) { container.classList.remove('open'); btn.textContent = '👥 Voir les pronos des autres'; return; }
  container.classList.add('open'); btn.textContent = '👆 Masquer les pronos';
  if (container.dataset.loaded) return;
  container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px">Chargement...</div>';
  try {
    if (!pronosticsSaisonTousData) {
      const res = await fetch(`${APPS_SCRIPT_URL_L1}?action=pronostics_saison_tous`);
      const data = await res.json();
      if (!data.ok) { container.innerHTML = '<div style="text-align:center;color:var(--red);font-size:12px;padding:8px">Erreur.</div>'; return; }
      pronosticsSaisonTousData = data.pronostics;
    }
    const monChoix = pronosticsSaisonData[type] || '';
    const filtered = pronosticsSaisonTousData.filter(p => p[type]);
    if (!filtered.length) { container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px">Aucun prono disponible.</div>'; return; }
    container.innerHTML = filtered.map(p => {
      const isMoi = p.nom === currentUser;
      const cls = p[type] === monChoix ? 'bon' : 'neutre';
      return `<div class="prono-joueur-row" style="${isMoi ? 'background:var(--green-dim);border-radius:4px;padding:5px 6px;' : ''}"><div class="prono-joueur-nom">${p.nom}${isMoi ? ' 👈' : ''}</div><div class="prono-joueur-val ${cls}">${p[type]}</div></div>`;
    }).join('');
    container.dataset.loaded = '1';
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;color:var(--red);font-size:12px;padding:8px">Erreur de chargement.</div>';
  }
}

// ════ HISTORIQUE ════
async function chargerHistorique() {
  const container = document.getElementById('historique-container');
  container.innerHTML = '<div class="empty-state">Chargement...</div>';
  try {
    const res = await fetch(`${APPS_SCRIPT_URL_L1}?action=historique_l1&joueur=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    if (!data.ok || !data.journees?.length) {
      container.innerHTML = '<div class="empty-state">Aucun match terminé pour l\'instant.</div>';
      return;
    }
    const totalGeneral = data.journees.reduce((s, j) => s + j.totalPoints, 0);
    document.getElementById('histo-total').textContent = `Total : ${totalGeneral.toFixed(2)} pts`;
    document.getElementById('histo-name').textContent = currentUser;

    container.innerHTML = '';
    const journeesTriees = data.journees.slice().sort((a, b) => b.journee - a.journee);
    journeesTriees.forEach((j, idx) => {
      const isLatest = idx === 0;

      // Comptage bonus
      let bonCount = 0;
      j.matchs.forEach(m => {
        const isBon = m.scoreExact ? (m.prono && m.resultat && m.prono === m.resultat) : (m.prono && m.resultat && String(m.prono) === String(m.resultat));
        if (isBon) bonCount++;
      });
      const bonusScale = { 6: 2, 7: 5, 8: 10, 9: 20 };
      const bonus = bonusScale[bonCount] || 0;

      const header = document.createElement('div');
      header.className = 'histo-date-header';
      header.innerHTML = `<span>Journée ${j.journee}</span><div style="display:flex;align-items:center;gap:10px"><span style="color:var(--amber);font-family:'Bebas Neue',sans-serif;font-size:15px">${(j.totalPoints + bonus).toFixed(2)} pts</span><span id="arrow-j${j.journee}" style="color:var(--green);font-size:14px">${isLatest ? '▲' : '▼'}</span></div>`;
      container.appendChild(header);

      if (bonus > 0 || bonCount >= 6) {
        const badge = document.createElement('div');
        badge.className = 'histo-bonus-badge';
        badge.id = `badge-j${j.journee}`;
        badge.style.display = isLatest ? 'flex' : 'none';
        badge.innerHTML = `<span>🎯 ${bonCount}/9 bons pronos</span><span style="color:var(--gold);font-weight:700">+${bonus} pts bonus</span>`;
        container.appendChild(badge);
      }

      const card = document.createElement('div');
      card.className = 'histo-match-card';
      card.id = `card-j${j.journee}`;
      card.style.display = isLatest ? 'block' : 'none';
      header.onclick = () => {
        const arrow = document.getElementById(`arrow-j${j.journee}`);
        const c = document.getElementById(`card-j${j.journee}`);
        const b = document.getElementById(`badge-j${j.journee}`);
        const show = c.style.display === 'none';
        c.style.display = show ? 'block' : 'none';
        if (b) b.style.display = show ? 'flex' : 'none';
        arrow.textContent = show ? '▲' : '▼';
      };

      card.innerHTML = j.matchs.map(m => {
        let cls = 'neutre';
        if (m.resultat) {
          if (m.scoreExact) {
            cls = (m.prono && m.prono === m.resultat) ? 'bon' : 'mauvais';
          } else {
            cls = String(m.prono) === String(m.resultat) ? 'bon' : 'mauvais';
          }
        }
        const pronoLabel = m.prono || '—';
        return `<div>
          <div class="histo-match-row">
            <div class="histo-teams">${m.dom} / ${m.ext}</div>
            <div class="histo-res">${m.resultat || '—'}</div>
            <div class="histo-prono ${cls}">${pronoLabel}</div>
            <div class="histo-pts">${m.points > 0 ? '+' + m.points.toFixed(2) : '0'}</div>
          </div>
          <button class="voir-pronos-btn" onclick="togglePronosTousL1(${m.row}, this)">👥 Voir les pronos des autres</button>
          <div class="pronos-tous" id="pronos-l1-${m.row}"><div style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px">Chargement...</div></div>
        </div>`;
      }).join('');
      container.appendChild(card);
    });
  } catch(e) {
    container.innerHTML = '<div class="empty-state" style="color:var(--red)">Erreur de chargement.</div>';
  }
}

async function togglePronosTousL1(row, btn) {
  const container = document.getElementById(`pronos-l1-${row}`);
  if (!container) return;
  const isOpen = container.classList.contains('open');
  if (isOpen) { container.classList.remove('open'); btn.textContent = '👥 Voir les pronos des autres'; return; }
  container.classList.add('open'); btn.textContent = '👆 Masquer les pronos';
  if (container.dataset.loaded) return;
  try {
    const res = await fetch(`${APPS_SCRIPT_URL_L1}?action=pronos_match_l1&row=${row}`);
    const data = await res.json();
    if (!data.ok || !data.pronos?.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px">Aucun prono disponible.</div>';
      return;
    }
    const resultatReel = resultatsReels[row]?.resultat || '';
    const scoreExtReel = resultatsReels[row]?.scoreExtReel || '';
    const isScoreExact = data.pronos.some(p => p.prono && p.prono.includes('-'));
    const resultatCombine = isScoreExact ? `${resultatReel}-${scoreExtReel}` : resultatReel;
    container.innerHTML = data.pronos.map(p => {
      const bon = resultatCombine && p.prono === resultatCombine;
      const isMoi = p.nom === currentUser;
      const cls = bon ? 'bon' : (resultatCombine ? 'mauvais' : 'neutre');
      return `<div class="prono-joueur-row" style="${isMoi ? 'background:var(--green-dim);border-radius:4px;padding:5px 6px;' : ''}"><div class="prono-joueur-nom">${p.nom}${isMoi ? ' 👈' : ''}</div><div class="prono-joueur-val ${cls}">${p.prono}</div></div>`;
    }).join('');
    container.dataset.loaded = '1';
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;color:var(--red);font-size:12px;padding:8px">Erreur de chargement.</div>';
  }
}

// ════ CLASSEMENT ════
async function chargerClassement() {
  const container = document.getElementById('classement-container');
  container.innerHTML = '<div class="empty-state">Chargement...</div>';
  try {
    const res = await fetch(`${APPS_SCRIPT_URL_L1}?action=classement_l1`);
    const data = await res.json();
    if (!data.ok || !data.classement?.length) {
      container.innerHTML = '<div class="empty-state">Classement non disponible.</div>';
      return;
    }
    document.getElementById('cls-updated').textContent = `Mis à jour : ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;
    container.innerHTML = data.classement.map(p => {
      const isMoi = p.nom === currentUser;
      const emoji = p.rang === 1 ? '🥇' : p.rang === 2 ? '🥈' : p.rang === 3 ? '🥉' : '';
      const rangClass = p.rang <= 3 ? `rang-${p.rang}` : 'rang-other';
      return `<div class="cls-row ${isMoi ? 'moi' : ''}">
        <div class="rang ${rangClass}">${emoji || p.rang}</div>
        <div class="cls-nom">${p.nom}${isMoi ? ' 👈' : ''}</div>
        <div class="cls-pts">${p.points.toFixed(2)}</div>
      </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = '<div class="empty-state" style="color:var(--red)">Erreur de chargement.</div>';
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

init();
