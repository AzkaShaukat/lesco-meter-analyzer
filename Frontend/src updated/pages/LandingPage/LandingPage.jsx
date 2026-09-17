import { useRef, useState } from "react";
import TopBar from "../../components/layout/TopBar";
import { analyzeMeterData } from "../../services/api";
import "./LandingPage.css";
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '../../context/AnalysisContext';
const analysisTypes = {
  gaps: {
    label: "Gap analysis",
    description:
      "Finds missing load profile intervals per meter.",
    files: ["lp"],
  },

  correlation: {
    label: "Gap + event correlation",
    description:
      "Checks load profile gaps against recorded meter events.",
    files: ["lp", "events"],
  },

  trend: {
    label: "Daily trend check",
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
};

const LandingPage = () => {
  const [selectedAnalysis, setSelectedAnalysis] =
    useState("gaps");

  const [files, setFiles] = useState({
    lp: null,
    events: null,
    dr: null,
  });

  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jobId, setJobId] = useState(null);

  const lpInput = useRef(null);
  const eventsInput = useRef(null);
  const drInput = useRef(null);

  const inputRefs = {
    lp: lpInput,
    events: eventsInput,
    dr: drInput,
  };

  const currentAnalysis =
    analysisTypes[selectedAnalysis];

  const requiredFiles = currentAnalysis.files;

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

    const allowedExtensions = [
      ".xlsx",
      ".xls",
      ".csv",
      ".pdf",
    ];

    const isValid = allowedExtensions.some(
      (extension) =>
        file.name
          .toLowerCase()
          .endsWith(extension)
    );

    if (!isValid) {
      setError(
        "Please select an Excel, CSV, or PDF file."
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
    setError("");
    setJobId(null);

    try {
      console.log("SENDING REQUEST TO PYTHON BACKEND...");
      const result = await analyzeMeterData({
        analysisType: selectedAnalysis,
        lp: files.lp,
        events: files.events,
        dr: files.dr,
      });

      console.log("BACKEND RESPONSE:", result);

      if (result?.job_id) {
        setJobId(result.job_id);
        console.log("JOB CREATED:", result.job_id);

    // =========================================================
    // 🆕 ADD THESE LINES RIGHT HERE (inside the if block)
    // =========================================================

    // 1. Lock the sidebar based on the selected analysis
        setAnalysisType(selectedAnalysis);

    // 2. Navigate to the correct first page
        const routeMap = {
          gaps: '/gap-detection',
          correlation: '/outage-correlation', // ✅ now uses outage-correlation
          trend: '/daily-trend',
          peak: '/peak-load',
          full: '/full-report',
        };
        navigate(routeMap[selectedAnalysis] || '/');

    // =========================================================
    // 🆕 END OF ADDED LINES
    // =========================================================

      } else {
        setError("The analysis request was sent, but no job ID was returned.");
      }

    } catch (error) {
      console.error("BACKEND ERROR:", error);
      setError(error.message || "Unable to connect with the analysis server.");
    } finally {
      setIsAnalyzing(false);
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

              <button
                type="button"
                className={`analysis-option ${
                  selectedAnalysis === "gaps"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  handleAnalysisChange("gaps")
                }
                disabled={isAnalyzing}
              >
                Gap analysis
              </button>


              <button
                type="button"
                className={`analysis-option ${
                  selectedAnalysis ===
                  "correlation"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  handleAnalysisChange(
                    "correlation"
                  )
                }
                disabled={isAnalyzing}
              >
                Gap + event correlation
              </button>


              <button
                type="button"
                className={`analysis-option ${
                  selectedAnalysis === "trend"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  handleAnalysisChange("trend")
                }
                disabled={isAnalyzing}
              >
                Daily trend check
              </button>


              <button
                type="button"
                className={`analysis-option ${
                  selectedAnalysis === "peak"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  handleAnalysisChange("peak")
                }
                disabled={isAnalyzing}
              >
                Peak load analysis
              </button>


              <button
                type="button"
                className={`analysis-option ${
                  selectedAnalysis === "full"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  handleAnalysisChange("full")
                }
                disabled={isAnalyzing}
              >
                Full report
              </button>

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

              {requiredFiles.map(
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
                        accept=".xlsx,.xls,.csv,.pdf"
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

            <button
              type="button"
              className="run-button"
              disabled={
                !allFilesAttached ||
                isAnalyzing
              }
              onClick={handleRunAnalysis}
            >

              <span className="run-icon">
                {isAnalyzing
                  ? "..."
                  : "▷"}
              </span>

              {isAnalyzing
                ? "Analyzing..."
                : "Run analysis"}

            </button>

          </div>

        </section>

      </main>

    </div>
  );
};

export default LandingPage;