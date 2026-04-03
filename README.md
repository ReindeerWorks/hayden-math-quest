# Hayden's Math Quest

A K-pop demon hunter math game for ages 4+. Hayden helps her demon hunter collect power gems by solving math problems across four levels.

## Live URL

**https://reindeerworks.github.io/hayden-math-quest**

## How to play

Open `index.html` directly in any browser — no server or build step required.

## Levels

| Level | Name | Topic |
|---|---|---|
| 1 | Recruit | Number recognition 1–10 |
| 2 | Apprentice | Counting up to 10 |
| 3 | Hunter | Addition — sums up to 10 |
| 4 | Demon Slayer | Subtraction — up to 10 |

Each level has 10 problems. Completing a level unlocks the next.

## Adding images

### Character images — `assets/characters/`

Used as counting objects in problems. Name files in lowercase:

```
rumi.png
mira.png
zoey.png
soda-pop.png
```

The display name is derived from the filename automatically:
`soda-pop.png` → **Soda-Pop**, `rumi.png` → **Rumi**, etc.

Missing characters show a purple letter placeholder — game still works.

### Hunter images — `assets/hunters/`

Shown at the top of the problem card as a fallback when the prize GIF is missing:

```
hunter1.png   ← Level 1 fallback
hunter2.png
hunter3.png
hunter4.png
```

### Prize GIFs — `assets/prizes/`

Animated reward shown during the level and on the win screen:

```
prize_level1.gif
prize_level2.gif
prize_level3.gif
prize_level4.gif
```

Fallback chain: `prize_levelN.gif` → `hunterN.png` → purple emoji placeholder.
