"""
LESCO Meter Data Analyzer - HTTP API (FastAPI).

Thin web layer over the existing analysis code. It does NOT reimplement any
analysis - it imports the same build_*_sheets() functions the CLI scripts and
the desktop GUI use, runs them, and serves the result as JSON (and Excel on
export). All the real logic still lives in gap_finder / event_correlator /
daily_trend / peak_load / final_report.

Run it (from this folder):
    pip install -r requirements.txt
    uvicorn api:app --reload
Then it is at http://127.0.0.1:8000  (interactive docs at /docs).

Job flow (see FRONTEND_INTEGRATION.md for the full frontend guide):
    1. POST /api/analyze  with the analysis type + the files it needs.
       -> returns a job_id immediately; the analysis runs in a background
          thread (a full report can take ~1.5 min, so we do NOT block).
    2. Poll GET /api/jobs/{id}/status until it is "done" (or "error").
    3. Fetch what you need by job_id: /summary, /meters, /sheet/{name}, /export.
       Filtering by ?msn= gives the single-meter view; leaving it off gives
       fleet-wide.

GUIDELINES for editing this file:
  - Keep analysis logic OUT of here. If you need a new computed number, add it
    where the data is built (the build_*_sheets functions) or compute it from
    the already-built sheets in /summary. Do not duplicate analysis here.
  - Every DataFrame that goes out as JSON must go through jobs.df_to_records
    or jobs.paginate (they handle NaN/date -> JSON). Never json-dump a raw
    DataFrame.
  - CORS is wide open (allow all origins) because this is localhost-only. If
    this ever gets hosted for real, lock allow_origins down to the real URL.
"""

import io
import shutil
import sys
import tempfile
import threading
import traceback
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from lesco_common import autofit_columns, validate_portal_file, FileValidationError, ROLE_LABEL, clear_cache
from gap_finder import build_gap_sheets
from event_correlator import build_correlation_sheets
from daily_trend import build_trend_sheets
from peak_load import build_peak_sheets
from final_report import build_final_sheets
from theft_screen import build_screen_sheets
import jobs

# analysis type -> which uploaded files it needs, which are optional, and how to
# run it. "lp" = Load Profile, "events" = Events, "dr" = Daily Reads,
# "ir" = Instantaneous Reads (only ever optional - it adds the energy-balance
# check to the theft screen, everything else works without it).
#
# Each "run" takes (paths, log). The log callback is NOT optional any more:
# these analyses take minutes on a big export, and a run that reports nothing
# is indistinguishable from one that has hung. It is routed to the job record
# so /status can hand the current step to the browser.
ANALYSES = {
    "gaps":        {"needs": ["lp"],                 "run": lambda p, log: build_gap_sheets(p["lp"], log=log)},
    "correlation": {"needs": ["lp", "events"],       "run": lambda p, log: build_correlation_sheets(p["lp"], p["events"], log=log)},
    "trend":       {"needs": ["dr"],                 "run": lambda p, log: build_trend_sheets(p["dr"], log=log)},
    "peak":        {"needs": ["lp", "dr"],           "run": lambda p, log: build_peak_sheets(p["lp"], p["dr"], log=log)},
    "screen":      {"needs": ["lp", "events", "dr"], "optional": ["ir"],
                    "run": lambda p, log: build_screen_sheets(p["lp"], p["events"], p["dr"], p.get("ir"), log=log)},
    "full":        {"needs": ["lp", "events", "dr"], "optional": ["ir"],
                    "run": lambda p, log: build_final_sheets(p["lp"], p["events"], p["dr"], ir_path=p.get("ir"), log=log)},
}

app = FastAPI(title="LESCO Meter Data Analyzer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # localhost-only; see guidelines above
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Serve the built dashboard (Frontend/lesco-mdm-frontend/dist) when it exists.
#
# Building the React app to static files means the machine running this needs
# Python only - no Node.js, no node_modules. The dev setup (Vite on 5173) is
# unaffected: this simply does nothing if dist/ has not been built.
#
# Mounted at the BOTTOM of this file, after every /api route, so the catch-all
# never shadows the API.
# ---------------------------------------------------------------------------
def _frontend_dir() -> Path | None:
    """Where the built dashboard lives, in dev and inside a PyInstaller bundle."""
    candidates = [
        Path(getattr(sys, "_MEIPASS", "")) / "frontend",          # bundled .exe
        # ".parent.parent" because this file lives in backend\ and the
        # dashboard is a sibling of that folder, not of this file.
        Path(__file__).parent.parent / "Frontend" / "lesco-mdm-frontend" / "dist",
    ]
    for c in candidates:
        if c and (c / "index.html").is_file():
            return c
    return None


ALLOWED_EXT = {".xlsx", ".xls", ".csv"}


def _run_job(job_id: str, analysis_type: str, paths: dict, tmpdir: Path) -> None:
    """Runs in a background thread. Validates the uploaded files, builds the
    sheets, stores them, cleans up uploads."""
    def log(*parts):
        """Progress sink handed to the analysis. Goes to the job record (for the
        browser) and to the server console (for whoever is watching the window)."""
        message = " ".join(str(x) for x in parts)
        jobs.add_progress(job_id, message)
        print(f"[{job_id}] {message}", flush=True)

    try:
        # validate every uploaded file is the right kind of export first, so a
        # wrong/incomplete file gives a clear message instead of a crash.
        # iterate paths (not "needs") so optional files get checked too.
        for role in paths:
            log(f"Checking the {ROLE_LABEL[role]} file ...")
            validate_portal_file(paths[role], role)
        sheets = ANALYSES[analysis_type]["run"](paths, log)
        log("Finished - building the tables.")
        jobs.set_result(job_id, sheets)
    except (FileValidationError, ValueError) as e:
        jobs.set_error(job_id, str(e))  # clean, user-facing message
    except Exception as e:
        jobs.set_error(job_id, f"{e}\n\n{traceback.format_exc()}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)  # raw uploads no longer needed - result is in memory
        clear_cache()  # release the parsed source files (hundreds of MB on a big export)


def _sheets(job_id: str) -> dict:
    """Fetch a finished job's sheets, or raise the right HTTP error."""
    job = jobs.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found (it may have expired when the server restarted).")
    if job["status"] == "running":
        raise HTTPException(409, "Job still running - poll /status until it is done.")
    if job["status"] == "error":
        raise HTTPException(500, f"Analysis failed: {job['error']}")
    if job["status"] == "expired" or job["sheets"] is None:
        # released to keep memory bounded - see MAX_KEPT_JOBS in jobs.py
        raise HTTPException(
            410,
            "This analysis was cleared to free memory because newer ones have "
            "been run since. Run it again to see these results.",
        )
    return job["sheets"]


@app.get("/api/health")
def health():
    """Health check. Lives under /api because "/" now serves the dashboard."""
    return {"ok": True, "service": "LESCO Meter Data Analyzer API"}


@app.post("/api/analyze")
async def analyze(
    analysis_type: str = Form(...),
    lp: UploadFile = File(None),
    events: UploadFile = File(None),
    dr: UploadFile = File(None),
    ir: UploadFile = File(None),
):
    if analysis_type not in ANALYSES:
        raise HTTPException(400, f"Unknown analysis type '{analysis_type}'. One of: {list(ANALYSES)}")

    spec = ANALYSES[analysis_type]
    needed = spec["needs"]
    optional = spec.get("optional", [])
    uploads = {"lp": lp, "events": events, "dr": dr, "ir": ir}
    tmpdir = Path(tempfile.mkdtemp(prefix="lesco_"))
    paths = {}
    for key in needed + optional:
        f = uploads[key]
        if f is None or not (f.filename or "").strip():
            if key in optional:
                continue                     # optional file simply not supplied
            shutil.rmtree(tmpdir, ignore_errors=True)
            raise HTTPException(400, f"The {ROLE_LABEL[key]} file is required for this analysis but was not uploaded.")
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED_EXT:
            shutil.rmtree(tmpdir, ignore_errors=True)
            raise HTTPException(400, f"The {ROLE_LABEL[key]} file must be an Excel (.xlsx, .xls) or CSV file.")
        dest = tmpdir / f"{key}{ext}"  # keep the real extension so CSV vs Excel is read correctly
        with open(dest, "wb") as out:
            shutil.copyfileobj(f.file, out)
        paths[key] = dest

    job_id = jobs.create_job()
    jobs.set_running(job_id, analysis_type)
    threading.Thread(target=_run_job, args=(job_id, analysis_type, paths, tmpdir), daemon=True).start()
    return {"job_id": job_id, "status": "running", "analysis_type": analysis_type}


@app.get("/api/jobs/{job_id}/status")
def status(job_id: str):
    job = jobs.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return {
        "job_id": job_id,
        "status": job["status"],           # "running" | "done" | "error"
        "analysis_type": job["analysis"],
        "error": job["error"],
        "sheets": list(job["sheets"].keys()) if job["sheets"] else None,
        # what it is doing right now, so the browser can show a real message
        # rather than a spinner that looks identical to a hang
        "progress": job.get("progress"),
        "steps": job.get("steps", []),
        "elapsed_s": jobs.elapsed(job_id),
    }


@app.get("/api/jobs/{job_id}/summary")
def summary(job_id: str, msn: str = None):
    """KPI numbers for the cards. Fleet-wide by default; pass ?msn= for one meter."""
    sheets = _sheets(job_id)
    out = {"msn": msn}

    mi = sheets.get("Meter Info")
    if mi is not None:
        out["meters_analyzed"] = int(jobs.filter_msn(mi, msn)["MSN"].nunique())

    gaps = sheets.get("Load Profile Breaks")
    if gaps is not None:
        g = jobs.filter_msn(gaps, msn)
        block = {"total": int(len(g))}
        if "Classification" in g.columns:
            block["by_classification"] = {str(k): int(v) for k, v in g["Classification"].value_counts().items()}
        if "Duration (hours)" in g.columns and len(g):
            block["longest_hours"] = float(g["Duration (hours)"].max())
        out["gaps"] = block

    trend = sheets.get("Daily Trend Analysis")
    if trend is not None:
        t = jobs.filter_msn(trend, msn)
        out["trend"] = {"by_flag": {str(k): int(v) for k, v in t["Trend Flag"].value_counts().items()}}

    peak = sheets.get("Daily Peak Load (LP)")
    if peak is not None:
        p = jobs.filter_msn(peak, msn)
        if len(p):
            out["peak"] = {"max_kw": float(p["Peak Load (kW)"].max()),
                           "avg_kw": round(float(p["Peak Load (kW)"].mean()), 1)}

    screened = sheets.get("All Meters Screened")
    if screened is not None:
        s = jobs.filter_msn(screened, msn)
        block = {"by_priority": {str(k): int(v) for k, v in s["Priority"].value_counts().items()},
                 "inspect": int((s["Priority"] == "INSPECT").sum()),
                 "review": int((s["Priority"] == "REVIEW").sum())}
        if len(s):
            block["top_score"] = int(s["Score"].max())
            if msn:  # single-meter view: give the frontend this meter's own verdict
                row = s.iloc[0]
                block["score"] = int(row["Score"])
                block["priority"] = str(row["Priority"])
                block["why"] = str(row["Why Flagged"])
        out["screen"] = block
    return out


@app.get("/api/jobs/{job_id}/meters")
def meters(job_id: str):
    """The Meter Info lookup table - one row per meter, for search/autocomplete."""
    sheets = _sheets(job_id)
    mi = sheets.get("Meter Info")
    return {"meters": jobs.df_to_records(mi) if mi is not None else []}


@app.get("/api/jobs/{job_id}/sheet/{sheet_name}")
def sheet(job_id: str, sheet_name: str, msn: str = None, page: int = 1, page_size: int = 50):
    """One paginated page of any sheet this job produced. ?msn= filters to one meter."""
    sheets = _sheets(job_id)
    if sheet_name not in sheets:
        raise HTTPException(404, f"This job has no sheet named '{sheet_name}'. Available: {list(sheets)}")
    return jobs.paginate(sheets[sheet_name], msn=msn, page=page, page_size=page_size)


@app.get("/api/jobs/{job_id}/export")
def export(job_id: str, msn: str = None):
    """Download the Excel report. Whole report by default; ?msn= filters every sheet to one meter."""
    sheets = _sheets(job_id)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for name, df in sheets.items():
            out_df = jobs.filter_msn(df, msn)
            out_df.to_excel(writer, sheet_name=name, index=False)
            autofit_columns(writer, out_df, name)
    buf.seek(0)
    fname = f"report_{msn}.xlsx" if msn else "report.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------------------------------------------------------------------------
# Static dashboard mount — MUST stay last so /api/* routes win.
# ---------------------------------------------------------------------------
_FRONTEND = _frontend_dir()

if _FRONTEND is not None:
    app.mount(
        "/assets",
        StaticFiles(directory=str(_FRONTEND / "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}")
    def serve_dashboard(full_path: str):
        """Serve the dashboard, and let React Router handle its own routes.

        A real file (bg.jpg, logo.png, favicon.svg) is returned directly.
        Anything else returns index.html so that refreshing on /worklist or
        /peak-load loads the app instead of 404-ing.
        """
        candidate = (_FRONTEND / full_path).resolve()
        # stay inside the frontend folder - never serve arbitrary paths
        if (
            full_path
            and _FRONTEND.resolve() in candidate.parents
            and candidate.is_file()
        ):
            return FileResponse(str(candidate))
        return FileResponse(str(_FRONTEND / "index.html"))
