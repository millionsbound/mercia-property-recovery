/* Mercia two-step enquiry form. No framework. Works without JS too (plain POST to FormSubmit).
   CONFIG: FORM_ENDPOINT is live. SHEET_URL is empty until the Apps Script web app is deployed (see sheet-setup.md). */
(function () {
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/hamzatsvj@gmail.com";
  var SHEET_URL = ""; // e.g. "https://script.google.com/macros/s/XXXX/exec"
  var PHONE = window.MERCIA_PHONE || "07498 603180";

  document.documentElement.className += " js";
  var POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;
  function normPostcode(v) { var m = v.trim().toUpperCase().match(POSTCODE); return m ? m[1] + " " + m[2] : null; }
  function normPhone(v) {
    var d = v.replace(/[^\d+]/g, "");
    if (d.indexOf("+44") === 0) d = "0" + d.slice(3); else if (d.indexOf("44") === 0 && d.length === 12) d = "0" + d.slice(2);
    return /^0\d{9,10}$/.test(d) ? d : null;
  }
  function setErr(form, name, msg) {
    var f = form.querySelector('[data-field="' + name + '"]'); if (!f) return;
    var e = f.querySelector(".err");
    if (msg) { f.classList.add("has-err"); e.textContent = msg; e.hidden = false; }
    else { f.classList.remove("has-err"); e.textContent = ""; e.hidden = true; }
  }
  function val(form, name) {
    var el = form.elements[name]; if (!el) return "";
    if (el.type === "checkbox") return el.checked ? "yes" : "";
    return (el.value || "").trim();
  }

  document.querySelectorAll(".lead-form").forEach(function (box) {
    var form = box.querySelector("form");
    var started = Date.now();
    var label = box.querySelector(".steplabel");
    function go(step) {
      box.setAttribute("data-step", String(step));
      if (label) label.textContent = step === 1 ? "Step 1 of 2: the property" : "Step 2 of 2: how to reach you";
      var target = step === 2 ? box.querySelector(".step2 input") : step === 3 ? box.querySelector(".thanks h2") : box.querySelector(".step1 input");
      if (target) { target.setAttribute("tabindex", target.tagName === "H2" ? "-1" : target.getAttribute("tabindex") || ""); target.focus({ preventScroll: false }); }
      if (step === 3 && window.gtag) window.gtag("event", "generate_lead");
    }
    box.querySelector("[data-next]").addEventListener("click", function () {
      var ok = true;
      if (!normPostcode(val(form, "postcode"))) { setErr(form, "postcode", "Enter the full postcode of the property, for example B23 6AA."); ok = false; } else setErr(form, "postcode");
      if (!val(form, "what_happened")) { setErr(form, "what_happened", "Choose the closest option. Something else is fine."); ok = false; } else setErr(form, "what_happened");
      if (ok) go(2); else { var f = form.querySelector(".has-err input"); if (f) f.focus(); }
    });
    if (/[?&]sent=1/.test(location.search)) box.setAttribute("data-step", "3");
    box.querySelector("[data-back]").addEventListener("click", function () { go(1); });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (box.getAttribute("data-step") !== "2") { box.querySelector("[data-next]").click(); return; }
      var ok = true;
      if (val(form, "name").length < 2) { setErr(form, "name", "Enter your name."); ok = false; } else setErr(form, "name");
      if (!normPhone(val(form, "phone"))) { setErr(form, "phone", "Enter a UK phone number we can call, for example 07700 900123."); ok = false; } else setErr(form, "phone");
      var em = val(form, "email");
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(form, "email", "Check the email address, or leave it blank."); ok = false; } else setErr(form, "email");
      if (!val(form, "consent")) { setErr(form, "consent", "We need your permission to pass your details to a specialist."); ok = false; } else setErr(form, "consent");
      if (!ok) { var f = form.querySelector(".has-err input"); if (f) f.focus(); return; }

      // Spam: honeypot filled or submitted in under 3 seconds. Show thanks, send nothing.
      if (val(form, "_honey") || Date.now() - started < 3000) { go(3); return; }

      var btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Sending...";
      var errBox = box.querySelector(".server-err"); errBox.hidden = true;
      var data = {
        submitted_at: new Date().toISOString(),
        postcode: normPostcode(val(form, "postcode")),
        what_happened: val(form, "what_happened"),
        name: val(form, "name"),
        phone: normPhone(val(form, "phone")),
        email: em || "not given",
        page: location.pathname,
        consent: "yes, " + form.getAttribute("data-consent-version")
      };
      var mail = Object.assign({ _subject: "Mercia enquiry: " + data.postcode + " (" + data.what_happened + ")", _template: "table", _captcha: "false" }, data);
      var jobs = [fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(mail) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.success === "false" || j.success === false) throw new Error(j.message || "send failed"); return true; }); })];
      if (SHEET_URL) jobs.push(fetch(SHEET_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) }).then(function () { return true; }));
      Promise.allSettled(jobs).then(function (res) {
        var anyOk = res.some(function (r) { return r.status === "fulfilled"; });
        if (anyOk) { go(3); return; }
        errBox.textContent = "Sorry, that did not send. Check your connection and try again" + (PHONE ? ", or call us on " + PHONE + "." : ".");
        errBox.hidden = false; btn.disabled = false; btn.textContent = "Send my request";
      });
    });
  });
})();
