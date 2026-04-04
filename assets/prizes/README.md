# Prize GIFs

Animated GIFs shown as a full-screen popup when Hayden answers correctly.

## Adding new prizes

1. Drop the `.gif` file into this folder named `prizeN.gif`  
   (e.g. `prize11.gif`, `prize12.gif`, …)
2. Add the filename to `manifest.js`:
   ```js
   window.PRIZE_MANIFEST = [
     ...
     "prize11.gif",
   ];
   ```
3. `git add assets/prizes/prize11.gif assets/prizes/manifest.js`
4. `git commit -m "Add prize11"` and `git push` — done!

## How it works

On page load the game silently tests every filename in `manifest.js`
by preloading it as an `<img>`. Only files that actually load make it
into the active pool. Missing files are ignored with no error shown.

The game picks randomly from the active pool and never shows the same
gif twice in a row.

If the pool is empty (all files missing), a CSS confetti animation
plays instead.
