const API_BASE_URL = "http://127.0.0.1:8000";

/*
=========================================================
COMMON API REQUEST
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
        "API request failed."
    );
  }

  return data;
};


/*
=========================================================
ANALYZE METER DATA
=========================================================
Used by Landing Page.

Uploads:
- Load Profile
- Events Data
- Daily Reads

Backend endpoint:
POST /api/analyze
=========================================================
*/

export const analyzeMeterData = async ({
  analysisType,
  lp,
  events,
  dr,
}) => {
  const formData = new FormData();

  formData.append(
    "analysis_type",
    analysisType
  );

  if (lp) {
    formData.append("lp", lp);
  }

  if (events) {
    formData.append("events", events);
  }

  if (dr) {
    formData.append("dr", dr);
  }

  return apiRequest("/api/analyze", {
    method: "POST",
    body: formData,
  });
};


/*
=========================================================
BACKEND HEALTH CHECK
=========================================================
*/

export const checkBackendHealth = async () => {
  return apiRequest("/health");
};


/*
=========================================================
FULL REPORT
=========================================================
*/

export const getFullReport = async () => {
  return apiRequest("/api/full-report");
};


/*
=========================================================
METER DETAIL
=========================================================
*/

export const getMeterDetail = async (msn) => {
  if (!msn) {
    throw new Error("MSN is required.");
  }

  return apiRequest(
    `/api/meter/${encodeURIComponent(msn)}`
  );
};


/*
=========================================================
METER GAP ANALYSIS
=========================================================
*/

export const getMeterGaps = async (msn) => {
  if (!msn) {
    throw new Error("MSN is required.");
  }

  return apiRequest(
    `/api/meter/${encodeURIComponent(msn)}/gaps`
  );
};


/*
=========================================================
METER EVENT ANALYSIS
=========================================================
*/

export const getMeterEvents = async (msn) => {
  if (!msn) {
    throw new Error("MSN is required.");
  }

  return apiRequest(
    `/api/meter/${encodeURIComponent(msn)}/events`
  );
};


/*
=========================================================
GENERIC GET REQUEST
=========================================================
Useful later if backend routes change.
=========================================================
*/

export const getApiData = async (endpoint) => {
  if (!endpoint) {
    throw new Error("API endpoint is required.");
  }

  return apiRequest(endpoint);
};