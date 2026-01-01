(function () {
  const el = document.getElementById("countdown");
  if (el) {
    // Wedding date/time in America/Phoenix is fine for you, but guests may be elsewhere.
    // We'll set a time now as 4:00 PM local time as a placeholder.
    // Update time once you decide.
    const weddingDate = new Date("2026-04-17T10:00:00-04:00"); // Somerset, NJ (EDT in April)

    function pad(n) {
      return String(n).padStart(2, "0");
    }

    function tick() {
      const now = new Date();
      const diff = weddingDate.getTime() - now.getTime();

      if (diff <= 0) {
        el.textContent = "It’s wedding time! 🎉";
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      el.textContent = `${days}d ${pad(hours)}h ${pad(minutes)}m`;
    }

    tick();
    setInterval(tick, 1000 * 30); // update every 30s (no need for every second)
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function toSnakeCase(value) {
    return value
      .replace(/^[A-Z]/, (match) => match.toLowerCase())
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase();
  }

  function cleanParams(params) {
    const cleaned = {};
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === "") return;
      cleaned[key] = value;
    });
    return cleaned;
  }

  function trackEvent(name, params) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, cleanParams(params || {}));
  }

  function getAnalyticsParams(link) {
    const params = {};
    Object.keys(link.dataset || {}).forEach((key) => {
      if (!key.startsWith("analytics") || key === "analyticsEvent") return;
      const paramKey = toSnakeCase(key.replace(/^analytics/, ""));
      params[paramKey] = link.dataset[key];
    });

    const linkText = normalizeText(link.textContent);
    const linkHref = link.getAttribute("href") || "";
    if (linkText) params.link_text = linkText;
    if (linkHref && !linkHref.startsWith("mailto:")) params.link_url = linkHref;

    return params;
  }

  function trackDataAnalytics(link) {
    const eventName = link.dataset ? link.dataset.analyticsEvent : "";
    if (!eventName) return false;
    trackEvent(eventName, getAnalyticsParams(link));
    return true;
  }

  function trackNavClick(link) {
    const linkText = normalizeText(link.textContent);
    const linkHref = link.getAttribute("href") || "";
    trackEvent("nav_click", {
      link_text: linkText,
      link_url: linkHref
    });
  }

  function trackMailtoClick(link) {
    const href = link.getAttribute("href") || "";
    const email = href.replace(/^mailto:/, "").split("?")[0];
    const domain = email.split("@")[1] || "";
    trackEvent("mailto_click", {
      email_domain: domain,
      link_text: normalizeText(link.textContent)
    });
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;

    if (trackDataAnalytics(link)) return;

    if (link.closest("nav")) {
      trackNavClick(link);
      return;
    }

    if ((link.getAttribute("href") || "").startsWith("mailto:")) {
      trackMailtoClick(link);
    }
  });

  window.addEventListener("rsvp:lookup", (event) => {
    const detail = event.detail || {};
    trackEvent("rsvp_lookup", {
      result: detail.result,
      reason: detail.reason
    });
  });

  window.addEventListener("rsvp:submit", (event) => {
    const detail = event.detail || {};
    trackEvent("rsvp_submit", {
      attending: detail.attending
    });
  });

  window.addEventListener("rsvp:success", (event) => {
    const detail = event.detail || {};
    const adults = Number(detail.adults);
    const kids515 = Number(detail.kids_5_15);
    const kidsUnder5 = Number(detail.kids_under_5);

    trackEvent("rsvp_success", {
      attending: detail.attending,
      adults: Number.isNaN(adults) ? undefined : adults,
      kids_5_15: Number.isNaN(kids515) ? undefined : kids515,
      kids_under_5: Number.isNaN(kidsUnder5) ? undefined : kidsUnder5
    });
  });

  window.addEventListener("rsvp:submit_error", (event) => {
    const detail = event.detail || {};
    trackEvent("rsvp_error", {
      reason: detail.reason
    });
  });

})();
