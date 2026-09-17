import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DevicePreview from '../components/DevicePreview.jsx'
import {
  loadEvents, loadSyncedProducts, loadLayouts, saveLayouts, blankLayout,
  loadBannerPacks, saveBannerPacks, PLACEMENTS, VARIANTS, RENDITIONS,
  buildAppConfig, publishAppConfig, loadPublishState, hasWpAuth,
} from '../lib/connectors.js'

/* Screen: Content & App › Banner Library

   Every campaign pack keeps three controlled variants — text + CTA, text
   without a button, and image only — with app, mobile, tablet and desktop
   renditions. Placement is per event: the Header Banner is pinned as the
   first content slot, while mid-page and video art move between aisles. */

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const field = { ...sel, width: '100%' }
const tag = { fontSize: 9, fontWeight: 800, letterSpacing: .6, padding: '3px 7px', borderRadius: 5 }

const STATUS = { live: ['green', 'LIVE'], scheduled: ['orange', 'SCHEDULED'], draft: ['gray', 'DRAFT'] }

export default function BannerLibrary() {
  const nav = useNavigate()
  const events = loadEvents()
  const sync = loadSyncedProducts()
  const catalogue = [...new Set(((sync && sync.items) || []).map(i => i.cat))]

  const [packs, setPacks] = useState(loadBannerPacks)
  const [eventId, setEventId] = useState(events[0]?.id || 'global')
  const [selected, setSelected] = useState(packs[0]?.id)
  const [layouts, setLayouts] = useState(loadLayouts)
  const [busy, setBusy] = useState(false)
  const [published, setPublished] = useState(loadPublishState)
  const connected = hasWpAuth()

  const layout = layouts[eventId] || blankLayout()
  const event = events.find(e => e.id === eventId)
  const pack = packs.find(p => p.id === selected) || packs[0]

  const savePacks = next => { setPacks(next); saveBannerPacks(next) }
  const patchPack = patch => savePacks(packs.map(p => p.id === pack.id ? { ...p, ...patch } : p))

  const setLayout = patch => {
    const next = { ...layouts, [eventId]: { ...layout, ...patch, changes: (layout.changes || 0) + 1 } }
    setLayouts(next); saveLayouts(next)
  }

  /* Which pack currently sits in each placement, for this event only. */
  const inPlacement = {
    header: packs.find(p => p.id === layout.headerPack),
    midpage: packs.find(p => p.id === layout.midPack),
    video: packs.find(p => p.id === layout.videoPack),
  }

  const assign = placement => {
    const key = placement === 'header' ? 'headerPack' : placement === 'midpage' ? 'midPack' : 'videoPack'
    setLayout({ [key]: pack.id })
  }

  /* Publishing sends the whole config — layouts and packs together — so the
     apps can never end up with a banner assigned to a placement they don't
     know about. */
  const publish = async () => {
    setBusy(true)
    const res = await publishAppConfig(buildAppConfig(layouts, packs, events, eventId))
    setBusy(false)
    setPublished(loadPublishState())
    window.alert(res.ok ? 'Live in the apps.\n\n' + res.message : 'Not published.\n\n' + res.message)
  }

  const newPack = () => {
    const name = window.prompt('Campaign name')
    if (!name || !name.trim()) return
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28) + '-' + Date.now().toString(36).slice(-3)
    const p = {
      id, name: name.trim(), purpose: 'New campaign', headline: name.trim().toUpperCase(),
      cta: 'View the menu', deepLink: 'app://menu', audience: 'All app users',
      status: 'draft', placement: null, complete: false,
    }
    savePacks([...packs, p]); setSelected(id)
  }

  return (
    <div style={{ display: 'flex', margin: -18, minHeight: 'calc(100vh - 130px)' }}>
      <div style={{ flex: 1, minWidth: 0, padding: 18, display: 'grid', gap: 14, alignContent: 'start' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={muted}>Content &amp; App / Banner Library</div>
            <h2 style={{ margin: '2px 0 2px', fontSize: 18 }}>Responsive Banner Library</h2>
            <div style={muted}>
              Select a campaign pack, see every live placement for the chosen event, then assign or move it.
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button style={sel} onClick={() => window.alert('Asset upload needs media storage — see the release blockers in the brief.')}>
            Upload assets
          </button>
          <button style={sel} onClick={newPack}>+ New banner pack</button>
          <button className="btn-primary" style={{ fontSize: 12.5 }} onClick={publish} disabled={busy || !connected}>
            {busy ? 'Publishing…' : 'Publish to apps'}
          </button>
        </div>

        <div style={{ ...muted, marginTop: -6 }}>
          {published
            ? 'Apps are on version ' + published.version + ' (' + published.banners + ' packs) · published ' +
              new Date(published.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : connected ? 'Never published to the apps' : 'Connect a WordPress Application Password in Sync to publish'}
        </div>

        <div style={{
          background: 'var(--amber-chip)', border: '1px solid var(--mc-orange)', borderRadius: 10,
          padding: '11px 13px', fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.55,
        }}>
          <b style={{ color: 'var(--mc-orange-deep)' }}>Banner rule:</b>{' '}
          every concept retains Text + CTA, Text without button, and Image-only versions with app,
          mobile, tablet and desktop crops. Placement is event-specific; the Header Banner remains
          the first editable home-content slot.
        </div>

        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--amber-chip)', display: 'grid', placeItems: 'center' }}>▩</div>
          <div>
            <b style={{ fontSize: 13 }}>Banner placements for {event?.name || 'Global default'}</b>
            <div style={muted}>Select an event to inspect or change its independent banner layout</div>
          </div>
          <div style={{ flex: 1 }} />
          <div>
            <div style={{ ...muted, marginBottom: 3 }}>Event / location context</div>
            <select style={{ ...sel, minWidth: 210 }} value={eventId} onChange={e => setEventId(e.target.value)}>
              {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              <option value="global">Global default</option>
            </select>
          </div>
          <button style={{ ...sel, alignSelf: 'flex-end' }} onClick={() => nav('/content/home-builder')}>Open Home Builder</button>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <b style={{ fontSize: 13.5 }}>Where banners appear</b>
              <div style={muted}>Use the arrows to move support media among category aisles; Header Banner is pinned</div>
            </div>
            <div style={{ flex: 1 }} />
            <span className="pill blue" style={{ letterSpacing: .6 }}>PLACEMENT MAP</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
            {PLACEMENTS.map(pl => {
              const cur = inPlacement[pl.id]
              return (
                <div key={pl.id} style={{
                  border: '1px solid ' + (pl.pinned ? 'var(--mc-orange)' : 'var(--line)'),
                  borderRadius: 10, padding: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--amber-chip)', color: 'var(--mc-orange-deep)', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800 }}>{pl.badge}</span>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{pl.name}</div>
                      <div style={{ ...muted, fontSize: 10 }}>{pl.note}</div>
                    </div>
                  </div>
                  <div style={{
                    height: 62, borderRadius: 7, marginTop: 10,
                    background: cur ? 'linear-gradient(135deg,#FFC93C,#F5A623)' : 'var(--surface-alt)',
                    border: cur ? 'none' : '1px dashed var(--line)',
                    display: 'grid', placeItems: 'center', padding: 8, textAlign: 'center',
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, lineHeight: 1.2 }}>
                      {cur ? cur.headline : 'Empty slot'}
                    </span>
                  </div>
                  <div style={{ ...muted, marginTop: 7, minHeight: 15 }}>{cur ? cur.name : 'Nothing assigned for this event'}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button style={{ ...sel, fontSize: 11, padding: '5px 10px' }} onClick={() => assign(pl.id)}>
                      Place selected
                    </button>
                    {pl.pinned ? (
                      <span style={{ ...tag, background: 'var(--surface-alt)', color: 'var(--ink-3)', alignSelf: 'center' }}>PINNED</span>
                    ) : cur && (
                      <>
                        <button style={{ ...sel, fontSize: 11, padding: '5px 9px' }}
                          onClick={() => setLayout(pl.id === 'midpage' ? { midAfter: Math.max(0, (layout.midAfter || 0) - 1) } : { videoAfter: Math.max(0, (layout.videoAfter || 0) - 1) })}>↑</button>
                        <button style={{ ...sel, fontSize: 11, padding: '5px 9px' }}
                          onClick={() => setLayout(pl.id === 'midpage' ? { midAfter: (layout.midAfter || 0) + 1 } : { videoAfter: (layout.videoAfter || 0) + 1 })}>↓</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Two cards side by side when there is room, stacked when the device
            preview on the right has eaten the width. Below ~740px of usable
            width the packs list was down to ~300px: names broke one word
            per line and the status pills were clipped off the edge. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>Banner packs</b>
                <div style={muted}>Select a concept to edit or place</div>
              </div>
              <div style={{ flex: 1 }} />
              <span className="pill gray" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{packs.length} PACKS</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {packs.map(p => {
                const on = p.id === pack.id
                const placedAs = Object.entries(inPlacement).find(([, v]) => v && v.id === p.id)
                const [cls, label] = STATUS[p.status] || STATUS.draft
                return (
                  <button key={p.id} onClick={() => setSelected(p.id)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', width: '100%',
                    border: '1px solid ' + (on ? 'var(--mc-orange)' : 'var(--line)'),
                    borderRadius: 10, padding: '11px 12px', cursor: 'pointer', background: 'var(--surface)',
                  }}>
                    <span style={{ width: 52, height: 34, borderRadius: 5, background: 'linear-gradient(135deg,#FFC93C,#F5A623)', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</span>
                      <span style={{ display: 'block', ...muted, marginTop: 3, lineHeight: 1.45 }}>
                        {p.purpose}{placedAs ? ' · ' + PLACEMENTS.find(x => x.id === placedAs[0]).name : ' · available in library'}
                      </span>
                    </span>
                    {/* Never let the pill shrink or wrap - it is the one thing
                        an operator scans this list for. */}
                    <span className={'pill ' + cls} style={{ flexShrink: 0, whiteSpace: 'nowrap', marginTop: 2 }}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>{pack.name}</b>
                <div style={muted}>Three controlled responsive variants</div>
              </div>
              <div style={{ flex: 1 }} />
              <span className={'pill ' + (pack.complete ? 'green' : 'orange')} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {pack.complete ? 'COMPLETE' : 'NEEDS ARTWORK'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {VARIANTS.map(v => (
                <div key={v.id} style={{
                  border: '1px solid ' + (v.id === 'cta' ? 'var(--mc-orange)' : 'var(--line)'),
                  borderRadius: 9, overflow: 'hidden',
                }}>
                  <div style={{
                    height: 74, background: v.id === 'image' ? '#8C6A3A' : 'linear-gradient(135deg,#FFC93C,#F5A623)',
                    padding: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  }}>
                    {v.id !== 'image' && (
                      <>
                        <div style={{ fontSize: 8, fontWeight: 800, lineHeight: 1.1 }}>{pack.headline.split('.')[0]}.</div>
                        <div style={{ fontSize: 7.5, fontWeight: 800, color: 'var(--mc-orange-deep)' }}>{pack.headline.split('.')[1] || ''}</div>
                      </>
                    )}
                    {v.id === 'cta' && (
                      <span style={{ marginTop: 5, alignSelf: 'flex-start', background: '#1C1C1E', color: '#fff', fontSize: 6.5, fontWeight: 700, padding: '3px 6px', borderRadius: 4 }}>{pack.cta}</span>
                    )}
                  </div>
                  <div style={{ padding: '8px 9px' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700 }}>{v.label}</div>
                    <div style={{ ...muted, marginTop: 2, lineHeight: 1.4 }}>{v.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 13 }}>
              <label>
                <div style={{ ...muted, marginBottom: 3 }}>Campaign headline</div>
                <input style={field} value={pack.headline} onChange={e => patchPack({ headline: e.target.value })} />
              </label>
              <label>
                <div style={{ ...muted, marginBottom: 3 }}>CTA label</div>
                <input style={field} value={pack.cta} onChange={e => patchPack({ cta: e.target.value })} />
              </label>
              <label>
                <div style={{ ...muted, marginBottom: 3 }}>Deep link</div>
                <input style={{ ...field, fontFamily: 'monospace', fontSize: 11 }} value={pack.deepLink} onChange={e => patchPack({ deepLink: e.target.value })} />
              </label>
              <label>
                <div style={{ ...muted, marginBottom: 3 }}>Audience</div>
                <select style={field} value={pack.audience} onChange={e => patchPack({ audience: e.target.value })}>
                  {['All app users', 'New customers', 'Returning customers', 'Event attendees'].map(a => <option key={a}>{a}</option>)}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 13 }}>
              <div style={{ ...muted, marginBottom: 5 }}>Responsive renditions required</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RENDITIONS.map(r => (
                  <span key={r} className={'pill ' + (pack.complete ? 'green' : 'gray')} style={{ fontFamily: 'monospace', fontSize: 10 }}>{r}</span>
                ))}
              </div>
              {!pack.complete && (
                <div style={{ ...muted, marginTop: 7, color: 'var(--mc-orange-deep)' }}>
                  Artwork isn’t uploaded for this pack. Media storage is a release blocker in the brief.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <DevicePreview
        title="Banner placement in customer app"
        layout={layout}
        packs={packs}
        categories={catalogue}
        note={'Placement preview: Header Banner after location selection. Assignment stays specific to ' + (event?.name || 'the global default') + '.'}
      />
    </div>
  )
}
