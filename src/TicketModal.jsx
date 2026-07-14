import React from 'react';
import { copyTicketDetails, downloadTicketJSON, exportInspectionReportPDF } from './utils/exportUtils';

export default function TicketModal({ ticket, onClose }) {
  if (!ticket) return null;

  const severity = ticket.aiDiagnosis.severity;

  // Style colors for the modal based on severity
  const getSevColor = (sev) => {
    const s = String(sev || '').toLowerCase();
    if (s.includes('critical')) return "var(--accent-rose)";
    if (s.includes('warning')) return "var(--accent-amber)";
    if (s.includes('advisory')) return "var(--accent-purple)";
    return "var(--accent-emerald)";
  };

  const getSevBg = (sev) => {
    const s = String(sev || '').toLowerCase();
    if (s.includes('critical')) return "rgba(244, 63, 94, 0.15)";
    if (s.includes('warning')) return "rgba(245, 158, 11, 0.15)";
    if (s.includes('advisory')) return "rgba(167, 139, 250, 0.15)";
    return "rgba(16, 185, 129, 0.15)";
  };

  const activeColor = getSevColor(severity);
  const activeBg = getSevBg(severity);

  // Glass modal overlay
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(3, 5, 9, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    pointerEvents: 'auto'
  };

  // Jira-glass style modal card
  const cardStyle = {
    background: 'rgba(10, 15, 30, 0.85)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(6, 182, 212, 0.05)',
    borderRadius: '12px',
    width: '940px',
    height: '660px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-primary)'
  };

  const sidebarLabelStyle = {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: '4px'
  };

  const sidebarValueStyle = {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        
        {/* MODAL HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
              {ticket.ticketId}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                STATUS: {ticket.status.toUpperCase()}
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', background: activeBg, color: activeColor, border: `1px solid ${activeColor}30` }}>
                PRIORITY: {ticket.priority.toUpperCase()}
              </span>
            </div>
          </div>
          <button 
            onClick={(e) => {
              console.log("TicketModal: [X] Close button clicked");
              if (onClose) onClose();
            }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-muted)', 
              fontSize: '1.2rem', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              pointerEvents: 'auto',
              zIndex: 100001
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            [X]
          </button>
        </div>

        {/* WORKSPACE CONTENT BODY */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* LEFT AREA: Work Order Technical Details (Scrollable) */}
          <div style={{ flex: 1.8, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
            
            {/* Title / Diagnosis */}
            <div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Work Order Summary</span>
              <h2 className="text-display" style={{ fontSize: '1.2rem', margin: '4px 0 0 0', fontWeight: 'bold', textTransform: 'none', color: 'var(--text-primary)' }}>
                {ticket.aiDiagnosis.title}
              </h2>
            </div>

            {/* Asset specifications */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '1rem' }}>
                <span style={sidebarLabelStyle}>Target System Component</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginTop: '2px' }}>{ticket.asset.component}</div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '1rem' }}>
                <span style={sidebarLabelStyle}>Engine Profile Profile</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginTop: '2px' }}>{ticket.asset.profile}</div>
              </div>
            </div>

            {/* Real-time Telemetry parameters table */}
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '1.25rem' }}>
              <h4 className="text-display text-blue" style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>Operating Telemetry Readout</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 16px', fontSize: '0.78rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Altitude:</span> <strong style={{ color: 'var(--text-secondary)' }}>{ticket.asset.telemetry.Altitude}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Mach Speed:</span> <strong style={{ color: 'var(--text-secondary)' }}>{ticket.asset.telemetry.MachSpeed}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Core RPM:</span> <strong style={{ color: 'var(--text-secondary)' }}>{ticket.asset.telemetry.RotorRPM}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Fuel Flow:</span> <strong style={{ color: 'var(--text-secondary)' }}>{ticket.asset.telemetry.FuelFlow}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Pressure Ratio:</span> <strong style={{ color: 'var(--text-secondary)' }}>{ticket.asset.telemetry.CPR} : 1</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Exhaust Temp:</span> <strong style={{ color: 'var(--text-secondary)' }}>{ticket.asset.telemetry.T4}</strong></div>
              </div>
            </div>

            {/* LSTM Prognostics */}
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '1.25rem' }}>
              <h4 className="text-display text-cyan" style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>LSTM Surrogate Health Snapshot</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.78rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Compressor Health:</span> <strong style={{ color: getSeverityColor(parseFloat(ticket.predictions.compressorHealth) / 100) }}>{ticket.predictions.compressorHealth}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ticket.predictions.compressorHealthUncertainty}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Combustor Health:</span> <strong style={{ color: getSeverityColor(parseFloat(ticket.predictions.combustorHealth) / 100) }}>{ticket.predictions.combustorHealth}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ticket.predictions.combustorHealthUncertainty}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Turbine Health:</span> <strong style={{ color: getSeverityColor(parseFloat(ticket.predictions.turbineHealth) / 100) }}>{ticket.predictions.turbineHealth}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ticket.predictions.turbineHealthUncertainty}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Overall Health:</span> <strong style={{ color: getSeverityColor(parseFloat(ticket.predictions.overallHealth) / 100) }}>{ticket.predictions.overallHealth}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ticket.predictions.overallHealthUncertainty}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Total Thrust Output:</span> <strong style={{ color: 'var(--text-secondary)' }}>{ticket.predictions.thrust}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ticket.predictions.thrustUncertainty}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>TSFC Rating:</span> <strong style={{ color: 'var(--text-secondary)' }}>{ticket.predictions.tsfc}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ticket.predictions.tsfcUncertainty}</span></div>
              </div>
            </div>

            {/* AI Diagnostics details block */}
            <div style={{ borderLeft: `4px solid ${activeColor}`, background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)', borderLeft: `4px solid ${activeColor}`, borderRadius: '0 6px 6px 0', padding: '1.25rem' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>AI Diagnostics Expert Advisory</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '6px 0 12px 0' }}>
                {ticket.aiDiagnosis.summary}
              </p>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderLeft: `3px dashed ${activeColor}` }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Recommended Action</span>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '2px 0 0 0' }}>
                  {ticket.aiDiagnosis.recommendation}
                </p>
              </div>
            </div>

            {/* Suggested maintenance work order action */}
            <div style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.15)', borderRadius: '6px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--accent-rose)', fontWeight: 'bold', textTransform: 'uppercase' }}>Maintenance Command Action</span>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {ticket.suggestedAction.toUpperCase()}
              </div>
            </div>

          </div>

          {/* RIGHT SIDEBAR: Outage Metadata & Action Controls */}
          <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'rgba(0, 0, 0, 0.15)' }}>
            
            {/* Outage properties */}
            <div>
              <h3 className="text-display text-blue" style={{ fontSize: '0.75rem', marginBottom: '1.25rem' }}>Outage Specifications</h3>
              
              <span style={sidebarLabelStyle}>Reporter</span>
              <div style={sidebarValueStyle}>🤖 DT-Surrogate System</div>

              <span style={sidebarLabelStyle}>Assignee</span>
              <div style={sidebarValueStyle}>👤 {ticket.assignedEngineer}</div>

              <span style={sidebarLabelStyle}>Reported Timestamp</span>
              <div style={sidebarValueStyle}>{ticket.timestamp}</div>

              <span style={sidebarLabelStyle}>Outage Integration</span>
              <div style={{ ...sidebarValueStyle, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                JIRA // SRV-NOW READY
              </div>
            </div>

            {/* Actions group buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  copyTicketDetails(ticket);
                  alert("Work Order specifications copied to clipboard!");
                }}
                style={actionButtonStyle('rgba(255, 255, 255, 0.05)', 'var(--text-primary)', 'rgba(255, 255, 255, 0.15)')}
              >
                📋 Copy Ticket Details
              </button>
              
              <button 
                onClick={() => downloadTicketJSON(ticket)}
                style={actionButtonStyle('rgba(167, 139, 250, 0.1)', 'var(--accent-purple)', 'var(--accent-purple)')}
              >
                💾 Download Ticket JSON
              </button>

              <button 
                onClick={() => exportInspectionReportPDF(ticket)}
                style={actionButtonStyle('rgba(6, 182, 212, 0.1)', 'var(--accent-cyan)', 'var(--accent-cyan)')}
              >
                📄 Print Inspection Report (PDF)
              </button>

              <button 
                onClick={(e) => {
                  console.log("TicketModal: 'Close Ticket View' button clicked");
                  if (onClose) onClose();
                }}
                style={actionButtonStyle('rgba(244, 63, 94, 0.1)', 'var(--accent-rose)', 'var(--accent-rose)')}
              >
                ❌ Close Ticket View
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

// Utility styling for sidebar buttons
const actionButtonStyle = (bg, color, activeBorder) => ({
  width: '100%',
  background: bg,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: color,
  padding: '12px 14px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  textAlign: 'center',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
});

// Helper severity color utility
const getSeverityColor = (score) => {
  if (score >= 0.95) return "var(--accent-emerald)";
  if (score >= 0.85) return "var(--accent-amber)";
  return "var(--accent-rose)";
};
