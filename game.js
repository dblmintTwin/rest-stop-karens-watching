/* ===========================================================================
   REST STOP: KAREN'S WATCHING
   A single-player 2-D side-scrolling comedy game. Pure HTML5 canvas + vanilla
   JS. Self-contained: no libraries, no modules, no network. Runs by opening
   index.html directly or via GitHub Pages. High scores persist in localStorage.
   =========================================================================== */
(function () {
"use strict";

/* ----------------------------------- setup ------------------------------- */
var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
var W = canvas.width;          // 960
var H = canvas.height;         // 540
var HORIZON = 350;             // screen y of the horizon / where the lot starts
var WORLD = 2200;              // world width (wider than viewport -> scrolling)

// World landmarks (world-space x)
var CAR_X = 150;
var TREE_X = 560;
var ZONE_X1 = 880, ZONE_X2 = 1180;      // DOG AREA poop zone
var REST_X = 1880;                       // restroom building left edge
var DOOR_X = 1980;                       // restroom door (dash target)

var DAYLIGHT_MAX = 1200;

/* ----------------------------------- state ------------------------------- */
var S = {
  state: "TITLE",
  prev: "TITLE",
  t: 0,                // time accumulator (s)
  daylight: 1000,
  cam: 0,
  paused: false,
  // opening
  pee: 45,
  risky: false,
  // dogs / phase 2
  poop: 0,
  karen: 0,
  // entities
  player: null,
  karenE: null,
  dogs: [],
  held: null,
  piles: [],           // poop piles {x, inZone}
  // misc
  flash: "",
  flashT: 0,
  copTimer: 0,
  result: null,        // {score, reason}
  // menus
  menuIndex: 0,
  initials: [0, 0, 0], // letter indices
  initialSlot: 0,
  newHsIndex: -1
};

var MENU = ["START", "HIGH SCORES", "HOW TO PLAY"];
var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* --------------------------------- utilities ----------------------------- */
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }

function hexToRgb(h) {
  h = h.replace("#", "");
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}
function lerpColor(a, b, t) {
  var x = hexToRgb(a), y = hexToRgb(b);
  return "rgb(" + Math.round(lerp(x[0], y[0], t)) + "," +
                  Math.round(lerp(x[1], y[1], t)) + "," +
                  Math.round(lerp(x[2], y[2], t)) + ")";
}

/* ------------------------------ high scores ------------------------------ */
var HS_KEY = "restStopKarensWatching.highscores.v1";
function defaultScores() {
  return [
    { initials: "ACE", score: 980 },
    { initials: "JET", score: 870 },
    { initials: "ZZZ", score: 760 },
    { initials: "BOB", score: 640 },
    { initials: "SUE", score: 540 },
    { initials: "DOG", score: 430 },
    { initials: "MAX", score: 330 },
    { initials: "PAL", score: 220 }
  ];
}
function loadScores() {
  try {
    var raw = localStorage.getItem(HS_KEY);
    if (!raw) return defaultScores();
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return defaultScores();
    return arr;
  } catch (e) { return defaultScores(); }
}
function saveScores(arr) {
  try { localStorage.setItem(HS_KEY, JSON.stringify(arr)); } catch (e) {}
}
function qualifies(score) {
  var arr = loadScores();
  if (arr.length < 10) return true;
  return score > arr[arr.length - 1].score;
}
function insertScore(initials, score) {
  var arr = loadScores();
  var entry = { initials: initials, score: score };
  arr.push(entry);
  arr.sort(function (a, b) { return b.score - a.score; });
  arr = arr.slice(0, 10);
  saveScores(arr);
  return arr.indexOf(entry);
}

/* --------------------------------- input --------------------------------- */
var keys = {};
function isDown(c) { return !!keys[c]; }

window.addEventListener("keydown", function (e) {
  var k = e.key;
  if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(k) >= 0) {
    e.preventDefault();
  }
  var fresh = !keys[k];
  keys[k] = true;
  if (fresh) {
    onPress(k);
    // Only flush direction keys when Space fires during gameplay — the player
    // was likely holding a direction while pressing an action key, and a missed
    // keyup on that direction key would lock movement. Shift is never cleared
    // (run mode is preserved). Direction keys themselves don't trigger a flush
    // so continuous movement is never interrupted.
    if (k === " " && isGameplay(S.state)) {
      keys["ArrowLeft"] = false; keys["ArrowRight"] = false;
      keys["a"] = false; keys["A"] = false;
      keys["d"] = false; keys["D"] = false;
    }
    // GAMBLE uses ArrowLeft/Right as one-shot choices; clear them so neither
    // direction carries a stuck value into the DASH movement phase.
    if ((k === "ArrowLeft" || k === "ArrowRight") && S.state === "GAMBLE") {
      keys["ArrowLeft"] = false; keys["ArrowRight"] = false;
    }
  }
});
window.addEventListener("keyup", function (e) { keys[e.key] = false; });
window.addEventListener("blur", function () { keys = {}; });
document.addEventListener("visibilitychange", function () { if (document.hidden) keys = {}; });
canvas.addEventListener("mousedown", function () { canvas.focus(); });

// discrete key presses (menus + actions)
function onPress(k) {
  var st = S.state;

  // global pause toggle during gameplay
  if (k === "Escape" && isGameplay(st)) { S.paused = !S.paused; return; }
  if (S.paused) return;

  if (st === "TITLE") {
    if (k === "ArrowUp") S.menuIndex = (S.menuIndex + MENU.length - 1) % MENU.length;
    else if (k === "ArrowDown") S.menuIndex = (S.menuIndex + 1) % MENU.length;
    else if (k === "Enter" || k === " ") {
      if (S.menuIndex === 0) startRun();
      else if (S.menuIndex === 1) setState("HIGHSCORES");
      else setState("HOWTO");
    }
  } else if (st === "HOWTO") {
    if (k === "Enter" || k === " " || k === "Escape") setState("TITLE");
  } else if (st === "GAMBLE") {
    if (k === "ArrowLeft") beginDash(false);
    else if (k === "ArrowRight") beginDash(true);
  } else if (st === "DASH") {
    if (k === " ") tryEnterRestroom();
  } else if (st === "RETURN") {
    if (k === " ") tryReleaseDogs();
  } else if (st === "GAUNTLET" || st === "GETAWAY") {
    if (k === " ") gauntletAction();
  } else if (st === "RESULT") {
    if (k === "Enter" || k === " ") afterResult();
  } else if (st === "GAMEOVER") {
    if (k === "Enter" || k === " ") setState("TITLE");
  } else if (st === "HIGHSCORES") {
    if (k === "Enter" || k === " " || k === "Escape") { S.newHsIndex = -1; setState("TITLE"); }
  } else if (st === "ENTERINITIALS") {
    if (k === "ArrowLeft") S.initialSlot = (S.initialSlot + 2) % 3;
    else if (k === "ArrowRight") S.initialSlot = (S.initialSlot + 1) % 3;
    else if (k === "ArrowUp") S.initials[S.initialSlot] = (S.initials[S.initialSlot] + 1) % 26;
    else if (k === "ArrowDown") S.initials[S.initialSlot] = (S.initials[S.initialSlot] + 25) % 26;
    else if (k === "Enter") commitInitials();
  }
}

function isGameplay(st) {
  return st === "DASH" || st === "RETURN" || st === "GAUNTLET" || st === "GETAWAY";
}

/* ------------------------------ state changes ---------------------------- */
function setState(s) { S.prev = S.state; S.state = s; S.t = 0; S.paused = false; keys = {}; }

function flash(msg, dur) { S.flash = msg; S.flashT = dur || 2.2; }

function startRun() {
  S.daylight = 1000;
  S.pee = 45; S.poop = 0; S.karen = 0;
  S.piles = []; S.dogs = []; S.held = null;
  S.copTimer = 0; S.result = null;
  setState("GAMBLE");
}

function beginDash(risky) {
  S.risky = risky;
  if (risky) { S.daylight = 1120; S.pee = 62; }   // bonus daylight, less margin
  else { S.daylight = 980; S.pee = 45; }
  S.player = { x: 240, y: HORIZON + 110, vx: 0, face: 1, walk: 0 };
  setState("DASH");
  flash(risky ? "Risked it! Bonus daylight - now RUN!" : "Pulled over. Get to the restroom!", 2.4);
}

function tryEnterRestroom() {
  if (Math.abs(S.player.x - DOOR_X) < 70) {
    setState("RESTROOM");
  }
}

function tryReleaseDogs() {
  if (Math.abs(S.player.x - (CAR_X + 60)) < 90) {
    spawnDogs();
    setState("GAUNTLET");
    flash("The dogs are loose! Catch them and load the car.", 2.6);
  }
}

function spawnDogs() {
  S.dogs = [
    makeDog("chihuahua", CAR_X + 120),
    makeDog("lab", CAR_X + 160),
    makeDog("staffie", CAR_X + 200)
  ];
}
function makeDog(type, x) {
  return { type: type, x: x, y: HORIZON + 120, vx: rand(-40, 40),
           state: "loose", wob: rand(0, 6), retarget: 0 };
}

/* ------------------------------ gameplay action -------------------------- */
function gauntletAction() {
  var p = S.player;
  // 1) if holding a dog and near the car -> secure it
  if (S.held && Math.abs(p.x - (CAR_X + 70)) < 95) {
    S.held.state = "secured";
    S.held = null;
    flash("Dog loaded! " + securedCount() + "/3 in the car.", 1.8);
    if (securedCount() === 3) flash("All aboard! SPACE at the car to drive off.", 3.0);
    return;
  }
  // 2) all secured + at car -> drive off (win)
  if (allSecured() && Math.abs(p.x - (CAR_X + 70)) < 110) {
    finishRun();
    return;
  }
  // 3) standing over a poop pile -> scoop it
  for (var i = 0; i < S.piles.length; i++) {
    if (Math.abs(p.x - S.piles[i].x) < 46) {
      S.piles.splice(i, 1);
      flash("Scooped! Good citizen.", 1.4);
      return;
    }
  }
  // 4) in the DOG AREA with a dog -> let them relieve themselves here (safe)
  if (inZone(p.x) && hasLooseOrHeld() && S.poop > 35) {
    S.piles.push({ x: clamp(p.x, ZONE_X1 + 20, ZONE_X2 - 20), inZone: true });
    S.poop = 0;
    flash("Good - they went in the dog area. Now scoop it!", 2.2);
    return;
  }
  // 5) try to grab the nearest loose dog (if hands free)
  if (!S.held) {
    var best = null, bd = 60;
    for (var j = 0; j < S.dogs.length; j++) {
      var d = S.dogs[j];
      if (d.state !== "loose") continue;
      var dist = Math.abs(d.x - p.x);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (best) {
      best.state = "led"; S.held = best;
      flash("Got the " + niceName(best.type) + "!", 1.4);
    }
  }
}

function niceName(t) { return t === "chihuahua" ? "Chihuahua" : (t === "lab" ? "Labrador" : "Staffie"); }
function securedCount() { var n = 0; for (var i = 0; i < S.dogs.length; i++) if (S.dogs[i].state === "secured") n++; return n; }
function allSecured() { for (var i = 0; i < S.dogs.length; i++) if (S.dogs[i].state !== "secured") return false; return true; }
function hasLooseOrHeld() { for (var i = 0; i < S.dogs.length; i++) if (S.dogs[i].state !== "secured") return true; return false; }
function inZone(x) { return x > ZONE_X1 && x < ZONE_X2; }

function finishRun() {
  var score = Math.max(0, Math.round(S.daylight));
  if (S.copTimer > 0) score = Math.max(0, score - 250); // getaway penalty (shouldn't reach here)
  S.result = { score: score, reason: "made it" };
  setState("RESULT");
}

function gameOver(reason) { S.result = { score: 0, reason: reason }; setState("GAMEOVER"); }

function afterResult() {
  var sc = S.result.score;
  if (sc > 0 && qualifies(sc)) {
    S.initials = [0, 0, 0]; S.initialSlot = 0;
    setState("ENTERINITIALS");
  } else {
    S.newHsIndex = -1;
    setState("HIGHSCORES");
  }
}
function commitInitials() {
  var ini = ALPHABET[S.initials[0]] + ALPHABET[S.initials[1]] + ALPHABET[S.initials[2]];
  S.newHsIndex = insertScore(ini, S.result.score);
  setState("HIGHSCORES");
}

/* =========================================================================
   UPDATE
   ========================================================================= */
function update(dt) {
  if (S.flashT > 0) S.flashT -= dt;
  if (S.paused) return;
  var st = S.state;
  if (st === "DASH") updateDash(dt);
  else if (st === "RESTROOM") updateRestroom(dt);
  else if (st === "RETURN") updateReturn(dt);
  else if (st === "GAUNTLET") updateGauntlet(dt);
  else if (st === "GETAWAY") updateGetaway(dt);
  // camera follows player in gameplay
  if (S.player && isGameplay(st)) {
    var target = clamp(S.player.x - W / 2, 0, WORLD - W);
    S.cam += (target - S.cam) * Math.min(1, dt * 6);
  }
}

function movePlayer(dt, speedMul) {
  var p = S.player;
  var run = isDown("Shift");
  var spd = (run ? 320 : 165) * (speedMul || 1);
  var dir = 0;
  if (isDown("ArrowLeft") || isDown("a") || isDown("A")) dir -= 1;
  if (isDown("ArrowRight") || isDown("d") || isDown("D")) dir += 1;
  p.x += dir * spd * dt;
  p.x = clamp(p.x, 60, WORLD - 60);
  if (dir !== 0) { p.face = dir; p.walk += dt * (run ? 14 : 8); }
}

function drainDaylight(dt, rate) {
  S.daylight -= (rate || 10) * dt;
  if (S.daylight <= 0) { S.daylight = 0; gameOver("dark"); }
}

function updateDash(dt) {
  movePlayer(dt);
  drainDaylight(dt, 9);
  S.pee += 5.5 * dt;
  S.poop += 2.2 * dt;            // dogs are waiting in the car
  if (S.pee >= 100) { gameOver("pee"); return; }
}

function updateRestroom(dt) {
  // brief pause; dogs unattended -> poop + a little Karen suspicion
  drainDaylight(dt, 8);
  S.poop += 3.0 * dt;
  S.karen += 4.0 * dt;
  checkInCarPoop();
  if (S.t > 2.6) {
    S.player.x = DOOR_X - 30;
    setState("RETURN");
    flash("Hurry back before Karen makes a scene!", 2.4);
  }
}

function updateReturn(dt) {
  movePlayer(dt);
  drainDaylight(dt, 9);
  S.poop += 2.6 * dt;
  ensureKaren();
  patrolKaren(dt);
  // neglect: the dogs are visibly alone (slow rise), worse when Karen is near
  S.karen += 3.0 * dt;
  if (Math.abs(S.karenE.x - CAR_X) < 380) S.karen += 6.0 * dt;
  checkInCarPoop();
  if (S.karen >= 100) { triggerCops(); }
}

function updateGauntlet(dt) {
  movePlayer(dt, S.held && S.held.type === "lab" ? 0.82 : 1);
  drainDaylight(dt, 11);
  ensureKaren();
  patrolKaren(dt);
  updateDogs(dt);

  // poop meter
  S.poop += 2.4 * dt;
  if (S.poop >= 100) {
    var px = S.player.x;
    var zone = inZone(px);
    S.piles.push({ x: px, inZone: zone });
    S.poop = 0;
    if (zone) flash("Phew - in the dog area. Scoop it!", 2.0);
    else { S.karen = clamp(S.karen + 40, 0, 100); flash("A dog went in the WRONG spot! Karen saw!", 2.6); }
  }
  // unscooped piles outside the zone keep Karen simmering
  var outside = 0;
  for (var i = 0; i < S.piles.length; i++) if (!S.piles[i].inZone) outside++;
  if (outside > 0) S.karen += outside * 4.0 * dt;

  if (S.karen >= 100) { triggerCops(); }
}

function updateGetaway(dt) {
  movePlayer(dt, S.held && S.held.type === "lab" ? 0.85 : 1.05);
  drainDaylight(dt, 11);
  S.copTimer -= dt;
  updateDogs(dt);
  // win the getaway: all dogs secured AND at the car
  if (allSecured() && Math.abs(S.player.x - (CAR_X + 70)) < 110) {
    var score = Math.max(0, Math.round(S.daylight) - 250);
    S.result = { score: score, reason: "escaped" };
    setState("RESULT");
    return;
  }
  if (S.copTimer <= 0) { gameOver("caught"); }
}

function triggerCops() {
  S.copTimer = 13;
  setState("GETAWAY");
  flash("KAREN CALLED THE COPS! Get the dogs and GO!", 3.0);
}

function checkInCarPoop() {
  if (S.poop >= 100) {
    S.poop = 30;
    S.daylight = Math.max(0, S.daylight - 150);
    flash("Accident in the car! Cleanup cost you daylight.", 2.6);
  }
}

function ensureKaren() {
  if (!S.karenE) S.karenE = { x: 1050, y: HORIZON + 116, vx: 60, face: -1 };
}
function patrolKaren(dt) {
  var k = S.karenE;
  if (S.state === "GETAWAY") return; // she stands and watches during the getaway
  k.x += k.vx * dt;
  if (k.x < 360) { k.x = 360; k.vx = Math.abs(k.vx); }
  if (k.x > 1700) { k.x = 1700; k.vx = -Math.abs(k.vx); }
  k.face = k.vx < 0 ? -1 : 1;
}

function updateDogs(dt) {
  var p = S.player;
  for (var i = 0; i < S.dogs.length; i++) {
    var d = S.dogs[i];
    if (d.state === "secured") continue;
    d.wob += dt * 6;
    if (d.state === "led") {
      // follow behind the player
      var behind = p.x - p.face * 46;
      d.x += (behind - d.x) * Math.min(1, dt * 7);
      // the Lab tugs toward Karen
      if (d.type === "lab" && S.karenE) {
        d.x += Math.sign(S.karenE.x - d.x) * 26 * dt;
      }
      continue;
    }
    // loose behaviors
    if (d.type === "chihuahua") {
      // flees from the player, fast and twitchy
      if (Math.abs(d.x - p.x) < 280) {
        d.x += Math.sign(d.x - p.x || 1) * 230 * dt;
      } else {
        d.retarget -= dt;
        if (d.retarget <= 0) { d.vx = rand(-120, 120); d.retarget = rand(0.4, 1.1); }
        d.x += d.vx * dt;
      }
    } else if (d.type === "lab") {
      // ambles toward Karen (wants to greet everyone)
      if (S.karenE) d.x += Math.sign(S.karenE.x - d.x) * 95 * dt;
    } else { // staffie - slow wander, but radioactive to Karen
      d.retarget -= dt;
      if (d.retarget <= 0) { d.vx = rand(-55, 55); d.retarget = rand(0.8, 1.8); }
      d.x += d.vx * dt;
      if (S.karenE && Math.abs(d.x - S.karenE.x) < 210) {
        S.karen += 9.0 * dt;        // Karen panics at the "scary" dog
      }
    }
    d.x = clamp(d.x, 70, WORLD - 70);
  }
}

/* =========================================================================
   RENDER
   ========================================================================= */
function skyStops(f) {
  // keyframes: [f, top, mid, bot]
  var K = [
    [1.0, "#3f8fd6", "#8fc3ec", "#d7ecff"],
    [0.62, "#4a86c4", "#f0cf95", "#ffe9bf"],
    [0.38, "#6d6aa8", "#f3a24e", "#ffd279"],
    [0.18, "#322d62", "#d8503f", "#ffce74"],
    [0.0, "#141b3a", "#34315f", "#b5675a"]
  ];
  f = clamp(f, 0, 1);
  for (var i = 0; i < K.length - 1; i++) {
    var hi = K[i], lo = K[i + 1];
    if (f <= hi[0] && f >= lo[0]) {
      var t = (f - lo[0]) / (hi[0] - lo[0]);
      return [lerpColor(lo[1], hi[1], t), lerpColor(lo[2], hi[2], t), lerpColor(lo[3], hi[3], t)];
    }
  }
  return [K[0][1], K[0][2], K[0][3]];
}

function drawSky() {
  var f = clamp(S.daylight / DAYLIGHT_MAX, 0, 1);
  var c = skyStops(f);
  var g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON);
  // stars near dusk
  if (f < 0.22) {
    ctx.fillStyle = "rgba(255,255,255," + (0.22 - f) * 4 + ")";
    var sx = [80, 180, 300, 520, 640, 760, 880];
    var sy = [40, 90, 55, 70, 38, 96, 60];
    for (var i = 0; i < sx.length; i++) { ctx.fillRect(sx[i], sy[i], 2, 2); }
  }
  // sun
  var sunY = lerp(HORIZON, 56, f);
  var r = 26 + (1 - f) * 16;
  var sg = ctx.createRadialGradient(W * 0.72, sunY, 2, W * 0.72, sunY, r);
  sg.addColorStop(0, "#fff6c2"); sg.addColorStop(0.55, "#ffd23f"); sg.addColorStop(1, "#ff9e2c");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(W * 0.72, sunY, r, 0, 7); ctx.fill();
}

function drawGround() {
  // grass strip + parking lot, drawn in screen space spanning the viewport
  ctx.fillStyle = "#6fa23c"; ctx.fillRect(0, HORIZON - 6, W, 10);
  ctx.fillStyle = "#7b8088"; ctx.fillRect(0, HORIZON + 4, W, H - HORIZON);
  // lane stripes (parallax with camera)
  ctx.fillStyle = "rgba(242,233,201,0.7)";
  for (var x = -((S.cam) % 220); x < W; x += 220) {
    ctx.fillRect(x + 40, HORIZON + 90, 60, 7);
  }
}

/* --------- ellipse + helpers --------- */
function ell(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); }
function fillS(fill, stroke, lw) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}

/* --------- scene objects (world space; call after translate(-cam)) ------- */
function drawCar(x) {
  var baseY = HORIZON + 96;
  ctx.save(); ctx.translate(x, baseY);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)"; ell(70, 64, 86, 12); ctx.fill();
  // wheels
  ctx.fillStyle = "#2b2b2b"; circle(40, 48, 18); ctx.fill(); circle(140, 48, 18); ctx.fill();
  ctx.fillStyle = "#d9d9d9"; circle(40, 48, 7); ctx.fill(); circle(140, 48, 7); ctx.fill();
  // body
  ctx.strokeStyle = "#21364a"; ctx.lineWidth = 4;
  ctx.fillStyle = "#3d9be9";
  roundRect(6, 6, 150, 40, 16); ctx.fill(); ctx.stroke();
  // cabin
  ctx.beginPath(); ctx.moveTo(34, 8); ctx.lineTo(52, -18); ctx.lineTo(120, -18); ctx.lineTo(140, 8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#bfe3ff"; roundRect(56, -14, 58, 20, 4); ctx.fill();
  // roof box (vacation!)
  ctx.fillStyle = "#e4572e"; roundRect(66, -30, 56, 14, 4); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawTree(x) {
  ctx.save(); ctx.translate(x, HORIZON);
  ctx.fillStyle = "rgba(0,0,0,0.12)"; ell(8, 96, 40, 9); ctx.fill();
  ctx.fillStyle = "#7a5230"; ctx.fillRect(2, 30, 14, 66);
  ctx.fillStyle = "#4f8a3a"; ctx.strokeStyle = "#356025"; ctx.lineWidth = 3;
  circle(9, 14, 36); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawRestroom(x) {
  ctx.save(); ctx.translate(x, HORIZON);
  ctx.fillStyle = "#e8dcc2"; ctx.strokeStyle = "#7a6a48"; ctx.lineWidth = 3;
  ctx.fillRect(0, -100, 170, 180); ctx.strokeRect(0, -100, 170, 180);
  ctx.fillStyle = "#b8a273"; roundRect(-8, -112, 186, 18, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#6d4c2f"; ctx.fillRect(70, -10, 36, 90);     // door
  sign(40, -70, 90, 28, "RESTROOM", 13);
  ctx.restore();
}

function drawZone() {
  // DOG AREA grass patch
  ctx.save();
  ctx.fillStyle = "#6fa23c"; ctx.strokeStyle = "#4f8a2b"; ctx.lineWidth = 3;
  roundRect(ZONE_X1, HORIZON + 40, ZONE_X2 - ZONE_X1, 70, 16); ctx.fill(); ctx.stroke();
  // little hedge dots
  ctx.fillStyle = "#5c8a30";
  for (var x = ZONE_X1 + 20; x < ZONE_X2; x += 40) { circle(x, HORIZON + 44, 7); ctx.fill(); }
  // sign on a post
  var sx = (ZONE_X1 + ZONE_X2) / 2;
  ctx.fillStyle = "#6d4c2f"; ctx.fillRect(sx - 2, HORIZON + 8, 4, 34);
  sign(sx - 34, HORIZON - 8, 68, 20, "DOG AREA", 11);
  ctx.restore();
}

function sign(x, y, w, h, text, fs) {
  ctx.fillStyle = "#15489c"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5;
  roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffff"; ctx.font = "bold " + fs + "px 'Trebuchet MS',sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

function drawPile(x) {
  ctx.save(); ctx.translate(x, HORIZON + 104);
  ctx.fillStyle = "#6b4a2a";
  ell(0, 4, 12, 5); ctx.fill();
  ell(-3, -2, 8, 4); ctx.fill();
  ell(1, -7, 5, 3); ctx.fill();
  // stink lines
  ctx.strokeStyle = "rgba(120,160,90,0.7)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(-9, -16, -5, -20);
  ctx.moveTo(6, -10); ctx.quadraticCurveTo(9, -16, 5, -20); ctx.stroke();
  ctx.restore();
}

/* --------- characters --------- */
function drawDog(x, type) {
  var col, belly, line, ears;
  if (type === "lab") { col = "#e8b06a"; belly = "#f5d6a3"; line = "#7a5223"; ears = "floppy"; }
  else if (type === "staffie") { col = "#9aa0a6"; belly = "#c3c8cc"; line = "#4b4f54"; ears = "perky"; }
  else { col = "#dcae73"; belly = "#f0d3a6"; line = "#7a5230"; ears = "huge"; }
  var s = type === "chihuahua" ? 0.62 : (type === "staffie" ? 0.86 : 0.78);
  ctx.save();
  ctx.translate(x, HORIZON + 120);
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.14)"; ell(0, 6, 40, 8); ctx.fill();
  // body
  ctx.fillStyle = col; ctx.strokeStyle = line; ctx.lineWidth = 3;
  ell(0, -28, 32, 30); fillS(col, line, 3);
  ctx.fillStyle = belly; ell(0, -18, 18, 18); ctx.fill();
  // ears
  ctx.fillStyle = col; ctx.strokeStyle = line; ctx.lineWidth = 3;
  if (ears === "floppy") {
    ell(-30, -72, 11, 22); fillS(col, line, 3);
    ell(30, -72, 11, 22); fillS(col, line, 3);
  } else if (ears === "perky") {
    tri(-24, -98, -28, -126, -8, -106); fillS(col, line, 3);
    tri(24, -98, 28, -126, 8, -106); fillS(col, line, 3);
  } else { // huge
    tri(-22, -90, -40, -134, 0, -100); fillS(col, line, 3);
    tri(22, -90, 40, -134, 0, -100); fillS(col, line, 3);
  }
  // head
  ctx.fillStyle = col; circle(0, -82, 31); fillS(col, line, 3);
  ctx.fillStyle = belly; ell(0, -70, 17, 13); ctx.fill();
  // eyes
  eye(-11, -90); eye(11, -90);
  // nose + smile
  ctx.fillStyle = "#2b2b2b"; ell(0, -78, 6, 4.5); ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 2.2; ctx.beginPath();
  ctx.moveTo(0, -73); ctx.quadraticCurveTo(0, -66, -7, -64);
  ctx.moveTo(0, -73); ctx.quadraticCurveTo(0, -66, 7, -64); ctx.stroke();
  if (type !== "chihuahua") { // tongue
    ctx.fillStyle = "#ef8a9a"; ctx.strokeStyle = "#c96b7a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-5, -65); ctx.quadraticCurveTo(0, -56, 5, -65); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function eye(ex, ey) {
  ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#3b3e42"; ctx.lineWidth = 1.5;
  ell(ex, ey, 8.5, 10.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2b2b2b"; circle(ex + 1.5, ey + 2, 5); ctx.fill();
  ctx.fillStyle = "#ffffff"; circle(ex + 3, ey - 1, 1.8); ctx.fill();
}
function tri(x1, y1, x2, y2, x3, y3) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); }

function drawPlanner(x, face, walk) {
  ctx.save();
  ctx.translate(x, HORIZON + 120);
  ctx.scale(face < 0 ? -1 : 1, 1);
  var legA = Math.sin(walk) * 6;
  ctx.fillStyle = "rgba(0,0,0,0.14)"; ell(0, 6, 24, 7); ctx.fill();
  // legs
  ctx.fillStyle = "#34495e"; roundRect(-12, -34 + 0, 10, 34 + legA, 4); ctx.fill();
  ctx.fillStyle = "#3b5266"; roundRect(2, -34, 10, 34 - legA, 4); ctx.fill();
  // shoes
  ctx.fillStyle = "#222"; ell(-7, 2 + legA, 9, 5); ctx.fill(); ell(7, 2 - legA, 9, 5); ctx.fill();
  // torso
  ctx.fillStyle = "#2a9d8f"; ctx.strokeStyle = "#1d6f66"; ctx.lineWidth = 2.5;
  roundRect(-18, -76, 36, 44, 13); ctx.fill(); ctx.stroke();
  // arm + binder
  ctx.fillStyle = "#8d5a2b"; ctx.strokeStyle = "#5c3a1a"; ctx.lineWidth = 2;
  roundRect(16, -62, 18, 24, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f6efe2"; ctx.fillRect(19, -58, 12, 3); ctx.fillRect(19, -52, 12, 3); ctx.fillRect(19, -46, 12, 3);
  // head
  ctx.fillStyle = "#f3c98a"; ctx.strokeStyle = "#c98f4e"; ctx.lineWidth = 2.5;
  circle(0, -96, 22); ctx.fill(); ctx.stroke();
  // hair
  ctx.fillStyle = "#6d4c2f"; ctx.beginPath();
  ctx.moveTo(-22, -96); ctx.quadraticCurveTo(-24, -122, 0, -122);
  ctx.quadraticCurveTo(24, -122, 22, -96); ctx.quadraticCurveTo(14, -110, 0, -110);
  ctx.quadraticCurveTo(-14, -110, -22, -96); ctx.closePath(); ctx.fill();
  // glasses + eyes
  ctx.strokeStyle = "#3b3e42"; ctx.lineWidth = 2; ctx.fillStyle = "#fff";
  circle(-8, -96, 7); ctx.fill(); ctx.stroke();
  circle(8, -96, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, -96); ctx.lineTo(1, -96); ctx.stroke();
  ctx.fillStyle = "#2b2b2b"; circle(-8, -95, 3); ctx.fill(); circle(8, -95, 3); ctx.fill();
  // smile
  ctx.strokeStyle = "#9c6b3a"; ctx.lineWidth = 2.2; ctx.beginPath();
  ctx.moveTo(-7, -86); ctx.quadraticCurveTo(0, -81, 7, -86); ctx.stroke();
  ctx.restore();
}

function drawKaren(x, face, angry) {
  ctx.save();
  ctx.translate(x, HORIZON + 120);
  ctx.scale(face < 0 ? -1 : 1, 1);
  ctx.fillStyle = "rgba(0,0,0,0.14)"; ell(0, 6, 26, 7); ctx.fill();
  // legs
  ctx.fillStyle = "#6b5566"; roundRect(-12, -22, 11, 30, 4); ctx.fill();
  ctx.fillStyle = "#5d4a59"; roundRect(1, -22, 11, 30, 4); ctx.fill();
  ctx.fillStyle = "#3b2b33"; ell(-7, 8, 9, 5); ctx.fill(); ell(7, 8, 9, 5); ctx.fill();
  // cardigan
  ctx.fillStyle = "#cf6f7e"; ctx.strokeStyle = "#9c4d5a"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-24, -64); ctx.quadraticCurveTo(0, -72, 24, -64);
  ctx.lineTo(30, -22); ctx.lineTo(-30, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
  // raised arm + phone
  ctx.strokeStyle = "#cf6f7e"; ctx.lineWidth = 11; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(20, -58); ctx.quadraticCurveTo(40, -70, 42, -92); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "#2b2b2b"; roundRect(36, -108, 14, 22, 3); ctx.fill();
  ctx.fillStyle = "#7fd4ff"; ctx.fillRect(38, -105, 9, 14);
  // head
  ctx.fillStyle = "#f3c98a"; ctx.strokeStyle = "#c98f4e"; ctx.lineWidth = 2.5;
  circle(0, -96, 22); ctx.fill(); ctx.stroke();
  // angled bob
  ctx.fillStyle = "#d99a3f"; ctx.strokeStyle = "#9c7224"; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-22, -94); ctx.quadraticCurveTo(-24, -122, 0, -122);
  ctx.quadraticCurveTo(26, -122, 24, -94); ctx.lineTo(28, -68); ctx.lineTo(16, -68);
  ctx.lineTo(16, -96); ctx.quadraticCurveTo(16, -110, 0, -110);
  ctx.quadraticCurveTo(-16, -110, -18, -92); ctx.lineTo(-18, -78); ctx.lineTo(-26, -78); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // angry brows
  ctx.strokeStyle = "#7a5a22"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-14, -104); ctx.lineTo(-3, -100);
  ctx.moveTo(14, -104); ctx.lineTo(3, -100); ctx.stroke(); ctx.lineCap = "butt";
  // eyes
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#3b3e42"; ctx.lineWidth = 1.5;
  ell(-8, -94, 6.5, 8); ctx.fill(); ctx.stroke();
  ell(8, -94, 6.5, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2b2b2b"; circle(-7, -92, 3.2); ctx.fill(); circle(9, -92, 3.2); ctx.fill();
  // mouth
  ctx.fillStyle = "#7a2e36"; ell(0, -82, 6, 4.5); ctx.fill();
  // "!" bubble
  if (angry) {
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 2;
    roundRect(-44, -128, 26, 20, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c0392b"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("!", -31, -117);
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* --------- world render (gameplay scenes) --------- */
function drawWorld() {
  drawSky();
  drawGround();
  ctx.save();
  ctx.translate(-S.cam, 0);
  drawTree(TREE_X);
  drawZone();
  drawCar(CAR_X);
  drawRestroom(REST_X);
  for (var i = 0; i < S.piles.length; i++) drawPile(S.piles[i].x);
  // Karen
  if (S.karenE && (S.state === "RETURN" || S.state === "GAUNTLET" || S.state === "GETAWAY")) {
    drawKaren(S.karenE.x, S.karenE.face, S.karen > 55 || S.state === "GETAWAY");
  }
  // dogs
  for (var j = 0; j < S.dogs.length; j++) {
    var d = S.dogs[j];
    if (d.state === "secured") continue;
    if (d.state === "led") {
      ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(S.player.x, HORIZON + 95); ctx.lineTo(d.x, HORIZON + 110); ctx.stroke();
    }
    drawDog(d.x, d.type);
  }
  // cop car during getaway
  if (S.state === "GETAWAY") {
    var copX = lerp(WORLD + 120, CAR_X + 360, 1 - clamp(S.copTimer / 13, 0, 1));
    drawCopCar(copX);
  }
  // player
  if (S.player) drawPlanner(S.player.x, S.player.face, S.player.walk);
  ctx.restore();
}

function drawCopCar(x) {
  ctx.save(); ctx.translate(x, HORIZON + 96);
  ctx.fillStyle = "rgba(0,0,0,0.15)"; ell(70, 64, 86, 12); ctx.fill();
  ctx.fillStyle = "#2b2b2b"; circle(40, 48, 18); ctx.fill(); circle(140, 48, 18); ctx.fill();
  ctx.fillStyle = "#dfe6ee"; ctx.strokeStyle = "#1b2530"; ctx.lineWidth = 4;
  roundRect(6, 6, 150, 40, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(34, 8); ctx.lineTo(52, -16); ctx.lineTo(120, -16); ctx.lineTo(140, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1b2530"; ctx.fillRect(70, 14, 22, 26);   // door accent
  // light bar
  ctx.fillStyle = (Math.floor(S.t * 8) % 2 ? "#e23b3b" : "#3b6be2");
  ctx.fillRect(70, -24, 16, 8);
  ctx.fillStyle = (Math.floor(S.t * 8) % 2 ? "#3b6be2" : "#e23b3b");
  ctx.fillRect(86, -24, 16, 8);
  ctx.restore();
}

/* =========================================================================
   HUD + SCREENS
   ========================================================================= */
function text(t, x, y, size, color, align, weight) {
  ctx.fillStyle = color || "#fff";
  ctx.font = (weight || "bold") + " " + size + "px 'Trebuchet MS','Segoe UI',sans-serif";
  ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(t, x, y);
}

function meter(x, y, w, frac, color, label) {
  ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(x, y, w, 14, 7); ctx.fill();
  ctx.fillStyle = color; roundRect(x, y, w * clamp(frac, 0, 1), 14, 7); ctx.fill();
  if (label) text(label, x - 6, y + 12, 12, "#fff", "right");
}

function drawHUD() {
  // backing
  ctx.fillStyle = "rgba(15,28,40,0.34)"; roundRect(12, 12, 250, 128, 13); ctx.fill();
  // daylight pill
  ctx.fillStyle = "rgba(22,34,46,0.92)"; roundRect(20, 20, 234, 38, 19); ctx.fill();
  ctx.fillStyle = "#ffd23f"; circle(44, 39, 11); ctx.fill();
  text("DAYLIGHT  " + Math.max(0, Math.round(S.daylight)), 62, 45, 19, "#fff");
  ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(20, 62, 234, 8, 4); ctx.fill();
  ctx.fillStyle = "#ffd23f"; roundRect(20, 62, 234 * clamp(S.daylight / DAYLIGHT_MAX, 0, 1), 8, 4); ctx.fill();

  var st = S.state;
  if (st === "DASH") {
    text("PEE", 74, 92, 13, "#fff", "right"); meter(80, 80, 174, S.pee / 100, "#e0524f");
  }
  if (st === "RETURN" || st === "GAUNTLET" || st === "RESTROOM") {
    text("POOP", 74, 92, 13, "#fff", "right"); meter(80, 80, 174, S.poop / 100, "#9c7a3f");
    text("KAREN", 74, 116, 13, "#fff", "right"); meter(80, 104, 174, S.karen / 100, "#d9534f");
  }

  // getaway timer
  if (st === "GETAWAY") {
    ctx.fillStyle = "rgba(180,30,30,0.85)"; roundRect(W / 2 - 130, 16, 260, 40, 10); ctx.fill();
    text("COPS INBOUND: " + Math.ceil(S.copTimer) + "s", W / 2, 43, 20, "#fff", "center");
  }

  // contextual prompt
  var prompt = currentPrompt();
  if (prompt) {
    ctx.fillStyle = "rgba(22,34,46,0.92)";
    var pw = ctx.measureText(prompt).width;
    ctx.font = "bold 16px 'Trebuchet MS',sans-serif"; pw = ctx.measureText(prompt).width + 24;
    roundRect(W / 2 - pw / 2, H - 52, pw, 30, 9); ctx.fill();
    text(prompt, W / 2, H - 32, 16, "#ffe39a", "center");
  }

  // flash message
  if (S.flashT > 0) {
    ctx.globalAlpha = clamp(S.flashT, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "bold 20px 'Trebuchet MS',sans-serif";
    var fw = ctx.measureText(S.flash).width + 32;
    roundRect(W / 2 - fw / 2, 70, fw, 36, 10); ctx.fill();
    text(S.flash, W / 2, 95, 20, "#fff", "center");
    ctx.globalAlpha = 1;
  }

  if (S.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H);
    text("PAUSED", W / 2, H / 2 - 6, 48, "#fff", "center");
    text("Press Esc to resume", W / 2, H / 2 + 30, 18, "#cfd6df", "center");
  }
}

function currentPrompt() {
  var st = S.state, p = S.player;
  if (!p) return "";
  if (st === "DASH" && Math.abs(p.x - DOOR_X) < 70) return "SPACE: Use restroom";
  if (st === "RETURN" && Math.abs(p.x - (CAR_X + 60)) < 90) return "SPACE: Let the dogs out";
  if (st === "GAUNTLET" || st === "GETAWAY") {
    if (S.held && Math.abs(p.x - (CAR_X + 70)) < 95) return "SPACE: Load dog into car";
    if (allSecured() && Math.abs(p.x - (CAR_X + 70)) < 110) return "SPACE: Drive off!";
    for (var i = 0; i < S.piles.length; i++) if (Math.abs(p.x - S.piles[i].x) < 46) return "SPACE: Scoop the poop";
    if (inZone(p.x) && hasLooseOrHeld() && S.poop > 35) return "SPACE: Let them go here (dog area)";
    if (!S.held) {
      for (var j = 0; j < S.dogs.length; j++) {
        if (S.dogs[j].state === "loose" && Math.abs(S.dogs[j].x - p.x) < 60) return "SPACE: Grab the " + niceName(S.dogs[j].type);
      }
    }
  }
  return "";
}

/* ---------- Title ---------- */
function drawTitle() {
  drawSky();
  drawGround();
  ctx.save(); ctx.translate(-Math.min(S.cam, 0), 0); ctx.restore();
  // vignette
  drawCar(W / 2 - 360);
  drawDog(W / 2 - 150, "staffie");
  drawDog(W / 2 - 95, "lab");
  drawDog(W / 2 - 48, "chihuahua");
  // sign
  bigSign(W / 2, 70, 460, 110, "REST STOP");
  ctx.fillStyle = "#6d4c2f"; ctx.strokeStyle = "#f5deb3"; ctx.lineWidth = 3;
  roundRect(W / 2 - 150, 188, 300, 40, 9); ctx.fill(); ctx.stroke();
  text("Karen's Watching", W / 2, 214, 22, "#ffe7c2", "center", "bold italic");
  // menu
  for (var i = 0; i < MENU.length; i++) {
    var sel = i === S.menuIndex;
    text((sel ? "▶ " : "   ") + MENU[i], W / 2, 300 + i * 40, sel ? 30 : 26,
         sel ? "#fff" : "rgba(255,255,255,0.82)", "center");
  }
  // controls strip
  ctx.fillStyle = "rgba(22,34,46,0.92)"; ctx.fillRect(0, H - 34, W, 34);
  text("Move: ← →      Run: Shift      Action: Space      ↑↓ + Enter to choose",
       W / 2, H - 12, 16, "#dfe7ee", "center");
}

function bigSign(cx, y, w, h, label) {
  var x = cx - w / 2;
  ctx.fillStyle = "#15489c"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 6;
  roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff";
  circle(x + 18, y + 18, 4); ctx.fill(); circle(x + w - 18, y + 18, 4); ctx.fill();
  circle(x + 18, y + h - 18, 4); ctx.fill(); circle(x + w - 18, y + h - 18, 4); ctx.fill();
  text(label, cx, y + h / 2 + h * 0.16, h * 0.46, "#fff", "center");
}

/* ---------- How to play ---------- */
function drawHowTo() {
  ctx.fillStyle = "#1d2b3a"; ctx.fillRect(0, 0, W, H);
  text("HOW TO PLAY", W / 2, 56, 34, "#ffd23f", "center");
  var lines = [
    "You're an over-prepared road-tripper racing your three dogs to your",
    "sister's vacation home before dark - you HATE driving at night.",
    "A surprise pee emergency forces an unscheduled rest stop...",
    "",
    "1)  GAMBLE: stop now (safe) or risk it for bonus daylight.",
    "2)  Dash to the restroom before your PEE meter fills (instant fail!).",
    "3)  Get back before the dogs' POOP meter pops or KAREN notices them.",
    "4)  Let the dogs out and load all three back in the car. Corner the",
    "     Chihuahua, steer the Lab, keep the Staffie away from Karen.",
    "5)  Make a dog go in the DOG AREA and scoop it - or Karen calls the cops!",
    "",
    "DAYLIGHT is your score - bank as much as you can before nightfall.",
    "",
    "Move: ← → (or A/D)    Run: Shift    Action: Space    Pause: Esc"
  ];
  for (var i = 0; i < lines.length; i++) {
    text(lines[i], W / 2, 96 + i * 28, 16, "#dbe3ec", "center", "normal");
  }
  text("Press Space to go back", W / 2, H - 24, 18, "#ffd23f", "center");
}

/* ---------- Gamble ---------- */
function drawGamble() {
  drawSky(); drawGround();
  drawCar(W / 2 - 90);
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H);
  text("UH OH - YOU NEED A RESTROOM", W / 2, 110, 30, "#fff", "center");
  text("It's not on the itinerary. Your bladder disagrees.", W / 2, 144, 18, "#cfd6df", "center", "normal");

  panel(W / 2 - 330, 200, 300, 200, "#16324a");
  text("←  PULL OVER NOW", W / 2 - 180, 248, 22, "#9fd3ff", "center");
  wrap(["Safe. You stop at this rest", "stop with room to spare.", "", "Start: 980 daylight"], W / 2 - 180, 286, 16);

  panel(W / 2 + 30, 200, 300, 200, "#4a2630");
  text("RISK IT  →", W / 2 + 180, 248, 22, "#ffb3a7", "center");
  wrap(["Push for the scheduled stop", "for bonus daylight - but your", "pee meter is nearly full!", "Start: 1120 daylight"], W / 2 + 180, 286, 16);

  text("Press ← or → to choose", W / 2, H - 40, 18, "#ffd23f", "center");
}
function panel(x, y, w, h, col) {
  ctx.fillStyle = col; ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
  roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
}
function wrap(arr, cx, y, size) { for (var i = 0; i < arr.length; i++) text(arr[i], cx, y + i * 24, size, "#e7eef5", "center", "normal"); }

/* ---------- Result / Game over ---------- */
function drawResult() {
  drawSky(); drawGround();
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H);
  var msg = S.result.reason === "escaped"
    ? "You peeled out just in time!" : "You made it to your sister's!";
  text(msg, W / 2, 150, 34, "#fff", "center");
  text(S.result.reason === "escaped"
    ? "(The cops never caught you - but the scramble cost daylight.)"
    : "The whole gang arrived before dark. Vacation begins!",
    W / 2, 188, 18, "#cfd6df", "center", "normal");
  text("DAYLIGHT BANKED", W / 2, 264, 22, "#ffd23f", "center");
  text("" + S.result.score, W / 2, 326, 64, "#fff", "center");
  text("Press Space to continue", W / 2, H - 50, 18, "#ffd23f", "center");
}

function drawGameOver() {
  ctx.fillStyle = "#10151d"; ctx.fillRect(0, 0, W, H);
  var title, sub;
  if (S.result.reason === "pee") { title = "ACCIDENT!"; sub = "You didn't make the restroom in time. Cleanup cost the whole day."; }
  else if (S.result.reason === "caught") { title = "BUSTED!"; sub = "The cops arrived before you could leave. Karen looks thrilled."; }
  else { title = "LOST IN THE DARK"; sub = "Night fell before you arrived. Now you're hopelessly lost."; }
  text("GAME OVER", W / 2, 180, 30, "#d9534f", "center");
  text(title, W / 2, 244, 50, "#fff", "center");
  text(sub, W / 2, 292, 18, "#cfd6df", "center", "normal");
  text("Press Space to return to the title", W / 2, H - 60, 18, "#ffd23f", "center");
}

/* ---------- High scores ---------- */
function drawHighScores() {
  drawSky(); drawGround();
  ctx.fillStyle = "rgba(10,16,28,0.55)"; ctx.fillRect(0, 0, W, H);
  bigSign(W / 2, 24, 420, 64, "HIGH SCORES");
  var arr = loadScores();
  var cardX = W / 2 - 290, cardY = 110, cardW = 580;
  ctx.fillStyle = "#fff8e7"; ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = 3;
  roundRect(cardX, cardY, cardW, 366, 16); ctx.fill(); ctx.stroke();
  text("RANK", cardX + 60, cardY + 40, 18, "#3b4252");
  text("INITIALS", cardX + cardW / 2, cardY + 40, 18, "#3b4252", "center");
  text("DAYLIGHT", cardX + cardW - 60, cardY + 40, 18, "#3b4252", "right");
  ctx.strokeStyle = "#cdc3aa"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cardX + 36, cardY + 52); ctx.lineTo(cardX + cardW - 36, cardY + 52); ctx.stroke();
  for (var i = 0; i < arr.length; i++) {
    var ry = cardY + 84 + i * 30;
    if (i === S.newHsIndex) { ctx.fillStyle = "#ffe39a"; roundRect(cardX + 24, ry - 22, cardW - 48, 28, 8); ctx.fill(); }
    var c = i === S.newHsIndex ? "#9c5246" : "#2b2b2b";
    text("" + (i + 1), cardX + 60, ry, 20, c, "center");
    text(arr[i].initials, cardX + cardW / 2, ry, 20, c, "center");
    text("" + arr[i].score, cardX + cardW - 60, ry, 20, i === S.newHsIndex ? "#9c5246" : "#15489c", "right");
  }
  text("Press Space to return to the title", W / 2, H - 22, 17, "#ffd23f", "center");
}

/* ---------- Enter initials ---------- */
function drawEnterInitials() {
  drawSky(); drawGround();
  ctx.fillStyle = "rgba(10,16,28,0.6)"; ctx.fillRect(0, 0, W, H);
  text("NEW HIGH SCORE!", W / 2, 130, 36, "#ffd23f", "center");
  text("Daylight banked: " + S.result.score, W / 2, 170, 20, "#fff", "center", "normal");
  text("Enter your initials", W / 2, 232, 20, "#cfd6df", "center", "normal");
  for (var i = 0; i < 3; i++) {
    var x = W / 2 - 90 + i * 90;
    var sel = i === S.initialSlot;
    ctx.fillStyle = sel ? "#ffe39a" : "#fff8e7"; ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = 3;
    roundRect(x - 32, 270, 64, 80, 10); ctx.fill(); ctx.stroke();
    text(ALPHABET[S.initials[i]], x, 328, 48, "#2b2b2b", "center");
    if (sel) { text("▲", x, 258, 18, "#ffd23f", "center"); text("▼", x, 372, 18, "#ffd23f", "center"); }
  }
  text("← → pick letter    ↑ ↓ change    Enter: Save", W / 2, 430, 18, "#ffd23f", "center");
}

/* =========================================================================
   MAIN LOOP
   ========================================================================= */
function render() {
  ctx.clearRect(0, 0, W, H);
  var st = S.state;
  if (st === "TITLE") drawTitle();
  else if (st === "HOWTO") drawHowTo();
  else if (st === "GAMBLE") drawGamble();
  else if (st === "RESULT") drawResult();
  else if (st === "GAMEOVER") drawGameOver();
  else if (st === "HIGHSCORES") drawHighScores();
  else if (st === "ENTERINITIALS") drawEnterInitials();
  else { drawWorld(); drawHUD(); }   // DASH / RESTROOM / RETURN / GAUNTLET / GETAWAY
}

var last = 0;
function frame(now) {
  var dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  S.t += dt;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

// boot
canvas.focus();
requestAnimationFrame(frame);

})();
