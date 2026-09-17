import { useEffect, useRef, useState } from "react";
import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import "./HelpPage.css";

/* Every threshold quoted on this page is the value actually used by the
   backend (daily_trend.py, event_correlator.py, gap_finder.py, peak_load.py,
   theft_screen.py). If a rule is tuned there, update it here too. */

const SECTIONS = [
  { id: "start", label: "Getting started" },
  { id: "files", label: "The four data files" },
  { id: "analyses", label: "Choosing an analysis" },
  { id: "reading", label: "Reading the results" },
  { id: "charts", label: "What each chart shows" },
  { id: "rules", label: "How the numbers are calculated" },
  { id: "screen", label: "How meters are ranked" },
  { id: "limits", label: "What this cannot tell you" },
  { id: "trouble", label: "Troubleshooting" },
];

function HelpPage() {
  const [active, setActive] = useState("start");
  // set while a click-jump is in flight, so the scroll handler does not
  // immediately overwrite the chip the user just picked
  const jumping = useRef(false);

  /* Now that the contents bar is always on screen, the highlighted chip has to
     follow the reader rather than only reflect the last click. */
  useEffect(() => {
    const box = document.querySelector(".help-content");
    if (!box) return undefined;

    const onScroll = () => {
      if (jumping.current) return;
      const barBottom =
        (document.querySelector(".help-toc")?.getBoundingClientRect().bottom ?? 0) + 4;
      let current = SECTIONS[0].id;
      for (const sec of SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el && el.getBoundingClientRect().top <= barBottom) current = sec.id;
      }
      setActive((prev) => (prev === current ? prev : current));
    };

    box.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => box.removeEventListener("scroll", onScroll);
  }, []);

  /* Scroll the content column directly rather than using scrollIntoView():
     the page sits inside an overflow:hidden layout wrapper and
     scrollIntoView() does not move the scrollable column there. */
  const go = (id) => {
    setActive(id);
    const el = document.getElementById(id);
    const box = document.querySelector(".help-content");
    if (!el || !box) return;
    // the contents bar is sticky, so land the heading BELOW it rather than
    // underneath it
    const bar = document.querySelector(".help-toc");
    const barH = bar ? bar.getBoundingClientRect().height : 0;
    const top =
      el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    /* Plain assignment, and deliberately NO smooth scrolling — neither
       behavior:"smooth" nor CSS scroll-behavior actually animates in some
       embedded browsers, and when the animation is dropped the scroll never
       happens at all, so the contents links silently did nothing. An instant
       jump always works. */
    jumping.current = true;
    box.scrollTop = Math.max(0, top - barH - 14);
    // release once the browser has settled on the new offset
    window.setTimeout(() => {
      jumping.current = false;
    }, 120);
  };

  return (
    <div className="help-page">
      <TopBar variant="report" showSearch={false} />

      <div className="help-container">
        <Sidebar activeItem="Help" />

        <main className="help-content">
          <header className="help-header">
            <p className="help-eyebrow">DOCUMENTATION</p>
            <h1>How to use this system</h1>
            <p className="help-sub">
              What each screen means, what every chart is showing you, and the exact
              rule behind every number the system produces.
            </p>
          </header>

          {/* ---------- contents ---------- */}
          <nav className="help-toc" aria-label="Contents">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`help-toc-item ${active === s.id ? "active" : ""}`}
                onClick={() => go(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* ================= GETTING STARTED ================= */}
          <section className="help-section" id="start">
            <h2>Getting started</h2>
            <p>
              The system reads the Excel files you already download from the AMI portal
              and turns them into a report. Nothing is uploaded to the internet — the
              analysis runs on this machine.
            </p>

            <ol className="help-steps">
              <li>
                <strong>Download the exports from the portal</strong> for the meters and
                the period you want to review. Keep them as they are — do not open and
                re-save them, and do not delete rows or rename column headings.
              </li>
              <li>
                <strong>Open the New Analysis page</strong> (the button at the bottom of
                the left sidebar) and pick the analysis you want. The page then asks only
                for the files that analysis needs.
              </li>
              <li>
                <strong>Attach the files and press Run analysis.</strong> A full month of
                around 100 meters takes roughly one to two minutes.
              </li>
              <li>
                <strong>Read the results</strong> using the sidebar sections, then press{" "}
                <em>Export</em> on any page to download the whole thing as one Excel
                workbook.
              </li>
            </ol>

            <div className="help-note">
              <strong>Sections are locked until they have data.</strong> If you run only a
              Daily trend analysis, the Peak load section stays greyed out with a padlock —
              that analysis simply did not produce those numbers. Run a Full report to
              unlock everything.
            </div>
          </section>

          {/* ================= FILES ================= */}
          <section className="help-section" id="files">
            <h2>The four data files</h2>
            <p>
              These are the standard portal exports. The system checks each file before it
              runs and refuses one that is the wrong type or is missing a required column,
              so a file dropped in the wrong slot is caught immediately.
            </p>

            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Usually named</th>
                    <th>What it contains</th>
                    <th>Used for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Load Profile</strong></td>
                    <td><code>custom_lp</code></td>
                    <td>
                      A reading every 15 or 30 minutes: power, energy, and the meter's
                      multiplication factor
                    </td>
                    <td>Finding breaks; peak demand</td>
                  </tr>
                  <tr>
                    <td><strong>Events</strong></td>
                    <td><code>custom_ed</code></td>
                    <td>
                      The meter's own alarm log — power failures, phase failures, reverse
                      energy, CT bypass, configuration changes
                    </td>
                    <td>Explaining breaks; tamper evidence</td>
                  </tr>
                  <tr>
                    <td><strong>Daily Reads</strong></td>
                    <td><code>custom_dr</code></td>
                    <td>One row per meter per day with the energy consumed that day</td>
                    <td>Consumption trend; weekly and monthly peaks</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Instantaneous Reads</strong>
                      <span className="help-pill">optional</span>
                    </td>
                    <td><code>custom_ir</code></td>
                    <td>
                      Per-phase current and voltage, power factor, frequency
                    </td>
                    <td>The energy-balance check</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="help-note">
              Only <code>.xlsx</code>, <code>.xls</code> and <code>.csv</code> are
              accepted. If a file is rejected, the message names the missing column or
              tells you which file type it actually looks like.
            </div>
          </section>

          {/* ================= ANALYSES ================= */}
          <section className="help-section" id="analyses">
            <h2>Choosing an analysis</h2>

            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>Analysis</th>
                    <th>Files needed</th>
                    <th>Answers</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Load Profile Break</strong></td>
                    <td>Load Profile</td>
                    <td>Where did the meter stop recording, and for how long?</td>
                  </tr>
                  <tr>
                    <td><strong>Event correlation</strong></td>
                    <td>Load Profile + Events</td>
                    <td>Were those breaks caused by a real power cut, or unexplained?</td>
                  </tr>
                  <tr>
                    <td><strong>Daily trend analysis</strong></td>
                    <td>Daily Reads</td>
                    <td>Did consumption drop far below what this meter normally uses?</td>
                  </tr>
                  <tr>
                    <td><strong>Peak load analysis</strong></td>
                    <td>Load Profile + Daily Reads</td>
                    <td>How much demand is drawn, and at what time of day?</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Full report</strong>
                      <span className="help-pill rec">recommended</span>
                    </td>
                    <td>
                      Load Profile + Events + Daily Reads
                      <br />
                      <span className="help-dim">(Instantaneous Reads optional)</span>
                    </td>
                    <td>
                      All of the above, plus the ranked inspection worklist
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              Use <strong>Full report</strong> unless you have a reason not to — the
              checks reinforce each other, and the worklist can only be produced when the
              Events file is present.
            </p>
          </section>

          {/* ================= READING RESULTS ================= */}
          <section className="help-section" id="reading">
            <h2>Reading the results</h2>

            <h3>The two levels</h3>
            <p>
              Every section has a <strong>fleet view</strong> (all meters) and a{" "}
              <strong>single-meter view</strong>. Tables list one row per meter with a
              summary; click any <strong>MSN</strong> to open that meter and see its
              individual records. Press <strong>← Back</strong> in the page header to
              return.
            </p>

            <h3>Sections in the sidebar</h3>
            <ul className="help-list">
              <li>
                <strong>Worklist</strong> — the few meters worth inspecting, ranked. Start
                here.
              </li>
              <li>
                <strong>Full report</strong> — one row per meter summarised across every
                analysis, with the theft score and priority.
              </li>
              <li>
                <strong>Load Profile Break</strong> — missing recording periods and
                whether an outage explains them.
              </li>
              <li>
                <strong>Daily trend analysis</strong> — days where consumption fell well
                below the meter's own normal.
              </li>
              <li>
                <strong>Peak load</strong> — maximum demand and when it occurs.
              </li>
            </ul>

            <h3>Filters, sorting and export</h3>
            <ul className="help-list">
              <li>
                <strong>Filters</strong> — the button in the page header. Options differ
                per page. The blue badge shows how many are active, and the panel tells
                you how many rows survive. <em>Clear all</em> resets them.
              </li>
              <li>
                <strong>Sorting</strong> — click a column heading with the ↕ mark. It
                cycles highest-first, then lowest-first, then off.
              </li>
              <li>
                <strong>Export</strong> — downloads the complete Excel workbook. On a
                single-meter page it exports just that meter.
              </li>
              <li>
                <strong>Search</strong> — type a meter number in the top bar to jump
                straight to it.
              </li>
            </ul>

            <h3>The three break classifications</h3>
            <div className="help-badges">
              <div className="help-badge-row">
                <span className="hb outage">Aligns with outage</span>
                <p>
                  The meter logged a power failure covering at least half of the break.
                  The meter was off because the supply was off. <strong>Normal.</strong>
                </p>
              </div>
              <div className="help-badge-row">
                <span className="hb low">Low coverage</span>
                <p>
                  An outage overlaps the break but explains less than half of it. Part of
                  the missing period is still unaccounted for. <strong>Worth a look.</strong>
                </p>
              </div>
              <div className="help-badge-row">
                <span className="hb review">Unexplained</span>
                <p>
                  No power-failure event matches at all. The meter stopped recording while
                  the supply was, as far as the log shows, still on.{" "}
                  <strong>This is the one that matters.</strong>
                </p>
              </div>
            </div>
          </section>

          {/* ================= CHARTS ================= */}
          <section className="help-section" id="charts">
            <h2>What each chart shows</h2>
            <p>
              Every chart responds to hover — point at any bar, segment or dot to see the
              exact numbers behind it.
            </p>

            <h3>Full report</h3>
            <ul className="help-list">
              <li>
                <strong>Break Resolution (doughnut)</strong> — how all breaks split
                between the three classifications above. Hovering a segment shows the
                number of breaks, how many meters are involved, and the percentage. A ring
                that is mostly red means most breaks have no recorded explanation.
              </li>
              <li>
                <strong>Longest breaks (top 10)</strong> — the ten single longest
                recording gaps, in hours. Click a bar to open that meter.
              </li>
              <li>
                <strong>Needs attention</strong> — four facts not shown anywhere else on
                the page: the meter with the most unexplained breaks, how many meters have
                no break explained by an outage at all, total hours of readings missing,
                and how many meters the screen flagged.
              </li>
            </ul>

            <h3>Load Profile Break</h3>
            <ul className="help-list">
              <li>
                <strong>Break duration distribution</strong> — how many breaks fall into
                each length band (under 1 hour, 1–6, 6–24, over 24). Long breaks are rarer
                but matter far more.
              </li>
              <li>
                <strong>Duration vs outage coverage</strong> — one dot per break. Left to
                right is how much of the break an outage explains (0–100%); bottom to top
                is how long it lasted. <em>Dots high on the left are the concern</em> — long
                breaks with no explanation. Colour shows the classification.
              </li>
              <li>
                <strong>Break starts by time of day</strong> — a heat grid: rows are the
                three classifications, columns are four-hour blocks. Darker means more
                breaks began in that block. Unexplained breaks clustering at one time of
                day can point at something systematic.
              </li>
              <li>
                <strong>Breaks by feeder</strong> — which feeders the breaks belong to. A
                feeder dominating usually means a network issue rather than meter tampering.
              </li>
            </ul>

            <h3>Daily trend analysis</h3>
            <ul className="help-list">
              <li>
                <strong>Consumption vs baseline</strong> — actual daily consumption against
                each meter's own rolling baseline. Where the actual line drops far under
                the baseline, the day is flagged.
              </li>
              <li>
                <strong>Suspicious days by meter</strong> — which meters accumulate the
                most flagged days. Repeated flags matter far more than one isolated day.
              </li>
            </ul>

            <h3>Peak load</h3>
            <ul className="help-list">
              <li>
                <strong>Highest demand by meter</strong> — the ten largest consumers by
                maximum demand. Click to open a meter.
              </li>
              <li>
                <strong>When peaks occur (24-hour clock)</strong> — midnight at the top,
                06:00 right, noon at the bottom, 18:00 left. Each spoke is one hour, and
                its length is how many daily peaks landed in that hour.{" "}
                <strong>Amber spokes are night hours (23:00–05:00).</strong> A normal
                consumer peaks during working or evening hours; one peaking mostly at night
                is unusual.
              </li>
              <li>
                <strong>Demand distribution</strong> — how many meters sit in each kW band,
                showing the shape of the fleet.
              </li>
              <li>
                <strong>Fleet daily maximum</strong> — the highest demand anywhere in the
                fleet on each day, useful for spotting system-wide stress days.
              </li>
              <li>
                <strong>Single meter</strong> — daily peak demand, weekly peak consumption
                (with a supporting table) and monthly peak consumption, each labelled with
                its unit and source file.
              </li>
            </ul>
          </section>

          {/* ================= RULES ================= */}
          <section className="help-section" id="rules">
            <h2>How the numbers are calculated</h2>
            <p>
              These are the actual rules the system applies. They were set from real data
              and can be tuned — if a threshold is changed in the analysis scripts, this
              page should be updated with it.
            </p>

            <h3>Finding a break</h3>
            <ul className="help-list">
              <li>
                Each meter's reading interval is <strong>measured from its own
                timestamps</strong>, not assumed from its meter number. This matters: in
                one real sample, 31 of 63 meters whose serial number implied 15 minutes
                were actually recording every 30 minutes.
              </li>
              <li>
                A gap is recorded once the step between two readings exceeds{" "}
                <strong>1.5 × that meter's interval</strong>. The 1.5 allows for small
                clock drift without reporting a valid reading as missing.
              </li>
              <li>
                Each break records its start, end, duration in hours, and how many readings
                are missing.
              </li>
            </ul>

            <h3>Explaining a break against the event log</h3>
            <ul className="help-list">
              <li>
                A power-failure window from the meter's own log must overlap the break,
                within a tolerance of <strong>one reading interval</strong> at each end
                (the edges of a break are only known to the nearest reading).
              </li>
              <li>
                <strong>Coverage</strong> is the share of the break the outage actually
                accounts for. At <strong>50% or more</strong> it is{" "}
                <em>Aligns with outage</em>; below 50% it becomes <em>Low coverage</em>.
              </li>
              <li>
                This 50% rule exists because of a real case: a{" "}
                <strong>144-hour break</strong> was being counted as fully explained by an
                outage lasting <strong>27 minutes</strong> — 0.3% coverage.
              </li>
              <li>
                A meter with no rows at all in the Events file is reported separately, so
                "no events recorded" is never mistaken for "no outage happened".
              </li>
            </ul>

            <h3>Flagging a suspicious consumption day</h3>
            <ul className="help-list">
              <li>
                The baseline is that meter's average daily consumption over the{" "}
                <strong>previous 14 days</strong>. Each meter is compared only against
                itself, never against other meters.
              </li>
              <li>
                At least <strong>5 days</strong> of history are required, otherwise the day
                is reported as <em>Insufficient baseline data</em> rather than guessed at.
              </li>
              <li>
                A day is flagged <strong>Suspicious low consumption</strong> when it falls{" "}
                <strong>50% or more below</strong> that baseline.
              </li>
              <li>
                Daily Reads are <strong>shifted back by one day</strong>: a reading stamped
                at midnight reports the energy used during the <em>previous</em> day. Without
                this correction every consumption figure would be attributed to the wrong date.
              </li>
            </ul>

            <h3>Demand and consumption</h3>
            <ul className="help-list">
              <li>
                <strong>Peak load (kW)</strong> is demand — the highest instantaneous rate
                recorded on a day, taken from the Load Profile.{" "}
                <strong>Peak consumption (kWh)</strong> is energy — the highest single-day
                total within a week or month, taken from Daily Reads. They are different
                physical quantities and are never mixed.
              </li>
              <li>
                <strong>Multiplication factor is detected per meter.</strong> Whether the
                portal has already applied the CT factor to the power and energy columns
                varies between files <em>and between meters in the same file</em>. The
                system compares each meter's own energy movement against its verified
                consumption column to decide. Without this, affected meters had their peak
                demand understated by a factor of up to several thousand.
              </li>
              <li>
                <strong>Load factor</strong> = average load ÷ peak load, calculated as
                (day's kWh ÷ 24) ÷ that day's peak kW, reported as a median. Around 0.3–0.6
                is a steady load; very low means a short sharp spike with little energy
                behind it.
              </li>
            </ul>

            <h3>Energy balance (needs Instantaneous Reads)</h3>
            <ul className="help-list">
              <li>
                Physical power is computed from the meter's own measurements:{" "}
                <code>(V1×I1 + V2×I2 + V3×I3) × power factor ÷ 1000</code>, then scaled by
                the multiplication factor.
              </li>
              <li>
                That is compared against the energy actually billed for the same day. A
                meter recording <strong>below 90%</strong> of what its own current and
                voltage imply is flagged as under-registering. At least{" "}
                <strong>5 comparable days</strong> are required.
              </li>
              <li>
                In plain terms: if current flowed through the meter, a matching amount of
                energy should have been registered. A persistent shortfall means energy is
                passing without being recorded.
              </li>
            </ul>
          </section>

          {/* ================= SCREEN ================= */}
          <section className="help-section" id="screen">
            <h2>How meters are ranked on the Worklist</h2>
            <p>
              Screening on data gaps alone is useless — measured across real fleets,{" "}
              <strong>effectively every meter has some</strong>. What actually narrows the
              list is a rare signal, or several independent symptoms landing on the same
              meter.
            </p>

            <h3>The signals, in three tiers</h3>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Signals</th>
                    <th>How it is treated</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="hb review">Tier 1A</span></td>
                    <td>
                      CT bypass · port programming · time synchronisation · per-phase
                      over-voltage · failing the energy-balance check
                    </td>
                    <td>
                      Rare and hard to explain innocently. <strong>One is enough</strong> to
                      warrant an inspection.
                    </td>
                  </tr>
                  <tr>
                    <td><span className="hb low">Tier 1B</span></td>
                    <td>Per-phase phase failure · per-phase reverse energy</td>
                    <td>
                      Genuine tamper-adjacent evidence, but common enough to need
                      corroboration.
                    </td>
                  </tr>
                  <tr>
                    <td><span className="hb neutral">Tier 2</span></td>
                    <td>
                      7 or more suspicious days · 5 or more near-zero days (0.5 kWh or
                      less) · more than half of peaks at night
                    </td>
                    <td>Supporting symptoms; meaningful only in combination.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>How the score is produced</h3>
            <ul className="help-list">
              <li>
                <strong>Rarity decides weight.</strong> Each signal is weighted by how rare
                it is <em>in the fleet you just analysed</em>, so the system calibrates
                itself to the area instead of using fixed thresholds. This is necessary:
                reverse energy appears on about 12% of meters in one area and 38% in
                another — the same signal means different things in each.
              </li>
              <li>
                <strong>Physical evidence outranks statistics.</strong> Tier 1A counts
                three times, Tier 1B one and a half times, Tier 2 once. Without this, three
                stacked statistical symptoms outscored a genuine CT-bypass alarm.
              </li>
              <li>
                Scores are scaled 0–100 within each analysis, so 100 always means "the
                strongest case in this batch", not a fixed level of certainty.
              </li>
            </ul>

            <h3>Priorities</h3>
            <ul className="help-list">
              <li>
                <span className="hb review">INSPECT</span> — any Tier 1A signal, or a Tier 1B
                signal backed by <strong>two</strong> Tier 2 symptoms.
              </li>
              <li>
                <span className="hb low">REVIEW</span> — a Tier 1B signal on its own, or all
                three Tier 2 symptoms together.
              </li>
              <li>
                <span className="hb neutral">No action</span> — nothing unusual found.
              </li>
            </ul>

            <p>
              The <em>How the ranking was calculated</em> panel on the Worklist shows the
              weight each signal was given and how common it was, so any ranking can be
              explained rather than taken on trust.
            </p>
          </section>

          {/* ================= LIMITS ================= */}
          <section className="help-section" id="limits">
            <h2>What this cannot tell you</h2>

            <div className="help-warn">
              <strong>A high score means "most worth a visit", not "this is a thief".</strong>{" "}
              Faulty CTs, misprogrammed meters and wiring errors produce the same
              signatures. Treat the worklist as a review queue and confirm on site.
            </div>

            <ul className="help-list">
              <li>
                <strong>Established theft can be invisible to the consumption check.</strong>{" "}
                The baseline is the meter's own recent history. If interference has been in
                place throughout the period, that reduced consumption <em>is</em> the
                baseline and nothing looks unusual. Only the event log or a physical
                inspection will catch it. This is why the Events file matters so much.
              </li>
              <li>
                <strong>A missing Events file is not an all-clear.</strong> A meter with no
                rows in that file is reported as such, never as "no outage occurred".
              </li>
              <li>
                <strong>Breaks alone prove nothing.</strong> Communication faults produce
                them constantly. That is exactly why breaks are cross-checked against the
                event log rather than reported on their own.
              </li>
              <li>
                <strong>Results only describe the period you uploaded.</strong> Anything
                before or after that window is invisible to the analysis.
              </li>
            </ul>
          </section>

          {/* ================= TROUBLESHOOTING ================= */}
          <section className="help-section" id="trouble">
            <h2>Troubleshooting</h2>

            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>What you see</th>
                    <th>What it means and what to do</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>A file is rejected on upload</td>
                    <td>
                      The message names the problem — wrong file type for that slot, or a
                      missing required column. Check you have not put the Daily Reads file
                      in the Load Profile slot, and re-download rather than editing the file.
                    </td>
                  </tr>
                  <tr>
                    <td>Sidebar sections are greyed out with a padlock</td>
                    <td>
                      That analysis did not produce those results. Run a Full report to
                      unlock every section.
                    </td>
                  </tr>
                  <tr>
                    <td>Tables and charts are empty</td>
                    <td>
                      The analysis is no longer loaded — results are held in memory and are
                      lost if the system is restarted. Run the analysis again.
                    </td>
                  </tr>
                  <tr>
                    <td>A meter search finds nothing</td>
                    <td>
                      That meter is not in the files you uploaded. Check the number, or
                      re-export from the portal including that meter.
                    </td>
                  </tr>
                  <tr>
                    <td>Peak demand looks far too low</td>
                    <td>
                      Usually a multiplication-factor problem. The system detects this per
                      meter, but it needs the <code>Adv(Units)</code> column present in the
                      Load Profile export to do so — check it was not removed.
                    </td>
                  </tr>
                  <tr>
                    <td>Almost every meter shows breaks</td>
                    <td>
                      Expected, and not a fault. Breaks are near-universal; that is why the
                      classification and the worklist exist. Sort by{" "}
                      <em>Unexplained</em> rather than by total breaks.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="help-footer">
            LESCO Meter Data Analyzer — every threshold on this page reflects the rules
            currently applied by the analysis engine.
          </div>
        </main>
      </div>
    </div>
  );
}

export default HelpPage;
