import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './router';
import { AnalysisProvider } from './context/AnalysisContext';
import { MobileNavProvider } from './context/MobileNavContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AnalysisProvider>
      {/* shares the phone sidebar-drawer state between TopBar and Sidebar,
          which every page renders as siblings rather than nested */}
      <MobileNavProvider>
        <RouterProvider router={router} />
      </MobileNavProvider>
    </AnalysisProvider>
  </React.StrictMode>
);