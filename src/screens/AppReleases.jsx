import { useState, useRef } from 'react'
import {
  loadReleases, saveReleases, releaseProblems, uploadApk, hasApiToken,
  buildAppConfig, publishAppConfig, loadPublishState,
  loadLayouts, loadBannerPacks, loadEvents,
} from '../lib/connectors.js'

/* App Releases.

   ROS is the operations console — it does not update itself and has no build
   number. This screen controls the *customer* apps: the Melting Cheese
   Android app and the iOS TestFlight build, both of which read these values
   from mc/v1/app-config when they launch.

   Two levers, and they behave very differently:

     Required build  — the app refuses to run below this. Real teeth, and the
                       only irreversible thing on this screen.
     Latest build    — the app offers an update and carries on. Harmless.

   Setting a required build higher than the latest available would lock every
   customer out of the app with no way back in, so both this screen and the
   server refuse that combination outright. */

const field = {
  border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px',
  fontSize: 12.5, width: '100%', outline: 'none',
}
const mono = { ...field, fontFamily: 'monospace', fontSize: 11.5 }
const muted = { color: 'var(--ink-3)', fontSize: 11 }
const label = { fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }

export default function AppReleases() {
  const [releases, setReleases] = useState(loadReleases)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [published, setPublished] = useState(loadPublishState)

  const connected = hasApiToken()
  const problems = releaseProblems(releases)

  const patch = (platform, changes) => {
    const next = { ...releases, [platform]: { ...releases[platform], ...changes } }
    setReleases(next)
    saveReleases(next)
    setStatus(null)
  }

  const publish = async () => {
    if (problems.length) return
    setBusy(true)
    const payload = buildAppConfig(loadLayouts(), loadBannerPacks(), loadEvents(), null, releases)
    const res = await publishAppConfig(payload)
    setBusy(false)
    setStatus(res)
    if (res.ok) setPublished(res.state)
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 860 }}>
      <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 3 }}>App Releases</h1>
      <div style={{ ...muted, marginBottom: 18, lineHeight: 1.55 }}>
        Controls the <b>customer apps</b> — the Melting Cheese Android app and the iOS
        build. This console is not affected by anything on this page.
      </div>

      {!connected && (
        <Callout tone="amber">
          No API token yet. Add one in <b>Sync → App publishing</b> before uploading or publishing.
        </Callout>
      )}

      <Platform
        name="Android"
        note="Sideloaded APK. The app downloads and verifies the file, then Android asks the customer to confirm the install — no app can install silently."
        release={releases.android}
        onChange={changes => patch('android', changes)}
        allowUpload
      />

      <Platform
        name="iOS"
        note="Distributed through TestFlight, so there is no file to host. The required build still works: below it the app refuses to run and points people at TestFlight."
        release={releases.ios}
        onChange={changes => patch('ios', changes)}
      />

      {problems.length > 0 && (
        <Callout tone="red">
          <b>Not safe to publish</b>
          <ul style={{ margin: '6px 0 0 16px', lineHeight: 1.6 }}>
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </Callout>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <button
          onClick={publish}
          disabled={busy || !connected || problems.length > 0}
          style={{
            background: problems.length ? 'var(--line)' : 'var(--mc-orange)',
            color: problems.length ? 'var(--ink-3)' : '#fff',
            fontWeight: 700, fontSize: 13, padding: '10px 20px', borderRadius: 8,
            cursor: (busy || !connected || problems.length) ? 'default' : 'pointer',
          }}>
          {busy ? 'Publishing…' : 'Publish to apps'}
        </button>
        {published && (
          <span style={muted}>
            Live: version {published.version} · published by {published.updatedBy}
          </span>
        )}
      </div>

      {status && (
        <Callout tone={status.ok ? 'green' : 'red'}>{status.message}</Callout>
      )}
    </div>
  )
}

/* ---------------- one platform ---------------- */

function Platform({ name, note, release, onChange, allowUpload }) {
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)
  const [uploadMsg, setUploadMsg] = useState(null)
  const fileRef = useRef(null)

  const send = async file => {
    setUploadMsg(null)
    setUploading(true)
    setPercent(0)
    const res = await uploadApk(file, release.latestBuild, setPercent)
    setUploading(false)
    if (res.ok) {
      // Fill both fields from the server's answer. The checksum describes the
      // bytes that reached disk, so it is the one worth trusting.
      onChange({ apkUrl: res.url, sha256: res.sha256 })
      setUploadMsg({ ok: true, text: res.name + ' uploaded — ' + (res.size / 1048576).toFixed(1) + ' MB, checksum recorded.' })
    } else {
      setUploadMsg({ ok: false, text: res.message })
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
        <b style={{ fontSize: 14 }}>{name}</b>
        <div style={{ flex: 1 }} />
        {release.minBuild > 0 && (
          <span className="pill red">Forcing build {release.minBuild}+</span>
        )}
      </div>
      <div style={{ ...muted, marginBottom: 12, lineHeight: 1.5 }}>{note}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={label}>Required build</label>
          <input style={field} type="number" min="0" value={release.minBuild}
            onChange={e => onChange({ minBuild: Math.max(0, Number(e.target.value) || 0) })} />
          <div style={{ ...muted, marginTop: 3 }}>0 = no one is blocked</div>
        </div>
        <div>
          <label style={label}>Latest build</label>
          <input style={field} type="number" min="0" value={release.latestBuild}
            onChange={e => onChange({ latestBuild: Math.max(0, Number(e.target.value) || 0) })} />
          <div style={{ ...muted, marginTop: 3 }}>Offers an update above this</div>
        </div>
        <div>
          <label style={label}>Version name</label>
          <input style={field} value={release.versionName} placeholder="1.1.0"
            onChange={e => onChange({ versionName: e.target.value })} />
        </div>
      </div>

      <label style={label}>Release note shown to customers</label>
      <input style={{ ...field, marginBottom: 10 }} value={release.notes}
        placeholder="What changed, in one line"
        onChange={e => onChange({ notes: e.target.value })} />

      {allowUpload && (
        <>
          <label style={label}>APK</label>
          <div style={{
            border: '1.5px dashed var(--line)', borderRadius: 10, padding: 14,
            textAlign: 'center', marginBottom: 10,
          }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) send(f)
            }}>
            {uploading ? (
              <div>
                <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: percent + '%', height: '100%', background: 'var(--mc-orange)' }} />
                </div>
                <div style={{ ...muted, marginTop: 6 }}>Uploading… {percent}%</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                  Drop the <b>.apk</b> here, or
                </div>
                <button onClick={() => fileRef.current.click()} style={{
                  border: '1px solid var(--line)', borderRadius: 8, padding: '6px 12px',
                  fontSize: 11.5, background: '#fff', cursor: 'pointer',
                }}>Choose file</button>
                <input ref={fileRef} type="file" accept=".apk" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files[0]; if (f) send(f) }} />
                <div style={{ ...muted, marginTop: 6 }}>
                  The server checks it is a real Android package and records its checksum.
                </div>
              </>
            )}
          </div>

          {uploadMsg && (
            <div style={{
              fontSize: 11.5, lineHeight: 1.5, borderRadius: 8, padding: '8px 10px', marginBottom: 10,
              background: uploadMsg.ok ? 'var(--green-soft)' : 'var(--red-soft)',
              color: uploadMsg.ok ? 'var(--green)' : 'var(--red)',
            }}>{uploadMsg.text}</div>
          )}

          <label style={label}>Download URL</label>
          <input style={{ ...mono, marginBottom: 10 }} value={release.apkUrl}
            placeholder="https://…" spellCheck="false"
            onChange={e => onChange({ apkUrl: e.target.value.trim() })} />

          <label style={label}>SHA-256 checksum</label>
          <input style={mono} value={release.sha256}
            placeholder="filled in automatically after upload" spellCheck="false"
            onChange={e => onChange({ sha256: e.target.value.trim().toLowerCase() })} />
          <div style={{ ...muted, marginTop: 4, lineHeight: 1.5 }}>
            The app compares the file it downloads against this and refuses to install a mismatch.
          </div>
        </>
      )}
    </div>
  )
}

function Callout({ tone, children }) {
  const tones = {
    amber: ['var(--amber-chip)', 'var(--mc-orange-deep)'],
    red: ['var(--red-soft)', 'var(--red)'],
    green: ['var(--green-soft)', 'var(--green)'],
  }
  const [bg, fg] = tones[tone] || tones.amber
  return (
    <div style={{
      background: bg, color: fg, borderRadius: 8, padding: '10px 12px',
      fontSize: 11.5, lineHeight: 1.55, marginBottom: 14,
    }}>{children}</div>
  )
}
