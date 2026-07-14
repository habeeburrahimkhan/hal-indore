import React from 'react';

export default function TelemetryOverlay({ progress, frameIndex }) {
  // Compute dynamic stats based on scroll progress (simulating engine teardown state)
  const isAssembled = progress < 0.05;
  const rpm = isAssembled ? 14200 : Math.max(0, Math.round(14200 * (1 - progress * 1.2)));
  const egt = isAssembled ? 680 : Math.max(35, Math.round(680 - progress * 620)); // Exhaust gas temp C
  const pressureRatio = isAssembled ? 12.4 : Math.max(1.0, parseFloat((12.4 - progress * 12.0).toFixed(1)));
  const thrust = isAssembled ? 85.2 : Math.max(0.0, parseFloat((85.2 * (1 - progress * 1.5)).toFixed(1)));

  // Active stage name based on progress
  let activeStage = "Intake System";
  if (progress > 0.25 && progress <= 0.6) activeStage = "Axial Compressor";
  else if (progress > 0.6 && progress <= 0.85) activeStage = "High-Pressure Turbine";
  else if (progress > 0.85) activeStage = "Exhaust Nozzle & Diffuser";

  return (
    <div className="ui-layer">
      
      {/* 1. FIXED HUD OVERLAYS */}
      {/* HUD Top Bar */}
      <header className="hud-fixed hud-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="telemetry-badge badge-active">
            <span className="status-dot" />
            <span>ONLINE</span>
          </div>
          <span className="text-display" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            TJ-900 twin // CORE ASSEMBLY
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div>STAGE: <span className="text-cyan" style={{ fontWeight: 600 }}>{activeStage.toUpperCase()}</span></div>
        </div>
      </header>

      {/* HUD Progress Sidebar */}
      <aside className="hud-fixed hud-progress-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span className="text-display text-cyan" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            {Math.round(progress * 100)}%
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Explode Phase
          </span>
        </div>
        
        {/* Step dots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginRight: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: progress >= 0.0 ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.2)', transition: 'background 0.3s' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: progress >= 0.25 ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.2)', transition: 'background 0.3s' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: progress >= 0.6 ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.2)', transition: 'background 0.3s' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: progress >= 0.85 ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.2)', transition: 'background 0.3s' }} />
        </div>
      </aside>

      {/* HUD Bottom Bar */}
      <footer className="hud-fixed hud-bottom-bar">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          SYSTEM DIAGNOSTICS: FULL READOUT SECURE
        </span>
      </footer>


      {/* 2. SCROLLABLE TELEMETRY SECTIONS */}
      
      {/* SECTION 1: HERO SECTION */}
      <section id="hero" className="telemetry-section">
        <div className="section-content">
          <div>
            <span className="text-display text-cyan" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Aerospace Digital Twin
            </span>
            <h1 className="text-display" style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1.1, margin: '0.5rem 0 1.5rem 0' }}>
              Turbojet <br />Disassembly
            </h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem', maxWidth: '450px' }}>
              Interactive digital mock-up and structural analysis of a high-bypass turbojet engine. Scroll to disintegrate component housings and examine turbine core geometry.
            </p>
            <div className="mouse-scroll-indicator">
              <div className="mouse-scroll-wheel" />
            </div>
          </div>
          
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 className="text-display text-blue" style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>
              Core Telemetry Feed
            </h3>
            <table className="tech-table">
              <tbody>
                <tr>
                  <td className="label">Twin Engine Status</td>
                  <td className="value" style={{ color: 'var(--accent-emerald)' }}>SYNCED</td>
                </tr>
                <tr>
                  <td className="label">Rotor Core RPM</td>
                  <td className="value">{rpm.toLocaleString()} RPM</td>
                </tr>
                <tr>
                  <td className="label">Exhaust Gas Temp</td>
                  <td className="value">{egt}°C</td>
                </tr>
                <tr>
                  <td className="label">Total Thrust Output</td>
                  <td className="value">{thrust} kN</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 2: COMPRESSOR DATA */}
      <section id="compressor" className="telemetry-section">
        <div className="section-content">
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <span className="text-display text-blue" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Section 02 // Intake & Flow
            </span>
            <h2 className="text-display" style={{ fontSize: '1.8rem', margin: '0.5rem 0 1.25rem 0' }}>
              Compressor Stage
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              The multi-stage axial compressor boosts incoming air pressure by a factor of {pressureRatio}:1. Disassembly reveals the rotor blade profiles designed for high aerodynamic efficiency.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pressure Ratio</div>
                <div className="text-display" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--accent-blue)' }}>
                  {pressureRatio} : 1
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mass Flow Rate</div>
                <div className="text-display" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--accent-cyan)' }}>
                  {isAssembled ? '78.5' : Math.max(0, parseFloat((78.5 * (1 - progress)).toFixed(1)))} kg/s
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <span className="text-display text-cyan" style={{ fontSize: '0.8rem' }}>Structural Analysis</span>
            <h3 className="text-display" style={{ fontSize: '1.5rem', margin: '0.5rem 0 1rem 0' }}>Blade Disintegration</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
              By expanding the compressor casing, we can inspect individual titanium blades for micro-fractures, hot gas erosion, and blade tip clearance. This view exposes internal structural columns and hydraulic fuel delivery rings.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3: TURBINE ANALYTICS */}
      <section id="turbine" className="telemetry-section">
        <div className="section-content">
          <div>
            <span className="text-display text-purple" style={{ fontSize: '0.8rem' }}>Section 03 // Core Power</span>
            <h2 className="text-display" style={{ fontSize: '1.8rem', margin: '0.5rem 0 1rem 0' }}>Turbine & Combustion</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
              Operating at critical heat levels, the high-pressure turbine extracts energy from the combustion gases to drive the compressor stage. Single-crystal superalloy blades are cooled via internal airflow paths.
            </p>
          </div>
          
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <h3 className="text-display text-purple" style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>
              Thermal Profiles
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Combustor Core Temp</span>
                  <span className="text-purple" style={{ fontWeight: 600 }}>{egt + 250}°C</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))', width: `${Math.min(100, Math.max(0, ((egt + 250) / 1000) * 100))}%`, borderRadius: '3px', transition: 'width 0.1s ease-out' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Blade Stress Limit</span>
                  <span className="text-cyan" style={{ fontWeight: 600 }}>{isAssembled ? '94%' : Math.max(0, Math.round(94 - progress * 94))}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-cyan))', width: `${isAssembled ? 94 : Math.max(0, 94 - progress * 94)}%`, borderRadius: '3px', transition: 'width 0.1s ease-out' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: DIAGNOSTICS & SUMMARY */}
      <section id="diagnostics" className="telemetry-section" style={{ minHeight: '100vh' }}>
        <div className="section-content" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', textAlign: 'center' }}>
          <div className="glass-panel" style={{ padding: '3.5rem 2rem', maxWidth: '650px', width: '100%' }}>
            <span className="text-display text-emerald" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Twin Engine Disassembled
            </span>
            <h2 className="text-display" style={{ fontSize: '2rem', marginBottom: '1.25rem' }}>
              Full Exploded View
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
              All main components (Inlet, Compressor, Combustor, Turbine, Exhaust) are now fully exposed. Scroll to the absolute bottom to unlock the live interactive digital twin simulation panel.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
