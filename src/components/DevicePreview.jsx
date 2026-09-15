import { useState, useEffect } from 'react'
import AppFrame from './AppFrame.jsx'
import { fetchAppConfig, loadSyncedProducts, APP_BUILD } from '../lib/connectors.js'

/* Live customer-device preview.

   Per the controller brief this belongs ONLY to the Content & App
   workspaces — Home Builder, Banner Library, Menu & Categories, Event Pages
   and eMenu (QR). Every operational, growth and publishing screen uses the
   full editor width and must not import this. */

const muted = { color: 'var(--ink-3)', fontSize: 11 }

const CHANNELS = [['app', 'Customer App'], ['web', 'Website'], ['emenu', 'eMenu']]
const DEVICES = [['phone', 'Phone', 320, 660], ['tabp', 'Tablet portrait', 400, 660], ['tabl', 'Tablet landscape', 470, 500]]

function Seg({ options, value, onChange, small }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg)', borderRadius: 8, padding: 2 }}>
      {options.map(o => {
        const id = o[0], label = o[1]
        const on = id === value
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            fontSize: small ? 10.5 : 11.5, fontWeight: on ? 700 : 500, cursor: 'pointer',
            padding: small ? '5px 9px' : '6px 12px', borderRadius: 7,
            background: on ? 'var(--mc-orange)' : 'transparent',
            color: on ? '#fff' : 'var(--ink-2)',
          }}>{label}</button>
        )
      })}
    </div>
  )
}

export default function DevicePreview({ title = 'Customer app home builder', layout, packs, categories, note }) {
  const [channel, setChannel] = useState('app')
  const [device, setDevice] = useState('phone')
  const [platform, setPlatform] = useState('ios')
  const [source, setSource] = useState('draft')
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(false)
  const dev = DEVICES.find(d => d[0] === device)
  const [, , w, h] = dev

  /* Live mode renders the published config — the exact bytes the iOS and
     Android apps fetch — rather than the unsaved draft in this browser.
     Same frame, real data, so there is no second copy of the UI to drift. */
  const readLive = async () => {
    setLoading(true)
    const res = await fetchAppConfig()
    setLoading(false)
    setLive(res.ok ? res.config : { error: res.message })
  }

  useEffect(() => {
    if (source === 'live' && !live) readLive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const published = live && !live.error ? live : null
  const liveEvent = published ? (published.events || []).find(e => e.id === published.default_event) || (published.events || [])[0] : null

  /* Map the published shape back onto the props the frame already renders. */
  const shown = source === 'live' && liveEvent
    ? {
        layout: {
          headerPack: liveEvent.layout?.header_pack,
          aisles: (liveEvent.layout?.categories || []).map(c => ({ cat: c.name, on: c.visible !== false })),
          midPack: liveEvent.layout?.mid?.pack_id || null,
          midAfter: liveEvent.layout?.mid?.after ?? 0,
          videoPack: liveEvent.layout?.video?.pack_id || null,
          videoAfter: liveEvent.layout?.video?.after ?? 0,
        },
        packs: (published.banners || []).map(b => ({
          id: b.id, name: b.name, headline: b.headline, cta: b.cta, status: b.status,
        })),
        categories: (liveEvent.layout?.categories || []).filter(c => c.visible !== false).map(c => c.name),
        eventName: liveEvent.name,
        eventVenue: liveEvent.venue || '',
      }
    : { layout, packs, categories, eventName: null, eventVenue: null }

  /* The frame renders the real WooCommerce catalogue, exactly as the app does. */
  const sync = loadSyncedProducts()
  const catalogue = (sync && sync.items) || []

  const catalogueCategories = [...new Set(catalogue.map(p => p.cat))]

  return (
    <div style={{
      width: 470, flex: '0 0 auto', borderLeft: '1px solid var(--line)',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--ink-3)', flex: 1 }}>
          {title.toUpperCase()}
        </span>
        <Seg options={CHANNELS} value={channel} onChange={setChannel} small />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--ink-3)' }}>PLATFORM</span>
        <div style={{ flex: 1 }} />
        <Seg options={[['ios', 'iOS'], ['android', 'Android']]} value={platform} onChange={setPlatform} small />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--ink-3)' }}>DEVICE</span>
        <div style={{ flex: 1 }} />
        <Seg options={DEVICES.map(d => [d[0], d[1]])} value={device} onChange={setDevice} small />
      </div>

      {/* Draft is what you are editing. Live is what a phone downloads. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--ink-3)' }}>SHOWING</span>
        <div style={{ flex: 1 }} />
        <Seg options={[['draft', 'Draft'], ['live', 'Live in apps']]} value={source} onChange={setSource} small />
      </div>

      {source === 'live' && (
        <div style={{
          fontSize: 11, lineHeight: 1.5, borderRadius: 8, padding: '8px 10px',
          background: published ? 'var(--green-soft)' : 'var(--amber-chip)',
          color: published ? 'var(--green)' : 'var(--mc-orange-deep)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ flex: 1 }}>
            {loading ? 'Reading the endpoint…'
              : live?.error ? 'Could not reach the app config: ' + live.error
              : !published || !published.version ? 'Nothing published yet — the apps are still showing their built-in layout.'
              : 'Version ' + published.version + ' · published by ' + (published.updated_by || 'unknown') +
                ' · ' + (published.events || []).length + ' event' + ((published.events || []).length === 1 ? '' : 's')}
          </span>
          <button onClick={readLive} style={{
            fontSize: 10.5, fontWeight: 700, cursor: 'pointer', color: 'inherit',
            border: '1px solid currentColor', borderRadius: 6, padding: '3px 8px', background: 'transparent',
          }}>Refresh</button>
        </div>
      )}

      {note && (
        <div style={{ ...muted, background: 'var(--amber-chip)', color: 'var(--mc-orange-deep)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
          {note}
        </div>
      )}

      {channel !== 'app' ? (
        <div className="card" style={{ padding: 26, textAlign: 'center', ...muted }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>{channel === 'web' ? '🖥' : '▣'}</div>
          <b style={{ fontSize: 13, color: 'var(--ink)' }}>
            {channel === 'web' ? 'Website preview' : 'eMenu (QR) preview'}
          </b>
          <div style={{ marginTop: 5 }}>
            This channel reads the same event layout. Preview rendering is not wired up yet.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <AppFrame
            width={w}
            height={h}
            layout={shown.layout}
            packs={shown.packs}
            categories={shown.categories && shown.categories.length ? shown.categories : catalogueCategories}
            catalogue={catalogue}
            eventName={shown.eventName}
            eventVenue={shown.eventVenue}
            platform={platform}
          />
        </div>
      )}

      {channel === 'app' && (
        <div style={{ ...muted, lineHeight: 1.5 }}>
          Interactive replica of <b>{platform === 'ios' ? 'iOS build ' + APP_BUILD.ios : 'the Android build'}</b> — tabs, search, category chips
          and the + buttons all work. Measurements are copied from the SwiftUI source, so
          it matches the shipped app; it is still a replica, not the binary itself.
        </div>
      )}
    </div>
  )
}
