// Client-side fetch + cache for the central fact store
// (assets/data/facts.jsonl). Fetches the whole file once, caches it in
// localStorage, and serves lookups by fact ID out of that cache. Re-fetches
// once per calendar day, since the daily generation job appends to the
// store every morning.
//
// See docs/fact-store-client.md for the caching contract and
// docs/fact-store-schema.md for the file format this parses.

const SITE_ROOT = new URL("../..", import.meta.url);
const FACT_STORE_URL = new URL("assets/data/facts.jsonl", SITE_ROOT).href;
const CACHE_KEY = "daily-trivia:fact-store";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    // localStorage unavailable (private browsing, quota) — in-memory only.
  }
}

function parseJsonl(text) {
  const facts = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fact = JSON.parse(trimmed);
    facts[fact.id] = fact;
  }
  return facts;
}

async function fetchFactStore() {
  const response = await fetch(FACT_STORE_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch fact store: ${response.status}`);
  }
  return { fetchedDate: today(), facts: parseJsonl(await response.text()) };
}

let memoryCache = null;
let loadPromise = null;

// Returns the cached store, fetching (or re-fetching, if stale) as needed.
// Safe to call repeatedly — concurrent calls share one in-flight fetch.
export async function loadFactStore({ forceRefresh = false } = {}) {
  if (!forceRefresh && memoryCache && memoryCache.fetchedDate === today()) {
    return memoryCache;
  }

  if (!forceRefresh) {
    const cached = readCache();
    if (cached && cached.fetchedDate === today()) {
      memoryCache = cached;
      return memoryCache;
    }
  }

  if (!loadPromise) {
    loadPromise = fetchFactStore()
      .then((store) => {
        memoryCache = store;
        writeCache(store);
        return store;
      })
      .finally(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

// Derives the deep link to a fact's full explanation on its daily page,
// per the convention in docs/fact-store-schema.md#linking-to-the-explanation.
export function explanationUrl(id) {
  const date = id.slice(0, 10);
  return new URL(`daily/${date}/#${id}`, SITE_ROOT).href;
}

// Looks up a single fact by ID. Returns null if the ID isn't in the store.
export async function getFact(id) {
  const store = await loadFactStore();
  const fact = store.facts[id];
  if (!fact) return null;
  return { ...fact, explanationUrl: explanationUrl(id) };
}

// Returns every fact in the store, for callers (like the quiz) that
// need to draw a random sample rather than look up specific IDs.
//
// Pass { forceRefresh: true } for callers where a same-day-stale cache
// would silently drop facts a user just acted on (e.g. the quiz, right
// after they've collected a fact published earlier that day) — see
// docs/fact-store-client.md#caching-and-invalidation.
export async function getAllFacts({ forceRefresh = false } = {}) {
  const store = await loadFactStore({ forceRefresh });
  return Object.values(store.facts).map((fact) => ({
    ...fact,
    explanationUrl: explanationUrl(fact.id),
  }));
}
