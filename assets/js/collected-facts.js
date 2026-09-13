// Shared read/write helpers for the signed-in user's `collected` list (see
// docs/firestore-schema.md). Used by collection.js (the "+ Add to my
// collection" button on daily pages) and manage-facts.js (the "My Facts"
// page) so both agree on one shape and one read-modify-write path instead
// of drifting into separate logic.
//
// Each `collected` entry is `{ id, at, removed }`. `removed` is a soft
// delete: forgetting a fact on the manage page sets it to true rather than
// deleting the entry, so the same toggle can flip it back to false to
// restore the fact without losing its original `at`.
import { db } from "./auth.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const CACHE_KEY = "five-things:collected";

export function isActive(entry) {
  return !entry.removed;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch (error) {
    return null;
  }
}

// Cache only ever holds active (non-removed) IDs — it exists to answer
// "does this fact already show as added" on daily pages, which is exactly
// the active set.
export function writeCache(uid, activeIds) {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ uid, date: todayKey(), ids: Array.from(activeIds) })
  );
}

export function dispatchCollectionCount(count) {
  window.dispatchEvent(
    new CustomEvent("five-things:collection-count", { detail: { count } })
  );
}

export async function loadUserDoc(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists()
    ? snap.data()
    : { collected: [], recentlyMissed: [], recentlyAdded: [] };
}

// Adds a fact if it isn't in `collected` yet, or clears `removed` if it's
// there but was forgotten — either way ending with one active entry for
// this ID, never a duplicate. Returns the resulting `collected` array.
export async function addOrRestore(user, factId) {
  const userDoc = await loadUserDoc(user);
  const collected = userDoc.collected || [];
  const index = collected.findIndex((entry) => entry.id === factId);
  const next = collected.slice();
  if (index === -1) {
    next.push({ id: factId, at: new Date().toISOString(), removed: false });
  } else {
    next[index] = { ...next[index], removed: false };
  }
  await setDoc(doc(db, "users", user.uid), { collected: next }, { merge: true });
  return next;
}

// Toggles `removed` on an existing entry without touching its `at` — the
// manage page's Forget / Add back button. Returns the resulting array.
export async function setRemoved(user, factId, removed) {
  const userDoc = await loadUserDoc(user);
  const collected = userDoc.collected || [];
  const index = collected.findIndex((entry) => entry.id === factId);
  if (index === -1) return collected;
  const next = collected.slice();
  next[index] = { ...next[index], removed };
  await setDoc(doc(db, "users", user.uid), { collected: next }, { merge: true });
  return next;
}
