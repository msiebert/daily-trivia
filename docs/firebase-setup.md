# Firebase Setup

Daily Trivia has no server-side database — your sign-in and progress data live
entirely in a Firebase project that **you** create and own. This repo only
ships client-side code that talks to whichever project's config you plug
in. No coding experience is needed for any of the steps below; it's all
clicking through the Firebase console.

Budget about 10 minutes. Everything here fits in Firebase's free "Spark"
plan.

## 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
   and sign in with the Google account you want to use.
2. Click **Add project**.
3. Give it a name (e.g. `daily-trivia-yourname`). You can disable Google
   Analytics for this project — it isn't used.
4. Click **Create project** and wait for it to finish.

## 2. Enable Google sign-in

1. In the left sidebar, open **Authentication** (use the search icon at the
   top of the sidebar if you don't see it listed, or go directly to
   `https://console.firebase.google.com/project/YOUR-PROJECT-ID/authentication`).
2. Click **Get started**.
3. Go to the **Sign-in method** tab, click **Add new provider**, and choose
   **Google**.
4. Toggle it **Enable**, set a project support email (any email works —
   it's just for Google's own records), and click **Save**.

## 3. Create a Firestore database

1. In the left sidebar, open **Firestore Database** (or go to
   `https://console.firebase.google.com/project/YOUR-PROJECT-ID/firestore`).
2. Click **Create database**.
3. Pick a location close to you (this can't be changed later, but it
   doesn't meaningfully matter for this app).
4. Choose **Start in production mode** — this repo's security rules
   (`firestore.rules`) handle access control, so you don't need Firestore's
   permissive test-mode default.
5. Click **Create**.

## 4. Register a web app and get your config

1. Click the gear icon next to "Project Overview" → **Project settings**
   (or go to
   `https://console.firebase.google.com/project/YOUR-PROJECT-ID/settings/general`).
2. Scroll to **Your apps** and click the **`</>`** (web) icon to register a
   new web app.
3. Give it any nickname. Leave **"Also set up Firebase Hosting"**
   unchecked — this site deploys via GitHub Pages, not Firebase Hosting.
4. Click **Register app**. Firebase shows a `firebaseConfig` object like:

   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "...",
   };
   ```

5. Copy those values into
   [`assets/js/firebase-config.js`](../assets/js/firebase-config.js) in
   this repo, replacing the placeholder values there. This file is safe to
   commit publicly — it identifies your project but doesn't grant access to
   it (Firestore rules and the sign-in provider do that).

## 5. Firestore security rules

This repo's [`firestore.rules`](../firestore.rules) restricts every
document under `users/{uid}` to only be readable/writable by that signed-in
user — appropriate for this app's single-user-per-project model.

Deploy it to your project:

1. In the Firebase console, go to **Firestore Database** → the **Rules**
   tab (`https://console.firebase.google.com/project/YOUR-PROJECT-ID/firestore/rules`).
2. Delete the existing contents of the editor and paste in the full
   contents of this repo's [`firestore.rules`](../firestore.rules).
3. Click **Publish**.

(If you're comfortable with the Firebase CLI, `firebase deploy --only
firestore:rules` does the same thing — but the console editor above needs
no setup.)

## 6. Authorize your production domain

Google sign-in only works from domains you've explicitly authorized.
`localhost` is authorized by default, which covers local preview
(`bin/preview`), but your live GitHub Pages URL needs adding too:

1. Go to **Authentication** → **Settings** tab → **Authorized domains**.
2. Click **Add domain** and add your GitHub Pages domain — for a repo
   published at `https://your-username.github.io/daily-trivia`, the domain
   to add is `your-username.github.io`.

## Done

That's the whole setup. Once `assets/js/firebase-config.js` has your
project's values and the rules are published, sign-in and progress
tracking work against your own project — nothing else in this repo needs
to change per-user.

See [`docs/firestore-schema.md`](firestore-schema.md) for the shape of the
document this creates.
