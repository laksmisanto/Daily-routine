/* ==========================================================================
   Personal Routine: rendering and live "now / next" logic.
   Reads the globals defined in routine-data.js. Contains no schedule content.

   Testing helpers (optional URL parameters):
     ?day=1        preview a weekday (0 = Sunday ... 6 = Saturday)
     ?time=20:45   freeze the clock at a given time
   ========================================================================== */
(function () {
  'use strict';

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MINUTES_PER_DAY = 1440;

  /* Shown when the time falls between two scheduled blocks. */
  const GAP_BLOCK = {
    id: 'gap',
    title: 'Between blocks',
    description: 'Nothing is scheduled right now.',
    category: null,
  };

  const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const state = {
    previewDay: null, // null = follow today
    dayKey: '',
    tickKey: '',
    clockText: '',
    dateText: '',
    announcedId: '',
  };

  const els = {};

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

  const pad = (n) => String(n).padStart(2, '0');

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** 495 -> "8:15 AM". 1440 wraps to "12:00 AM". */
  function formatClock(totalMinutes) {
    const m = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const h24 = Math.floor(m / 60);
    const h12 = h24 % 12 || 12;
    return `${h12}:${pad(m % 60)} ${h24 < 12 ? 'AM' : 'PM'}`;
  }

  /** "8:15 AM" -> { time: "8:15", mer: "AM" }. Labels without AM/PM pass through. */
  function splitMeridiem(label) {
    const match = /^(.*?)\s*(AM|PM)$/.exec(label);
    return match ? { time: match[1], mer: match[2] } : { time: label, mer: '' };
  }

  function formatDuration(mins) {
    if (mins < 1) return 'less than a minute';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }

  function startText(block) {
    return block.startLabel || formatClock(block.startMin);
  }

  function endText(block) {
    return block.endLabel || formatClock(block.endMin);
  }

  /** "8:00 – 9:00 AM" when both ends share a meridiem, otherwise the full pair. */
  function rangeLabel(block) {
    if (block.flexible) return 'No fixed times today';
    if (block.id === 'gap') return 'Unscheduled';
    if (block.rangeLabel) return block.rangeLabel;
    const start = startText(block);
    const end = endText(block);
    const s = splitMeridiem(start);
    const e = splitMeridiem(end);
    return s.mer && s.mer === e.mer ? `${s.time} – ${end}` : `${start} – ${end}`;
  }

  /** Real time, unless a ?time=HH:MM override is present (for testing). */
  function getNow() {
    const now = new Date();
    const override = new URLSearchParams(window.location.search).get('time');
    if (override && /^\d{1,2}:\d{2}$/.test(override)) {
      const [h, m] = override.split(':').map(Number);
      now.setHours(h, m, 0, 0);
    }
    return now;
  }

  /* ------------------------------------------------------------------ */
  /* Schedule logic                                                      */
  /* ------------------------------------------------------------------ */

  function routineFor(dayIndex) {
    return Object.values(routines).find((routine) => routine.days.includes(dayIndex));
  }

  /** Apply the exercise-day override and precompute minute values. */
  function resolveBlock(block, routine, dayIndex) {
    const isExerciseDay = block.exercise && routine.exerciseDays && routine.exerciseDays.includes(dayIndex);
    const resolved = isExerciseDay ? { ...block, ...block.exercise } : { ...block };
    resolved.startMin = toMinutes(resolved.start);
    resolved.endMin = toMinutes(resolved.end);
    return resolved;
  }

  /** Full list of blocks for a day, starting with overnight sleep. */
  function buildSchedule(dayIndex) {
    const routine = routineFor(dayIndex);
    const overnight = resolveBlock(overnightSleep, routine, dayIndex);

    if (routine.flexible) {
      const flexBlock = resolveBlock(
        { id: 'flexible-day', start: WAKE_TIME, end: '24:00', category: 'project', flexible: true, ...routine.nowCard },
        routine,
        dayIndex
      );
      return [overnight, flexBlock];
    }
    return [overnight, ...routine.blocks.map((block) => resolveBlock(block, routine, dayIndex))];
  }

  /**
   * Current and next block for a day at a given minute.
   * `current` is null when the time falls in a gap between blocks.
   */
  function getStatus(dayIndex, nowMin) {
    const schedule = buildSchedule(dayIndex);
    const current = schedule.find((b) => nowMin >= b.startMin && nowMin < b.endMin) || null;
    const upcoming = schedule.find((b) => b.startMin > nowMin) || null;

    if (upcoming) {
      return { current, next: upcoming, untilNext: upcoming.startMin - nowMin, nextDayOffset: 0 };
    }

    // Nothing left today: the next block is the first waking block tomorrow.
    const tomorrow = buildSchedule((dayIndex + 1) % 7).find((b) => b.category !== 'sleep');
    return {
      current,
      next: tomorrow,
      untilNext: MINUTES_PER_DAY - nowMin + tomorrow.startMin,
      nextDayOffset: 1,
    };
  }

  function remainingText(block, nowMin, status) {
    if (block.id === 'gap') return `Next block in ${formatDuration(status.untilNext)}`;
    if (block.flexible || block.openEnded) return '';
    const target = block.wake ? toMinutes(block.wake) : block.endMin;
    const left = (((target - nowMin) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return `${formatDuration(left)} ${block.remainingSuffix || 'left'}`;
  }

  function nextTimeLabel(next, offset) {
    if (next.flexible) return offset ? 'Tomorrow, no fixed start' : 'No fixed start';
    return offset ? `Tomorrow, ${startText(next)}` : startText(next);
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: shared pieces                                            */
  /* ------------------------------------------------------------------ */

  function renderCategory(category, labelOverride) {
    const label = labelOverride || (category && CATEGORIES[category] && CATEGORIES[category].label);
    if (!label) return '';
    return `<span class="cat" data-cat="${esc(category || '')}">${esc(label)}</span>`;
  }

  function renderDetail(part) {
    const label = part.label ? `<span class="detail-label">${esc(part.label)}</span>` : '';

    switch (part.kind) {
      case 'text':
        return `<div class="detail">${label}<p class="detail-text">${esc(part.text)}</p></div>`;

      case 'chips':
        return `<div class="detail">${label}<ul class="chips">${part.items
          .map((item) => `<li>${esc(item)}</li>`)
          .join('')}</ul></div>`;

      case 'flow':
        return `<div class="detail">${label}<ol class="flow">${part.items
          .map((item) => `<li>${esc(item)}</li>`)
          .join('')}</ol></div>`;

      case 'sequence':
        return `<div class="detail">${label}<ol class="sequence">${part.steps
          .map(
            (step) =>
              `<li${step.isBreak ? ' class="is-break"' : ''}><span class="seq-label">${esc(step.label)}</span>${
                step.text ? `<span class="seq-text">${esc(step.text)}</span>` : ''
              }</li>`
          )
          .join('')}</ol></div>`;

      case 'ritual':
        return `<div class="detail">${label}<ul class="ritual">${part.steps
          .map(
            (step) => `<li class="ritual-item">
              <p class="ritual-key">${esc(step.key)}</p>
              <p class="ritual-q">${esc(step.question)}</p>
              <p class="ritual-eg"><span class="sr-only">Example: </span>${esc(step.example)}</p>
            </li>`
          )
          .join('')}</ul></div>`;

      default:
        return '';
    }
  }

  const renderDetails = (details) => (details || []).map(renderDetail).join('');

  /* ------------------------------------------------------------------ */
  /* Rendering: header                                                   */
  /* ------------------------------------------------------------------ */

  function renderHeader(now, nowMin) {
    const clockText = formatClock(nowMin);
    if (clockText !== state.clockText) {
      const parts = splitMeridiem(clockText);
      els.clock.innerHTML = `${esc(parts.time)}<span class="mer"> ${parts.mer}</span>`;
      els.clock.setAttribute('datetime', `${pad(now.getHours())}:${pad(now.getMinutes())}`);
      state.clockText = clockText;
    }

    const dateText = DATE_FORMAT.format(now);
    if (dateText !== state.dateText) {
      els.date.textContent = dateText;
      state.dateText = dateText;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: Now / Next                                               */
  /* ------------------------------------------------------------------ */

  function renderNow(status, nowMin, viewedDay, isPreview) {
    const current = status.current || GAP_BLOCK;
    const next = status.next;
    const remaining = remainingText(current, nowMin, status);

    const previewTag = isPreview ? `<span class="tag">Previewing ${DAY_NAMES[viewedDay]}</span>` : '';

    const nowCard = `
      <article class="card now-card" aria-label="Current activity">
        <div class="now-head">
          <p class="now-label"><span class="now-dot" aria-hidden="true"></span>Now</p>
          ${previewTag}
        </div>
        <p class="now-time">${esc(rangeLabel(current))}</p>
        <h3 class="now-title">${esc(current.title)}</h3>
        <p class="now-desc">${esc(current.description)}</p>
        ${current.rule ? `<p class="rule-note">${esc(current.rule)}</p>` : ''}
        ${current.details ? `<div class="now-details">${renderDetails(current.details)}</div>` : ''}
        <div class="now-foot">
          ${remaining ? `<span class="remaining">${esc(remaining)}</span>` : ''}
          ${renderCategory(current.category, current.categoryLabel)}
        </div>
      </article>`;

    const nextCard = next
      ? `
      <article class="card next-card" aria-label="Next activity">
        <p class="next-label">Next</p>
        <p class="next-time">${esc(nextTimeLabel(next, status.nextDayOffset))}</p>
        <h3 class="next-title">${esc(next.title)}</h3>
        <p class="next-desc">${esc(next.description)}</p>
        ${next.flexible ? '' : `<p class="next-in">Starts in ${esc(formatDuration(status.untilNext))}</p>`}
      </article>`
      : '';

    return nowCard + nextCard;
  }

  /** Screen readers hear a change only when the block changes, not every minute. */
  function announce(block) {
    if (state.announcedId === block.id) return;
    state.announcedId = block.id;
    els.live.textContent = `Now: ${block.title}`;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: timeline                                                 */
  /* ------------------------------------------------------------------ */

  function renderTimelineItem(block) {
    const start = splitMeridiem(startText(block));
    const isOvernight = block.id === 'overnight-sleep';

    const more =
      block.details && block.details.length
        ? `<details class="tl-more"${block.openByDefault ? ' open' : ''}>
             <summary>${esc(block.moreLabel || 'Details')}</summary>
             <div class="tl-detail">${renderDetails(block.details)}</div>
           </details>`
        : '';

    return `
      <li class="tl-item" data-start="${block.startMin}" data-end="${block.endMin}" data-cat="${esc(
        block.category
      )}" data-state="upcoming"${isOvernight ? ' data-overnight hidden' : ''}>
        <div class="tl-time">
          <span class="tl-clock">${esc(start.time)}</span>${start.mer ? ` <span class="tl-mer">${start.mer}</span>` : ''}
          <span class="tl-until">until ${esc(endText(block))}</span>
        </div>
        <div class="tl-rail" aria-hidden="true"></div>
        <div class="tl-body">
          <div class="tl-card">
            <div class="tl-head">
              <h3 class="tl-title">${esc(block.title)}</h3>
              <span class="tl-now">Now</span>
              ${renderCategory(block.category)}
            </div>
            <p class="tl-desc">${esc(block.description)}</p>
            ${more}
          </div>
        </div>
      </li>`;
  }

  function renderGroupRow(label) {
    return `
      <li class="tl-item tl-group">
        <div class="tl-rail" aria-hidden="true"></div>
        <div class="tl-body"><p class="tl-group-label">${esc(label)}</p></div>
      </li>`;
  }

  function renderTimeline(dayIndex) {
    let lastGroup = '';
    const rows = buildSchedule(dayIndex).map((block) => {
      let html = '';
      if (block.group && block.group !== lastGroup) html += renderGroupRow(block.group);
      lastGroup = block.group || '';
      return html + renderTimelineItem(block);
    });
    return `<ol class="timeline">${rows.join('')}</ol>`;
  }

  /** Saturday: four sections instead of a clock-based timeline. */
  function renderFlexible(routine) {
    const panels = routine.sections
      .map((section, index) => {
        const prompts = section.prompts
          ? `<dl class="prompts">${section.prompts
              .map((p) => `<div><dt>${esc(p.label)}</dt><dd>${esc(p.text)}</dd></div>`)
              .join('')}</dl>`
          : '';
        const details = section.details ? `<div class="tl-detail panel-details">${renderDetails(section.details)}</div>` : '';
        return `
          <article class="card panel">
            <header class="panel-head">
              <span class="panel-index" aria-hidden="true">${index + 1}</span>
              <div>
                <h3 class="panel-title">${esc(section.title)}</h3>
                <p class="panel-intro">${esc(section.intro)}</p>
              </div>
            </header>
            <div class="panel-body">${prompts}${details}</div>
          </article>`;
      })
      .join('');
    return `<div class="sat-flow">${panels}</div>`;
  }

  /** Mark each row past / current / upcoming without rebuilding the list. */
  function updateTimelineStates(nowMin) {
    const items = els.timelineBody.querySelectorAll('.tl-item[data-start]');
    items.forEach((item) => {
      const start = Number(item.dataset.start);
      const end = Number(item.dataset.end);
      const stateName = nowMin >= end ? 'past' : nowMin >= start ? 'current' : 'upcoming';

      if (item.dataset.state !== stateName) item.dataset.state = stateName;
      if (stateName === 'current') item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');

      // Overnight sleep only appears while it is actually happening.
      if (item.hasAttribute('data-overnight')) item.hidden = stateName !== 'current';
    });

    // Trim the rail line above the first and below the last visible row.
    const visible = Array.from(els.timelineBody.querySelectorAll('.tl-item')).filter((item) => !item.hidden);
    visible.forEach((item, index) => {
      item.classList.toggle('is-first', index === 0);
      item.classList.toggle('is-last', index === visible.length - 1);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: rules, modes, priorities, path                           */
  /* ------------------------------------------------------------------ */

  function collectRules(routine) {
    if (routine.rules) return routine.rules;
    return routine.blocks.filter((b) => b.rule).map((b) => ({ text: b.rule, source: b.title }));
  }

  function renderRules(routine) {
    const rules = collectRules(routine);
    if (!rules.length) return '';
    return `
      <div class="card rules-card">
        <h3 class="rules-title">Rules for the day</h3>
        <ul class="rules">
          ${rules
            .map(
              (r) =>
                `<li><span class="rule-text">${esc(r.text)}</span><span class="rule-source">${esc(r.source)}</span></li>`
            )
            .join('')}
        </ul>
      </div>`;
  }

  function renderModes(activeKey, isPreview) {
    return Object.values(routines)
      .map((routine) => {
        const active = routine.key === activeKey;
        const anchors = routine.flexible
          ? routine.sections.map((s) => ({ when: '', text: s.title }))
          : routine.blocks
              .filter((b) => b.anchor)
              .map((b) => ({
                when: b.startLabel || formatClock(toMinutes(b.start)),
                text: b.anchorTitle || b.title,
              }));

        return `
          <article class="card mode"${active ? ' data-active="true" aria-current="true"' : ''}>
            <div class="mode-head">
              <h3 class="mode-name">${esc(routine.name)}</h3>
              ${active ? `<span class="tag">${isPreview ? 'Previewing' : 'Today'}</span>` : ''}
            </div>
            <p class="mode-summary">${esc(routine.summary)}</p>
            <ul class="mode-list">
              ${anchors
                .map(
                  (a) =>
                    `<li>${a.when ? `<span class="mode-when">${esc(a.when)}</span>` : ''}<span>${esc(a.text)}</span></li>`
                )
                .join('')}
            </ul>
          </article>`;
      })
      .join('');
  }

  function renderPriorities() {
    return weeklyPriorities
      .map(
        (tier) => `
        <div class="tier" data-tier="${tier.tier}">
          <div class="tier-head">
            <p class="tier-rank">Tier ${tier.tier}</p>
            <h3 class="tier-name">${esc(tier.name)}</h3>
            <p class="tier-note">${esc(tier.note)}</p>
          </div>
          <ul class="pills">${tier.items.map((item) => `<li class="pill">${esc(item)}</li>`).join('')}</ul>
        </div>`
      )
      .join('');
  }

  function renderExercise(viewedDay) {
    return exerciseSchedule
      .map(
        (item) => `
        <li class="exercise-item"${item.dayIndex === viewedDay ? ' data-active="true"' : ''}>
          <span class="exercise-day">${esc(item.day)}</span>
          <span class="exercise-time">${esc(item.time)}</span>
        </li>`
      )
      .join('');
  }

  function renderPath() {
    return meta.path
      .map(
        (step) => `
        <li data-state="${esc(step.state)}">
          <span class="path-text"><span class="path-name">${esc(step.name)}</span>${
            step.note ? ` <span class="path-note">${esc(step.note)}</span>` : ''
          }</span>
          <span class="path-status">${esc(step.status)}</span>
        </li>`
      )
      .join('');
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: day preview control                                      */
  /* ------------------------------------------------------------------ */

  function renderPreview(viewedDay, todayIndex) {
    const pills = DAY_SHORT.map((label, index) => {
      const isToday = index === todayIndex;
      return `<button type="button" class="day-pill" data-day="${index}" aria-pressed="${index === viewedDay}"${
        isToday ? ' data-today="true"' : ''
      } aria-label="${DAY_NAMES[index]}${isToday ? ' (today)' : ''}">${label}</button>`;
    }).join('');

    const note =
      viewedDay !== todayIndex
        ? `<p class="preview-note">Previewing ${DAY_NAMES[viewedDay]} at the current time. <button type="button" class="link-btn" data-reset>Back to today</button></p>`
        : '';

    return `
      <div class="preview">
        <span class="preview-label" id="preview-label">Preview a day</span>
        <div class="day-pills" role="group" aria-labelledby="preview-label">${pills}</div>
      </div>
      ${note}`;
  }

  /* ------------------------------------------------------------------ */
  /* Update loop                                                         */
  /* ------------------------------------------------------------------ */

  /** Everything that only changes when the viewed day changes. */
  function renderDayView(viewedDay, todayIndex) {
    const routine = routineFor(viewedDay);
    const isPreview = viewedDay !== todayIndex;
    const isExerciseDay = !!(routine.exerciseDays && routine.exerciseDays.includes(viewedDay));

    els.timelineTitle.textContent = routine.flexible ? 'Weekly control center' : 'Daily timeline';
    els.timelineMeta.textContent = routine.flexible
      ? 'Saturday has no fixed clock times.'
      : `${routine.name} routine${isExerciseDay ? ', exercise day' : ''}`;

    els.timelineBody.innerHTML = routine.flexible ? renderFlexible(routine) : renderTimeline(viewedDay);
    els.rules.innerHTML = renderRules(routine);
    els.modes.innerHTML = renderModes(routine.key, isPreview);
    els.exercise.innerHTML = renderExercise(viewedDay);
    els.preview.innerHTML = renderPreview(viewedDay, todayIndex);
  }

  function update(force) {
    const now = getNow();
    const todayIndex = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    renderHeader(now, nowMin);

    const viewedDay = state.previewDay === null ? todayIndex : state.previewDay;
    const dayKey = `${todayIndex}:${viewedDay}`;
    const tickKey = `${dayKey}:${nowMin}`;

    // Nothing visible changes between minutes, so skip the work.
    if (!force && tickKey === state.tickKey) return;
    state.tickKey = tickKey;

    if (force || dayKey !== state.dayKey) {
      state.dayKey = dayKey;
      renderDayView(viewedDay, todayIndex);
    }

    const status = getStatus(viewedDay, nowMin);
    els.nowGrid.innerHTML = renderNow(status, nowMin, viewedDay, viewedDay !== todayIndex);
    updateTimelineStates(nowMin);
    announce(status.current || GAP_BLOCK);
  }

  function onPreviewClick(event) {
    const dayButton = event.target.closest('[data-day]');
    const resetButton = event.target.closest('[data-reset]');
    if (!dayButton && !resetButton) return;

    const todayIndex = getNow().getDay();
    const chosen = resetButton ? todayIndex : Number(dayButton.dataset.day);
    state.previewDay = chosen === todayIndex ? null : chosen;
    update(true);

    // The control is re-rendered, so put keyboard focus back where it was.
    const target = els.preview.querySelector(`[data-day="${chosen}"]`);
    if (target) target.focus();
  }

  function init() {
    const ids = {
      clock: 'clock',
      date: 'header-date',
      nowGrid: 'now-grid',
      live: 'live-status',
      timelineTitle: 'timeline-heading',
      timelineMeta: 'timeline-meta',
      timelineBody: 'timeline-body',
      preview: 'day-preview',
      rules: 'rules',
      modes: 'modes-grid',
      exercise: 'exercise-list',
      priorities: 'priorities-body',
      mission: 'mission-text',
      path: 'path-list',
    };
    Object.keys(ids).forEach((key) => {
      els[key] = document.getElementById(ids[key]);
    });

    // Static content: rendered once.
    els.priorities.innerHTML = renderPriorities();
    els.mission.textContent = meta.mission;
    els.path.innerHTML = renderPath();

    const dayParam = new URLSearchParams(window.location.search).get('day');
    if (dayParam !== null && /^[0-6]$/.test(dayParam)) state.previewDay = Number(dayParam);

    els.preview.addEventListener('click', onPreviewClick);

    update(true);
    setInterval(update, 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) update();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
