# LESCO Meter Data Analyzer
## لیسکو اسمارٹ میٹر ڈیٹا اینالائزر

An enterprise-grade smart meter data analytics (MDM) and revenue protection platform built for electrical distribution utilities (specifically tailored for Lahore Electric Supply Company — LESCO). It ingests raw AMR/AMI interval exports, correlates communication breaks with grid outage alarms, models trailing consumption trends, auto-detects multiplication factor (MF) scaling, and identifies high-priority electricity theft using a self-calibrating 3-tier scoring engine.

---

## 🎯 Overview

Modern Advanced Metering Infrastructure (AMI) generates massive volumes of high-frequency telemetry. However, utilities face severe data quality hurdles: 100% of smart meters experience periodic cellular/GPRS communication dropouts, and over 95% of breaks appear unexplained if viewed in isolation. Furthermore, electricity theft (shunting, CT bypass, phase tampering, reverse energy) costs utilities hundreds of millions of rupees annually.

The **LESCO Meter Data Analyzer** bridges raw telemetry dumps and field operations. It automatically cleanses semi-structured portal exports, distinguishes legitimate power cuts from communication failures, detects abnormal baseline consumption drops, and uses fleet-relative statistical weighting (IDF) to rank suspicious meters into an actionable **Inspection Worklist**.

---

## ✨ Key Features

- **Automated Telemetry Ingestion**: Seamlessly parses raw portal Excel (`.xlsx`, `.xls`) and `.csv` exports without manual pre-formatting.
- **Outage-Correlated Gap Detection**: Chronologically pairs `Power Fail Start` & `Power Fail End` hardware alarms to compute exact **Outage Coverage %** against communication breaks (with a verified 50% coverage cutoff).
- **Trailing Baseline Trend Modeling**: Compares daily consumption against a 14-day rolling historical baseline, applying midnight date normalization ($D-1$) to flag severe consumption drops ($\ge 50\%$).
- **Dynamic Peak Load & MF Scaling**: Auto-detects whether raw demand registers require meter Multiplication Factor (MF) scaling by analyzing billing register advance ratios.
- **Self-Calibrating Theft Screening**: Ranks meters using fleet-relative Inverse Document Frequency (IDF) rarity weighting ($\ln\frac{N+1}{n+0.5}$) combined with physical tamper grade multipliers ($3\times$ for Tier 1A, $1.5\times$ for Tier 1B, $1\times$ for Tier 2).
- **Interactive Radial 24-Hour Peak Clock**: Custom SVG-based visualization mapping daily peak hours and highlighting high-risk night-time anomalies ($23:00\text{--}05:00$).
- **Multi-Surface Architecture**: Operates as modular CLI tools, a standalone Tkinter Desktop GUI executable (`.exe`), a FastAPI REST API server, or an interactive React 19 web dashboard.
- **Smart Demo Mode**: Automatically switches to an interactive demo engine with pre-loaded feeder datasets when deployed on static platforms like Vercel or when the backend is offline.

---

### Frontend
- **Framework**: React 19 with JSX
- **Build Tool**: Vite 8
- **Styling**: Handcrafted responsive CSS with glassmorphic dark theme
- **Charts & Visualization**: Recharts (scatter plots, duration histograms, timelines) + Custom SVG Radial Clock
- **State & Caching**: React Context (`AnalysisContext`, `MobileNavContext`) + Memory LRU Cache
- **Routing**: React Router DOM v7 with URL search query synchronization

### Backend & Analytics
- **Runtime**: Python 3.11+
- **Framework**: FastAPI + Uvicorn (ASGI)
- **Data Engineering**: Pandas, NumPy
- **Spreadsheet Generation**: OpenPyXL with dynamic column auto-fitting
- **Desktop GUI**: Python Tkinter / ttk bundled via PyInstaller

---

## 🚀 Getting Started

### Prerequisites
- **Python**: 3.11 or newer (ensure *"Add Python to PATH"* is checked)
- **Node.js**: v18+ and npm (only needed for frontend development)

---

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/<your-username>/lesco-meter-analyzer.git
   cd lesco-meter-analyzer
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Frontend dependencies**
   ```bash
   cd Frontend/lesco-mdm-frontend
   npm install
   cd ../..
   ```

---

### Quick Launch (1-Click Scripts on Windows)

- **Option A — Development Mode (Recommended)**:  
  Double-click **`START.bat`**  
  *Starts both the FastAPI server on `http://localhost:8000` and Vite dev server on `http://localhost:5173`.*

- **Option B — Production / Single-Server Mode (Python only)**:  
  Double-click **`RUN-LESCO.bat`**  
  *Python serves both the backend API and the compiled frontend at `http://localhost:8000`.*

- **Option C — Standalone Desktop GUI**:  
  Run `python backend/gui_app.py` or double-click the pre-built PyInstaller `.exe`.

---

### Manual Terminal Commands

**Start the Backend (Terminal 1):**
```powershell
cd backend
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

**Start the Frontend (Terminal 2):**
```powershell
cd Frontend/lesco-mdm-frontend
npm run dev
```

---

### Production Build

```powershell
cd Frontend/lesco-mdm-frontend
npm run build
```
*The compiled static assets will be output to `Frontend/lesco-mdm-frontend/dist`, ready to be served by FastAPI or deployed to Vercel.*

---

## 📁 Project Structure

```
lesco-meter-analyzer/
├── backend/                             # Python analytical pipeline & API
│   ├── api.py                          # FastAPI REST API controller
│   ├── jobs.py                         # Thread-safe in-memory job store & sanitizer
│   ├── lesco_common.py                 # File parser, unit resolver, LRU cache
│   ├── gap_finder.py                   # Break continuity & interval rate detection
│   ├── event_correlator.py             # Outage window pairing & coverage math
│   ├── daily_trend.py                  # Rolling baseline & consumption drop evaluator
│   ├── peak_load.py                    # MF scale detector & peak demand aggregator
│   ├── theft_screen.py                 # 3-tier scoring engine with IDF self-calibration
│   ├── final_report.py                 # Multi-sheet Excel workbook generator
│   ├── gui_app.py                      # Standalone Tkinter desktop application
│   └── LESCO_Meter_Analyzer.spec       # PyInstaller executable build spec
├── Frontend/
│   └── lesco-mdm-frontend/             # React 19 single-page application
│       ├── src/
│       │   ├── components/             # Reusable UI (TopBar, Sidebar, ReusableTable, Filters)
│       │   ├── context/                # AnalysisContext & MobileNavContext
│       │   ├── data/                   # demoData.js (verified sample feeder dataset)
│       │   ├── pages/
│       │   │   ├── LandingPage/        # Upload dropzone & dynamic demo trigger
│       │   │   ├── Worklist/           # Prioritized theft inspection queue
│       │   │   ├── FullReport/         # Executive 4-in-1 summary dashboard
│       │   │   ├── MeterDetail/        # Single-meter breakdown with radial peak clock
│       │   │   ├── GapDetection/       # Load profile break analysis & scatter plot
│       │   │   ├── DailyTrend/         # 30-day baseline consumption review
│       │   │   ├── PeakLoad/           # Peak kW demand & load factor evaluation
│       │   │   └── Help/               # Interactive engineering manual & formulas
│       │   ├── services/               # api.js client, jobStore.js, useJobData.js
│       │   ├── router.jsx              # React Router DOM configuration
│       │   └── main.jsx                # Application bootstrap entry point
│       ├── vercel.json                 # Vercel SPA routing rewrites
│       └── package.json                # Frontend dependencies & build scripts
├── ALLOW-NETWORK-ACCESS.bat             # Windows Firewall configuration for office LANs
├── RUN-LESCO.bat                       # 1-click single-server launcher
├── START.bat                           # 1-click full dev mode launcher
├── requirements.txt                    # Python dependencies
└── README.md                           # Documentation
```

---

## 🔐 Security & Validation Features

- **Structural Export Validation**: `validate_portal_file()` verifies internal headers against expected tokens, blocking mismatched or corrupt downloads before analysis starts.
- **Path Traversal Protection**: Uploaded files are isolated to secure temporary workspaces (`tempfile.mkdtemp()`) and immediately cleaned up post-analysis.
- **Bounded Resource Usage**: Restricts in-memory job retention to the 3 most recent jobs (`MAX_KEPT_JOBS = 3`) to prevent out-of-memory errors on 4GB office PCs.
- **LAN-Safe Firewall Scoping**: `ALLOW-NETWORK-ACCESS.bat` restricts firewall openings strictly to `private,domain` profiles, blocking exposure on public Wi-Fi.

---

## 📊 Analytics & Detection Engines

| Engine | Technical Method | Rationale & Real-World Finding |
| :--- | :--- | :--- |
| **Continuity Finder** | $\Delta t > 1.5 \times \text{Interval}$ | Auto-detects 15m vs 30m sampling using statistical modal delta checks. |
| **Outage Correlator** | Temporal overlap against chronologically paired `Power Fail` windows | Real data showed a 144h break matched a 27min outage; enforced a strict **50% Outage Coverage Threshold** to prevent partial masking. |
| **Trend Modeler** | 14-day rolling mean ($[D-14, D)$) with $\ge 50\%$ drop flag | Midnight register reads report consumption during day $D-1$; applies automated **1-day backward shift**. |
| **Peak Demand** | $\max(\text{kW})$ per calendar day | Auto-detects whether raw registers are pre-multiplied by comparing `Adv(Units)` against raw interval deltas. |
| **Theft Screener** | Self-calibrating IDF weights $\times$ Tier grade multipliers | Physical evidence (CT bypass, phase loss) outranks statistical trends ($3\times$ multiplier). Fleet-relative weights adapt across different subdivisions. |

---

## 🛠️ Technology Stack

### Frontend Technologies
- **React 19**, **Vite 8**, **JavaScript (ES Modules)**
- **Recharts** (SVG Data Visualizations)
- **Lucide React** (Icons)
- **React Router DOM v7** (Client Routing)
- **Pure CSS3** (Glassmorphic dark design system)

### Backend & Analytics Technologies
- **Python 3.11+**, **FastAPI**, **Uvicorn**
- **Pandas**, **NumPy** (Vectorized math & baseline modeling)
- **OpenPyXL** (Automated Excel reporting)
- **Tkinter / ttk** (Native desktop GUI)
- **PyInstaller** (Self-contained binary distribution)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/smart-meter-enhancement`)
3. Commit your changes (`git commit -m 'Add support for secondary feeder grouping'`)
4. Push to the branch (`git push origin feature/smart-meter-enhancement`)
5. Open a Pull Request

---

## 🏛️ Utility Compliance & Industry Context

Designed in accordance with Pakistan power distribution standards (NEPRA / PEPCO guidelines) for automated meter data management, feeder energy auditing, and anti-theft revenue protection.

---

## 📞 Support

For operational queries, portal export format adjustments, or feature requests, open an issue in the repository or contact the project maintainer.

---

**Built for Power Distribution Reliability & Revenue Protection** ⚡🇵🇰
