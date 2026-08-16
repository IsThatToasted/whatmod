const cfg = window.SCOOTERCAST_ADMIN_CONFIG || {};
const $ = id => document.getElementById(id);

let summary = null;

const els = {
  error: $("error"), refresh: $("refresh"),
  activeRides: $("activeRides"), activeViewers: $("activeViewers"), updated: $("updated"),
  participantMinutes: $("participantMinutes"), minuteBar: $("minuteBar"), minutePct: $("minutePct"),
  minuteRemaining: $("minuteRemaining"), minuteLimitText: $("minuteLimitText"),
  egressGB: $("egressGB"), egressBar: $("egressBar"), egressPct: $("egressPct"),
  egressLimitText: $("egressLimitText"), riderMinutes: $("riderMinutes"), viewerMinutes: $("viewerMinutes"),
  ridesStarted: $("ridesStarted"), viewerSessions: $("viewerSessions"),
  recordingMinutes: $("recordingMinutes"), readyRecordings: $("readyRecordings"),
  recordingErrors: $("recordingErrors"), coverageNote: $("coverageNote"),
  bitrate: $("bitrate"),
  minuteLimit: $("minuteLimit"), egressLimit: $("egressLimit"), threeHourOne: $("threeHourOne"),
  threeHourFive: $("threeHourFive"), fiveHourOne: $("fiveHourOne"),
  recordingStorageEstimate: $("recordingStorageEstimate"), period: $("period"),
};

function gbForViewerMinutes(minutes, mbps) {
  return (minutes * 60 * mbps) / 8 / 1000;
}

function projection(hours, viewers, mbps) {
  const viewerMinutes = hours * 60 * viewers;
  const riderMinutes = hours * 60;
  const participantMinutes = riderMinutes + viewerMinutes;
  const gb = gbForViewerMinutes(viewerMinutes, mbps);
  return `${participantMinutes.toLocaleString()} participant-min · ${gb.toFixed(2)} GB`;
}

function render() {
  if (!summary) return;

  const bitrate = Math.max(.1, Number(els.bitrate.value || 2.5));
  const minuteLimit = Math.max(1, Number(els.minuteLimit.value || 5000));
  const egressLimit = Math.max(1, Number(els.egressLimit.value || 50));

  const participant = Number(summary.participant_minutes || 0);
  const viewer = Number(summary.viewer_minutes || 0);
  const rider = Number(summary.rider_minutes || 0);
  const estimatedGB = gbForViewerMinutes(viewer, bitrate);

  els.activeRides.textContent = summary.active_rides ?? 0;
  els.activeViewers.textContent = summary.active_viewers ?? 0;
  els.updated.textContent = new Date(summary.as_of).toLocaleTimeString();

  els.participantMinutes.textContent = participant.toFixed(0);
  els.riderMinutes.textContent = rider.toFixed(0);
  els.viewerMinutes.textContent = viewer.toFixed(0);
  els.ridesStarted.textContent = summary.rides_started ?? 0;
  els.viewerSessions.textContent = summary.viewer_sessions ?? 0;
  if (els.recordingMinutes) {
    els.recordingMinutes.textContent = Number(summary.recording_minutes || 0).toFixed(0);
  }
  if (els.readyRecordings) {
    els.readyRecordings.textContent = summary.ready_recordings ?? 0;
  }
  if (els.recordingErrors) {
    els.recordingErrors.textContent = summary.recording_errors ?? 0;
  }

  if (els.coverageNote) {
    const start = new Date(summary.period_start).toLocaleString();
    const asOf = new Date(summary.as_of).toLocaleString();
    els.coverageNote.textContent =
      `Usage shown from ${start} through ${asOf}. Rider minutes come from all rides overlapping this period; viewer minutes come from viewer-session heartbeats. Recorded-video time is tracked separately and is not added to WebRTC participant minutes.`;
  }

  const minutePct = Math.min(100, participant / minuteLimit * 100);
  els.minuteBar.style.width = `${minutePct}%`;
  els.minutePct.textContent = `${minutePct.toFixed(1)}% used`;
  els.minuteRemaining.textContent = `${Math.max(0, minuteLimit - participant).toFixed(0)} remaining`;
  els.minuteLimitText.textContent = minuteLimit.toLocaleString();

  const egressPct = Math.min(100, estimatedGB / egressLimit * 100);
  els.egressGB.textContent = estimatedGB.toFixed(2);
  els.egressBar.style.width = `${egressPct}%`;
  els.egressPct.textContent = `${egressPct.toFixed(1)}% estimated`;
  els.egressLimitText.textContent = egressLimit.toLocaleString();

  els.threeHourOne.textContent = projection(3, 1, bitrate);
  els.threeHourFive.textContent = projection(3, 5, bitrate);
  els.fiveHourOne.textContent = projection(5, 1, bitrate);

  if (els.recordingStorageEstimate) {
    const recordingGB = gbForViewerMinutes(
      Number(summary.recording_minutes || 0),
      bitrate
    );
    els.recordingStorageEstimate.textContent =
      `${recordingGB.toFixed(2)} GB @ ${bitrate.toFixed(1)} Mbps`;
  }

  els.period.textContent =
    `${new Date(summary.period_start).toLocaleDateString()} – ${new Date(summary.as_of).toLocaleDateString()}`;

  localStorage.setItem("scootercast-bitrate", String(bitrate));
  localStorage.setItem("scootercast-minute-limit", String(minuteLimit));
  localStorage.setItem("scootercast-egress-limit", String(egressLimit));
}

async function load() {
  els.error.classList.add("hidden");

  try {
    const response = await fetch(`${cfg.rideApiUrl}?action=usage-summary`, {
      cache: "no-store",
      headers: adminHeaders(),
    });
    const body = await response.json();

    if (!response.ok) throw new Error(body.error || `Server error ${response.status}`);

    summary = body;
    render();
  } catch (err) {
    els.error.textContent = err.message || String(err);
    els.error.classList.remove("hidden");
  }
}

els.bitrate.value = localStorage.getItem("scootercast-bitrate") || "2.5";
els.minuteLimit.value = localStorage.getItem("scootercast-minute-limit") || "5000";
els.egressLimit.value = localStorage.getItem("scootercast-egress-limit") || "50";

for (const input of [els.bitrate, els.minuteLimit, els.egressLimit]) {
  input.addEventListener("input", render);
}

els.refresh.addEventListener("click", load);


let adminPassword = sessionStorage.getItem("scootercast-admin-password") || "";
let adminRefreshTimer = null;

function adminHeaders() {
  return {
    "x-admin-password": adminPassword,
  };
}

async function verifyAdminPassword(password) {
  const response = await fetch(`${cfg.rideApiUrl}?action=admin-login`, {
    method: "POST",
    headers: { "x-admin-password": password },
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Invalid password");
  return true;
}

async function loadReplayAdmin() {
  const list = document.getElementById("replayAdminList");
  const empty = document.getElementById("replayAdminEmpty");
  if (!list) return;

  const response = await fetch(`${cfg.rideApiUrl}?action=admin-list-replays`, {
    cache: "no-store",
    headers: adminHeaders(),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Unable to load replays");

  const rides = body.rides || [];
  list.innerHTML = "";
  empty?.classList.toggle("hidden", rides.length !== 0);

  for (const ride of rides) {
    const row = document.createElement("div");
    row.className = "replay-admin-row";

    const recordingClass =
      ride.recording_status === "ready"
        ? "recording-ready"
        : ride.recording_status === "error"
          ? "recording-error"
          : "";

    row.innerHTML = `
      <div>
        <h3>${escapeAdminHTML(ride.title || "Scooter Ride")}</h3>
        <div class="replay-admin-meta">
          <span>${ride.ended_at ? new Date(ride.ended_at).toLocaleString() : "Ended"}</span>
          <span class="${recordingClass}">Video: ${escapeAdminHTML(ride.recording_status || "none")}</span>
          ${ride.recording_error ? `<span class="recording-error">${escapeAdminHTML(ride.recording_error)}</span>` : ""}
        </div>
      </div>
      <button class="delete-replay" data-id="${ride.id}" data-title="${escapeAdminHTML(ride.title || "Scooter Ride")}">Delete Replay</button>
    `;

    list.appendChild(row);
  }

  list.querySelectorAll(".delete-replay").forEach(button => {
    button.addEventListener("click", async () => {
      const title = button.dataset.title || "this replay";

      if (!confirm(`Permanently delete "${title}" and all of its video/telemetry?`)) {
        return;
      }

      button.disabled = true;
      button.textContent = "Deleting…";

      try {
        const response = await fetch(`${cfg.rideApiUrl}?action=admin-delete-replay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...adminHeaders(),
          },
          body: JSON.stringify({ ride_id: button.dataset.id }),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Delete failed");

        await Promise.all([loadReplayAdmin(), load()]);
      } catch (error) {
        alert(error.message || String(error));
        button.disabled = false;
        button.textContent = "Delete Replay";
      }
    });
  });
}

function escapeAdminHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

async function unlockAdmin(password) {
  await verifyAdminPassword(password);
  adminPassword = password;
  sessionStorage.setItem("scootercast-admin-password", password);
  document.getElementById("adminGate")?.classList.add("hidden");
  await Promise.all([load(), loadReplayAdmin()]);

  if (!adminRefreshTimer) {
    adminRefreshTimer = setInterval(() => {
      load();
      loadReplayAdmin();
    }, 60000);
  }
}

document.getElementById("adminLoginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const input = document.getElementById("adminPassword");
  const error = document.getElementById("loginError");
  error.textContent = "";

  try {
    await unlockAdmin(input.value);
  } catch (err) {
    error.textContent = err.message || "Invalid password";
  }
});

document.getElementById("refreshReplayAdmin")?.addEventListener("click", () => {
  loadReplayAdmin().catch(err => alert(err.message || String(err)));
});

if (adminPassword) {
  unlockAdmin(adminPassword).catch(() => {
    sessionStorage.removeItem("scootercast-admin-password");
    adminPassword = "";
    document.getElementById("adminGate")?.classList.remove("hidden");
  });
}
