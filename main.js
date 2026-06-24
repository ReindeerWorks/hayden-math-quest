// main.js — Hayden's Math Quest
// Requires data/problems.js (CHARACTERS, LEVEL_META, PROBLEMS_PER_LEVEL globals).

(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // Success phrases
  // ═══════════════════════════════════════════════════════════════════════════

  var SUCCESS_PLAIN = [
    "That's right!",
    "Well done!",
    "Correct!",
    "Brilliant!",
    "You got it!",
    "Perfect!",
    "Awesome!",
    "Fantastic!",
  ];

  var SUCCESS_HAYDEN = [
    "Amazing Hayden!",
    "You got it Hayden!",
    "Hayden you're a math hero!",
    "Incredible Hayden!",
    "Hayden that's right!",
    "Woohoo Hayden!",
    "Hayden you're unstoppable!",
    "Yes Hayden, you're a genius!",
  ];

  var _roundsSinceName = 0;

  function pickSuccessMsg() {
    _roundsSinceName++;
    var threshold = 2 + Math.floor(Math.random() * 2);
    if (_roundsSinceName >= threshold) {
      _roundsSinceName = 0;
      return SUCCESS_HAYDEN[Math.floor(Math.random() * SUCCESS_HAYDEN.length)];
    }
    return SUCCESS_PLAIN[Math.floor(Math.random() * SUCCESS_PLAIN.length)];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  var _level        = 1;
  var _problemIndex = 0;
  var _problems     = [];
  var _starsEarned  = 0;
  var _answered     = false;
  var _audioCtx     = null;

  // ── Prize pool (populated at boot by probing each manifest entry) ──
  var _prizePool      = [];  // filenames confirmed to exist
  var _lastPrizeName  = null;

  function initPrizePool() {
    if (!window.PRIZE_MANIFEST || !window.PRIZE_MANIFEST.length) return;
    window.PRIZE_MANIFEST.forEach(function (filename) {
      var probe = new Image();
      probe.addEventListener("load", function () {
        _prizePool.push(filename);
      });
      // on error: silently skip — file doesn't exist
      probe.src = prizeSrc(filename);
    });
  }

  // Resolve a prize entry to an image src. Bare filenames live under
  // assets/prizes/; absolute URLs (shared library GIFs) are used as-is.
  function prizeSrc(name) {
    return /^https?:/.test(name) ? name : "assets/prizes/" + name;
  }

  // Pick a random prize filename, never the same one twice in a row.
  // Returns null if pool is empty.
  function pickPrize() {
    if (!_prizePool.length) return null;
    if (_prizePool.length === 1) return _prizePool[0];
    var name;
    var tries = 0;
    do {
      name = _prizePool[Math.floor(Math.random() * _prizePool.length)];
      tries++;
    } while (name === _lastPrizeName && tries < 10);
    _lastPrizeName = name;
    return name;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Utilities
  // ═══════════════════════════════════════════════════════════════════════════

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
  }

  function playChime() {
    try {
      var ctx = getAudioCtx();
      [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        var t0 = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.28, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
        osc.start(t0); osc.stop(t0 + 0.5);
      });
    } catch (e) {}
  }

  function playWrongBuzz() {
    try {
      var ctx = getAudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sawtooth"; osc.frequency.value = 180;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }

  function speak(text) {
    // Routed through the shared HaydenSpeak helper (waits for voices + first
    // tap on Android). Guarded so a CDN hiccup never breaks the game.
    if (window.HaydenSpeak) HaydenSpeak.say(text, { rate: 0.85, pitch: 1.1 });
  }

  // Speak a number twice with an 800ms pause between, chained via onEnd
  function speakNumberTwice(n) {
    if (!window.HaydenSpeak) return;
    var word = String(n);
    HaydenSpeak.say(word, {
      rate: 0.85,
      pitch: 1.1,
      onEnd: function () {
        setTimeout(function () {
          HaydenSpeak.say(word, { rate: 0.85, pitch: 1.1 });
        }, 800);
      }
    });
  }

  // ── localStorage helpers ──

  function getBestStars(level) {
    return Number(localStorage.getItem("mathBestStars_" + level) || 0);
  }

  function setBestStars(level, n) {
    if (n > getBestStars(level)) localStorage.setItem("mathBestStars_" + level, n);
  }

  function getUnlocked() {
    return Number(localStorage.getItem("mathUnlocked") || 1);
  }

  function setUnlocked(n) {
    if (n > getUnlocked()) localStorage.setItem("mathUnlocked", n);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Problem generation
  // ═══════════════════════════════════════════════════════════════════════════

  function randomChar() {
    return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  }

  function generateChoices(correct, min, max) {
    var pool = [];
    for (var d = 1; d <= 4; d++) {
      if (correct - d >= min) pool.push(correct - d);
      if (correct + d <= max) pool.push(correct + d);
    }
    pool = shuffle(pool);
    var choices = [correct];
    for (var i = 0; i < pool.length && choices.length < 3; i++) {
      if (choices.indexOf(pool[i]) === -1) choices.push(pool[i]);
    }
    return shuffle(choices);
  }

  function generateProblem(level) {
    var chr = randomChar();
    var p   = { character: chr };

    if (level === 1) {
      // Audio number recognition — number is NOT shown, only heard
      var n  = 1 + Math.floor(Math.random() * 10);
      p.type     = 1;
      p.number   = n;
      p.answer   = n;
      p.prompt   = "Which number did you hear?";
      p.equation = null;
      p.choices  = generateChoices(n, 1, 10);

    } else if (level === 2) {
      var n  = 1 + Math.floor(Math.random() * 10);
      p.type     = 2;
      p.count    = n;
      p.answer   = n;
      p.prompt   = "How many " + chr.name + "s are there?";
      p.equation = null;
      p.choices  = generateChoices(n, 1, 10);

    } else if (level === 3) {
      var a    = 1 + Math.floor(Math.random() * 9);
      var maxB = Math.max(1, 10 - a);
      var b    = 1 + Math.floor(Math.random() * maxB);
      p.type     = 3;
      p.a        = a; p.b = b;
      p.answer   = a + b;
      p.prompt   = "How many " + chr.name + "s does the hunter have?";
      p.equation = a + " + " + b + " = ?";
      p.choices  = generateChoices(a + b, 1, 10);

    } else if (level === 4) {
      var a = 2 + Math.floor(Math.random() * 9);
      var b = 1 + Math.floor(Math.random() * (a - 1));
      p.type     = 4;
      p.a        = a; p.b = b;
      p.answer   = a - b;
      p.prompt   = "How many " + chr.name + "s are left?";
      p.equation = a + " \u2212 " + b + " = ?";
      p.choices  = generateChoices(a - b, 0, 10);
    }

    return p;
  }

  function generateProblems(level) {
    var arr = [];
    for (var i = 0; i < PROBLEMS_PER_LEVEL; i++) arr.push(generateProblem(level));
    return arr;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM builders
  // ═══════════════════════════════════════════════════════════════════════════

  // Character image cell (optional red-X overlay for subtraction)
  function buildCharCell(charObj, crossed) {
    var cell = document.createElement("div");
    cell.className = "char-cell";

    var img = document.createElement("img");
    img.src = charObj.image; img.alt = charObj.name;
    img.width = 72; img.height = 72;
    img.addEventListener("error", function () {
      var ph = document.createElement("div");
      ph.className = "char-placeholder";
      ph.textContent = charObj.name.charAt(0);
      cell.replaceChild(ph, img);
    });
    cell.appendChild(img);

    if (crossed) {
      var x = document.createElement("div");
      x.className = "cross-x"; x.textContent = "✕";
      x.setAttribute("aria-hidden", "true");
      cell.appendChild(x);
    }
    return cell;
  }

  function buildCharRow(count, charObj, crossCount) {
    var row = document.createElement("div");
    row.className = "char-row";
    for (var i = 0; i < count; i++) {
      row.appendChild(buildCharCell(charObj, crossCount && i >= count - crossCount));
    }
    return row;
  }

  function buildObjectsArea(p) {
    var area = document.createElement("div");
    area.className = "objects-area";

    if (p.type === 1) {
      // Level 1: audio only — show listen icon and "hear again" button
      var listenIcon = document.createElement("div");
      listenIcon.className = "listen-icon";
      listenIcon.textContent = "👂";
      area.appendChild(listenIcon);

      var hearBtn = document.createElement("button");
      hearBtn.className = "hear-again-btn";
      hearBtn.innerHTML = "🔊 Hear it again";
      hearBtn.addEventListener("click", function () { speakNumberTwice(p.number); });
      area.appendChild(hearBtn);

    } else if (p.type === 2) {
      area.appendChild(buildCharRow(p.count, p.character, 0));

    } else if (p.type === 3) {
      var addRow = document.createElement("div");
      addRow.className = "add-row";

      var grpA = document.createElement("div");
      grpA.className = "add-group";
      grpA.appendChild(buildCharRow(p.a, p.character, 0));

      var plus = document.createElement("div");
      plus.className = "big-operator"; plus.textContent = "+";

      var grpB = document.createElement("div");
      grpB.className = "add-group";
      grpB.appendChild(buildCharRow(p.b, p.character, 0));

      addRow.appendChild(grpA);
      addRow.appendChild(plus);
      addRow.appendChild(grpB);
      area.appendChild(addRow);

    } else if (p.type === 4) {
      area.appendChild(buildCharRow(p.a, p.character, p.b));
    }

    return area;
  }

  function buildStarsRow(earned) {
    var row = document.getElementById("stars-row");
    row.innerHTML = "";
    for (var i = 0; i < PROBLEMS_PER_LEVEL; i++) {
      var pip = document.createElement("span");
      pip.className = "star-pip" + (i < earned ? " lit" : "");
      pip.textContent = "⭐";
      pip.setAttribute("aria-hidden", "true");
      row.appendChild(pip);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Prize popup — shown on every correct answer, auto-dismisses after 2.5s
  // ═══════════════════════════════════════════════════════════════════════════

  function showPrizePopup(msg, onDone) {
    var overlay = document.createElement("div");
    overlay.id = "prize-popup";

    var prizeFile = pickPrize();

    if (prizeFile) {
      var img = document.createElement("img");
      img.className = "prize-popup-img";
      img.alt = "Prize!";
      img.src = prizeSrc(prizeFile);
      img.addEventListener("error", function () {
        // Remove bad entry from pool so we don't try it again
        var idx = _prizePool.indexOf(prizeFile);
        if (idx !== -1) _prizePool.splice(idx, 1);
        img.remove();
        var cc = document.createElement("div");
        cc.className = "prize-popup-confetti";
        launchConfetti(cc);
        overlay.insertBefore(cc, overlay.firstChild);
      });
      overlay.appendChild(img);
    } else {
      // Pool empty — use confetti
      var cc = document.createElement("div");
      cc.className = "prize-popup-confetti";
      launchConfetti(cc);
      overlay.appendChild(cc);
    }

    var msgDiv = document.createElement("div");
    msgDiv.className = "prize-popup-msg";
    msgDiv.textContent = msg;
    overlay.appendChild(msgDiv);

    document.body.appendChild(overlay);

    // Auto-dismiss
    setTimeout(function () {
      overlay.style.transition = "opacity .3s";
      overlay.style.opacity    = "0";
      setTimeout(function () {
        overlay.remove();
        onDone();
      }, 300);
    }, 2500);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Level Select
  // ═══════════════════════════════════════════════════════════════════════════

  function mountLevelSelect() {
    document.getElementById("stars-row").innerHTML = "";
    var app = document.getElementById("app");
    app.innerHTML = "";

    var screen = document.createElement("div");
    screen.id = "level-select";

    var h1 = document.createElement("h1");
    h1.textContent = "Choose a Quest!";
    screen.appendChild(h1);

    var sub = document.createElement("p");
    sub.textContent = "Help the demon hunter collect power gems!";
    screen.appendChild(sub);

    var unlocked = getUnlocked();

    [1, 2, 3, 4].forEach(function (lvl) {
      var meta     = LEVEL_META[lvl];
      var best     = getBestStars(lvl);
      var isLocked = lvl > unlocked;

      var btn = document.createElement("button");
      btn.className = "level-btn" + (isLocked ? " locked" : "");
      btn.disabled  = isLocked;
      btn.setAttribute("aria-label", meta.name + (isLocked ? " — locked" : ""));

      btn.innerHTML =
        '<span class="level-icon">' + (isLocked ? "🔒" : meta.icon) + '</span>' +
        '<span class="level-info">' +
          '<span class="level-name">Level ' + lvl + ': ' + meta.name + '</span>' +
          '<span class="level-desc">' + meta.desc + '</span>' +
        '</span>' +
        '<span class="level-best">' + (isLocked ? "Locked" : best + "/" + PROBLEMS_PER_LEVEL + " ⭐") + '</span>';

      if (!isLocked) {
        btn.addEventListener("click", function () { startLevel(lvl); });
      }
      screen.appendChild(btn);
    });

    app.appendChild(screen);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Game
  // ═══════════════════════════════════════════════════════════════════════════

  function startLevel(level) {
    _level        = level;
    _problemIndex = 0;
    _starsEarned  = 0;
    _answered     = false;
    _problems     = generateProblems(level);
    buildStarsRow(0);
    renderProblem();
  }

  function renderProblem() {
    _answered = false;
    var p   = _problems[_problemIndex];
    var app = document.getElementById("app");
    app.innerHTML = "";

    var card = document.createElement("div");
    card.id = "problem-card";

    // ── Card header (back + progress) ──
    var cardHeader = document.createElement("div");
    cardHeader.className = "card-header";

    var backBtn = document.createElement("button");
    backBtn.className = "back-btn"; backBtn.textContent = "← Levels";
    backBtn.addEventListener("click", mountLevelSelect);
    cardHeader.appendChild(backBtn);

    var progress = document.createElement("div");
    progress.className   = "progress-label";
    progress.textContent = "Problem " + (_problemIndex + 1) + " of " + PROBLEMS_PER_LEVEL;
    cardHeader.appendChild(progress);
    card.appendChild(cardHeader);

    // ── Prompt ──
    var prompt = document.createElement("div");
    prompt.className   = "prompt-text";
    prompt.textContent = p.prompt;
    card.appendChild(prompt);

    // ── Objects area ──
    card.appendChild(buildObjectsArea(p));

    // ── Equation ──
    if (p.equation) {
      var eq = document.createElement("div");
      eq.className   = "equation-text";
      eq.textContent = p.equation;
      card.appendChild(eq);
    }

    // ── Divider ──
    var hr = document.createElement("hr");
    hr.className = "divider";
    card.appendChild(hr);

    // ── Tap label ──
    var tapLabel = document.createElement("div");
    tapLabel.className   = "tap-label";
    tapLabel.textContent = "tap the right answer";
    card.appendChild(tapLabel);

    // ── Answer buttons ──
    var answersRow = document.createElement("div");
    answersRow.className = "answers-row";
    p.choices.forEach(function (choice) {
      var btn = document.createElement("button");
      btn.className   = "answer-btn";
      btn.textContent = choice;
      btn.addEventListener("click", function () {
        handleAnswer(choice, p, btn, answersRow);
      });
      answersRow.appendChild(btn);
    });
    card.appendChild(answersRow);

    app.appendChild(card);

    // ── Level 1: auto-speak number on load ──
    if (p.type === 1) {
      setTimeout(function () { speakNumberTwice(p.number); }, 400);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Answer handling
  // ═══════════════════════════════════════════════════════════════════════════

  function handleAnswer(chosen, p, btn, answersRow) {
    if (_answered) return;
    _answered = true;

    var allBtns = answersRow.querySelectorAll(".answer-btn");
    allBtns.forEach(function (b) { b.disabled = true; });

    if (chosen === p.answer) {
      btn.classList.add("correct");
      playChime();

      // Level 1 gets a special spoken confirmation with the number revealed
      var msg = (p.type === 1)
        ? "That's right, it was " + p.number + "! Great job Hayden!"
        : pickSuccessMsg();

      speak(msg);
      _starsEarned++;
      buildStarsRow(_starsEarned);

      showPrizePopup(msg, function () {
        _problemIndex++;
        if (_problemIndex >= PROBLEMS_PER_LEVEL) {
          finishLevel();
        } else {
          renderProblem();
        }
      });

    } else {
      btn.classList.add("wrong");
      playWrongBuzz();

      if (p.type === 1) {
        // Level 1 wrong: speak prompt then replay number
        speak("Try again, listen carefully!");
        setTimeout(function () { speakNumberTwice(p.number); }, 1400);
      } else {
        speak("Try again!");
      }

      setTimeout(function () {
        btn.classList.remove("wrong");
        allBtns.forEach(function (b) { b.disabled = false; });
        _answered = false;
      }, 900);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Level complete
  // ═══════════════════════════════════════════════════════════════════════════

  function finishLevel() {
    setBestStars(_level, _starsEarned);
    if (_level < 4) setUnlocked(_level + 1);

    var app = document.getElementById("app");
    app.innerHTML = "";

    var overlay = document.createElement("div");
    overlay.id = "win-screen";

    var confetti = document.createElement("div");
    confetti.id = "confetti-container";
    launchConfetti(confetti);
    overlay.appendChild(confetti);

    var box = document.createElement("div");
    box.id = "win-box";

    var prizeWrap = document.createElement("div");
    prizeWrap.className = "win-prize";
    var winPrizeFile = pickPrize();
    if (winPrizeFile) {
      var prizeGif = document.createElement("img");
      prizeGif.className = "win-prize-img";
      prizeGif.src = prizeSrc(winPrizeFile);
      prizeGif.alt = "Prize!";
      prizeGif.addEventListener("error", function () {
        var ph = document.createElement("div");
        ph.className = "win-prize-placeholder";
        ph.textContent = LEVEL_META[_level].icon;
        prizeWrap.replaceChild(ph, prizeGif);
      });
      prizeWrap.appendChild(prizeGif);
    } else {
      var ph = document.createElement("div");
      ph.className = "win-prize-placeholder";
      ph.textContent = LEVEL_META[_level].icon;
      prizeWrap.appendChild(ph);
    }
    box.appendChild(prizeWrap);

    var emoji = document.createElement("div");
    emoji.className = "win-emoji"; emoji.textContent = "🎉";
    box.appendChild(emoji);

    var msg = document.createElement("div");
    msg.className = "win-msg";
    msg.innerHTML = "You did it Hayden!<br>You're a demon hunter hero!";
    box.appendChild(msg);

    var starsLine = document.createElement("div");
    starsLine.className   = "win-stars-line";
    starsLine.textContent = _starsEarned + " / " + PROBLEMS_PER_LEVEL + " ⭐";
    box.appendChild(starsLine);

    var btns = document.createElement("div");
    btns.className = "win-btns";

    var againBtn = document.createElement("button");
    againBtn.className = "win-btn"; againBtn.textContent = "Play Again";
    againBtn.addEventListener("click", function () { startLevel(_level); });
    btns.appendChild(againBtn);

    if (_level < 4) {
      var nextBtn = document.createElement("button");
      nextBtn.className = "win-btn win-btn-next"; nextBtn.textContent = "Next Level →";
      nextBtn.addEventListener("click", function () { startLevel(_level + 1); });
      btns.appendChild(nextBtn);
    }

    var levelsBtn = document.createElement("button");
    levelsBtn.className = "win-btn win-btn-secondary"; levelsBtn.textContent = "All Levels";
    levelsBtn.addEventListener("click", mountLevelSelect);
    btns.appendChild(levelsBtn);

    box.appendChild(btns);
    overlay.appendChild(box);
    app.appendChild(overlay);

    speak("You did it Hayden! You're a demon hunter hero!");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Confetti
  // ═══════════════════════════════════════════════════════════════════════════

  function launchConfetti(container) {
    var colors = ["#7F77DD","#F472B6","#FFD166","#34D399","#60A5FA","#A78BFA","#FB923C"];
    for (var i = 0; i < 70; i++) {
      var piece = document.createElement("div");
      piece.className = "confetti-piece";
      var size = (8 + Math.random() * 10) + "px";
      piece.style.left              = (Math.random() * 100) + "%";
      piece.style.width             = size;
      piece.style.height            = size;
      piece.style.background        = colors[Math.floor(Math.random() * colors.length)];
      piece.style.borderRadius      = Math.random() > 0.5 ? "50%" : "2px";
      piece.style.animationDelay    = (Math.random() * 1.8) + "s";
      piece.style.animationDuration = (1.4 + Math.random() * 2) + "s";
      container.appendChild(piece);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Boot
  // ═══════════════════════════════════════════════════════════════════════════

  initPrizePool();
  mountLevelSelect();

}());
