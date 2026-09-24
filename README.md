# Daily-routine
# Personal Routine

A calm, single-page dashboard that answers one question: **what should I be doing right now, and what comes next?**

It is a visual routine, not a tracker. There is no backend, no database, no login, no progress tracking and no build step. Just HTML, CSS, Tailwind (via CDN) and vanilla JavaScript.

> Time management gives you discipline.
> Progress tracking gives you direction.
> Consistency connects them.

## Features

- **Now and Next:** the current block and the next one, with time remaining, updated automatically.
- **Daily timeline:** the full day as a vertical timeline. Past blocks dim, the current block is highlighted.
- **Automatic day mode:** Sunday–Thursday, Friday and Saturday are picked from today's date.
- **Exercise days:** the 6:00–7:00 PM block switches to Exercise on Monday and Wednesday.
- **Saturday control center:** weekly review, planning, deep project work, and personal/recovery. It has no clock times.
- **Rules for the day:** short rules (phone-free morning, no guilt, and so on) collected beside the timeline.
- **Weekly priorities:** a three-tier hierarchy (non-negotiable, rotating, optional) plus the exercise schedule.
- **Light and dark themes:** follows the system setting until you toggle it; your choice is remembered.
- **Day preview:** view any weekday's routine for design or testing.
- **Responsive:** the timeline is rebuilt for mobile rather than shrunk.

## Getting started

1. Keep the folder structure as-is.
2. Open `index.html` in a browser (double-click is fine).

An internet connection is needed on first load for the Tailwind CDN and Google Fonts. Without fonts the site falls back to system fonts.

To serve it locally instead:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Project structure

```text
personal-routine/
├── index.html            Page shell and layout (semantic HTML + Tailwind utilities)
├── css/
│   └── styles.css        Design tokens (light/dark) and component styles
├── js/
│   ├── routine-data.js   All schedule content. Edit this to change your routine
│   ├── app.js            Rendering and current/next logic. No schedule content
│   └── theme.js          Light/dark toggle with saved preference
└── assets/               Reserved for images or icons (currently empty)
```

Scripts are classic (non-module) scripts, so the site works when opened from disk. Load order matters: `routine-data.js` before `app.js`.

## Changing the routine

Everything you see comes from `js/routine-data.js`. `app.js` only renders it.

### Add or edit a block

Blocks live in `routines.normal.blocks` (Sunday–Thursday) and `routines.friday.blocks`. Times are 24-hour `"HH:MM"` strings, and `"24:00"` means midnight.

```js
{
  id: 'typescript',
  start: '08:00',
  end: '09:00',
  title: 'TypeScript',
  description: 'Protected learning block.',
  category: 'learning',
  rule: 'If the day’s work finishes early, do not force extra study.',
  anchor: true,
}
```

| Field | Required | Purpose |
| --- | --- | --- |
| `id`, `start`, `end`, `title`, `description`, `category` | yes | The basics. `category` is a key of `CATEGORIES`. |
| `startLabel`, `endLabel` | no | Display override for flexible boundaries, such as `'8:30/9:00 PM'`. |
| `rangeLabel` | no | Overrides the time range in the Now card. |
| `rule` | no | Shown in the Now card and the "Rules for the day" list. |
| `anchor`, `anchorTitle` | no | Include the block in the Day modes summary. |
| `group` | no | Groups consecutive blocks under one label (used for Friday deep work). |
| `details`, `moreLabel`, `openByDefault` | no | Expandable details in the timeline (see below). |
| `openEnded` | no | No fixed end, so the "time left" countdown is hidden. |
| `exercise` | no | Fields that replace the block on exercise days. |

Blocks do not have to be contiguous. Time between blocks is shown as "Between blocks".

### Detail types

`details` is an array of parts. Each has a `kind`:

- `text`: a short paragraph
- `chips`: a set of small tags (`items`)
- `flow`: an arrowed sequence (`items`)
- `sequence`: labelled steps, with optional breaks (`steps`)
- `ritual`: the four-prompt shutdown grid (`steps` with `key`, `question`, `example`)

### Other things you can edit

| Want to change | Edit |
| --- | --- |
| Exercise days | `routines.normal.exerciseDays` (0 = Sunday ... 6 = Saturday) |
| Exercise schedule strip | `exerciseSchedule` |
| Weekly tiers | `weeklyPriorities` |
| Mission and project path | `meta` |
| Saturday sections and rules | `routines.saturday` |
| Wake time / overnight sleep | `WAKE_TIME`, `sleepBlock` |
| Category names | `CATEGORIES` (colours are in `styles.css`) |

The three philosophy lines are plain text in `index.html`.

## Testing and previewing

- **Preview a day:** use the day pills above the timeline. Now and Next follow the chosen day at the current time. "Back to today" resets it.
- **URL parameters:**
  - `?day=1` previews a weekday (0 = Sunday ... 6 = Saturday)
  - `?time=20:45` freezes the clock at a given time
  - Combine them: `index.html?day=5&time=10:05`

## Design notes

- **Tokens, not hardcoded colours.** All colours are CSS variables in `styles.css`. Dark mode redefines the same tokens under `[data-theme="dark"]`.
- **Category colours** (work, learning, project, recovery, exercise, personal, sleep) appear only as small dots and labels.
- **Typography:** Geist for the interface and Instrument Serif for the philosophy lines. Times use tabular numerals so they don't jitter.
- **Motion:** none unless you trigger it. The current-block marker is static, and reduced-motion preferences are respected.
- **Why component styles are in `styles.css`:** Tailwind's CDN generates classes after the page loads, which would cause a flash of unstyled content for JavaScript-rendered parts. Tailwind handles page layout; the rendered components use their own classes.

## Accessibility

- Semantic landmarks, a skip link, and visible keyboard focus.
- The timeline row for the current block is marked with `aria-current`.
- A screen-reader status message updates only when the current block changes, not every minute.
- Expandable details use native `<details>` elements.
- Day pills expose their pressed state and mark today.

## Behaviour to know about

- **Gaps:** times not covered by any block appear as "Between blocks" with a countdown to the next one.
- **Overnight:** between midnight and 7:00 AM the current block is Sleep, and the Sleep row appears in the timeline only while it applies.
- **Midnight rollover:** after the last block of the day, Next shows the first waking block of tomorrow.
- **Saturday:** the day has no clock times, so it never shows a countdown. Next points to Sunday's morning routine.
- **Theme storage:** the theme preference uses `localStorage`. If storage is blocked, the theme still works but won't persist.

## Browser support

Any current evergreen browser (Chrome, Edge, Firefox, Safari). The header uses `color-mix()` and `backdrop-filter`, and falls back to a solid background where they are unsupported.

## Scope

Deliberately not included: task management, progress tracking, notes, accounts, analytics, drag-and-drop, or any editing UI. To change the routine, edit `js/routine-data.js`.
