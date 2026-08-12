import { NavLink, Outlet, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/live-orders', label: 'Live Orders', icon: '🛎', badge: true },
  { to: '/locations', label: 'Locations', icon: '📍' },
  { to: '/menu', label: 'Menu Manager', icon: '📋' },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/staff', label: 'Staff & Roles', icon: '👥' },
  { to: '/trucks', label: 'Food Trucks', icon: '🚚' },
  { to: '/kiosks', label: 'Kiosks', icon: '🖥' },
  { to: '/emenu', label: 'eMenu (QR)', icon: '▣' },
  { to: '/customers', label: 'Customers', icon: '🧑‍🤝‍🧑' },
  { to: '/analytics', label: 'Analytics & Reports', icon: '📈' },
  { to: '/promotions/banners', label: 'Promotions', icon: '🏷' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
  { to: '/support', label: 'Support', icon: '❑' },
]

function today() {
  const d = new Date()
  return {
    day: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function Shell() {
  const nav = useNavigate()
  const t = today()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 218, flexShrink: 0, background: 'var(--surface)',
        borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 16px 12px' }}>
          <span style={{ fontSize: 24 }}>🧀</span>
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>melting <span style={{ color: 'var(--mc-orange)' }}>cheese</span></div>
            <span className="pill orange" style={{ fontSize: 9 }}>OPS</span>
          </div>
        </div>

        <nav style={{ padding: '4px 10px', flex: 1, overflowY: 'auto' }}>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 11px', borderRadius: 9, marginBottom: 2,
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--mc-orange-deep)' : 'var(--ink-2)',
              background: isActive ? 'var(--amber-chip)' : 'transparent',
            })}>
              <span style={{ width: 18, textAlign: 'center', fontSize: 13 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--red)' }} />}
            </NavLink>
          ))}
        </nav>

        <div style={{ margin: 12, borderRadius: 12, overflow: 'hidden', background: 'var(--mc-cheese)' }}>
          <div className="drip" />
          <div style={{ padding: '4px 14px 14px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>melting cheese.</div>
            <div style={{ fontSize: 10.5, margin: '6px 0 10px', color: '#5B4A16' }}>
              Great food, happy people! Run your operations smoothly and grow your business.
            </div>
            <button className="btn-primary" style={{ padding: '7px 16px', fontSize: 12 }}
              onClick={() => nav('/analytics')}>View Reports</button>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '12px 22px',
          background: 'var(--surface)', borderBottom: '1px solid var(--line)',
        }}>
          <span className="pill gray">☀ Light</span>
          <div style={{ fontSize: 13.5 }}>
            <b>Today</b>&ensp;{t.day}&ensp;<span style={{ color: 'var(--ink-2)' }}>Time {t.time}</span>
          </div>
          <div style={{ flex: 1 }} />
          <button title="Notifications" style={{ position: 'relative', fontSize: 16 }}>
            🔔<span style={{
              position: 'absolute', top: -4, right: -6, background: 'var(--red)', color: '#fff',
              borderRadius: 8, fontSize: 9, fontWeight: 700, padding: '0 4px',
            }}>4</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 15, background: 'var(--mc-orange)',
              color: '#fff', fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center',
            }}>MC</div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5 }}>Melting Ops</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Super Admin</div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: 20, minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
