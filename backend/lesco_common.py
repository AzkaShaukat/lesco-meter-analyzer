"""
Shared parsing helpers for LESCO portal Excel exports.

All the portal's "Custom ..." exports (Load Profile, Events, Daily Reads,
Instantaneous Reads) share the same messy shape: a "From:/To:" row, a grouped
header row (with merged-looking blank cells), sometimes a units sub-header
row, then data. These helpers find the real header and return a clean,
properly-named DataFrame regardless of which of those exports it is.
"""

import threading
from pathlib import Path

import pandas as pd

UNIT_TOKENS = {"kwh", "kw", "kvar", "kvarh", "amp", "volt", "hz", "accum mdi"}


def find_header_row(raw: pd.DataFrame) -> int:
    for idx, row in raw.iterrows():
        if any(str(v).strip().upper() == "MSN" for v in row if pd.notna(v)):
            return idx
        if any("no record found" in str(v).strip().lower() for v in row if pd.notna(v)):
            raise ValueError(
                "This file is an empty/failed portal export (\"No record found for this report\"), "
                "not real data - re-download it from the portal, don't debug the parser."
            )
    raise ValueError("Could not find a header row containing 'MSN' in this file.")


def find_from_to(raw: pd.DataFrame, before_row: int):
    from_dt = to_dt = None
    for _, row in raw.iloc[:before_row].iterrows():
        cells = list(row)
        for i, v in enumerate(cells):
            if pd.isna(v):
                continue
            label = str(v).strip().rstrip(":").lower()
            if label == "from" and i + 1 < len(cells):
                from_dt = pd.to_datetime(cells[i + 1], errors="coerce")
            elif label == "to" and i + 1 < len(cells):
                to_dt = pd.to_datetime(cells[i + 1], errors="coerce")
    return from_dt, to_dt


def build_column_names(header_row: pd.Series, units_row: pd.Series | None) -> list[str]:
    headers = header_row.ffill()
    names = []
    seen = {}
    for i, h in enumerate(headers):
        h = "" if pd.isna(h) else str(h).strip()
        unit = ""
        if units_row is not None:
            u = units_row.iloc[i]
            if pd.notna(u) and str(u).strip().lower() in UNIT_TOKENS:
                unit = str(u).strip()
        name = f"{h} ({unit})" if unit else h
        if not name:
            name = f"col_{i}"
        if name in seen:
            seen[name] += 1
            name = f"{name} #{seen[name]}"
        else:
            seen[name] = 0
        names.append(name)
    return names


# ---------------------------------------------------------------------------
# Parsed-file cache.
#
# A "full" run asks for the SAME Load Profile file three times - correlate(),
# daily_peak_from_lp() and build_meter_info() each call load_portal_export()
# on it. Parsing a 23 MB export takes ~22 s, so that was ~45 s of pure repeat
# work on every run, and considerably worse on an office PC with a slow disk.
#
# Keyed on (path, size, mtime), so editing or re-uploading a file is picked up
# automatically - a stale result is not possible. Callers get a COPY, because
# several of them mutate the frame they are handed.
#
# Bounded to a handful of entries and cleared by the API after each job
# (clear_cache()), so a long-running server does not sit on hundreds of MB.
# ---------------------------------------------------------------------------
_CACHE = {}
_CACHE_ORDER = []
_CACHE_LOCK = threading.Lock()
_CACHE_MAX = 5


def _cache_key(path: Path):
    """None if the file cannot be stat'ed - such a read just skips the cache."""
    try:
        st = Path(path).stat()
    except OSError:
        return None
    return (str(Path(path).resolve()).lower(), st.st_size, st.st_mtime_ns)


def clear_cache() -> None:
    """Drop every cached file. Call when a job finishes to release the memory."""
    with _CACHE_LOCK:
        _CACHE.clear()
        _CACHE_ORDER.clear()


def _parse_portal_export(path: Path) -> tuple[pd.DataFrame, pd.Timestamp, pd.Timestamp]:
    """Returns (dataframe with all real columns properly named, header From date, header To date).

    The From/To dates are the file's own declared range - informational only.
    Testing showed they aren't a reliable data boundary (see lesco_data_findings
    memory / gap_finder.py notes), so don't use them to compute expected counts.

    Reads Excel (.xlsx/.xls) or CSV - the portal can export either.
    """
    if str(path).lower().endswith(".csv"):
        raw = pd.read_csv(path, header=None, dtype=object)
    else:
        raw = pd.read_excel(path, header=None)
    header_row_idx = find_header_row(raw)
    from_dt, to_dt = find_from_to(raw, header_row_idx)

    header_row = raw.iloc[header_row_idx]
    msn_col_pos = [i for i, v in enumerate(header_row) if pd.notna(v) and str(v).strip().upper() == "MSN"][0]

    next_row = raw.iloc[header_row_idx + 1]
    has_units_row = pd.isna(next_row.iloc[msn_col_pos])  # real data rows always have an MSN value

    if has_units_row:
        col_names = build_column_names(header_row, next_row)
        data_start = header_row_idx + 2
    else:
        col_names = build_column_names(header_row, None)
        data_start = header_row_idx + 1

    df = raw.iloc[data_start:].copy()
    df.columns = col_names
    df = df.dropna(how="all")
    df = df[df["MSN"].notna()].copy()
    df["MSN"] = df["MSN"].apply(lambda v: str(int(float(v))) if pd.notna(v) else v)

    return df, from_dt, to_dt


def load_portal_export(path: Path) -> tuple[pd.DataFrame, pd.Timestamp, pd.Timestamp]:
    """Cached front door to _parse_portal_export - see the cache notes above.

    Same signature and same return value as before; the only difference is
    that asking for the same file twice in one run is now free.
    """
    key = _cache_key(path)
    if key is None:
        return _parse_portal_export(path)

    with _CACHE_LOCK:
        hit = _CACHE.get(key)
    if hit is not None:
        df, from_dt, to_dt = hit
        return df.copy(), from_dt, to_dt

    df, from_dt, to_dt = _parse_portal_export(path)

    with _CACHE_LOCK:
        _CACHE[key] = (df, from_dt, to_dt)
        _CACHE_ORDER.append(key)
        while len(_CACHE_ORDER) > _CACHE_MAX:
            _CACHE.pop(_CACHE_ORDER.pop(0), None)

    return df.copy(), from_dt, to_dt


def autofit_columns(writer: pd.ExcelWriter, df: pd.DataFrame, sheet_name: str) -> None:
    ws = writer.sheets[sheet_name]
    for i, col in enumerate(df.columns, start=1):
        width = max(len(str(col)), df[col].astype(str).map(len).max() if len(df) else 0) + 2
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = min(width, 40)


METER_INFO_COLS = ["MSN", "Ref. No.", "Disco", "Circle", "Division", "Sub-Division", "Feeder"]


def build_meter_info(paths: list[Path]) -> pd.DataFrame:
    """One row per MSN with its static identity/location fields (Ref. No.,
    Disco, Circle, Division, Sub-Division, Feeder) - pulled from whichever of
    the given source files carry them. These don't change over time, so any
    file containing that MSN can supply them; if a field is missing in one
    file it's filled from another where available.

    Kept as its own lookup table (not repeated on every row of every other
    sheet) so a future dashboard/webapp can just join on MSN instead of
    reading duplicated location text off every single row.
    """
    frames = []
    for p in paths:
        df, _, _ = load_portal_export(p)
        available = [c for c in METER_INFO_COLS if c in df.columns]
        if "MSN" not in available or len(available) < 2:
            continue
        frames.append(df[available])

    if not frames:
        return pd.DataFrame(columns=METER_INFO_COLS)

    combined = pd.concat(frames, ignore_index=True)
    info = combined.groupby("MSN", as_index=False).first()  # first non-null value per column
    cols = [c for c in METER_INFO_COLS if c in info.columns]
    return info[cols].sort_values("MSN").reset_index(drop=True)


def add_ref_no(df: pd.DataFrame, meter_info: pd.DataFrame) -> pd.DataFrame:
    """Inserts a 'Ref. No.' column right after 'MSN' in df, via lookup - not
    the fuller Division/Sub-Division/Feeder set, which stays only on the
    Meter Info sheet. Ref. No. is cheap (one short column) and doubles as a
    search key, so it's worth having directly on row-level sheets too."""
    if df.empty or "MSN" not in df.columns or "Ref. No." not in meter_info.columns:
        return df
    ref_map = dict(zip(meter_info["MSN"], meter_info["Ref. No."]))
    df = df.copy()
    df.insert(df.columns.get_loc("MSN") + 1, "Ref. No.", df["MSN"].map(ref_map))
    return df


# =========================================================================
# Upload validation - so a wrong/incomplete file gives a clear message
# instead of a cryptic crash deep in an analysis.
# =========================================================================

ROLE_LABEL = {"lp": "Load Profile", "events": "Events", "dr": "Daily Reads",
              "ir": "Instantaneous Reads"}


class FileValidationError(ValueError):
    """Raised when an uploaded file is unreadable, the wrong type of export,
    or missing columns required for its slot. The message is user-facing."""
    pass


def _detect_file_type(cols_lower: list[str]) -> str:
    """Best-guess which portal export this is, from its column names."""
    if any(c == "event name" for c in cols_lower):
        return "events"
    # instantaneous reads is the only export with per-phase current + power factor
    if any(c.startswith("current (amp)") for c in cols_lower) and \
       any(c == "power factor" for c in cols_lower):
        return "ir"
    if any(c == "power (import) (kw)" for c in cols_lower) or \
       any(c == "adv(units)" for c in cols_lower):
        return "lp"
    if any(c.startswith("adv.") for c in cols_lower) or \
       any("accum mdi" in c for c in cols_lower):
        return "dr"
    return "unknown"


def _col_eq(name):
    return lambda cols: name in cols


def _col_prefix(pref):
    return lambda cols: any(c.startswith(pref) for c in cols)


# (display name, matcher) for the columns each slot must have
_REQUIRED_COLUMNS = {
    "lp": [
        ("Date & time", _col_prefix("date")),
        ("Power (Import) (kW)", _col_eq("power (import) (kw)")),
        ("Energy (Import) (kWh)", _col_eq("energy (import) (kwh)")),
        ("Adv(Units)", _col_eq("adv(units)")),
        ("MF", _col_eq("mf")),
    ],
    "dr": [
        ("Date & Time", _col_prefix("date")),
        ("Adv. (kWh)", _col_prefix("adv.")),
    ],
    "events": [
        ("Event Name", _col_eq("event name")),
        ("Reporting Time", _col_prefix("reporting")),
    ],
    "ir": [
        ("Date & time", _col_prefix("date")),
        ("Current (Amp)", _col_prefix("current (amp)")),
        ("Voltage (Volt)", _col_prefix("voltage (volt)")),
        ("Power Factor", _col_eq("power factor")),
    ],
}


def validate_portal_file(path: Path, role: str) -> None:
    """Validate that `path` is a valid file for its slot (`role` = lp/events/dr).

    Raises FileValidationError with a clear, user-facing message if the file
    can't be read, is the wrong type of export, or is missing required
    columns. Returns None on success.
    """
    label = ROLE_LABEL.get(role, role)

    try:
        df, _, _ = load_portal_export(path)
    except ValueError as e:
        raise FileValidationError(f"The {label} file could not be read. {e}")
    except Exception:
        raise FileValidationError(
            f"The {label} file could not be read. Make sure it is a valid "
            f"Excel or CSV export downloaded from the portal."
        )

    cols_lower = [str(c).strip().lower() for c in df.columns]
    detected = _detect_file_type(cols_lower)

    # 1) wrong TYPE of file in this slot
    if detected != "unknown" and detected != role:
        raise FileValidationError(
            f"Wrong file in the {label} slot: this looks like a "
            f"{ROLE_LABEL[detected]} file. Please upload the {label} file here."
        )

    # 2) right type (or unknown) but missing columns this analysis needs
    missing = [nice for nice, ok in _REQUIRED_COLUMNS.get(role, []) if not ok(cols_lower)]
    if missing:
        raise FileValidationError(
            f"The {label} file is missing required column(s): "
            f"{', '.join(missing)}. It may be the wrong report or an incomplete "
            f"download - re-download the {label} from the portal."
        )
