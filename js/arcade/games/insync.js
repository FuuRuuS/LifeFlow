/**
 * LifeFlow Arcade — In Sync.
 * "Would you rather…" for two. Both answer in secret, then reveal — how often do you match?
 * Co-operative: you play together against the questions.
 */
import { makePairGame } from './pairs.js';

const BANK = {
  couple: {
    label: 'Us two', emoji: '💞',
    items: [
      ['A cosy night in', 'A night out in town'],
      ['Breakfast in bed', 'Dinner under the stars'],
      ['A beach holiday', 'A mountain cabin'],
      ['Handwritten love notes', 'Surprise gifts'],
      ['Dance in the kitchen', 'Sing together in the car'],
      ['Plan every detail of a trip', 'Book a flight and improvise'],
      ['A film marathon', 'A board-game night'],
      ['Cook together', 'Order our favourite takeaway'],
      ['Matching pyjamas', 'Matching mugs'],
      ['Hear "I love you" every day', 'Feel it without words'],
      ['A sunrise walk', 'A sunset picnic'],
      ['A cosy flat in the city', 'A big house in the countryside'],
      ['Relive our first date', 'Fast-forward to our dream trip'],
      ['Cuddle on the sofa', 'Cuddle under the stars'],
      ['Matching tattoos', 'Matching rings'],
      ['Long voice notes', 'Long phone calls'],
      ['A surprise party', 'A surprise trip'],
      ['Say sorry first', 'Get the first hug'],
      ['Read each other\u2019s minds', 'Read each other\u2019s messages'],
      ['Our song on repeat', 'A new song every week'],
      ['Pyjamas all Sunday', 'Brunch out every Sunday'],
      ['A small wedding', 'A huge party'],
      ['Grow old in our hometown', 'Grow old somewhere new'],
      ['A love letter every year', 'A photo album every year'],
      ['Share one dessert', 'Each get our own'],
      ['Be the big spoon', 'Be the little spoon'],
      ['Plan date night', 'Be surprised by date night']
    ]
  },
  romance: {
    label: 'Romance', emoji: '🌹',
    items: [
      ['Candlelit dinner at home', 'Rooftop dinner in town'],
      ['A slow dance', 'Stargazing on a blanket'],
      ['Love notes in a pocket', 'Love notes on the mirror'],
      ['A kiss in the rain', 'A kiss at sunset'],
      ['Hold hands everywhere', 'Steal glances across the room'],
      ['Remember every date', 'Recreate every date'],
      ['A weekend away, phones off', 'A week at home, just us'],
      ['Write our love story', 'Film our love story'],
      ['Morning cuddles', 'Late-night talks'],
      ['Flowers for no reason', 'Breakfast in bed for no reason'],
      ['A forehead kiss', 'A long hug from behind'],
      ['Fall in love again every year', 'Stay in love exactly like now'],
      ['A serenade', 'A love poem'],
      ['A picnic by the sea', 'A cabin by the fire']
    ]
  },
  spicy: {
    label: 'Spicy 18+', emoji: '🔥',
    items: [
      ['Kiss slowly', 'Kiss like it is the last time'],
      ['Lights on', 'Candles only'],
      ['Make the first move', 'Be seduced'],
      ['A steamy slow dance', 'A pillow fight that gets out of hand'],
      ['Whisper something naughty', 'Text something naughty'],
      ['A surprise outfit', 'A surprise massage'],
      ['Lingering eye contact across a room', 'A secret touch under the table'],
      ['Kisses on the neck', 'Kisses everywhere but the lips'],
      ['Be teased all evening', 'Do all the teasing'],
      ['A hotel night for no reason', 'Turn the bedroom into a hotel suite'],
      ['Flirt shamelessly in public', 'Save it all for later'],
      ['A long massage with warm oil', 'A long bath together'],
      ['A blindfolded kiss', 'Be the one holding the blindfold'],
      ['Morning romance', 'Midnight romance'],
      ['Dress up for each other', 'Dress down for each other'],
      ['A naughty dare game', 'A slow, sultry evening'],
      ['Be in charge tonight', 'Let them be in charge tonight'],
      ['A spicy photo just for them', 'A spicy voice note just for them'],
      ['Wake them up with kisses', 'Keep them up with kisses'],
      ['Role-play strangers at a bar', 'Role-play a first date all over again']
    ]
  },
  life: {
    label: 'Life together', emoji: '🏡',
    items: [
      ['Wake up early together', 'Sleep in together'],
      ['One shared account', 'Separate accounts'],
      ['A dog', 'A cat'],
      ['Cook every night', 'Meal-prep on Sundays'],
      ['Big family gatherings', 'Quiet holidays for two'],
      ['Save for a house', 'Save for travel'],
      ['Tidy as you go', 'A big clean once a week'],
      ['City life', 'Village life'],
      ['Plan the budget', 'Plan the fun'],
      ['Minimal decor', 'Cosy, full-of-things decor'],
      ['Celebrate every small win', 'Save it for the big moments'],
      ['A series in bed', 'Talks in bed'],
      ['Same side of the bed forever', 'Swap sides whenever'],
      ['Kids early', 'Kids later (or never)']
    ]
  },
  friends: {
    label: 'Friends', emoji: '🤝',
    items: [
      ['A road trip', 'A weekend in a big city'],
      ['Karaoke night', 'An escape room'],
      ['A group chat that never sleeps', 'Calls only when it matters'],
      ['Host the party', 'Be the guest'],
      ['Camping under the stars', 'A five-star hotel'],
      ['Pizza night', 'A barbecue'],
      ['Plan the trip', 'Just show up'],
      ['Always 10 minutes early', 'Always 10 minutes late'],
      ['Be the funny friend', 'Be the wise friend'],
      ['A big birthday party', 'A tiny dinner with close friends'],
      ['Win a quiz night', 'Win a dance-off'],
      ['A spontaneous trip tonight', 'A perfectly planned trip next month'],
      ['Always pick the restaurant', 'Never have to pick'],
      ['Lose your phone for a week', 'Lose your voice for a week'],
      ['A brutally honest friend', 'An always-supportive friend'],
      ['Game night', 'Movie night'],
      ['Live with your best friend', 'Live next door to them'],
      ['Be the DJ', 'Be the photographer'],
      ['Laugh until you cry', 'Talk until sunrise'],
      ['A theme park', 'A water park'],
      ['Share every secret', 'Keep a little mystery']
    ]
  },
  fun: {
    label: 'Silly', emoji: '😂',
    items: [
      ['Fly', 'Be invisible'],
      ['Talk to animals', 'Speak every human language'],
      ['Give up social media', 'Give up films and series'],
      ['Have a rewind button', 'Have a pause button'],
      ['Sing instead of speaking', 'Dance whenever you walk'],
      ['Be a famous singer', 'Be a famous chef'],
      ['Fight one horse-sized duck', 'Fight a hundred duck-sized horses'],
      ['Live in a treehouse', 'Live on a houseboat'],
      ['Teleport anywhere', 'Read minds'],
      ['Unlimited pizza for life', 'Unlimited ice cream for life'],
      ['Always have to whisper', 'Always have to shout'],
      ['Have a pet dragon', 'Have a pet unicorn'],
      ['Only eat with chopsticks', 'Only eat with a spoon'],
      ['Be a famous YouTuber', 'Be a secret millionaire'],
      ['Have a personal chef', 'Have a personal driver'],
      ['Be stuck in a lift with your boss', 'Be stuck in a lift with your ex'],
      ['Live without music', 'Live without films'],
      ['Subtitles for people\u2019s thoughts', 'A rewind button for conversations'],
      ['Be the funniest in the room', 'Be the smartest in the room'],
      ['Snore like a tractor', 'Talk in your sleep'],
      ['Wear pyjamas everywhere', 'Wear a suit everywhere'],
      ['Sneeze glitter', 'Hiccup bubbles'],
      ['Live in the past', 'Live in the future']
    ]
  },
  deep: {
    label: 'Deep', emoji: '🌙',
    items: [
      ['Know every big change before it happens', 'Be surprised by all of them'],
      ['Relive your best day', 'Erase your worst day'],
      ['Be liked by many', 'Be deeply loved by a few'],
      ['Have more time', 'Have more money'],
      ['Follow your heart', 'Follow your head'],
      ['Know a painful truth', 'Keep a kind illusion'],
      ['A quiet, peaceful life', 'An exciting, unpredictable life'],
      ['Change one thing in the past', 'See one thing in the future'],
      ['Be remembered for ever', 'Be happy and forgotten'],
      ['Live by the sea', 'Live in the mountains'],
      ['Always say what you think', 'Never say anything you regret'],
      ['Be brave', 'Be wise'],
      ['Forgive easily', 'Never forget'],
      ['A big love that ends', 'A calm love that lasts'],
      ['Know all the answers', 'Ask all the right questions'],
      ['Be fearless', 'Be at peace'],
      ['A life of comfort', 'A life of meaning'],
      ['Start over somewhere new', 'Grow where you are planted'],
      ['Be understood', 'Be admired'],
      ['Give advice', 'Receive advice']
    ]
  },
  travel: {
    label: 'Travel', emoji: '✈️',
    items: [
      ['Tokyo', 'New York'],
      ['A safari in Africa', 'Northern lights in Norway'],
      ['Backpacking', 'A luxury resort'],
      ['A train across Europe', 'A road trip across America'],
      ['A night in the desert', 'A tropical island'],
      ['Window seat', 'Aisle seat'],
      ['Museums and history', 'Street food and markets'],
      ['Travel solo', 'Travel with a group'],
      ['The riads of Marrakech', 'The bazaars of Istanbul'],
      ['A ski holiday', 'A beach holiday'],
      ['A cruise', 'A road trip'],
      ['Paris', 'Rome'],
      ['Bali', 'Santorini'],
      ['A hidden village', 'A famous landmark'],
      ['A treehouse hotel', 'An ice hotel'],
      ['A hot-air balloon ride', 'Diving with turtles'],
      ['Pack light', 'Pack for every possibility'],
      ['The blue streets of Chefchaouen', 'The rose city of Petra'],
      ['Andalusia', 'Cappadocia'],
      ['A long weekend every month', 'One huge trip a year']
    ]
  },
  food: {
    label: 'Food', emoji: '🍕',
    items: [
      ['Sweet', 'Salty'],
      ['Pizza', 'Burger'],
      ['Tea', 'Coffee'],
      ['Couscous Friday', 'Pasta night'],
      ['Chocolate', 'Fresh fruit'],
      ['Spicy', 'Mild'],
      ['A big breakfast', 'A big dinner'],
      ['Home cooking', 'A restaurant'],
      ['Pancakes', 'Waffles'],
      ['Sushi', 'Tajine'],
      ['Ice cream', 'Cake'],
      ['Cook it', 'Just eat it'],
      ['Crêpes', 'Msemen'],
      ['Street food', 'Fine dining'],
      ['Breakfast for dinner', 'Dinner for breakfast'],
      ['Chocolate cake', 'Cheesecake'],
      ['Crispy fries', 'Creamy mash'],
      ['Cook for a crowd', 'Cook for two'],
      ['Harissa on everything', 'No sauce at all'],
      ['Feed each other', 'Fight over the last bite']
    ]
  }
};

const VERDICTS = [
  [9, 'practically one mind 💞'],
  [7, 'beautifully in tune'],
  [5, 'pretty close'],
  [3, 'opposites attract'],
  [0, 'full of surprises']
];

const G = makePairGame({
  bank: BANK,
  mode: 'match',
  rounds: 10,
  cats: ['couple', 'fun', 'food'],
  options: (it) => it,
  ask: () => ({ eyebrow: 'Would you rather…', text: '' }),
  hitLine: () => 'In sync! 💞',
  missLine: () => 'Different picks — tell each other why.',
  verdict: (hits, total) => (VERDICTS.find(([n]) => hits >= Math.round((n * total) / 10)) || VERDICTS[VERDICTS.length - 1])[1]
});

export const meta = {
  id: 'insync',
  group: ['couple', 'friends'],
  title: 'In Sync',
  emoji: '💞',
  tagline: 'Would you rather… and do you match?',
  blurb: 'Two answers, chosen in secret, revealed together. Nine decks from cosy to silly to spicy — find out how in tune you really are.',
  minutes: '8 min',
  tags: ['Couples', 'Co-op', '9 decks'],
  local: true,
  alternate: true,
  levels: [],
  settings: [
    {
      id: 'rounds', label: 'Questions per game', def: 10,
      options: [{ v: 5, label: '5' }, { v: 10, label: '10' }, { v: 15, label: '15' }, { v: 20, label: '20' }, { v: 30, label: '30' }]
    }
  ],
  rules: [
    'Each round brings a "would you rather" with two choices.',
    'You both answer in secret — on one phone, hand it over when asked.',
    'Then the reveal: every match is a point for the two of you.',
    'Mix the decks with the chips at the top. Spicy 18+ is for grown-up couples.',
    'Change the number of questions in Settings.'
  ]
};

export function create(opts) { return G.create(opts); }
export function turn(state) { return G.turn(state); }
export function apply(state, move) { return G.apply(state, move); }
export function outcome(state) { return G.outcome(state); }
export function auto() { return null; }
export function ai() { return null; }
export function note(state, seat) { return G.note(state, seat); }
export function summary(state) { return G.summary(state); }
export function view(state, ctx) { return G.view(state, ctx); }
export function bind(root, state, ctx, play) { return G.bind(root, state, ctx, play); }
export function coach(state, ctx) { return G.coach(state, ctx); }
