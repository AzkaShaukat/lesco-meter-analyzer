import { createBrowserRouter } from "react-router-dom";

import LandingPage from "./pages/LandingPage/LandingPage";
import FullReport from "./pages/FullReport/FullReport";
import MeterDetail from "./pages/MeterDetail/MeterDetail";
import GapDetection from "./pages/GapDetection/GapDetection";
import GapResult from "./pages/GapResult/GapResult";
import DailyTrend from "./pages/DailyTrend/DailyTrend";
import DailyResult from "./pages/DailyResult/DailyResult";
import PeakLoad from "./pages/PeakLoad/PeakLoad";
import HelpPage from "./pages/Help/HelpPage";
import Worklist from "./pages/Worklist/Worklist";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/worklist",
    element: <Worklist />,
  },
  {
    path: "/full-report",
    element: <FullReport />,
  },
  {
    path: "/meter-detail",
    element: <MeterDetail />,
  },
  {
    path: "/gap-detection",
    element: <GapDetection />,
  },
  {
    path: "/gap-result",
    element: <GapResult />,
  },
  // Outage correlation = the fleet gaps + outage-event view (same as Gap detection).
  {
    path: "/outage-correlation",
    element: <GapDetection />,
  },
  {
    path: "/daily-trend",
    element: <DailyTrend />,
  },
  {
    path: "/daily-result",
    element: <DailyResult />,
  },
  {
    path: "/peak-load",
    element: <PeakLoad />,
  },

  {
    path: "/help",
    element: <HelpPage />,
  },
]);

export default router;