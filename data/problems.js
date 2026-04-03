// problems.js — static data loaded as a plain script (no ES modules)

// Derive display name from a filename stem:
// "rumi"     → "Rumi"
// "soda-pop" → "Soda-Pop"
function deriveName(stem) {
  return stem.split("-").map(function (part) {
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join("-");
}

var CHARACTERS = [
  { id: "rumi",     name: deriveName("rumi"),     image: "assets/characters/rumi.png" },
  { id: "mira",     name: deriveName("mira"),     image: "assets/characters/mira.png" },
  { id: "zoey",     name: deriveName("zoey"),     image: "assets/characters/zoey.png" },
  { id: "soda-pop", name: deriveName("soda-pop"), image: "assets/characters/soda-pop.png" },
];

var LEVEL_META = {
  1: { name: "Recruit",      icon: "🌟", desc: "Number recognition — 1 to 10" },
  2: { name: "Apprentice",   icon: "⚔️",  desc: "Counting up to 10" },
  3: { name: "Hunter",       icon: "🔥", desc: "Addition — sums up to 10" },
  4: { name: "Demon Slayer", icon: "💎", desc: "Subtraction — up to 10" },
};

var PROBLEMS_PER_LEVEL = 10;
