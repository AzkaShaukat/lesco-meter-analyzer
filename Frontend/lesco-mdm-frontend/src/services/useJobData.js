// =========================================================
// useJobData  —  loads the current job's real results
// =========================================================
// Reads the current job_id from localStorage (set by the Landing
// page), then fetches the summary, the meter list, and whichever
// result sheets that job produced. Cached per job_id so navigating
// between dashboard pages doesn't refetch.
//
// Every dashboard page calls this and reads the pieces it needs,
// instead of importing the old dummyData.
// =========================================================

import { useEffect, useState } from "react";

import { getSummary, getMeters, getSheet } from "./api";
import { loadJob } from "./jobStore";

// ---- classification / flag -> UI status label + type ----
export const classificationStatus = (classification = "") => {
  const c = String(classification).toUpperCase();
  if (c.includes("LOW_COVERAGE")) return { status: "Low coverage", type: "low" };
  if (c.includes("NO_MATCHING") || c.includes("NO_EVENT_DATA"))
    return { status: "Needs review", type: "review" };
  if (c.includes("ALIGNS")) return { status: "Aligns with outage", type: "outage" };
  return { status: classification || "—", type: "review" };
};

// pull every row of a sheet (paginate through)
const fetchAllRows = async (jobId, sheetName) => {
  const size = 1000;
  const first = await getSheet(jobId, sheetName, { page: 1, pageSize: size });
  let rows = first.rows || [];
  const total = first.total || rows.length;
  let page = 2;
  while (rows.length < total) {
    const next = await getSheet(jobId, sheetName, { page, pageSize: size });
    if (!next.rows || next.rows.length === 0) break;
    rows = rows.concat(next.rows);
    page += 1;
  }
  return rows;
};

// simple per-job cache so pages don't refetch on every navigation
const cache = new Map();

const loadEverything = async (job) => {
  const { jobId, sheets = [] } = job;
  const has = (name) => sheets.includes(name);

  const [summary, metersResp] = await Promise.all([
    getSummary(jobId),
    getMeters(jobId),
  ]);

  const meters = metersResp.meters || [];

  const gapSheet = has("Load Profile Breaks") ? "Load Profile Breaks" : null;

  const [gapRows, trendRows, peakRows, weeklyRows, monthlyRows,
         worklistRows, screenRows, signalWeights] = await Promise.all([
    gapSheet ? fetchAllRows(jobId, gapSheet) : Promise.resolve([]),
    has("Daily Trend Analysis") ? fetchAllRows(jobId, "Daily Trend Analysis") : Promise.resolve([]),
    has("Daily Peak Load (LP)") ? fetchAllRows(jobId, "Daily Peak Load (LP)") : Promise.resolve([]),
    has("Weekly Peak Consumption (DR)") ? fetchAllRows(jobId, "Weekly Peak Consumption (DR)") : Promise.resolve([]),
    has("Monthly Peak Consumption (DR)") ? fetchAllRows(jobId, "Monthly Peak Consumption (DR)") : Promise.resolve([]),
    has("Theft Worklist") ? fetchAllRows(jobId, "Theft Worklist") : Promise.resolve([]),
    has("All Meters Screened") ? fetchAllRows(jobId, "All Meters Screened") : Promise.resolve([]),
    has("Signal Weights") ? fetchAllRows(jobId, "Signal Weights") : Promise.resolve([]),
  ]);

  return { summary, meters, gapRows, trendRows, peakRows, weeklyRows, monthlyRows,
           worklistRows, screenRows, signalWeights };
};

export const useJobData = () => {
  const [state, setState] = useState({
    loading: true,
    error: null,
    job: null,
    summary: null,
    meters: [],
    gapRows: [],
    trendRows: [],
    peakRows: [],
    weeklyRows: [],
    monthlyRows: [],
    worklistRows: [],
    screenRows: [],
    signalWeights: [],
  });

  useEffect(() => {
    let cancelled = false;
    const job = loadJob();

    if (!job || !job.jobId) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "No analysis loaded. Start one from the New Analysis page.",
      }));
      return;
    }

    const run = async () => {
      try {
        let data = cache.get(job.jobId);
        if (!data) {
          data = await loadEverything(job);
          cache.set(job.jobId, data);
        }
        if (!cancelled) {
          setState({ loading: false, error: null, job, ...data });
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err.message || "Failed to load results.",
          }));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
