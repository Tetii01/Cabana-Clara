/* ============================================================
   Cabana Clara — shared site behaviour
   nav · scroll states · mobile menu · reveal · gallery lightbox
   ============================================================ */
(function () {
  "use strict";

  /* ---- Header: solid on scroll + dark-over-hero handling ---- */
  var header = document.querySelector(".site-header");
  var hasHero = document.body.hasAttribute("data-hero");

  function onScroll() {
    if (!header) return;
    // While the mobile menu is open, keep the header in its solid, readable
    // state regardless of scroll position (panel is always cream).
    if (document.body.classList.contains("menu-open")) {
      header.classList.add("is-solid");
      header.classList.remove("on-dark");
      return;
    }
    var y = window.scrollY || window.pageYOffset;
    var solid = y > 40;
    header.classList.toggle("is-solid", solid);
    if (hasHero) {
      // keep "on-dark" treatment only while over the hero image
      var hero = document.querySelector(".hero, .hx");
      var threshold = hero ? hero.offsetHeight - 90 : 600;
      header.classList.toggle("on-dark", y < threshold);
    }
  }
  if (hasHero) header.classList.add("on-dark");
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Hero: scroll-to-expand video ---- */
  var hx = document.querySelector("[data-hero-expand]");
  if (hx) {
    /* Load the hero video as a single Blob and feed both <video> elements.
       Avoids relying on HTTP range support (which some static hosts omit and
       which makes a plain <video src> fail), and prevents the browser from
       logging a resource error. */
    (function () {
      var vids = hx.querySelectorAll("video");
      if (!vids.length) return;
      var url = vids[0].getAttribute("data-vsrc");
      if (!url) return;
      fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
        var obj = URL.createObjectURL(b);
        vids.forEach(function (v) { v.src = obj; v.load(); v.play().catch(function () {}); });
      }).catch(function () {});
    })();
  }

  if (hx && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var hxFrame   = hx.querySelector(".hx__frame");
    var hxBg      = hx.querySelector(".hx__bg");
    var hxTitle   = hx.querySelector(".hx__title");
    var hxWl      = hx.querySelector(".hx__w--l");
    var hxWr      = hx.querySelector(".hx__w--r");
    var hxCue     = hx.querySelector(".hx__cue");
    var hxContent = hx.querySelector(".hx__content");
    var hxMobile  = window.innerWidth < 768;
    var hxTick    = false;

    hx.classList.add("hx--armed");

    function hxClamp(v, a, b) { return Math.min(Math.max(v, a), b); }
    function hxLerp(a, b, t) { return a + (b - a) * t; }
    function hxEase(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function hxRender() {
      hxTick = false;
      var vh = window.innerHeight, vw = window.innerWidth;
      var total = hx.offsetHeight - vh;
      var scrolled = hxClamp(-hx.getBoundingClientRect().top, 0, total);
      var p = total > 0 ? scrolled / total : 1;
      var e = hxClamp(p / 0.7, 0, 1);            // expansion completes at 70% of section scroll
      var es = hxEase(e);

      var minW = hxMobile ? 280 : 380;
      var minH = hxMobile ? 380 : 500;
      hxFrame.style.width = hxLerp(minW, vw, es) + "px";
      hxFrame.style.height = hxLerp(minH, vh, es) + "px";
      hxFrame.style.borderRadius = hxLerp(20, 0, es) + "px";

      hxBg.style.opacity = hxClamp(1 - e * 1.25, 0, 1);

      var shift = (hxMobile ? 62 : 46) * e;     // vw
      hxWl.style.transform = "translateX(-" + shift + "vw)";
      hxWr.style.transform = "translateX(" + shift + "vw)";
      hxTitle.style.opacity = hxClamp(1 - e * 1.5, 0, 1);

      hxCue.style.opacity = hxClamp(1 - e * 5, 0, 1);

      var c = hxClamp((e - 0.6) / 0.25, 0, 1);
      hxContent.style.opacity = c;
      hxContent.style.pointerEvents = c > 0.5 ? "auto" : "none";
      hxContent.style.transform = "translateX(-50%) translateY(" + hxLerp(24, 0, c) + "px)";
    }
    function hxOnScroll() { if (!hxTick) { hxTick = true; requestAnimationFrame(hxRender); } }
    window.addEventListener("scroll", hxOnScroll, { passive: true });
    window.addEventListener("resize", function () { hxMobile = window.innerWidth < 768; hxRender(); });
    hxRender();
  }

  /* ---- Mobile menu ---- */
  var burger = document.querySelector(".burger");
  if (burger) {
    burger.addEventListener("click", function () {
      document.body.classList.toggle("menu-open");
      var open = document.body.classList.contains("menu-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        // make the header solid + readable while the menu overlay is up
        header.classList.add("is-solid");
        header.classList.remove("on-dark");
      } else {
        onScroll(); // restore the correct state for the current scroll position
      }
    });
    document.querySelectorAll(".nav__link").forEach(function (l) {
      l.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        onScroll();
      });
    });
  }

  /* ---- Reveal on scroll ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (r) { io.observe(r); });
  } else {
    reveals.forEach(function (r) { r.classList.add("in"); });
  }

  /* ---- Year in footer ---- */
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- Gallery lightbox ---- */
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbImg = lb.querySelector(".lightbox__img");
    var lbCap = lb.querySelector(".lightbox__cap");
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-lb]"));
    var idx = 0;

    function open(i) {
      idx = i;
      var el = items[i];
      var img = el.querySelector("img");
      var label = el.querySelector(".photo-slot__label");
      if (img && img.getAttribute("src")) {
        lbImg.src = img.src;
        lbImg.alt = img.alt || "";
        lbImg.style.display = "block";
      } else {
        lbImg.style.display = "none";
      }
      lbCap.textContent = label ? label.textContent : (img ? img.alt : "");
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close() { lb.classList.remove("open"); document.body.style.overflow = ""; }
    function go(d) { open((idx + d + items.length) % items.length); }

    items.forEach(function (el, i) {
      el.style.cursor = "zoom-in";
      el.addEventListener("click", function () { open(i); });
    });
    lb.querySelector(".lightbox__close").addEventListener("click", close);
    lb.querySelector(".lightbox__prev").addEventListener("click", function () { go(-1); });
    lb.querySelector(".lightbox__next").addEventListener("click", function () { go(1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    });
  }
})();
