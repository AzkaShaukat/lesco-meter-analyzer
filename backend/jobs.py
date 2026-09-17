"""
Job store + DataFrame-to-JSON helpers for the LESCO analyzer API.

Design (see FRONTEND_INTEGRATION.md for the why): single machine, localhost,
one user at a time. Jobs live in an in-memory dict for the life of the
uvicorn process - stop the server and they are gone. That is fine for the
intended use: one person uploads files, runs an analysis, explores the
result, exports, done.

An analysis produces a dict of {sheet_name: pandas DataFrame} - exactly what
the existing build_*_sheets() functions already return. We keep that dict in
memory under a job id and serve slices of it (paginated table pages,
per-meter filters, summaries) without ever re-running the analysis.

If this ever needs to survive restarts or serve multiple users: swap the
_JOBS dict for a disk (pickle/parquet) or database store. Nothing else in the
API has to change - only these functions touch storage.

GUIDELINES for editing this file:
  - Keep it storage-only. No FastAPI / HTTP concepts here (that is api.py).
  - Every value that can reach JSON must go through _clean_value (NaN and NaT
    are NOT valid JSON - they must become null, and timestamps must become
    ISO strings). If you add a new response path, run it through df_to_records.
"""

import threading
import time
import uuid
from datetime import datetime, date

import pandas as pd

_JOBS = {}
_LOCK = threading.Lock()


def create_job() -> str:
    job_id = uuid.uuid4().hex[:12]
    with _LOCK:
        _JOBS[job_id] = {"status": "running", "sheets": None, "error": None, "analysis": None,
                         "progress": "Starting...", "steps": [], "started": time.time(),
                         "updated": time.time()}
    return job_id


def set_running(job_id: str, analysis: str) -> None:
    with _LOCK:
        if job_id in _JOBS:
            _JOBS[job_id]["analysis"] = analysis


# How many finished analyses to keep in memory at once.
#
# A finished "full" run holds ten DataFrames - a month of one feeder is a few
# hundred MB. Nothing used to release them, so the server grew by that much on
# every run and an office PC with 4 GB started swapping, which reads as "the
# analysis got slower and slower". Three is comfortably more than the one job
# a person actually has open, and caps the memory.
MAX_KEPT_JOBS = 3


def _evict_locked(keep_job_id: str) -> None:
    """Drop the oldest finished jobs' results. Caller must hold _LOCK."""
    finished = [
        (jid, j) for jid, j in _JOBS.items()
        if j["sheets"] is not None and jid != keep_job_id
    ]
    finished.sort(key=lambda kv: kv[1]["started"])
    while len(finished) >= MAX_KEPT_JOBS:
        jid, job = finished.pop(0)
        # keep the record so /status can explain what happened, drop the bulk
        job["sheets"] = None
        job["status"] = "expired"


def set_result(job_id: str, sheets: dict) -> None:
    with _LOCK:
        if job_id in _JOBS:
            _JOBS[job_id]["sheets"] = sheets
            _JOBS[job_id]["status"] = "done"
            _evict_locked(job_id)


def set_error(job_id: str, message: str) -> None:
    with _LOCK:
        if job_id in _JOBS:
            _JOBS[job_id]["error"] = message
            _JOBS[job_id]["status"] = "error"


def add_progress(job_id: str, message: str) -> None:
    """Record what the analysis is doing right now.

    The build_*_sheets() functions all take a log callback; the API points it
    here so the browser can show the current step instead of a bare spinner.
    A run that merely takes a while then looks different from one that is
    wedged - which is the whole point.
    """
    message = str(message).strip()
    if not message:
        return
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        job["progress"] = message
        job["updated"] = time.time()
        job["steps"].append(message)
        del job["steps"][:-40]          # keep the tail only; some steps print tables


def elapsed(job_id: str) -> float:
    with _LOCK:
        job = _JOBS.get(job_id)
        return round(time.time() - job["started"], 1) if job else 0.0


def get_job(job_id: str):
    with _LOCK:
        return _JOBS.get(job_id)


def _clean_value(v):
    """Make one cell JSON-safe: NaN/NaT -> None, timestamps -> ISO string."""
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass  # arrays / non-scalars fall through
    if isinstance(v, (pd.Timestamp, datetime, date)):
        return v.isoformat()
    if hasattr(v, "item"):  # numpy scalar -> native python
        try:
            return v.item()
        except Exception:
            return v
    return v


def df_to_records(df: pd.DataFrame) -> list:
    """DataFrame -> list of JSON-safe dicts, one per row."""
    return [{k: _clean_value(v) for k, v in row.items()} for row in df.to_dict(orient="records")]


def filter_msn(df: pd.DataFrame, msn) -> pd.DataFrame:
    if msn is not None and "MSN" in df.columns:
        return df[df["MSN"].astype(str) == str(msn)]
    return df


def paginate(df: pd.DataFrame, msn=None, page: int = 1, page_size: int = 50) -> dict:
    """One page of a sheet, optionally filtered to a single meter."""
    df = filter_msn(df, msn)
    total = len(df)
    start = max(0, (page - 1) * page_size)
    page_df = df.iloc[start:start + page_size]
    return {
        "total": int(total),
        "page": int(page),
        "page_size": int(page_size),
        "columns": list(df.columns),
        "rows": df_to_records(page_df),
    }
