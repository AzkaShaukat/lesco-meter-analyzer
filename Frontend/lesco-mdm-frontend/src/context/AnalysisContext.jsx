import React, { createContext, useState, useContext } from 'react';
import { loadJob } from '../services/jobStore';

const AnalysisContext = createContext();

export const AnalysisProvider = ({ children }) => {
  // Restore the analysis type from the saved job so locked sidebar tabs
  // stay locked after a page reload. Falls back to 'full' (all unlocked)
  // when there is no analysis yet.
  const [analysisType, setAnalysisType] = useState(
    () => loadJob()?.analysisType || 'full'
  );

  return (
    <AnalysisContext.Provider value={{ analysisType, setAnalysisType }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => useContext(AnalysisContext);