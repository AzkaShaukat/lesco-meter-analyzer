// =========================================================
// Current-job persistence (localStorage)
// =========================================================
// A "job" is one analysis run on the backend. We keep its id +
// which analysis type + which sheets it produced, so every
// dashboard page can fetch its own data by job_id after the
// Landing page starts the job.
// =========================================================

const JOB_KEY = "lescoJob";

// job = { jobId, analysisType, sheets: [...] }
export const saveJob = (job) => {
  localStorage.setItem(JOB_KEY, JSON.stringify(job));
};

export const loadJob = () => {
  try {
    return JSON.parse(localStorage.getItem(JOB_KEY));
  } catch {
    return null;
  }
};

export const clearJob = () => {
  localStorage.removeItem(JOB_KEY);
};

// Which dashboard route to land on for each analysis type.
export const routeForAnalysis = (analysisType) => {
  switch (analysisType) {
    case "trend":
      return "/daily-trend";
    case "peak":
      return "/peak-load";
    case "gaps":
    case "correlation":
      return "/gap-detection";
    // the screen's whole point is the ranked list, so land straight on it
    case "screen":
      return "/worklist";
    case "full":
    default:
      return "/worklist";
  }
};
