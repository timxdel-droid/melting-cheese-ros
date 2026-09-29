import { useState, useEffect, useRef } from 'react'
import {
  fetchOrders, setOrderTruck, KITCHEN_STATES, kitchenState, CANCEL_REASON_LABELS,
  hasApiToken, loadEvents, loadTrucks, trucksAtEvent,
} from '../lib/connectors.js'

/* Screen: Live Orders

   Orders placed in the customer apps, as they arrive - and, since 29 Sep,
   a WATCH screen. Timothy's decision: the kitchen tablet drives status
   (accept, ready, collected, cancel with a reason); the console shows what
   the kitchen did and when. Two screens both able to move an order is how
   a docket gets marked collected by someone who never saw the guest.

   What the office still does here: put an order on a truck. That is a
   deployment decision, not a cooking one.

   Priorities unchanged: the collection code is the biggest thing on the
   card, it refreshes itself, and nothing here destroys anything. */

const REFRESH_MS = 20000

const muted = { color: 'var(--ink-3)', fontSize: 11 }

const TONES = {
  amber: ['var(--amber-chip)', 'var(--mc-orange-deep)'],
  blue:  ['var(--blue-soft)',  'var(--blue)'],
  green: ['var(--green-soft)', 'var(--green)'],
  red:   ['var(--red-soft)',   'var(--red)'],
  gray:  ['var(--bg)',         'var(--ink-3)'],
}

function Pill({ tone, children }) {
  const [bg, fg] = TONES[tone] || TONES.gray
  return (
    <span style={{
      background: bg, color: fg, borderRadius: 999, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

export default function LiveOrders() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('active')
  const [eventId, setEventId] = useState('')
  const [truckId, setTruckId] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [lastAt, setLastAt] = useState(null)
  const timer = useRef(null)

  const connected = hasApiToken()
  const events = loadEvents()

  const load = async (quiet) => {
    if (!connected) return
    if (!quiet) setLoading(true)
    // 'active' is on-hold + processing on the server (what the kitchen
    // polls). The finer split into received / cooking / ready is done here
    // from kitchen_status, which the server derives.
    const serverStatus = filter === 'all' ? null
      : (filter === 'collected' ? 'completed' : (filter === 'cancelled' ? 'cancelled' : 'active'))
    const res = await fetchOrders({
      status: serverStatus,
      event: eventId || null,
      truck: truckId || null,
    })
    setLoading(false)
    setLastAt(Date.now())
    if (res.ok) {
      setOrders(res.orders)
      setStatus(null)
    } else {
      setStatus(res)
    }
  }

  /* Poll rather than push. A websocket would be better but needs
     infrastructure this host does not have; twenty seconds is well inside
     the time it takes to cook, and the quiet flag stops the list flickering
     under someone's finger. */
  useEffect(() => {
    load(false)
    clearInterval(timer.current)
    timer.current = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, eventId, truckId, connected])

  const assign = async (order, truckId) => {
    setBusyId(order.order_id)
    const res = await setOrderTruck(order.order_id, truckId)
    setBusyId(null)
    if (!res.ok) { setStatus(res); return }
    setOrders(list => list.map(o => o.order_id === res.order.order_id ? res.order : o))
  }

  const counts = KITCHEN_STATES.reduce((acc, s) => {
    acc[s.id] = orders.filter(o => o.kitchen_status === s.id).length
    return acc
  }, {})
  const shown = ['received', 'preparing', 'ready'].includes(filter)
    ? orders.filter(o => o.kitchen_status === filter)
    : orders

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 19, fontWeight: 800 }}>Live Orders</h1>
        {loading && <span style={muted}>Loading…</span>}
        <div style={{ flex: 1 }} />
        <span style={muted}>
          {lastAt ? 'Updated ' + new Date(lastAt).toLocaleTimeString() : ''}
          {' · refreshes every ' + (REFRESH_MS / 1000) + 's'}
        </span>
        <button onClick={() => load(false)} style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: '6px 11px',
          fontSize: 11.5, background: '#fff', cursor: 'pointer',
        }}>Refresh</button>
      </div>

      <div style={{ ...muted, marginBottom: 16, lineHeight: 1.5 }}>
        Orders from the customer apps, as the kitchen works them. The kitchen tablet
        accepts, marks ready, hands over and cancels; this screen watches. Payment is
        taken at the truck.
      </div>

      {!connected && (
        <Callout tone="amber">
          No API token yet. Add one in <b>Sync → App publishing</b> to see orders.
        </Callout>
      )}

      {status && !status.ok && <Callout tone="red">{status.message}</Callout>}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Seg
          options={[['active', 'In kitchen' + (orders.length && ['active','received','preparing','ready'].includes(filter) ? ' · ' + orders.length : '')],
                    ['received', 'New' + (counts.received ? ' · ' + counts.received : '')],
                    ['preparing', 'Cooking' + (counts.preparing ? ' · ' + counts.preparing : '')],
                    ['ready', 'Ready' + (counts.ready ? ' · ' + counts.ready : '')],
                    ['collected', 'Collected'],
                    ['cancelled', 'Cancelled'],
                    ['all', 'All']]}
          value={filter}
          onChange={setFilter}
        />
        <div style={{ flex: 1 }} />
        <select value={truckId} onChange={e => setTruckId(e.target.value)} style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
          fontSize: 12, background: '#fff',
        }}>
          <option value="">All trucks</option>
          <option value="unassigned">Unassigned only</option>
          {loadTrucks().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={eventId} onChange={e => setEventId(e.target.value)} style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
          fontSize: 12, background: '#fff',
        }}>
          <option value="">All events</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      {connected && !shown.length && !loading && (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🛎</div>
          <b style={{ fontSize: 14 }}>Nothing here yet</b>
          <div style={{ ...muted, marginTop: 6, lineHeight: 1.6, maxWidth: 460, margin: '6px auto 0' }}>
            {filter === 'all'
              ? 'No app orders have come through. The apps need a build that submits orders before anything appears here.'
              : 'No orders in this state right now.'}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {shown.map(o => (
          <OrderCard
            key={o.order_id}
            order={o}
            busy={busyId === o.order_id}
            onAssign={assign}
          />
        ))}
      </div>
    </div>
  )
}

/* ---------------- one order ---------------- */

function OrderCard({ order, busy, onAssign }) {
  const ks = kitchenState(order.kitchen_status)
  const done = ks.id === 'collected' || ks.id === 'cancelled'

  const placed = order.placed_at ? new Date(order.placed_at) : null
  const minsAgo = placed ? Math.round((Date.now() - placed.getTime()) / 60000) : null
  const t = iso => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

  // The kitchen's timeline for this order, in the order it happened.
  const steps = [
    ['Placed', t(order.placed_at)],
    ['Accepted', t(order.accepted_at)],
    ['Ready', t(order.ready_at)],
    ks.id === 'cancelled' ? ['Cancelled', t(order.cancelled_at)] : ['Collected', t(order.completed_at)],
  ]

  return (
    <div className="card" style={{ padding: 14, display: 'flex', gap: 16, alignItems: 'flex-start' }}>

      {/* The code is what gets said out loud, so it is the biggest thing here. */}
      <div style={{ minWidth: 104 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>
          {order.collection_code || '—'}
        </div>
        <div style={{ ...muted, marginTop: 2 }}>#{order.order_id}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <Pill tone={ks.tone}>{ks.label}</Pill>
          {order.customer && <b style={{ fontSize: 13 }}>{order.customer}</b>}
          {order.platform && <span style={muted}>{order.platform}</span>}
          {minsAgo != null && (
            <span style={{
              ...muted,
              color: !done && minsAgo >= 10 ? 'var(--red)' : 'var(--ink-3)',
              fontWeight: !done && minsAgo >= 10 ? 700 : 400,
            }}>
              {minsAgo < 1 ? 'just now' : minsAgo + ' min ago'}
            </span>
          )}
          {order.edits && order.edits.length > 0 && <Pill tone="amber">edited</Pill>}
        </div>

        <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
          {(order.items || []).map((it, i) => (
            <div key={i}>
              <b>{it.quantity}×</b> {it.name}
              {it.extras && <span style={muted}> + {it.extras}</span>}
              {it.note && <span style={{ ...muted, fontStyle: 'italic' }}> “{it.note}”</span>}
            </div>
          ))}
          {(order.fees || []).map((f, i) => (
            <div key={'f' + i} style={muted}>{f.name} · {f.total}</div>
          ))}
        </div>

        {order.note && <div style={{ ...muted, marginTop: 4, fontStyle: 'italic' }}>Guest: “{order.note}”</div>}
        {order.phone && <div style={{ ...muted, marginTop: 4 }}>{order.phone}</div>}

        {ks.id === 'cancelled' && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>
            Cancelled — {CANCEL_REASON_LABELS[order.cancel_reason_code] || order.cancel_reason_code || 'no reason recorded'}
            {order.cancel_reason && <span style={{ fontWeight: 400 }}> · “{order.cancel_reason}”</span>}
          </div>
        )}

        {order.edits && order.edits.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>
            {order.edits.map((e, i) => (
              <div key={i}>
                <b>Edited</b> {t(e.at)} by {e.by}: {e.summary}
                <span style={muted}> ({e.old_total} → {e.new_total})</span>
              </div>
            ))}
          </div>
        )}

        {/* Assignment is manual and still the office's call. The list is
            limited to trucks actually deployed to this order's event, and
            the server re-checks that. */}
        {!done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={muted}>Truck</span>
            <select
              value={order.truck || ''}
              disabled={busy}
              onChange={e => onAssign(order, e.target.value)}
              style={{
                border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px',
                fontSize: 12, background: '#fff',
                color: order.truck ? 'var(--ink)' : 'var(--ink-3)',
              }}>
              <option value="">Unassigned</option>
              {trucksAtEvent(order.event).map(tr => (
                <option key={tr.id} value={tr.id}>{tr.name}</option>
              ))}
            </select>
            {!order.truck && <span style={{ ...muted, color: 'var(--mc-orange-deep)' }}>needs a truck</span>}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right', minWidth: 130 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>
          {order.total} {order.currency}
        </div>
        {/* What the kitchen did, and when. No buttons: status is the tablet's. */}
        <div style={{ display: 'grid', gap: 2, fontSize: 11 }}>
          {steps.map(([label, when]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: when ? 'var(--ink-2)' : 'var(--ink-3)' }}>
              <span>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{when || '—'}</span>
            </div>
          ))}
        </div>
        <div style={{ ...muted, marginTop: 8 }}>rev {order.revision || 1}</div>
      </div>
    </div>
  )
}

/* ---------------- bits ---------------- */

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg)', borderRadius: 8, padding: 2 }}>
      {options.map(([id, label]) => {
        const on = id === value
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: 'pointer',
            padding: '7px 13px', borderRadius: 7,
            background: on ? 'var(--mc-orange)' : 'transparent',
            color: on ? '#fff' : 'var(--ink-2)',
          }}>{label}</button>
        )
      })}
    </div>
  )
}

function Callout({ tone, children }) {
  const [bg, fg] = TONES[tone] || TONES.gray
  return (
    <div style={{
      background: bg, color: fg, borderRadius: 8, padding: '10px 12px',
      fontSize: 11.5, lineHeight: 1.55, marginBottom: 14,
    }}>{children}</div>
  )
}
