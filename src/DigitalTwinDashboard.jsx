import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import InteractiveEngineModel from './InteractiveEngineModel';
import TicketModal from './TicketModal';
import { exportInspectionReportPDF } from './utils/exportUtils';

const PRESETS = {
  cruise: {
    name: "Steady Cruise (Healthy)",
    cycles: [
      [7190, 0.14, 240, 39700, 37600, 0.30, 76200, 302, 74900, 990, 59200, 937],
      [7200, 0.14, 240, 39720, 37620, 0.31, 76300, 302, 75000, 991, 59300, 938],
      [7210, 0.14, 240, 39730, 37640, 0.30, 76400, 302, 75100, 992, 59400, 939],
      [7220, 0.14, 239, 39740, 37650, 0.31, 76500, 302, 75200, 993, 59500, 940],
      [7230, 0.14, 239, 39750, 37670, 0.32, 76600, 302, 75300, 994, 59600, 941]
    ]
  },
  takeoff: {
    name: "Takeoff Thrust (Maximum Stress)",
    cycles: [
      [150, 0.22, 288, 101000, 78200, 1.85, 192000, 420, 184000, 1680, 122000, 1460],
      [180, 0.23, 287, 100800, 78300, 1.86, 193000, 421, 185000, 1690, 123000, 1470],
      [210, 0.24, 287, 100600, 78400, 1.88, 194000, 422, 186000, 1700, 124000, 1480],
      [240, 0.25, 286, 100400, 78500, 1.90, 195000, 423, 187000, 1710, 125000, 1490],
      [270, 0.26, 286, 100200, 78600, 1.92, 196000, 424, 188000, 1720, 126000, 1500]
    ]
  },
  degraded: {
    name: "Thermal Degradation (High Fatigue)",
    cycles: [
      [8700, 0.33, 230, 32200, 62100, 1.35, 157000, 388, 150000, 1860, 107000, 1700],
      [8710, 0.33, 230, 32180, 62150, 1.36, 157200, 388, 150200, 1870, 107200, 1710],
      [8720, 0.33, 229, 32150, 62200, 1.37, 157400, 388, 150400, 1880, 107400, 1720],
      [8730, 0.33, 229, 32120, 62250, 1.38, 157600, 388, 150600, 1890, 107600, 1730],
      [8740, 0.33, 228, 32090, 62300, 1.40, 157800, 388, 150800, 1900, 107800, 1740]
    ]
  },
  synthetic_ood: {
    name: "Synthetic Degradation (OOD)",
    cycles: [
      [8700, 0.33, 230, 32200, 62100, 1.35, 157000, 388, 150000, 1860, 107000, 1700],
      [8710, 0.33, 230, 32180, 62150, 1.36, 157200, 388, 150200, 1870, 107200, 1850], 
      [8720, 0.33, 229, 32150, 62200, 1.37, 157400, 388, 150400, 1880, 107400, 2050], 
      [8730, 0.33, 229, 32120, 62250, 1.38, 157600, 388, 150600, 1890, 107600, 2300], 
      [8740, 0.33, 228, 32090, 62300, 1.40, 157800, 388, 150800, 1900, 107800, 2600]
    ]
  }
};

function TrajectoryChart({ preset, component, health }) {
  const startHealth = health + 0.03;
  const step = 0.007 * (preset === 'synthetic_ood' ? 4 : preset === 'degraded' ? 1.5 : 0.5);
  
  const past = [];
  for (let i = 0; i < 5; i++) {
    past.push(startHealth - i * step + (Math.sin(i) * 0.001));
  }
  past[4] = health;
  
  const forecast = [];
  const actual = [];
  const slope = (past[4] - past[0]) / 4;
  
  for (let i = 1; i <= 10; i++) {
    const f_val = health + i * slope;
    forecast.push(Math.max(0.1, f_val));
    const act_noise = (Math.sin(i * 0.8) * 0.006) - (i * 0.0015);
    actual.push(Math.max(0.1, f_val + act_noise));
  }
  
  const width = 240;
  const height = 90;
  const padding = 15;
  
  const getX = (index) => padding + (index * (width - 2 * padding)) / 14;
  const getY = (val) => {
    const minH = 0.4;
    const maxH = 1.05;
    const pct = (val - minH) / (maxH - minH);
    return height - padding - pct * (height - 2 * padding);
  };
  
  const pastPath = past.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ');
  const forecastPath = [past[4], ...forecast].map((val, idx) => `${getX(idx + 4)},${getY(val)}`).join(' ');
  const actualPath = [past[4], ...actual].map((val, idx) => `${getX(idx + 4)},${getY(val)}`).join(' ');
  
  return (
    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '1rem', marginTop: '0.5rem', pointerEvents: 'auto' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>15-CYCLE TRAJECTORY FORECAST</span>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <line x1={padding} y1={getY(0.95)} x2={width - padding} y2={getY(0.95)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2" />
        <line x1={padding} y1={getY(0.85)} x2={width - padding} y2={getY(0.85)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2" />
        <line x1={getX(4)} y1={padding} x2={getX(4)} y2={height - padding} stroke="rgba(6, 182, 212, 0.2)" strokeDasharray="3" />
        
        <polyline fill="none" stroke="var(--accent-emerald)" strokeWidth="1.5" strokeDasharray="2,2" points={actualPath} />
        <polyline fill="none" stroke="var(--accent-purple)" strokeWidth="1.5" strokeDasharray="4,3" points={forecastPath} />
        <polyline fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" points={pastPath} />
        
        <circle cx={getX(4)} cy={getY(health)} r="4" fill="var(--accent-cyan)" stroke="#030712" strokeWidth="1.5" />
        
        <text x={padding} y={height - 2} fill="var(--text-muted)" fontSize="6" fontFamily="var(--font-mono)">C1</text>
        <text x={getX(4)} y={height - 2} fill="var(--accent-cyan)" fontSize="6" fontFamily="var(--font-mono)" textAnchor="middle">C5 (NOW)</text>
        <text x={width - padding} y={height - 2} fill="var(--text-muted)" fontSize="6" fontFamily="var(--font-mono)" textAnchor="end">C15</text>
      </svg>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '2px', background: 'var(--accent-cyan)', display: 'inline-block' }} />
          <span>Past Preds</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '2px', background: 'var(--accent-purple)', borderTop: '1.5px dashed var(--accent-purple)', display: 'inline-block' }} />
          <span>Forecast</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '2px', background: 'var(--accent-emerald)', borderTop: '1.5px dotted var(--accent-emerald)', display: 'inline-block' }} />
          <span>Actual</span>
        </div>
      </div>
    </div>
  );
}

export default function DigitalTwinDashboard({ onReset }) {
  const [activePreset, setActivePreset] = useState("cruise");
  const [customCycles, setCustomCycles] = useState(JSON.parse(JSON.stringify(PRESETS.cruise.cycles)));
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [explodePercent, setExplodePercent] = useState(0);
  const [hoveredMeshName, setHoveredMeshName] = useState(null);
  const [logFeed, setLogFeed] = useState(["[SYSTEM] Twin cockpit dashboard initialized successfully."]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const addLog = (message) => {
    setLogFeed((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 3)]);
  };

  const fetchTwinTelemetry = async (payloadData = customCycles) => {
    setLoading(true);
    setError(null);
    addLog("FETCHING TELEMETRY: Querying LSTM surrogate API at http://127.0.0.1:8000/predict...");
    
    try {
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycles: payloadData })
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status code ${response.status}`);
      }
      
      const data = await response.json();
      setPredictions(data);
      addLog("SYNC COMPLETED: Telemetry inverse-scaled successfully.");
    } catch (err) {
      setError(err.message);
      addLog(`[ERROR] API pipeline connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTwinTelemetry();
  }, []);

  const handlePresetChange = (key) => {
    setActivePreset(key);
    const newCycles = JSON.parse(JSON.stringify(PRESETS[key].cycles));
    setCustomCycles(newCycles);
    addLog(`Switched preset state to: ${PRESETS[key].name}`);
    fetchTwinTelemetry(newCycles);
  };

  const debounceTimeoutRef = React.useRef(null);

  const fetchTwinTelemetryDebounced = (payloadData) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchTwinTelemetry(payloadData);
    }, 150); // 150ms debounce
  };

  const updatePhysTelemetry = (cycle) => {
    const [altitude, mach, _tamb, _pamb, rpm, fuelFlow, _p2, _t2, _p3, _t3, _p4, _t4] = cycle;
    
    // 1. Ambient conditions
    const tamb = Math.max(216.5, 288.15 - 0.0065 * altitude);
    const pamb = Math.max(10000, 101325 * Math.pow(1 - 2.25577e-5 * altitude, 5.25588));
    
    // 2. Compressor Outlet (P2, T2)
    const p2 = pamb * 1.91; // Roughly constant CPR in this dataset
    const t2 = tamb * (1.15 + 0.3 * (rpm / 78200));
    
    // 3. Combustor Outlet / Turbine Inlet (P3, T3)
    const p3 = p2 * 0.97; // Combustor pressure drop
    const t3 = t2 + 500 + 410 * fuelFlow; // Heat addition from fuel flow
    
    // 4. Turbine Outlet (P4, T4)
    const p4 = p3 * (0.85 - 0.19 * (rpm / 78200));
    const t4 = t3 - (30 + 190 * (rpm / 78200));
    
    return [
      altitude,
      mach,
      parseFloat(tamb.toFixed(1)),
      parseFloat(pamb.toFixed(0)),
      rpm,
      fuelFlow,
      parseFloat(p2.toFixed(0)),
      parseFloat(t2.toFixed(1)),
      parseFloat(p3.toFixed(0)),
      parseFloat(t3.toFixed(1)),
      parseFloat(p4.toFixed(0)),
      parseFloat(t4.toFixed(1))
    ];
  };

  const handleSliderChange = (paramIndex, value) => {
    // Propagate parameter change and physics update to all 5 cycles to keep input sequence stable
    const updated = customCycles.map((cycle) => {
      const newCycle = [...cycle];
      newCycle[paramIndex] = parseFloat(value);
      return updatePhysTelemetry(newCycle);
    });
    setCustomCycles(updated);
    fetchTwinTelemetryDebounced(updated);
  };

  const handleComponentSelect = (componentName) => {
    setSelectedComponent(componentName);
    addLog(`3D SELECT: Querying diagnostic subsystem: [${componentName.toUpperCase()}]`);
    fetchTwinTelemetry();
  };

  const handleGenerateTicket = () => {
    if (!predictions) {
      addLog("[ERROR] Cannot generate ticket: Telemetry predictions not loaded.");
      return;
    }

    const year = new Date().getFullYear();
    const ticketNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `MT-${year}-${ticketNum}`;
    
    const overallHealth = predictions.overall_health.mean;
    let priority = "Low";
    let suggestedAction = "Monitor Operational State";
    
    if (overallHealth < 0.80) {
      priority = "Critical";
      suggestedAction = "Component Replacement Recommended";
    } else if (overallHealth < 0.88) {
      priority = "High";
      suggestedAction = "Immediate Off-line Inspection";
    } else if (overallHealth < 0.95) {
      priority = "Medium";
      suggestedAction = "Schedule Maintenance Outage";
    }

    const lastCycle = customCycles[4];
    const telemetry = {
      Altitude: `${lastCycle[0]} m`,
      MachSpeed: `${lastCycle[1]} Ma`,
      AmbientTemp: `${lastCycle[2]} K`,
      AmbientPressure: `${lastCycle[3]} Pa`,
      RotorRPM: `${lastCycle[4]} RPM`,
      FuelFlow: `${lastCycle[5]} kg/s`,
      CPR: (customCycles[4][6] / customCycles[4][3]).toFixed(2),
      T2: `${lastCycle[7]} K`,
      T3: `${lastCycle[9]} K`,
      T4: `${lastCycle[11]} K`
    };

    const newTicket = {
      ticketId,
      timestamp: new Date().toLocaleString(),
      status: "Open",
      priority,
      assignedEngineer: "Unassigned",
      asset: {
        component: selectedComponent ? selectedComponent.toUpperCase() : "TJ-900 CORE",
        profile: activePreset ? activePreset.toUpperCase() : "STEADY CRUISE",
        telemetry
      },
      predictions: {
        compressorHealth: `${(predictions.compressor_health.mean * 100).toFixed(2)}%`,
        compressorHealthUncertainty: `(± ${(predictions.compressor_health.std * 100).toFixed(2)}%)`,
        combustorHealth: `${(predictions.combustor_health.mean * 100).toFixed(2)}%`,
        combustorHealthUncertainty: `(± ${(predictions.combustor_health.std * 100).toFixed(2)}%)`,
        turbineHealth: `${(predictions.turbine_health.mean * 100).toFixed(2)}%`,
        turbineHealthUncertainty: `(± ${(predictions.turbine_health.std * 100).toFixed(2)}%)`,
        overallHealth: `${(predictions.overall_health.mean * 100).toFixed(2)}%`,
        overallHealthUncertainty: `(± ${(predictions.overall_health.std * 100).toFixed(2)}%)`,
        thrust: `${(predictions.thrust.mean / 1000).toFixed(2)} kN`,
        thrustUncertainty: `(± ${(predictions.thrust.std / 1000).toFixed(2)} kN)`,
        tsfc: `${predictions.tsfc.mean.toFixed(5)} g/N/s`,
        tsfcUncertainty: `(± ${predictions.tsfc.std.toFixed(5)} g/N/s)`
      },
      aiDiagnosis: {
        severity: predictions.diagnostic_brief?.severity ?? "Normal",
        title: predictions.diagnostic_brief?.title ?? "System Operating Within Parameters",
        summary: predictions.diagnostic_brief?.summary ?? "All subsystem stats are stable.",
        recommendation: predictions.diagnostic_brief?.recommendation ?? "No corrective actions required."
      },
      suggestedAction
    };

    setActiveTicket(newTicket);
    setShowTicketModal(true);
    addLog(`[SYSTEM] Generated Maintenance Ticket: ${ticketId}`);

    setToastMessage(`✅ Maintenance Ticket ${ticketId} created successfully.`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleExportReport = () => {
    if (!predictions) {
      addLog("[ERROR] Cannot export report: Telemetry predictions not loaded.");
      return;
    }
    
    const year = new Date().getFullYear();
    const ticketNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `REP-${year}-${ticketNum}`;
    
    const overallHealth = predictions.overall_health.mean;
    let priority = "Low";
    let suggestedAction = "Monitor Operational State";
    
    if (overallHealth < 0.80) {
      priority = "Critical";
      suggestedAction = "Component Replacement Recommended";
    } else if (overallHealth < 0.88) {
      priority = "High";
      suggestedAction = "Immediate Off-line Inspection";
    } else if (overallHealth < 0.95) {
      priority = "Medium";
      suggestedAction = "Schedule Maintenance Outage";
    }

    const lastCycle = customCycles[4];
    const telemetry = {
      Altitude: `${lastCycle[0]} m`,
      MachSpeed: `${lastCycle[1]} Ma`,
      AmbientTemp: `${lastCycle[2]} K`,
      AmbientPressure: `${lastCycle[3]} Pa`,
      RotorRPM: `${lastCycle[4]} RPM`,
      FuelFlow: `${lastCycle[5]} kg/s`,
      CPR: (customCycles[4][6] / customCycles[4][3]).toFixed(2),
      T2: `${lastCycle[7]} K`,
      T3: `${lastCycle[9]} K`,
      T4: `${lastCycle[11]} K`
    };

    const tempTicket = {
      ticketId,
      timestamp: new Date().toLocaleString(),
      status: "Open",
      priority,
      assignedEngineer: "Unassigned",
      asset: {
        component: selectedComponent ? selectedComponent.toUpperCase() : "TJ-900 CORE",
        profile: activePreset ? activePreset.toUpperCase() : "STEADY CRUISE",
        telemetry
      },
      predictions: {
        compressorHealth: `${(predictions.compressor_health.mean * 100).toFixed(2)}%`,
        compressorHealthUncertainty: `(± ${(predictions.compressor_health.std * 100).toFixed(2)}%)`,
        combustorHealth: `${(predictions.combustor_health.mean * 100).toFixed(2)}%`,
        combustorHealthUncertainty: `(± ${(predictions.combustor_health.std * 100).toFixed(2)}%)`,
        turbineHealth: `${(predictions.turbine_health.mean * 100).toFixed(2)}%`,
        turbineHealthUncertainty: `(± ${(predictions.turbine_health.std * 100).toFixed(2)}%)`,
        overallHealth: `${(predictions.overall_health.mean * 100).toFixed(2)}%`,
        overallHealthUncertainty: `(± ${(predictions.overall_health.std * 100).toFixed(2)}%)`,
        thrust: `${(predictions.thrust.mean / 1000).toFixed(2)} kN`,
        thrustUncertainty: `(± ${(predictions.thrust.std / 1000).toFixed(2)} kN)`,
        tsfc: `${predictions.tsfc.mean.toFixed(5)} g/N/s`,
        tsfcUncertainty: `(± ${predictions.tsfc.std.toFixed(5)} g/N/s)`
      },
      aiDiagnosis: {
        severity: predictions.diagnostic_brief?.severity ?? "Normal",
        title: predictions.diagnostic_brief?.title ?? "System Operating Within Parameters",
        summary: predictions.diagnostic_brief?.summary ?? "All subsystem stats are stable.",
        recommendation: predictions.diagnostic_brief?.recommendation ?? "No corrective actions required."
      },
      suggestedAction
    };

    exportInspectionReportPDF(tempTicket);
    addLog(`[SYSTEM] Exported Inspection PDF Report: ${ticketId}`);
  };

  const getHealthColor = (score) => {
    if (score >= 0.95) return "var(--accent-emerald)";
    if (score >= 0.85) return "var(--accent-amber)";
    return "var(--accent-rose)";
  };

  const getHealthGradient = (score) => {
    if (score >= 0.95) return "linear-gradient(90deg, #10b981, #06b6d4)";
    if (score >= 0.85) return "linear-gradient(90deg, #f59e0b, #ef4444)";
    return "linear-gradient(90deg, #f43f5e, #991b1b)";
  };

  const getSeverityColor = (severity) => {
    const s = String(severity || '').toLowerCase();
    if (s.includes('critical')) return "var(--accent-rose)";
    if (s.includes('warning')) return "var(--accent-amber)";
    if (s.includes('advisory')) return "var(--accent-purple)";
    return "var(--accent-emerald)";
  };

  const getSeverityBg = (severity) => {
    const s = String(severity || '').toLowerCase();
    if (s.includes('critical')) return "rgba(244, 63, 94, 0.15)";
    if (s.includes('warning')) return "rgba(245, 158, 11, 0.15)";
    if (s.includes('advisory')) return "rgba(167, 139, 250, 0.15)";
    return "rgba(16, 185, 129, 0.15)";
  };

  const getActiveHealthScore = () => {
    if (!predictions || !selectedComponent) return 0;
    if (selectedComponent.includes('compressor')) return predictions.compressor_health.mean;
    if (selectedComponent.includes('combustor')) return predictions.combustor_health.mean;
    return predictions.turbine_health.mean;
  };

  const activeHealth = getActiveHealthScore();

  // Glassmorphic HUD overlay styles
  const glassStyle = {
    pointerEvents: 'auto',
    background: 'rgba(3, 7, 18, 0.40)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(6, 182, 212, 0.20)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
    borderRadius: '12px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#7c8392' }}>
      
      {/* 1. Full-bleed WebGL 3D Canvas */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1 }}>
        <Canvas camera={{ position: [5, 3, 5], fov: 45 }}>
          <ambientLight intensity={1.0} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          
          <InteractiveEngineModel 
            onSelectComponent={handleComponentSelect} 
            explosionFactor={explodePercent / 100} 
            hoveredMeshName={hoveredMeshName}
            setHoveredMeshName={setHoveredMeshName}
          />
          
          <OrbitControls 
            enablePan={true} 
            enableZoom={true} 
            minDistance={3} 
            maxDistance={15} 
            autoRotate={!selectedComponent}
            autoRotateSpeed={0.5} 
          />
          
          {/* Environment maps for high-end metallic reflections */}
          <Environment preset="night" />
        </Canvas>
      </div>

      {/* 2. Floating HUD HTML Overlays */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
        
        {/* Floating Header HUD */}
        <div 
          style={{ 
            ...glassStyle,
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '1.25rem 2.25rem',
            borderRadius: '12px'
          }}
        >
          <div>
            <span className="text-display text-cyan" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Interactive 3D Simulation Cockpit</span>
            <h1 className="text-display" style={{ fontSize: '1.5rem', fontWeight: 800, margin: '2px 0 0 0' }}>TJ-900 DIGITAL TWIN</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 'bold', minWidth: '95px' }}>EXPLODE CORE: {explodePercent}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={explodePercent}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setExplodePercent(val);
                  if (val === 100) addLog("MODEL ACTION: Exploded core layout engaged at 100%.");
                  else if (val === 0) addLog("MODEL ACTION: Restored structural assembly.");
                }}
                style={{ width: '100px', cursor: 'pointer' }}
              />
            </div>
            
            <button 
              onClick={onReset}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-primary)',
                padding: '8px 18px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '0.8rem',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-rose)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            >
              LEAVE COCKPIT →
            </button>
          </div>
        </div>

        {/* SECTION A: LEFT SIDE ONLY - PROFILE & HEALTH SCORE */}
        {selectedComponent && (
          <div 
            style={{ 
              ...glassStyle,
              position: 'absolute', 
              top: '160px', 
              left: '2rem', 
              width: '320px', 
              bottom: '226px', // Leave 24px gap above the bottom panel
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem', 
              padding: '1.75rem',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(6, 182, 212, 0.15)', paddingBottom: '0.75rem' }}>
              <div>
                <span className="text-display text-cyan" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Inspection Targets</span>
                <h2 className="text-display" style={{ fontSize: '1.3rem', margin: '2px 0 0 0', textTransform: 'uppercase' }}>{selectedComponent}</h2>
              </div>
              <button 
                onClick={() => setSelectedComponent(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  padding: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                [X]
              </button>
            </div>

            {/* Presets Profile Selector */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Simulation Profile</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.keys(PRESETS).map((key) => (
                  <button
                    key={key}
                    onClick={() => handlePresetChange(key)}
                    style={{
                      width: '100%',
                      background: activePreset === key ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.02)',
                      border: activePreset === key ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.05)',
                      color: activePreset === key ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      padding: '10px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    ⚙ {PRESETS[key].name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Predictive Health Status Score */}
            <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subsystem Condition</span>
              <div className="text-display" style={{ 
                fontSize: '2.8rem', 
                fontWeight: 900, 
                margin: '8px 0', 
                color: predictions ? getHealthColor(activeHealth) : 'var(--text-muted)' 
              }}>
                {predictions ? `${(activeHealth * 100).toFixed(1)}%` : '---'}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {predictions ? (activeHealth >= 0.95 ? 'STATUS: NOMINAL' : activeHealth >= 0.85 ? 'STATUS: CAUTION' : 'STATUS: DEGRADED') : 'AWAITING INF...'}
              </span>
            </div>
            
            {/* Trajectory Forecast Visualizer */}
            {predictions && (
              <TrajectoryChart 
                preset={activePreset} 
                component={selectedComponent} 
                health={activeHealth} 
              />
            )}
          </div>
        )}

        {/* SECTION B: RIGHT SIDE ONLY - TUNING SLIDERS & TELEMETRY */}
        {selectedComponent && (
          <div 
            style={{ 
              ...glassStyle,
              position: 'absolute', 
              top: '160px', 
              right: '2rem', 
              width: '380px', 
              bottom: '226px', // Leave 24px gap above the bottom panel
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem', 
              padding: '1.75rem',
              overflowY: 'auto'
            }}
          >
            {/* Subsystem Tuning Sliders */}
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <h3 className="text-display text-blue" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Subsystem Tuning</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.82rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Altitude</span>
                    <span className="text-cyan" style={{ fontFamily: 'var(--font-mono)' }}>{customCycles[4][0]} m</span>
                  </div>
                  <input 
                    type="range" min="0" max="12000" step="50" 
                    value={customCycles[4][0]} 
                    onChange={(e) => handleSliderChange(0, e.target.value)}
                    style={{ width: '100%', height: '4px', cursor: 'pointer' }}
                  />
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Mach Speed</span>
                    <span className="text-cyan" style={{ fontFamily: 'var(--font-mono)' }}>{customCycles[4][1]} Ma</span>
                  </div>
                  <input 
                    type="range" min="0" max="0.85" step="0.01" 
                    value={customCycles[4][1]} 
                    onChange={(e) => handleSliderChange(1, e.target.value)}
                    style={{ width: '100%', height: '4px', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Fuel Flow Rate</span>
                    <span className="text-cyan" style={{ fontFamily: 'var(--font-mono)' }}>{customCycles[4][5]} kg/s</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="2.2" step="0.05" 
                    value={customCycles[4][5]} 
                    onChange={(e) => handleSliderChange(5, e.target.value)}
                    style={{ width: '100%', height: '4px', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Rotor RPM</span>
                    <span className="text-cyan" style={{ fontFamily: 'var(--font-mono)' }}>{customCycles[4][4]} RPM</span>
                  </div>
                  <input 
                    type="range" min="30000" max="85000" step="100" 
                    value={customCycles[4][4]} 
                    onChange={(e) => handleSliderChange(4, e.target.value)}
                    style={{ width: '100%', height: '4px', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>

            {/* Subsystem Telemetry Readouts */}
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <h3 className="text-display text-emerald" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>Subsystem Telemetry</h3>
              
              <table className="tech-table" style={{ fontSize: '0.82rem' }}>
                <tbody>
                  {selectedComponent.includes('compressor') && (
                    <>
                      <tr>
                        <td className="label">Compressor Health</td>
                        <td className="value" style={{ fontWeight: 'bold', color: predictions ? getHealthColor(predictions.compressor_health.mean) : 'var(--text-muted)' }}>
                          {predictions ? (
                            <>
                              {`${(predictions.compressor_health.mean * 100).toFixed(1)}%`}
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '5px' }}>
                                (± {(predictions.compressor_health.std * 100).toFixed(2)}%)
                              </span>
                            </>
                          ) : '---'}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">Pressure Ratio (CPR)</td>
                        <td className="value" style={{ color: 'var(--accent-cyan)' }}>
                          {predictions ? (customCycles[4][6] / customCycles[4][3]).toFixed(2) : '---'} : 1
                        </td>
                      </tr>
                      <tr>
                        <td className="label">Intake Temp (T2)</td>
                        <td className="value">{customCycles[4][7]} K</td>
                      </tr>
                      <tr>
                        <td className="label">Intake Pressure (P2)</td>
                        <td className="value">{(customCycles[4][6] / 1000).toFixed(1)} kPa</td>
                      </tr>
                    </>
                  )}

                  {selectedComponent.includes('combustor') && (
                    <>
                      <tr>
                        <td className="label">Combustor Health</td>
                        <td className="value" style={{ fontWeight: 'bold', color: predictions ? getHealthColor(predictions.combustor_health.mean) : 'var(--text-muted)' }}>
                          {predictions ? (
                            <>
                              {`${(predictions.combustor_health.mean * 100).toFixed(1)}%`}
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '5px' }}>
                                (± {(predictions.combustor_health.std * 100).toFixed(2)}%)
                              </span>
                            </>
                          ) : '---'}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">Heat Addition (dT)</td>
                        <td className="value" style={{ color: 'var(--accent-purple)' }}>
                          {predictions ? `+${(customCycles[4][9] - customCycles[4][7]).toFixed(1)} K` : '---'}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">Pre-combustion Temp (T3)</td>
                        <td className="value">{customCycles[4][9]} K</td>
                      </tr>
                      <tr>
                        <td className="label">Exhaust Temp (T4)</td>
                        <td className="value">{customCycles[4][11]} K</td>
                      </tr>
                    </>
                  )}

                  {selectedComponent.includes('turbine') && (
                    <>
                      <tr>
                        <td className="label">Turbine Health</td>
                        <td className="value" style={{ fontWeight: 'bold', color: predictions ? getHealthColor(predictions.turbine_health.mean) : 'var(--text-muted)' }}>
                          {predictions ? (
                            <>
                              {`${(predictions.turbine_health.mean * 100).toFixed(1)}%`}
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '5px' }}>
                                (± {(predictions.turbine_health.std * 100).toFixed(2)}%)
                              </span>
                            </>
                          ) : '---'}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">Expansion Ratio (TER)</td>
                        <td className="value" style={{ color: 'var(--accent-emerald)' }}>
                          {predictions ? (customCycles[4][8] / customCycles[4][10]).toFixed(2) : '---'} : 1
                        </td>
                      </tr>
                      <tr>
                        <td className="label">Exhaust Gas Temp (T4)</td>
                        <td className="value">{customCycles[4][11]} K</td>
                      </tr>
                      <tr>
                        <td className="label">Thrust Force Output</td>
                        <td className="value" style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {predictions ? (
                            <>
                              {`${(predictions.thrust.mean / 1000).toFixed(2)} kN`}
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '5px' }}>
                                (± ${(predictions.thrust.std / 1000).toFixed(2)} kN)
                              </span>
                            </>
                          ) : '---'}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION C: BOTTOM PANEL - THREE-COLUMN CSS GRID LAYOUT */}
        {selectedComponent && (
          <div 
            style={{ 
              position: 'absolute', 
              bottom: '2rem', 
              left: '2rem', // Align with Left Sidebar
              right: '2rem', // Align with Right Sidebar
              display: 'grid', 
              gridTemplateColumns: '20fr 48fr 32fr', // Width allocation: 20% Health, 48% AI Advisory, 32% Logger
              gap: '24px', // Consistent horizontal spacing 20-24px
              height: '170px',
              pointerEvents: 'none' // Allow canvas clicks in spacing gaps
            }}
          >
            {/* Column 1: Active Health Matrix (Left, 20% width) */}
            <div 
              style={{ 
                ...glassStyle,
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                height: '100%'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', justifyContent: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-display text-cyan" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Active Health Matrix</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {predictions ? `INDEX: ${activeHealth.toFixed(4)}` : 'DISCONNECTED'}
                  </span>
                </div>
                <div style={{ position: 'relative', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                  <div style={{ 
                    height: '100%', 
                    background: predictions ? getHealthGradient(activeHealth) : 'transparent', 
                    width: predictions ? `${(activeHealth * 100)}%` : 0, 
                    transition: 'width 0.5s ease-out' 
                  }} />
                  {/* Visually Widening Uncertainty Band Overlay */}
                  {predictions && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      height: '100%',
                      background: 'rgba(255, 255, 255, 0.25)',
                      left: `${Math.max(0, (activeHealth - predictions.overall_health.std) * 100)}%`,
                      width: `${predictions.overall_health.std * 200}%`,
                      transition: 'all 0.5s ease-out',
                      borderLeft: '1px solid rgba(255,255,255,0.8)',
                      borderRight: '1px solid rgba(255,255,255,0.8)'
                    }} />
                  )}
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  {predictions ? `(± ${(predictions.overall_health.std * 100).toFixed(2)}% Confidence Interval)` : '(± 1.75% Confidence Interval)'}
                </span>
              </div>
            </div>

            {/* Column 2: AI Diagnostic Advisory (Center, 48% width) */}
            <div 
              style={{ 
                ...glassStyle,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                height: '100%'
              }}
            >
              {predictions?.diagnostic_brief ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'space-between', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="text-display text-purple" style={{ fontSize: '0.72rem', fontWeight: 600 }}>AI Diagnostic Advisory</span>
                      <span style={{ 
                        fontSize: '0.6rem', 
                        fontWeight: 'bold', 
                        padding: '1px 5px', 
                        borderRadius: '3px', 
                        textTransform: 'uppercase',
                        background: getSeverityBg(predictions.diagnostic_brief.severity),
                        color: getSeverityColor(predictions.diagnostic_brief.severity),
                        border: `1px solid ${getSeverityColor(predictions.diagnostic_brief.severity)}40`
                      }}>
                        {predictions.diagnostic_brief.severity}
                      </span>
                    </div>
                    
                    {/* Action buttons next to the header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
                      <button 
                        onClick={handleGenerateTicket} 
                        title="Generate Maintenance Ticket"
                        style={{
                          background: 'rgba(167, 139, 250, 0.1)',
                          border: '1px solid rgba(167, 139, 250, 0.3)',
                          color: 'var(--accent-purple)',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.6rem',
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(167, 139, 250, 0.25)';
                          e.currentTarget.style.borderColor = 'var(--accent-purple)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.3)';
                        }}
                      >
                        🎫 TICKET
                      </button>
                      <button 
                        onClick={handleExportReport} 
                        title="Export Inspection Report"
                        style={{
                          background: 'rgba(6, 182, 212, 0.1)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          color: 'var(--accent-cyan)',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.6rem',
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(6, 182, 212, 0.25)';
                          e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                        }}
                      >
                        📄 PDF
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '1px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {predictions.diagnostic_brief.title}
                    </h4>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.25', margin: 0 }}>
                      {predictions.diagnostic_brief.summary}
                    </p>
                  </div>

                  <div style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.01)', borderLeft: `3px solid ${getSeverityColor(predictions.diagnostic_brief.severity)}`, borderRadius: '0 4px 4px 0' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '1px' }}>Recommendation</span>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                      {predictions.diagnostic_brief.recommendation}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Awaiting AI Diagnostic Input...
                </div>
              )}
            </div>

            {/* Column 3: API Terminal Logger Console (Right, 32% width) */}
            <div 
              style={{ 
                ...glassStyle,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '1.25rem 1.5rem',
                height: '100%',
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.7rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(6, 182, 212, 0.15)', paddingBottom: '3px', marginBottom: '4px', width: '100%' }}>
                <span className="text-display text-cyan" style={{ fontSize: '0.7rem', fontWeight: 600 }}>API Terminal Logger Console</span>
                {loading && <span style={{ color: 'var(--accent-cyan)', animation: 'pulse 1s infinite' }}>[SYNCING...]</span>}
              </div>
              <div style={{ height: '70px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', color: 'var(--text-secondary)', width: '100%' }}>
                {logFeed.map((log, index) => (
                  <div key={index} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Toast Success Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(16, 185, 129, 0.95)',
          backdropFilter: 'blur(8px)',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 100000,
          fontSize: '0.85rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          pointerEvents: 'auto',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Ticket Preview Modal (Jira / ServiceNow Style) */}
      {showTicketModal && (
        <TicketModal 
          ticket={activeTicket} 
          onClose={() => setShowTicketModal(false)} 
        />
      )}

    </div>
  );
}
