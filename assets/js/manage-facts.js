// "My Facts" page: lists every fact the signed-in user has collected,
// grouped by topic, with a Forget / Add back toggle per fact. Forgetting
// never deletes the Firestore entry — it flips `removed: true` (see
// docs/firestore-schema.md and assets/js/collected-facts.js) so the same
// button can restore it later without losing when it was originally added.
import { auth } from "./auth.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getAllFacts } from "./fact-store.js";
import {
  loadUserDoc,
  setRemoved,
  writeCache,
  dispatchCollectionCount,
} from "./collected-facts.js";

const provider = new GoogleAuthProvider();

function renderSignInPrompt(root) {
  root.innerHTML = `
    <div class="quiz-panel">
      <p>Sign in to see and manage the facts you've collected.</p>
      <button type="button" class="auth-sign-in" data-manage-sign-in>Sign in with Google</button>
    </div>
  `;
  root.querySelector("[data-manage-sign-in]").addEventListener("click", async function (event) {
    event.target.disabled = true;
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign-in failed", error);
      event.target.disabled = false;
    }
  });
}

function renderEmptyState(root) {
  root.innerHTML = `
    <div class="quiz-panel">
      <p>You haven't collected any facts yet — add some with the "Add to my collection" button on a daily page, then come back here to manage them.</p>
    </div>
  `;
}

function groupByTopic(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const topic = entry.fact.topic;
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(entry);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function factCardHtml(entry) {
  const { fact, removed } = entry;
  return `
    <article class="manage-fact-card${removed ? " is-removed" : ""}" id="${fact.id}">
      <h3 class="fact-question">${fact.question}</h3>
      <p class="fact-answer"><span class="fact-answer-label">Answer</span> ${fact.answer}</p>
      <div class="manage-fact-footer">
        ${removed ? '<span class="manage-removed-badge">Removed</span>' : ""}
        <button type="button" class="manage-forget${removed ? " is-removed" : ""}" data-fact-id="${fact.id}" data-removed="${removed}">
          ${removed ? "Add back" : "Forget"}
        </button>
      </div>
    </article>
  `;
}

function render(root, groups) {
  root.innerHTML = groups
    .map(
      ([topic, entries]) => `
        <section class="manage-topic-group">
          <h2 class="manage-topic-heading">${topic}</h2>
          <div class="manage-fact-list">
            ${entries.map(factCardHtml).join("")}
          </div>
        </section>
      `
    )
    .join("");
}

async function runManagePage(root, user) {
  root.innerHTML = `<p class="quiz-status">Loading&hellip;</p>`;

  const [userDoc, allFacts] = await Promise.all([
    loadUserDoc(user),
    getAllFacts({ forceRefresh: true }),
  ]);
  const factsById = new Map(allFacts.map((fact) => [fact.id, fact]));

  const entries = (userDoc.collected || [])
    .map((collectedEntry) => ({
      fact: factsById.get(collectedEntry.id),
      removed: !!collectedEntry.removed,
    }))
    .filter((entry) => entry.fact);

  if (entries.length === 0) {
    renderEmptyState(root);
    return;
  }

  render(root, groupByTopic(entries));

  root.addEventListener("click", async function (event) {
    const button = event.target.closest(".manage-forget");
    if (!button || !root.contains(button)) return;

    const factId = button.dataset.factId;
    const wasRemoved = button.dataset.removed === "true";
    button.disabled = true;

    try {
      const collected = await setRemoved(user, factId, !wasRemoved);
      const activeIds = new Set(
        collected.filter((entry) => !entry.removed).map((entry) => entry.id)
      );
      writeCache(user.uid, activeIds);
      dispatchCollectionCount(activeIds.size);

      const updatedEntries = (collected || [])
        .map((collectedEntry) => ({
          fact: factsById.get(collectedEntry.id),
          removed: !!collectedEntry.removed,
        }))
        .filter((entry) => entry.fact);
      render(root, groupByTopic(updatedEntries));
    } catch (error) {
      console.error("Could not update fact", error);
      button.disabled = false;
    }
  });
}

function init() {
  const root = document.querySelector("[data-manage-root]");
  if (!root) return;

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      renderSignInPrompt(root);
      return;
    }
    runManagePage(root, user).catch(function (error) {
      console.error("Could not load your facts", error);
      root.innerHTML = `<div class="quiz-panel"><p class="quiz-status">Couldn't load your facts — please try again later.</p></div>`;
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
