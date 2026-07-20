/* Agent Academy: a tiny tabular Q-learning agent the visitor trains live.
   Pure client-side, no libraries. */

(function () {
  "use strict";

  var canvas = document.getElementById("academy-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  var COLS = 12, ROWS = 7, CW = 75, CH = 80;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* level layouts: walls as "r,c" strings */
  var LEVELS = [
    {
      start: [3, 0], goal: [3, 11],
      walls: ["1,4", "2,4", "3,4", "5,7", "4,7", "3,7"],
      hazards: []
    },
    {
      start: [6, 0], goal: [0, 11],
      walls: ["5,2", "4,2", "3,2", "2,2", "0,5", "1,5", "2,5", "3,5", "6,8", "5,8", "4,8", "3,8", "1,9"],
      hazards: ["3,3"]
    },
    {
      start: [0, 0], goal: [6, 11],
      walls: ["1,1", "2,1", "3,1", "5,3", "6,3", "4,3", "0,4", "1,4", "2,6", "3,6", "4,6", "5,6",
              "0,8", "1,8", "6,9", "5,9", "2,10", "3,10"],
      hazards: ["4,4", "2,8"]
    }
  ];

  var state = {
    level: 0,
    walls: {}, treats: {}, hazards: {},
    start: [0, 0], goal: [0, 0],
    agent: [0, 0],
    Q: null,
    eps: 1.0,
    episodes: 0, totalEpisodes: 0,
    steps: 0, maxSteps: 220,
    streak: 0, needed: 6,
    training: false,
    brain: false,
    tool: "wall",
    collected: {},
    trail: [],
    confetti: [],
    graduated: false,
    optimal: 1
  };

  function key(r, c) { return r + "," + c; }

  function loadLevel(i) {
    var L = LEVELS[i];
    state.level = i;
    state.walls = {}; state.treats = {}; state.hazards = {};
    L.walls.forEach(function (k) { state.walls[k] = true; });
    L.hazards.forEach(function (k) { state.hazards[k] = true; });
    state.start = L.start.slice();
    state.goal = L.goal.slice();
    state.agent = L.start.slice();
    state.Q = [];
    for (var r = 0; r < ROWS; r++) {
      state.Q.push([]);
      for (var c = 0; c < COLS; c++) state.Q[r].push([0, 0, 0, 0]);
    }
    state.eps = 1.0;
    state.episodes = 0;
    state.steps = 0;
    state.streak = 0;
    state.collected = {};
    state.trail = [];
    state.graduated = false;
    computeOptimal();
    updateHud();
  }

  function computeOptimal() {
    /* BFS shortest path from start to goal around walls */
    var seen = {}, q = [[state.start[0], state.start[1], 0]];
    seen[key(state.start[0], state.start[1])] = true;
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (q.length) {
      var n = q.shift();
      if (n[0] === state.goal[0] && n[1] === state.goal[1]) { state.optimal = n[2]; return; }
      for (var d = 0; d < 4; d++) {
        var r = n[0] + dirs[d][0], c = n[1] + dirs[d][1];
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        var k = key(r, c);
        if (seen[k] || state.walls[k]) continue;
        seen[k] = true;
        q.push([r, c, n[2] + 1]);
      }
    }
    state.optimal = Infinity;
  }

  /* ---------- RL core ---------- */
  var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function chooseAction(r, c) {
    if (Math.random() < state.eps) return Math.floor(Math.random() * 4);
    var q = state.Q[r][c], best = 0;
    for (var a = 1; a < 4; a++) if (q[a] > q[best]) best = a;
    return best;
  }

  function envStep() {
    var r = state.agent[0], c = state.agent[1];
    var a = chooseAction(r, c);
    var nr = r + DIRS[a][0], nc = c + DIRS[a][1];
    var reward = -0.5, done = false, success = false;

    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || state.walls[key(nr, nc)]) {
      nr = r; nc = c; reward = -1;
    } else if (state.hazards[key(nr, nc)]) {
      reward = -10; done = true;
    } else if (nr === state.goal[0] && nc === state.goal[1]) {
      reward = 50; done = true; success = true;
    } else if (state.treats[key(nr, nc)] && !state.collected[key(nr, nc)]) {
      state.collected[key(nr, nc)] = true;
      reward = 5;
    }

    var q = state.Q[r][c];
    var nq = state.Q[nr][nc];
    var maxNext = Math.max(nq[0], nq[1], nq[2], nq[3]);
    q[a] += 0.3 * (reward + (done ? 0 : 0.92 * maxNext) - q[a]);

    state.agent = [nr, nc];
    state.steps++;
    if (!reduced) {
      state.trail.push([nr, nc]);
      if (state.trail.length > 14) state.trail.shift();
    }

    if (done || state.steps >= state.maxSteps) endEpisode(success);
  }

  function endEpisode(success) {
    state.episodes++;
    state.totalEpisodes++;
    var msg;
    if (success) {
      var good = state.steps <= state.optimal * 1.6;
      state.streak = good ? state.streak + 1 : 0;
      msg = "episode " + state.episodes + ": reached the star in " + state.steps + " steps" +
            (good ? "! streak +1" : " (optimal-ish is " + state.optimal + ", keep training)");
    } else {
      state.streak = 0;
      msg = "episode " + state.episodes + ": no star this time, back to school";
    }
    setStatus(msg);
    state.eps = Math.max(0.05, state.eps * 0.985);
    state.agent = state.start.slice();
    state.steps = 0;
    state.collected = {};

    if (state.streak >= state.needed) {
      if (state.level < 2) {
        burstConfetti();
        setStatus("LEVEL " + (state.level + 1) + " MASTERED! your agent moves up a grade ✨");
        var next = state.level + 1;
        setTimeout(function () { loadLevel(next); }, reduced ? 0 : 900);
      } else {
        state.graduated = true;
        state.training = false;
        burstConfetti(); burstConfetti();
        setStatus("your agent graduated in " + state.totalEpisodes + " episodes! press train again to re-enroll it");
        document.getElementById("ac-train").innerHTML = "&#127891; train again";
      }
    }
    updateHud();
  }

  /* ---------- confetti ---------- */
  function burstConfetti() {
    if (reduced) return;
    var colors = ["#a8d0f0", "#f5e3a3", "#f2c4ce", "#bfe3c4"];
    for (var i = 0; i < 90; i++) {
      state.confetti.push({
        x: canvas.width / 2, y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.9) * 13,
        s: Math.random() * 6 + 3, c: colors[i % 4], life: 90 + Math.random() * 40
      });
    }
  }

  /* ---------- drawing ---------- */
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0d13";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = c * CW, y = r * CH, k = key(r, c);
        ctx.strokeStyle = "rgba(160,170,190,0.09)";
        ctx.strokeRect(x + 0.5, y + 0.5, CW - 1, CH - 1);

        if (state.brain) {
          var q = state.Q[r][c];
          var v = Math.max(q[0], q[1], q[2], q[3]);
          if (v > 0.1) {
            ctx.fillStyle = "rgba(168,208,240," + Math.min(0.55, v / 60) + ")";
            ctx.fillRect(x + 2, y + 2, CW - 4, CH - 4);
          } else if (v < -0.1) {
            ctx.fillStyle = "rgba(242,150,170," + Math.min(0.4, -v / 30) + ")";
            ctx.fillRect(x + 2, y + 2, CW - 4, CH - 4);
          }
        }

        if (state.walls[k]) {
          ctx.fillStyle = "#2a3245";
          ctx.fillRect(x + 3, y + 3, CW - 6, CH - 6);
          ctx.strokeStyle = "#3a445c";
          ctx.strokeRect(x + 3.5, y + 3.5, CW - 7, CH - 7);
        }
        if (state.hazards[k]) {
          ctx.fillStyle = "rgba(230,90,110,0.85)";
          ctx.beginPath();
          ctx.arc(x + CW / 2, y + CH / 2, 15, 0, 7);
          ctx.fill();
          ctx.fillStyle = "#0a0d13";
          ctx.fillRect(x + CW / 2 - 9, y + CH / 2 - 4, 18, 6);
        }
        if (state.treats[k] && !state.collected[k]) {
          ctx.fillStyle = "#f2c4ce";
          ctx.beginPath();
          ctx.arc(x + CW / 2, y + CH / 2, 9, 0, 7);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillRect(x + CW / 2 - 1.5, y + CH / 2 - 5, 3, 10);
          ctx.fillRect(x + CW / 2 - 5, y + CH / 2 - 1.5, 10, 3);
        }
      }
    }

    /* goal star */
    drawStar(state.goal[1] * CW + CW / 2, state.goal[0] * CH + CH / 2, 16, "#f5e3a3");

    /* trail */
    for (var t = 0; t < state.trail.length; t++) {
      var tr = state.trail[t];
      ctx.fillStyle = "rgba(168,208,240," + (0.03 + 0.12 * (t / state.trail.length)) + ")";
      ctx.beginPath();
      ctx.arc(tr[1] * CW + CW / 2, tr[0] * CH + CH / 2, 13, 0, 7);
      ctx.fill();
    }

    /* agent */
    var ax = state.agent[1] * CW + CW / 2, ay = state.agent[0] * CH + CH / 2;
    var grd = ctx.createRadialGradient(ax, ay, 2, ax, ay, 26);
    grd.addColorStop(0, "rgba(168,208,240,0.9)");
    grd.addColorStop(1, "rgba(168,208,240,0)");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ax, ay, 26, 0, 7); ctx.fill();
    ctx.fillStyle = "#a8d0f0";
    ctx.beginPath(); ctx.arc(ax, ay, 14, 0, 7); ctx.fill();
    ctx.fillStyle = "#0a0d13";
    ctx.beginPath(); ctx.arc(ax - 5, ay - 3, 2.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(ax + 5, ay - 3, 2.4, 0, 7); ctx.fill();
    ctx.strokeStyle = "#a8d0f0";
    ctx.beginPath(); ctx.moveTo(ax, ay - 14); ctx.lineTo(ax, ay - 21); ctx.stroke();
    ctx.fillStyle = "#f2c4ce";
    ctx.beginPath(); ctx.arc(ax, ay - 23, 3, 0, 7); ctx.fill();

    /* confetti */
    for (var i = state.confetti.length - 1; i >= 0; i--) {
      var p = state.confetti[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.life--;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.s, p.s);
      if (p.life <= 0 || p.y > canvas.height + 20) state.confetti.splice(i, 1);
    }

    /* graduation banner */
    if (state.graduated) {
      ctx.fillStyle = "rgba(10,13,19,0.75)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f5e3a3";
      ctx.font = "700 34px -apple-system, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🎓 Agent graduated!", canvas.width / 2, canvas.height / 2 - 16);
      ctx.fillStyle = "#f0ede4";
      ctx.font = "500 18px -apple-system, Helvetica, sans-serif";
      ctx.fillText(state.totalEpisodes + " episodes of school, 3 levels mastered", canvas.width / 2, canvas.height / 2 + 20);
    }
  }

  function drawStar(x, y, R, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? R : R * 0.45;
      var ang = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(x + rad * Math.cos(ang), y + rad * Math.sin(ang));
    }
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- hud ---------- */
  function updateHud() {
    document.getElementById("ac-level").textContent = state.level + 1;
    document.getElementById("ac-episodes").textContent = state.totalEpisodes;
    document.getElementById("ac-streak").textContent = state.streak + "/" + state.needed;
  }

  function setStatus(msg) {
    document.getElementById("ac-status").textContent = msg;
  }

  /* ---------- main loop ---------- */
  function loop() {
    if (state.training && !state.graduated) {
      var speed = parseInt(document.getElementById("ac-speed").value, 10);
      for (var i = 0; i < speed; i++) {
        if (!state.training || state.graduated) break;
        envStep();
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------- controls ---------- */
  function setTool(tool, btn) {
    state.tool = tool;
    ["ac-tool-wall", "ac-tool-treat", "ac-tool-erase"].forEach(function (id) {
      document.getElementById(id).classList.remove("active");
    });
    btn.classList.add("active");
  }

  document.getElementById("ac-train").addEventListener("click", function () {
    if (state.graduated) {
      state.totalEpisodes = 0;
      this.innerHTML = "&#10074;&#10074; pause";
      loadLevel(0);
      state.training = true;
      setStatus("re-enrolled! back to level 1");
      return;
    }
    state.training = !state.training;
    this.innerHTML = state.training ? "&#10074;&#10074; pause" : "&#9654; train";
    if (state.training && state.optimal === Infinity) {
      setStatus("heads up: the star is walled off! erase some walls so your agent can reach it");
    }
  });

  document.getElementById("ac-brain").addEventListener("click", function () {
    state.brain = !state.brain;
    this.classList.toggle("active", state.brain);
  });

  document.getElementById("ac-reset").addEventListener("click", function () {
    var total = state.totalEpisodes;
    loadLevel(state.level);
    state.totalEpisodes = total;
    updateHud();
    setStatus("level reset: fresh brain, fresh grid");
  });

  document.getElementById("ac-tool-wall").addEventListener("click", function () { setTool("wall", this); });
  document.getElementById("ac-tool-treat").addEventListener("click", function () { setTool("treat", this); });
  document.getElementById("ac-tool-erase").addEventListener("click", function () { setTool("erase", this); });

  canvas.addEventListener("click", function (e) {
    var rect = canvas.getBoundingClientRect();
    var c = Math.floor((e.clientX - rect.left) / rect.width * COLS);
    var r = Math.floor((e.clientY - rect.top) / rect.height * ROWS);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    var k = key(r, c);
    if ((r === state.start[0] && c === state.start[1]) || (r === state.goal[0] && c === state.goal[1])) return;
    if (state.tool === "wall") { delete state.treats[k]; state.walls[k] = !state.walls[k]; if (!state.walls[k]) delete state.walls[k]; }
    if (state.tool === "treat") { delete state.walls[k]; state.treats[k] = !state.treats[k]; if (!state.treats[k]) delete state.treats[k]; }
    if (state.tool === "erase") { delete state.walls[k]; delete state.treats[k]; delete state.hazards[k]; }
    computeOptimal();
    if (state.optimal === Infinity) setStatus("the star is walled off! your agent can never reach it now");
  });

  loadLevel(0);
  loop();
})();
