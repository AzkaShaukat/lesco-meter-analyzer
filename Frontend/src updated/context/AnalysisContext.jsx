import React, { createContext, useState, useContext } from 'react';

const AnalysisContext = createContext();

export const AnalysisProvider = ({ children }) => {
  // Default to 'full' so all tabs are unlocked when no analysis is selected
  const [analysisType, setAnalysisType] = useState('full');

  return (
    <AnalysisContext.Provider value={{ analysisType, setAnalysisType }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => useContext(AnalysisContext);