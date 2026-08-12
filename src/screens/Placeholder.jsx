/* Temporary stand-in for screens whose Figma capture is still pending
   (blocked by the Figma View-seat rate limit). Each gets replaced with the
   real implementation as captures come through. */

export default function Placeholder({ title }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 34 }}>🧀</div>
      <h2 style={{ margin: '10px 0 6px', fontSize: 18 }}>{title}</h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>
        This screen is designed in Figma and queued for implementation.
      </p>
    </div>
  )
}
