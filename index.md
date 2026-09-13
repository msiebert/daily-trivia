---
layout: default
title: Home
---
<section class="hero hero-with-stats">
  <p class="hero-eyebrow">A daily learning journal</p>
  <h1>{{ site.title }}</h1>
  <p class="hero-description">{{ site.description }}</p>
</section>

<section class="stats" id="stats" data-stats-root></section>

{% assign daily_pages = site.pages | where_exp: "p", "p.url contains '/daily/'" | sort: "date" | reverse %}

{% comment %}
  daily_pages is sorted newest-first, so the cutoff index only needs to be
  found once. This can't be a one-line where_exp because Jekyll's Liquid
  condition parser rejects filters inside the where_exp expression string,
  so the per-entry date math has to happen in a plain assign tag instead.
{% endcomment %}
{% assign week_ago_ts = site.time | date: "%Y-%m-%d" | date: "%s" | minus: 604800 %}
{% assign recent_pages = daily_pages %}
{% assign old_pages = "" | split: "," %}
{% for entry in daily_pages %}
  {% assign entry_ts = entry.date | date: "%s" | plus: 0 %}
  {% if entry_ts <= week_ago_ts %}
    {% assign recent_pages = daily_pages | slice: 0, forloop.index0 %}
    {% assign old_pages = daily_pages | slice: forloop.index0, daily_pages.size %}
    {% break %}
  {% endif %}
{% endfor %}
{% assign random_old_entry = old_pages | sample %}

<section class="latest" id="latest">
  {% if daily_pages.size > 0 %}
    {% assign latest = daily_pages.first %}
    <h2 class="section-heading">Today's trivia</h2>
    <a class="latest-card" href="{{ latest.url | relative_url }}">
      <span class="latest-date">{{ latest.date | date: "%A, %B %-d, %Y" }}</span>
      <span class="latest-title">{% if latest.topic %}{{ latest.topic }}{% else %}Today's trivia{% endif %}</span>
      <span class="latest-cta">Read today's entry &rarr;</span>
    </a>
  {% endif %}
</section>

{% if random_old_entry %}
<section class="discover" id="discover">
  <a class="latest-card discover-card" href="{{ random_old_entry.url | relative_url }}">
    <span class="hero-eyebrow discover-eyebrow">From the archive</span>
    <span class="latest-date">{{ random_old_entry.date | date: "%A, %B %-d, %Y" }}</span>
    <span class="latest-title">{% if random_old_entry.topic %}{{ random_old_entry.topic }}{% else %}Today's trivia{% endif %}</span>
    <span class="latest-cta">Revisit this entry &rarr;</span>
  </a>
</section>
{% endif %}

<section class="archive">
  <h2 class="section-heading">The journal so far</h2>
  <ol class="archive-list">
    {% for entry in recent_pages %}
      <li class="archive-item">
        <a href="{{ entry.url | relative_url }}">
          <span class="archive-date">{{ entry.date | date: "%b %-d, %Y" }}</span>
          <span class="archive-title">{% if entry.topic %}{{ entry.topic }}{% else %}Today's trivia{% endif %}</span>
        </a>
      </li>
    {% endfor %}
  </ol>
</section>

<section class="quiz" id="quiz">
  <h2 class="section-heading">Quiz</h2>
  <p class="quiz-copy">
    Twenty-five questions drawn from everything you've learned so far
    across every daily entry, weighted toward what you've recently missed.
  </p>
  <a class="latest-cta" href="{{ '/quiz/' | relative_url }}">Take today's quiz &rarr;</a>
</section>
