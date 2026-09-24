/* ==========================================================================
   Routine data
   Everything the site displays lives in this file; app.js only renders it.

   - Times are 24-hour "HH:MM" strings. "24:00" means midnight.
   - Add or edit a block and the timeline, Now/Next cards and rules update.
   - Loaded as a classic script (no modules) so the site also works when
     opened straight from disk.
   ========================================================================== */

/**
 * @typedef {Object} DetailPart
 * @property {'text'|'chips'|'flow'|'ritual'|'sequence'} kind
 * @property {string} [label]      Small heading above the content.
 * @property {string} [text]       For kind "text".
 * @property {string[]} [items]    For kinds "chips" and "flow".
 * @property {Array<{key: string, question: string, example: string}>
 *           | Array<{label: string, text?: string, isBreak?: boolean}>} [steps]
 *           Kind "ritual" uses key/question/example; kind "sequence" uses label/text/isBreak.
 *
 * @typedef {Object} Block
 * @property {string} id
 * @property {string} start              "HH:MM"
 * @property {string} end                "HH:MM"
 * @property {string} title
 * @property {string} description
 * @property {string} category           Key of CATEGORIES.
 * @property {string} [startLabel]       Display override, e.g. "8:30/9:00 PM".
 * @property {string} [endLabel]         Display override for the end time.
 * @property {boolean} [openEnded]      No fixed end: hides the "time left" countdown.
 * @property {string} [rangeLabel]       Overrides the time range shown in the Now card.
 * @property {string} [rule]             Short rule, shown in Now card and rules list.
 * @property {boolean} [anchor]          Show in the Day modes summary.
 * @property {string} [anchorTitle]      Title to use in the Day modes summary.
 * @property {string} [group]            Groups consecutive blocks under one label.
 * @property {string} [moreLabel]        Label of the expandable details.
 * @property {boolean} [openByDefault]   Expand details in the timeline.
 * @property {DetailPart[]} [details]
 * @property {Object} [exercise]         Fields that replace the block on exercise days.
 */

const CATEGORIES = {
  work: { label: 'Work' },
  learning: { label: 'Learning' },
  project: { label: 'Project' },
  recovery: { label: 'Recovery' },
  exercise: { label: 'Exercise' },
  personal: { label: 'Personal' },
  sleep: { label: 'Sleep' },
};

const WAKE_TIME = '07:00';

/* Sleep appears twice: the tail of the evening and the overnight hours
   before the first block. Both share these fields. */
const sleepBlock = {
  title: 'Sleep',
  description: 'Rest until morning.',
  category: 'sleep',
  wake: WAKE_TIME,
  remainingSuffix: 'until wake-up',
};

const overnightSleep = {
  ...sleepBlock,
  id: 'overnight-sleep',
  start: '00:00',
  end: WAKE_TIME,
  startLabel: '12:00 AM',
  rangeLabel: 'Until 7:00 AM',
};

const morningBlock = {
  id: 'morning',
  start: '07:00',
  end: '07:35',
  title: 'Morning routine',
  description: 'Wake up, freshen up, eat, and get ready.',
  category: 'personal',
  rule: 'Keep the morning phone-free.',
  moreLabel: 'Morning steps',
  details: [
    {
      kind: 'chips',
      label: 'Steps',
      items: [
        'Wake up',
        '1-minute prayer in bed',
        'Brush teeth',
        'Washroom',
        'Shower / freshen up',
        'Breakfast',
        'Get ready',
      ],
    },
  ],
};

const routines = {
  /* ---------------------------------------------------------------- */
  normal: {
    key: 'normal',
    name: 'Sunday–Thursday',
    days: [0, 1, 2, 3, 4],
    exerciseDays: [1, 3], // Monday, Wednesday
    summary: 'The office day. TypeScript first, deep engineering at night.',
    blocks: [
      morningBlock,
      {
        id: 'leave',
        start: '07:35',
        end: '07:40',
        title: 'Leave for office',
        description: 'Head out.',
        category: 'work',
      },
      {
        id: 'typescript',
        start: '08:00',
        end: '09:00',
        title: 'TypeScript',
        description: 'Protected learning block.',
        category: 'learning',
        anchor: true,
        rule: 'If the day’s work finishes early, do not force extra study.',
        moreLabel: 'The learning system',
        details: [
          {
            kind: 'flow',
            label: 'System',
            items: ['Recall', 'Learn', 'Practice', 'Write code', 'Homework', 'Review'],
          },
          {
            kind: 'flow',
            label: 'Objective',
            items: ['Understand', 'Implement', 'Prove understanding'],
          },
        ],
      },
      {
        id: 'office-am',
        start: '09:00',
        end: '12:00',
        title: 'Office work',
        description: 'Normal responsibilities.',
        category: 'work',
        anchor: true,
        moreLabel: 'If free time appears',
        details: [
          {
            kind: 'chips',
            label: 'All optional',
            items: ['Light research', 'Documentation', 'Project planning', 'English', 'Career research'],
          },
        ],
      },
      {
        id: 'lunch',
        start: '12:00',
        end: '13:00',
        title: 'Lunch + proper break',
        description: 'Eat well and step away from work.',
        category: 'recovery',
        rule: 'No productivity pressure.',
      },
      {
        id: 'office-pm',
        start: '13:00',
        end: '16:00',
        title: 'Office work',
        description: 'Normal responsibilities, plus any available office time.',
        category: 'work',
        moreLabel: 'If work finishes early',
        details: [
          {
            kind: 'chips',
            label: 'All optional',
            items: ['Light professional development', 'Documentation', 'Research', 'Career preparation'],
          },
        ],
      },
      {
        id: 'arrive',
        start: '16:40',
        end: '17:00',
        title: 'Arrive home',
        description: 'Back home.',
        category: 'personal',
      },
      {
        id: 'meal',
        start: '17:00',
        end: '17:30',
        title: 'Freshen up + main meal',
        description: 'Wash up and have the main meal.',
        category: 'personal',
      },
      {
        id: 'relax',
        start: '17:30',
        end: '18:00',
        title: 'Relaxation',
        description: 'Phone and downtime.',
        category: 'recovery',
        rule: 'No guilt.',
      },
      {
        /* Rest on normal days; replaced by `exercise` on Monday and Wednesday. */
        id: 'rest-or-exercise',
        start: '18:00',
        end: '19:00',
        title: 'Rest / sleep',
        description: 'Rest or sleep before the evening.',
        category: 'recovery',
        anchor: true,
        anchorTitle: 'Rest or exercise',
        exercise: {
          title: 'Exercise',
          description: 'About 1 hour. No more than 1 hour 30 minutes.',
          category: 'exercise',
          moreLabel: 'Exercise options',
          details: [
            {
              kind: 'chips',
              label: 'Can include',
              items: ['Walking', 'Running', 'Push-ups', 'Bodyweight exercises', 'Mobility / warm-up'],
            },
          ],
        },
      },
      {
        id: 'life',
        start: '19:00',
        end: '20:30',
        endLabel: '8:30/9:00 PM',
        title: 'Cooking + life',
        description: 'One flexible block for everything that keeps life running.',
        category: 'personal',
        moreLabel: 'What fits here',
        details: [
          {
            kind: 'chips',
            label: 'Could include',
            items: ['Cooking', 'Cleaning', 'Family time', 'English listening', 'Podcast', 'Occasional entertainment'],
          },
        ],
      },
      {
        id: 'deep',
        start: '20:30',
        end: '23:15',
        startLabel: '8:30/9:00 PM',
        title: 'Deep engineering',
        description: 'Project A: Source Info Discovery Engine.',
        category: 'project',
        anchor: true,
        rule: 'Project A comes first. No LinkedIn, random tutorials, Project B, or random coding.',
        moreLabel: 'How the block runs',
        details: [
          {
            kind: 'sequence',
            steps: [
              { label: 'Deep block 1', text: 'Project A' },
              { label: 'Short break', isBreak: true },
              { label: 'Deep block 2', text: 'Project A' },
              { label: 'Short break', isBreak: true },
              { label: 'Deep block 3', text: 'Project A, testing, debugging, or research' },
            ],
          },
        ],
      },
      {
        id: 'shutdown',
        start: '23:15',
        end: '23:30',
        title: 'Shutdown ritual',
        description: 'Close the day with four short answers.',
        category: 'project',
        anchor: true,
        openByDefault: true,
        moreLabel: 'The four prompts',
        details: [
          {
            kind: 'ritual',
            steps: [
              { key: 'Done', question: 'What did I complete?', example: 'Implemented source URL normalization.' },
              { key: 'Learned', question: 'What did I understand?', example: 'Better understanding of URL parsing.' },
              { key: 'Blocked', question: 'What problem remains?', example: 'Duplicate detection edge case.' },
              { key: 'Next', question: 'What is the first action tomorrow?', example: 'Write duplicate test cases.' },
            ],
          },
        ],
      },
      {
        id: 'bed',
        start: '23:30',
        end: '23:40',
        title: 'Bed',
        description: 'Protect tomorrow’s energy.',
        category: 'sleep',
        rule: 'No “one more feature.”',
      },
      {
        ...sleepBlock,
        id: 'sleep',
        start: '23:40',
        end: '24:00',
        endLabel: '7:00 AM',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  friday: {
    key: 'friday',
    name: 'Friday',
    days: [5],
    summary: 'Deep work in the morning, office from the afternoon.',
    blocks: [
      morningBlock,
      {
        id: 'fri-typescript',
        start: '08:00',
        end: '09:00',
        title: 'TypeScript / review',
        description: 'Protected learning block.',
        category: 'learning',
        anchor: true,
        group: 'Friday deep work, 8:00 AM to 12:00 PM',
      },
      {
        id: 'fri-a1',
        start: '09:00',
        end: '10:00',
        title: 'Project A',
        description: 'Source Info Discovery Engine.',
        category: 'project',
        anchor: true,
        group: 'Friday deep work, 8:00 AM to 12:00 PM',
      },
      {
        id: 'fri-break',
        start: '10:00',
        end: '10:15',
        title: 'Break',
        description: 'Step away from the screen.',
        category: 'recovery',
        group: 'Friday deep work, 8:00 AM to 12:00 PM',
      },
      {
        id: 'fri-a2',
        start: '10:15',
        end: '11:15',
        title: 'Project A',
        description: 'Source Info Discovery Engine.',
        category: 'project',
        group: 'Friday deep work, 8:00 AM to 12:00 PM',
      },
      {
        id: 'fri-a3',
        start: '11:15',
        end: '12:00',
        title: 'Project A / testing / documentation',
        description: 'Wrap up the morning with tests and notes.',
        category: 'project',
        group: 'Friday deep work, 8:00 AM to 12:00 PM',
      },
      {
        id: 'fri-lunch',
        start: '12:00',
        end: '14:00',
        title: 'Lunch + rest + prepare for office',
        description: 'Eat, rest, then get ready for the shift.',
        category: 'recovery',
        anchor: true,
        anchorTitle: 'Lunch and rest',
      },
      {
        id: 'fri-office',
        start: '15:00',
        end: '23:00',
        title: 'Office',
        description: 'Normal responsibilities.',
        category: 'work',
        anchor: true,
      },
      {
        id: 'fri-recovery',
        start: '23:00',
        end: '24:00',
        endLabel: 'bedtime',
        rangeLabel: 'After 11:00 PM',
        openEnded: true, // no fixed end, so no countdown
        title: 'Recovery',
        description: 'Wind down. The day’s work is done.',
        category: 'recovery',
        anchor: true,
        rule: 'Do not schedule project work after 11:00 PM.',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  saturday: {
    key: 'saturday',
    name: 'Saturday',
    days: [6],
    flexible: true, // no clock times: shown as a control center
    summary: 'The weekly control center. Review, plan, build, recover.',
    nowCard: {
      title: 'Weekly control center',
      description: 'Review the week, plan the next one, then give Project A its deep sessions.',
      categoryLabel: 'Flexible day',
      rule: 'Do not push Project A into a ten-hour session.',
      details: [
        {
          kind: 'flow',
          label: 'Suggested order',
          items: ['Weekly review', 'Weekly planning', 'Deep project work', 'Personal and recovery'],
        },
      ],
    },
    rules: [
      { text: 'Do not push Project A into a ten-hour session.', source: 'Deep project work' },
      { text: 'Exercise stays flexible. No rigid time.', source: 'Saturday' },
    ],
    sections: [
      {
        id: 'review',
        title: 'Weekly review',
        intro: 'Look back before planning forward.',
        prompts: [
          { label: 'Project', text: 'What actually changed?' },
          { label: 'TypeScript', text: 'What did I actually learn?' },
          { label: 'Career', text: 'Did I make meaningful career progress?' },
          { label: 'Health', text: 'Did I exercise?' },
          { label: 'Consistency', text: 'Did I maintain the system?' },
        ],
      },
      {
        id: 'planning',
        title: 'Weekly planning',
        intro: 'Example outcomes for the coming week.',
        prompts: [
          { label: 'TypeScript', text: 'Finish current topic + homework.' },
          { label: 'Project A', text: 'Complete source extraction module + tests.' },
          { label: 'Career', text: 'Research one remote-job topic.' },
          { label: 'Exercise', text: 'Monday + Wednesday + Saturday.' },
        ],
      },
      {
        id: 'deep',
        title: 'Saturday deep project work',
        intro: 'Priority: Project A.',
        details: [
          { kind: 'text', label: 'Shape', text: 'Several deep-work sessions with real breaks between them.' },
          { kind: 'chips', label: 'Separate sessions with', items: ['Meals', 'Walking', 'Exercise', 'Recovery'] },
        ],
      },
      {
        id: 'personal',
        title: 'Personal and recovery',
        intro: 'Rebuild energy for the week ahead.',
        details: [
          {
            kind: 'chips',
            items: ['Shopping', 'Cleaning', 'Exercise', 'Proper meals', 'Personal time', 'Planning', 'Rest'],
          },
        ],
      },
    ],
  },
};

/* Weekly priority tiers: the hierarchy is the message. */
const weeklyPriorities = [
  {
    tier: 1,
    name: 'Non-negotiable',
    note: 'These hold the week together.',
    items: [
      'Sleep',
      'Office',
      'TypeScript progression',
      'Project progression',
      'Exercise about 3×',
      'Weekly review / planning',
    ],
  },
  {
    tier: 2,
    name: 'Rotating',
    note: 'Give attention as the week allows.',
    items: [
      'Remote-job preparation',
      'English',
      'Technical research',
      'GitHub',
      'Portfolio',
      'LinkedIn',
      'Freelancing research',
    ],
  },
  {
    tier: 3,
    name: 'Optional',
    note: 'Only with energy to spare.',
    items: ['Extra tutorials', 'Entertainment', 'Additional research', 'Extra coding'],
  },
];

/* Exercise schedule. dayIndex: 0 = Sunday ... 6 = Saturday. */
const exerciseSchedule = [
  { dayIndex: 1, day: 'Monday', time: '6:00–7:00 PM' },
  { dayIndex: 3, day: 'Wednesday', time: '6:00–7:00 PM' },
  { dayIndex: 6, day: 'Saturday', time: 'Flexible' },
];

const meta = {
  title: 'Personal work & learning OS',
  mission:
    'Become a stronger software engineer by consistently learning TypeScript, building real production-grade projects, improving career readiness, maintaining physical health, and doing this sustainably.',
  path: [
    { name: 'TypeScript', note: '', status: 'Foundation', state: 'foundation' },
    { name: 'Project A', note: 'Source Info Discovery Engine', status: 'Active', state: 'active' },
    { name: 'Project B', note: 'News Scraper & Aggregator', status: 'Next', state: 'next' },
    { name: 'Project C', note: 'Personal Workflow Desk', status: 'Later', state: 'later' },
  ],
};
