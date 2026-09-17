import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DevicePreview from '../components/DevicePreview.jsx'
import {
  loadEvents, loadSyncedProducts, loadLayouts, saveLayouts, blankLayout,
  loadBannerPacks, FIXED_FRAME, saveEvents,
  buildAppConfig, publishAppConfig, loadPublishState, hasWpAuth,
} from '../lib/connectors.js'

/* Screen: Content & App › Home Builder

   Builds the event-specific customer home page. The application frame is
   protected: welcome/sign-in, search, the location selector and the
   five-item footer are fixed and never enter the drag order. The first
   editable slot is always the Header Banner, followed by Food Hall
   Categories, which reads its order from the event's menu. */

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const tag = { fontSize: 9, fontWeight: 800, letterSpacing: .6, padding: '3px 7px', borderRadius: 5 }

export default function HomeBuilder() {
  const nav = useNavigate()
  const [events, setEvents] = useState(loadEvents)
  const packs = loadBannerPacks()
  const sync = loadSyncedProducts()

  const [eventId, setEventId] = useState(events[0]?.id || 'global')
  const [layouts, setLayouts] = useState(loadLayouts)
  const [busy, setBusy] = useState(false)

  const eventRecord = events.find(e => e.id === eventId)
  const liveCount = events.filter(e => e.live !== false).length

  /* Venue and visibility live on the event record, not the layout, so they
     survive layout edits and apply to every channel. */
  const patchEvent = patch => {
    const next = events.map(e => e.id === eventId ? { ...e, ...patch } : e)
    setEvents(next)
    saveEvents(next)
  }
  const [published, setPublished] = useState(loadPublishState)
  const connected = hasWpAuth()

  const catalogue = [...new Set(((sync && sync.items) || []).map(i => i.cat))]
  const event = events.find(e => e.id === eventId)

  /* Seed a layout the first time an event is opened, using the live catalogue. */
  useEffect(() => {
    if (layouts[eventId]) return
    const seeded = blankLayout()
    seeded.aisles = catalogue.slice(0, 4).map(c => ({ cat: c, on: true }))
    const next = { ...layouts, [eventId]: seeded }
    setLayouts(next); saveLayouts(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const layout = layouts[eventId] || blankLayout()

  const update = patch => {
    const next = { ...layouts, [eventId]: { ...layout, ...patch, changes: (layout.changes || 0) + 1 } }
    setLayouts(next); saveLayouts(next)
  }

  const move = (i, dir) => {
    const a = [...layout.aisles]
    const j = i + dir
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    update({ aisles: a })
  }

  const toggle = i => update({ aisles: layout.aisles.map((a, n) => n === i ? { ...a, on: !a.on } : a) })

  const addAisle = () => {
    const used = layout.aisles.map(a => a.cat)
    const spare = catalogue.find(c => !used.includes(c))
    if (!spare) { window.alert('Every synced category is already placed on this event.'); return }
    update({ aisles: [...layout.aisles, { cat: spare, on: true }] })
  }

  const copyGlobal = () => {
    const src = layouts.global
    if (!src) { window.alert('No global default saved yet. Build one on the Global default event first.'); return }
    if (!window.confirm('Replace this event’s layout with the global structure? Other events are unaffected.')) return
    const next = { ...layouts, [eventId]: { ...JSON.parse(JSON.stringify(src)), changes: (layout.changes || 0) + 1 } }
    setLayouts(next); saveLayouts(next)
  }

  /* Saving keeps the layout in ROS. Publishing sends every event layout and
     banner pack to the apps in one atomic write, so the apps never see a
     half-updated config. */
  const save = () => {
    const next = { ...layouts, [eventId]: { ...layout, changes: 0, savedAt: Date.now() } }
    setLayouts(next); saveLayouts(next)
  }

  const publish = async () => {
    const next = { ...layouts, [eventId]: { ...layout, changes: 0, savedAt: Date.now() } }
    setLayouts(next); saveLayouts(next)

    setBusy(true)
    const payload = buildAppConfig(next, packs, events, eventId)
    const res = await publishAppConfig(payload)
    setBusy(false)
    setPublished(loadPublishState())
    window.alert(res.ok
      ? 'Live in the apps.\n\n' + res.message + '\n\nCustomers see it on next launch, or within a minute if the app is already open.'
      : 'Not published.\n\n' + res.message)
  }

  const pack = id => packs.find(p => p.id === id)
  const header = pack(layout.headerPack)
  const changes = layout.changes || 0

  return (
    <div style={{ display: 'flex', margin: -18, minHeight: 'calc(100vh - 130px)' }}>
      <div style={{ flex: 1, minWidth: 0, padding: 18, display: 'grid', gap: 14, alignContent: 'start' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={muted}>Content &amp; App / Home Builder</div>
            <h2 style={{ margin: '2px 0 2px', fontSize: 18 }}>Customer App Home Builder</h2>
            <div style={muted}>
              Build the event-specific customer home page. Only Content &amp; App screens carry the live device frame.
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button style={sel} onClick={addAisle}>+ Add content block</button>
          <button className="btn-primary" style={{ fontSize: 12.5 }} onClick={() => nav('/content/banners')}>
            Open Banner Library
          </button>
        </div>

        <div style={{
          background: 'var(--amber-chip)', border: '1px solid var(--mc-orange)', borderRadius: 10,
          padding: '11px 13px', fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.55,
        }}>
          <b style={{ color: 'var(--mc-orange-deep)' }}>The application frame is protected.</b>{' '}
          Welcome/Sign in, search, location selection and the app footer are fixed. Header banners,
          event category aisles, support banners and video art are controlled per event. Categories
          come from Menu &amp; Categories; banner artwork comes from the Banner Library.
        </div>

        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--amber-chip)', display: 'grid', placeItems: 'center' }}>◈</div>
          <div>
            <b style={{ fontSize: 13 }}>Editing event home layout</b>
            <div style={muted}>Event layout · changes here do not alter the other event layouts</div>
          </div>
          <div style={{ flex: 1 }} />
          <div>
            <div style={{ ...muted, marginBottom: 3 }}>Event / location context</div>
            <select style={{ ...sel, minWidth: 210 }} value={eventId} onChange={e => setEventId(e.target.value)}>
              {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              <option value="global">Global default</option>
            </select>
          </div>
          <button style={{ ...sel, alignSelf: 'flex-end' }} onClick={copyGlobal}>Copy global structure</button>
        </div>

        {/* Where this event physically is, and whether customers can pick it.
            Only events switched on here appear in the app's location selector. */}
        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 240 }}>
            <div style={{ ...muted, marginBottom: 3 }}>Venue · shown under the event name in the apps</div>
            <input
              style={{ ...sel, width: '100%' }}
              placeholder="e.g. Dubai World Trade Centre"
              value={eventRecord?.venue || ''}
              disabled={!eventRecord}
              onChange={e => patchEvent({ venue: e.target.value })}
            />
          </label>

          <div>
            <div style={{ ...muted, marginBottom: 3 }}>Live in the apps</div>
            <button
              onClick={() => patchEvent({ live: eventRecord?.live === false })}
              disabled={!eventRecord}
              style={{
                ...sel, cursor: eventRecord ? 'pointer' : 'not-allowed', fontWeight: 700,
                color: eventRecord?.live === false ? 'var(--ink-3)' : '#fff',
                background: eventRecord?.live === false ? 'var(--surface-alt)' : 'var(--green)',
                border: 'none', minWidth: 120,
              }}
            >
              {eventRecord?.live === false ? 'Hidden' : 'Showing'}
            </button>
          </div>

          <div style={{ ...muted, flexBasis: '100%', lineHeight: 1.5 }}>
            {liveCount === 0
              ? 'No events are showing — customers would see an empty location picker.'
              : liveCount + ' of ' + events.length + ' events appear in the picker. Hidden events keep their layout for next time.'}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 11 }}>
            <div>
              <b style={{ fontSize: 13.5 }}>Fixed application frame</b>
              <div style={muted}>Visible in the preview but excluded from drag-and-drop ordering</div>
            </div>
            <div style={{ flex: 1 }} />
            <span className="pill blue" style={{ letterSpacing: .6 }}>LOCKED</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 11 }}>
            {FIXED_FRAME.map(f => (
              <div key={f.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--surface-alt)' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--surface)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 12 }}>{f.icon}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ ...tag, background: '#F0F0F3', color: 'var(--ink-3)' }}>FIXED</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>{f.title}</div>
                <div style={{ ...muted, marginTop: 3, lineHeight: 1.45 }}>{f.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <b style={{ fontSize: 13.5 }}>{event?.name || 'Global default'} · home content order</b>
              <div style={muted}>Header and Food Hall Categories remain first; the aisles and support media below can move</div>
            </div>
            <div style={{ flex: 1 }} />
            {changes > 0 && <span className="pill orange">{changes} CHANGE{changes === 1 ? '' : 'S'}</span>}
          </div>

          {/* 1 — header banner, pinned */}
          <div style={{ border: '1px solid var(--mc-orange)', borderRadius: 10, padding: 12, marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--amber-chip)', color: 'var(--mc-orange-deep)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>1</span>
              <b style={{ fontSize: 13 }}>Header Banner</b>
              <span style={{ ...tag, background: 'var(--surface-alt)', color: 'var(--ink-3)' }}>PINNED FIRST CONTENT SLOT</span>
              <div style={{ flex: 1 }} />
              <span className="pill gray">Banner Library</span>
              <span className="pill green">LIVE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ width: 76, height: 42, borderRadius: 6, background: 'linear-gradient(135deg,#FFC93C,#F5A623)', flexShrink: 0 }} />
              <div style={{ minWidth: 140 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{header?.name || 'No banner chosen'}</div>
                <div style={muted}>{event?.name || 'Global'} · cta variant · replace without moving the slot</div>
              </div>
              <div style={{ flex: 1 }} />
              <select style={sel} value={layout.headerPack || ''} onChange={e => update({ headerPack: e.target.value })}>
                <option value="">Choose banner…</option>
                {packs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* 2 — food hall categories, pinned */}
          <div style={{ border: '1px solid var(--mc-orange)', borderRadius: 10, padding: 12, marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--amber-chip)', color: 'var(--mc-orange-deep)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>2</span>
              <b style={{ fontSize: 13 }}>Food Hall Categories</b>
              <span style={{ ...tag, background: 'var(--surface-alt)', color: 'var(--ink-3)' }}>PINNED AFTER HEADER BANNER</span>
              <div style={{ flex: 1 }} />
              <span className="pill gray">Menu &amp; Categories</span>
              <span className="pill green">LIVE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ width: 40, height: 40, borderRadius: 8, background: '#1C1C1E', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 16 }}>☰</span>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{catalogue.length} event categories</div>
                <div style={muted}>Category order, visibility and assigned home aisles come from the selected event menu</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                  {catalogue.slice(0, 4).map(c => <span key={c} className="pill orange">{c}</span>)}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <button style={sel} onClick={() => nav('/menu')}>Manage categories</button>
            </div>
          </div>

          {/* 3+ — movable aisles */}
          {layout.aisles.map((a, i) => (
            <div key={a.cat + i}>
              <div style={{
                border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 9,
                opacity: a.on ? 1 : .55,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--ink-3)', cursor: 'grab', fontSize: 13 }}>⣿</span>
                  <span style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--surface-alt)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{i + 3}</span>
                  <b style={{ fontSize: 13 }}>{a.cat}</b>
                  <span style={{ ...tag, background: 'var(--surface-alt)', color: 'var(--ink-3)' }}>CATEGORY AISLE</span>
                  <div style={{ flex: 1 }} />
                  <span className="pill gray">Menu &amp; Categories</span>
                  <button onClick={() => toggle(i)} title={a.on ? 'Hide from this event' : 'Show on this event'} style={{
                    width: 38, height: 21, borderRadius: 11, cursor: 'pointer',
                    background: a.on ? 'var(--mc-orange)' : '#D4D2DA', position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', top: 2, left: a.on ? 19 : 2, width: 17, height: 17,
                      borderRadius: 9, background: '#fff', transition: 'left .15s',
                    }} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 10 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--amber-chip)', display: 'grid', placeItems: 'center', fontSize: 17 }}>🍽</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.cat}</div>
                    <div style={muted}>Home aisle {i + 1} · {event?.name || 'Global default'}</div>
                  </div>
                  <div style={{ flex: 1 }} />
                  <button style={{ ...sel, padding: '6px 10px' }} onClick={() => move(i, -1)}>↑</button>
                  <button style={{ ...sel, padding: '6px 10px' }} onClick={() => move(i, 1)}>↓</button>
                  <button style={{ ...sel, padding: '6px 10px', color: 'var(--red)' }}
                    onClick={() => update({ aisles: layout.aisles.filter((_, n) => n !== i) })}>Remove</button>
                </div>
              </div>

              {layout.midPack && layout.midAfter === i && (
                <SupportRow label="Mid-page Banner" kind="M" name={pack(layout.midPack)?.name}
                  onUp={() => update({ midAfter: Math.max(0, i - 1) })}
                  onDown={() => update({ midAfter: Math.min(layout.aisles.length - 1, i + 1) })}
                  onClear={() => update({ midPack: null })} />
              )}
              {layout.videoPack && layout.videoAfter === i && (
                <SupportRow label="Video Banner / Art" kind="V" name={pack(layout.videoPack)?.name}
                  onUp={() => update({ videoAfter: Math.max(0, i - 1) })}
                  onDown={() => update({ videoAfter: Math.min(layout.aisles.length - 1, i + 1) })}
                  onClear={() => update({ videoPack: null })} />
              )}
            </div>
          ))}

          {!layout.midPack && (
            <button style={{ ...sel, width: '100%', marginBottom: 9, borderStyle: 'dashed' }}
              onClick={() => update({ midPack: 'main-meals', midAfter: 0 })}>
              + Add mid-page banner
            </button>
          )}
          {!layout.videoPack && (
            <button style={{ ...sel, width: '100%', borderStyle: 'dashed' }}
              onClick={() => update({ videoPack: 'craving', videoAfter: Math.max(0, layout.aisles.length - 1) })}>
              + Add video banner / art
            </button>
          )}
        </div>

        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12 }}>
            <b>{changes} unsaved change{changes === 1 ? '' : 's'}</b>
            <span style={{ ...muted, marginLeft: 8 }}>
              {published
                ? 'Apps are on version ' + published.version + ' · published ' +
                  new Date(published.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : connected ? 'Never published to the apps' : 'Connect a WordPress Application Password in Sync to publish'}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <button style={sel} onClick={() => { const n = { ...layouts }; delete n[eventId]; setLayouts(n); saveLayouts(n) }}>Discard</button>
          <button style={sel} onClick={save} disabled={!changes}>Save layout</button>
          <button className="btn-primary" style={{ fontSize: 12.5 }} onClick={publish} disabled={busy || !connected}>
            {busy ? 'Publishing…' : 'Publish to apps'}
          </button>
        </div>
      </div>

      <DevicePreview layout={layout} packs={packs} categories={catalogue} />
    </div>
  )
}

function SupportRow({ label, kind, name, onUp, onDown, onClear }) {
  return (
    <div style={{
      border: '1px dashed var(--mc-orange)', borderRadius: 10, padding: '10px 12px',
      marginBottom: 9, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
      background: 'var(--amber-chip)',
    }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', color: 'var(--mc-orange-deep)', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800 }}>{kind}</span>
      <b style={{ fontSize: 12.5 }}>{label}</b>
      <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{name}</span>
      <div style={{ flex: 1 }} />
      <button style={{ ...sel, padding: '5px 9px' }} onClick={onUp}>↑</button>
      <button style={{ ...sel, padding: '5px 9px' }} onClick={onDown}>↓</button>
      <button style={{ ...sel, padding: '5px 9px', color: 'var(--red)' }} onClick={onClear}>Remove</button>
    </div>
  )
}
