/* Shared behavior: theme toggle, constellation background,
   scraper-safe email, PDF viewer modal, scroll reveals. */

(function () {
  "use strict";

  /* ---------- theme ---------- */
  var root = document.documentElement;
  root.classList.add("js");
  var saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  root.setAttribute("data-theme", saved === "light" ? "light" : "dark");

  function toggleTheme() {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    restyleStars();
  }

  /* ---------- email (assembled at runtime so it never sits in the HTML) ---------- */
  function writeEmail() {
    var parts = ["sreeyutha", "ratala"];
    var host = ["gmail", "com"];
    var el = document.getElementById("email");
    if (el) {
      el.textContent =
        parts[0] + " [dot] " + parts[1] + " [at] " + host[0] + " [dot] " + host[1];
    }
    var btn = document.getElementById("email-btn");
    if (btn) {
      var addr = parts.join(".") + "@" + host.join(".");
      btn.href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(addr);
    }
  }

  /* ---------- constellation background ---------- */
  var canvas, ctx, pts = [], W = 0, H = 0, mouse = { x: -9999, y: -9999 };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var palettes = {
    dark: ["rgba(168,208,240,", "rgba(245,227,163,", "rgba(242,196,206,"],
    light: ["rgba(63,127,192,", "rgba(184,149,46,", "rgba(196,106,133,"]
  };
  var colors = palettes.dark;

  function restyleStars() {
    colors = palettes[root.getAttribute("data-theme")] || palettes.dark;
    pts.forEach(function (p, i) { p.c = colors[i % 3]; });
    if (reduced) drawStars();
  }

  function sizeStars() {
    if (!canvas) return;
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    var target = Math.min(130, Math.floor((W * H) / 16000));
    while (pts.length < target) {
      pts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.8 + 0.7,
        c: colors[pts.length % 3]
      });
    }
    pts.length = target;
  }

  function drawStars() {
    if (!ctx) return;
    var isDark = root.getAttribute("data-theme") !== "light";
    var dotA = isDark ? "0.8)" : "0.5)";
    var lineA = isDark ? "0.13)" : "0.10)";
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (!reduced) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = p.c + dotA;
      ctx.fill();
      for (var j = i + 1; j < pts.length; j++) {
        var q = pts[j];
        var dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
        if (d < 9500) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = p.c + lineA;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      var mdx = p.x - mouse.x, mdy = p.y - mouse.y;
      if (mdx * mdx + mdy * mdy < 22000) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = p.c + (isDark ? "0.22)" : "0.16)");
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
    if (!reduced) requestAnimationFrame(drawStars);
  }

  /* ---------- pdf modal ---------- */
  function openPdf(src, title) {
    var overlay = document.getElementById("pdf-overlay");
    if (!overlay) return;
    overlay.querySelector(".title").textContent = title;
    overlay.querySelector("iframe").src = src;
    overlay.querySelector(".newtab").href = src;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closePdf() {
    var overlay = document.getElementById("pdf-overlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.querySelector("iframe").src = "";
    document.body.style.overflow = "";
  }

  /* ---------- init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    writeEmail();

    var toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.addEventListener("click", toggleTheme);

    canvas = document.getElementById("stars");
    if (canvas) {
      ctx = canvas.getContext("2d");
      sizeStars();
      drawStars();
      window.addEventListener("resize", function () { sizeStars(); if (reduced) drawStars(); });
      window.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
      window.addEventListener("pointerleave", function () { mouse.x = -9999; mouse.y = -9999; });
    }

    document.querySelectorAll("[data-pdf]").forEach(function (b) {
      b.addEventListener("click", function () {
        openPdf(b.getAttribute("data-pdf"), b.getAttribute("data-title") || "Document");
      });
    });

    var overlay = document.getElementById("pdf-overlay");
    if (overlay) {
      overlay.addEventListener("click", function (e) { if (e.target === overlay) closePdf(); });
      overlay.querySelector(".close").addEventListener("click", closePdf);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePdf(); });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

    var wall = document.getElementById("travel-wall");
    var lb = document.getElementById("lightbox");
    if (wall && lb) {
      var photos = Array.prototype.slice.call(wall.querySelectorAll("img"));
      var lbImg = lb.querySelector("img");
      var current = 0;
      function showPhoto(i) {
        current = (i + photos.length) % photos.length;
        lbImg.src = photos[current].src;
        lb.classList.add("open");
        document.body.style.overflow = "hidden";
      }
      function hidePhoto() {
        lb.classList.remove("open");
        document.body.style.overflow = "";
      }
      photos.forEach(function (img, i) {
        img.parentElement.addEventListener("click", function () { showPhoto(i); });
      });
      lb.querySelector(".lb-close").addEventListener("click", hidePhoto);
      lb.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); showPhoto(current - 1); });
      lb.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); showPhoto(current + 1); });
      lb.addEventListener("click", function (e) { if (e.target === lb) hidePhoto(); });
      document.addEventListener("keydown", function (e) {
        if (!lb.classList.contains("open")) return;
        if (e.key === "Escape") hidePhoto();
        if (e.key === "ArrowLeft") showPhoto(current - 1);
        if (e.key === "ArrowRight") showPhoto(current + 1);
      });
    }

    var launch = document.getElementById("launch-game");
    if (launch) {
      launch.addEventListener("click", function () {
        var shell = document.getElementById("game-shell");
        shell.innerHTML =
          '<iframe class="game-frame" src="game/game.html" title="Return of the Imposter game" allow="autoplay; fullscreen"></iframe>';
        shell.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  });
})();
