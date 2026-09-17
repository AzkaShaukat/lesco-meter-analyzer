"""
LESCO Meter Data Analyzer - basic desktop GUI.

Lets someone who doesn't use VS Code or a terminal run the same analyses as
the command-line scripts: pick the files, pick what to analyze, click Run,
get an Excel report. This is a thin wrapper - all the actual logic lives in
gap_finder.py / event_correlator.py / daily_trend.py / peak_load.py /
final_report.py, via each one's build_*_sheets() function (added specifically
so the CLI and this GUI share the exact same code path, not two copies of
the same logic).

Packaged as a standalone .exe with PyInstaller - see BUILD.md for the build
command. End users just double-click the exe, no Python install needed.

Usage (running from source):
    python gui_app.py
"""

import queue
import sys
import threading
import traceback
from pathlib import Path

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import pandas as pd

from lesco_common import autofit_columns
from gap_finder import build_gap_sheets
from event_correlator import build_correlation_sheets
from daily_trend import build_trend_sheets
from peak_load import build_peak_sheets
from final_report import build_final_sheets
from theft_screen import build_screen_sheets


ANALYSES = {
    "Load Profile Break": {
        "needs": ["lp"],
        "desc": "Finds missing Load Profile intervals. Needs: Load Profile.",
        "run": lambda p, log: build_gap_sheets(p["lp"], log),
        "suffix": "_gaps.xlsx",
    },
    "Event Correlation": {
        "needs": ["lp", "events"],
        "desc": "Load profile breaks, checked against outage events. Needs: Load Profile, Events.",
        "run": lambda p, log: build_correlation_sheets(p["lp"], p["events"], log),
        "suffix": "_gap_events.xlsx",
    },
    "Daily Trend Analysis": {
        "needs": ["dr"],
        "desc": "Flags days with suspiciously low consumption. Needs: Daily Reads.",
        "run": lambda p, log: build_trend_sheets(p["dr"], log),
        "suffix": "_trend.xlsx",
    },
    "Peak Load Analysis": {
        "needs": ["lp", "dr"],
        "desc": "Daily peak load (kW) + weekly/monthly peak consumption (kWh). Needs: Load Profile, Daily Reads.",
        "run": lambda p, log: build_peak_sheets(p["lp"], p["dr"], log),
        "suffix": "_peak_load.xlsx",
    },
    "Theft Screen (who to inspect)": {
        "needs": ["lp", "events", "dr"],
        "optional": ["ir"],
        "desc": ("Ranks meters by how much they look like theft, so only a few need "
                 "manual checking. Needs: Load Profile, Events, Daily Reads. "
                 "Instantaneous Reads is optional and adds the energy-balance check."),
        "run": lambda p, log: build_screen_sheets(p["lp"], p["events"], p["dr"],
                                                  p.get("ir"), log),
        "suffix": "_theft_screen.xlsx",
    },
    "Full Report (all checks)": {
        "needs": ["lp", "events", "dr"],
        "optional": ["ir"],
        "desc": ("Everything above including the theft worklist, one Excel file. "
                 "Needs: Load Profile, Events, Daily Reads. Instantaneous Reads optional."),
        "run": lambda p, log: build_final_sheets(p["lp"], p["events"], p["dr"],
                                                 ir_path=p.get("ir"), log=log),
        "suffix": "_final_report.xlsx",
    },
}

FILE_LABELS = {"lp": "Load Profile", "events": "Events", "dr": "Daily Reads",
               "ir": "Instantaneous Reads (optional)"}


class App:
    def __init__(self, root):
        self.root = root
        root.title("LESCO Meter Data Analyzer")
        root.geometry("720x560")
        root.minsize(640, 480)

        self.file_paths = {"lp": tk.StringVar(), "events": tk.StringVar(),
                           "dr": tk.StringVar(), "ir": tk.StringVar()}
        self.analysis_var = tk.StringVar(value=list(ANALYSES.keys())[0])
        self.log_queue = queue.Queue()
        self.worker = None
        self.last_output_path = None

        self._build_widgets()
        self._on_analysis_change()
        self.root.after(100, self._poll_log_queue)

    def _build_widgets(self):
        pad = {"padx": 10, "pady": 6}

        # --- File pickers ---
        files_frame = ttk.LabelFrame(self.root, text="1. Select your files")
        files_frame.pack(fill="x", **pad)

        self.file_rows = {}
        for key in ["lp", "events", "dr", "ir"]:
            row = ttk.Frame(files_frame)
            row.pack(fill="x", padx=8, pady=4)
            label = ttk.Label(row, text=FILE_LABELS[key], width=14)
            label.pack(side="left")
            entry = ttk.Entry(row, textvariable=self.file_paths[key], state="readonly")
            entry.pack(side="left", fill="x", expand=True, padx=6)
            btn = ttk.Button(row, text="Browse...", command=lambda k=key: self._browse(k))
            btn.pack(side="left")
            self.file_rows[key] = (label, entry, btn)

        # --- Analysis choice ---
        analysis_frame = ttk.LabelFrame(self.root, text="2. Choose what to analyze")
        analysis_frame.pack(fill="x", **pad)

        for name in ANALYSES:
            rb = ttk.Radiobutton(analysis_frame, text=name, value=name, variable=self.analysis_var,
                                  command=self._on_analysis_change)
            rb.pack(anchor="w", padx=8, pady=2)

        self.desc_label = ttk.Label(analysis_frame, text="", foreground="#555", wraplength=650, justify="left")
        self.desc_label.pack(anchor="w", padx=8, pady=(4, 8))

        # --- Run button ---
        run_frame = ttk.Frame(self.root)
        run_frame.pack(fill="x", **pad)
        self.run_button = ttk.Button(run_frame, text="Run Analysis", command=self._on_run)
        self.run_button.pack(side="left")
        self.open_folder_button = ttk.Button(run_frame, text="Open Output Folder",
                                              command=self._open_output_folder, state="disabled")
        self.open_folder_button.pack(side="left", padx=8)
        self.status_label = ttk.Label(run_frame, text="")
        self.status_label.pack(side="left", padx=8)

        # --- Log area ---
        log_frame = ttk.LabelFrame(self.root, text="Status")
        log_frame.pack(fill="both", expand=True, **pad)
        self.log_text = tk.Text(log_frame, height=12, state="disabled", wrap="word")
        self.log_text.pack(fill="both", expand=True, padx=6, pady=6)

    def _browse(self, key):
        path = filedialog.askopenfilename(
            title=f"Select {FILE_LABELS[key]} file",
            filetypes=[("Excel files", "*.xlsx *.xls"), ("All files", "*.*")],
        )
        if path:
            self.file_paths[key].set(path)

    def _on_analysis_change(self):
        info = ANALYSES[self.analysis_var.get()]
        self.desc_label.config(text=info["desc"])
        needed = set(info["needs"])
        optional = set(info.get("optional", []))
        for key, (label, entry, btn) in self.file_rows.items():
            usable = key in needed or key in optional
            btn.config(state="normal" if usable else "disabled")
            # required files in black, optional in grey-blue, unused greyed out
            label.config(foreground="black" if key in needed
                         else ("#4a6f9c" if key in optional else "#999"))

    def _log(self, message: str):
        self.log_queue.put(str(message))

    def _poll_log_queue(self):
        try:
            while True:
                msg = self.log_queue.get_nowait()
                self.log_text.config(state="normal")
                self.log_text.insert("end", msg + "\n")
                self.log_text.see("end")
                self.log_text.config(state="disabled")
        except queue.Empty:
            pass
        self.root.after(100, self._poll_log_queue)

    def _on_run(self):
        analysis_name = self.analysis_var.get()
        info = ANALYSES[analysis_name]

        paths = {}
        for key in info["needs"]:
            raw = self.file_paths[key].get().strip()
            if not raw:
                messagebox.showerror("Missing file", f"Please select a {FILE_LABELS[key]} file first.")
                return
            paths[key] = Path(raw)
        for key in info.get("optional", []):
            raw = self.file_paths[key].get().strip()
            if raw:
                paths[key] = Path(raw)

        first_input = paths[info["needs"][0]]
        default_name = first_input.stem + info["suffix"]
        output_path_str = filedialog.asksaveasfilename(
            title="Save report as",
            initialfile=default_name,
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx")],
        )
        if not output_path_str:
            return
        output_path = Path(output_path_str)

        self.run_button.config(state="disabled")
        self.open_folder_button.config(state="disabled")
        self.status_label.config(text="Running...")
        self.log_text.config(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.config(state="disabled")

        self.worker = threading.Thread(
            target=self._run_worker, args=(analysis_name, info, paths, output_path), daemon=True
        )
        self.worker.start()

    def _run_worker(self, analysis_name, info, paths, output_path):
        try:
            self._log(f"Running: {analysis_name}")
            sheets = info["run"](paths, self._log)

            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                for name, df in sheets.items():
                    df.to_excel(writer, sheet_name=name, index=False)
                    autofit_columns(writer, df, name)

            self._log(f"\nDone. Report saved to:\n{output_path}")
            self.last_output_path = output_path
            self.root.after(0, self._on_success, output_path)
        except Exception as e:
            tb = traceback.format_exc()
            self._log(f"\nERROR: {e}\n\n{tb}")
            self.root.after(0, self._on_error, str(e))

    def _on_success(self, output_path):
        self.run_button.config(state="normal")
        self.open_folder_button.config(state="normal")
        self.status_label.config(text="Done.")
        messagebox.showinfo("Done", f"Report saved to:\n{output_path}")

    def _on_error(self, message):
        self.run_button.config(state="normal")
        self.status_label.config(text="Failed.")
        messagebox.showerror("Something went wrong", message)

    def _open_output_folder(self):
        if not self.last_output_path:
            return
        folder = self.last_output_path.parent
        if sys.platform == "win32":
            import os
            os.startfile(folder)
        else:
            import subprocess
            subprocess.run(["xdg-open", str(folder)])


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
