import { useEffect, useRef, useState } from "react";
import TopBar from "../../components/layout/TopBar";
import {
  analyzeMeterData,
  pollJobUntilDone,
  checkBackendHealth,
  runDemoAnalysis,
} from "../../services/api";
import { saveJob } from "../../services/jobStore";
import "./LandingPage.css";
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '../../context/AnalysisContext';
const analysisTypes = {
  gaps: {
    label: "Load Profile Break",
    description:
      "Finds missing load profile intervals per meter.",
    files: ["lp"],
  },

  correlation: {
    label: "Event correlation",
    description:
      "Checks load profile gaps against recorded meter events.",
    files: ["lp", "events"],
  },

  trend: {
    label: "Daily trend analysis",
    description:
      "Checks daily consumption patterns for unusual changes.",
    files: ["dr"],
  },

  peak: {
    label: "Peak load analysis",
    description:
      "Analyzes peak demand and unusual load behavior.",
    files: ["lp", "dr"],
  },

  full: {
    label: "Full report",
    description:
      "Runs the complete meter data analysis.",
    files: ["lp", "events", "dr"],
    optional: ["ir"],
  },
};

const fileDetails = {
  lp: {
    name: "Load Profile",
    description: "Load profile data file",
  },

  events: {
    name: "Events Data",
    description: "Meter events / outage data file",
  },

  dr: {
    name: "Daily Reads",
    description: "Daily meter readings file",
  },

  ir: {
    name: "Instantaneous Reads",
    description: "",
  },
};


/* ---------------------------------------------------------------
   Estimated run time.

   Runtime is dominated by the Load Profile file — it holds one row per meter
   per interval, and every analysis that touches it parses the whole thing.
   Daily Reads and Events are an order of magnitude smaller.

   Seconds per MB of Load Profile. RE-MEASURED after the parsed-file cache
   landed in lesco_common.py: a run used to parse the same Load Profile export
   up to three times, so every rate here roughly a third of what it was.
   Measured against a 22.40 MB LP / 0.95 MB ED / 0.43 MB DR export:
     trend  (no LP at all)       2.8s flat
     gaps        26.5s          ~1.05 s/MB
     correlation 35.8s          ~1.41 s/MB
     peak        27.9s          ~1.09 s/MB
     full        43.0s          ~1.71 s/MB
   The estimate is deliberately rounded and shown as "about", because machine
   speed and how busy the PC is move it around - an older office PC can be
   noticeably slower than the one these were measured on.
--------------------------------------------------------------- */
const SECONDS_PER_MB = {
  gaps: 1.1,
  correlation: 1.5,
  trend: 0.6,
  peak: 1.2,
  full: 1.8,
};

const BASE_SECONDS = 3;

const estimateSeconds = (analysisType, files) => {
  const mb = (f) => (f ? f.size / 1024 / 1024 : 0);
  const rate = SECONDS_PER_MB[analysisType] ?? 5;

  // the Load Profile drives it; the others contribute a little parsing time
  const lpMb = mb(files.lp);
  const otherMb = mb(files.events) + mb(files.dr) + mb(files.ir);

  return Math.round(BASE_SECONDS + lpMb * rate + otherMb * 1.2);
};

const formatDuration = (totalSeconds) => {
  const s = Math.max(1, Math.round(totalSeconds));
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m} min ${rem} sec` : `${m} min`;
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { setAnalysisType } = useAnalysis();

  const [selectedAnalysis, setSelectedAnalysis] =
    useState("gaps");

  const [files, setFiles] = useState({
    lp: null,
    events: null,
    dr: null,
    ir: null,
  });

  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // seconds since Run was pressed, so the wait shows real progress
  const [elapsed, setElapsed] = useState(0);
  const [jobId, setJobId] = useState(null);
  // the backend's current step ("Step 1/6 Reading the Load Profile ..."), so a
  // long run is visibly working rather than a spinner that could mean anything
  const [progress, setProgress] = useState("");

  const lpInput = useRef(null);
  const eventsInput = useRef(null);
  const drInput = useRef(null);
  const irInput = useRef(null);

  const inputRefs = {
    lp: lpInput,
    events: eventsInput,
    dr: drInput,
    ir: irInput,
  };

  const [backendAvailable, setBackendAvailable] = useState(true);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);

  // Check whether the local Python backend is reachable on mount
  useEffect(() => {
    let cancelled = false;
    const verifyBackend = async () => {
      const isOnline = await checkBackendHealth();
      if (!cancelled) {
        setBackendAvailable(isOnline);
        setIsCheckingBackend(false);
      }
    };
    verifyBackend();
    return () => {
      cancelled = true;
    };
  }, []);

  // tick once a second while the job runs
  useEffect(() => {
    if (!isAnalyzing) return undefined;
    const id = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [isAnalyzing]);

  const currentAnalysis =
    analysisTypes[selectedAnalysis];

  const requiredFiles = currentAnalysis.files;
  const optionalFiles = currentAnalysis.optional || [];
  // optional slots are shown and uploadable, but never block the Run button
  const shownFiles = [...requiredFiles, ...optionalFiles];

  const attachedCount = requiredFiles.filter(
    (fileKey) => files[fileKey] !== null
  ).length;

  const allFilesAttached =
    attachedCount === requiredFiles.length;

  const handleAnalysisChange = (analysisId) => {
    setSelectedAnalysis(analysisId);
    setError("");
    setJobId(null);
  };

  const handleBrowse = (fileKey) => {
    inputRefs[fileKey].current?.click();
  };

  const handleFileChange = (event, fileKey) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedExtensions = [".xlsx", ".xls", ".csv"];

    const isValid = allowedExtensions.some((extension) =>
      file.name.toLowerCase().endsWith(extension)
    );

    if (!isValid) {
      setError(
        `"${file.name}" is not a supported file. Please upload an Excel (.xlsx, .xls) or CSV file.`
      );

      event.target.value = "";
      return;
    }

    setFiles((previousFiles) => ({
      ...previousFiles,
      [fileKey]: file,
    }));

    setError("");
    setJobId(null);
  };

  const handleRunAnalysis = async () => {
    console.log("RUN ANALYSIS BUTTON CLICKED");

    console.log(
      "Selected analysis:",
      selectedAnalysis
    );

    console.log("Required files:", requiredFiles);

    console.log(
      "Attached files count:",
      attachedCount
    );

    if (!allFilesAttached) {
      console.log("FILES MISSING");

      setError(
        "Please attach all required files before running the analysis."
      );

      return;
    }

    console.log("ALL REQUIRED FILES ATTACHED");
    console.log("Files:", files);

    setIsAnalyzing(true);
    setElapsed(0);
    setProgress("Uploading the files…");
    setError("");
    setJobId(null);

    try {
      console.log("SENDING REQUEST TO PYTHON BACKEND...");
      const result = await analyzeMeterData({
        analysisType: selectedAnalysis,
        lp: files.lp,
        events: files.events,
        dr: files.dr,
        ir: files.ir,
      });

      console.log("BACKEND RESPONSE:", result);

      if (result?.job_id) {
        setJobId(result.job_id);
        console.log("JOB CREATED:", result.job_id);

        // lock the sidebar tabs to this analysis type
        setAnalysisType(selectedAnalysis);

        // wait for the background analysis to finish before showing the dashboard
        const finalStatus = await pollJobUntilDone(result.job_id, {
          onTick: (s) => {
            // show whatever step the server is on; keep the last message if a
            // poll comes back without one
            if (s.progress) {
              setProgress(s.progress);
            }
          },
        });

        // remember the job so every dashboard page can fetch its real data
        saveJob({
          jobId: result.job_id,
          analysisType: selectedAnalysis,
          sheets: finalStatus.sheets || [],
        });

        const routeMap = {
          gaps: "/gap-detection",
          correlation: "/gap-detection",
          trend: "/daily-trend",
          peak: "/peak-load",
          full: "/full-report",
        };
        navigate(routeMap[selectedAnalysis] || "/");
      } else {
        setError("The analysis request was sent, but no job ID was returned.");
      }

    } catch (error) {
      console.error("BACKEND ERROR:", error);
      setError(error.message || "Unable to connect with the analysis server.");
    } finally {
      setIsAnalyzing(false);
      setProgress("");
    }
  };

  const handleRunDemoAnalysis = async () => {
    setIsAnalyzing(true);
    setElapsed(0);
    setProgress("Initializing demo analysis...");
    setError("");
    setJobId(null);

    try {
      setAnalysisType(selectedAnalysis);

      const result = await runDemoAnalysis({
        analysisType: selectedAnalysis,
        onTick: (s) => {
          if (s?.progress) {
            setProgress(s.progress);
          }
        },
      });

      if (result?.job_id) {
        saveJob({
          jobId: result.job_id,
          analysisType: selectedAnalysis,
          sheets: result.sheets || [],
        });

        const routeMap = {
          gaps: "/gap-detection",
          correlation: "/gap-detection",
          trend: "/daily-trend",
          peak: "/peak-load",
          full: "/full-report",
        };

        navigate(routeMap[selectedAnalysis] || "/full-report");
      }
    } catch (err) {
      console.error("DEMO ERROR:", err);
      setError(err?.message || "Failed to run demo analysis.");
    } finally {
      setIsAnalyzing(false);
      setProgress("");
    }
  };

  return (
    <div className="landing-page">

      <TopBar />

      <main className="landing-content">

        <section className="analysis-card">

          {/* HEADER */}

          <div className="analysis-header">

            <p className="analysis-eyebrow">
              LESCO METER DATA ANALYZER
            </p>

            <h1 className="analysis-title">
              New Analysis
            </h1>

            <p className="analysis-description">
              Choose what to analyze, then upload
              the files it needs.
            </p>

          </div>


          {/* ANALYSIS TYPE */}

          <div className="analysis-section">

            <p className="section-label">
              ANALYSIS TYPE
            </p>

            <div className="analysis-options">

              {Object.entries(analysisTypes).map(
                ([id, meta]) => (
                  <button
                    key={id}
                    type="button"
                    className={`analysis-option ${
                      selectedAnalysis === id ? "active" : ""
                    }`}
                    onClick={() =>
                      handleAnalysisChange(id)
                    }
                    disabled={isAnalyzing}
                  >
                    {meta.label}
                  </button>
                )
              )}


            </div>


            <div className="analysis-info">
              {currentAnalysis.description}
            </div>

          </div>


          {/* DATA FILES */}

          <div className="analysis-section">

            <div className="section-heading">

              <p className="section-label">
                DATA FILES
              </p>

              <span className="file-count">
                {attachedCount}/
                {requiredFiles.length} Attached
              </span>

            </div>


            <div className="file-upload-list">

              {shownFiles.map(
                (fileKey) => {

                  const file =
                    files[fileKey];

                  const details =
                    fileDetails[fileKey];

                  return (
                    <div
                      className="file-upload-row"
                      key={fileKey}
                    >

                      <div className="file-info">

                        <div className="file-icon">
                          ▥
                        </div>

                        <div>

                          <p className="file-name">
                            {file
                              ? file.name
                              : details.name}
                          </p>

                          {/* .file-status is display:block, so render nothing
                              at all when there is no file and no description -
                              an empty span would still leave a gap */}
                          {(file || details.description) && (
                            <span className="file-status">
                              {file
                                ? `${(
                                    file.size /
                                    1024 /
                                    1024
                                  ).toFixed(
                                    2
                                  )} MB`
                                : details.description}
                            </span>
                          )}

                        </div>

                      </div>


                      <button
                        type="button"
                        className="browse-button"
                        onClick={() =>
                          handleBrowse(
                            fileKey
                          )
                        }
                        disabled={isAnalyzing}
                      >
                        {file
                          ? "Change"
                          : "Browse..."}
                      </button>


                      <input
                        ref={
                          inputRefs[fileKey]
                        }
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        hidden
                        onChange={(event) =>
                          handleFileChange(
                            event,
                            fileKey
                          )
                        }
                      />

                    </div>
                  );
                }
              )}

            </div>


            {error && (
              <p className="upload-error">
                {error}
              </p>
            )}


            {jobId && !error && (
              <p className="analysis-success">
                Analysis started successfully.
                <br />
                Job ID: {jobId}
              </p>
            )}

          </div>


          {/* FOOTER */}

          <div className="analysis-footer">

            {backendAvailable ? (
              <button
                type="button"
                className={`run-button ${isAnalyzing ? "is-running" : ""}`}
                disabled={!allFilesAttached || isAnalyzing}
                onClick={handleRunAnalysis}
              >
                {isAnalyzing ? (
                  <span className="run-spinner" aria-hidden="true" />
                ) : (
                  <span className="run-icon">▷</span>
                )}
                {isAnalyzing ? "Analyzing\u2026" : "Run analysis"}
              </button>
            ) : (
              <button
                type="button"
                className={`run-button is-demo-btn ${isAnalyzing ? "is-running" : ""}`}
                disabled={isAnalyzing}
                onClick={handleRunDemoAnalysis}
                title="Run analysis using sample feeder dataset (Python backend is offline or running on Vercel)"
              >
                {isAnalyzing ? (
                  <span className="run-spinner" aria-hidden="true" />
                ) : (
                  <span className="run-icon">⚡</span>
                )}
                {isAnalyzing ? "Analyzing Demo Data\u2026" : "Run Demo Analysis"}
              </button>
            )}

            {!backendAvailable && !isCheckingBackend && (
              <div className="demo-notice-badge">
                <span className="demo-pill">DEMO MODE</span>
                <span>Python backend is offline. Click above to run preview with sample data.</span>
              </div>
            )}

            {/* What the server is doing right now. Without this a two-minute
                run and a wedged one look exactly the same. */}
            {isAnalyzing && progress && (
              <p className="run-progress" aria-live="polite">
                {progress}
              </p>
            )}

            {/* Estimate before the run, elapsed vs estimate during it. */}
            {allFilesAttached && (
              <p className="run-estimate">
                {isAnalyzing ? (
                  <>
                    <span className="run-elapsed">{formatDuration(elapsed)}</span>
                    {" elapsed \u00b7 estimated about "}
                    {formatDuration(estimateSeconds(selectedAnalysis, files))}
                    {elapsed > estimateSeconds(selectedAnalysis, files) * 1.5 && (
                      <span className="run-overrun">
                        {" \u2014 taking longer than expected, still working"}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {"Estimated time: about "}
                    <strong>
                      {formatDuration(estimateSeconds(selectedAnalysis, files))}
                    </strong>
                    {" \u00b7 depends on file size and this PC"}
                  </>
                )}
              </p>
            )}

          </div>

        </section>

      </main>

    </div>
  );
};

export default LandingPage;