// Leonida Trophy Guide — tracker logic. Loads app/data/trophies.json, renders the
// checklist, and keeps progress in localStorage. No network beyond this app's files.
const STORAGE_KEY = 'leonida-trophy-guide-v1';
const DATA_URL = 'data/trophies.json';

const KIND_LABELS = {
  story: 'Story', side: 'Side missions', activity: 'Activities',
  collectible: 'Collectibles', crime: 'Crime', misc: 'Odd ones & money',
  platinum: 'Platinum path',
};

const state = {
  trophies: [],
  earned: new Set(),
  spoilerSafe: true,
  hideEarned: false,
  kind: 'all',
  grade: 'all',
  query: '',
  sort: 'list',
};

const $ = (id) => document.getElementById(id);
const listEl = $('trophyList');

function loadSavedProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    state.earned = new Set(Array.isArray(raw.earned) ? raw.earned : []);
    if (typeof raw.spoilerSafe === 'boolean') state.spoilerSafe = raw.spoilerSafe;
    if (typeof raw.hideEarned === 'boolean') state.hideEarned = raw.hideEarned;
    if (typeof raw.kind === 'string') state.kind = raw.kind;
    if (typeof raw.grade === 'string') state.grade = raw.grade;
    if (typeof raw.query === 'string') state.query = raw.query;
    if (typeof raw.sort === 'string') state.sort = raw.sort;
  } catch {
    state.earned = new Set();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    earned: [...state.earned],
    spoilerSafe: state.spoilerSafe,
    hideEarned: state.hideEarned,
    kind: state.kind,
    grade: state.grade,
    query: state.query,
    sort: state.sort,
  }));
}

async function loadTrophies() {
  const response = await fetch(DATA_URL);
  const doc = await response.json();
  state.trophies = doc.trophies;
}

function spoilerMasked(trophy) {
  return state.spoilerSafe && trophy.hidden && !state.earned.has(trophy.name);
}

function trophyMatchesFilters(trophy) {
  if (state.kind === 'missable' && !trophy.missable) return false;
  if (state.kind === 'online') return false;
  if (state.kind !== 'all' && state.kind !== 'missable' && trophy.kind !== state.kind) return false;
  if (state.grade !== 'all' && trophy.grade !== state.grade) return false;
  if (state.hideEarned && state.earned.has(trophy.name)) return false;
  if (state.query) {
    const hay = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
    if (!hay.includes(state.query.toLowerCase())) return false;
  }
  return true;
}

function sortedTrophies(trophies) {
  const copy = [...trophies];
  if (state.sort === 'grade') {
    const rank = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
    copy.sort((a, b) => rank[a.grade] - rank[b.grade] || a.id - b.id);
  } else if (state.sort === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.sort === 'remaining') {
    copy.sort((a, b) => Number(state.earned.has(a.name)) - Number(state.earned.has(b.name)) || a.id - b.id);
  } else {
    copy.sort((a, b) => a.id - b.id);
  }
  return copy;
}

function gradeChip(grade, earned, total) {
  return `<span class="grade-chip">${grade}: ${earned}/${total}</span>`;
}

function renderProgress() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  $('earnedCount').textContent = String(earned);
  $('progressFill').style.width = total ? `${Math.round((earned / total) * 100)}%` : '0%';
  $('progressNote').textContent = earned === 0
    ? 'Tick a trophy off and it stays ticked.'
    : earned === total
      ? 'Platinum! Vice Got a Price — you are a Leonida Legend.'
      : `${total - earned} to go — the next one is the one in front of you.`;
  const counts = {};
  for (const grade of ['platinum', 'gold', 'silver', 'bronze']) {
    const inGrade = state.trophies.filter((t) => t.grade === grade);
    counts[grade] = [inGrade.filter((t) => state.earned.has(t.name)).length, inGrade.length];
  }
  $('gradeChips').innerHTML = ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => gradeChip(g, counts[g][0], counts[g][1])).join('');
}

function renderKindStats() {
  const kinds = ['story', 'side', 'activity', 'collectible', 'crime', 'misc', 'platinum'];
  $('kindStats').innerHTML = kinds.map((kind) => {
    const inKind = state.trophies.filter((t) => t.kind === kind);
    const got = inKind.filter((t) => state.earned.has(t.name)).length;
    return `<span class="kind-stat">${KIND_LABELS[kind]}: <b>${got}/${inKind.length}</b></span>`;
  }).join('') + `<span class="kind-stat">Missable: <b>${state.trophies.filter((t) => t.missable && state.earned.has(t.name)).length}/${state.trophies.filter((t) => t.missable).length}</b></span>`;
}

function buildSourceLinks(trophy) {
  return (trophy.sources ?? []).map((s) => {
    const a = document.createElement('a');
    a.href = s.url;
    a.textContent = s.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  });
}

function renderTrophyCard(trophy) {
  const card = document.createElement('article');
  card.className = 'trophy-card';
  card.dataset.trophyId = String(trophy.id);
  const earned = state.earned.has(trophy.name);
  if (earned) card.classList.add('earned');
  if (trophy.missable) card.classList.add('missable-flag');

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.className = 'trophy-check';
  box.checked = earned;
  box.setAttribute('aria-label', `Mark ${trophy.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) state.earned.add(trophy.name);
    else state.earned.delete(trophy.name);
    saveProgress();
    renderAll();
  });
  card.append(box);

  const head = document.createElement('div');
  head.className = 'trophy-head';
  const masked = spoilerMasked(trophy);
  const name = document.createElement('span');
  name.className = 'trophy-name';
  name.textContent = masked ? 'Hidden trophy — earn it to reveal' : trophy.name;
  head.append(name);
  const badge = document.createElement('span');
  badge.className = `grade-badge grade-${trophy.grade}`;
  badge.textContent = trophy.grade;
  head.append(badge);
  const kindTag = document.createElement('span');
  kindTag.className = 'tag';
  kindTag.textContent = KIND_LABELS[trophy.kind] ?? trophy.kind;
  head.append(kindTag);
  if (trophy.hidden) {
    const hiddenTag = document.createElement('span');
    hiddenTag.className = 'tag hidden-tag';
    hiddenTag.textContent = 'hidden on PS5';
    head.append(hiddenTag);
  }
  if (trophy.missable) {
    const missTag = document.createElement('span');
    missTag.className = 'tag missable-tag';
    missTag.textContent = 'Possibly missable';
    head.append(missTag);
  }
  if (trophy.unconfirmed) {
    const uncTag = document.createElement('span');
    uncTag.className = 'tag unconfirmed-tag';
    uncTag.textContent = 'Method unconfirmed';
    head.append(uncTag);
  }
  if (earned) {
    const done = document.createElement('span');
    done.className = 'earned-label';
    done.textContent = '✓ Earned';
    head.append(done);
  }
  card.append(head);

  if (masked) {
    const hidden = document.createElement('p');
    hidden.className = 'spoiler-hidden';
    hidden.textContent = 'This trophy is hidden on PlayStation until you earn it. Its name, description and guide stay hidden here too — turn the spoiler setting off above to peek, or tick it off once you have earned it.';
    card.append(hidden);
    return card;
  }

  const desc = document.createElement('p');
  desc.className = 'trophy-desc';
  desc.textContent = `“${trophy.description}”`;
  card.append(desc);

  if (trophy.target) {
    const count = document.createElement('p');
    count.className = 'trophy-count';
    count.textContent = trophy.targetTotal && trophy.targetTotal !== trophy.target
      ? `Target: ${trophy.target} of ${trophy.targetTotal}`
      : `Target: ${trophy.target}`;
    card.append(count);
  }

  const guide = document.createElement('p');
  guide.className = 'trophy-guide';
  guide.textContent = trophy.guide;
  card.append(guide);

  const sources = document.createElement('p');
  sources.className = 'trophy-sources';
  sources.append(document.createTextNode('Sources: '));
  for (const link of buildSourceLinks(trophy)) sources.append(link);
  card.append(sources);
  return card;
}

function renderTrophyList() {
  const visible = sortedTrophies(state.trophies.filter(trophyMatchesFilters));
  listEl.replaceChildren(...visible.map(renderTrophyCard));
  $('emptyState').hidden = visible.length > 0;
  $('resultCount').textContent = state.kind === 'online'
    ? 'Showing 0 of 55 — there are no online trophies. All 55 are single-player and offline.'
    : `Showing ${visible.length} of ${state.trophies.length} trophies${state.earned.size ? ` · ${state.earned.size} earned` : ''}.`;
  const kindNote = $('kindNote');
  if (state.kind === 'online') {
    kindNote.hidden = false;
    kindNote.textContent = 'No online trophies: every trophy on this list is earned in single-player, offline. Nothing here needs PlayStation Plus or a multiplayer mode.';
  } else if (state.kind === 'missable') {
    kindNote.hidden = false;
    kindNote.textContent = 'Only one trophy is possibly missable: Positive Mental Attitude, because of the Chapter 1 balcony meditation. Everything else can be earned after the story in free roam.';
  } else {
    kindNote.hidden = true;
  }
}

function renderAll() {
  renderProgress();
  renderKindStats();
  renderTrophyList();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({ game: 'Grand Theft Auto VI', earned: [...state.earned] }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importProgress(file) {
  const note = $('importNote');
  try {
    const data = JSON.parse(await file.text());
    const names = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(names)) throw new Error('no earned list');
    const known = new Set(state.trophies.map((t) => t.name));
    const kept = names.filter((n) => known.has(n));
    state.earned = new Set(kept);
    saveProgress();
    renderAll();
    note.textContent = `Imported ${kept.length} earned trophies${names.length - kept.length ? ` (${names.length - kept.length} unknown names skipped)` : ''}.`;
  } catch {
    note.textContent = 'That file could not be read as trophy progress. Export a fresh copy and try again.';
  }
}

function resetProgress() {
  if (!window.confirm('Clear all earned trophies on this device?')) return;
  state.earned = new Set();
  saveProgress();
  renderAll();
}

function bindControls() {
  const search = $('search');
  search.value = state.query;
  search.addEventListener('input', () => { state.query = search.value; saveProgress(); renderTrophyList(); });

  const kind = $('kindFilter');
  kind.value = state.kind;
  kind.addEventListener('change', () => { state.kind = kind.value; saveProgress(); renderTrophyList(); });

  const grade = $('gradeFilter');
  grade.value = state.grade;
  grade.addEventListener('change', () => { state.grade = grade.value; saveProgress(); renderTrophyList(); });

  const sort = $('sortOrder');
  sort.value = state.sort;
  sort.addEventListener('change', () => { state.sort = sort.value; saveProgress(); renderTrophyList(); });

  const spoiler = $('spoilerToggle');
  spoiler.checked = state.spoilerSafe;
  spoiler.addEventListener('change', () => { state.spoilerSafe = spoiler.checked; saveProgress(); renderTrophyList(); });

  const hide = $('hideEarned');
  hide.checked = state.hideEarned;
  hide.addEventListener('change', () => { state.hideEarned = hide.checked; saveProgress(); renderTrophyList(); });

  $('exportBtn').addEventListener('click', exportProgress);
  $('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importProgress(file);
    e.target.value = '';
  });
  $('resetBtn').addEventListener('click', resetProgress);
}

loadSavedProgress();
await loadTrophies();
bindControls();
renderAll();
