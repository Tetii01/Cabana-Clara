/* ============================================================
   Cabana Clara — booking engine (cabana integrală)
   Interactive calendar · price logic · WhatsApp flow
   Prepared for Google Calendar API sync (single calendar).
   ============================================================ */
(function () {
  "use strict";

  var WA_PHONE = "40756158908";

  /* ---------------------------------------------------------
     AVAILABILITY SOURCE
     Replace the demo ranges below with a live fetch from the
     Google Calendar API (one calendar for the whole cabin).
     Expected shape: [{ start:'YYYY-MM-DD', end:'YYYY-MM-DD' }]
     where `end` is the check-out day (exclusive — that night
     is free again).
     --------------------------------------------------------- */
  var BOOKED_RANGES = [
    // --- demo occupied periods (remove once calendar is synced) ---
    { start: "2026-06-19", end: "2026-06-22" },
    { start: "2026-07-03", end: "2026-07-06" },
    { start: "2026-08-14", end: "2026-08-17" }
  ];

  async function fetchAvailability() {
    // TODO (deploy): call the Google Calendar API here, e.g.
    //   const res = await fetch('/api/availability');
    //   return await res.json();
    // Must return an array of { start, end } booked ranges.
    return BOOKED_RANGES;
  }

  /* ---- Pricing ---- */
  function pricePerNight(n) {
    if (n >= 5) return 1800;
    if (n === 4) return 2000;
    if (n === 3) return 2000;
    if (n === 2) return 2200;
    return 2500; // 1 night
  }
  var CIUBAR_PER_NIGHT = 400;

  /* ---- Date helpers ---- */
  var MONTHS = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
  var DOW = ["L","Ma","Mi","J","V","S","D"]; // Monday-first

  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fromYmd(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function startOfDay(d) { var x = new Date(d); x.setHours(0,0,0,0); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function diffNights(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
  function fmtRO(d) {
    return String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0") + "." + d.getFullYear();
  }
  function fmtMoney(n) { return n.toLocaleString("ro-RO") + " RON"; }

  /* ---- State ---- */
  var booked = new Set();          // set of booked NIGHT date-strings
  var today = startOfDay(new Date());
  var viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  var checkIn = null, checkOut = null, ciubar = false;

  function expandBooked(ranges) {
    booked.clear();
    ranges.forEach(function (r) {
      var d = fromYmd(r.start), end = fromYmd(r.end);
      while (d < end) { booked.add(ymd(d)); d = addDays(d, 1); }
    });
  }

  // is the night beginning on date `d` blocked?
  function isBookedNight(d) { return booked.has(ymd(d)); }
  function isPast(d) { return startOfDay(d) < today; }
  // any booked night in [a, b) ?
  function rangeHasBooked(a, b) {
    var d = startOfDay(a);
    while (d < startOfDay(b)) { if (isBookedNight(d)) return true; d = addDays(d, 1); }
    return false;
  }

  /* ---- Elements ---- */
  var elTitle = document.querySelector(".cal__title");
  var elMonths = document.querySelector(".cal__months");
  var elPrev = document.querySelector(".cal__prev");
  var elNext = document.querySelector(".cal__next");

  /* ---- Render calendar ---- */
  function monthHTML(base) {
    var y = base.getFullYear(), m = base.getMonth();
    var first = new Date(y, m, 1);
    var startDow = (first.getDay() + 6) % 7; // Monday-first
    var daysIn = new Date(y, m + 1, 0).getDate();
    var html = '<div class="cal__month"><div class="cal__mname">' + MONTHS[m] + " " + y + '</div>';
    html += '<div class="cal__dow">' + DOW.map(function (d){ return "<span>" + d + "</span>"; }).join("") + "</div>";
    html += '<div class="cal__days">';
    for (var i = 0; i < startDow; i++) html += '<div class="cal__day is-empty"></div>';
    for (var day = 1; day <= daysIn; day++) {
      var d = new Date(y, m, day);
      var key = ymd(d);
      var cls = "cal__day", clickable = false;
      if (isPast(d)) cls += " is-out";
      else if (isBookedNight(d)) cls += " is-booked";
      else { cls += " is-avail"; clickable = true; }

      // selection states
      if (checkIn && key === ymd(checkIn)) cls += " is-start";
      if (checkOut && key === ymd(checkOut)) cls += " is-end";
      if (checkIn && checkOut && d > checkIn && d < checkOut) cls += " in-range";

      html += '<div class="' + cls + '"' + (clickable ? ' data-date="' + key + '"' : "") +
              ' role="button" tabindex="' + (clickable ? "0" : "-1") + '">' + day + "</div>";
    }
    html += "</div></div>";
    return html;
  }

  function render() {
    if (!elMonths) return;
    elTitle.textContent = MONTHS[viewMonth.getMonth()] + " " + viewMonth.getFullYear();
    var next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    elMonths.innerHTML = monthHTML(viewMonth) + monthHTML(next);
    // disable prev if already at current month
    var atStart = viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() === today.getMonth();
    if (elPrev) elPrev.disabled = atStart;
    bindDays();
    renderSummary();
  }

  function bindDays() {
    elMonths.querySelectorAll("[data-date]").forEach(function (el) {
      el.addEventListener("click", function () { pick(fromYmd(el.getAttribute("data-date"))); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(fromYmd(el.getAttribute("data-date"))); }
      });
    });
  }

  function pick(d) {
    if (!checkIn || (checkIn && checkOut)) {
      // start fresh
      checkIn = d; checkOut = null;
    } else {
      if (d <= checkIn) {
        checkIn = d; checkOut = null; // reset
      } else if (rangeHasBooked(checkIn, d)) {
        // a booked night lies inside — restart from clicked day
        checkIn = d; checkOut = null;
      } else {
        checkOut = d;
      }
    }
    render();
  }

  function changeMonth(delta) {
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
    render();
  }
  if (elPrev) elPrev.addEventListener("click", function () { changeMonth(-1); });
  if (elNext) elNext.addEventListener("click", function () { changeMonth(1); });

  /* ---- Summary + price ---- */
  var elCiIn = document.querySelector('[data-sum="checkin"]');
  var elCiOut = document.querySelector('[data-sum="checkout"]');
  var elBoxIn = document.querySelector('[data-box="checkin"]');
  var elBoxOut = document.querySelector('[data-box="checkout"]');
  var elToggle = document.querySelector(".toggle");
  var elBreak = document.querySelector(".sum__break");
  var elEmpty = document.querySelector(".sum__empty");
  var elWa = document.querySelector(".sum__wa");
  var elClear = document.querySelector(".sum__clear");

  if (elToggle) {
    elToggle.addEventListener("click", function () {
      ciubar = !ciubar;
      elToggle.classList.toggle("is-on", ciubar);
      elToggle.setAttribute("aria-pressed", ciubar ? "true" : "false");
      renderSummary();
    });
  }
  if (elClear) {
    elClear.addEventListener("click", function () {
      checkIn = null; checkOut = null; render();
    });
  }

  function renderSummary() {
    // dates display
    if (elBoxIn) {
      elBoxIn.classList.toggle("empty", !checkIn);
      elCiIn.textContent = checkIn ? fmtRO(checkIn) : "Selectează";
    }
    if (elBoxOut) {
      elBoxOut.classList.toggle("empty", !checkOut);
      elCiOut.textContent = checkOut ? fmtRO(checkOut) : "Selectează";
    }

    var ready = checkIn && checkOut;
    if (elEmpty) elEmpty.style.display = ready ? "none" : "block";
    if (elBreak) elBreak.style.display = ready ? "block" : "none";
    if (elWa) { elWa.toggleAttribute("disabled", !ready); }

    if (!ready) return;

    var n = diffNights(checkIn, checkOut);
    var per = pricePerNight(n);
    var base = n * per;
    var ciubarCost = ciubar ? n * CIUBAR_PER_NIGHT : 0;
    var total = base + ciubarCost;
    var nightsLbl = n + (n === 1 ? " noapte" : " nopți");

    var rows = "";
    rows += '<div class="breakdown__row"><span>' + nightsLbl + ' × ' + fmtMoney(per) + '</span><span>' + fmtMoney(base) + '</span></div>';
    if (ciubar) {
      rows += '<div class="breakdown__row"><span class="muted">Ciubăr ' + n + ' × ' + fmtMoney(CIUBAR_PER_NIGHT) + '</span><span class="muted">' + fmtMoney(ciubarCost) + '</span></div>';
    }
    rows +=
      '<div class="breakdown__total"><span class="lbl">Total</span><span class="amt">' + fmtMoney(total) + '</span></div>' +
      '<div class="cash-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>Plata se face cash la cazare.</div>';
    elBreak.innerHTML = rows;

    // WhatsApp link
    if (elWa) {
      var msg =
        "Bună ziua! Doresc să rezerv Cabana Clara (cabana integrală).\n" +
        "Check-in: " + fmtRO(checkIn) + " (de la ora 14:00)\n" +
        "Check-out: " + fmtRO(checkOut) + " (până la ora 12:00)\n" +
        "Număr de nopți: " + n + "\n" +
        "Ciubăr: " + (ciubar ? "Da" : "Nu") + "\n" +
        "Detaliu preț: " + nightsLbl + " × " + fmtMoney(per) + " = " + fmtMoney(base) +
        (ciubar ? " + Ciubăr " + n + " × " + fmtMoney(CIUBAR_PER_NIGHT) + " = " + fmtMoney(ciubarCost) : "") + "\n" +
        "Total: " + fmtMoney(total) + " (plata cash la cazare)";
      elWa.setAttribute("href", "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(msg));
    }
  }

  /* ---- Init ---- */
  fetchAvailability().then(function (ranges) {
    expandBooked(ranges);
    render();
  });
})();
