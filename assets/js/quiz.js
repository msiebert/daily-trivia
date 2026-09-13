// Quiz: weighted draw, prompt-first UI, end-of-quiz grading.
// See docs/quiz.md for the full design (weighting formula, grading
// algorithm, localStorage/event contract for MAR-15).
import { auth, db } from "./auth.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAllFacts } from "./fact-store.js";

// --- Tunable weighting constants (docs/quiz.md#draw-weighted-sample-of-25) ---
const QUIZ_LENGTH = 25;
const BASE_WEIGHT = 1;
const MISSED_BOOST = 6;
const MISSED_HALF_LIFE_DAYS = 10;
const ADDED_BOOST = 3;
const ADDED_HALF_LIFE_DAYS = 14;

const provider = new GoogleAuthProvider();

// Local calendar date (not UTC) — see docs/quiz.md#completion-side-effects.
function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysSince(isoString) {
  const ms = Date.now() - new Date(isoString).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function decay(days, halfLifeDays) {
  return Math.pow(0.5, Math.max(days, 0) / halfLifeDays);
}

function toMap(entries) {
  const map = new Map();
  for (const entry of entries || []) map.set(entry.id, entry);
  return map;
}

function weightFor(factId, missedMap, addedMap) {
  let weight = BASE_WEIGHT;
  const missed = missedMap.get(factId);
  if (missed) weight += MISSED_BOOST * decay(daysSince(missed.at), MISSED_HALF_LIFE_DAYS);
  const added = addedMap.get(factId);
  if (added) weight += ADDED_BOOST * decay(daysSince(added.at), ADDED_HALF_LIFE_DAYS);
  return weight;
}

// Weighted sampling without replacement (Efraimidis-Spirakis A-Res).
function weightedSample(items, weights, n) {
  const keyed = items.map((item, i) => ({
    item,
    key: Math.pow(Math.random(), 1 / Math.max(weights[i], 1e-6)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, n).map((k) => k.item);
}

async function drawQuestions(userDoc) {
  // Force a fresh fetch rather than trusting the once-per-day cache: a user
  // can collect a fact and come straight to the quiz within the same day,
  // and a stale cached store would silently drop it from the pool even
  // though it's correctly in their `collected` list.
  const allFacts = await getAllFacts({ forceRefresh: true });
  const collectedIds = new Set(
    (userDoc.collected || []).filter((e) => !e.removed).map((e) => e.id)
  );
  const pool = allFacts.filter((fact) => collectedIds.has(fact.id));
  const missedMap = toMap(userDoc.recentlyMissed);
  const addedMap = toMap(userDoc.recentlyAdded);
  const weights = pool.map((fact) => weightFor(fact.id, missedMap, addedMap));
  return weightedSample(pool, weights, Math.min(QUIZ_LENGTH, pool.length));
}

async function gradeQuiz(user, questions, grades) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const userDoc = snap.exists()
    ? snap.data()
    : { collected: [], recentlyMissed: [], recentlyAdded: [] };

  const now = new Date().toISOString();
  const quizzedIds = new Set(questions.map((q) => q.id));
  const missedIds = questions.filter((q) => grades.get(q.id) === false).map((q) => q.id);

  const nextMissed = (userDoc.recentlyMissed || []).filter((e) => !quizzedIds.has(e.id));
  for (const id of missedIds) nextMissed.push({ id, at: now });

  const seenIds = new Set(
    [...(userDoc.recentlyMissed || []), ...(userDoc.recentlyAdded || [])].map((e) => e.id)
  );
  const newlyDiscovered = (userDoc.collected || [])
    .filter((e) => !e.removed && !seenIds.has(e.id))
    .map((e) => e.id);

  const nextAdded = (userDoc.recentlyAdded || [])
    .filter((e) => !quizzedIds.has(e.id))
    .concat(newlyDiscovered.map((id) => ({ id, at: now })));

  await setDoc(ref, { recentlyMissed: nextMissed, recentlyAdded: nextAdded }, { merge: true });
}

function markCompletedLocally(total, correct) {
  const date = today();
  try {
    localStorage.setItem(`five-things:quiz:completed:${date}`, new Date().toISOString());
  } catch (error) {
    // localStorage unavailable — completion still happened, just isn't tracked locally.
  }
  window.dispatchEvent(
    new CustomEvent("five-things:quiz-completed", {
      detail: { date, total, correct, missed: total - correct },
    })
  );
}

// --- Rendering ---

function renderSignInPrompt(root) {
  root.innerHTML = `
    <div class="quiz-panel">
      <p>Sign in to take today's quiz from everything you've learned so far.</p>
      <button type="button" class="auth-sign-in" data-quiz-sign-in>Sign in with Google</button>
    </div>
  `;
  root.querySelector("[data-quiz-sign-in]").addEventListener("click", async function (event) {
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
      <p>You haven't collected any facts yet — add some with the "Add to my collection" button on a daily page, then come back here to quiz yourself.</p>
    </div>
  `;
}

function renderQuestion(root, questions, index, onGrade) {
  const question = questions[index];
  root.innerHTML = `
    <div class="quiz-panel">
      <p class="quiz-progress">Question ${index + 1} of ${questions.length}</p>
      <p class="quiz-topic">${question.topic}</p>
      <h2 class="quiz-question">${question.question}</h2>
      <button type="button" class="quiz-reveal" data-quiz-reveal>Reveal answer</button>
      <div class="quiz-answer-block" data-quiz-answer hidden>
        <p class="quiz-answer"><span class="fact-answer-label">Answer</span> ${question.answer}</p>
        <a class="quiz-explanation-link" href="${question.explanationUrl}">Read the full explanation &rarr;</a>
        <div class="quiz-grade-buttons">
          <button type="button" class="quiz-grade quiz-grade-correct" data-quiz-correct>I got it right</button>
          <button type="button" class="quiz-grade quiz-grade-missed" data-quiz-missed>I missed it</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector("[data-quiz-reveal]").addEventListener("click", function (event) {
    root.querySelector("[data-quiz-answer]").hidden = false;
    event.target.hidden = true;
  });
  root.querySelector("[data-quiz-correct]").addEventListener("click", function () {
    onGrade(true);
  });
  root.querySelector("[data-quiz-missed]").addEventListener("click", function () {
    onGrade(false);
  });
}

function renderSaving(root) {
  root.innerHTML = `<div class="quiz-panel"><p class="quiz-status">Saving your results&hellip;</p></div>`;
}

function renderSummary(root, total, correct) {
  root.innerHTML = `
    <div class="quiz-panel quiz-summary">
      <p class="quiz-score">${correct} / ${total}</p>
      <p>Nice work — today's quiz is done. Your progress has been saved.</p>
    </div>
  `;
}

function renderError(root, message) {
  root.innerHTML = `<div class="quiz-panel"><p class="quiz-status">${message}</p></div>`;
}

async function runQuiz(root, user) {
  root.innerHTML = `<p class="quiz-status">Loading&hellip;</p>`;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const userDoc = snap.exists()
    ? snap.data()
    : { collected: [], recentlyMissed: [], recentlyAdded: [] };

  const questions = await drawQuestions(userDoc);
  if (questions.length === 0) {
    renderEmptyState(root);
    return;
  }

  const grades = new Map();
  let index = 0;

  function showQuestion() {
    renderQuestion(root, questions, index, async (correct) => {
      grades.set(questions[index].id, correct);
      index += 1;
      if (index < questions.length) {
        showQuestion();
      } else {
        renderSaving(root);
        try {
          await gradeQuiz(user, questions, grades);
          const correctCount = [...grades.values()].filter(Boolean).length;
          markCompletedLocally(questions.length, correctCount);
          renderSummary(root, questions.length, correctCount);
        } catch (error) {
          console.error("Could not save quiz results", error);
          renderError(root, "Couldn't save your results — please try again later.");
        }
      }
    });
  }

  showQuestion();
}

function init() {
  const root = document.querySelector("[data-quiz-root]");
  if (!root) return;

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      renderSignInPrompt(root);
      return;
    }
    runQuiz(root, user).catch(function (error) {
      console.error("Could not load quiz", error);
      renderError(root, "Couldn't load the quiz — please try again later.");
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
