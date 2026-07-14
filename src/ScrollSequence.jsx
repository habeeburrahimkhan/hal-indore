import React, { useEffect, useRef, useState } from 'react';

const FRAME_COUNT = 293;

// Helper to format frame numbers: e.g., 1 -> '001', 12 -> '012', 123 -> '123'
const getFrameUrl = (index) => {
  const num = String(index).padStart(3, '0');
  return `/ezgif-frame-${num}.jpg`;
};

export default function ScrollSequence({ onScrollProgress, onUnlockDashboard, scrollProgress }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  
  // Track images ref to avoid stale closure in event listener
  const imagesRef = useRef([]);

  // Preload images
  useEffect(() => {
    let loaded = 0;
    const loadedImages = [];

    const handleImageLoad = (img, index) => {
      loadedImages[index] = img;
      loaded++;
      setLoadedCount(loaded);
      
      if (loaded === FRAME_COUNT) {
        setImages(loadedImages);
        imagesRef.current = loadedImages;
        setLoading(false);
        // Draw the initial frame once loaded
        requestAnimationFrame(() => renderFrame(0));
      }
    };

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);
      img.onload = () => handleImageLoad(img, i - 1);
      img.onerror = () => {
        // Fallback for failed frame loads
        console.warn(`Failed to load frame ${i}`);
        handleImageLoad(img, i - 1);
      };
    }
  }, []);

  // Frame rendering logic
  const renderFrame = (index) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imagesRef.current[index];

    if (!canvas || !ctx || !img) return;

    // Set canvas dimensions to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Cover algorithm for canvas (similar to object-fit: cover)
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const imgWidth = img.width || 800; // fallback if image hasn't loaded dimensions
    const imgHeight = img.height || 450;
    
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight, dx, dy;

    if (imgRatio > canvasRatio) {
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * imgRatio;
      dx = (canvasWidth - drawWidth) / 2;
      dy = 0;
    } else {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imgRatio;
      dx = 0;
      dy = (canvasHeight - drawHeight) / 2;
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
    setCurrentFrame(index);
  };

  // Listen for scroll
  useEffect(() => {
    if (loading) return;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollTop = window.scrollY;
      
      // Calculate percentage scrolled [0, 1]
      const scrollFraction = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      
      // Calculate corresponding frame index
      const frameIndex = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.floor(scrollFraction * FRAME_COUNT))
      );

      // Request animation frame for performance
      requestAnimationFrame(() => {
        renderFrame(frameIndex);
      });

      // Update parent telemetry callback
      if (onScrollProgress) {
        onScrollProgress(scrollFraction, frameIndex);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    // Initial draw
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [loading, onScrollProgress]);

  return (
    <div 
      ref={containerRef} 
      className="scroll-sequence-container"
      style={{ height: '500vh' }} // Very tall page to allow scrolling
    >
      <canvas ref={canvasRef} className="scroll-sequence-canvas" />
      <div className="canvas-overlay-darken" />

      {/* Dynamic unlock button at > 98% scroll progress */}
      {scrollProgress > 0.98 && (
        <div 
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            pointerEvents: 'auto',
          }}
        >
          <button 
            onClick={onUnlockDashboard}
            className="fade-in"
            style={{
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald))',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#030509', // Dark text on bright background for high contrast readability
              padding: '16px 38px',
              borderRadius: '8px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              fontSize: '1.05rem',
              letterSpacing: '0.08em',
              boxShadow: '0 0 25px rgba(6, 182, 212, 0.5), 0 0 50px rgba(16, 185, 129, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 0 35px rgba(6, 182, 212, 0.7), 0 0 70px rgba(16, 185, 129, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 25px rgba(6, 182, 212, 0.5), 0 0 50px rgba(16, 185, 129, 0.3)';
            }}
          >
            ENTER TWIN DASHBOARD
          </button>
        </div>
      )}

      {/* Futuristic Preloader Overlay */}
      {loading && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'var(--bg-color)',
            zIndex: 999,
            gap: '1.5rem',
          }}
        >
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', minWidth: '400px' }}>
            <h2 className="text-display text-cyan" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
              Initializing Digital Twin
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
              PRELOADING TURBOJET ENGINE GEOMETRY DATA
            </p>
            
            {/* Progress bar container */}
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
              <div 
                style={{ 
                  height: '100%', 
                  background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-cyan))', 
                  width: `${(loadedCount / FRAME_COUNT) * 100}%`,
                  transition: 'width 0.1s ease-out'
                }} 
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>FRAME: {loadedCount}/{FRAME_COUNT}</span>
              <span>{Math.round((loadedCount / FRAME_COUNT) * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
