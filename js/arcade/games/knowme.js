/**
 * LifeFlow Arcade — Know Me?
 * One answers a question about themselves in secret; the other guesses it.
 * Roles swap every round. Whoever reads the other best wins.
 */
import { makePairGame } from './pairs.js';

const BANK = {
  me: {
    label: 'Everyday me', emoji: '🙂',
    items: [
      ['Perfect weekend?', ['Lazy at home', 'Out in nature', 'With friends', 'Exploring a city']],
      ['Favourite season?', ['Spring', 'Summer', 'Autumn', 'Winter']],
      ['Morning or night?', ['Early bird', 'Night owl', 'Depends on the day', 'Always tired']],
      ['Biggest pet peeve?', ['Lateness', 'Loud chewing', 'Messy spaces', 'Slow walkers']],
      ['Dream pet?', ['A dog', 'A cat', 'A bird', 'No pets, thanks']],
      ['Superpower of choice?', ['Flying', 'Invisibility', 'Teleportation', 'Reading minds']],
      ['When stressed, I…', ['Sleep it off', 'Eat something nice', 'Talk it out', 'Go for a walk']],
      ['Best way to relax?', ['Music', 'A film or series', 'A long bath', 'Sport']],
      ['Phone battery usually at…', ['Above 80%', 'Around half', 'Living on 5%', 'Always charging']],
      ['Messy or tidy?', ['Spotless', 'Organised chaos', 'Tidy on the outside', 'Do not open that drawer']],
      ['First thing I do in the morning?', ['Check my phone', 'Coffee or tea', 'Snooze again', 'Shower']],
      ['How I spend a rainy day?', ['Under a blanket', 'Cleaning the house', 'Out anyway', 'Cooking something big']],
      ['My shopping style?', ['Plan and list', 'Impulse buys', 'Online only', 'Avoid it']],
      ['What drains my energy fastest?', ['Crowds', 'Boredom', 'Arguments', 'Bad sleep']],
      ['Favourite time of day?', ['Sunrise', 'Lunchtime', 'Golden hour', 'Midnight']],
      ['In a group I am usually…', ['The organiser', 'The joker', 'The listener', 'The one on the phone']],
      ['My guilty pleasure?', ['Reality TV', 'Junk food', 'Online shopping', 'Napping']],
      ['How I handle a bad day?', ['Music loud', 'Talk to someone', 'Stay quiet', 'Treat myself']]
    ]
  },
  food: {
    label: 'Food & taste', emoji: '🍜',
    items: [
      ['Comfort food?', ['Pizza', 'Couscous', 'Chocolate', 'Pasta']],
      ['Go-to drink?', ['Coffee', 'Mint tea', 'Juice', 'Water']],
      ['Snack mood?', ['Sweet', 'Salty', 'Both at once', 'Fruit, honestly']],
      ['Favourite cuisine?', ['Moroccan', 'Italian', 'Asian', 'Mexican']],
      ['Eggs, how?', ['Scrambled', 'Fried', 'Omelette', 'Boiled']],
      ['Dessert of choice?', ['Ice cream', 'Cake', 'Fruit salad', 'Pastries']],
      ['At a restaurant, what matters most?', ['The food', 'The view', 'The company', 'The price']],
      ['Spice level?', ['None, please', 'A little kick', 'Hot', 'Set my mouth on fire']],
      ['Breakfast of choice?', ['Msemen and honey', 'Eggs', 'Cereal', 'Just coffee']],
      ['Pizza topping?', ['Margherita', 'Tuna', 'Pepperoni', 'Everything']],
      ['Food I could eat every day?', ['Bread', 'Rice', 'Pasta', 'Chicken']],
      ['In the kitchen I am…', ['The chef', 'The helper', 'The taster', 'Banned']],
      ['Late-night craving?', ['Chocolate', 'Chips', 'Leftovers', 'Ice cream']],
      ['Fast-food order?', ['Burger', 'Tacos', 'Fried chicken', 'Never']]
    ]
  },
  love: {
    label: 'Love & us', emoji: '💞',
    items: [
      ['Love language?', ['Kind words', 'Quality time', 'Gifts', 'Acts of service']],
      ['Ideal date?', ['A fancy dinner', 'A picnic', 'The cinema', 'A long walk']],
      ['Most romantic gesture?', ['A handwritten letter', 'A surprise trip', 'Flowers', 'Cooking dinner']],
      ['How I show I care?', ['Little gifts', 'Helping out', 'Sweet words', 'Making time']],
      ['Perfect evening together?', ['Cooking together', 'Film night', 'Going out', 'Talking for hours']],
      ['After an argument I…', ['Need some space', 'Want to talk it out now', 'Make a joke', 'Apologise first']],
      ['Favourite kind of photo of us?', ['Silly selfies', 'Travel shots', 'Candid moments', 'We never take any']],
      ['Anniversary plan?', ['A trip away', 'A special dinner', 'A cosy day at home', 'A surprise']],
      ['What made me fall for you?', ['Your smile', 'Your humour', 'Your kindness', 'Your eyes']],
      ['Best compliment you can give me?', ['You look amazing', 'You are so smart', 'I am proud of you', 'You make me laugh']],
      ['When I miss you I…', ['Text you', 'Look at our photos', 'Call you', 'Pretend I am fine']],
      ['Our song is more…', ['A love ballad', 'A party song', 'A cheesy classic', 'We do not have one (yet)']],
      ['Jealous type?', ['Not at all', 'A tiny bit', 'Secretly yes', 'Very']],
      ['My favourite part of our routine?', ['Morning coffee', 'Dinner together', 'Bedtime talks', 'Weekend plans']],
      ['Biggest turn-off?', ['Rudeness', 'Being late', 'Bad hygiene', 'Phone at dinner']],
      ['How I want to be cheered up?', ['A hug', 'Food', 'Jokes', 'Space']]
    ]
  },
  spicy: {
    label: 'Spicy 18+', emoji: '🔥',
    items: [
      ['Where do I love being kissed most?', ['The lips', 'The neck', 'The forehead', 'Behind the ear']],
      ['My idea of a sexy evening?', ['Candles and music', 'A fancy night out', 'A hotel room', 'A surprise at home']],
      ['What gets me in the mood fastest?', ['Compliments', 'A massage', 'Teasing', 'A slow dance']],
      ['My most attractive feature, in my opinion?', ['My eyes', 'My smile', 'My body', 'My confidence']],
      ['What I notice first about you?', ['Your eyes', 'Your lips', 'Your scent', 'Your voice']],
      ['Flirting style?', ['Bold and direct', 'Shy and sweet', 'Teasing', 'All through texts']],
      ['Favourite kind of kiss?', ['Slow and soft', 'Passionate', 'Playful', 'Surprise kisses']],
      ['The outfit of yours I like best?', ['Dressed up', 'Comfy at home', 'Sporty', 'Just a shirt']],
      ['Who makes the first move more often?', ['Me', 'You', 'Fifty-fifty', 'Nobody — it just happens']],
      ['The most romantic place to be alone with you?', ['A beach at night', 'A cabin', 'A hotel suite', 'Our own bedroom']],
      ['A sweet secret fantasy?', ['A weekend away', 'A candlelit bath', 'Dancing in the dark', 'A surprise date']],
      ['Spicy texts are…', ['My thing', 'Fun sometimes', 'Too awkward', 'Better in person']],
      ['Morning or night for romance?', ['Morning', 'Afternoon', 'Late night', 'Any time']],
      ['What makes me blush the most?', ['Compliments', 'Your stare', 'Whispers', 'Teasing in public']]
    ]
  },
  past: {
    label: 'Memories', emoji: '📸',
    items: [
      ['As a kid I wanted to be…', ['An astronaut', 'A doctor', 'A footballer or athlete', 'A singer or actor']],
      ['At school I was…', ['The good student', 'The class clown', 'The quiet one', 'Always in trouble']],
      ['My first phone?', ['A Nokia', 'A flip phone', 'A smartphone', 'Do not remember']],
      ['Favourite childhood cartoon?', ['Tom & Jerry', 'Dragon Ball', 'Pokémon', 'The Simpsons']],
      ['Best school subject?', ['Maths', 'Languages', 'Sport', 'Art']],
      ['Childhood fear?', ['The dark', 'Dogs', 'Doctors', 'Being alone']],
      ['Best family holiday?', ['The beach', 'The countryside', 'Abroad', 'Staying at grandma’s']],
      ['First crush was on…', ['A classmate', 'A celebrity', 'A neighbour', 'A cartoon character']]
    ]
  },
  would: {
    label: 'What would I do?', emoji: '🤔',
    items: [
      ['I find a wallet full of cash. I…', ['Return it all', 'Hand it to the police', 'Keep a reward', 'Panic']],
      ['A spider in the room. I…', ['Kill it', 'Save it outside', 'Call for help', 'Move house']],
      ['Free afternoon, no plans. I…', ['Nap', 'Go out', 'Call someone', 'Binge a series']],
      ['The waiter brings the wrong dish. I…', ['Eat it anyway', 'Politely ask again', 'Complain loudly', 'Make you ask']],
      ['I get lost in a new city. I…', ['Use the map', 'Ask a local', 'Wander happily', 'Call you']],
      ['Someone cuts the queue. I…', ['Say something', 'Glare silently', 'Let it go', 'Tell you later']],
      ['A friend forgets my birthday. I…', ['Say nothing', 'Remind them', 'Get sulky', 'Laugh it off']],
      ['I win €1,000 tomorrow. First buy?', ['Clothes', 'Tech', 'A trip', 'Nothing — save it']]
    ]
  },
  dreams: {
    label: 'Dreams', emoji: '✨',
    items: [
      ['Dream destination?', ['Japan', 'The Maldives', 'Iceland', 'Peru']],
      ['Win the lottery — first move?', ['Buy a house', 'Travel the world', 'Spoil the family', 'Save every cent']],
      ['Dream job?', ['Artist', 'Entrepreneur', 'Doctor', 'Explorer']],
      ['Where would I live?', ['A big city', 'By the sea', 'In the countryside', 'Abroad']],
      ['Skill I would love to master?', ['An instrument', 'A new language', 'Cooking', 'Drawing']],
      ['Dream car?', ['Something classic', 'Electric', 'A big 4x4', 'I do not care about cars']],
      ['Life in ten years?', ['Calm family life', 'A big career', 'Travelling', 'Running my own thing']],
      ['A day with no rules — I would…', ['Sleep in', 'Go on an adventure', 'Gather everyone I love', 'Learn something new']],
      ['Biggest goal this year?', ['Health', 'Money', 'Love', 'Career']],
      ['Dream wedding?', ['Big and loud', 'Small and intimate', 'Abroad', 'Courthouse and a party']],
      ['If I wrote a book it would be…', ['A love story', 'A thriller', 'A cookbook', 'My life story']],
      ['Retirement plan?', ['A house by the sea', 'Travel non-stop', 'Near the grandkids', 'Never retire']]
    ]
  },
  fun: {
    label: 'Just for fun', emoji: '😄',
    items: [
      ['Which animal am I most like?', ['A cat', 'A dog', 'An owl', 'A dolphin']],
      ['Karaoke genre?', ['Pop', 'Rap', 'Golden oldies', 'I refuse to sing']],
      ['Role in a zombie apocalypse?', ['The leader', 'The medic', 'The cook', 'First to go']],
      ['Hidden talent?', ['Cooking', 'Impressions', 'Dancing', 'Fixing things']],
      ['Grab one thing in a hurry?', ['My phone', 'Photos', 'My pet', 'My passport']],
      ['Scariest for me?', ['Spiders', 'Heights', 'Public speaking', 'Deep water']],
      ['Favourite film genre?', ['Comedy', 'Action', 'Romance', 'Horror']],
      ['My texting style?', ['Long paragraphs', 'One word', 'Only emojis', 'Voice notes']],
      ['My most-used emoji?', ['😂', '❤️', '😭', '👍']],
      ['Which celebrity would play me in a film?', ['A comedy star', 'An action hero', 'A drama queen or king', 'A cartoon voice']],
      ['If I were a dessert?', ['Chocolate cake', 'Ice cream', 'Baklava', 'Something spicy']],
      ['Game I always win?', ['Cards', 'Quizzes', 'Video games', 'Arguments']]
    ]
  }
};

const G = makePairGame({
  bank: BANK,
  mode: 'guess',
  rounds: 10,
  cats: ['me', 'food', 'fun', 'dreams'],
  options: (it) => it[1],
  ask: (it, { role, subject }) => ({
    eyebrow: role === 'self' ? 'About you' : `About ${subject}`,
    text: it[0]
  }),
  hitLine: (r) => `${r.nSecond} knows ${r.nFirst} well. +1`,
  missLine: (r) => `Not quite — ${r.nFirst}, tell the story.`
});

export const meta = {
  id: 'knowme',
  group: ['couple', 'friends'],
  title: 'Know Me?',
  emoji: '🔮',
  tagline: 'How well do you really know each other?',
  blurb: 'One answers about themselves in secret, the other guesses. Roles swap every round — the sharpest guesser wins. Eight decks, spicy one included.',
  minutes: '8 min',
  tags: ['Couples', 'Friends', '8 decks'],
  local: true,
  alternate: true,
  levels: [],
  settings: [
    {
      id: 'rounds', label: 'Questions per game', def: 10,
      options: [{ v: 6, label: '6' }, { v: 10, label: '10' }, { v: 16, label: '16' }, { v: 20, label: '20' }, { v: 30, label: '30' }]
    }
  ],
  rules: [
    'Each round one of you is the subject and answers about themselves — in secret.',
    'The other guesses what the subject chose.',
    'A correct guess scores 1 point. Roles swap every round.',
    'Most correct guesses wins. Pick the decks with the chips; set the length in Settings.'
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
