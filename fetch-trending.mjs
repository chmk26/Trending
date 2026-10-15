import * as cheerio from 'cheerio';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const periods = ['daily', 'weekly', 'monthly'];
const root = process.cwd();
const dataDir = path.join(root, 'data');
const headers = {
  'User-Agent': 'github-trending-dashboard/1.0',
  Accept: 'application/vnd.github+json'
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const number = (value = '') => Number(value.replace(/[^0-9]/g, '')) || 0;
const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const timedFetch = (url, options = {}, timeout = 15000) => fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });

async function jsonOr(fallback, file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

function extractTrendingRepos(html) {
  const $ = cheerio.load(html);
  return $('article.Box-row').map((_, article) => {
    const a = $(article).find('h2 a').first();
    const name = clean(a.attr('href') || '').replace(/^\//, '');
    const description = clean($(article).find('p').first().text());
    const language = clean($(article).find('[itemprop="programmingLanguage"]').first().text());
    const footer = clean($(article).find('.f6').text());
    const trendMatch = footer.match(/([\d,]+)\s+stars?\s+(today|this week|this month)/i);
    return { name, description, language, trending_stars: number(trendMatch?.[1]) };
  }).get().filter((repo) => repo.name.includes('/'));
}

async function getTranslation(text, cache) {
  if (!text) return '';
  if (cache[text]) return cache[text];
  try {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', 'en|ko');
    const response = await timedFetch(url, { headers: { 'User-Agent': headers['User-Agent'] } }, 6000);
    const body = await response.json();
    const translated = clean(body?.responseData?.translatedText || '');
    // The public service may echo English when it is rate-limited.
    cache[text] = translated && translated !== text ? translated : '번역을 준비하지 못했습니다.';
  } catch {
    cache[text] = '번역을 준비하지 못했습니다.';
  }
  return cache[text];
}

async function enrich(repo, cache) {
  const response = await timedFetch(`https://api.github.com/repos/${repo.name}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${repo.name}`);
  const api = await response.json();
  const description = api.description || repo.description || '';
  return {
    name: api.full_name,
    repo_id: api.id,
    description_en: description,
    description_ko: await getTranslation(description, cache),
    stars: api.stargazers_count,
    forks: api.forks_count,
    language: api.language || repo.language || 'Unspecified',
    trending_stars: repo.trending_stars,
    avatar_url: api.owner?.avatar_url || '',
    thumbnail: `https://opengraph.githubassets.com/1/${api.full_name}`,
    owner: api.owner?.login || '',
    updated_at: api.updated_at,
    html_url: api.html_url,
    homepage: api.homepage || ''
  };
}

function keys(now) {
  const isoYear = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 4 - (now.getUTCDay() || 7)));
  const yearStart = new Date(Date.UTC(isoYear.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((isoYear - yearStart) / 86400000) + 1) / 7);
  return {
    daily: now.toISOString().slice(0, 10),
    weekly: `${isoYear.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
    monthly: now.toISOString().slice(0, 7)
  };
}

async function main() {
  const now = new Date();
  const cacheFile = path.join(dataDir, 'translations.json');
  const indexFile = path.join(dataDir, 'history', 'index.json');
  const cache = await jsonOr({}, cacheFile);
  const index = await jsonOr({ daily: [], weekly: [], monthly: [] }, indexFile);
  const current = { generated_at: now.toISOString(), daily: [], weekly: [], monthly: [] };
  const snapshotKeys = keys(now);

  for (const period of periods) {
    const page = await timedFetch(`https://github.com/trending?since=${period}`, { headers: { 'User-Agent': headers['User-Agent'] } });
    if (!page.ok) throw new Error(`Trending page ${page.status} (${period})`);
    const raw = extractTrendingRepos(await page.text()).slice(0, 25);
    current[period] = await Promise.all(raw.map((repo) => enrich(repo, cache)));

    const key = snapshotKeys[period];
    const dir = path.join(dataDir, 'history', period);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${key}.json`), JSON.stringify({ period, key, generated_at: current.generated_at, repositories: current[period] }, null, 2) + '\n');
    index[period] = [...new Set([key, ...(index[period] || [])])].sort().reverse();
  }

  await writeFile(path.join(dataDir, 'current.json'), JSON.stringify(current, null, 2) + '\n');
  await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n');
  await mkdir(path.dirname(indexFile), { recursive: true });
  await writeFile(indexFile, JSON.stringify(index, null, 2) + '\n');
  console.log(`Saved ${periods.map((p) => `${p}:${current[p].length}`).join(', ')}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
