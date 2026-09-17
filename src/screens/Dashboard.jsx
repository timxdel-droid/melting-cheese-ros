import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchOrders, hasApiToken, loadEvents, loadTrucks, loadSyncedProducts,
  fmtSyncTime,
} from '../lib/connectors.js'

/* Screen: Operations Dashboard (Figma nodes 101-4244 / 106-3989)

   LIVE - read from the store and the published setup:
     Orders Today, Revenue Today, Avg. Prep Time, Pending Orders,
     Active Locations, Live Orders Overview, Location Status,
     Inventory Overview, Payments Summary.

   DEMO - no data source exists for these yet, so the figures are the
   design mock-ups and are labelled as such in the code:
     Kitchen Screens, WiFi Customers, CCTV Feed, Customers & Engagement,
     Social & Reviews, Sales via Partners & Vouchers.

   "Today" is the Dubai calendar day, matching the clock in the header.
   Orders come from mc/v1/orders, which only ever lists orders placed in the
   customer apps - website orders are not part of this console. */

const REFRESH_MS = 20_000
const TZ = 'Asia/Dubai'

/* ---------------- date helpers ---------------- */

const dayOf = iso => iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) : null
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const yesterdayKey = () => new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ })

function ago(iso) {
  if (!iso) return ''
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return m + ' min ago'
  const h = Math.round(m / 60)
  if (h < 24) return h + ' h ago'
  return Math.round(h / 24) + ' d ago'
}

const aed = n => 'AED ' + Math.round(Number(n) || 0).toLocaleString('en-GB')

function pctDelta(now, before) {
  if (!before) return null
  const d = ((now - before) / before) * 100
  return (d >= 0 ? '+' : '') + d.toFixed(1) + '% vs yesterday'
}

/* ---------------- classification ---------------- */

/* Where the order came from. The apps write ios/android; the other
   channels are what the design anticipates and are kept so they light up
   the day a kiosk or the eMenu starts posting orders. */
function sourceOf(platform) {
  switch ((platform || '').toLowerCase()) {
    case 'ios': case 'android': case 'app': return ['App', 'blue']
    case 'kiosk': return ['Kiosk', 'orange']
    case 'emenu': case 'qr': return ['eMenu', 'green']
    case 'web': case 'website': return ['Web', 'gray']
    default: return [platform || 'App', 'blue']
  }
}

/* Cash is anything settled at the window; POS is a card terminal on the
   truck; Online is anything charged in the app. */
function payBucket(method) {
  switch ((method || '').toLowerCase()) {
    case 'at_truck': case 'cash': case 'cod': return 'cash'
    case 'card': case 'pos': return 'pos'
    case 'apple_pay': case 'payment_link': case 'online': case 'stripe': return 'online'
    default: return null
  }
}

const STATUS_PILL = {
  'on-hold':    ['New', 'orange'],
  'processing': ['Preparing', 'blue'],
  'completed':  ['Collected', 'green'],
  'cancelled':  ['Cancelled', 'red'],
}

const countsToward = o => o.status !== 'cancelled'
const itemCount = o => (o.items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0)

/* ---------------- data ---------------- */

function useOrders() {
  const [orders, setOrders] = useState([])
  const [state, setState] = useState({ loading: true, error: null, at: null })
  const connected = hasApiToken()

  useEffect(() => {
    if (!connected) { setState({ loading: false, error: null, at: null }); return }
    let cancelled = false
    const tick = async () => {
      const res = await fetchOrders({ perPage: 100 })
      if (cancelled) return
      if (res.ok) {
        setOrders(res.orders)
        setState({ loading: false, error: null, at: Date.now() })
      } else {
        // Keep showing the last good numbers; just say the refresh failed.
        setState(s => ({ loading: false, error: res.message, at: s.at }))
      }
    }
    tick()
    const t = setInterval(tick, REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [connected])

  return { orders, connected, ...state }
}

/* ---------------- styles ---------------- */

const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const muted = { color: 'var(--ink-3)', fontSize: 11 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, background: '#fff' }
const link = { ...muted, cursor: 'pointer', color: 'var(--mc-orange-deep)', fontWeight: 600 }

/* ---------------- screen ---------------- */

export default function Dashboard() {
  const nav = useNavigate()
  const { orders, connected, loading, error, at } = useOrders()
  const events = useMemo(loadEvents, [])
  const trucks = useMemo(loadTrucks, [])
  const sync = useMemo(loadSyncedProducts, [])
  const [locFilter, setLocFilter] = useState('')

  const eventName = id => (events.find(e => e.id === id) || {}).name || (id ? id : 'No event')
  const truckFor = eventId => trucks.find(t => t.deployments && t.deployments[eventId] && t.deployments[eventId].date)

  /* ---- today / yesterday ---- */
  const today = todayKey()
  const yday = yesterdayKey()
  const todays = orders.filter(o => dayOf(o.placed_at) === today)
  const ydays = orders.filter(o => dayOf(o.placed_at) === yday)
  // The list is the newest 100 orders. Yesterday is only comparable when
  // the oldest order we hold predates it; otherwise the day is truncated.
  const oldest = orders.length ? orders[orders.length - 1].placed_at : null
  const ydayComplete = oldest && dayOf(oldest) < yday

  const countedToday = todays.filter(countsToward)
  const countedYday = ydays.filter(countsToward)

  /* Money is counted when the order is collected, not when it is placed:
     that is when the guest pays at the window. An order placed last night
     and handed over this morning is today's takings. Collection time comes
     from the server (completed_at); older orders that predate that field
     fall back to their placed time. */
  const collectedOn = o => dayOf(o.completed_at || o.placed_at)
  const collectedToday = orders.filter(o => o.status === 'completed' && collectedOn(o) === today)
  const collectedYday = orders.filter(o => o.status === 'completed' && collectedOn(o) === yday)
  const revenueToday = collectedToday.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const revenueYday = collectedYday.reduce((s, o) => s + (Number(o.total) || 0), 0)

  /* Prep time = placed -> collected, over orders collected today. Needs
     completed_at from the server; shows a dash until it is there. */
  const prepSamples = collectedToday
    .filter(o => o.completed_at && o.placed_at)
    .map(o => (new Date(o.completed_at) - new Date(o.placed_at)) / 60_000)
    .filter(m => m >= 0 && m < 240)
  const avgPrep = prepSamples.length ? Math.round(prepSamples.reduce((a, b) => a + b, 0) / prepSamples.length) : null

  const pending = orders.filter(o => o.status === 'on-hold').length
  const liveEvents = events.filter(e => e.live && e.id !== 'placeholder')
  const scheduledEvents = events.filter(e => !e.live && e.id !== 'placeholder')

  const kpis = [
    { icon: '🧾', tint: 'var(--amber-chip)', label: 'Orders Today', value: connected ? String(countedToday.length) : '—',
      delta: ydayComplete ? pctDelta(countedToday.length, countedYday.length) : null },
    { icon: '💰', tint: 'var(--green-soft)', label: 'Revenue Today', value: connected ? aed(revenueToday) : '—',
      delta: ydayComplete ? pctDelta(revenueToday, revenueYday) : null,
      sub: ydayComplete ? null : collectedToday.length + ' collected order' + (collectedToday.length === 1 ? '' : 's'), neutral: true },
    { icon: '⏱', tint: 'var(--amber-chip)', label: 'Avg. Prep Time', value: avgPrep != null ? avgPrep + ' min' : '—',
      sub: avgPrep != null ? prepSamples.length + ' collected today' : 'No collections yet today', neutral: true },
    { icon: '📍', tint: 'var(--purple-soft)', label: 'Active Locations',
      value: liveEvents.length + ' Active · ' + scheduledEvents.length + ' Scheduled', small: true },
    // DEMO - no kitchen screen system exists yet.
    { icon: '🖥', tint: 'var(--blue-soft)', label: 'Kitchen Screens', value: '12', sub: 'Online' },
    { icon: '🛎', tint: 'var(--red-soft)', label: 'Pending Orders', value: connected ? String(pending) : '—',
      sub: pending > 0 ? 'Needs attention' : 'All clear', alert: pending > 0 },
  ]

  /* ---- live orders table ---- */
  const tableOrders = (locFilter ? orders.filter(o => o.event === locFilter) : orders).slice(0, 5)
  const tableTotal = (locFilter ? orders.filter(o => o.event === locFilter) : orders).length
  const chip = status => todays.filter(o => o.status === status).length

  /* ---- inventory for the first live event ---- */
  const focusEvent = liveEvents[0] || null
  const focusTruck = focusEvent ? truckFor(focusEvent.id) : null
  const inventory = useMemo(() => {
    const items = (sync && sync.items) || []
    if (!items.length) return []
    const key = i => String(i.id) + '|' + i.name
    const scoped = focusEvent && focusEvent.products && focusEvent.products.length
      ? items.filter(i => focusEvent.products.includes(key(i)))
      : items
    // Sold and preparing come from today's order lines, matched by product
    // name - the order payload carries names, not ids.
    const sold = {}, preparing = {}
    for (const o of todays) {
      if (!countsToward(o)) continue
      for (const line of o.items || []) {
        const n = line.name
        sold[n] = (sold[n] || 0) + (Number(line.quantity) || 0)
        if (o.status === 'processing') preparing[n] = (preparing[n] || 0) + (Number(line.quantity) || 0)
      }
    }
    return scoped.map(i => {
      const s = sold[i.name] || 0
      const p = preparing[i.name] || 0
      const remaining = i.qty == null ? null : Number(i.qty)
      const allocated = remaining == null ? null : remaining + s
      const pct = allocated ? Math.round((s / allocated) * 100) : 0
      let status = 'On Track', tone = 'green'
      if (!i.inStock || remaining === 0) { status = 'Sold Out'; tone = 'red' }
      else if (remaining != null && (remaining <= 5 || (allocated && remaining / allocated <= 0.15))) { status = 'Low Stock'; tone = 'orange' }
      else if (remaining == null) { status = 'Untracked'; tone = 'gray' }
      return { name: i.name, allocated, sold: s, preparing: p, remaining, pct, status, tone }
    })
      .sort((a, b) => b.sold - a.sold || (a.remaining ?? 1e9) - (b.remaining ?? 1e9))
      .slice(0, 8)
  }, [sync, todays, focusEvent])

  /* ---- payments: today's collected orders, per event ---- */
  const payRows = useMemo(() => {
    const rows = new Map()
    let known = 0
    for (const o of collectedToday) {
      const b = payBucket(o.payment_method)
      if (b) known++
      const row = rows.get(o.event) || { cash: 0, pos: 0, online: 0, other: 0, total: 0 }
      row[b || 'other'] += Number(o.total) || 0
      row.total += Number(o.total) || 0
      rows.set(o.event, row)
    }
    return { rows: [...rows.entries()], reported: known > 0 }
  }, [collectedToday])
  const payTotal = payRows.rows.reduce((t, [, r]) => ({
    cash: t.cash + r.cash, pos: t.pos + r.pos, online: t.online + r.online, other: t.other + r.other, total: t.total + r.total,
  }), { cash: 0, pos: 0, online: 0, other: 0, total: 0 })
  const share = n => payTotal.total ? (n / payTotal.total * 100).toFixed(1) + '%' : '0%'

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {!connected && (
        <div style={{ background: 'var(--amber-chip)', border: '1px solid var(--mc-orange)', borderRadius: 10, padding: '10px 13px', fontSize: 12 }}>
          Live figures need the API token — add it in <b>Sync → App publishing</b>. Until then the order panels are empty.
        </div>
      )}
      {error && (
        <div style={{ ...muted, color: 'var(--red)' }}>Last refresh failed: {error}{at ? ' · showing figures from ' + new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ ...card, display: 'flex', gap: 11 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: k.tint,
              display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0,
            }}>{k.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={muted}>{k.label}</div>
              <div style={{ fontWeight: 800, fontSize: k.small ? 12.5 : 18 }}>{k.value}</div>
              {k.delta && <div style={{ fontSize: 10.5, color: k.delta.startsWith('-') ? 'var(--red)' : 'var(--green)' }}>{k.delta}</div>}
              {k.sub && <div style={{ fontSize: 10.5, color: k.alert ? 'var(--red)' : k.neutral ? 'var(--ink-3)' : 'var(--green)' }}>{k.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Live orders — LIVE */}
        <div className="card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3 style={h3}>Live Orders Overview</h3>
            <div style={{ flex: 1 }} />
            <span style={link} onClick={() => nav('/live-orders')}>View All Orders →</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={sel} value={locFilter} onChange={e => setLocFilter(e.target.value)}>
              <option value="">All Locations</option>
              {events.filter(e => e.id !== 'placeholder').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <span className="pill orange">New Orders {chip('on-hold')}</span>
            <span className="pill gray">Preparing {chip('processing')}</span>
            <span className="pill gray">Completed {chip('completed')}</span>
            {at && <span style={{ ...muted, marginLeft: 'auto' }}>Updated {ago(new Date(at).toISOString())}</span>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Order ID</th><th>Source</th><th>Location</th>
                <th>Customer</th><th>Items</th><th>Time</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tableOrders.map(o => {
                const [src, srcTone] = sourceOf(o.platform)
                const [label, tone] = STATUS_PILL[o.status] || [o.status_label || o.status, 'gray']
                return (
                  <tr key={o.order_id} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => nav('/live-orders')}>
                    <td style={{ padding: '8px 4px', fontWeight: 700 }}>{o.collection_code || ('#' + o.order_id)}</td>
                    <td><span className={'pill ' + srcTone}>{src}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{eventName(o.event)}</div>
                      <div style={muted}>{o.truck ? (trucks.find(t => t.id === o.truck) || {}).name || o.truck : 'No truck yet'}</div>
                    </td>
                    <td>{o.customer || 'Guest'}</td>
                    <td style={{ textAlign: 'center' }}>{itemCount(o)}</td>
                    <td style={muted}>{ago(o.placed_at)}</td>
                    <td><span className={'pill ' + tone}>{label}</span></td>
                  </tr>
                )
              })}
              {!tableOrders.length && (
                <tr><td colSpan={7} style={{ padding: '18px 4px', textAlign: 'center', color: 'var(--ink-3)' }}>
                  {loading ? 'Loading orders…' : connected ? 'No app orders yet.' : 'Not connected.'}
                </td></tr>
              )}
            </tbody>
          </table>
          <div style={{ display: 'flex', marginTop: 10, alignItems: 'center' }}>
            <span style={muted}>Showing {Math.min(tableOrders.length, 5)} of {tableTotal} orders</span>
            <div style={{ flex: 1 }} />
            <span style={link} onClick={() => nav('/live-orders')}>View All →</span>
          </div>
        </div>

        {/* Location status — LIVE */}
        <div className="card" style={card}>
          <div style={{ display: 'flex' }}>
            <h3 style={h3}>Location Status</h3>
            <div style={{ flex: 1 }} />
            <span style={link} onClick={() => nav('/locations')}>View All Locations →</span>
          </div>
          {events.filter(e => e.id !== 'placeholder').map(l => {
            const truck = truckFor(l.id)
            const dep = truck ? truck.deployments[l.id] : null
            const active = orders.filter(o => o.event === l.id && (o.status === 'on-hold' || o.status === 'processing')).length
            return (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0',
                borderTop: '1px solid var(--line)',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 4,
                  background: l.live ? 'var(--green)' : 'var(--mc-orange)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{l.name}</span>
                    {truck
                      ? <span className="pill green" style={{ fontSize: 9 }}>{truck.name}</span>
                      : <span className={'pill ' + (l.live ? 'gray' : 'orange')} style={{ fontSize: 9 }}>{l.live ? 'No truck' : 'Scheduled'}</span>}
                  </div>
                  <div style={muted}>
                    {dep && dep.date ? dep.date : (l.venue || 'Venue not set')}
                    {l.live && <span style={{ color: 'var(--green)', fontWeight: 700 }}> · ● Live Now</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{active}</div>
                  <div style={muted}>Active Orders</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* WiFi + CCTV column — DEMO (no WiFi portal or camera system connected) */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={h3}>WiFi Customers <span style={muted}>(Dubai WTC-GITEX)</span></h3>
            <div style={{ display: 'flex', gap: 18 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--green)' }}>👥 64</div>
                <div style={muted}>Currently Connected</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--purple)' }}>👥 538</div>
                <div style={muted}>Connected Today</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={muted}>Capture Rate (Today) — <b style={{ color: 'var(--ink)' }}>31.2%</b> vs connections</div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 4 }}>
                <div style={{ width: '31.2%', height: '100%', borderRadius: 3, background: 'var(--green)' }} />
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}><span style={link}>View Details →</span></div>
            </div>
          </div>

          <div className="card" style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ ...h3, margin: 0 }}>CCTV Feed</h3>
              <div style={{ flex: 1 }} />
              <select style={{ ...sel, fontSize: 10.5, padding: '4px 7px' }}><option>Dubai WTC - GITEX</option></select>
            </div>
            <div style={{ display: 'flex', gap: 6, margin: '10px 0 8px', flexWrap: 'wrap' }}>
              <span className="pill orange" style={{ background: 'var(--mc-orange)', color: '#fff' }}>Inside Truck</span>
              <span className="pill gray">Front of Truck</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['Inside Truck', 'Front of Truck', 'Serving Window', 'Queue'].map(cam => (
                <div key={cam} style={{
                  position: 'relative', aspectRatio: '16/10', borderRadius: 8,
                  background: 'linear-gradient(135deg, #2E2E34, #1C1C1F)', color: '#9A9AA2',
                  display: 'grid', placeItems: 'center', fontSize: 10.5,
                }}>
                  {cam}
                  <span style={{
                    position: 'absolute', top: 5, right: 6, background: 'var(--red)', color: '#fff',
                    fontSize: 8, fontWeight: 800, borderRadius: 4, padding: '1px 5px',
                  }}>LIVE</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right', marginTop: 8 }}><span style={link}>View All Cameras →</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Inventory — LIVE (stock from the last sync, sold/preparing from today's orders) */}
        <div className="card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <h3 style={{ ...h3, margin: 0 }}>
              Inventory Overview{focusEvent ? ' — ' + focusEvent.name : ''}
              {focusTruck && <span style={muted}> ({focusTruck.name})</span>}
            </h3>
            <div style={{ flex: 1 }} />
            <span style={{ ...muted, fontWeight: 600 }}>
              {sync && sync.syncedAt ? 'Stock as of last sync ' + fmtSyncTime(sync.syncedAt) : 'No product sync yet'}
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Menu Item</th><th>Allocated</th>
                <th>Sold</th><th>Preparing</th><th>Remaining</th><th style={{ width: '20%' }}>Sold Out %</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(i => (
                <tr key={i.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>{i.name}</td>
                  <td>{i.allocated ?? '—'}</td><td><b>{i.sold}</b></td><td>{i.preparing}</td><td>{i.remaining ?? '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--line)' }}>
                        <div style={{ width: i.pct + '%', height: '100%', borderRadius: 3, background: i.tone === 'green' ? 'var(--mc-orange)' : 'var(--red)' }} />
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 700 }}>{i.pct}%</span>
                    </div>
                  </td>
                  <td><span className={'pill ' + i.tone}>{i.status}</span></td>
                </tr>
              ))}
              {!inventory.length && (
                <tr><td colSpan={7} style={{ padding: '18px 4px', textAlign: 'center', color: 'var(--ink-3)' }}>
                  Run a sync on Inventory to load products.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payments — LIVE */}
        <div className="card" style={card}>
          <h3 style={h3}>Payments Summary <span style={muted}>(Today · collected orders)</span></h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10 }}>
                <th style={{ padding: '5px 3px' }}>Location</th><th>Cash</th><th>POS</th><th>Online</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {payRows.rows.map(([ev, r]) => (
                <tr key={ev || 'none'} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '7px 3px', fontWeight: 600 }}>{eventName(ev)}</td>
                  <td>{aed(r.cash)}</td><td>{aed(r.pos)}</td><td>{aed(r.online)}</td><td><b>{aed(r.total)}</b></td>
                </tr>
              ))}
              {!payRows.rows.length && (
                <tr><td colSpan={5} style={{ padding: '14px 3px', textAlign: 'center', color: 'var(--ink-3)' }}>Nothing collected yet today. Orders appear here the moment they are marked Collected.</td></tr>
              )}
              <tr style={{ borderTop: '2px solid var(--ink)' }}>
                <td style={{ padding: '7px 3px' }}><b>TOTAL</b></td>
                <td><b>{aed(payTotal.cash)}</b></td><td><b>{aed(payTotal.pos)}</b></td><td><b>{aed(payTotal.online)}</b></td><td><b>{aed(payTotal.total)}</b></td>
              </tr>
            </tbody>
          </table>
          {payRows.rows.length > 0 && !payRows.reported && (
            <div style={{ ...muted, marginTop: 6 }}>Payment method is not in the order feed yet, so the split is unknown; totals are right.</div>
          )}

          <h3 style={{ ...h3, marginTop: 16 }}>Payment Methods <span style={muted}>(Today)</span></h3>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['💵 Cash', share(payTotal.cash), aed(payTotal.cash)], ['💳 POS Card', share(payTotal.pos), aed(payTotal.pos)], ['🌐 Online', share(payTotal.online), aed(payTotal.online)]].map(([m, p, amt]) => (
              <div key={m} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{p}</div>
                <div style={muted}>{m}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)' }}>{amt}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement / social / partners — DEMO (no CRM, review or voucher source connected) */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card" style={card}>
              <h3 style={h3}>Customers & Engagement <span style={muted}>(Today)</span></h3>
              {[
                ['🧑‍🤝‍🧑 New Customers', '128'], ['🔁 Repeat Customers', '286'],
                ['💬 WhatsApp Registrations', '184'], ['✉️ Email Registrations', '96'],
                ['🎟 Vouchers Issued (3rd Party)', '43'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', padding: '6px 0', fontSize: 11.5, borderTop: '1px solid var(--line)' }}>
                  <span style={{ flex: 1 }}>{l}</span><b>{v}</b>
                </div>
              ))}
            </div>
            <div className="card" style={card}>
              <h3 style={h3}>Social & Reviews <span style={muted}>(Today)</span></h3>
              {[
                ['📣 New Social Followers', '312'], ['⭐ Google Reviews', '18'],
                ['✨ Average Rating', '4.8'], ['📝 Reviews Responded', '16'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', padding: '6px 0', fontSize: 11.5, borderTop: '1px solid var(--line)' }}>
                  <span style={{ flex: 1 }}>{l}</span><b>{v}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={card}>
            <h3 style={h3}>Sales via Partners & Vouchers <span style={muted}>(Today)</span></h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                ['🎁 Gift Vouchers Used', 'AED 2,640', '28 Orders'],
                ['🎪 Event Organizer Sales', 'AED 5,820', '52 Orders'],
                ['🤝 3rd Party Partner Sales', 'AED 3,450', '31 Orders'],
              ].map(([p, v, o]) => (
                <div key={p} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5 }}>{v}</div>
                  <div style={muted}>{p}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-2)' }}>{o}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
