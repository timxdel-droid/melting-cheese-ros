import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'

/* Nav per the refined Figma frames (132-403 / 132-812): Menu Management is a
   group holding menu + banner tooling; Coupons and Finance join the tree. */
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/live-orders', label: 'Live Orders', icon: '🛎', badge: '12' },
  { to: '/locations', label: 'Locations', icon: '📍' },
  { label: 'CONTENT & APP', heading: true },
  { to: '/content/home-builder', label: 'Home Builder', icon: '▤' },
  { to: '/content/banners', label: 'Banner Library', icon: '▩' },
  { to: '/content/releases', label: 'App Releases', icon: '⇪' },
  { label: 'MENU MANAGEMENT', heading: true },
  { to: '/menu', label: 'Categories', icon: '🗂' },
  { to: '/menu/items', label: 'Items', icon: '🍛' },
  { to: '/menu/modifiers', label: 'Modifiers', icon: '🎚' },
  { to: '/menu/product-editor', label: 'Product Editor', icon: '✎' },
  { to: '/promotions/banner-groups', label: 'Banner Groups', icon: '🗃' },
  { label: 'OPERATIONS', heading: true },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/staff', label: 'Staff & Roles', icon: '👥' },
  { to: '/trucks', label: 'Food Trucks', icon: '🚚' },
  { to: '/kiosks', label: 'Kiosks', icon: '🖥' },
  { to: '/emenu', label: 'eMenu (QR)', icon: '▣' },
  { label: 'GROWTH', heading: true },
  { to: '/customers', label: 'Customers', icon: '🧑‍🤝‍🧑' },
  { to: '/analytics', label: 'Analytics & Reports', icon: '📈' },
  { to: '/promotions/banners', label: 'Banners', icon: '🏷' },
  { to: '/coupons', label: 'Coupons', icon: '🎟' },
  { to: '/finance', label: 'Finance', icon: '💰' },
  { label: 'SYSTEM', heading: true },
  { to: '/settings', label: 'Settings', icon: '⚙' },
  { to: '/support', label: 'Support', icon: '❑' },
  { to: '/login', label: 'Sign Out', icon: '🚪', signout: true },
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
  const loc = useLocation()
  const t = today()
  const [open, setOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}
      <aside className={'sidebar' + (open ? ' open' : '')} style={{
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
          {NAV.map(item => item.heading ? (
            <div key={item.label} style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: 'var(--ink-3)',
              padding: '12px 11px 4px',
            }}>{item.label}</div>
          ) : (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 11px', borderRadius: 9, marginBottom: 2,
              fontSize: 13, fontWeight: (isActive && loc.pathname === item.to) ? 700 : 500,
              color: item.signout ? 'var(--red)' : (isActive && loc.pathname === item.to) ? 'var(--mc-orange-deep)' : 'var(--ink-2)',
              background: (isActive && loc.pathname === item.to) ? 'var(--amber-chip)' : 'transparent',
            })}>
              <span style={{ width: 18, textAlign: 'center', fontSize: 13 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && <span style={{
                background: 'var(--red)', color: '#fff', borderRadius: 9,
                fontSize: 9.5, fontWeight: 700, padding: '1px 6px',
              }}>{item.badge}</span>}
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
              onClick={() => { setOpen(false); nav('/analytics') }}>View Reports</button>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px',
          background: 'var(--surface)', borderBottom: '1px solid var(--line)', flexWrap: 'wrap',
        }}>
          <button className="hamburger" title="Menu" onClick={() => setOpen(!open)}>☰</button>
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
          <div style={{ position: 'relative' }}>
            <button onClick={() => setUserMenu(!userMenu)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 15, background: 'var(--mc-orange)',
                color: '#fff', fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center',
              }}>MC</div>
              <div style={{ lineHeight: 1.1, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>Melting Ops</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Super Admin</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{userMenu ? '▲' : '▼'}</span>
            </button>
            {userMenu && (
              <div className="card" style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 70,
                minWidth: 170, padding: 6, background: 'var(--surface)',
              }}>
                <button onClick={() => { setUserMenu(false); nav('/settings') }} style={{
                  display: 'flex', gap: 9, alignItems: 'center', width: '100%',
                  padding: '9px 11px', borderRadius: 8, fontSize: 13, color: 'var(--ink-2)',
                }}>⚙ Account Settings</button>
                <button onClick={() => { setUserMenu(false); nav('/login') }} style={{
                  display: 'flex', gap: 9, alignItems: 'center', width: '100%',
                  padding: '9px 11px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--red)',
                }}>🚪 Sign Out</button>
              </div>
            )}
          </div>
        </header>

        <main style={{ flex: 1, padding: 20, minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
