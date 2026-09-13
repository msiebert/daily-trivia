---
layout: default
title: Getting Started
permalink: /getting-started/
---
<section class="hero">
  <p class="hero-eyebrow">New here?</p>
  <h1>Getting started with {{ site.title }}</h1>
  <p class="hero-description">
    {{ site.title }} is a quiet daily habit: up to three new facts each
    morning, a running collection of everything you've learned, and a quiz
    that revisits what's starting to slip. Here's how to make the most of
    it.
  </p>
</section>

<section class="guide-steps">
  <h2 class="section-heading">How it works</h2>

  <ol class="guide-step-list">
    <li class="guide-step">
      <span class="guide-step-num">1</span>
      <div class="guide-step-body">
        <h3>Read today's trivia</h3>
        <p>
          Every morning a new entry goes up with up to three facts on a
          single topic &mdash; a question, an answer, and a short
          explanation for each. Find it on the <a href="{{ '/' | relative_url }}">home
          page</a> under "Today's trivia," or browse any past day in
          the journal list below it.
        </p>
      </div>
    </li>

    <li class="guide-step">
      <span class="guide-step-num">2</span>
      <div class="guide-step-body">
        <h3>Sign in to start collecting</h3>
        <p>
          Click <strong>Sign in with Google</strong> in the header. Signing
          in lets the site remember which facts you've read, so they can
          show up in your quiz later. Nothing is shared beyond your own
          account &mdash; each signed-in user's progress is stored
          separately.
        </p>
      </div>
    </li>

    <li class="guide-step">
      <span class="guide-step-num">3</span>
      <div class="guide-step-body">
        <h3>Add facts to your collection</h3>
        <p>
          On any daily entry, click <strong>+ Add to my collection</strong>
          under a fact to save it. Only facts you've collected are eligible
          to appear in your quiz, so add the ones you want to keep sharp
          on.
        </p>
      </div>
    </li>

    <li class="guide-step">
      <span class="guide-step-num">4</span>
      <div class="guide-step-body">
        <h3>Take the quiz</h3>
        <p>
          The <a href="{{ '/quiz/' | relative_url }}">quiz</a> draws
          twenty-five questions from everything you've collected so far,
          weighted toward facts you've recently missed. Grade yourself
          honestly after each answer &mdash; that's what keeps the
          weighting useful.
        </p>
      </div>
    </li>

    <li class="guide-step">
      <span class="guide-step-num">5</span>
      <div class="guide-step-body">
        <h3>Come back daily</h3>
        <p>
          The home page tracks your streak and recent accuracy once you've
          signed in. Reading the day's trivia and finishing the quiz
          both count toward your daily checkmark &mdash; the habit is the
          point.
        </p>
      </div>
    </li>
  </ol>
</section>

<section class="guide-faq">
  <h2 class="section-heading">A few questions</h2>

  <dl class="guide-faq-list">
    <div class="guide-faq-item">
      <dt>Do I need an account to read the facts?</dt>
      <dd>No &mdash; every daily entry is public. Signing in is only needed to collect facts and take the quiz.</dd>
    </div>
    <div class="guide-faq-item">
      <dt>Can I install this on my phone?</dt>
      <dd>Yes. {{ site.title }} works as a home-screen app &mdash; look for the install prompt, or use your browser's "Add to Home Screen" option.</dd>
    </div>
    <div class="guide-faq-item">
      <dt>What if I miss a day?</dt>
      <dd>Nothing is lost. Every past entry stays in the <a href="{{ '/' | relative_url }}">journal</a>, and your quiz keeps drawing from everything you've collected so far.</dd>
    </div>
  </dl>
</section>
