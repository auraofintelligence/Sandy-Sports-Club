import {creativeVariantsFor} from './social-placements.js';
import {calendarDaySignals} from './social-holiday-calendar.js';
export const CAMPAIGN_LAYERS = [
  {
    "id": "volleyball",
    "label": "Beach volleyball",
    "frequency": 3,
    "priority": 10,
    "topics": [
      "Why mixed beach volleyball leads Sandy Sports",
      "Serving for absolute beginners",
      "How a beach volleyball rally works",
      "Mixed doubles and communication",
      "The difference between beach and indoor volleyball",
      "A beginner-friendly passing drill",
      "Beach volleyball footwork on sand",
      "Setting the ball in windy conditions",
      "Court dimensions and boundaries",
      "Doubles versus four-a-side social play",
      "A fun cooperative rally challenge",
      "Volleyball warm-ups and gradual progression",
      "How teams rotate and score",
      "What would a friendly mixed league look like?",
      "Choosing a volleyball for outdoor play",
      "Net height and age-appropriate formats",
      "Beach volleyball as an Olympic sport",
      "Why courts need safe run-off space",
      "How to welcome first-time players",
      "Local versus visiting team possibilities",
      "What coaches and officials contribute",
      "What equipment could be shared across towns",
      "A visitor-friendly volleyball introduction",
      "Imagining an island-wide volleyball festival"
    ],
    "cta": "Which volleyball format would you enjoy?",
    "url": "/sport-mixed-beach-volleyball.html",
    "group": "Sport",
    "emoji": "🏐"
  },
  {
    "id": "other",
    "label": "Other sand sports",
    "frequency": 4,
    "priority": 6,
    "topics": [
      "Flag football in 30 seconds",
      "What makes flag football non-contact?",
      "Learning to throw a spiral pass",
      "Five-on-five flag football basics",
      "Flag pulling without contact",
      "Why LA 2028 matters to flag football",
      "An island flag-football introduction concept",
      "Beach cricket with a small group",
      "Beach cricket batting basics",
      "A beach cricket catching challenge",
      "Safe boundaries for beach cricket",
      "A family-friendly beach cricket variation",
      "Beach football and ball control",
      "Beach football dribbling challenge",
      "Small-sided beach soccer concepts",
      "Footwork differences between grass and sand",
      "Beach rugby league skills without full contact",
      "How a rugby club could use a sand session",
      "A beach rugby league skills relay",
      "Beach 5s explained",
      "Adapting rugby formats to different ages",
      "AirBadminton explained",
      "Outdoor shuttle skills in a breeze",
      "Would you try AirBadminton?",
      "Beach tennis rally challenge",
      "Other portable net games for a shared space",
      "Ultimate frisbee in a nutshell",
      "A flying-disc passing challenge",
      "Ultimate and spirit of the game",
      "Beach handball quick introduction",
      "A beach handball passing challenge",
      "Netball crossover footwork",
      "A modified netball skills relay",
      "AFL marking practice on soft surfaces",
      "AFL handpassing challenge",
      "Sand-based fitness with qualified supervision",
      "Movement games for different ability levels",
      "Roundnet as an island-made possibility",
      "Design your own island sport",
      "Which sport needs the biggest field?",
      "How equipment can switch from one sport to another",
      "What could a three-town sport sampler include?",
      "How junior sport can share facilities",
      "Why rules vary between beach and field formats",
      "Two-person versus team-based sports",
      "A beginner's guide to modified games",
      "Planning a sports try-out without promising an event"
    ],
    "cta": "Which sport should Sandy Sports explore next?",
    "url": "/sports.html",
    "group": "Sport",
    "emoji": "🏉"
  },
  {
    "id": "vision",
    "label": "Why establish the club?",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Sandy Sports Straddie: come and get sandy",
      "Why a new club could complement existing clubs",
      "A proposal rather than an operating club",
      "What should happen before a founding meeting?",
      "Why start with shared spaces and equipment?",
      "How could sport and culture support each other?",
      "What is the case for island-wide coordination?",
      "From an idea to a community decision",
      "Why flexibility matters on an island",
      "Should a club be local first and welcoming to visitors?",
      "What is a sporting legacy beyond a big event?",
      "What would success look like after one year?",
      "Could shared sport facilities reduce duplication?",
      "What would make Sandy Sports different?",
      "A proposed pathway from interest to participation",
      "How can a new club respect existing organisations?",
      "What might the club need before its first programme?",
      "What needs local agreement rather than assumptions?"
    ],
    "cta": "What would make a new club worthwhile to you?",
    "url": "/index.html",
    "group": "Community",
    "emoji": "💡"
  },
  {
    "id": "voice",
    "label": "Community voice and polls",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Vote for your first sport to try",
      "Which town needs more recreation opportunities?",
      "What is missing from local sport?",
      "Choose a family-friendly activity",
      "What time of day suits community sport?",
      "Would you join a beginner skills session?",
      "What should come first: shade courts or changing rooms?",
      "Choose a new island-made game idea",
      "Would you volunteer one day a month?",
      "Which facilities should be movable?",
      "What should a family weekend include?",
      "What should future participation leaderboards reward?",
      "Would a film night complement sports?",
      "What matters most to inclusive facilities?",
      "What makes an event worth attending?",
      "Tell us your top three priorities",
      "Suggest a practical way to help build a club"
    ],
    "cta": "Share your preference through the proposal site.",
    "url": "/join.html",
    "group": "Community",
    "emoji": "🗳️"
  },
  {
    "id": "visitors",
    "label": "Holidaymakers and visitors",
    "frequency": 2,
    "priority": 8,
    "topics": [
      "A 20-second introduction to Sandy Sports",
      "Beach games for a family holiday",
      "What sport would you try on holiday?",
      "A visiting team's dream island itinerary concept",
      "The value of QR expressions of interest",
      "How to stay involved after your holiday",
      "A simple movement game with no equipment",
      "Weekend sports inspiration for visitors",
      "Visitors versus locals friendly challenge idea",
      "Would a sports and cinema day appeal?",
      "What makes a memorable island holiday?",
      "A beginner-friendly sand game to share",
      "A packing checklist for outdoor recreation",
      "Camping and holiday planning: verify official bookings and local rules",
      "What could holiday sports look like across three towns?",
      "Share your favourite sport memory",
      "School-holiday countdown: choose an activity",
      "What to do when it is too windy for a beach game",
      "A summer visitor survey",
      "An island sports sampler concept",
      "Why visiting families' ideas matter"
    ],
    "cta": "Visiting Straddie? Tell us what you would love to play.",
    "url": "/join.html",
    "group": "Community",
    "emoji": "🧳"
  },
  {
    "id": "places",
    "label": "Three towns and site options",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Why a three-town network?",
      "Goompi and its potential sport spaces",
      "Pulan and neighbourhood recreation",
      "Mulumba and visitor-facing sport",
      "The 10-12 Ballow Road site concept",
      "Why Ballow Road's slope matters",
      "Cunningham Street as a separate flat option",
      "How existing users shape a site decision",
      "Why land approval cannot be assumed",
      "Linking venues across towns",
      "Would portable courts be more resilient?",
      "Transport considerations for a future club",
      "Safe access and accessible pathways",
      "How site choices affect outdoor cinema",
      "Shade wind and water at proposed sites",
      "What should a future site assessment include"
    ],
    "cta": "Which location or feature should be studied?",
    "url": "/places.html",
    "group": "Community",
    "emoji": "🏝️"
  },
  {
    "id": "facilities",
    "label": "Facilities and equipment",
    "frequency": 1,
    "priority": 6,
    "topics": [
      "What goes into a safe sand court?",
      "Shade and seating for spectators",
      "Net posts and portable boundaries",
      "Why different sports need different footprints",
      "A modular clubhouse concept",
      "Inclusive toilets showers and changing rooms",
      "Storage and equipment custody",
      "Lighting and neighbour considerations",
      "Water stations and hydration",
      "Drainage and sand maintenance",
      "How a portable court could be packed",
      "A shared field conversion kit",
      "Keeping assets working across three towns",
      "An accessible path through a sports precinct",
      "What belongs on the equipment wish list"
    ],
    "cta": "Which facility should be researched first?",
    "url": "/facilities.html",
    "group": "Community",
    "emoji": "🏗️"
  },
  {
    "id": "film",
    "label": "Film, screens and media",
    "frequency": 1,
    "priority": 6,
    "topics": [
      "A film club inside a sports club?",
      "What could an outdoor screen show?",
      "Filming a short sport technique lesson",
      "How to caption videos for everyone",
      "Who owns the rights to community footage?",
      "Why consent matters for filming children",
      "Mobile versus permanent LED screens",
      "How one screen might serve several venues",
      "Could a short-film showcase support local talent?",
      "Beginner camera and editing skills",
      "Behind the scenes of a 30-second sports video",
      "A proposed local interview series",
      "A sound and microphone basics tip",
      "A film crew volunteer opportunity",
      "Why screen hire needs a real operating plan"
    ],
    "cta": "What would you like an island film club to create?",
    "url": "/film-club.html",
    "group": "Community",
    "emoji": "🎬"
  },
  {
    "id": "events",
    "label": "Events and cultural programmes",
    "frequency": 1,
    "priority": 9,
    "topics": [
      "What makes a good community sports day?",
      "A proposed cross-sport festival",
      "Outdoor movie night concept",
      "A sports market and makers day concept",
      "Sport and cultural exchange possibilities",
      "How to plan for weather cancellations",
      "The value of clear event run sheets",
      "What must be approved before a public event?",
      "Designing accessible family events",
      "A short-game tournament format",
      "Could local clubs share a demonstration day?",
      "A sports plus film afternoon idea",
      "What should an island visitor programme feature?",
      "An event countdown only after approval",
      "Keeping events enjoyable for volunteers"
    ],
    "cta": "Which event concept would you want explored?",
    "url": "/programme.html",
    "group": "Community",
    "emoji": "🎪"
  },
  {
    "id": "skills",
    "label": "Skills, youth and inclusion",
    "frequency": 1,
    "priority": 6,
    "topics": [
      "Coaching basics and qualified supervision",
      "How to welcome shy beginners",
      "Inclusive team selection ideas",
      "Junior sport and family participation",
      "Learning to referee a game",
      "A camera skills pathway for young people",
      "Volunteering as practical learning",
      "Intergenerational sports formats",
      "What accessible coaching can look like",
      "Peer-to-peer skills sharing",
      "Helping someone try a new sport",
      "How to make rules easy to understand",
      "Sports leadership without exclusion",
      "A beginners-first activity proposal"
    ],
    "cta": "What could you teach or learn through the proposed club?",
    "url": "/member-training.html",
    "group": "Community",
    "emoji": "🏅"
  },
  {
    "id": "funding",
    "label": "Funding and partnerships",
    "frequency": 1,
    "priority": 6,
    "topics": [
      "What should a grant application prove?",
      "The equipment wish list explained",
      "Could a business sponsor a court concept?",
      "In-kind support versus a cash contribution",
      "What does an auspice arrangement mean?",
      "A funding idea is not an awarded grant",
      "How quotes and approvals protect supporters",
      "Could a portable screen help fund shared equipment?",
      "A proposed raffles policy needs legal checks",
      "Why a capital asset needs maintenance funding",
      "Potential partner clubs without claimed agreements",
      "Transparent fundraising before asking for money",
      "Why local business interests matter",
      "A volunteer's skills as practical support"
    ],
    "cta": "Can you suggest a partner, asset or practical contribution?",
    "url": "/grants.html",
    "group": "Community",
    "emoji": "🤝"
  },
  {
    "id": "safety",
    "label": "Weather, safety and environment",
    "frequency": 1,
    "priority": 6,
    "topics": [
      "Forecast slot: verify weekend weather before publishing",
      "Forecast slot: Thursday weekend outlook",
      "Forecast slot: Friday activity conditions",
      "Forecast slot: Saturday conditions update",
      "UV protection for outdoor sport",
      "Shade breaks and hydration",
      "Warm-up ideas for movement on sand",
      "Recognising changing wind conditions",
      "Thunderstorms and the need to stop play",
      "First-aid planning for recreation",
      "Respecting dunes and wildlife",
      "Keeping pathways accessible and safe",
      "What to include in a venue risk review",
      "Why emergency information must come from authorities",
      "Planning a wet-weather alternative"
    ],
    "cta": "Check official conditions and plan safely.",
    "url": "/facilities.html",
    "group": "Community",
    "emoji": "🛟"
  },
  {
    "id": "volunteers",
    "label": "Volunteers and governance",
    "frequency": 1,
    "priority": 6,
    "topics": [
      "What might a founding volunteer do?",
      "A proposed women-led committee option",
      "Why governance starts before membership opens",
      "What a secretary actually helps organise",
      "What a treasurer needs to protect",
      "Proposed sport and film leadership roles",
      "Writing a constitution for community review",
      "Making decisions transparently",
      "Volunteer workloads and realistic expectations",
      "Why officer appointments cannot be assumed",
      "A proposed founding meeting checklist",
      "How a webmaster can support safe publishing"
    ],
    "cta": "Would you consider helping develop the proposal?",
    "url": "/committee.html",
    "group": "Community",
    "emoji": "🙌"
  },
  {
    "id": "news",
    "label": "Newsletters and progress",
    "frequency": 1,
    "priority": 6,
    "topics": [
      "Monthly proposal roundup: verify actual progress",
      "Three questions we're exploring next",
      "How to report consultation feedback accurately",
      "What's new on the Sandy Sports website?",
      "Newsletter signup and permission choices",
      "A seasonal ideas digest",
      "The latest questions from potential supporters",
      "A proposed next-steps update",
      "What should the first real newsletter cover?"
    ],
    "cta": "What progress or decision would you like an update on?",
    "url": "/clubhouse.html",
    "group": "Community",
    "emoji": "✉️"
  },
  {
    "id": "health",
    "label": "Health and wellbeing",
    "frequency": 3,
    "priority": 6,
    "topics": [
      "Enjoyable movement as part of a healthy week",
      "Social sport and a sense of belonging",
      "Outdoor recreation and stress management",
      "Movement and mood: what evidence suggests",
      "Beach volleyball and coordination",
      "Agility and gradual fitness progression",
      "Healthy ageing through adaptable activity",
      "Balance practice with appropriate supervision",
      "Friendships formed around shared interests",
      "How team sport can help social connection",
      "Welcoming people who have never joined a club",
      "Family play and intergenerational connection",
      "Movement games for children",
      "Confidence through learning a new skill",
      "Beginner-friendly exercise and realistic goals",
      "Why recovery days matter",
      "Rest and hydration for outdoor athletes",
      "Sun safety while staying active",
      "How to avoid overstating health benefits",
      "Supporting inclusion for different abilities",
      "Social connection for people new to the island",
      "Low-pressure activities for casual participants",
      "Teamwork and positive communication",
      "Fun and play as legitimate outcomes",
      "Choosing the right level of challenge",
      "Modified sport and accessibility",
      "Coordination as a learnable skill",
      "Movement breaks during holidays",
      "How outdoor environments can support enjoyment",
      "When to seek individual medical advice",
      "Why sports safety matters as much as fitness",
      "Could a weekly activity help community connection?",
      "What does a welcoming recreation space feel like?",
      "Why the club should celebrate participation too"
    ],
    "cta": "How could inclusive sport support wellbeing on Straddie?",
    "url": "/sports.html",
    "group": "Community",
    "emoji": "❤️"
  },
  {
    "id": "flagFootball",
    "label": "Flag football",
    "frequency": 2,
    "priority": 8,
    "topics": [
      "Flag football: how it works",
      "Flag football: beginner skills and a simple challenge",
      "Flag football: equipment and facilities to explore",
      "Flag football: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Flag football proposal",
    "url": "/flag-football.html",
    "group": "Sport",
    "emoji": "🏈"
  },
  {
    "id": "beachCricket",
    "label": "Beach cricket",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Beach cricket: how it works",
      "Beach cricket: beginner skills and a simple challenge",
      "Beach cricket: equipment and facilities to explore",
      "Beach cricket: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Beach cricket proposal",
    "url": "/sport-beach-cricket.html",
    "group": "Sport",
    "emoji": "🏏"
  },
  {
    "id": "beachFootball",
    "label": "Beach football",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Beach football: how it works",
      "Beach football: beginner skills and a simple challenge",
      "Beach football: equipment and facilities to explore",
      "Beach football: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Beach football proposal",
    "url": "/sport-beach-football.html",
    "group": "Sport",
    "emoji": "⚽"
  },
  {
    "id": "beachRugbyLeague",
    "label": "Beach rugby league",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Beach rugby league: how it works",
      "Beach rugby league: beginner skills and a simple challenge",
      "Beach rugby league: equipment and facilities to explore",
      "Beach rugby league: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Beach rugby league proposal",
    "url": "/sport-beach-rugby-league.html",
    "group": "Sport",
    "emoji": "🏉"
  },
  {
    "id": "beach5s",
    "label": "Beach 5s rugby",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Beach 5s rugby: how it works",
      "Beach 5s rugby: beginner skills and a simple challenge",
      "Beach 5s rugby: equipment and facilities to explore",
      "Beach 5s rugby: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Beach 5s rugby proposal",
    "url": "/sport-beach-5s-rugby.html",
    "group": "Sport",
    "emoji": "🏉"
  },
  {
    "id": "airBadminton",
    "label": "AirBadminton",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "AirBadminton: how it works",
      "AirBadminton: beginner skills and a simple challenge",
      "AirBadminton: equipment and facilities to explore",
      "AirBadminton: could Sandy Sports offer this?"
    ],
    "cta": "Explore the AirBadminton proposal",
    "url": "/sport-airbadminton.html",
    "group": "Sport",
    "emoji": "🏸"
  },
  {
    "id": "beachTennis",
    "label": "Beach tennis and net games",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Beach tennis and net games: how it works",
      "Beach tennis and net games: beginner skills and a simple challenge",
      "Beach tennis and net games: equipment and facilities to explore",
      "Beach tennis and net games: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Beach tennis and net games proposal",
    "url": "/sport-beach-tennis-and-net-games.html",
    "group": "Sport",
    "emoji": "🎾"
  },
  {
    "id": "ultimate",
    "label": "Ultimate and flying disc",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Ultimate and flying disc: how it works",
      "Ultimate and flying disc: beginner skills and a simple challenge",
      "Ultimate and flying disc: equipment and facilities to explore",
      "Ultimate and flying disc: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Ultimate and flying disc proposal",
    "url": "/sport-ultimate-and-flying-disc.html",
    "group": "Sport",
    "emoji": "🥏"
  },
  {
    "id": "beachHandball",
    "label": "Beach handball",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Beach handball: how it works",
      "Beach handball: beginner skills and a simple challenge",
      "Beach handball: equipment and facilities to explore",
      "Beach handball: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Beach handball proposal",
    "url": "/sport-beach-handball.html",
    "group": "Sport",
    "emoji": "🤾"
  },
  {
    "id": "netball",
    "label": "Netball crossover",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Netball crossover: how it works",
      "Netball crossover: beginner skills and a simple challenge",
      "Netball crossover: equipment and facilities to explore",
      "Netball crossover: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Netball crossover proposal",
    "url": "/sport-netball-crossover.html",
    "group": "Sport",
    "emoji": "🏐"
  },
  {
    "id": "afl",
    "label": "AFL crossover",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "AFL crossover: how it works",
      "AFL crossover: beginner skills and a simple challenge",
      "AFL crossover: equipment and facilities to explore",
      "AFL crossover: could Sandy Sports offer this?"
    ],
    "cta": "Explore the AFL crossover proposal",
    "url": "/sport-afl-crossover.html",
    "group": "Sport",
    "emoji": "🏉"
  },
  {
    "id": "fitness",
    "label": "Fitness and movement",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Fitness and movement: how it works",
      "Fitness and movement: beginner skills and a simple challenge",
      "Fitness and movement: equipment and facilities to explore",
      "Fitness and movement: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Fitness and movement proposal",
    "url": "/sport-fitness-and-movement.html",
    "group": "Sport",
    "emoji": "🏃"
  },
  {
    "id": "islandGames",
    "label": "Island-made games",
    "frequency": 2,
    "priority": 6,
    "topics": [
      "Island-made games: how it works",
      "Island-made games: beginner skills and a simple challenge",
      "Island-made games: equipment and facilities to explore",
      "Island-made games: could Sandy Sports offer this?"
    ],
    "cta": "Explore the Island-made games proposal",
    "url": "/sport-island-made-formats.html",
    "group": "Sport",
    "emoji": "✨"
  },
  {
    "id": "weather",
    "label": "Weather and outdoor conditions (Thu/Fri/Sat)",
    "frequency": 3,
    "priority": 10,
    "topics": [
      "Thursday: verify weekend forecast and site conditions",
      "Friday: revise weather and plan safe activities",
      "Saturday: day-of verified outdoor conditions"
    ],
    "cta": "Check the official Bureau of Meteorology forecast",
    "url": "/facilities.html",
    "group": "Seasonal",
    "emoji": "🌤️"
  },
  {
    "id": "holidays",
    "label": "Queensland school-holiday visitors",
    "frequency": 3,
    "priority": 10,
    "holidayOnly": true,
    "topics": [
      "School holiday: what could we play together?",
      "Visitors: help shape Sandy Sports",
      "Family sport and wellbeing on Straddie",
      "A holiday activity idea, subject to real approval"
    ],
    "cta": "Explore ways to help create Sandy Sports",
    "url": "/join.html",
    "group": "Seasonal",
    "emoji": "🎒"
  },
  {
    "id": "nswHolidays",
    "label": "NSW school-holiday visitor wave",
    "frequency": 2,
    "priority": 8,
    "holidayOnly": true,
    "topics": [
      "NSW families: exploring Straddie sports",
      "A visitor's guide to the proposed club",
      "What would a NSW holiday visitor like to play?",
      "A NSW holiday family sport idea"
    ],
    "cta": "Share your visitor ideas",
    "url": "/join.html",
    "group": "Seasonal",
    "emoji": "🧳"
  },
  {
    "id": "surprise",
    "label": "Spontaneous island stories",
    "frequency": 1,
    "priority": 2,
    "topics": [
      "A surprise local sporting moment (verify details)",
      "Unexpected community contributions",
      "Photo or video challenge with permission",
      "A playful sport quiz"
    ],
    "cta": "Share a story or suggestion",
    "url": "/join.html",
    "group": "Community",
    "emoji": "✨"
  }
];

// Queensland Department of Education state-school dates (check independent school variations):
// https://education.qld.gov.au/about-us/calendar/term-dates
// https://education.qld.gov.au/about-us/calendar/future-dates
export const QLD_SCHOOL_HOLIDAYS = [
  ['2026-12-12','2027-01-26'],['2027-03-26','2027-04-11'],
  ['2027-06-26','2027-07-11'],['2027-09-18','2027-10-04'],
  ['2027-12-11','2028-01-23'],['2028-04-01','2028-04-17'],
  ['2028-06-24','2028-07-09'],['2028-09-16','2028-10-02'],
  ['2028-12-09','2029-01-21']
];
// NSW Department of Education: Eastern division dates lead the main visitor wave.
// The Western division has an additional summer extension; it receives a lighter tail.
// https://education.nsw.gov.au/schooling/calendars/2027
// https://education.nsw.gov.au/schooling/calendars/future-and-past-nsw-term-and-vacation-dates
export const NSW_SCHOOL_HOLIDAYS_EASTERN = [
  ['2026-12-18','2027-01-27'],['2027-04-12','2027-04-23'],
  ['2027-07-05','2027-07-16'],['2027-09-27','2027-10-08'],
  ['2027-12-21','2028-01-28'],['2028-04-10','2028-04-21'],
  ['2028-07-10','2028-07-21'],['2028-10-03','2028-10-13'],
  ['2028-12-22','2029-01-25']
];
export const NSW_SCHOOL_HOLIDAYS_WESTERN_EXTENSIONS = [
  ['2027-01-28','2027-02-03'],['2028-01-29','2028-02-04'],
  ['2029-01-26','2029-02-02']
];
const MS = 86400000;
const dayMs = day => Date.parse(day+'T00:00:00Z');
const iso = ms => new Date(ms).toISOString().slice(0,10);
const weekday = day => new Date(dayMs(day)).getUTCDay();
const numberHash = value => {let h=2166136261; for(const c of value){h=Math.imul(h^c.charCodeAt(0),16777619);} return h>>>0;};
const inHoliday = day => QLD_SCHOOL_HOLIDAYS.some(([a,b])=>day>=a && day<=b);
const inNSWEasternHoliday = day => NSW_SCHOOL_HOLIDAYS_EASTERN.some(([a,b])=>day>=a && day<=b);
const inNSWWesternExtension = day => NSW_SCHOOL_HOLIDAYS_WESTERN_EXTENSIONS.some(([a,b])=>day>=a && day<=b);
const inNSWHoliday = day => inNSWEasternHoliday(day)||inNSWWesternExtension(day);
export const holidayInfluences = day => ({qld:inHoliday(day),nswEastern:inNSWEasternHoliday(day),nswWestern:inNSWWesternExtension(day)});
const dayBeforeHoliday = day => QLD_SCHOOL_HOLIDAYS.some(([a])=>iso(dayMs(a)-MS)===day);
const dayBeforeNSW = day => NSW_SCHOOL_HOLIDAYS_EASTERN.some(([a])=>iso(dayMs(a)-MS)===day);
export const defaultCampaignSettings = () => ({
  monthOverrides:{},weekOverrides:{},dayOverrides:{},dayPlans:{},dayArchetypes:{},
  timingSignals:{
    holidays:{enabled:false,leadDays:[84,56,42,28,14,7]},
    nswHolidays:{enabled:true,leadDays:[84,42,14,7]},
    event:{enabled:true,leadDays:[28,14,7,3,1]},
    meeting:{enabled:true,leadDays:[14,7,1]},
    programme_open:{enabled:true,leadDays:[42,28,14,7]},
    programme_close:{enabled:true,leadDays:[28,14,7,1]}
  },
  milestones:[],
  videoShare:67, postingTime:'auto', limits:{
    weekdayMin:2,weekday:6,fridayMin:2,friday:8,weekendMin:2,weekend:10,
    longWeekendMin:3,longWeekend:12,publicHolidayMin:3,publicHoliday:14,
    holidayMin:3,holiday:12
  },
  delivery:{
    organic:['youtube','facebook','instagram','tiktok','noticeboard'],
    paid:['youtube','facebook','instagram','tiktok','noticeboard'],
    paidPlanning:false
  },
  layers:Object.fromEntries(CAMPAIGN_LAYERS.map(layer=>[layer.id,{enabled:false,visible:true,weekly:layer.frequency,
    audience:{membership:['all'],gender:['all'],place:layer.id==='nswHolidays'?['tourist','regional']:['all']}}]))
});
export const monthSettingsFor=(settings,month)=>settings.monthOverrides?.[month.slice(0,7)]||settings;
export const weekStart=day=>iso(dayMs(day)-((weekday(day)+6)%7)*MS);
export const settingsForDate=(settings,day)=>settings.dayOverrides?.[day]||
  settings.weekOverrides?.[weekStart(day)]||monthSettingsFor(settings,day);
export const scopeSettingsFor=(settings,scope,key)=>scope==='day'?
  settings.dayOverrides?.[key]||settingsForDate({...settings,dayOverrides:{}},key):
  scope==='week'?(settings.weekOverrides?.[key]||monthSettingsFor(settings,key)):
  monthSettingsFor(settings,key);
export const POSTING_DAY_TYPES=Object.freeze([
  {id:'weekday',label:'Weekday (Mon to Thu)',icon:'☀️'},
  {id:'friday',label:'Friday',icon:'✨'},
  {id:'weekend',label:'Weekend (Sat to Sun)',icon:'🏖️'},
  {id:'longWeekend',label:'Long weekend',icon:'🧳'},
  {id:'publicHoliday',label:'Public holiday',icon:'🎉'},
  {id:'holiday',label:'QLD school holidays',icon:'🎒'}
]);
// Queensland-local, editorial time-of-day slots. A proposed time is not a platform scheduling action.
const AUTO_TIME_WINDOWS=Object.freeze({
 weekday:['08:00','18:15','12:15','16:45','20:00','10:30','14:45','07:15','09:30','11:45','13:30','15:30','17:30','19:15','21:00','22:00','06:45','08:45','10:15','13:00'],
 friday:['07:30','17:30','12:15','19:30','15:30','09:30','21:00','11:00','14:00','18:30','08:30','10:15','13:15','16:15','20:30','22:00','06:45','09:45','11:45','14:45'],
 weekend:['08:00','17:30','11:00','19:30','13:30','09:15','15:15','20:45','07:15','10:00','12:15','14:30','16:30','18:30','21:30','06:45','08:45','10:45','12:45','22:00'],
 holiday:['08:15','17:45','11:30','15:00','19:15','09:30','13:30','20:30','07:00','10:30','12:30','14:30','16:45','18:45','21:15','22:00','07:45','08:45','11:00','13:00']
});
function suggestedTimeOfDay(day,index,bounds,post,anchor){
 if(anchor!=='auto'){
  const base=Number(anchor.slice(0,2))*60+Number(anchor.slice(3));
  const interval=60;
  const minute=Math.min(22*60+45,base+index*interval);
  return {time:String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'),reason:'User-selected base time, spaced by one hour'};
 }
 const type=bounds.category;
 const times=AUTO_TIME_WINDOWS[type]||AUTO_TIME_WINDOWS.weekday;
 let time=times[index%times.length];
 const layer=post.layerIds?.[0]||'';
 if(layer==='weather')time='07:15';
 if(post.id.startsWith('holiday-eve-')||post.id.startsWith('nsw-holiday-eve-'))time='17:15';
 if(post.timingSignal?.phase==='follow')time='18:15';
 const hour=Number(time.slice(0,2));
 const window=hour<11?'morning':hour<16?'midday/afternoon':'evening';
 return {time,window,reason:(layer==='weather'?'Morning official-forecast review':post.timingSignal?.phase==='follow'?'Post-event recap placeholder':type+' editorial '+window+' window')};
}
export const DEFAULT_DAILY_LIMITS=Object.freeze({
  weekdayMin:2,weekday:6,fridayMin:2,friday:8,weekendMin:2,weekend:10,
  longWeekendMin:3,longWeekend:12,publicHolidayMin:3,publicHoliday:14,
  holidayMin:3,holiday:12
});
export function normaliseDailyLimits(existing={}){
  const output={...DEFAULT_DAILY_LIMITS};
  const legacy=Object.keys(existing).sort().join(',')==='friday,holiday,weekday,weekend';
  for(const {id} of POSTING_DAY_TYPES){
    const max=existing[id],min=existing[id+'Min'];
    if(Number.isInteger(max))output[id]=Math.max(1,Math.min(20,id==='weekday'&&legacy&&max===2?4:max));
    if(Number.isInteger(min))output[id+'Min']=Math.max(1,Math.min(20,min));
    output[id]=Math.max(output[id],output[id+'Min']);
  }
  return output;
}
export function dayPostingBounds(day,limits){
  const signals=calendarDaySignals(day);
  const category=signals.publicHoliday?'publicHoliday':
    signals.longWeekend?'longWeekend':inHoliday(day)?'holiday':
    signals.weekday===5?'friday':[0,6].includes(signals.weekday)?'weekend':'weekday';
  const current=normaliseDailyLimits(limits);
  return {category,min:current[category+'Min'],max:current[category],...signals};
}
export const copyMonthSettings=settings=>structuredClone({
  videoShare:settings.videoShare,postingTime:settings.postingTime||'auto',
  limits:normaliseDailyLimits(settings.limits),delivery:settings.delivery,layers:settings.layers
});
function basePost(layer,day,weekKey,index){
  const topic=layer.id==='weather'?
    layer.topics[weekday(day)-4]:layer.topics[numberHash(layer.id+weekKey+day+index)%layer.topics.length];
  const weather=layer.id==='weather';
  const text=weather?'Use a freshly verified outdoor weather forecast and official safety advice. Never present a future forecast as already verified.':
    ['events','funding','facilities','volunteers','news'].includes(layer.id)?'Verify the real club record, dates, permissions and current status before publishing.':'Sandy Sports is only a proposal. Confirm any date, sport rule, safety claim, permission or image before publishing.';
  return {id:layer.id+'-'+day,date:day,layerIds:[layer.id],title:topic,brief:text,cta:layer.cta,
    audience:null,priority:layer.priority,composite:false,sections:[topic],status:'suggestion'};
}
function assignWeek(days,settings,postsByDay){
  // Preserve the normal week's pattern for every unaffected day. Individual day,
  // Monday-start week and month overrides only replace their selected dates.
  const baseline=new Map(days.map(day=>[day,[]]));
  assignSegment(days,settings,baseline);
  const groups=new Map();
  for(const day of days){
    const selected=settingsForDate(settings,day);
    if(selected===settings){postsByDay.get(day).push(...baseline.get(day));continue;}
    if(!groups.has(selected))groups.set(selected,[]);
    groups.get(selected).push(day);
  }
  for(const [config,scopedDays] of groups){
    const scoped=new Map(scopedDays.map(day=>[day,[]]));
    assignSegment(scopedDays,config,scoped);
    for(const day of scopedDays)postsByDay.get(day).push(...scoped.get(day));
  }
}
function assignSegment(days,settings,postsByDay){
  const key=days[0].slice(0,7)+'-'+days[0];
  for(const layer of CAMPAIGN_LAYERS){
    const preference=settings.layers[layer.id];
    if(!preference?.enabled || !preference.weekly) continue;
    let eligible=days.filter(day=>!layer.holidayOnly||(layer.id==='nswHolidays'?inNSWHoliday(day):inHoliday(day)));
    if(layer.id==='weather')eligible=eligible.filter(day=>[4,5,6].includes(weekday(day)));
    const isQLDWeek=days.some(inHoliday),isNSWWeek=days.some(inNSWHoliday);
    const boost=isQLDWeek && ['volleyball','other','safety','visitors','voice','health'].includes(layer.id)?1:
      !isQLDWeek && isNSWWeek && layer.id==='visitors'?1:0;
    const westernOnly=layer.id==='nswHolidays' && eligible.every(day=>!inNSWEasternHoliday(day));
    const weekly=days.length>=7?preference.weekly:Math.ceil(preference.weekly*days.length/7);
    const frequency=Math.min(eligible.length,westernOnly?Math.min(weekly,1):weekly+boost);
    eligible.sort((a,b)=>{
      const weight=day=>(layer.id==='nswHolidays' && inNSWHoliday(day) && !inHoliday(day)?70:0)+
        (inHoliday(day)?45:0)+([5,6,0].includes(weekday(day))?20:0)+(weekday(day)===5?10:0);
      return weight(b)-weight(a) || numberHash(layer.id+key+a)%100-numberHash(layer.id+key+b)%100;
    });
    const chosen=layer.id==='weather' ? eligible.sort((a,b)=>weekday(a)-weekday(b)).slice(0,frequency) : eligible.slice(0,frequency);
    for(const day of chosen){const post=basePost(layer,day,key,chosen.indexOf(day));post.audience=preference.audience;postsByDay.get(day).push(post);}
  }
}
const signalTitles={
  holidays:'QLD school holiday',
  nswHolidays:'NSW school holiday',
  event:'Confirmed club event',
  meeting:'Confirmed club meeting',
  programme_open:'Confirmed sport programme opening',
  programme_close:'Confirmed sport programme closing'
};
function insertTimingSignals(settings,postsByDay){
  const rules=settings.timingSignals||{};
  const events=[
    ...QLD_SCHOOL_HOLIDAYS.map(([date])=>({kind:'holidays',date,title:'Queensland school holidays'})),
    ...NSW_SCHOOL_HOLIDAYS_EASTERN.map(([date])=>({kind:'nswHolidays',date,title:'NSW school holidays'})),
    ...(settings.milestones||[]).filter(e=>e.confirmed===true||String(e.id||'').startsWith('m-import-'))
  ];
  for(const event of events){
    const rule=rules[event.kind];
    if(!rule?.enabled)continue;
    const imported=String(event.id||'').startsWith('m-import-');
    const tentative=imported&&!event.confirmed;
    const layer=event.kind==='holidays'?'holidays':event.kind==='nswHolidays'?'nswHolidays':
      event.kind==='meeting'?'events':event.kind.startsWith('programme_')?'events':'events';
    if(tentative){
      // A working committee calendar should inform private content preparation,
      // but a tentative date must never become a public invitation by default.
      const chosen=rule.leadDays.filter(n=>n>=7).sort((a,b)=>a-b)[0]||7;
      const draftDate=iso(dayMs(event.date)-chosen*MS);
      const config=settingsForDate(settings,draftDate);
      if(postsByDay.has(draftDate)&&config.layers[layer]?.enabled){
        postsByDay.get(draftDate).push({
          id:'anchor-planning-'+event.id+'-'+event.date,
          date:draftDate,layerIds:[layer],
          title:'Tentative event planning: '+event.title,
          brief:'Internal draft only. Ask the committee to confirm the event date, permissions and promotional wording before publishing any announcement. Keep room for unexpected opportunities.',
          cta:'Confirm the committee event calendar',audience:config.layers[layer].audience,
          priority:11,sections:['Provisional planning only'],composite:false,status:'suggestion',
          timingSignal:{kind:event.kind,title:event.title,targetDate:event.date,leadDays:chosen,
            tentative:true,phase:'planning',importedCalendar:true,sourceUrl:''}
        });
      }
      continue;
    }
    for(const leadDays of rule.leadDays){
      const date=iso(dayMs(event.date)-leadDays*MS);
      if(!postsByDay.has(date))continue;
      const selected=settingsForDate(settings,date);
      if(!selected.layers[layer]?.enabled)continue;
      const topic=event.title||signalTitles[event.kind]||'Confirmed milestone';
      const label=leadDays>=7?Math.round(leadDays/7)+' weeks':leadDays+' days';
      const title=event.kind==='holidays'||event.kind==='nswHolidays'?
        'Holiday inspiration: '+label+' before '+topic:
        label+' until '+topic+': prepare an informative club update';
      const brief=event.kind==='holidays'||event.kind==='nswHolidays'?
        'Early visitor inspiration and trip-planning ideas. Verify travel, bookings and local conditions; do not imply confirmed club events.':
        'A lead-in idea linked to a user-confirmed milestone. Verify dates, permissions, rules and the source again before posting.';
      postsByDay.get(date).push({
        id:'signal-'+event.kind+'-'+event.date+'-'+leadDays+'-'+(event.id||'standard'),
        date,layerIds:[layer],title,brief,
        cta:event.kind==='holidays'||event.kind==='nswHolidays'?'Explore Sandy Sports visitor ideas':'Check verified Sandy Sports progress',
        audience:selected.layers[layer].audience,priority:leadDays<=7?10:6,sections:[title],
        composite:false,status:'suggestion',
        timingSignal:{kind:event.kind,title:topic,targetDate:event.date,leadDays,
          phase:'lead',importedCalendar:imported,tentative:false,sourceUrl:event.sourceUrl||''}
      });
    }
    if(imported&&['event','meeting'].includes(event.kind)){
      for(const [offset,phase] of [[0,'day'],[1,'follow']]){
        const postingDate=iso(dayMs(event.date)+offset*MS),config=settingsForDate(settings,postingDate);
        if(!postsByDay.has(postingDate)||!config.layers[layer]?.enabled)continue;
        const title=phase==='day'?'Event day: '+event.title:'After '+event.title+': prepare a careful recap';
        const brief=phase==='day'?
          'Prepare a day-of post using only the confirmed time, access, event details and permission from the club. Re-check immediately before posting.':
          'Prepare a thank-you or recap only after verifying what actually happened, results, photographs and participant permission. Do not invent attendance, winners or outcomes.';
        postsByDay.get(postingDate).push({
          id:'anchor-'+phase+'-'+event.id+'-'+event.date,
          date:postingDate,layerIds:[layer],title,brief,cta:'Check confirmed club event information',
          audience:config.layers[layer].audience,priority:phase==='day'?13:7,
          sections:[title],composite:false,status:'suggestion',
          timingSignal:{kind:event.kind,title:event.title,targetDate:event.date,
            phase,importedCalendar:true,tentative:false,leadDays:0,sourceUrl:event.sourceUrl||''}
        });
      }
    }
  }
}

function combine(candidates,cap){
  if(!cap)return {posts:[],omitted:candidates.length};
  const selected=candidates.slice(0,cap);
  const overflow=candidates.slice(cap);
  // A short roundup can carry two additional subjects, reducing posting pressure.
  if(overflow.length && selected.length){
    // Never put tentative calendar dates into a public-facing multi-topic roundup.
    const target=selected.find(p=>!p.timingSignal&&p.layerIds[0]!=='safety')||
      selected.find(p=>!p.timingSignal);
    // Do not silently mix targeted member, gender or visitor groups in one post.
    const additions=[];
    for(let i=0;i<overflow.length && additions.length<2;){
      if(target&&!overflow[i].timingSignal&&JSON.stringify(overflow[i].audience)===JSON.stringify(target.audience))
        additions.push(...overflow.splice(i,1));
      else i++;
    }
    if(target){
      target.layerIds.push(...additions.flatMap(p=>p.layerIds));
      target.sections.push(...additions.map(p=>p.title));
    }
    if(target&&additions.length){
      target.composite=true;
      target.title='30-second Sandy Sports sports-and-community roundup: '+target.sections[0];
      target.brief+=' Include concise segments from the other sources; verify every claim.';
    }
  }
  return {posts:selected,omitted:overflow.length};
}
export function generateCampaignYear(startMonth,settings=defaultCampaignSettings()){
  if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(startMonth))throw new Error('Use a YYYY-MM start month.');
  const first=dayMs(startMonth+'-01');
  if(!Number.isFinite(first))throw new Error('Invalid start month.');
  const endDate=new Date(Date.UTC(Number(startMonth.slice(0,4)),Number(startMonth.slice(5))-1+12,1)).getTime();
  const days=[];for(let ms=first;ms<endDate;ms+=MS)days.push(iso(ms));
  const postsByDay=new Map(days.map(day=>[day,[]]));
  let week=[];
  for(const day of days){if(week.length && weekday(day)===1){assignWeek(week,settings,postsByDay);week=[];}week.push(day);}
  if(week.length)assignWeek(week,settings,postsByDay);
  for(const day of days.filter(dayBeforeHoliday)){
    const monthSettings=settingsForDate(settings,day);
    if(!monthSettings.layers.holidays?.enabled)continue;
    postsByDay.get(day).push({id:'holiday-eve-'+day,date:day,layerIds:['holidays'],title:'Queensland school holidays start tomorrow: invite feedback on the proposal',
      brief:'Confirm Queensland state school holiday dates and local conditions before publishing.',cta:'Explore the Sandy Sports proposal',
      audience:monthSettings.layers.holidays.audience,priority:11,sections:['Holiday countdown'],composite:false,status:'suggestion'});
  }
  for(const day of days.filter(dayBeforeNSW)){
    const monthSettings=settingsForDate(settings,day);
    if(!monthSettings.layers.nswHolidays?.enabled)continue;
    postsByDay.get(day).push({id:'nsw-holiday-eve-'+day,date:day,layerIds:['nswHolidays'],title:'NSW school holidays start tomorrow: ask visitors what they would play',
      brief:'Verify NSW term dates and current ferry, weather and outdoor recreation information before publishing.',cta:'Explore the Sandy Sports visitor ideas',
      audience:monthSettings.layers.nswHolidays.audience,priority:9,sections:['NSW holiday lead-in'],composite:false,status:'suggestion'});
  }
  insertTimingSignals(settings,postsByDay);
  const anchorsByDay=new Map();
  for(const milestone of settings.milestones||[]){
    if(!milestone.confirmed&&!String(milestone.id||'').startsWith('m-import-'))continue;
    if(!anchorsByDay.has(milestone.date))anchorsByDay.set(milestone.date,[]);
    anchorsByDay.get(milestone.date).push({
      id:milestone.id,title:milestone.title,kind:milestone.kind,confirmed:milestone.confirmed
    });
  }
  const dayCards=[],posts=[];
  for(const [day,candidates] of postsByDay){
    const effective=settingsForDate(settings,day);
    const bounds=dayPostingBounds(day,effective.limits);
    const eligible=CAMPAIGN_LAYERS.filter(layer=>effective.layers[layer.id]?.enabled&&
      effective.layers[layer.id]?.weekly>0&&
      (!layer.holidayOnly||(layer.id==='nswHolidays'?inNSWHoliday(day):inHoliday(day)))&&
      (layer.id!=='weather'||[4,5,6].includes(weekday(day))));
    // Every day must reach its configured minimum. Use different enabled topics
    // before repeating a layer, and never fabricate official conditions or club events.
    for(let i=candidates.length;eligible.length&&i<bounds.min;i++){
      const present=new Set(candidates.flatMap(post=>post.layerIds));
      const pool=eligible.filter(layer=>!present.has(layer.id));
      const options=pool.length?pool:eligible;
      const picked=options.sort((a,b)=>numberHash(day+'-'+i+'-'+a.id)-numberHash(day+'-'+i+'-'+b.id))[0];
      if(picked){
        const post=basePost(picked,day,'minimum-'+day,i);
        post.id='minimum-'+picked.id+'-'+day+'-'+i;
        post.priority=1;post.audience=effective.layers[picked.id].audience;
        candidates.push(post);
      }else{
        candidates.push({id:'daily-'+day+'-'+i,date:day,layerIds:['daily'],
          title:'Choose Sandy Sports topic '+(i+1)+' for today',
          brief:'Write a genuine sport, wellbeing or community idea using confirmed information. This is an editable planning placeholder.',
          cta:'Visit the club website',audience:{membership:['all'],gender:['all'],place:['all']},
          priority:0,composite:false,sections:['One relevant daily club update'],status:'suggestion'});
      }
    }
    candidates.sort((a,b)=>b.priority-a.priority||numberHash(a.id)-numberHash(b.id));
    // Keep an editorial slot for regular/whimsical content when several annual
    // event reminders coincide. A curated day can intentionally override this.
    if(bounds.max>1){
      const anchors=candidates.filter(p=>p.timingSignal?.importedCalendar);
      const other=candidates.filter(p=>!p.timingSignal?.importedCalendar);
      if(anchors.length>=bounds.max&&other.length){
        candidates.splice(0,candidates.length,...anchors.slice(0,bounds.max-1),
          other[0],...anchors.slice(bounds.max-1),...other.slice(1));
      }
    }
    const dayPlan=settings.dayPlans?.[day];
    // A curated day replaces generated suggestions, not the other way around.
    // The club retains full control even when a monthly pattern is later changed.
    const manual=Array.isArray(dayPlan?.items)&&dayPlan.items.length>0;
    const result=manual?{omitted:0,posts:dayPlan.items.map((slot,index)=>{
      const layer=CAMPAIGN_LAYERS.find(item=>item.id===slot.layerId)||CAMPAIGN_LAYERS.find(item=>item.id==='community');
      return {id:'curated-'+day+'-'+slot.id,date:day,layerIds:[layer.id],
        title:slot.title,brief:slot.brief,cta:layer.cta,
        audience:effective.layers[layer.id].audience,priority:20,composite:false,
        sections:[slot.title],status:'suggestion',curated:true,
        requestedFormat:slot.format,requestedTime:slot.time};
    })}:combine(candidates,bounds.max);
    const {posts:chosen,omitted}=result;
    dayCards.push({date:day,holiday:inHoliday(day),nswHoliday:inNSWHoliday(day),nswWesternOnly:inNSWWesternExtension(day),
      publicHoliday:bounds.publicHoliday,publicHolidayName:bounds.publicHolidayName,
      partialPublicHoliday:bounds.partialPublicHoliday,longWeekend:bounds.longWeekend,
      postingCategory:bounds.category,minimum:bounds.min,maximum:bounds.max,
      eventAnchors:anchorsByDay.get(day)||[],
      manualPlan:manual,signature:manual?(dayPlan.signature||null):null,omitted,count:chosen.length});
    posts.push(...chosen);
  }
  const composites=posts.filter(p=>p.composite);
  const videoIds=new Set();
  // Monthly ratios are independent. Composites take precedence, then evenly-seeded candidates.
  for(const month of [...new Set(posts.map(p=>p.date.slice(0,7)))]){
    const current=posts.filter(p=>p.date.startsWith(month)&&!p.curated);
    const groups=new Map();
    for(const post of current){
      const effective=settingsForDate(settings,post.date);
      if(!groups.has(effective))groups.set(effective,[]);
      groups.get(effective).push(post);
    }
    for(const [effective,group] of groups){
      const count=Math.round(group.length*effective.videoShare/100);
      const composite=group.filter(p=>p.composite),other=group.filter(p=>!p.composite)
        .sort((a,b)=>numberHash('video-'+a.id)-numberHash('video-'+b.id));
      for(const p of [...composite,...other.slice(0,Math.max(0,count-composite.length))])videoIds.add(p.id);
    }
  }
  for(const p of posts){
    p.format=p.curated?(p.requestedFormat==='video'?'30-second vertical video':p.requestedFormat):
      videoIds.has(p.id)?'30-second vertical video':['image','carousel','link'][numberHash('format-'+p.id)%3];
    p.aspectRatio=p.format.startsWith('30-second')?'9:16':p.format==='link'?'1.91:1':'4:5';
    p.size=p.format.startsWith('30-second')?'1080×1920':p.format==='link'?'1200×630':'1080×1350';
    p.durationSeconds=p.format.startsWith('30-second')?30:null;
    const anchor=settingsForDate(settings,p.date).postingTime||'auto';
    const index=posts.filter(other=>other.date===p.date).indexOf(p);
    const timing=suggestedTimeOfDay(p.date,index,dayPostingBounds(p.date,settingsForDate(settings,p.date).limits),p,anchor);
    p.suggestedTime=p.curated?p.requestedTime:timing.time;
    p.timeOfDaySignal={window:timing.window||'user-selected',reason:timing.reason,timeZone:'Australia/Brisbane'};
    p.creativeVariants=creativeVariantsFor(p,settingsForDate(settings,p.date).delivery);
    p.destinations=[...new Set(p.creativeVariants.filter(v=>v.distribution==='organic').map(v=>v.platform))];
    // The existing social post editor supports only the four connected club channels.
    // The Noticeboard is a separate, unconnected pilot and is never sent there.
    p.channels=p.destinations.filter(id=>id!=='noticeboard');
    p.storyboard=p.durationSeconds? p.sections.length>1?['0-3s: Hook',...p.sections.map((s,i)=>'Segment '+(i+1)+': '+s),'Final 3s: Club link / call to action']:['0-3s: Hook','3-24s: '+p.sections[0],'24-30s: Call to action']:[];
  }
  return {startMonth,posts,days:dayCards,totals:{posts:posts.length,videos:posts.filter(p=>p.durationSeconds).length,combined:composites.length,omitted:dayCards.reduce((n,d)=>n+d.omitted,0)}};
}
