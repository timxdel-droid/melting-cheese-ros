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
     Inventory Overview, Payments Summary, and the widgets at the foot of
     the page - Orders & Revenue trend, order source mix, payment mix,
     Service, Top items.

   DEMO - no data source exists for these yet, so the figures are the
   design mock-ups and are labelled as such in the code:
     Kitchen Screens, WiFi Customers, CCTV Feed.

   Customers & Engagement, Social & Reviews and Sales via Partners were
   removed rather than left as mock-ups. Every figure in them needed a CRM,
   a social account or a reviews platform that nothing here connects to, and
   new-vs-repeat needs a stable customer identifier the orders do not carry.
   A number that looks live but is not is worse on an operations screen than
   an honest gap, because someone eventually makes a decision on it.

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

/* ---------------- aggregates over a window of days ----------------

   Everything below is computed from the orders already on screen. No
   metric here is invented: if the orders do not contain it, the widget
   does not claim it. That is why there is no "new vs repeat customers"
   yet — the payload carries no stable way to tell two people apart. */

/* Oldest-to-newest list of the last `days` Dubai days, each with its
   totals. Days with no trading stay in the series as zeroes so the shape
   of a quiet week is visible rather than compressed away. */
function daySeries(orders, days) {
  const keys = []
  for (let i = days - 1; i >= 0; i--) {
    keys.push(new Date(Date.now() - i * 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ }))
  }
  const byDay = new Map(keys.map(k => [k, { key: k, orders: 0, revenue: 0, cancelled: 0, items: 0 }]))
  for (const o of orders) {
    const bucket = byDay.get(dayOf(o.placed_at))
    if (!bucket) continue
    if (o.status === 'cancelled') { bucket.cancelled++; continue }
    bucket.orders++
    bucket.revenue += Number(o.total) || 0
    bucket.items += itemCount(o)
  }
  return keys.map(k => byDay.get(k))
}

const inWindow = (orders, days) => {
  const first = new Date(Date.now() - (days - 1) * 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ })
  return orders.filter(o => {
    const d = dayOf(o.placed_at)
    return d && d >= first
  })
}

/* Best sellers by quantity. Lines are grouped by name rather than product
   id because the same dish can arrive under different ids once it has been
   re-created in WooCommerce, and the kitchen thinks in names. */
function topItems(orders, limit = 6) {
  const map = new Map()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    for (const line of o.items || []) {
      const name = String(line.name || '').trim() || 'Unnamed item'
      const row = map.get(name) || { name, qty: 0, revenue: 0 }
      row.qty += Number(line.quantity) || 0
      row.revenue += Number(line.total) || 0
      map.set(name, row)
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit)
}

/* Median, not mean: one order that sat forgotten for an hour should not
   make a good service average look bad. */
function medianPrepMinutes(orders) {
  const mins = orders
    .filter(o => o.status === 'completed' && o.placed_at && o.completed_at)
    .map(o => (new Date(o.completed_at) - new Date(o.placed_at)) / 60_000)
    .filter(m => m >= 0 && Number.isFinite(m))
    .sort((a, b) => a - b)
  if (!mins.length) return null
  const mid = Math.floor(mins.length / 2)
  return mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2
}

function busiestHour(orders) {
  const hours = new Array(24).fill(0)
  for (const o of orders) {
    if (!o.placed_at || o.status === 'cancelled') continue
    const h = Number(new Date(o.placed_at).toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }))
    if (Number.isFinite(h)) hours[h]++
  }
  const peak = hours.indexOf(Math.max(...hours))
  if (!hours[peak]) return null
  const label = n => String(n).padStart(2, '0') + ':00'
  return { label: label(peak) + '–' + label((peak + 1) % 24), count: hours[peak] }
}

/* Share of orders that added at least one paid extra. Extras are fee lines,
   so an order with no fees simply did not take one. */
function attachRate(orders) {
  const live = orders.filter(countsToward)
  if (!live.length) return null
  return live.filter(o => (o.fees || []).length > 0).length / live.length
}

function tally(orders, fn) {
  const out = new Map()
  for (const o of orders) {
    const key = fn(o)
    if (key == null) continue
    out.set(key, (out.get(key) || 0) + 1)
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1])
}

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

  /* Range for the trend, mix, service and top-item widgets at the bottom of
     the page. The KPI row above them is always today, because that is what
     someone standing in a truck needs; the widgets are for reading the week. */
  const [days, setDays] = useState(14)
  const windowed = useMemo(() => inWindow(orders, days), [orders, days])

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
      </div>

      <InsightStrip orders={orders} windowed={windowed} days={days} setDays={setDays} nav={nav} />
    </div>
  )
}

/* Full-width strip below the three columns.

   These were briefly inside the right-hand column, which is about 300px —
   a sparkline and four stat tiles squeezed into that are unreadable, and
   the labels wrapped to three lines. They need the whole width. */
function InsightStrip({ orders, windowed, days, setDays, nav }) {
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 14, alignItems: 'start' }}>
        <TrendPanel orders={orders} days={days} setDays={setDays} onPickDay={() => nav('/live-orders')} />
        <MixPanel
          title="Where orders come from"
          note={'(' + days + 'd)'}
          empty="No orders in this range yet."
          rows={tally(windowed.filter(countsToward), o => sourceOf(o.platform)[0])
            .map(([label, value], i) => ({
              label, value,
              tint: ['var(--mc-orange)', '#3B82F6', 'var(--green)', 'var(--ink-3)'][i % 4],
            }))}
        />
        <MixPanel
          title="How they paid"
          note={'(' + days + 'd)'}
          empty="No payment methods recorded yet."
          rows={tally(windowed.filter(countsToward), o => {
            const b = payBucket(o.payment_method)
            return b ? ({ cash: 'Cash at the window', pos: 'Card machine', online: 'Paid online' })[b] : null
          }).map(([label, value], i) => ({
            label, value,
            tint: ['var(--green)', 'var(--mc-orange)', '#3B82F6'][i % 3],
          }))}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, alignItems: 'start' }}>
        <ServicePanel orders={windowed} />
        <TopItemsPanel orders={windowed} onOpen={() => nav('/menu/items')} />
      </div>

      {orders.length >= 100 && (
        <div style={{ ...muted, textAlign: 'right' }}>
          Based on the 100 most recent orders, which is as far back as the
          orders endpoint reaches in one call.
        </div>
      )}
    </div>
  )
}

/* ---------------- live widgets ---------------- */

/* Orders and revenue per day, as bars you can point at.

   Hovering reads out that day rather than relying on a tooltip library,
   and clicking a day opens Live Orders. Height is share-of-peak, so a
   quiet week still fills the card instead of flatlining at one pixel. */
function TrendPanel({ orders, days, setDays, onPickDay }) {
  const series = useMemo(() => daySeries(orders, days), [orders, days])
  const [hover, setHover] = useState(null)

  const peak = Math.max(1, ...series.map(d => d.orders))
  const shown = hover != null ? series[hover] : null
  const totalOrders = series.reduce((n, d) => n + d.orders, 0)
  const totalRevenue = series.reduce((n, d) => n + d.revenue, 0)

  const dayLabel = key => new Date(key + 'T12:00:00Z')
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: TZ })

  return (
    <div className="card" style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ ...h3, margin: 0, flex: 1 }}>
          Orders &amp; Revenue{' '}
          <span style={muted}>{shown ? dayLabel(shown.key) : 'last ' + days + ' days'}</span>
        </h3>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            border: '1px solid var(--line)', background: d === days ? 'var(--mc-orange)' : '#fff',
            color: d === days ? '#fff' : 'var(--ink-2)', borderRadius: 7, fontSize: 10.5,
            fontWeight: 700, padding: '3px 8px', cursor: 'pointer',
          }}>{d}d</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 18, margin: '10px 0 12px' }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.1 }}>
            {shown ? shown.orders : totalOrders}
          </div>
          <div style={muted}>{shown ? 'orders that day' : 'orders'}</div>
        </div>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.1, color: 'var(--mc-orange-deep)' }}>
            {aed(shown ? shown.revenue : totalRevenue)}
          </div>
          <div style={muted}>{shown ? 'collected' : 'total'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 76 }}
        onMouseLeave={() => setHover(null)}>
        {series.map((d, i) => (
          <div key={d.key}
            onMouseEnter={() => setHover(i)}
            onClick={() => onPickDay && onPickDay(d)}
            title={dayLabel(d.key) + ' — ' + d.orders + ' orders, ' + aed(d.revenue)}
            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'pointer' }}>
            <div style={{
              width: '100%',
              height: Math.max(3, (d.orders / peak) * 100) + '%',
              borderRadius: '3px 3px 0 0',
              background: hover === i ? 'var(--mc-orange-deep)'
                : d.orders ? 'var(--mc-orange)' : 'var(--line)',
              transition: 'background .12s',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...muted, marginTop: 5 }}>
        <span>{dayLabel(series[0].key)}</span>
        <span>{dayLabel(series[series.length - 1].key)}</span>
      </div>
    </div>
  )
}

/* A labelled proportion bar. Used for channel and payment mix, where the
   question is always "how is this split" rather than "how many". */
function MixPanel({ title, note, rows, empty }) {
  const total = rows.reduce((n, r) => n + r.value, 0)
  return (
    <div className="card" style={card}>
      <h3 style={h3}>{title} <span style={muted}>{note}</span></h3>
      {!total && <div style={{ ...muted, padding: '8px 0' }}>{empty}</div>}
      {!!total && rows.filter(r => r.value).map(r => (
        <div key={r.label} style={{ marginBottom: 9 }}>
          <div style={{ display: 'flex', fontSize: 11.5, marginBottom: 3 }}>
            <span style={{ flex: 1 }}>{r.label}</span>
            <b>{Math.round((r.value / total) * 100)}%</b>
            <span style={{ ...muted, marginLeft: 6 }}>{r.value}</span>
          </div>
          <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: (r.value / total) * 100 + '%', height: '100%', background: r.tint }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* Four numbers that describe how service actually went, rather than how
   much was sold. Each renders a dash when the orders cannot answer it. */
function ServicePanel({ orders }) {
  const live = orders.filter(countsToward)
  const prep = medianPrepMinutes(orders)
  const peak = busiestHour(orders)
  const attach = attachRate(orders)
  const revenue = live.reduce((n, o) => n + (Number(o.total) || 0), 0)
  const aov = live.length ? revenue / live.length : null
  const cancelled = orders.length ? orders.filter(o => o.status === 'cancelled').length / orders.length : null

  const stats = [
    ['Average order', aov == null ? '—' : aed(aov), live.length + ' orders'],
    ['Median prep', prep == null ? '—' : Math.round(prep) + ' min', prep == null ? 'none collected yet' : 'placed to collected'],
    ['Busiest hour', peak ? peak.label : '—', peak ? peak.count + ' orders' : 'not enough data'],
    ['Extras attached', attach == null ? '—' : Math.round(attach * 100) + '%', 'orders with a paid extra'],
  ]

  return (
    <div className="card" style={card}>
      <h3 style={h3}>Service <span style={muted}>(selected range)</span></h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {stats.map(([label, value, sub]) => (
          <div key={label} style={{ background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{value}</div>
            <div style={{ ...muted, marginTop: 1 }}>{label}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-2)', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>
      {cancelled != null && cancelled > 0 && (
        <div style={{ ...muted, marginTop: 10, color: cancelled > 0.1 ? 'var(--red)' : 'var(--ink-3)' }}>
          {Math.round(cancelled * 100)}% of orders in this range were cancelled.
        </div>
      )}
    </div>
  )
}

/* Best sellers. Quantity drives the bar because that is what runs the
   kitchen out of stock; revenue sits beside it for the commercial read. */
function TopItemsPanel({ orders, onOpen }) {
  const rows = useMemo(() => topItems(orders), [orders])
  const peak = Math.max(1, ...rows.map(r => r.qty))

  return (
    <div className="card" style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <h3 style={{ ...h3, margin: 0, flex: 1 }}>Top items <span style={muted}>(selected range)</span></h3>
        {onOpen && (
          <button onClick={onOpen} style={{
            border: 'none', background: 'none', color: 'var(--mc-orange-deep)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0,
          }}>Open Items →</button>
        )}
      </div>
      {!rows.length && <div style={{ ...muted, paddingTop: 8 }}>No items sold in this range yet.</div>}
      {rows.map(r => (
        <div key={r.name} style={{ marginTop: 9 }}>
          <div style={{ display: 'flex', fontSize: 11.5, marginBottom: 3 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            <b style={{ marginLeft: 8 }}>{r.qty}</b>
            <span style={{ ...muted, marginLeft: 8 }}>{aed(r.revenue)}</span>
          </div>
          <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: (r.qty / peak) * 100 + '%', height: '100%', background: 'var(--mc-orange)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
