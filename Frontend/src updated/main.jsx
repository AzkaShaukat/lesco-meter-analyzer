import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './router';
import { AnalysisProvider } from './context/AnalysisContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AnalysisProvider>
      <RouterProvider router={router} />
    </AnalysisProvider>
  </React.StrictMode>
);