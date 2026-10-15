const state = { period: 'daily', current: null, history: null, repositories: [] };
const $ = (selector) => document.querySelector(selector);
const titleByPeriod = { daily: ['DAILY PULSE', '오늘의 리포지토리'], weekly: ['WEEKLY SIGNAL', '이번 주의 리포지토리'], monthly: ['MONTHLY ARCHIVE', '이번 달의 리포지토리'] };
const number = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function humanDate(value) {
  if (!value) return 'updated —';
  return `updated ${new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))}`;
}
function escapeHTML(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }

async function loadJSON(url) { const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error(url); return response.json(); }
async function getSelectedRepos() {
  const selected = $('#history-select').value;
  if (selected === 'current') return state.current[state.period] || [];
  const data = await loadJSON(`data/history/${state.period}/${selected}.json`);
  return data.repositories || [];
}
function populateFilters(repositories) {
  const language = $('#language-filter'); const selected = language.value;
  const languages = [...new Set(repositories.map((repo) => repo.language).filter(Boolean))].sort();
  language.innerHTML = '<option value="">All languages</option>' + languages.map((name) => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('');
  language.value = languages.includes(selected) ? selected : '';
}
function updateHistorySelect() {
  const select = $('#history-select'); const selected = select.value;
  const keys = state.history?.[state.period] || [];
  select.innerHTML = '<option value="current">최신 수집본</option>' + keys.map((key) => `<option value="${key}">${key}</option>`).join('');
  select.value = keys.includes(selected) ? selected : 'current';
}
function filteredRepositories() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const language = $('#language-filter').value;
  const sort = $('#sort-by').value;
  return state.repositories.filter((repo) => {
    const haystack = [repo.name, repo.description_en, repo.description_ko, repo.language, repo.owner].join(' ').toLocaleLowerCase();
    return (!query || haystack.includes(query)) && (!language || repo.language === language);
  }).sort((a, b) => {
    if (sort === 'stars') return (b.stars || 0) - (a.stars || 0);
    if (sort === 'forks') return (b.forks || 0) - (a.forks || 0);
    if (sort === 'updated') return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    return (b.trending_stars || 0) - (a.trending_stars || 0);
  });
}
function render() {
  const repos = filteredRepositories(); const grid = $('#repo-grid'); const template = $('#repo-card-template');
  grid.replaceChildren(); $('#empty-state').hidden = repos.length !== 0;
  $('#result-summary').textContent = `${repos.length} / ${state.repositories.length} repositories`;
  repos.forEach((repo, index) => {
    const node = template.content.cloneNode(true); const card = node.querySelector('.repo-card');
    const link = node.querySelector('.thumbnail-link'); const image = node.querySelector('.thumbnail'); const fallback = node.querySelector('.thumbnail-fallback');
    link.href = repo.html_url; node.querySelector('.repo-name').href = repo.html_url;
    node.querySelector('.repo-name').textContent = repo.name; node.querySelector('.owner').textContent = `@${repo.owner || repo.name.split('/')[0]}`;
    node.querySelector('.language').textContent = repo.language || 'Unspecified'; node.querySelector('.rank').textContent = `#${String(index + 1).padStart(2, '0')}`;
    image.src = repo.thumbnail || ''; image.alt = `${repo.name} preview`; image.onerror = () => { image.style.display = 'none'; fallback.style.display = 'grid'; };
    const avatar = fallback.querySelector('img'); avatar.src = repo.avatar_url || ''; avatar.alt = `${repo.owner || repo.name} avatar`;
    const desc = node.querySelector('.description'); const toggle = node.querySelector('.translation-toggle'); let korean = false;
    const english = repo.description_en || 'No description provided.'; const ko = repo.description_ko || '한국어 번역을 준비하지 못했습니다.';
    desc.textContent = english; toggle.addEventListener('click', () => { korean = !korean; desc.textContent = korean ? ko : english; toggle.textContent = korean ? 'English 보기' : '한국어 보기'; });
    node.querySelector('.stars').textContent = number.format(repo.stars || 0); node.querySelector('.forks').textContent = number.format(repo.forks || 0);
    node.querySelector('.trending').textContent = `+${number.format(repo.trending_stars || 0)}`; node.querySelector('.repo-id').textContent = `ID ${repo.repo_id || '—'}`;
    node.querySelector('.updated').textContent = humanDate(repo.updated_at); node.querySelector('.updated').dateTime = repo.updated_at || '';
    grid.append(node);
  });
}
async function refreshRepositories() {
  state.repositories = await getSelectedRepos(); populateFilters(state.repositories); const [kicker, title] = titleByPeriod[state.period];
  $('#period-kicker').textContent = kicker; $('#section-title').textContent = title; render();
}
async function choosePeriod(period) {
  state.period = period; document.querySelectorAll('.period-tab').forEach((button) => { const active = button.dataset.period === period; button.classList.toggle('active', active); button.setAttribute('aria-selected', active); });
  updateHistorySelect(); await refreshRepositories();
}
function setupEvents() {
  document.querySelectorAll('.period-tab').forEach((button) => button.addEventListener('click', () => choosePeriod(button.dataset.period)));
  ['search', 'language-filter', 'sort-by'].forEach((id) => $("#" + id).addEventListener(id === 'search' ? 'input' : 'change', render));
  $('#history-select').addEventListener('change', refreshRepositories);
  $('#theme-toggle').addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; localStorage.setItem('trending-atlas-theme', next); });
}
async function init() {
  try { [state.current, state.history] = await Promise.all([loadJSON('data/current.json'), loadJSON('data/history/index.json')]); }
  catch { state.current = { generated_at: null, daily: [], weekly: [], monthly: [] }; state.history = { daily: [], weekly: [], monthly: [] }; }
  $('#generated-at').textContent = formatDate(state.current.generated_at); $('#repo-count').textContent = `${(state.current.daily || []).length} repositories in daily feed`;
  setupEvents(); updateHistorySelect(); await refreshRepositories();
}
init();
