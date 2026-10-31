/**
 * LifeFlow — Firebase configuration & app constants.
 *
 * NOTE: Firebase web API keys are public identifiers, not secrets. Real security
 * comes from Firestore/Storage security rules (see firestore.rules / storage.rules)
 * and from enabling only the auth providers you need in the Firebase console.
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyA4T0B3yrWMBtJ8t5W1UKiJ1m2oH4A0DA4',
  authDomain: 'planner-project-7ab9e.firebaseapp.com',
  projectId: 'planner-project-7ab9e',
  storageBucket: 'planner-project-7ab9e.firebasestorage.app',
  messagingSenderId: '888269215926',
  appId: '1:888269215926:web:61cee048986cffe7622e17',
  measurementId: 'G-YSXGXFHD3N'
};

/** Enable Firebase Analytics (only works on http/https origins). */
export const ENABLE_ANALYTICS = true;

/**
 * Google Calendar sync.
 *
 * `clientId` comes from Google Cloud Console → APIs & Services → Credentials →
 * "OAuth 2.0 Client ID" of type **Web application**, with your app origin listed
 * under "Authorized JavaScript origins". The Google Calendar API must be enabled
 * for the same project. Leave it empty to hide the feature entirely.
 *
 * Like the Firebase key above, an OAuth *client id* is a public identifier — the
 * origin allow-list is what actually protects it. Never put a client *secret*
 * in front-end code.
 */
export const GOOGLE = {
  clientId: '',
  scope: 'https://www.googleapis.com/auth/calendar',
  /** Which Google calendar to sync with. 'primary' is the user's main one. */
  calendarId: 'primary',
  /** How far back the first sync reaches, in days. */
  initialWindowDays: 60
};

/** App-wide constants. */
export const APP = {
  name: 'LifeFlow',
  tagline: 'Your life, in flow.',
  version: '1.0.0'
};

/**
 * Voice & video in Games.
 *
 * Google's public STUN servers are always used and connect most home Wi-Fi.
 * Phones on 4G/5G and strict office/school networks usually also need a TURN
 * relay. Add one here, using the credentials from your TURN provider
 * (for example a free Metered.ca or Cloudflare Calls account, or your own coturn):
 *
 *   iceServers: [
 *     { urls: ['turn:YOUR-TURN-HOST:80', 'turn:YOUR-TURN-HOST:443?transport=tcp'],
 *       username: 'YOUR-USERNAME', credential: 'YOUR-CREDENTIAL' }
 *   ]
 */
export const RTC = {
  iceServers: [],
  /** Authenticated backend; activate TURN secrets and deploy before cross-network use. */
  credentialsUrl: `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/rtcIceServers`,
  /** Diagnostic switch: true verifies relay connectivity without direct candidates. */
  forceRelay: false
};

export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'TND', symbol: 'dt' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'MAD', symbol: 'DH' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'JPY', symbol: '¥' },
  { code: 'INR', symbol: '₹' },
  { code: 'AED', symbol: 'AED' },
  { code: 'NGN', symbol: '₦' },
  { code: 'BRL', symbol: 'R$' }
];

export const TASK_CATEGORIES = [
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'personal', label: 'Personal', emoji: '🌿' },
  { id: 'health', label: 'Health', emoji: '💪' },
  { id: 'finance', label: 'Finance', emoji: '💰' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
  { id: 'home', label: 'Home', emoji: '🏡' },
  { id: 'social', label: 'Social', emoji: '🫂' }
];

export const PRIORITIES = [
  { id: 'high', label: 'High', cls: 'pri-high', chip: 'chip--danger' },
  { id: 'med', label: 'Medium', cls: 'pri-med', chip: 'chip--warning' },
  { id: 'low', label: 'Low', cls: 'pri-low', chip: 'chip--info' }
];

export const EVENT_TYPES = [
  { id: 'event', label: 'Event', emoji: '🎉' },
  { id: 'appointment', label: 'Appointment', emoji: '📅' },
  { id: 'reminder', label: 'Reminder', emoji: '🔔' }
];

export const GOAL_AREAS = [
  { id: 'professional', label: 'Professional', emoji: '🚀' },
  { id: 'personal', label: 'Personal', emoji: '🌱' }
];

export const MOODS = [
  { id: 'rough', emoji: '😔', label: 'Rough', score: 1 },
  { id: 'meh', emoji: '😕', label: 'Meh', score: 2 },
  { id: 'okay', emoji: '🙂', label: 'Okay', score: 3 },
  { id: 'good', emoji: '😄', label: 'Good', score: 4 },
  { id: 'great', emoji: '🤩', label: 'Great', score: 5 }
];

/**
 * Themes. `group` sorts them in the picker; `dark: true` themes are full skins
 * that always render on their own dark canvas; `fx` adds an ambient animation
 * (see js/fx.js); `bg` is only used to preview the skin in the picker.
 * Every id needs matching CSS in css/soft.css (classic) or css/themes.css.
 */
export const THEME_GROUPS = [
  { id: 'classic', label: 'Classic', hint: 'Soft and calm, in light or dark' },
  { id: 'girly', label: 'Girly', hint: 'Pinks, lilacs and blush tones' },
  { id: 'elegant', label: 'Elegant & classy', hint: 'Gold, jewel tones and serif type' },
  { id: 'dark', label: 'Dark luxe', hint: 'Deep, rich, always dark' },
  { id: 'hacker', label: 'Hacker', hint: 'Terminal type, neon and scanlines' }
];

export const ACCENTS = [
  { id: 'violet', group: 'classic', label: 'Periwinkle', colors: ['#7b83f5', '#45c9c2'] },
  { id: 'sunset', group: 'classic', label: 'Sunset', colors: ['#ff8a71', '#ffc46b'] },
  { id: 'forest', group: 'classic', label: 'Sage', colors: ['#46b795', '#8fd39b'] },
  { id: 'ocean', group: 'classic', label: 'Ocean', colors: ['#3fa9e2', '#5fd3dd'] },
  { id: 'mono', group: 'classic', label: 'Slate', colors: ['#7c8b93', '#9aa8b0'] },

  { id: 'blossom', group: 'girly', label: 'Blossom', colors: ['#d95f8f', '#ffb0c8'] },
  { id: 'candy', group: 'girly', label: 'Candy', colors: ['#e0348c', '#9a5cf0'] },
  { id: 'rose', group: 'girly', label: 'Rosé gold', colors: ['#c9707f', '#e8b49a'] },
  { id: 'lavender', group: 'girly', label: 'Lavender dream', colors: ['#9479d6', '#f0a8d2'] },
  { id: 'peach', group: 'girly', label: 'Peach bellini', colors: ['#ee8466', '#f7a8c2'] },
  { id: 'dollhouse', group: 'girly', label: 'Dollhouse', colors: ['#ff3ea5', '#ffc1e3'], fx: 'sparkle' },
  { id: 'sakura', group: 'girly', label: 'Sakura', colors: ['#e889a8', '#8fcfbf'], fx: 'petals' },

  { id: 'champagne', group: 'elegant', label: 'Champagne', colors: ['#b8955a', '#e6d3a8'] },
  { id: 'emerald', group: 'elegant', label: 'Emerald royale', colors: ['#1f7a5c', '#c9a45c'] },
  { id: 'bordeaux', group: 'elegant', label: 'Bordeaux', colors: ['#8c2f45', '#d4a373'] },
  { id: 'sapphire', group: 'elegant', label: 'Sapphire & gold', colors: ['#2c4a8c', '#c9a45c'] },
  { id: 'marble', group: 'elegant', label: 'Marble', colors: ['#4a4a4a', '#b9a47a'] },

  { id: 'obsidian', group: 'dark', label: 'Obsidian gold', colors: ['#d4af37', '#f1d98a'], bg: '#0b0a09', dark: true, fx: 'dust' },
  { id: 'midnight', group: 'dark', label: 'Midnight velvet', colors: ['#8b5cf6', '#f472b6'], bg: '#0c0a1f', dark: true, fx: 'stars' },
  { id: 'noir', group: 'dark', label: 'Noir', colors: ['#f2f2f2', '#e5484d'], bg: '#000000', dark: true },
  { id: 'dracula', group: 'dark', label: 'Dracula', colors: ['#bd93f9', '#ff79c6'], bg: '#1e1f29', dark: true },
  { id: 'nord', group: 'dark', label: 'Nord', colors: ['#88c0d0', '#b48ead'], bg: '#242933', dark: true },

  { id: 'matrix', group: 'hacker', label: 'Matrix', colors: ['#00ff6a', '#b9ffd0'], bg: '#010a03', dark: true, fx: 'rain' },
  { id: 'cyberpunk', group: 'hacker', label: 'Cyberpunk', colors: ['#fcee0a', '#ff2a6d'], bg: '#0b0b12', dark: true },
  { id: 'amber', group: 'hacker', label: 'Amber CRT', colors: ['#ffb000', '#ffd27a'], bg: '#0d0800', dark: true },
  { id: 'grid', group: 'hacker', label: 'Grid', colors: ['#00d9ff', '#0077ff'], bg: '#00060d', dark: true },
  { id: 'synthwave', group: 'hacker', label: 'Synthwave', colors: ['#ff2fd6', '#00e5ff'], bg: '#14002e', dark: true },
  { id: 'redteam', group: 'hacker', label: 'Red team', colors: ['#ff1744', '#b388ff'], bg: '#0a0004', dark: true, fx: 'rain' }
];

export const QUOTES = [
  { t: 'Small steps every day build the life you imagine.', a: 'LifeFlow' },
  { t: 'You do not rise to the level of your goals, you fall to the level of your systems.', a: 'James Clear' },
  { t: 'The secret of getting ahead is getting started.', a: 'Mark Twain' },
  { t: 'Discipline is choosing between what you want now and what you want most.', a: 'Abraham Lincoln' },
  { t: 'Well done is better than well said.', a: 'Benjamin Franklin' },
  { t: 'A year from now you may wish you had started today.', a: 'Karen Lamb' },
  { t: 'Progress, not perfection.', a: 'Unknown' },
  { t: 'Your future is created by what you do today.', a: 'Robert Kiyosaki' },
  { t: 'Energy flows where attention goes.', a: 'Tony Robbins' },
  { t: 'Do something today that your future self will thank you for.', a: 'Sean Patrick Flanery' },
  { t: 'Balance is not something you find, it is something you create.', a: 'Jana Kingsford' },
  { t: 'Simplicity is the ultimate sophistication.', a: 'Leonardo da Vinci' }
];

export const BADGES = [
  { id: 'first-step', emoji: '👣', label: 'First Step', hint: 'Complete your first task' },
  { id: 'task-10', emoji: '⚡', label: 'Momentum', hint: 'Complete 10 tasks' },
  { id: 'task-50', emoji: '🔥', label: 'Unstoppable', hint: 'Complete 50 tasks' },
  { id: 'streak-7', emoji: '🗓️', label: 'Week Warrior', hint: '7-day habit streak' },
  { id: 'streak-30', emoji: '🏆', label: 'Habit Master', hint: '30-day habit streak' },
  { id: 'saver', emoji: '🐷', label: 'Saver', hint: 'Reach 50% of a savings goal' },
  { id: 'goal-crusher', emoji: '🎯', label: 'Goal Crusher', hint: 'Complete a goal' },
  { id: 'journalist', emoji: '📓', label: 'Journalist', hint: 'Write 10 journal entries' },
  { id: 'focused', emoji: '🧘', label: 'Deep Focus', hint: 'Finish 5 focus sessions' },
  { id: 'balanced', emoji: '⚖️', label: 'Balanced', hint: 'Reach 80% life balance' }
];
