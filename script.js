(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============================================================
     PARTICLES
  ============================================================ */
  function initParticles() {
    var canvas = document.getElementById("particles");
    if (!canvas || prefersReducedMotion) return;
    var ctx = canvas.getContext("2d");
    var particles = [];
    var count = window.innerWidth < 600 ? 34 : 60;
    var w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function makeParticle() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        speed: Math.random() * 0.12 + 0.03,
        drift: (Math.random() - 0.5) * 0.06,
        alpha: Math.random() * 0.5 + 0.15,
        pulse: Math.random() * Math.PI * 2
      };
    }
    for (var i = 0; i < count; i++) particles.push(makeParticle());

    var rafId;
    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.y -= p.speed;
        p.x += p.drift;
        p.pulse += 0.01;
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;

        var flicker = (Math.sin(p.pulse) + 1) / 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(201,162,39," + (p.alpha * (0.4 + flicker * 0.6)) + ")";
        ctx.fill();
      }
      rafId = requestAnimationFrame(tick);
    }
    tick();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) cancelAnimationFrame(rafId);
      else tick();
    });
  }

  /* ============================================================
     SCROLL REVEALS
  ============================================================ */
  function initReveals() {
    var blocks = document.querySelectorAll("[data-reveal-block]");
    var allScreens = document.querySelectorAll(".screen");
    var targets = Array.prototype.slice.call(blocks);

    if (!("IntersectionObserver" in window) || prefersReducedMotion) {
      targets.forEach(function (el) { el.classList.add("is-in-view"); });
      Array.prototype.forEach.call(allScreens, function (el) { el.classList.add("is-in-view"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in-view");
            var parentScreen = entry.target.closest(".screen");
            if (parentScreen) parentScreen.classList.add("is-in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ============================================================
     MUSIC
     Attempts playback immediately on load, from 0:00. Browsers
     (especially iPhone Safari and Android Chrome) may block
     unmuted autoplay before any user gesture — that's a browser
     policy Claude/JS cannot override. If the first attempt is
     blocked, we quietly retry on the visitor's first tap/click/
     scroll/key press, still starting from the beginning, with
     no visible error and no ugly native player.
  ============================================================ */
  function initMusic() {
    var audio = document.getElementById("bgMusic");
    var toggle = document.getElementById("musicToggle");
    if (!audio || !toggle) return { attempt: function () {} };

    var TARGET_VOLUME = 0.32;
    var userPaused = false; // true only when Mira explicitly pauses
    audio.volume = TARGET_VOLUME;

    function setToggleState(playing) {
      toggle.setAttribute("aria-pressed", playing ? "true" : "false");
      toggle.classList.toggle("is-playing", playing);
    }

    function fadeToTarget() {
      var step = 0;
      var iv = setInterval(function () {
        step++;
        audio.volume = Math.min(TARGET_VOLUME, step * (TARGET_VOLUME / 16));
        if (step >= 16) clearInterval(iv);
      }, 70);
    }

    function attempt() {
      if (userPaused || !audio.paused) return;
      audio.volume = 0;
      var playPromise = audio.play();
      if (playPromise && playPromise.then) {
        playPromise
          .then(function () {
            fadeToTarget();
          })
          .catch(function () {
            /* autoplay blocked or file missing — retried on first
               interaction below; never surfaced as an error */
          });
      } else {
        fadeToTarget();
      }
    }

    audio.addEventListener("play", function () { setToggleState(true); });
    audio.addEventListener("pause", function () { setToggleState(false); });

    // Retry once on the very first user interaction, still from 0:00
    // since playback never actually started if it was blocked.
    var retryEvents = ["pointerdown", "touchstart", "keydown", "scroll"];
    function firstInteractionRetry() {
      if (!userPaused && audio.paused) attempt();
      retryEvents.forEach(function (evt) {
        window.removeEventListener(evt, firstInteractionRetry);
      });
    }
    retryEvents.forEach(function (evt) {
      window.addEventListener(evt, firstInteractionRetry, { once: true, passive: true });
    });

    toggle.addEventListener("click", function () {
      if (audio.paused) {
        userPaused = false;
        if (audio.currentTime === 0) attempt();
        else {
          var p = audio.play();
          if (p && p.then) p.then(fadeToTarget).catch(function () {});
        }
      } else {
        userPaused = true;
        audio.pause();
      }
    });

    return { attempt: attempt };
  }

  /* ============================================================
     OPEN LETTER TRANSITION
  ============================================================ */
  function initOpenLetter(music) {
    var openBtn = document.getElementById("openLetter");
    var intro = document.getElementById("intro");
    var letter = document.getElementById("letter");
    if (!openBtn || !intro || !letter) return;

    openBtn.addEventListener("click", function () {
      openBtn.classList.add("is-pressed");

      setTimeout(function () {
        intro.style.transition = "opacity 1.1s cubic-bezier(0.22,1,0.36,1)";
        intro.style.opacity = "0";
        music.attempt();

        setTimeout(function () {
          intro.setAttribute("hidden", "");
          letter.hidden = false;
          requestAnimationFrame(function () {
            letter.classList.add("is-visible");
            letter.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
          });
        }, 950);
      }, 220);
    });
  }

  /* ============================================================
     DUA REVEAL
  ============================================================ */
  function initDua() {
    var btn = document.getElementById("duaBtn");
    var reveal = document.getElementById("duaReveal");
    if (!btn || !reveal) return;

    btn.addEventListener("click", function () {
      if (!reveal.hidden) return;
      reveal.hidden = false;
      requestAnimationFrame(function () {
        reveal.classList.add("is-shown");
      });
      btn.setAttribute("aria-expanded", "true");
      btn.style.opacity = "0.65";
      btn.style.pointerEvents = "none";
    });
  }

  /* ============================================================
     INIT
  ============================================================ */
  document.addEventListener("DOMContentLoaded", function () {
    initParticles();
    initReveals();
    var music = initMusic();
    music.attempt();
    initOpenLetter(music);
    initDua();
  });
})();
