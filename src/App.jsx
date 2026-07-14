import React, { useState, useCallback } from 'react';
import ScrollSequence from './ScrollSequence';
import TelemetryOverlay from './TelemetryOverlay';
import DigitalTwinDashboard from './DigitalTwinDashboard';

function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' or 'dashboard'
  const [scrollProgress, setScrollProgress] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);

  // Callback from ScrollSequence on each scroll frame update
  const handleScrollProgress = useCallback((progress, index) => {
    setScrollProgress(progress);
    setFrameIndex(index);
  }, []);

  const handleUnlockDashboard = useCallback(() => {
    setCurrentView('dashboard');
    // Scroll back to top so dashboard view doesn't start scrolled down
    window.scrollTo(0, 0);
  }, []);

  const handleResetToLanding = useCallback(() => {
    setCurrentView('landing');
    // Set scroll back to top of landing page
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  }, []);

  return (
    <>
      {/* Decorative Blueprint/Grid Background */}
      <div className="grid-bg" />

      {currentView === 'landing' ? (
        <div key="landing-view" style={{ width: '100%', minHeight: '100vh' }}>
          {/* Main Canvas Scroll Sequence Scrubber */}
          <ScrollSequence 
            onScrollProgress={handleScrollProgress} 
            onUnlockDashboard={handleUnlockDashboard} 
            scrollProgress={scrollProgress}
          />

          {/* Glassmorphic digital twin UI Overlay */}
          <TelemetryOverlay progress={scrollProgress} frameIndex={frameIndex} />
        </div>
      ) : (
        <div key="dashboard-view" className="fade-in">
          {/* Dynamic Cockpit Dashboard Panel */}
          <DigitalTwinDashboard onReset={handleResetToLanding} />
        </div>
      )}
    </>
  );
}

export default App;
