// =========================================================
// LESCO frontend  <->  backend API client
// =========================================================
// Talks to the job-based FastAPI backend (api.py / jobs.py).
// Base URL follows whichever host served the page, so the same build works
// on this PC and from any other computer on the office network.
//
// In DEMO MODE (on Vercel or when the Python backend is offline):
// Intercepts requests for demo jobs and serves rich, realistic pre-computed
// demo results directly without network errors.
// =========================================================

import {
  DEMO_METERS,
  DEMO_SUMMARY,
  DEMO_SHEETS,
  DEMO_ANALYSIS_SHEETS,
  DEMO_ALL_SCREENED_ROWS,
} from "../data/demoData";

/* Talk to the backend on the SAME host that served this page.
   This must NOT be hardcoded to 127.0.0.1: when a colleague opens the app
   over the LAN, their browser resolves 127.0.0.1 to THEIR OWN machine, so
   every request fails. Deriving it from window.location means one build
   works both on this PC and from any other computer on the network.
   Set VITE_API_URL in a .env file only if the backend moves off port 8000. */
export const API_BASE_URL =
  import.meta.env?.VITE_API_URL ||
  (import.meta.env?.DEV
    ? // dev: Vite serves the page on 5173, the API lives on 8000.
      `${window.location.protocol}//${window.location.hostname}:8000`
    : // built: the API server serves these files itself, so same-origin
      // relative URLs are correct whatever host or port it runs on.
      "");

/*
=========================================================
ENVIRONMENT & HEALTH CHECK
=========================================================
*/

export const isVercelEnvironment = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host.endsWith(".vercel.app") ||
    host.endsWith(".now.sh") ||
    import.meta.env?.VITE_DEMO_MODE === "true"
  );
};

export const checkBackendHealth = async () => {
  // If hosted on Vercel and no external API URL is explicitly configured,
  // we know the Python backend is not running on this domain.
  if (isVercelEnvironment() && !import.meta.env?.VITE_API_URL) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data?.ok);
  } catch {
    return false;
  }
};

/*
=========================================================
COMMON REQUEST
=========================================================
*/

const apiRequest = async (endpoint, options = {}) => {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    options
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `API request failed (${response.status}).`
    );
  }

  return data;
};

/*
=========================================================
DEMO MODE HANDLERS
=========================================================
*/

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const runDemoAnalysis = async ({ analysisType = "full", onTick }) => {
  const steps = [
    "Loading sample meter datasets...",
    "Reading Load Profile (8,420 intervals)...",
    "Matching recorded meter events and outage tickets...",
    "Computing daily trend analysis & consumption baseline...",
    "Screening meters for anomalies & theft indicators...",
    "Building final report & worklist tables...",
  ];

  for (let i = 0; i < steps.length; i++) {
    if (onTick) {
      onTick({
        status: "running",
        progress: steps[i],
        steps: steps.slice(0, i + 1),
        elapsed_s: i * 0.4,
      });
    }
    await sleep(400);
  }

  const sheets = DEMO_ANALYSIS_SHEETS[analysisType] || DEMO_ANALYSIS_SHEETS.full;

  return {
    job_id: `demo_${analysisType}_${Date.now().toString(36)}`,
    status: "done",
    analysis_type: analysisType,
    sheets,
  };
};

/*
=========================================================
1. START A JOB  (Landing page)
=========================================================
*/

export const analyzeMeterData = async ({
  analysisType,
  lp,
  events,
  dr,
  ir,
}) => {
  const formData = new FormData();

  formData.append("analysis_type", analysisType);

  if (lp) {
    formData.append("lp", lp);
  }

  if (events) {
    formData.append("events", events);
  }

  if (dr) {
    formData.append("dr", dr);
  }

  if (ir) {
    formData.append("ir", ir);
  }

  return apiRequest("/api/analyze", {
    method: "POST",
    body: formData,
  });
};

/*
=========================================================
2. POLL STATUS
=========================================================
*/

export const getJobStatus = async (jobId) => {
  if (!jobId) {
    throw new Error("job id is required.");
  }

  if (jobId.startsWith("demo_")) {
    const parts = jobId.split("_");
    const type = parts[1] || "full";
    return {
      job_id: jobId,
      status: "done",
      analysis_type: type,
      sheets: DEMO_ANALYSIS_SHEETS[type] || DEMO_ANALYSIS_SHEETS.full,
      progress: "Complete",
      steps: ["Analysis completed."],
      elapsed_s: 2.0,
    };
  }

  return apiRequest(`/api/jobs/${jobId}/status`);
};

export const pollJobUntilDone = async (
  jobId,
  { intervalMs = 1500, onTick, maxConsecutiveFailures = 8 } = {}
) => {
  if (jobId.startsWith("demo_")) {
    const status = await getJobStatus(jobId);
    if (onTick) onTick(status);
    return status;
  }

  let failures = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let status;

    try {
      status = await getJobStatus(jobId);
      failures = 0;
    } catch (err) {
      failures += 1;

      if (/not found/i.test(err.message || "")) {
        throw new Error(
          "The analysis was lost because the server restarted. Run it again."
        );
      }

      if (failures >= maxConsecutiveFailures) {
        throw new Error(
          "Lost contact with the analysis server. Check that the " +
            '"LESCO Server" window is still open, then run it again.'
        );
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    if (onTick) {
      onTick(status);
    }

    if (status.status === "done") {
      return status;
    }

    if (status.status === "error") {
      throw new Error(
        status.error || "Analysis failed on the server."
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, intervalMs)
    );
  }
};

/*
=========================================================
3. FETCH RESULTS  (by job_id)
=========================================================
*/

export const getSummary = async (jobId, msn) => {
  if (jobId?.startsWith("demo_")) {
    const summary = JSON.parse(JSON.stringify(DEMO_SUMMARY));
    summary.msn = msn || null;

    if (msn) {
      summary.meters_analyzed = 1;
      const screenedRow = DEMO_ALL_SCREENED_ROWS.find(
        (r) => String(r.MSN) === String(msn)
      );
      if (screenedRow && summary.screen) {
        summary.screen.score = screenedRow.Score;
        summary.screen.priority = screenedRow.Priority;
        summary.screen.why = screenedRow["Why Flagged"];
      }
    }
    return summary;
  }

  const query = msn
    ? `?msn=${encodeURIComponent(msn)}`
    : "";

  return apiRequest(
    `/api/jobs/${jobId}/summary${query}`
  );
};

export const getMeters = async (jobId) => {
  if (jobId?.startsWith("demo_")) {
    return { meters: DEMO_METERS };
  }

  return apiRequest(`/api/jobs/${jobId}/meters`);
};

export const getSheet = async (
  jobId,
  sheetName,
  { msn, page = 1, pageSize = 50 } = {}
) => {
  if (jobId?.startsWith("demo_")) {
    const allRows = DEMO_SHEETS[sheetName] || [];
    const filtered = msn
      ? allRows.filter((r) => String(r.MSN || r.msn) === String(msn))
      : allRows;

    const total = filtered.length;
    const start = Math.max(0, (page - 1) * pageSize);
    const rows = filtered.slice(start, start + pageSize);
    const columns = rows.length ? Object.keys(rows[0]) : [];

    return {
      total,
      page: Number(page),
      page_size: Number(pageSize),
      columns,
      rows,
    };
  }

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  if (msn) {
    params.append("msn", msn);
  }

  return apiRequest(
    `/api/jobs/${jobId}/sheet/${encodeURIComponent(
      sheetName
    )}?${params.toString()}`
  );
};

export const getExportUrl = (jobId, msn) => {
  if (jobId?.startsWith("demo_")) {
    // Generate a simple downloadable CSV data URI for the demo preview
    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent(
        "Score,Priority,MSN,Ref. No.,Why Flagged,Peak Load (kW),MF\n" +
        "88,INSPECT,2999815146,REF-9992-A,Prolonged zero-load periods,44.2,1\n" +
        "82,INSPECT,2999815228,REF-5528-D,36.5h gap with 0% outage correlation,88.0,1\n" +
        "74,INSPECT,2999811198,REF-1198-A,24.6h unrecorded break,48.6,1\n"
      );
    return csvContent;
  }

  const query = msn
    ? `?msn=${encodeURIComponent(msn)}`
    : "";

  return `${API_BASE_URL}/api/jobs/${jobId}/export${query}`;
};
