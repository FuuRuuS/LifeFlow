/**
 * LifeFlow Arcade — Quiz Duel.
 * Ten questions, ten categories. Both players answer the same question in turn —
 * the second never sees it until it is theirs. Right answers score 10, plus up to 10 for speed.
 */
import { esc, rand, shuffle, draw, catChips, bindCats, validCats, beads, burst } from './kit.js';

const TOTAL = 10;
const LIMIT = 20000;

/** Settings travel inside the state so both players share them. */
const totalOf = (s) => s.total || TOTAL;
const limitOf = (s) => (s.limit === 0 ? 0 : s.limit || LIMIT);
const clockOf = (s) => limitOf(s) || 60000;

/** Each item: [question, [correct, wrong, wrong, wrong]]. */
const BANK = {
  geo: {
    label: 'Geography', emoji: '🌍',
    items: [
      ['What is the capital of Australia?', ['Canberra', 'Sydney', 'Melbourne', 'Perth']],
      ['Which is the longest river in Africa?', ['The Nile', 'The Congo', 'The Niger', 'The Zambezi']],
      ['What is the largest ocean on Earth?', ['Pacific', 'Atlantic', 'Indian', 'Arctic']],
      ['What is the largest hot desert in the world?', ['Sahara', 'Gobi', 'Kalahari', 'Atacama']],
      ['What is the capital of Canada?', ['Ottawa', 'Toronto', 'Vancouver', 'Montreal']],
      ['What is the capital of Morocco?', ['Rabat', 'Casablanca', 'Marrakech', 'Fes']],
      ['Which country is shaped like a boot?', ['Italy', 'Greece', 'Portugal', 'Chile']],
      ['Which strait separates Spain from Morocco?', ['Gibraltar', 'Bosphorus', 'Hormuz', 'Magellan']],
      ['What is the smallest country in the world?', ['Vatican City', 'Monaco', 'San Marino', 'Malta']],
      ['Mount Everest lies on the border of Nepal and…', ['China', 'India', 'Bhutan', 'Pakistan']],
      ['Which mountain range runs through Morocco?', ['The Atlas', 'The Andes', 'The Alps', 'The Urals']]
    ]
  },
  science: {
    label: 'Science', emoji: '🔬',
    items: [
      ['Which gas do plants absorb from the air?', ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium']],
      ['Which planet is known as the Red Planet?', ['Mars', 'Venus', 'Jupiter', 'Mercury']],
      ['How many bones are in the adult human body?', ['206', '201', '212', '186']],
      ['What is the hardest natural substance?', ['Diamond', 'Gold', 'Iron', 'Quartz']],
      ['What is the closest star to Earth?', ['The Sun', 'Proxima Centauri', 'Sirius', 'Polaris']],
      ['Light travels at roughly…', ['300,000 km/s', '30,000 km/s', '3,000 km/s', '3 million km/s']],
      ['What is the chemical symbol for gold?', ['Au', 'Ag', 'Gd', 'Go']],
      ['Which organ pumps blood around the body?', ['The heart', 'The liver', 'The lungs', 'The kidneys']],
      ['What is the largest planet in our solar system?', ['Jupiter', 'Saturn', 'Neptune', 'Earth']],
      ['At sea level, water boils at…', ['100 °C', '90 °C', '110 °C', '120 °C']],
      ['What do we call H₂O?', ['Water', 'Salt', 'Hydrogen peroxide', 'Ammonia']]
    ]
  },
  history: {
    label: 'History', emoji: '🏛️',
    items: [
      ['In which year did humans first land on the Moon?', ['1969', '1965', '1972', '1959']],
      ['Who was the first person in space?', ['Yuri Gagarin', 'Neil Armstrong', 'Alan Shepard', 'John Glenn']],
      ['Which ancient wonder still stands today?', ['The Great Pyramid of Giza', 'The Colossus of Rhodes', 'The Hanging Gardens of Babylon', 'The Lighthouse of Alexandria']],
      ['In which year did the Berlin Wall fall?', ['1989', '1991', '1979', '1985']],
      ['Which civilisation built Machu Picchu?', ['The Inca', 'The Aztecs', 'The Maya', 'The Olmecs']],
      ['In which year did the Titanic sink?', ['1912', '1905', '1920', '1898']],
      ['Who was the first emperor of Rome?', ['Augustus', 'Julius Caesar', 'Nero', 'Constantine']],
      ['In which year did World War II end?', ['1945', '1944', '1946', '1939']],
      ['In which city did Fatima al-Fihri found al-Qarawiyyin?', ['Fes', 'Cairo', 'Baghdad', 'Córdoba']],
      ['Who was the first person to walk on the Moon?', ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins']]
    ]
  },
  arts: {
    label: 'Arts & books', emoji: '🎨',
    items: [
      ['Who painted the Mona Lisa?', ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Picasso']],
      ['Who wrote "Romeo and Juliet"?', ['William Shakespeare', 'Charles Dickens', 'Victor Hugo', 'Molière']],
      ['Who wrote "Les Misérables"?', ['Victor Hugo', 'Alexandre Dumas', 'Émile Zola', 'Gustave Flaubert']],
      ['Who painted "The Starry Night"?', ['Vincent van Gogh', 'Edvard Munch', 'Henri Matisse', 'Rembrandt']],
      ['How many keys does a standard piano have?', ['88', '76', '92', '64']],
      ['In which city is the Louvre museum?', ['Paris', 'Rome', 'London', 'Madrid']],
      ['Who sculpted the famous "David" in Florence?', ['Michelangelo', 'Donatello', 'Bernini', 'Rodin']],
      ['Who wrote "The Little Prince"?', ['Antoine de Saint-Exupéry', 'Jules Verne', 'Albert Camus', 'Victor Hugo']],
      ['Which language has the most native speakers?', ['Mandarin Chinese', 'English', 'Spanish', 'Hindi']],
      ['How many strings does a classical guitar usually have?', ['6', '4', '5', '8']]
    ]
  },
  sport: {
    label: 'Sport', emoji: '⚽',
    items: [
      ['How many players does a football team have on the pitch?', ['11', '10', '9', '12']],
      ['How often are the Summer Olympics held?', ['Every 4 years', 'Every 2 years', 'Every 3 years', 'Every 5 years']],
      ['Which country won the first FIFA World Cup in 1930?', ['Uruguay', 'Brazil', 'Argentina', 'Italy']],
      ['In tennis, what is a score of zero called?', ['Love', 'Nil', 'Zero', 'Duck']],
      ['How long is a marathon?', ['42.195 km', '40 km', '45 km', '38.5 km']],
      ['Which sport uses a shuttlecock?', ['Badminton', 'Squash', 'Tennis', 'Table tennis']],
      ['How many rings are on the Olympic flag?', ['5', '4', '6', '7']],
      ['In which sport would you perform a slam dunk?', ['Basketball', 'Volleyball', 'Handball', 'Rugby']],
      ['Which country hosted the 2022 FIFA World Cup?', ['Qatar', 'Russia', 'Brazil', 'Morocco']],
      ['How far did Morocco go at the 2022 World Cup?', ['Semi-finals', 'Quarter-finals', 'The final', 'Round of 16']]
    ]
  },
  screen: {
    label: 'Film & music', emoji: '🎬',
    items: [
      ['Which film features the line "I\u2019ll be back"?', ['The Terminator', 'Rocky', 'Die Hard', 'Predator']],
      ['Who is the young lion hero of "The Lion King"?', ['Simba', 'Mufasa', 'Nala', 'Scar']],
      ['Which band recorded "Bohemian Rhapsody"?', ['Queen', 'The Beatles', 'ABBA', 'The Rolling Stones']],
      ['"Thriller" is a famous album by…', ['Michael Jackson', 'Prince', 'Madonna', 'Stevie Wonder']],
      ['Which school does Harry Potter attend?', ['Hogwarts', 'Durmstrang', 'Beauxbatons', 'Ilvermorny']],
      ['Which film won the first Oscar for Best Animated Feature?', ['Shrek', 'Toy Story', 'Finding Nemo', 'Monsters, Inc.']],
      ['Beethoven kept composing despite losing his…', ['Hearing', 'Sight', 'Sense of smell', 'Voice']],
      ['What is the snowman called in "Frozen"?', ['Olaf', 'Sven', 'Kristoff', 'Hans']],
      ['Who directed "Jurassic Park"?', ['Steven Spielberg', 'James Cameron', 'George Lucas', 'Ridley Scott']],
      ['How many strings does a violin have?', ['4', '5', '6', '3']],
      ['Who sang "Rolling in the Deep"?', ['Adele', 'Beyoncé', 'Rihanna', 'Shakira']]
    ]
  },
  nature: {
    label: 'Animals & nature', emoji: '🐾',
    items: [
      ['What is the fastest land animal?', ['Cheetah', 'Lion', 'Pronghorn', 'Horse']],
      ['What is the largest animal that has ever lived?', ['Blue whale', 'African elephant', 'Giraffe', 'Sperm whale']],
      ['How many legs does a spider have?', ['8', '6', '10', '12']],
      ['Which animal is called the "ship of the desert"?', ['The camel', 'The horse', 'The donkey', 'The elephant']],
      ['How many hearts does an octopus have?', ['3', '1', '2', '4']],
      ['What is a baby kangaroo called?', ['A joey', 'A kit', 'A cub', 'A calf']],
      ['Which tree grows acorns?', ['Oak', 'Pine', 'Maple', 'Olive']],
      ['What is the tallest animal?', ['Giraffe', 'Elephant', 'Camel', 'Ostrich']],
      ['What do bees make from nectar?', ['Honey', 'Silk', 'Pollen', 'Resin']],
      ['What does a caterpillar become?', ['A butterfly or moth', 'A beetle', 'A bee', 'A dragonfly']]
    ]
  },
  food: {
    label: 'Food', emoji: '🍜',
    items: [
      ['Which country does sushi come from?', ['Japan', 'China', 'Korea', 'Thailand']],
      ['The tajine is named after…', ['The clay pot it cooks in', 'A spice', 'A city', 'A famous chef']],
      ['Guacamole is mainly made from…', ['Avocado', 'Peas', 'Cucumber', 'Lime']],
      ['Which spice is the most expensive by weight?', ['Saffron', 'Turmeric', 'Cumin', 'Paprika']],
      ['Hummus is made mainly from…', ['Chickpeas', 'Lentils', 'White beans', 'Peas']],
      ['Raisins are dried…', ['Grapes', 'Plums', 'Figs', 'Dates']],
      ['Pizza Margherita is linked to which Italian city?', ['Naples', 'Rome', 'Milan', 'Venice']],
      ['Marzipan is made from which nut?', ['Almond', 'Walnut', 'Peanut', 'Hazelnut']],
      ['Pad thai comes from…', ['Thailand', 'Vietnam', 'Japan', 'India']],
      ['Tofu is made from…', ['Soybeans', 'Rice', 'Wheat', 'Chickpeas']]
    ]
  },
  tech: {
    label: 'Tech', emoji: '💻',
    items: [
      ['What does "www" stand for?', ['World Wide Web', 'World Web Wide', 'Wide World Web', 'Web World Wide']],
      ['Who co-founded Microsoft with Paul Allen?', ['Bill Gates', 'Steve Jobs', 'Larry Page', 'Mark Zuckerberg']],
      ['What does "CPU" stand for?', ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Power Unit']],
      ['Which company makes the iPhone?', ['Apple', 'Samsung', 'Google', 'Nokia']],
      ['How many bits are in a byte?', ['8', '4', '16', '10']],
      ['What does "AI" stand for?', ['Artificial intelligence', 'Automated internet', 'Advanced interface', 'Analog input']],
      ['Which language styles web pages?', ['CSS', 'SQL', 'Python', 'C']],
      ['What does "USB" stand for?', ['Universal Serial Bus', 'United System Board', 'Universal Signal Box', 'User Service Bridge']],
      ['How is the number 2 written in binary?', ['10', '2', '11', '01']],
      ['Which symbol starts a hashtag?', ['#', '@', '&', '*']]
    ]
  },
  islam: {
    label: 'Islamic culture', emoji: '🕌',
    items: [
      ['How many surahs are in the Qur\u2019an?', ['114', '110', '120', '99']],
      ['What was the first word revealed to the Prophet ﷺ?', ['Iqra (Read)', 'Bismillah', 'Alhamdulillah', 'Qul (Say)']],
      ['Which is the longest surah of the Qur\u2019an?', ['Al-Baqarah', 'Al-Imran', 'An-Nisa', 'Al-Kahf']],
      ['In which month do Muslims fast?', ['Ramadan', 'Shawwal', 'Muharram', 'Rajab']],
      ['How many pillars of Islam are there?', ['5', '4', '6', '7']],
      ['In which city is the Kaaba?', ['Mecca', 'Medina', 'Jerusalem', 'Taif']],
      ['What is the opening surah of the Qur\u2019an?', ['Al-Fatiha', 'Al-Baqarah', 'Al-Ikhlas', 'An-Nas']],
      ['The Hijra was the migration from Mecca to…', ['Medina', 'Taif', 'Jerusalem', 'Abyssinia']],
      ['How many daily prayers are prescribed?', ['5', '3', '4', '6']],
      ['Which night is "better than a thousand months"?', ['Laylat al-Qadr', 'Laylat al-Isra', 'The night of Eid', 'The first night of Muharram']],
      ['Which is the shortest surah of the Qur\u2019an?', ['Al-Kawthar', 'Al-Ikhlas', 'An-Nas', 'Al-Asr']]
    ]
  }
};

const ACCURACY = { gentle: 0.45, even: 0.65, sharp: 0.85 };

export const meta = {
  id: 'quiz',
  group: ['brain', 'friends'],
  title: 'Quiz Duel',
  emoji: '🧠',
  tagline: 'Same question, two minds, one clock.',
  blurb: 'Ten categories from geography to film to Islamic culture. Answer right for 10 points and fast for up to 10 more — the other player never sees the question early.',
  minutes: '6 min',
  tags: ['Trivia', '10 categories'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Knows a bit, takes its time.' },
    { id: 'even', label: 'Even', hint: 'A solid pub-quiz regular.' },
    { id: 'sharp', label: 'Sharp', hint: 'Knows nearly everything — and fast.' }
  ],
  settings: [
    {
      id: 'total', label: 'Questions', def: 10,
      options: [{ v: 5, label: '5' }, { v: 10, label: '10' }, { v: 15, label: '15' }, { v: 20, label: '20' }, { v: 30, label: '30' }]
    },
    {
      id: 'limit', label: 'Time per question', def: 20000,
      options: [{ v: 10000, label: '10 s' }, { v: 20000, label: '20 s' }, { v: 30000, label: '30 s' }, { v: 0, label: 'Relaxed' }]
    },
    {
      id: 'speed', label: 'Speed bonus', def: 1,
      options: [{ v: 1, label: 'On' }, { v: 0, label: 'Off' }]
    }
  ],
  rules: [
    'Both players answer every question, taking turns to go first.',
    'The second player only sees the question when it is their turn.',
    'A right answer scores 10, plus up to 10 for speed.',
    'Three right in a row earns a 5-point streak bonus.',
    'Settings: number of questions, time per question (or relaxed), speed bonus.'
  ]
};

const pick = (v, allowed, def) => (allowed.includes(v) ? v : def);

function deal(state, cats) {
  const d = draw(BANK, cats, state.used);
  return { q: { c: d.c, i: d.i, o: shuffle([0, 1, 2, 3]) }, used: d.used };
}

export function create(opts = {}) {
  const cats = validCats(BANK, opts.cats) ? opts.cats.slice() : ['geo', 'science', 'screen', 'nature', 'food'];
  const base = {
    gid: Math.random().toString(36).slice(2, 9), phase: 'answer', round: 0, turn: 0, ans: [-2, -2], ms: [0, 0], gain: [0, 0], scores: [0, 0], streak: [0, 0], used: [], cats, moves: 0,
    total: pick(opts.total, [5, 10, 15, 20, 30], TOTAL),
    limit: pick(opts.limit, [10000, 20000, 30000, 0], LIMIT),
    speed: pick(opts.speed, [0, 1], 1)
  };
  return { ...base, ...deal(base, base.cats) };
}

export function turn(state) {
  if (state.phase === 'reveal') return 1 - state.turn;
  return state.ans[state.turn] === -2 ? state.turn : 1 - state.turn;
}

const untouched = (s) => s.phase === 'answer' && s.ans[0] === -2 && s.ans[1] === -2;
const item = (s) => BANK[s.q.c].items[s.q.i];

export function apply(state, move) {
  if (!move || outcome(state).over) return null;

  if (move.cats !== undefined) {
    if (!untouched(state) || !validCats(BANK, move.cats)) return null;
    return { ...state, cats: move.cats.slice(), ...deal(state, move.cats), moves: state.moves + 1 };
  }

  if (move.a !== undefined) {
    const a = move.a;
    if (state.phase !== 'answer' || !Number.isInteger(a) || a < -1 || a > 3) return null;
    const seat = turn(state);
    const ms = Math.max(0, Math.min(clockOf(state), Number(move.ms) || 0));
    const right = a >= 0 && state.q.o[a] === 0;
    const ans = state.ans.slice();
    const times = state.ms.slice();
    const gain = state.gain.slice();
    const scores = state.scores.slice();
    const streak = state.streak.slice();
    ans[seat] = a;
    times[seat] = ms;
    streak[seat] = right ? streak[seat] + 1 : 0;
    const fast = state.speed === 0 ? 0 : Math.round(10 * (1 - ms / clockOf(state)));
    gain[seat] = right ? 10 + fast + (streak[seat] >= 3 ? 5 : 0) : 0;
    scores[seat] += gain[seat];
    const both = ans[0] !== -2 && ans[1] !== -2;
    return { ...state, ans, ms: times, gain, scores, streak, phase: both ? 'reveal' : 'answer', moves: state.moves + 1 };
  }

  if (move.next) {
    if (state.phase !== 'reveal') return null;
    const round = state.round + 1;
    const base = { ...state, round, turn: 1 - state.turn, phase: 'answer', ans: [-2, -2], ms: [0, 0], gain: [0, 0], moves: state.moves + 1 };
    return round < totalOf(state) ? { ...base, ...deal(state, state.cats) } : base;
  }

  return null;
}

export function outcome(state) {
  if (state.round < totalOf(state)) return { over: false };
  const [a, b] = state.scores;
  if (a === b) return { over: true, winner: null, draw: true };
  return { over: true, winner: a > b ? 0 : 1, draw: false };
}

export function auto(state) {
  if (state.phase === 'reveal' && state.round < totalOf(state)) return { move: { next: true }, delay: 3600 };
  return null;
}

/** The computer "reads" for a moment before answering. */
export function pace(state) {
  return state.phase === 'answer' ? 1200 + Math.random() * 2400 : 0;
}

export function ai(state, seat, level = 'even') {
  if (state.phase !== 'answer') return null;
  const right = state.q.o.indexOf(0);
  const p = ACCURACY[level] ?? 0.65;
  const wrong = [0, 1, 2, 3].filter((k) => k !== right);
  const a = Math.random() < p ? right : wrong[rand(3)];
  const ms = (level === 'sharp' ? 2500 : 4000) + Math.random() * (level === 'gentle' ? 9000 : 6000);
  return { a, ms: Math.round(ms) };
}

export function note(state, seat) {
  const s = state.streak[seat];
  return `${state.scores[seat]} pts${s >= 2 ? ` · 🔥${s}` : ''}`;
}

/* ------------------------------ view ------------------------------ */
export function view(state, ctx) {
  const over = outcome(state).over;
  const n = (s) => ctx.names[s] || `Player ${s + 1}`;

  if (over) {
    const w = outcome(state).winner;
    return `
      <div class="quiz quiz--over">
        <div class="quiz__final">
          <span class="quiz__final-ico" aria-hidden="true">${w == null ? '🤝' : '🏆'}</span>
          <div class="quiz__podium">
            ${[0, 1].map((s) => `<div class="quiz__pod quiz__pod--${s}${w === s ? ' is-win' : ''}" style="--h:${Math.max(18, Math.round((state.scores[s] / Math.max(1, ...state.scores)) * 100))}%"><b>${state.scores[s]}</b><span>${esc(n(s))}</span></div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  const [question, opts] = item(state);
  const viewer = ctx.seat;
  const reveal = state.phase === 'reveal';
  const answered = state.ans[viewer] !== -2;
  const showQ = reveal || ctx.myTurn || answered;
  const right = state.q.o.indexOf(0);
  const cat = BANK[state.q.c];

  const optHtml = state.q.o
    .map((src, k) => {
      const cls = [];
      if (reveal && k === right) cls.push('is-right');
      if (reveal && k !== right && (state.ans[0] === k || state.ans[1] === k)) cls.push('is-wrong');
      if (!reveal && answered && state.ans[viewer] === k) cls.push('is-mine');
      const tags = reveal ? [0, 1].filter((s) => state.ans[s] === k).map((s) => `<span class="quiz__tag quiz__tag--${s}" title="${esc(n(s))}">${esc(n(s).slice(0, 1).toUpperCase())}</span>`).join('') : '';
      return `<button class="quiz__opt ${cls.join(' ')}" type="button" data-a="${k}" style="--k:${k}" ${ctx.myTurn && !reveal ? '' : 'disabled'}>
                <span class="quiz__key" aria-hidden="true">${'ABCD'[k]}</span><span class="quiz__label">${esc(opts[src])}</span>${tags}
              </button>`;
    })
    .join('');

  const gains = reveal
    ? `<div class="quiz__gains">${[0, 1]
        .map((s) => `<span class="quiz__gain quiz__gain--${s}${state.gain[s] ? '' : ' is-zero'}"><b>${state.gain[s] ? `+${state.gain[s]}` : state.ans[s] === -1 ? '⏱ 0' : '0'}</b> ${esc(n(s))}${state.gain[s] && state.streak[s] >= 3 ? ' 🔥' : ''}</span>`)
        .join('')}</div>`
    : '';

  let footer = '';
  if (reveal) footer = ctx.myTurn ? `<button class="btn btn--primary btn--sm" type="button" data-next>${state.round + 1 >= totalOf(state) ? 'Final score' : 'Next'} →</button>` : '';
  else if (!ctx.myTurn) footer = `<p class="quiz__wait">${answered ? `🔒 Locked in. ${esc(n(1 - viewer))} is answering…` : `🤫 ${esc(n(turn(state)))} is answering — your question is hidden.`}</p>`;

  return `
    <div class="quiz quiz--${state.phase}">
      ${catChips(BANK, state.cats, untouched(state) && ctx.myTurn)}
      ${beads(state.round, totalOf(state), state.round)}
      <div class="quiz__card" data-qkey="${state.gid}:${state.round}">
        <div class="quiz__meta"><span>${cat.emoji} ${esc(cat.label)}</span><span>Question ${state.round + 1} / ${totalOf(state)}</span></div>
        <h3 class="quiz__q${showQ ? '' : ' is-hidden'}">${showQ ? esc(question) : 'Hidden until it is your turn'}</h3>
        ${!reveal && ctx.myTurn && limitOf(state) ? `<div class="quiz__timer"><i data-timer></i><span data-secs>${limitOf(state) / 1000}</span></div>` : ''}
        <div class="quiz__opts${showQ ? '' : ' is-hidden'}">${optHtml}</div>
        ${gains}
      </div>
      ${footer}
    </div>`;
}

let ticker = null;
const starts = new Map();
const cheered = new Set();

export function bind(root, state, ctx, play) {
  clearInterval(ticker);
  ticker = null;
  bindCats(root, state.cats, play);
  root.querySelector('[data-next]')?.addEventListener('click', () => play({ next: true }));

  if (state.phase === 'reveal') {
    const key = `${state.gid}:${state.round}`;
    if (!cheered.has(key) && state.gain[ctx.seat] > 0) {
      cheered.add(key);
      burst(root.querySelector('.quiz__card'), ['✨', '⭐', '🧠'], 10);
    }
  }

  if (state.phase !== 'answer' || !ctx.myTurn) return;

  const key = `${state.gid}:${state.round}:${ctx.seat}`;
  if (!starts.has(key)) starts.set(key, Date.now());
  const t0 = starts.get(key);
  const bar = root.querySelector('[data-timer]');
  const secs = root.querySelector('[data-secs]');
  let sent = false;

  const send = (a) => {
    if (sent) return;
    sent = true;
    clearInterval(ticker);
    ticker = null;
    play({ a, ms: Math.min(clockOf(state), Date.now() - t0) });
  };

  root.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => send(Number(b.dataset.a))));

  const limit = limitOf(state);
  if (!limit) return;
  const step = () => {
    if (!root.isConnected) { clearInterval(ticker); ticker = null; return; }
    const left = Math.max(0, limit - (Date.now() - t0));
    if (bar) bar.style.transform = `scaleX(${left / limit})`;
    if (secs) secs.textContent = String(Math.ceil(left / 1000));
    root.querySelector('.quiz__timer')?.classList.toggle('is-low', left < 5000);
    if (left <= 0) send(-1);
  };
  step();
  ticker = setInterval(step, 100);
}

export function coach(state, ctx) {
  if (outcome(state).over) return 'Rematch with new categories — the deck never repeats until it runs out.';
  if (state.phase === 'reveal') return 'Next question in a moment…';
  return ctx.myTurn ? (state.speed === 0 ? 'Right answers score 10 — take your time.' : 'Right answers score 10, plus up to 10 for speed.') : 'Hold tight — no peeking.';
}
