// ============================================================
// LESCO FRONTEND SHARED DUMMY DATA
// ============================================================
// Backend abhi connected nahi hai.
//
// STATE A = Full Report
// STATE B = Meter Detail
//
// Dono states isi shared dataset se data le rahe hain.
// Baad mein backend/API connect karte waqt isi structure ko
// API response se replace kiya ja sakta hai.
// ============================================================


// ============================================================
// METERS
// ============================================================

export const meters = [
  {
    msn: "2999815146",
    ref: "REF-9992-A",
    location: "Badami Bagh / Wanspura",
    feeder: "Wanspura Feeder",
    status: "Needs review",
    statusType: "review",

    gaps: [
      {
        start: "2026-07-02 08:15",
        end: "2026-07-02 11:32",
        duration: 3.3,
        missing: 4,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "96%",
      },

      {
        start: "2026-07-05 14:20",
        end: "2026-07-05 22:48",
        duration: 8.5,
        missing: 10,
        classification: "NO MATCHING OUTAGE EVENT",
        coverage: "0%",
      },

      {
        start: "2026-07-09 02:10",
        end: "2026-07-09 18:32",
        duration: 16.4,
        missing: 19,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "88%",
      },

      {
        start: "2026-07-13 06:05",
        end: "2026-07-14 10:18",
        duration: 28.2,
        missing: 33,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "91%",
      },

      {
        start: "2026-07-18 09:44",
        end: "2026-07-20 14:02",
        duration: 52.3,
        missing: 63,
        classification: "NO MATCHING OUTAGE EVENT",
        coverage: "0%",
      },

      {
        start: "2026-07-22 13:18",
        end: "2026-07-22 17:04",
        duration: 3.8,
        missing: 5,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "94%",
      },
    ],
  },


  // ==========================================================
  // METER 2
  // ==========================================================

  {
    msn: "299981482",
    ref: "REF-8842-C",
    location: "Lahore East",
    feeder: "Lahore East Feeder",
    status: "Needs review",
    statusType: "review",

    gaps: [
      {
        start: "2026-07-03 04:10",
        end: "2026-07-04 00:16",
        duration: 20.1,
        missing: 24,
        classification: "NO MATCHING OUTAGE EVENT",
        coverage: "0%",
      },

      {
        start: "2026-07-08 12:20",
        end: "2026-07-08 18:45",
        duration: 6.4,
        missing: 8,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "92%",
      },

      {
        start: "2026-07-15 07:30",
        end: "2026-07-17 03:36",
        duration: 44.1,
        missing: 53,
        classification: "NO MATCHING OUTAGE EVENT",
        coverage: "0%",
      },
    ],
  },


  // ==========================================================
  // METER 3
  // ==========================================================

  {
    msn: "2999819934",
    ref: "REF-2218-B",
    location: "Gulberg",
    feeder: "Gulberg Feeder",
    status: "Aligns with outage",
    statusType: "outage",

    gaps: [
      {
        start: "2026-07-04 10:20",
        end: "2026-07-04 16:20",
        duration: 6,
        missing: 7,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "95%",
      },

      {
        start: "2026-07-12 14:20",
        end: "2026-07-13 02:32",
        duration: 12.2,
        missing: 15,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "89%",
      },
    ],
  },


  // ==========================================================
  // METER 4
  // ==========================================================

  {
    msn: "2999812211",
    ref: "REF-2218-B",
    location: "Model Town",
    feeder: "Model Town Feeder",
    status: "Aligns with outage",
    statusType: "outage",

    gaps: [
      {
        start: "2026-07-06 14:20",
        end: "2026-07-06 21:08",
        duration: 6.8,
        missing: 8,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "94%",
      },

      {
        start: "2026-07-18 09:00",
        end: "2026-07-18 17:10",
        duration: 8.2,
        missing: 10,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "91%",
      },
    ],
  },


  // ==========================================================
  // METER 5
  // ==========================================================

  {
    msn: "2999815228",
    ref: "REF-5528-D",
    location: "Shahdara",
    feeder: "Shahdara Feeder",
    status: "Needs review",
    statusType: "review",

    gaps: [
      {
        start: "2026-07-10 02:00",
        end: "2026-07-11 14:30",
        duration: 36.5,
        missing: 44,
        classification: "NO MATCHING OUTAGE EVENT",
        coverage: "0%",
      },
    ],
  },


  // ==========================================================
  // METER 6
  // ==========================================================

  {
    msn: "2999811198",
    ref: "REF-1198-A",
    location: "Mughalpura",
    feeder: "Mughalpura Feeder",
    status: "Needs review",
    statusType: "review",

    gaps: [
      {
        start: "2026-07-14 03:10",
        end: "2026-07-15 03:46",
        duration: 24.6,
        missing: 30,
        classification: "NO MATCHING OUTAGE EVENT",
        coverage: "0%",
      },
    ],
  },


  // ==========================================================
  // METER 7
  // ==========================================================

  {
    msn: "299981445",
    ref: "REF-4450-B",
    location: "Samanabad",
    feeder: "Samanabad Feeder",
    status: "Aligns with outage",
    statusType: "outage",

    gaps: [
      {
        start: "2026-07-20 08:00",
        end: "2026-07-20 21:12",
        duration: 13.2,
        missing: 16,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "90%",
      },
    ],
  },


  // ==========================================================
  // METER 8
  // ==========================================================

  {
    msn: "2999811871",
    ref: "REF-1871-C",
    location: "Ichhra",
    feeder: "Ichhra Feeder",
    status: "Aligns with outage",
    statusType: "outage",

    gaps: [
      {
        start: "2026-07-21 10:00",
        end: "2026-07-21 18:06",
        duration: 8.1,
        missing: 10,
        classification: "ALIGNS WITH POWER OUTAGE",
        coverage: "93%",
      },
    ],
  },
];


// ============================================================
// HELPER: ALL GAPS
// ============================================================

export const getAllGaps = () => {
  return meters.flatMap((meter) =>
    meter.gaps.map((gap) => ({
      ...gap,

      msn: meter.msn,
      ref: meter.ref,
      location: meter.location,
      feeder: meter.feeder,
    }))
  );
};


// ============================================================
// STATE A — SUMMARY
// ============================================================

export const getSummaryData = () => {
  const allGaps = getAllGaps();

  const alignsWithOutage = allGaps.filter(
    (gap) =>
      gap.classification.includes("POWER OUTAGE")
  ).length;

  const needsReview = allGaps.filter(
    (gap) =>
      gap.classification.includes("NO MATCHING")
  ).length;

  const suspiciousMeters = new Set(
    allGaps
      .filter((gap) =>
        gap.classification.includes("NO MATCHING")
      )
      .map((gap) => gap.msn)
  );

  return {
    metersAnalyzed: meters.length,

    totalGaps: allGaps.length,

    alignsWithOutage,

    needsReview,

    suspiciousDays: suspiciousMeters.size,
  };
};


// ============================================================
// STATE B — FIND METER
// ============================================================

export const getMeterByMSN = (msn) => {
  if (!msn) {
    return null;
  }

  const query = String(msn)
    .trim()
    .toLowerCase();

  return (
    meters.find(
      (meter) =>
        meter.msn.toLowerCase() === query ||
        meter.ref.toLowerCase() === query
    ) || null
  );
};


// ============================================================
// STATE B — METER SUMMARY
// ============================================================

export const getMeterSummary = (meter) => {
  if (!meter) {
    return null;
  }

  const totalGaps = meter.gaps.length;

  const aligns = meter.gaps.filter(
    (gap) =>
      gap.classification.includes("POWER OUTAGE")
  ).length;

  const needsReview = meter.gaps.filter(
    (gap) =>
      gap.classification.includes("NO MATCHING")
  ).length;

  const longestGap = meter.gaps.length
    ? Math.max(
        ...meter.gaps.map(
          (gap) => Number(gap.duration)
        )
      )
    : 0;

  const lowCoverage = meter.gaps.filter(
    (gap) => {
      const coverage = Number(
        String(gap.coverage).replace("%", "")
      );

      return coverage < 50;
    }
  ).length;

  return {
    totalGaps,

    needsReview,

    aligns,

    lowCoverage,

    longestGap: longestGap.toFixed(1),
  };
};


// ============================================================
// STATE A — TABLE ENTRIES
// ============================================================

export const getMeterEntries = () => {
  return getAllGaps().map((gap) => ({
    msn: gap.msn,

    ref: gap.ref,

    gapStart: gap.start,

    gapEnd: gap.end,

    hours: Number(gap.duration).toFixed(1),

    status: gap.classification.includes(
      "NO MATCHING"
    )
      ? "Needs review"
      : "Aligns with outage",

    statusType: gap.classification.includes(
      "NO MATCHING"
    )
      ? "review"
      : "outage",
  }));
};


// ============================================================
// STATE A — LONGEST GAPS
// ============================================================

export const getLongestGaps = () => {
  return getAllGaps()
    .map((gap) => ({
      meter: gap.msn,

      hours: Number(gap.duration),
    }))
    .sort(
      (a, b) => b.hours - a.hours
    )
    .slice(0, 8);
};


// ============================================================
// STATE A — ATTENTION ITEMS
// ============================================================

export const getAttentionItems = () => {
  const allGaps = getAllGaps();

  const longest = [...allGaps].sort(
    (a, b) => b.duration - a.duration
  )[0];

  const reviewCount = allGaps.filter(
    (gap) =>
      gap.classification.includes("NO MATCHING")
  ).length;

  return [
    {
      type: "danger",

      title: longest
        ? `Longest unexplained gap: ${longest.duration} hrs`
        : "No unexplained gaps detected",

      meter: longest
        ? `MSN ${longest.msn}`
        : "—",
    },

    {
      type: "danger",

      title: `${reviewCount} gaps require investigation`,

      meter: "Review queue",
    },

    {
      type: "warning",

      title:
        "Review gaps should be checked against event logs",

      meter: "Grid monitoring",
    },

    {
      type: "info",

      title:
        `${meters.length} meters included in current analysis`,

      meter: "Analysis scope",
    },
  ];
};


// ============================================================
// STATE B — GAP DURATION DISTRIBUTION
// ============================================================

export const getDurationDistribution = (meter) => {
  if (!meter) {
    return [];
  }

  const buckets = {
    "<1h": 0,
    "1–4h": 0,
    "4–12h": 0,
    "12–24h": 0,
    ">24h": 0,
  };

  meter.gaps.forEach((gap) => {
    const hours = Number(gap.duration);

    if (hours < 1) {
      buckets["<1h"]++;
    } else if (hours < 4) {
      buckets["1–4h"]++;
    } else if (hours < 12) {
      buckets["4–12h"]++;
    } else if (hours < 24) {
      buckets["12–24h"]++;
    } else {
      buckets[">24h"]++;
    }
  });

  return [
    {
      label: "<1h",
      value: buckets["<1h"],
      color: "#1687e8",
    },

    {
      label: "1–4h",
      value: buckets["1–4h"],
      color: "#1687e8",
    },

    {
      label: "4–12h",
      value: buckets["4–12h"],
      color: "#c3212b",
    },

    {
      label: "12–24h",
      value: buckets["12–24h"],
      color: "#c3212b",
    },

    {
      label: ">24h",
      value: buckets[">24h"],
      color: "#a65a16",
    },
  ];
};


// ============================================================
// STATE B — COVERAGE POINTS
// ============================================================

export const getCoveragePoints = (meter) => {
  if (!meter) {
    return [];
  }

  return meter.gaps.map(
    (gap, index) => ({
      x: Number(gap.duration),

      y: Number(
        String(gap.coverage)
          .replace("%", "")
      ),

      type:
        gap.classification.includes(
          "NO MATCHING"
        )
          ? "review"
          : "aligns",

      index,
    })
  );
};


// ============================================================
// STATE B — TIMELINE
// ============================================================

export const getTimeline = (meter) => {
  if (!meter) {
    return [];
  }

  return meter.gaps.map(
    (gap, index) => ({
      day: Math.min(
        29,
        index * 4 + 1
      ),

      type:
        gap.classification.includes(
          "NO MATCHING"
        )
          ? "review"
          : "aligns",
    })
  );
};


// ============================================================
// STATE B — DIRECT GAP DATA
// ============================================================
// MeterDetail table ke liye.
// ============================================================

export const getMeterGaps = (meter) => {
  if (!meter) {
    return [];
  }

  return meter.gaps.map(
    (gap) => ({
      ...gap,

      status:
        gap.classification.includes(
          "NO MATCHING"
        )
          ? "Needs Review"
          : "Outage Aligned",

      statusType:
        gap.classification.includes(
          "NO MATCHING"
        )
          ? "review"
          : "outage",
    })
  );
};


// ============================================================
// UTILITY — CHECK IF METER EXISTS
// ============================================================

export const meterExists = (msn) => {
  return Boolean(
    getMeterByMSN(msn)
  );
};


// ============================================================
// UTILITY — GET DEFAULT METER
// ============================================================
// Agar URL mein MSN na ho to State B is meter ko use
// kar sakti hai.
// ============================================================

export const getDefaultMeter = () => {
  return meters[0] || null;
};