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
      reason: detail.reason,
      api_code: detail.api_code,
      http_status: detail.http_status
    });
  });

  const albumRoot = document.querySelector("[data-album]");
  if (albumRoot) {
    const uploadUrl = (albumRoot.dataset.uploadUrl || "").trim();
    const galleryUrl = (albumRoot.dataset.galleryUrl || "").trim();
    const refreshMs = Number(albumRoot.dataset.refreshMs) || 30000;
    const uploadLinks = albumRoot.querySelectorAll("[data-upload-link]");
    const uploadStatus = albumRoot.querySelector("[data-upload-status]");
    const uploadFrameStatus = albumRoot.querySelector("[data-upload-frame-status]");
    const uploadFrame = albumRoot.querySelector("[data-upload-frame]");
    const uploadFrameWrap = albumRoot.querySelector("[data-upload-frame-wrap]");
    const galleryGrid = albumRoot.querySelector("[data-album-grid]");
    const galleryStatus = albumRoot.querySelector("[data-album-status]");

    const isConfigured = (value) => value && !/^replace_/i.test(value);
    let isFetching = false;

    function updateUpload(url) {
      const ready = isConfigured(url);
      if (!uploadLinks.length) return;

      if (!ready) {
        if (uploadStatus) uploadStatus.textContent = "Upload link coming soon.";
        if (uploadFrameStatus) uploadFrameStatus.textContent = "Upload link coming soon.";
        uploadLinks.forEach((link) => {
          link.classList.add("is-disabled");
          link.setAttribute("aria-disabled", "true");
        });
        if (uploadFrame) uploadFrame.removeAttribute("src");
        if (uploadFrameWrap) uploadFrameWrap.classList.add("is-hidden");
        return;
      }

      uploadLinks.forEach((link) => {
        link.classList.remove("is-disabled");
        link.removeAttribute("aria-disabled");
      });

      if (uploadStatus) uploadStatus.textContent = "Please share up to 10 photos.";
      if (uploadFrameStatus) uploadFrameStatus.textContent = "";
      if (uploadFrame) uploadFrame.src = url;
      if (uploadFrameWrap) uploadFrameWrap.classList.remove("is-hidden");
    }

    function normalizeGalleryItems(payload) {
      if (!payload) return [];
      const items = Array.isArray(payload)
        ? payload
        : payload.items || payload.files || [];
      if (!Array.isArray(items)) return [];

      return items.map((item) => {
        if (!item) return null;
        const url = item.url || item.downloadUrl || item.webContentLink || item.link || "";
        const thumb = item.thumb || item.thumbnailUrl || item.thumbnail || item.preview || url;
        const caption = item.caption || item.name || "";
        return url ? { url, thumb, caption } : null;
      }).filter(Boolean);
    }

    function renderGallery(items) {
      if (!galleryGrid) return;
      galleryGrid.innerHTML = "";
      items.forEach((item, index) => {
        const figure = document.createElement("figure");
        figure.className = "album-item";

        const link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noreferrer";

        const img = document.createElement("img");
        img.src = item.thumb || item.url;
        img.alt = item.caption ? item.caption : `Wedding photo ${index + 1}`;
        img.loading = "lazy";
        img.decoding = "async";

        link.appendChild(img);
        figure.appendChild(link);

        if (item.caption) {
          const caption = document.createElement("figcaption");
          caption.textContent = item.caption;
          figure.appendChild(caption);
        }

        galleryGrid.appendChild(figure);
      });
    }

    function refreshGallery() {
      if (!isConfigured(galleryUrl) || isFetching) return;
      isFetching = true;

      const cacheBust = `t=${Date.now()}`;
      const requestUrl = galleryUrl.includes("?")
        ? `${galleryUrl}&${cacheBust}`
        : `${galleryUrl}?${cacheBust}`;

      fetch(requestUrl, { credentials: "omit" })
        .then((response) => {
          if (!response.ok) throw new Error("Gallery fetch failed.");
          return response.json();
        })
        .then((payload) => {
          const items = normalizeGalleryItems(payload);
          if (!items.length) {
            if (galleryStatus) galleryStatus.textContent = "No photos yet. Check back soon!";
            return;
          }
          renderGallery(items);
          if (galleryStatus) galleryStatus.textContent = "";
        })
        .catch(() => {
          if (galleryStatus) galleryStatus.textContent = "Unable to load photos right now.";
        })
        .finally(() => {
          isFetching = false;
        });
    }

    function handleUploadMessage(event) {
      const origin = event.origin || "";
      const isAllowed = origin.includes("script.google.com") || origin.includes("googleusercontent.com");
      if (!isAllowed) return;
      const payload = event.data || {};
      const type = typeof payload === "string" ? payload : payload.type;
      if (type !== "album:uploaded") return;

      if (galleryStatus) galleryStatus.textContent = "Updating gallery...";
      setTimeout(refreshGallery, 1200);
    }

    updateUpload(uploadUrl);

    if (!isConfigured(galleryUrl)) {
      if (galleryStatus) galleryStatus.textContent = "Gallery link coming soon.";
      return;
    }

    if (galleryStatus) galleryStatus.textContent = "Loading photos...";
    refreshGallery();
    if (refreshMs > 0) setInterval(refreshGallery, refreshMs);
    window.addEventListener("message", handleUploadMessage);
  }

})();
