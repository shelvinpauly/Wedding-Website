(function () {
  // Wedding date/time in America/Phoenix is fine for you, but guests may be elsewhere.
  // We'll set a time now as 4:00 PM local time as a placeholder.
  // Update time once you decide.
  const weddingDate = new Date("2026-04-17T16:00:00-07:00"); // 4:00 PM MST (Phoenix)

  const el = document.getElementById("countdown");
  if (!el) return;

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
})();
