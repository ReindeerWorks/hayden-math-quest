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
    var threshold = 2 + Math.floor(Math.random() * 2); // 2 or 3
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
  var _starsEarned  = 0;  // correct answers this session
  var _answered     = false;
  var _audioCtx     = null;

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
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        var t0 = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.28, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
        osc.start(t0);
        osc.stop(t0 + 0.5);
      });
    } catch (e) {}
  }

  function playWrongBuzz() {
    try {
      var ctx  = getAudioCtx();
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.value = 180;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var utt   = new SpeechSynthesisUtterance(text);
    utt.rate  = 0.85;
    utt.pitch = 1.1;
    window.speechSynthesis.speak(utt);
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

  // Generate 3 choices: correct + 2 unique wrong answers near the correct value
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
      // Number recognition
      var n = 1 + Math.floor(Math.random() * 10);
      p.type     = 1;
      p.number   = n;
      p.answer   = n;
      p.prompt   = "What number is this?";
      p.equation = null;
      p.choices  = generateChoices(n, 1, 10);

    } else if (level === 2) {
      // Counting
      var n = 1 + Math.floor(Math.random() * 10);
      p.type     = 2;
      p.count    = n;
      p.answer   = n;
      p.prompt   = "How many " + chr.name + "s are there?";
      p.equation = null;
      p.choices  = generateChoices(n, 1, 10);

    } else if (level === 3) {
      // Addition: a + b ≤ 10, both ≥ 1
      var a    = 1 + Math.floor(Math.random() * 9);
      var maxB = Math.max(1, 10 - a);
      var b    = 1 + Math.floor(Math.random() * maxB);
      p.type     = 3;
      p.a        = a;
      p.b        = b;
      p.answer   = a + b;
      p.prompt   = "How many " + chr.name + "s does the hunter have?";
      p.equation = a + " + " + b + " = ?";
      p.choices  = generateChoices(a + b, 1, 10);

    } else if (level === 4) {
      // Subtraction: a ≥ 2, b ≥ 1, a - b ≥ 1
      var a = 2 + Math.floor(Math.random() * 9); // 2–10
      var b = 1 + Math.floor(Math.random() * (a - 1)); // 1 to a-1
      p.type     = 4;
      p.a        = a;
      p.b        = b;
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

  // Prize slot: tries GIF → PNG hunter → purple placeholder
  function buildPrizeSlot(level) {
    var wrap = document.createElement("div");
    wrap.className = "prize-slot";

    var gif = document.createElement("img");
    gif.className = "prize-img";
    gif.alt       = "Prize";
    gif.src       = "assets/prizes/prize_level" + level + ".gif";

    gif.addEventListener("error", function () {
      var png = document.createElement("img");
      png.className = "prize-img";
      png.alt       = "Hunter";
      png.src       = "assets/hunters/hunter" + level + ".png";
      png.addEventListener("error", function () {
        var ph = document.createElement("div");
        ph.className   = "prize-placeholder";
        ph.textContent = LEVEL_META[level].icon;
        wrap.replaceChild(ph, png);
      });
      wrap.replaceChild(png, gif);
    });

    wrap.appendChild(gif);
    return wrap;
  }

  // Character image cell (with optional red-X overlay for subtraction)
  function buildCharCell(charObj, crossed) {
    var cell = document.createElement("div");
    cell.className = "char-cell";

    var img = document.createElement("img");
    img.src    = charObj.image;
    img.alt    = charObj.name;
    img.width  = 48;
    img.height = 48;
    img.addEventListener("error", function () {
      var ph = document.createElement("div");
      ph.className   = "char-placeholder";
      ph.textContent = charObj.name.charAt(0);
      cell.replaceChild(ph, img);
    });
    cell.appendChild(img);

    if (crossed) {
      var x = document.createElement("div");
      x.className   = "cross-x";
      x.textContent = "✕";
      x.setAttribute("aria-hidden", "true");
      cell.appendChild(x);
    }

    return cell;
  }

  // Row of N character images, last `crossCount` crossed out
  function buildCharRow(count, charObj, crossCount) {
    var row = document.createElement("div");
    row.className = "char-row";
    for (var i = 0; i < count; i++) {
      row.appendChild(buildCharCell(charObj, crossCount && i >= count - crossCount));
    }
    return row;
  }

  // Objects area varies by level/type
  function buildObjectsArea(p) {
    var area = document.createElement("div");
    area.className = "objects-area";

    if (p.type === 1) {
      var big = document.createElement("div");
      big.className   = "big-number";
      big.textContent = p.number;
      area.appendChild(big);

    } else if (p.type === 2) {
      area.appendChild(buildCharRow(p.count, p.character, 0));

    } else if (p.type === 3) {
      var addRow = document.createElement("div");
      addRow.className = "add-row";

      var grpA = document.createElement("div");
      grpA.className = "add-group";
      grpA.appendChild(buildCharRow(p.a, p.character, 0));

      var plus = document.createElement("div");
      plus.className   = "big-operator";
      plus.textContent = "+";

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

  // Stars progress row (10 pips, filled up to `earned`)
  function buildStarsRow(earned) {
    var row = document.getElementById("stars-row");
    row.innerHTML = "";
    for (var i = 0; i < PROBLEMS_PER_LEVEL; i++) {
      var pip = document.createElement("span");
      pip.className   = "star-pip" + (i < earned ? " lit" : "");
      pip.textContent = "⭐";
      pip.setAttribute("aria-hidden", "true");
      row.appendChild(pip);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Level Select
  // ═══════════════════════════════════════════════════════════════════════════

  function mountLevelSelect() {
    // Hide stars row during level select
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
      var meta  = LEVEL_META[lvl];
      var best  = getBestStars(lvl);
      var isLocked = lvl > unlocked;

      var btn = document.createElement("button");
      btn.className = "level-btn" + (isLocked ? " locked" : "");
      btn.disabled  = isLocked;
      btn.setAttribute("aria-label", meta.name + (isLocked ? " — locked" : ""));

      var starsHtml = "";
      for (var s = 0; s < PROBLEMS_PER_LEVEL; s++) {
        starsHtml += '<span class="ls-star' + (s < best ? " lit" : "") + '">⭐</span>';
      }

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

    // ── 1. Prize slot ──
    card.appendChild(buildPrizeSlot(_level));

    // ── 2. Game header inside card (back + progress) ──
    var cardHeader = document.createElement("div");
    cardHeader.className = "card-header";

    var backBtn = document.createElement("button");
    backBtn.className   = "back-btn";
    backBtn.textContent = "← Levels";
    backBtn.addEventListener("click", mountLevelSelect);
    cardHeader.appendChild(backBtn);

    var progress = document.createElement("div");
    progress.className   = "progress-label";
    progress.textContent = "Problem " + (_problemIndex + 1) + " of " + PROBLEMS_PER_LEVEL;
    cardHeader.appendChild(progress);

    card.appendChild(cardHeader);

    // ── 3. Prompt ──
    var prompt = document.createElement("div");
    prompt.className   = "prompt-text";
    prompt.textContent = p.prompt;
    card.appendChild(prompt);

    // ── 4. Objects area ──
    card.appendChild(buildObjectsArea(p));

    // ── 5. Equation ──
    if (p.equation) {
      var eq = document.createElement("div");
      eq.className   = "equation-text";
      eq.textContent = p.equation;
      card.appendChild(eq);
    }

    // ── 6. Divider ──
    var hr = document.createElement("hr");
    hr.className = "divider";
    card.appendChild(hr);

    // ── 7. Tap label ──
    var tapLabel = document.createElement("div");
    tapLabel.className   = "tap-label";
    tapLabel.textContent = "tap the right answer";
    card.appendChild(tapLabel);

    // ── 8. Answer buttons ──
    var answersRow = document.createElement("div");
    answersRow.className = "answers-row";

    p.choices.forEach(function (choice) {
      var btn = document.createElement("button");
      btn.className   = "answer-btn";
      btn.textContent = choice;
      btn.addEventListener("click", function () {
        handleAnswer(choice, p.answer, btn, answersRow);
      });
      answersRow.appendChild(btn);
    });

    card.appendChild(answersRow);
    app.appendChild(card);
  }

  function handleAnswer(chosen, correct, btn, answersRow) {
    if (_answered) return;
    _answered = true;

    // Lock all buttons
    var allBtns = answersRow.querySelectorAll(".answer-btn");
    allBtns.forEach(function (b) { b.disabled = true; });

    if (chosen === correct) {
      btn.classList.add("correct");
      playChime();
      speak(pickSuccessMsg());
      _starsEarned++;
      buildStarsRow(_starsEarned);

      setTimeout(function () {
        _problemIndex++;
        if (_problemIndex >= PROBLEMS_PER_LEVEL) {
          finishLevel();
        } else {
          renderProblem();
        }
      }, 1500);

    } else {
      btn.classList.add("wrong");
      playWrongBuzz();
      speak("Try again!");

      setTimeout(function () {
        btn.classList.remove("wrong");
        btn.disabled = false;
        // Re-enable all buttons and allow another attempt
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
    // Unlock next level
    if (_level < 4) setUnlocked(_level + 1);

    var app = document.getElementById("app");
    app.innerHTML = "";

    // Win overlay
    var overlay = document.createElement("div");
    overlay.id = "win-screen";

    // Confetti
    var confetti = document.createElement("div");
    confetti.id = "confetti-container";
    launchConfetti(confetti);
    overlay.appendChild(confetti);

    // Win box
    var box = document.createElement("div");
    box.id = "win-box";

    // Prize media
    var prizeWrap = document.createElement("div");
    prizeWrap.className = "win-prize";
    var prizeGif = document.createElement("img");
    prizeGif.className = "win-prize-img";
    prizeGif.src       = "assets/prizes/prize_level" + _level + ".gif";
    prizeGif.alt       = "Prize!";
    prizeGif.addEventListener("error", function () {
      var ph = document.createElement("div");
      ph.className   = "win-prize-placeholder";
      ph.textContent = LEVEL_META[_level].icon;
      prizeWrap.replaceChild(ph, prizeGif);
    });
    prizeWrap.appendChild(prizeGif);
    box.appendChild(prizeWrap);

    var emoji = document.createElement("div");
    emoji.className   = "win-emoji";
    emoji.textContent = "🎉";
    box.appendChild(emoji);

    var msg = document.createElement("div");
    msg.className   = "win-msg";
    msg.innerHTML   = "You did it Hayden!<br>You're a demon hunter hero!";
    box.appendChild(msg);

    var starsLine = document.createElement("div");
    starsLine.className   = "win-stars-line";
    starsLine.textContent = _starsEarned + " / " + PROBLEMS_PER_LEVEL + " ⭐";
    box.appendChild(starsLine);

    var btns = document.createElement("div");
    btns.className = "win-btns";

    var againBtn = document.createElement("button");
    againBtn.className   = "win-btn";
    againBtn.textContent = "Play Again";
    againBtn.addEventListener("click", function () { startLevel(_level); });
    btns.appendChild(againBtn);

    if (_level < 4) {
      var nextBtn = document.createElement("button");
      nextBtn.className   = "win-btn win-btn-next";
      nextBtn.textContent = "Next Level →";
      nextBtn.addEventListener("click", function () { startLevel(_level + 1); });
      btns.appendChild(nextBtn);
    }

    var levelsBtn = document.createElement("button");
    levelsBtn.className   = "win-btn win-btn-secondary";
    levelsBtn.textContent = "All Levels";
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
      piece.style.left              = (Math.random() * 100) + "vw";
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

  mountLevelSelect();

}());
