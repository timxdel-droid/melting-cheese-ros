import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DevicePreview from '../components/DevicePreview.jsx'
import {
  loadEvents, loadSyncedProducts, loadLayouts, saveLayouts, blankLayout,
  loadBannerPacks, saveBannerPacks, PLACEMENTS, VARIANTS, RENDITIONS,
  buildAppConfig, publishAppConfig, loadPublishState, hasWpAuth,
  uploadMedia, loadConnectors, packArt, packComplete,
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

  /* Records one uploaded crop. Passing null clears it, which is how a wrong
     file gets replaced — the pack is the record of what is published, so a
     bad upload must be removable without deleting the whole pack. */
  const patchArt = (variant, rendition, url) => {
    const art = { ...(pack.art || {}) }
    const set = { ...(art[variant] || {}) }
    if (url) set[rendition] = url
    else delete set[rendition]
    if (Object.keys(set).length) art[variant] = set
    else delete art[variant]
    patchPack({ art, complete: packComplete({ ...pack, art }) })
  }

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
          every concept keeps Text + CTA, Text without button, and Image-only versions. Each can
          carry app, mobile, tablet and desktop crops, but only the app crop is needed to go live —
          the rest fall back to it. Placement is event-specific; the Header Banner remains the first
          editable home-content slot.
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
              {/* Derived from the artwork actually on the pack rather than a
                  stored flag, which used to claim COMPLETE for packs that had
                  never had a file uploaded. */}
              <span className={'pill ' + (packComplete(pack) ? 'green' : 'orange')} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {packComplete(pack) ? 'COMPLETE' : 'NEEDS ARTWORK'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {VARIANTS.map(v => (
                <VariantColumn
                  key={v.id}
                  variant={v}
                  pack={pack}
                  connected={connected}
                  onArt={(rendition, url) => patchArt(v.id, rendition, url)}
                />
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
              <div style={{ ...muted, marginBottom: 5 }}>Crops carried by this pack</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RENDITIONS.map(r => {
                  const have = VARIANTS.filter(v => pack.art && pack.art[v.id] && pack.art[v.id][r.id]).length
                  return (
                    <span key={r.id}
                      className={'pill ' + (have === VARIANTS.length ? 'green' : have ? 'orange' : 'gray')}
                      style={{ fontFamily: 'monospace', fontSize: 10 }}
                      title={r.label + ' ' + r.size + ' — ' + have + ' of ' + VARIANTS.length + ' variants uploaded'}>
                      {r.size} · {have}/{VARIANTS.length}
                    </span>
                  )
                })}
              </div>
              <div style={{ ...muted, marginTop: 7, lineHeight: 1.5 }}>
                Only the <b>{RENDITIONS[0].size}</b> crop is needed to go live. The others are
                different shapes rather than different sizes, so they can’t be generated from
                it — until one is uploaded, that device falls back to the app crop.
              </div>
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

/* ---------------- one variant, with its four crops ---------------- */

/* A column per variant. The app crop leads because it is the one that has to
   exist; the other three sit under it as a compact row, each showing either
   its own artwork or the fact that it is borrowing the app crop. */
function VariantColumn({ variant, pack, connected, onArt }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const lead = packArt(pack, variant.id, 'app')

  const send = async (rendition, file) => {
    if (!file) return
    setError(null)
    setBusy(rendition)
    const res = await uploadMedia(loadConnectors(), file)
    setBusy(null)
    if (res.ok) onArt(rendition, res.image.src)
    else setError(res.message)
  }

  return (
    <div style={{
      border: '1px solid ' + (variant.id === 'cta' ? 'var(--mc-orange)' : 'var(--line)'),
      borderRadius: 9, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <CropSlot
        rendition={RENDITIONS[0]}
        url={lead}
        busy={busy === 'app'}
        disabled={!connected}
        height={74}
        onFile={f => send('app', f)}
        onClear={() => onArt('app', null)}
      />

      <div style={{ padding: '8px 9px', flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700 }}>{variant.label}</div>
        <div style={{ ...muted, marginTop: 2, lineHeight: 1.4 }}>{variant.note}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, marginTop: 8 }}>
          {RENDITIONS.slice(1).map(r => (
            <CropSlot
              key={r.id}
              rendition={r}
              url={pack.art && pack.art[variant.id] ? pack.art[variant.id][r.id] : null}
              inherited={lead}
              busy={busy === r.id}
              disabled={!connected || !lead}
              height={34}
              compact
              onFile={f => send(r.id, f)}
              onClear={() => onArt(r.id, null)}
            />
          ))}
        </div>

        {error && (
          <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 6, lineHeight: 1.4 }}>{error}</div>
        )}
        {!connected && (
          <div style={{ ...muted, marginTop: 6 }}>Add the API token in Sync to upload.</div>
        )}
      </div>
    </div>
  )
}

/* One upload target. Shows the artwork when there is some, the crop it is
   borrowing when there is not, and a spinner while a file is in flight. */
function CropSlot({ rendition, url, inherited, busy, disabled, height, compact, onFile, onClear }) {
  const input = useRef(null)
  const shown = url || inherited
  const borrowed = !url && !!inherited

  return (
    <div
      title={rendition.label + ' · ' + rendition.size + (borrowed ? ' — using the app crop until one is uploaded' : '')}
      onDragOver={e => { if (!disabled) e.preventDefault() }}
      onDrop={e => {
        if (disabled) return
        e.preventDefault()
        onFile(e.dataTransfer.files[0])
      }}
      style={{
        height, position: 'relative', cursor: disabled ? 'default' : 'pointer',
        background: shown ? '#00000010' : 'var(--surface-alt, #F4F2EE)',
        backgroundImage: shown ? 'url(' + shown + ')' : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center',
        borderTop: compact ? '1px solid var(--line)' : 'none',
        borderRadius: compact ? 5 : 0,
        opacity: borrowed ? 0.45 : 1,
        display: 'grid', placeItems: 'center',
      }}
      onClick={() => { if (!disabled) input.current.click() }}>

      {busy && (
        <span style={{
          fontSize: compact ? 8 : 10, fontWeight: 700, background: '#000000AA',
          color: '#fff', padding: '2px 6px', borderRadius: 4,
        }}>Uploading…</span>
      )}

      {!busy && !shown && (
        <span style={{ fontSize: compact ? 8 : 10.5, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.3 }}>
          {compact ? rendition.size.split('×')[0] + 'w' : 'Drop ' + rendition.size}
        </span>
      )}

      {!busy && url && (
        <button
          onClick={e => { e.stopPropagation(); onClear() }}
          title="Remove this crop"
          style={{
            position: 'absolute', top: 2, right: 2, width: 15, height: 15, lineHeight: '13px',
            borderRadius: 4, border: 'none', background: '#000000AA', color: '#fff',
            fontSize: 10, cursor: 'pointer', padding: 0,
          }}>×</button>
      )}

      <input ref={input} type="file" accept="image/*" hidden
        onChange={e => { const f = e.target.files[0]; e.target.value = ''; onFile(f) }} />
    </div>
  )
}
