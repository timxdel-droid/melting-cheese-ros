import { useState, useEffect, useRef } from 'react'
import {
  loadConnectors, loadSyncedProducts, hasWriteAccess, hasWpAuth,
  fetchProductForEdit, fetchProductCategories, saveProduct, uploadMedia,
  INGREDIENT_UNITS,
} from '../lib/connectors.js'

/* Screen: Menu Management › Product Editor

   Edits a single WooCommerce product end to end — copy, price, category,
   ingredients and gallery — and writes it straight back to the store. The
   apps pick the change up on their next menu refresh.

   Components here are hand-built rather than pulled from a UI kit: ROS has
   no Tailwind or Radix, so an accordion and a carousel are a few lines of
   local state and match the existing cards exactly. */

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const field = {
  border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
  fontSize: 12.5, background: '#fff', width: '100%', fontFamily: 'inherit',
}
const btn = { ...field, width: 'auto', cursor: 'pointer' }

export default function ProductEditor() {
  const connectors = loadConnectors()
  const sync = loadSyncedProducts()
  const canWrite = hasWriteAccess(connectors)

  const catalogue = (sync && sync.items) || []
  const categories = [...new Set(catalogue.map(i => i.cat))].sort()

  const [filter, setFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [wooCats, setWooCats] = useState([])
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  const visible = catalogue.filter(p =>
    (!catFilter || p.cat === catFilter) &&
    (!filter || p.name.toLowerCase().includes(filter.toLowerCase())))

  useEffect(() => {
    if (!canWrite) return
    fetchProductCategories(connectors).then(setWooCats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = async id => {
    setSelectedId(id); setDraft(null); setStatus(null); setDirty(false); setBusy(true)
    const res = await fetchProductForEdit(connectors, id)
    setBusy(false)
    if (res.ok) setDraft(res.product)
    else setStatus({ ok: false, message: res.message })
  }

  const patch = changes => { setDraft(d => ({ ...d, ...changes })); setDirty(true) }

  const save = async () => {
    setBusy(true); setStatus(null)
    const res = await saveProduct(connectors, draft)
    setBusy(false)
    setStatus(res)
    if (res.ok) setDirty(false)
  }

  if (!canWrite) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Head />
        <div className="card" style={{ padding: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>🔑</div>
          <b style={{ fontSize: 13.5 }}>Product editing needs a WooCommerce API key</b>
          <div style={{ ...muted, marginTop: 6, lineHeight: 1.6, maxWidth: 460, margin: '6px auto 0' }}>
            Open the Sync panel and add a Read/Write consumer key and secret. Without one
            ROS can read the catalogue but cannot change it.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Head />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px,290px) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>

        {/* ---- Product list ------------------------------------------- */}
        <div className="card" style={{ padding: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
            <b style={{ fontSize: 13 }}>Products</b>
            <div style={{ flex: 1 }} />
            <span className="pill gray">{visible.length}</span>
          </div>

          <input style={{ ...field, marginBottom: 7 }} placeholder="Search products…"
            value={filter} onChange={e => setFilter(e.target.value)} />
          <select style={{ ...field, marginBottom: 10 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div style={{ maxHeight: 560, overflowY: 'auto', display: 'grid', gap: 5 }}>
            {visible.map(p => {
              const on = p.id === selectedId
              return (
                <button key={p.id} onClick={() => open(p.id)} style={{
                  display: 'flex', gap: 9, alignItems: 'center', textAlign: 'left', width: '100%',
                  border: '1px solid ' + (on ? 'var(--mc-orange)' : 'var(--line)'),
                  background: on ? 'var(--amber-chip)' : 'var(--surface)',
                  borderRadius: 9, padding: 7, cursor: 'pointer',
                }}>
                  <span style={{
                    width: 38, height: 38, borderRadius: 7, flexShrink: 0, overflow: 'hidden',
                    background: 'var(--surface-alt)', display: 'grid', placeItems: 'center', fontSize: 15,
                  }}>
                    {p.img ? <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🍽'}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</span>
                    <span style={{ display: 'block', ...muted, fontSize: 10 }}>{p.cat}</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mc-orange-deep)' }}>
                    {p.price != null ? p.price.toFixed(2) : '—'}
                  </span>
                </button>
              )
            })}
            {!visible.length && (
              <div style={{ ...muted, padding: 14, textAlign: 'center' }}>
                {catalogue.length ? 'Nothing matches that filter.' : 'Run a sync first to pull the catalogue.'}
              </div>
            )}
          </div>
        </div>

        {/* ---- Editor -------------------------------------------------- */}
        {!draft ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', ...muted }}>
            {busy ? 'Loading product…' : 'Select a product on the left to edit it.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <Details draft={draft} patch={patch} wooCats={wooCats} />
            <Ingredients draft={draft} patch={patch} />
            <Gallery draft={draft} patch={patch} connectors={connectors} />

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12 }}>
                {dirty ? <b>Unsaved changes</b> : <span style={muted}>No changes since last save</span>}
                <span style={{ ...muted, marginLeft: 8 }}>
                  Saving writes straight to WooCommerce — the apps pick it up on their next refresh.
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <button style={btn} onClick={() => open(draft.id)} disabled={busy}>Revert</button>
              <button className="btn-primary" style={{ fontSize: 12.5 }} onClick={save} disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>

            {status && (
              <div className="card" style={{
                padding: '11px 14px', fontSize: 12, lineHeight: 1.55,
                background: status.ok ? 'var(--green-soft)' : 'var(--red-soft)',
                color: status.ok ? 'var(--green)' : 'var(--red)',
              }}>
                {status.message}
                {status.warnIngredients && (
                  <div style={{ marginTop: 6, color: 'var(--ink-2)' }}>
                    Ingredients were sent but came back empty — the Product Ingredients plugin
                    is probably not installed on this store yet.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Head() {
  return (
    <div>
      <div style={muted}>Menu Management / Product Editor</div>
      <h2 style={{ margin: '2px 0 2px', fontSize: 18 }}>Product Editor</h2>
      <div style={muted}>
        Edit copy, price, category, ingredients and photos. Changes go straight to
        WooCommerce and reach the website, the apps and the eMenu from one place.
      </div>
    </div>
  )
}

/* ---- Details ------------------------------------------------------------ */

function Details({ draft, patch, wooCats }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <b style={{ fontSize: 13.5 }}>Product details</b>
        <div style={{ flex: 1 }} />
        <span className="pill gray" style={{ fontFamily: 'monospace' }}>ID {draft.id}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <label>
          <div style={{ ...muted, marginBottom: 3 }}>Title</div>
          <input style={field} value={draft.name} onChange={e => patch({ name: e.target.value })} />
        </label>
        <label>
          <div style={{ ...muted, marginBottom: 3 }}>Price (AED)</div>
          <input style={field} inputMode="decimal" value={draft.price}
            onChange={e => patch({ price: e.target.value.replace(/[^0-9.]/g, '') })} />
        </label>
        <label>
          <div style={{ ...muted, marginBottom: 3 }}>Category</div>
          <select style={field} value={draft.categoryId || ''}
            onChange={e => patch({ categoryId: Number(e.target.value) || null })}>
            {!wooCats.length && <option value="">{draft.categoryName || 'Loading…'}</option>}
            {wooCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <label style={{ display: 'block', marginTop: 10 }}>
        <div style={{ ...muted, marginBottom: 3 }}>Short description · the line under the name in the apps</div>
        <input style={field} value={draft.shortDescription}
          onChange={e => patch({ shortDescription: e.target.value })} />
      </label>

      <label style={{ display: 'block', marginTop: 10 }}>
        <div style={{ ...muted, marginBottom: 3 }}>Full description</div>
        <textarea style={{ ...field, minHeight: 92, resize: 'vertical' }} value={draft.description}
          onChange={e => patch({ description: e.target.value })} />
      </label>
    </div>
  )
}

/* ---- Ingredients -------------------------------------------------------- */

function Ingredients({ draft, patch }) {
  const [open, setOpen] = useState(true)
  const rows = draft.ingredients

  const set = (i, changes) => patch({ ingredients: rows.map((r, n) => n === i ? { ...r, ...changes } : r) })
  const add = () => patch({ ingredients: [...rows, { name: '', quantity: '', unit: '' }] })
  const remove = i => patch({ ingredients: rows.filter((_, n) => n !== i) })
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    const tmp = next[i]; next[i] = next[j]; next[j] = tmp
    patch({ ingredients: next })
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', width: '100%', background: 'none',
        cursor: 'pointer', textAlign: 'left', padding: 0,
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 11, background: 'var(--amber-chip)',
          color: 'var(--mc-orange-deep)', display: 'grid', placeItems: 'center',
          fontSize: 11, marginRight: 9, transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform .15s',
        }}>▸</span>
        <span>
          <b style={{ fontSize: 13.5 }}>Ingredients</b>
          <span style={{ ...muted, display: 'block' }}>
            Shown on the product screen in both apps, in this order
          </span>
        </span>
        <span style={{ flex: 1 }} />
        <span className="pill gray">{rows.length}</span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) 78px 96px auto',
              gap: 8, alignItems: 'center', marginBottom: 7,
            }}>
              <span style={{ ...muted, textAlign: 'center', fontWeight: 700 }}>{i + 1}</span>
              <input style={field} placeholder="Ingredient name" value={r.name}
                onChange={e => set(i, { name: e.target.value })} />
              <input style={field} placeholder="Qty" value={r.quantity}
                onChange={e => set(i, { quantity: e.target.value })} />
              <select style={field} value={r.unit || ''} onChange={e => set(i, { unit: e.target.value })}>
                {INGREDIENT_UNITS.map(u => <option key={u} value={u}>{u || 'unit —'}</option>)}
              </select>
              <span style={{ display: 'flex', gap: 4 }}>
                <button style={{ ...btn, padding: '6px 9px', fontSize: 11 }} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button style={{ ...btn, padding: '6px 9px', fontSize: 11 }} onClick={() => move(i, 1)} disabled={i === rows.length - 1}>↓</button>
                <button style={{ ...btn, padding: '6px 9px', fontSize: 11, color: 'var(--red)' }} onClick={() => remove(i)}>✕</button>
              </span>
            </div>
          ))}

          {!rows.length && (
            <div style={{ ...muted, padding: '10px 0 14px' }}>
              No ingredients yet. Customers with allergies read this list, so it is worth filling in.
            </div>
          )}

          <button style={{ ...btn, width: '100%', borderStyle: 'dashed', marginTop: 4 }} onClick={add}>
            + Add ingredient
          </button>
        </div>
      )}
    </div>
  )
}

/* ---- Gallery ------------------------------------------------------------ */

function Gallery({ draft, patch, connectors }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [frame, setFrame] = useState(0)
  const fileInput = useRef(null)
  const images = draft.images

  const canUpload = hasWpAuth()

  const accept = async files => {
    const list = [...files].filter(f => f.type.startsWith('image/'))
    if (!list.length) return
    setUploading(true); setError(null)
    const added = []
    for (const file of list) {
      const res = await uploadMedia(connectors, file)
      if (res.ok) added.push(res.image)
      else { setError(res.message); break }
    }
    setUploading(false)
    if (added.length) patch({ images: [...images, ...added] })
  }

  const remove = i => {
    patch({ images: images.filter((_, n) => n !== i) })
    setFrame(0)
  }
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= images.length) return
    const next = images.slice()
    const tmp = next[i]; next[i] = next[j]; next[j] = tmp
    patch({ images: next })
  }

  const shown = images[Math.min(frame, Math.max(0, images.length - 1))]

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <div>
          <b style={{ fontSize: 13.5 }}>Photos</b>
          <div style={muted}>First image is the one customers see in the menu rows</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="pill gray">{images.length}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 210px', gap: 14, marginTop: 10 }}>
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files) }}
            onClick={() => canUpload && fileInput.current && fileInput.current.click()}
            style={{
              border: '2px dashed ' + (dragging ? 'var(--mc-orange)' : 'var(--line)'),
              background: dragging ? 'var(--amber-chip)' : 'var(--surface-alt)',
              borderRadius: 10, padding: '20px 14px', textAlign: 'center',
              cursor: canUpload ? 'pointer' : 'not-allowed', marginBottom: 11,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{uploading ? '⏳' : '🖼'}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>
              {uploading ? 'Uploading…' : 'Drop photos here, or click to choose'}
            </div>
            <div style={{ ...muted, marginTop: 3 }}>
              {canUpload
                ? 'Uploads to the WordPress media library'
                : 'Add the WordPress Application Password in Sync to enable uploads'}
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden
            onChange={e => { accept(e.target.files); e.target.value = '' }} />

          {error && (
            <div style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 9, lineHeight: 1.5 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <div key={img.id || i} style={{
                width: 92, border: '1px solid ' + (i === 0 ? 'var(--mc-orange)' : 'var(--line)'),
                borderRadius: 9, overflow: 'hidden', background: 'var(--surface)',
              }}>
                <div style={{ position: 'relative', height: 66, background: 'var(--surface-alt)' }}>
                  <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {i === 0 && (
                    <span style={{
                      position: 'absolute', left: 4, top: 4, background: 'var(--mc-orange)', color: '#fff',
                      fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 4,
                    }}>MAIN</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2, padding: 4 }}>
                  <button style={{ ...btn, flex: 1, padding: '3px 0', fontSize: 10 }} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button style={{ ...btn, flex: 1, padding: '3px 0', fontSize: 10 }} onClick={() => move(i, 1)} disabled={i === images.length - 1}>↓</button>
                  <button style={{ ...btn, flex: 1, padding: '3px 0', fontSize: 10, color: 'var(--red)' }} onClick={() => remove(i)}>✕</button>
                </div>
              </div>
            ))}
            {!images.length && <div style={muted}>No photos yet.</div>}
          </div>
        </div>

        {/* Phone preview — the same frame the Content & App screens use, so
            the operator judges the crop where it actually matters. */}
        <div>
          <div style={{ ...muted, fontWeight: 800, letterSpacing: .6, marginBottom: 6 }}>ON THE PHONE</div>
          <div style={{ background: '#111', borderRadius: 20, padding: 6 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 15, overflow: 'hidden' }}>
              <div style={{ height: 132, background: 'var(--surface-alt)', position: 'relative' }}>
                {shown
                  ? <img src={shown.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 22 }}>🍽</div>}
                {images.length > 1 && (
                  <div style={{
                    position: 'absolute', bottom: 6, left: 0, right: 0,
                    display: 'flex', justifyContent: 'center', gap: 4,
                  }}>
                    {images.map((_, i) => (
                      <button key={i} onClick={() => setFrame(i)} style={{
                        width: 5, height: 5, borderRadius: 3, cursor: 'pointer', padding: 0,
                        background: i === frame ? '#fff' : 'rgba(255,255,255,.5)',
                      }} />
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '9px 10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{draft.name}</div>
                <div style={{ ...muted, fontSize: 9.5, marginTop: 2, lineHeight: 1.4, minHeight: 24 }}>
                  {draft.shortDescription || '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
                  <b style={{ fontSize: 13, color: 'var(--mc-orange-deep)' }}>
                    AED {Number(draft.price || 0).toFixed(2)}
                  </b>
                  <div style={{ flex: 1 }} />
                  <span style={{
                    background: 'var(--mc-orange)', color: '#fff', fontSize: 9,
                    fontWeight: 700, padding: '4px 9px', borderRadius: 12,
                  }}>Add</span>
                </div>
                {!!draft.ingredients.filter(r => r.name).length && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                    <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: .5, color: 'var(--ink-3)' }}>
                      INGREDIENTS
                    </div>
                    {draft.ingredients.filter(r => r.name).slice(0, 5).map((r, i) => (
                      <div key={i} style={{ display: 'flex', fontSize: 9, marginTop: 3 }}>
                        <span style={{ flex: 1 }}>{r.name}</span>
                        <span style={{ color: 'var(--ink-3)' }}>
                          {[r.quantity, r.unit].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ ...muted, marginTop: 7, lineHeight: 1.5 }}>
            Reorder photos on the left — the app shows them in this order.
          </div>
        </div>
      </div>
    </div>
  )
}
