/**
 * LifeFlow Arcade — Truth or Dare.
 * A social card game: the performer picks Truth or Dare, the other player judges.
 * Nine decks, from icebreakers to after dark. Truths score 1, dares score 2 (configurable).
 */
import { esc, fill, draw, catChips, bindCats, validCats, beads, burst } from './kit.js';

const ROUNDS = 12;
const POINTS = { truth: 1, dare: 2 };

/** Per-game rules that travel inside the state, so both players share them. */
const roundsOf = (s) => s.rounds || ROUNDS;
const pointsOf = (s, kind) => (kind === 'dare' ? s.darePts || POINTS.dare : POINTS.truth);

export const DECKS = {
  ice: {
    label: 'Icebreakers', emoji: '❄️',
    truths: [
      'What is the best thing that happened to you this month?',
      'Morning person or night owl — and why?',
      'What hobby would you love to try one day?',
      'What was your very first job (or chore you got paid for)?',
      'What is the most interesting place you have ever visited?',
      'Which book, film or series do you recommend to everyone?',
      'What is your go-to comfort food?',
      'With no limits at all, what would your dream job be?',
      'What is a skill you are surprisingly good at?',
      'Which three words would your friends use to describe you?',
      'What is the best advice you have ever received?',
      'What always makes your day a little better?',
      'What is the most spontaneous thing you have ever done?',
      'Which famous person would you love to have dinner with?',
      'What is a small thing that instantly annoys you?',
      'What did you want to be when you were ten?',
      'What is the last thing that made you laugh out loud?',
      'What would your perfect Sunday look like?',
      'Which song would play when you walk into a room?',
      'Cats, dogs, or neither — defend your answer.',
      'What is something you believed as a child that turned out to be false?',
      'What is the best compliment a stranger ever gave you?',
      'If you could master one skill overnight, what would it be?',
      'What is the most adventurous food you have tried?',
      'What is your most-used phrase?'
    ],
    dares: [
      'Tell {you} two truths and a lie — {you} has to spot the lie.',
      'Share your best fun fact, with full documentary voice.',
      'Introduce yourself as if you were a famous athlete at a press conference.',
      'Describe your day using only emojis — say them out loud.',
      'Teach {you} a word in another language and make them repeat it.',
      'Tell the story behind your name in 30 seconds.',
      'Make three guesses about {you}. They tell you how many you got right.',
      'Pitch your favourite food like a TV salesperson.',
      'Draw your dream house in 30 seconds and present it.',
      'Find something blue nearby and present it like a museum masterpiece.',
      'Do your best impression of a famous person — {you} has three guesses.',
      'Show {you} your favourite app and sell it to them in 20 seconds.',
      'Say a tongue twister three times fast.',
      'Give {you} a nickname and use it until the end of the game.',
      'Do your best catwalk to the kitchen and back.',
      'Describe your job (or studies) like a nature documentary.',
      'Speak in rhymes until your next turn.',
      'Show {you} the oldest photo on your phone.',
      'Invent a new handshake and teach it to {you}.',
      'Talk for 30 seconds about a random object {you} points at.',
      'Do your best robot dance for 15 seconds.',
      'Let {you} ask you three rapid-fire questions — no thinking allowed.',
      'Sing “happy birthday” in the style of an opera singer.',
      'Balance a book on your head until your next turn starts.'
    ]
  },
  friends: {
    label: 'Friends', emoji: '🤝',
    truths: [
      'What is the most embarrassing thing you have done in front of {you}?',
      'What is a hidden talent nobody here knows about?',
      'What is the worst gift you ever got — did you pretend to love it?',
      'What is the pettiest reason you ever stopped talking to someone?',
      'If you swapped lives with {you} for a day, what would you do first?',
      'What is the last little lie you told?',
      'What is your most irrational fear?',
      'Who was your first celebrity crush?',
      'What is the silliest thing you have ever cried over?',
      'Which habit of {you} secretly makes you laugh?',
      'What is the most useless thing you know by heart?',
      'What is the weirdest food combo you actually enjoy?',
      'What is the funniest misunderstanding you have been part of?',
      'What is the meanest thing you have ever thought about {you}?',
      'Who here would you never trust with a secret — and why?',
      'What is something you pretend to like but secretly hate?',
      'What is the most embarrassing thing in your search history?',
      'Have you ever stalked an ex online? How deep did you go?',
      'What is the worst thing you have ever said behind someone’s back?',
      'What is the most childish thing you did this year?',
      'Which friend would you drop first in a survival show?',
      'What is the biggest lie you told your parents?',
      'Have you ever read someone else’s messages without permission?',
      'What is something about {you} that you would change if you could?',
      'What is the most awkward date you have been on?',
      'What is the worst text you sent to the wrong person?'
    ],
    dares: [
      'Do your best impression of {you} until they guess who it is.',
      'Show the last photo in your camera roll — or describe it honestly.',
      'Talk like a pirate until your next turn.',
      'Sing the chorus of the last song you listened to.',
      'Let {you} choose your phone wallpaper for the next 24 hours.',
      'Do 15 jumping jacks while reciting the alphabet.',
      'Speak only in questions until your next turn.',
      'Give {you} a dramatic movie-trailer introduction.',
      'Try to touch your nose with your tongue for 10 seconds.',
      'Tell a joke. If {you} does not laugh, try another one.',
      'Act out your most-used emoji until {you} guesses it.',
      'Do a 20-second runway walk across the room.',
      'Read your last sent message in a dramatic theatre voice.',
      'Roast {you} for 30 seconds — no mercy, but keep it funny.',
      'Let {you} post a story on your social media (they choose, you approve).',
      'Show {you} your screen time for this week.',
      'Let {you} read the last five things you searched for.',
      'Call a friend and sing them a song for 15 seconds.',
      'Send a “I miss you” text to the third person in your contacts.',
      'Let {you} draw a tiny moustache on your face (or hand).',
      'Eat a spoonful of something {you} picks from the kitchen.',
      'Do your most embarrassing dance move — full commitment.',
      'Let {you} change your profile picture for one hour.',
      'Imitate {you} ordering food at a restaurant.',
      'Give {you} your phone, unlocked, for 60 seconds.',
      'Wear your clothes inside out until the end of the game.'
    ]
  },
  party: {
    label: 'Party', emoji: '🎉',
    truths: [
      'What is the most awkward thing that happened to you at a party?',
      'Have you ever sung the wrong lyrics with total confidence?',
      'Which app eats most of your time — be honest about the hours.',
      'Who in your life would survive longest in a zombie apocalypse?',
      'What is the most childish thing you still do?',
      'What was your most questionable fashion phase?',
      'Have you ever blamed someone else for something you did?',
      'What is the strangest thing you have ever searched online?',
      'If you were a pop star, what would your stage name be?',
      'Which song do you secretly love but would never admit?',
      'What is the silliest thing you have spent money on?',
      'What is the longest you have stayed awake, and why?',
      'What is the most trouble you have ever been in?',
      'What is the craziest thing you have done on a dare?',
      'Have you ever been kicked out of somewhere? Where?',
      'What is the worst thing you have done at a wedding or a party?',
      'Who was the last person you ghosted — and why?',
      'What is your most embarrassing moment on social media?',
      'What is the most money you have wasted in one night?',
      'Have you ever pretended to be sick to skip something? What?',
      'What rumour about you was actually true?',
      'What is your worst habit that nobody knows about?',
      'Have you ever fallen asleep somewhere totally inappropriate?',
      'What is the wildest thing on your bucket list?'
    ],
    dares: [
      'Dance with no music for 20 seconds.',
      'Announce {you} like a boxing champion entering the ring.',
      'Make a funny face and hold it while {you} counts to 10.',
      'Moonwalk — or at least try — across the room.',
      'Report on this game like a breaking-news anchor.',
      'Do your best evil-villain laugh.',
      'Hold a plank for 30 seconds while {you} cheers you on.',
      'Sing everything you say until your next turn.',
      'Perform your last text message as an opera.',
      'Walk like a penguin to the door and back.',
      'Act out an animal of {you}\u2019s choosing for 20 seconds.',
      'Do a slow-motion replay of your last goal… in any sport.',
      'Do your best twerk — or your best attempt — for 10 seconds.',
      'Let {you} give you a new hairstyle with whatever is around.',
      'Talk in an accent {you} chooses until your next turn.',
      'Do a dramatic soap-opera breakup scene with {you}.',
      'Attempt a cartwheel, a split or a handstand — your choice.',
      'Let {you} tickle you for 10 seconds without laughing.',
      'Drink a glass of water without using your hands.',
      'Rap about {you} for 20 seconds.',
      'Do your best impression of your mother or father on the phone.',
      'Let {you} send one emoji to anyone in your contacts.',
      'Pretend to be a famous influencer filming a product review.',
      'Freeze in a funny pose until your next turn — or until you laugh.',
      'Lick your elbow. (Good luck.)'
    ]
  },
  couple: {
    label: 'Couple', emoji: '💞',
    truths: [
      'What was your very first impression of {you}?',
      'When did you realise you really liked {you}?',
      'What is your favourite memory of the two of you?',
      'What small thing does {you} do that makes your day?',
      'What have you always wanted to tell {you} but never did?',
      'Which song reminds you of {you}?',
      'Where is your dream trip together?',
      'Which habit of {you} do you secretly find adorable?',
      'What were you thinking about on your first date?',
      'What is one thing you would love to do together more often?',
      'Where do you see the two of you in five years?',
      'What is the best gift {you} has ever given you?',
      'What made you smile about {you} this week?',
      'What is something {you} does that you secretly love watching?',
      'What was the moment you knew {you} was special?',
      'What is the most jealous you have ever been in our relationship?',
      'What is one habit of {you} that drives you a little crazy?',
      'What is your favourite photo of us, and why?',
      'What do you still want to discover about {you}?',
      'What is something you have never told {you} about your past?',
      'What is the sweetest thing {you} has ever said to you?',
      'If you could relive one day with {you}, which one?',
      'What scares you most about our future?',
      'What is your secret nickname for {you} in your head?',
      'What is the best kiss we have ever had? Describe it.'
    ],
    dares: [
      'Give {you} a 30-second shoulder massage.',
      'Look {you} in the eyes and name three things you love about them.',
      'Take a silly selfie together right now.',
      'Slow dance with {you} through one chorus — music optional.',
      'Write a two-line love poem for {you} and read it aloud.',
      'Hold hands and look into each other\u2019s eyes for 30 seconds without laughing.',
      'Do your best impression of {you} waking up in the morning.',
      'Plan your next date out loud in 60 seconds.',
      'Give {you} a sincere compliment in a terrible accent.',
      'Serenade {you} with any song for 15 seconds.',
      'Draw a portrait of {you} in 60 seconds and gift it to them.',
      'Make {you} a drink or a snack of their choice.',
      'Give {you} a forehead kiss and say why you are grateful for them.',
      'Recreate your first photo together.',
      'Feed {you} a bite of something — slowly.',
      'Give {you} a foot massage for 60 seconds.',
      'Tell {you} the story of how you met, as a fairy tale.',
      'Let {you} choose your outfit for tomorrow.',
      'Write “I love you” somewhere on {you} with your finger. They guess the words.',
      'Kiss {you} like it is the end of a romantic film.',
      'Whisper your favourite memory of {you} in their ear.',
      'Plan a surprise for {you} this week and tell them only one clue.',
      'Compliment {you} non-stop for 30 seconds.',
      'Carry {you} (or try to) for five steps.'
    ]
  },
  flirty: {
    label: 'Flirty', emoji: '🌶️',
    truths: [
      'What was the exact moment you first thought “I want to kiss {you}”?',
      'If you had to seduce {you} with one sentence, what would it be? Say it — looking at them.',
      'What is the flirtiest thought you have had about {you} today?',
      'When did you last check {you} out without them noticing? What were you looking at?',
      'Eyes, smile, voice, hands or confidence — which one is your weakness, and why?',
      'What does {you} do without realising that you find completely irresistible?',
      'Which part of {you} would you write a poem about? Give us the first line.',
      'What is the most daring message you have typed — and then deleted?',
      'What compliment from {you} would make you melt on the spot?',
      'What is your secret move when you want to seduce someone — and has it worked on {you}?',
      'Which outfit do you wear when you want to be noticed? Has {you} noticed?',
      'Rate your last kiss with {you} out of 10 — and say exactly what would make it an 11.',
      'If {you} were a dessert, which one would they be — and how would you eat it?',
      'What is the most tempting moment between you and {you} that nobody else noticed?',
      'What do you secretly want {you} to whisper to you?',
      'A look, a touch or a word — what gives you butterflies fastest?',
      'Where would you take {you} if you wanted the night to end with a kiss you will never forget?',
      'Which song makes you think of {you} in a way you would not explain to your parents?',
      'What is the best kiss of your life — where, when, and what made it perfect?',
      'What is one thing you would love {you} to wear on your next date — or not wear?',
      'On a scale of 1 to 10, how much do you want to kiss {you} right now? Justify the number.',
      'What is your favourite way to be woken up?',
      'What would you do if {you} whispered “follow me” right now?',
      'Have you ever had a dream about {you} you would blush to describe? Give us a hint.',
      'What is the cheekiest thing you have ever done to get someone’s attention?',
      'Describe the perfect slow dance with {you} in three details.',
      'Which of your senses does {you} affect the most — and how?',
      'What is the most romantic-but-risky thing you would try with {you}?',
      'What is one thing you want {you} to do more often in the evenings?',
      'What is the most attractive thing a person can do with their hands?'
    ],
    dares: [
      'Look {you} in the eyes and slowly finish this sentence: “If we were alone right now, the first thing I would do is…”',
      'Pay {you} a compliment so specific it makes them blush. You get three tries.',
      'Whisper {you}’s name in their ear as if it were a secret.',
      'Kiss {you} on the cheek — then just next to their lips. Stop there.',
      'Hold {you}’s hand and trace slow circles on their palm for 30 seconds.',
      'Seduce {you} using only food words. 30 seconds, no laughing.',
      'Give {you} your best “come here” look — no words allowed.',
      'Write a two-line poem about {you}’s lips and read it aloud.',
      'Slow dance with {you} for 30 seconds — no music, you hum it.',
      'Fix {you}’s collar or hair as slowly and tenderly as you can.',
      'Tell {you} three things you find attractive about them — from the most innocent to the least.',
      'Send {you} a voice note whispering what you want on your next date.',
      'Kiss {you}’s hand like a gentleman — then like the villain in a romance film.',
      'Stand behind {you} and whisper a different compliment in each ear.',
      'Rest your forehead against {you}’s for 20 seconds. First to laugh loses.',
      'Feed {you} something sweet — slowly, with eye contact.',
      'Say “I want you” to {you} three ways: shy, bold and dangerous.',
      'Kiss {you} on the forehead, the nose and the chin — in that order, slowly.',
      'Give {you} a 30-second neck and shoulder massage.',
      'Sit as close to {you} as possible until your next turn.',
      'Recreate the moment you first flirted with {you} — with a much better line.',
      'Tell {you} something you noticed about them tonight that they think you missed.',
      'Hug {you} slowly and do not be the first to let go.',
      'Undo one button or remove one accessory — {you} decides which.',
      'Do your most seductive walk across the room and back, then sit next to {you}.',
      'Bite your lip and say {you}’s name as sexily as you can.',
      'Kiss {you} without using your hands.',
      'Trace a heart on {you}’s back with one finger — slowly.',
      'Give {you} a playful 15-second lap dance.',
      'Kiss {you} on the neck — once, slowly.'
    ]
  },
  spicy: {
    label: 'Spicy 18+', emoji: '🔥', adult: true,
    truths: [
      'What is a fantasy you have never told anyone? Describe only the setting — {you} imagines the rest.',
      'Where on your body does a kiss make you completely lose focus?',
      'What have you always wanted to try with {you} but never dared to ask?',
      'What is the most seductive thing {you} has ever done — maybe without even knowing it?',
      'Describe your perfect night with {you} in exactly five words.',
      'In control, or letting {you} take the lead — which is sexier to you, and why?',
      'What is the most daring place you have ever kissed someone?',
      'What is your favourite thing {you} wears to bed?',
      'When were you most tempted by {you} in public — and what stopped you?',
      'What is your biggest turn-on that has nothing to do with looks?',
      'What could {you} whisper that would make you leave this game immediately?',
      'Which of your outfits do you think drives {you} crazy? {you} says if you are right.',
      'Slow and tender, or bold and spontaneous — what is your mood tonight?',
      'What seductive message would you send {you} if you knew they would read it at work?',
      'Which part of your body do you love — and want {you} to notice more?',
      'Rate {you}’s kissing out of 10 and explain exactly how they can earn the missing points.',
      'Have you ever planned a seduction? Walk us through it, step by step.',
      'What is the most attractive sound {you} makes?',
      'What is the riskiest place you would be tempted to kiss {you}?',
      'Sight or hearing — which would you take away from {you} to make tonight more interesting?',
      'What guilty pleasure would you confess only to {you}?',
      'What is one rule you would love to break with {you} tonight?',
      'What were you really thinking during your most intense eye contact with {you}?',
      'When did {you} last make your heart race — and do they know?',
      'If tonight had a film title, what would it be — and which scene would be rated 18+?',
      'If {you} blindfolded you for five minutes, what would you hope they did? Keep it teasing.',
      'Slow, deep, playful or stolen — what is your favourite kind of kiss?',
      'Which piece of {you}’s clothing would you most like to steal — and why that one?',
      'Have you ever sent a spicy photo? Would you send one to {you} tonight?',
      'Neck, ears, back or hands — where are you most sensitive?',
      'What would you do with {you} on a weekend with no phones and no plans?',
      'Describe the most seductive kiss you can imagine — without using the word “kiss”.',
      'What is the boldest thing you have ever whispered to someone?',
      'What compliment about your body do you secretly want to hear from {you}?',
      'What is the most seductive scent in the world to you?',
      'What is the sexiest thing you have ever done that nobody knows about?',
      'Which part of {you} is your favourite — and how would you kiss it right now?',
      'What do you find seductive that most people would find strange?',
      'What is the hottest thing {you} has ever said to you?',
      'What would you do if {you} walked in wearing only a towel?',
      'Have you ever been caught kissing? Where?',
      'Build-up, first touch, or the moment you stop pretending — what is your favourite part of a seduction?',
      'If you could relive one intimate moment with {you}, which would it be? Describe only the setting.',
      'What do you want {you} to take the lead on tonight?',
      'What is the most seductive thing you have ever worn — and who was it for?'
    ],
    dares: [
      'Kiss {you} slowly for 10 seconds. They decide if it counts.',
      'Whisper in {you}’s ear exactly what you are thinking right now — no editing.',
      'Kiss {you} somewhere that is not their lips. They say warmer or colder until you find their favourite spot.',
      'Let {you} blindfold you, then guess where they kiss you. Three guesses.',
      'Give {you} a slow, sensual neck and shoulder massage for 60 seconds.',
      'Remove one item of clothing — {you} chooses which (socks and jewellery count).',
      'Dance slowly and closely with {you} for one full song.',
      'Hold eye contact with {you} for 30 seconds while slowly moving closer. Whoever looks away first owes a kiss.',
      'Tell {you} what you plan to do to them later — whispered, in exactly three words.',
      'Kiss {you}’s neck for five slow seconds.',
      'Trace a word on {you}’s back with an ice cube. If they guess it, they win a kiss.',
      'Run your fingers through {you}’s hair and down the back of their neck for 30 seconds.',
      'Sit facing {you}, as close as possible, without touching, for 30 seconds. First to give in loses.',
      'Role-play: you are strangers at a hotel bar. Seduce {you} in under a minute.',
      'Give {you} three kisses: one sweet, one teasing, and one that makes them forget the game.',
      '{you} picks one thing you must do for them before the night ends. Consent and fun only.',
      'Record a 10-second seductive voice note for {you} to play tomorrow morning.',
      'Trace {you}’s lips with your fingertip, then kiss them slowly.',
      'Do a slow strip-tease of one item — a jacket, a scarf or an over-shirt.',
      'Describe your plans for {you} later using only emojis. {you} interprets them out loud.',
      'Kiss {you} along their jaw, from ear to chin.',
      'Put your hands behind your back and kiss {you}. No hands for the next minute.',
      'Whisper the most seductive sentence you can invent. {you} rates it out of 10.',
      'Kiss {you}’s wrist, then the inside of their elbow, then their shoulder.',
      'Let {you} pick a song and give them a 30-second playful lap dance.',
      'Lead {you} into a slow dance — then dip them and kiss them.',
      'Text {you} describing what they are wearing as if it were the sexiest thing you have ever seen.',
      'Blindfold {you} and touch their arm three ways — lips, fingertips or breath. They guess which.',
      'Whisper three things you love about {you}’s body — one in each ear, the last against their neck.',
      'Bite your lip, look at {you}, and say their name like a promise.',
      'For 60 seconds, talk to {you} only with kisses — hand, cheek or neck.',
      'Hug {you} slowly from behind and whisper your plan for later.',
      'Swap one item of clothing with {you} for the rest of the game.',
      'Whisper a new compliment to {you} every 10 seconds for one minute.',
      'Kiss {you} like the final scene of a romance film. They say “cut”.',
      'Kiss {you} for 15 seconds as if nobody in the world were watching.',
      'Remove two accessories or one item of clothing — your choice.',
      'Give {you} a slow 30-second foot or calf massage.',
      'Let {you} draw a heart with lipstick or a pen on your arm or shoulder.',
      'Whisper to {you} something you would never say in front of other people.',
      'Sit on {you}’s lap and tell them about your day in your most seductive voice.',
      'Slowly take off {you}’s shoes and socks, then kiss their ankle.',
      'Kiss the back of {you}’s neck for five slow seconds.',
      'Freeze: kiss {you} until they say “freeze” — they can wait as long as they like.',
      'Give {you} a 20-second sensual dance using only your hips.'
    ]
  },
  afterdark: {
    label: 'After dark 18+', emoji: '🖤', adult: true,
    truths: [
      'Finish honestly: “The moment I knew I wanted {you} was…”',
      'Say the most seductive thing you can to {you} in exactly five words.',
      'Rate three of your fantasies mild, medium and too hot to share. Tell us the mild one.',
      'If {you} could read your mind for 30 seconds tonight, what would surprise them most?',
      'What is the sexiest thing about the way {you} thinks?',
      'Write the opening of a seduction scene like a film script: setting, music, first line.',
      'Words, looks or touch — what do you want more of tonight?',
      'Which of your secrets would make {you} look at you differently — in a good way?',
      'What is your most irresistible feature? Be honest, not humble.',
      'Is there something you have pretended not to want? Confess it, gently.',
      'What is the most romantic thing you have done that also felt a little dangerous?',
      'You are leaving {you} a note to read at midnight. What is the first line?',
      'What would you never do… unless {you} asked very nicely?',
      'Which words, whispered at the right moment, would melt you completely?',
      'Which room in the house has the most potential for a romantic surprise — and what would it be?',
      'What is the boldest thing you would do tonight if you knew {you} would say yes?',
      'Seduced slowly, or caught by surprise — which do you prefer?',
      'Where do you love to kiss {you} most — and why there?',
      'If your desire for {you} were the weather, what is tonight’s forecast?',
      'What is the most tempting thing {you} could say to you right now? Let them try it.',
      'What is the most seductive thing {you} could do to you in under ten seconds?',
      'Describe the outfit you would want {you} to open the door in tonight.',
      'What is a secret desire you have only ever thought about at 2 a.m.?',
      'Which of {you}’s looks tells you “tonight is the night”? Show us your version.',
      'What is the boldest thing you have ever done in the dark?',
      'If you could give {you} one order tonight that they had to obey, what would it be?',
      'If {you} gave you one order tonight, what would you hope it is?',
      'Where is the most unexpected place you have suddenly wanted to kiss {you}?',
      'Teasing or taking — which are you better at? Prove it with an example.',
      'Which piece of clothing is the most seductive to take off someone slowly?',
      'What is the most daring thing you would do with {you} on a holiday where nobody knows you?',
      'What is the hottest dream you have had about {you}? Describe only how it ended.',
      'What does {you} do that makes you want to skip dinner and go straight to dessert?',
      'Candles, music or total darkness — set the scene for tonight.',
      'What would you whisper to {you} if you knew they could not resist it?',
      'Rate your self-control around {you} right now, from 1 to 10.',
      'What “yes” are you dying to hear from {you}?',
      'Touch, taste, smell, sight or sound — which sense does {you} set on fire?',
      'What is the longest you have ever kissed someone without stopping?',
      'What is the most seductive message you have ever received? Paraphrase it.',
      'Morning, shower, sofa or midnight — when is {you} most irresistible?',
      'What is one thing you would love {you} to do slower?',
      'What is one thing you would love {you} to do bolder?',
      'If tonight had a dress code, what would it be?',
      'What is the cheekiest place you have ever been caught kissing?',
      'Which part of {you} do you think about when they are not around?',
      'What is the most irresistible thing {you} has ever whispered to you?',
      'Have you ever dressed up just to tempt {you}? Did it work?',
      'Plan your perfect “do not disturb” evening with {you}, hour by hour.',
      'What is the most forbidden-feeling thing you have ever wanted to do with {you}? Hint only.'
    ],
    dares: [
      'Forbidden word: choose a word {you} may not say for 3 turns. Every slip costs them a kiss.',
      'Whisper a compliment, a confession and a promise into {you}’s ear.',
      'Tension test: hold your lips one centimetre from {you}’s neck for 10 seconds — no touching.',
      'Lead {you} by the hand to the spot in the room you would choose for a first kiss — and kiss them there.',
      'Write a time on a piece of paper, hand it to {you} and say “keep this appointment”.',
      'Close your eyes. {you} kisses you once, anywhere above the shoulders. Describe it in three words.',
      'Seduce {you} for 30 seconds in a foreign accent of your choice.',
      'Give {you} a 60-second massage. They choose where: hands, back, neck or feet.',
      'Ask {you}’s permission with only a look, then slowly remove one of their accessories.',
      'Dim the lights, pick a song and give {you} one minute of your best moves.',
      'Hold {you}’s gaze and describe your dream holiday together — make it hot, keep it classy.',
      '{you} sets a one-minute timer. Keep your fingertips moving slowly on their hand or arm until it ends.',
      '{you} names a number from 1 to 15. Kiss them for that many seconds.',
      'Pretend you are seeing {you} for the first time across a crowded room. Walk over and win their number.',
      'Hide a small object on yourself — pocket, sleeve or collar. {you} has 30 seconds to find it.',
      'Whisper the plot of a romance novel starring you and {you} — stop just before the best part.',
      'Give {you} one kiss for each letter of their name, each in a different place (hands, cheeks, neck).',
      'Let {you} whisper a dare for you to do. You may refuse it once — then the next one is final.',
      'Slowly trace the outline of {you}’s lips, jaw and neck with one fingertip.',
      'Make {you} an offer for later tonight that they cannot refuse — and seal it with a kiss.',
      'Undress {you} with your eyes for 10 seconds while they watch you do it.',
      'Remove one item of clothing — you choose which, {you} chooses the music.',
      'Start a kiss on {you}’s hand and end it on their lips — take 20 seconds to get there.',
      'Whisper in {you}’s ear what you want them to wear — or not wear — next time.',
      'Lie back. {you} has 30 seconds to make you blush using only kisses on your face and neck.',
      'Place {you}’s hand wherever you like on your arm, shoulder or neck — it stays there until your next turn.',
      'Kiss {you} in slow motion, as if the film had slowed down.',
      'Blindfold {you}. Kiss them in three different places — they must guess the order.',
      'Give {you} a 60-second back massage — over or under the top, {you} decides.',
      'Sit on {you}’s lap facing them for 30 seconds. No kissing allowed — first to break loses.',
      'Run an ice cube slowly along {you}’s neck and collarbone.',
      'Kiss {you} for 20 seconds without hands — then 20 seconds with.',
      'Gently hold {you}’s hands above their head and whisper your plans for later — then let go.',
      'Let {you} take off one item of your clothing, using only one hand.',
      'Strip-tease of two items — music, eye contact, full commitment.',
      'Kiss {you}’s collarbone, then their shoulder, then their neck — slower each time.',
      'Breathe softly along {you}’s neck for 10 seconds without touching.',
      'Seduce {you} for 60 seconds without touching them at all. They decide if you succeeded.',
      'Point to where you want to be kissed (clothes stay on). {you} kisses it for 10 seconds.',
      'For one minute {you} is in charge — you do what they say, within your limits.',
      'Whisper three things you will do to {you} when the game ends. Keep every promise.',
      'Give {you} a lap dance to a song of their choice — the whole song.',
      'Kiss {you} as if you had not seen each other for a year.',
      'Undo one button of {you}’s shirt or remove one accessory — eyes on theirs the whole time.',
      'Lean in until your lips are one centimetre from {you}’s and stop. Wait for them to close the gap.',
      'Melt a piece of chocolate on your lips and kiss {you}.',
      'Three kisses, three compliments: each kiss somewhere new, each with a whispered compliment.',
      'Act out the first 30 seconds of your fantasy evening with {you} — stop before it gets too hot.',
      'Give {you} a slow, full-body hug and hold it for 30 seconds.',
      'Your choice: remove an item of clothing, or let {you} kiss your neck and shoulders for 20 seconds.'
    ]
  },
  deep: {
    label: 'Deep talk', emoji: '🌙',
    truths: [
      'What are you proud of that you rarely talk about?',
      'What fear are you quietly working on?',
      'What would you tell your younger self?',
      'Which moment changed you the most?',
      'What does a perfect ordinary day look like for you?',
      'What do you need more of right now?',
      'Who has shaped you the most, and how?',
      'What do you hope people say about you when you are not there?',
      'Is there a dream you set aside? Would you pick it back up?',
      'When did you last feel truly at peace?',
      'What are you most grateful for today?',
      'What do you value most in a friendship?',
      'What is something you have forgiven but not forgotten?',
      'When did you last cry, and why?',
      'What is a belief you changed your mind about?',
      'What part of yourself do you hide from most people?',
      'What is the hardest goodbye you have ever said?',
      'What would you do if you knew you could not fail?',
      'What is something you wish people asked you about?',
      'What does home mean to you?',
      'What is the kindest thing a stranger has done for you?',
      'What would you like to be remembered for?',
      'What are you still learning to accept about yourself?',
      'What is one thing you would change about how you were raised?'
    ],
    dares: [
      'Tell {you} one thing you admire about them — in detail.',
      'Share a photo that means a lot to you and tell its story.',
      'Say one goal out loud, and the first step you will take this week.',
      'Close your eyes and describe your happiest place for 30 seconds.',
      'Send a thank-you message to someone you have not thanked enough.',
      'Give {you} one piece of honest, kind advice.',
      'Name three things you genuinely like about yourself.',
      'Sit in silence with {you} for 30 seconds, then share one thought.',
      'Tell {you} about a time they helped you without knowing it.',
      'Describe yourself five years from now in five sentences.',
      'Hum a song that once rescued a bad day, and tell why.',
      'Write a short note to your future self and read it aloud.',
      'Tell {you} something you have never said out loud before.',
      'Share your biggest regret and what it taught you.',
      'Describe {you} as if you were introducing them to your hero.',
      'Tell {you} one thing you would like them to understand about you.',
      'Name one fear and one way you could face it this month.',
      'Look {you} in the eyes and tell them what they mean to you.',
      'Share the best decision you ever made, and how it felt.',
      'Tell {you} about a moment you felt completely alone.',
      'Ask {you} one question you have always wanted to ask.',
      'List five small things that made you happy this week.',
      'Apologise for something — big or small — you never apologised for.'
    ]
  },
  family: {
    label: 'Family', emoji: '🏡',
    truths: [
      'What is your favourite family tradition?',
      'What is the funniest thing that ever happened at a family meal?',
      'Which dish would you ask for on your birthday?',
      'Which chore do you dislike the most?',
      'If you could have any pet in the world, what would it be?',
      'What is the best holiday you remember?',
      'Who is the best cook in the family?',
      'What is your favourite cartoon of all time?',
      'What would you do with a whole free day?',
      'Which superpower would you choose?',
      'What makes you laugh every single time?',
      'Who is the messiest person at home? (Be brave.)',
      'What is the naughtiest thing you did as a kid?',
      'What is your favourite thing about {you}?',
      'Which family member are you most like?',
      'What is the best present you ever got?',
      'If you were the parent for a day, what rule would you make?',
      'What is your favourite family photo?',
      'Which food do you secretly hide from everyone else?',
      'What is the funniest thing a grandparent ever said?',
      'What is your favourite game to play together?',
      'What would you name a new family pet?',
      'What is the best day out we ever had?',
      'Who tells the worst jokes in the family?'
    ],
    dares: [
      'Hop on one foot for 15 seconds.',
      'Make an animal sound — {you} has to guess the animal.',
      'Talk like a robot until your next turn.',
      'Make the funniest face you possibly can.',
      'Tell any joke you know.',
      'Do 10 squats while counting in another language.',
      'Pretend to be a waiter and take {you}\u2019s order.',
      'Draw a cat with your eyes closed.',
      'Say the alphabet backwards as far as you can.',
      'Invent a secret handshake with {you} right now.',
      'Walk like a crab across the room.',
      'Hum a song and let {you} guess it.',
      'Spin around five times, then walk in a straight line.',
      'Do your best grandma or grandpa impression.',
      'Pretend to be a news reporter announcing dinner.',
      'Make {you} laugh without saying a word.',
      'Balance a spoon on your nose for 5 seconds.',
      'Do the chicken dance.',
      'Talk like a baby until your next turn.',
      'Give {you} a piggyback ride (or a very good attempt).',
      'Say five nice things about the person on your left.',
      'Build a tower from whatever is on the table.',
      'Act like a statue in a museum until someone laughs.',
      'Sing your favourite cartoon theme song.'
    ]
  }
};

export const meta = {
  id: 'truthdare',
  group: ['couple', 'friends'],
  title: 'Truth or Dare',
  emoji: '🎭',
  tagline: 'Nine decks. One brave question at a time.',
  blurb: 'Icebreakers, friends, party, couple, flirty, spicy 18+, after dark 18+, deep talk and family decks — over 550 cards. Pick truth or dare; the other player judges.',
  minutes: '15 min',
  tags: ['Party', '9 decks', '18+ option'],
  local: true,
  alternate: true,
  levels: [],
  settings: [
    {
      id: 'rounds', label: 'Cards per game', def: 12,
      options: [{ v: 6, label: '6' }, { v: 12, label: '12' }, { v: 20, label: '20' }, { v: 30, label: '30' }, { v: 50, label: '50' }]
    },
    {
      id: 'only', label: 'Cards in play', def: '',
      options: [{ v: '', label: 'Truth & dare' }, { v: 'truth', label: 'Truths only' }, { v: 'dare', label: 'Dares only' }]
    },
    {
      id: 'darePts', label: 'A dare is worth', def: 2,
      options: [{ v: 2, label: '2 points' }, { v: 3, label: '3 points' }]
    },
    {
      id: 'penalty', label: 'Chickening out', def: 0,
      options: [{ v: 0, label: 'No penalty' }, { v: 1, label: '−1 point' }, { v: 2, label: '−2 points' }]
    },
    {
      id: 'swaps', label: '“Another card”', def: 1,
      options: [{ v: 1, label: 'Allowed' }, { v: 0, label: 'Not allowed' }]
    }
  ],
  rules: [
    'Choose your decks — mix as many as you like. Spicy and After dark (18+) are for consenting adult couples — anyone can say no to a card, no questions asked.',
    'On your turn pick Truth, Dare or let fate decide.',
    'The other player judges: done, chickened out, or draw another card.',
    'Turns alternate. Most points wins — but everybody laughs.',
    'Settings: number of cards, truths or dares only, dare points, chicken penalty.'
  ]
};

const pick = (v, allowed, def) => (allowed.includes(v) ? v : def);

export function create(opts = {}) {
  const cats = validCats(DECKS, opts.cats) ? opts.cats.slice() : ['ice', 'friends', 'party'];
  return {
    phase: 'choose', turn: 0, cats, card: null, used: [], scores: [0, 0], brave: [0, 0], round: 0, log: [], moves: 0,
    rounds: pick(opts.rounds, [6, 12, 20, 30, 50], ROUNDS),
    only: pick(opts.only, ['', 'truth', 'dare'], ''),
    darePts: pick(opts.darePts, [2, 3], 2),
    penalty: pick(opts.penalty, [0, 1, 2], 0),
    swaps: pick(opts.swaps, [0, 1], 1)
  };
}

export function turn(state) {
  return state.phase === 'card' ? 1 - state.turn : state.turn;
}

function deal(state, kind) {
  const d = draw(DECKS, state.cats, state.used, kind === 'truth' ? 'truths' : 'dares');
  return { card: { kind, c: d.c, i: d.i, id: state.moves + 1 }, used: d.used };
}

export function apply(state, move) {
  if (!move || outcome(state).over) return null;

  if (move.cats !== undefined) {
    if (state.phase !== 'choose' || !validCats(DECKS, move.cats)) return null;
    return { ...state, cats: move.cats.slice(), moves: state.moves + 1 };
  }

  if (move.pick) {
    if (state.phase !== 'choose') return null;
    const kind = state.only || (move.pick === 'random' ? (Math.random() < 0.5 ? 'truth' : 'dare') : move.pick);
    if (kind !== 'truth' && kind !== 'dare') return null;
    if (state.only && move.pick !== 'random' && move.pick !== state.only) return null;
    const { card, used } = deal(state, kind);
    card.random = move.pick === 'random' && !state.only;
    return { ...state, phase: 'card', card, used, moves: state.moves + 1 };
  }

  if (move.another) {
    if (state.phase !== 'card' || state.swaps === 0) return null;
    const { card, used } = deal(state, state.card.kind);
    return { ...state, card, used, moves: state.moves + 1 };
  }

  if (move.verdict === 'done' || move.verdict === 'skip') {
    if (state.phase !== 'card') return null;
    const p = state.turn;
    const ok = move.verdict === 'done';
    const scores = state.scores.slice();
    const brave = state.brave.slice();
    if (ok) {
      scores[p] += pointsOf(state, state.card.kind);
      if (state.card.kind === 'dare') brave[p] += 1;
    } else {
      scores[p] -= state.penalty || 0;
    }
    const log = [{ seat: p, kind: state.card.kind, ok }, ...state.log].slice(0, 6);
    return { ...state, phase: 'choose', turn: 1 - p, card: null, scores, brave, log, round: state.round + 1, moves: state.moves + 1 };
  }

  return null;
}

export function outcome(state) {
  if (state.round < roundsOf(state)) return { over: false };
  const [a, b] = state.scores;
  if (a === b) return { over: true, draw: true, winner: null };
  return { over: true, winner: a > b ? 0 : 1, draw: false };
}

export function auto() {
  return null;
}

export function ai() {
  return null;
}

export function note(state, seat) {
  const pts = state.scores[seat];
  return `${pts} pt${pts === 1 ? '' : 's'} · ${state.brave[seat]} dare${state.brave[seat] === 1 ? '' : 's'}`;
}

export function summary(state, ctx) {
  const o = outcome(state);
  if (!o.over || !o.draw) return null;
  return `All square at ${state.scores[0]} points each — equally brave.`;
}

/* ------------------------------ view ------------------------------ */
function names(state, ctx) {
  const me = ctx.names[state.turn] || `Player ${state.turn + 1}`;
  const you = ctx.names[1 - state.turn] || `Player ${2 - state.turn}`;
  return { me, you };
}

export function view(state, ctx) {
  const { me, you } = names(state, ctx);
  const over = outcome(state).over;
  const chooser = state.phase === 'choose' && ctx.myTurn;

  let stage;
  if (over) {
    stage = `
      <div class="tod__final">
        <span class="tod__trophy" aria-hidden="true">🏆</span>
        <p>${esc(ctx.names[0])} <b>${state.scores[0]}</b> · <b>${state.scores[1]}</b> ${esc(ctx.names[1])}</p>
      </div>`;
  } else if (state.phase === 'choose') {
    const can = (k) => chooser && (!state.only || state.only === k);
    stage = `
      <div class="tod__deck" aria-hidden="true"><i></i><i></i><i></i><span>🎭</span></div>
      <p class="tod__ask"><b>${esc(me)}</b>, ${state.only === 'truth' ? 'ready for a truth?' : state.only === 'dare' ? 'ready for a dare?' : 'truth or dare?'}</p>
      <div class="tod__picks">
        <button class="tod__btn tod__btn--truth" type="button" data-pick="truth" ${can('truth') ? '' : 'disabled'}>
          <span class="tod__btn-ico" aria-hidden="true">💬</span><b>Truth</b><small>+${pointsOf(state, 'truth')} point</small>
        </button>
        <button class="tod__btn tod__btn--spin" type="button" data-pick="random" ${chooser ? '' : 'disabled'} aria-label="Let fate decide">
          <span aria-hidden="true">🎲</span><small>Fate</small>
        </button>
        <button class="tod__btn tod__btn--dare" type="button" data-pick="dare" ${can('dare') ? '' : 'disabled'}>
          <span class="tod__btn-ico" aria-hidden="true">🔥</span><b>Dare</b><small>+${pointsOf(state, 'dare')} points</small>
        </button>
      </div>`;
  } else {
    const c = state.card;
    const deck = DECKS[c.c];
    const text = deck[c.kind === 'truth' ? 'truths' : 'dares'][c.i] || '';
    const judge = ctx.myTurn;
    stage = `
      <div class="tod__card tod__card--${c.kind}" data-card="${c.id}">
        <div class="tod__inner">
          <div class="tod__face tod__face--back"><span>${c.kind === 'truth' ? '💬' : '🔥'}</span></div>
          <div class="tod__face tod__face--front">
            <span class="tod__kind">${c.kind === 'truth' ? 'Truth' : 'Dare'}${c.random ? ' · by fate' : ''}</span>
            <p class="tod__text">${fill(text, { me, you })}</p>
            <span class="tod__deckname">${deck.emoji} ${esc(deck.label)} · for ${esc(me)}</span>
          </div>
        </div>
      </div>
      ${
        judge
          ? `<p class="tod__ask">${ctx.local ? `<b>${esc(you)}</b>, you judge.` : 'You judge.'} Did ${esc(me)} do it?</p>
             <div class="tod__verdict">
               <button class="btn btn--primary" type="button" data-verdict="done">✓ Done · +${pointsOf(state, c.kind)}</button>
               <button class="btn btn--ghost" type="button" data-verdict="skip">🐔 Chickened out${state.penalty ? ` · −${state.penalty}` : ''}</button>
               ${state.swaps === 0 ? '' : '<button class="btn btn--ghost btn--sm" type="button" data-another>↻ Another card</button>'}
             </div>`
          : `<p class="tod__ask">Your turn to shine — <b>${esc(you)}</b> is the judge.</p>`
      }`;
  }

  return `
    <div class="tod tod--${state.phase}">
      ${catChips(DECKS, state.cats, chooser)}
      ${beads(state.round, roundsOf(state), over ? -1 : state.round)}
      <div class="tod__stage">${stage}</div>
      ${
        state.log.length
          ? `<ol class="tod__log">${state.log
              .map((l) => `<li class="${l.ok ? 'is-ok' : 'is-skip'}"><b>${esc(ctx.names[l.seat] || '')}</b> ${l.ok ? (l.kind === 'dare' ? 'nailed a dare 🔥' : 'told the truth 💬') : `skipped a ${l.kind} 🐔`}</li>`)
              .join('')}</ol>`
          : ''
      }
    </div>`;
}

let lastCelebrated = '';

export function bind(root, state, ctx, play) {
  bindCats(root, state.cats, play);
  root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => play({ pick: b.dataset.pick })));
  root.querySelectorAll('[data-verdict]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.verdict === 'done') {
        const key = `${ctx.sessionKey}:${state.moves}`;
        if (key !== lastCelebrated) {
          lastCelebrated = key;
          burst(root.querySelector('.tod__stage'), state.card.kind === 'dare' ? ['🔥', '⭐', '✨'] : ['💬', '💜', '✨']);
        }
        setTimeout(() => { if (root.isConnected) play({ verdict: 'done' }); }, 380);
      } else {
        play({ verdict: 'skip' });
      }
    })
  );
  root.querySelector('[data-another]')?.addEventListener('click', () => play({ another: true }));
}

export function coach(state, ctx) {
  if (outcome(state).over) return 'Shuffle the decks and go again — or switch to a new mix.';
  const { me, you } = names(state, ctx);
  if (state.phase === 'choose') {
    return ctx.myTurn ? 'Truth is safe, dare pays more. Tap the chips above to mix decks.' : `${me} is choosing…`;
  }
  return ctx.myTurn ? 'Be fair — and be generous with the brave ones.' : `${you} is judging.`;
}
