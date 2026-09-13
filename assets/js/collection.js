// Wires every "+ Add to my collection" button (see _includes/fact-card.html)
// to write that fact's ID into the signed-in user's Firestore doc. See
// docs/firestore-schema.md for the document shape this writes to.
//
// The "Added" state is also restored on page load so it survives across
// visits, without re-fetching the whole Firestore doc every time: the set
// of collected IDs is cached in localStorage for the current calendar day
// (UTC, matching the `at` timestamps already stored server-side) and kept
// current as facts are added during that day. The cache is refetched once
// a new day starts.
import { auth } from "./auth.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  isActive,
  todayKey,
  readCache,
  writeCache,
  dispatchCollectionCount,
  loadUserDoc,
  addOrRestore,
} from "./collected-facts.js";

const provider = new GoogleAuthProvider();
const RESET_DELAY_MS = 2500;

let currentUser = null;

function markButtonsAsAdded(ids) {
  document.querySelectorAll(".add-to-collection").forEach(function (button) {
    if (!ids.has(button.dataset.factId)) return;
    button.disabled = true;
    button.classList.remove("is-saving", "is-error");
    button.classList.add("is-added");
    button.textContent = "Added ✓";
  });
}

async function syncCollectedState(user) {
  const cache = readCache();
  if (cache && cache.uid === user.uid && cache.date === todayKey()) {
    markButtonsAsAdded(new Set(cache.ids));
    dispatchCollectionCount(cache.ids.length);
    return;
  }

  try {
    const userDoc = await loadUserDoc(user);
    const ids = new Set((userDoc.collected || []).filter(isActive).map((entry) => entry.id));
    writeCache(user.uid, ids);
    markButtonsAsAdded(ids);
    dispatchCollectionCount(ids.size);
  } catch (error) {
    console.error("Could not load collected facts", error);
  }
}

auth.onAuthStateChanged(function (user) {
  currentUser = user;
  if (user) syncCollectedState(user);
});

async function addToCollection(button) {
  const factId = button.dataset.factId;
  const originalText = button.textContent;

  button.disabled = true;
  button.classList.remove("is-error");
  button.classList.add("is-saving");
  button.textContent = "Adding…";

  try {
    let user = currentUser;
    if (!user) {
      const result = await signInWithPopup(auth, provider);
      user = result.user;
    }

    await addOrRestore(user, factId);

    button.classList.remove("is-saving");
    button.classList.add("is-added");
    button.textContent = "Added ✓";

    const cache = readCache();
    if (cache && cache.uid === user.uid && cache.date === todayKey()) {
      const ids = new Set(cache.ids);
      ids.add(factId);
      writeCache(user.uid, ids);
      dispatchCollectionCount(ids.size);
    } else {
      // Cache is missing or stale (new day) — a locally-built set here would
      // only contain this one fact and silently drop everything collected
      // earlier, so re-sync against Firestore for the true full list.
      await syncCollectedState(user);
    }
  } catch (error) {
    console.error("Could not add fact to collection", error);
    button.classList.remove("is-saving");
    button.classList.add("is-error");
    button.textContent = "Couldn't add — try again";
    button.disabled = false;
    setTimeout(function () {
      button.classList.remove("is-error");
      button.textContent = originalText;
    }, RESET_DELAY_MS);
  }
}

document.addEventListener("click", function (event) {
  const button = event.target.closest(".add-to-collection");
  if (!button) return;
  addToCollection(button);
});
