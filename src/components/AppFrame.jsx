import { useState } from 'react'

/* A working replica of the customer app's home screen.

   Every measurement here is copied from the SwiftUI source in
   melting-cheese-ios: AisleCard is 142×100 with a 26pt add button, the aisle
   title is 16pt bold with a 12pt "See all", the account row is a 38pt circle,
   and the tab bar is Home / Search / Orders / Cart / Account in that order.

   Points are scaled by SCALE so the frame stays proportional to a 390pt
   iPhone. A tablet frame uses the same scale and simply fits more cards,
   which is what the real app does on a wider screen. */

const REFERENCE_WIDTH = 390

const ORANGE = '#F5A623'
const ORANGE_DEEP = '#F08C1A'
const AMBER_SOFT = '#FFF4DE'
const BG = '#F6F6F8'
const SURFACE = '#FFFFFF'
const LINE = '#ECECF0'
const INK = '#1C1C1E'
const INK_2 = '#55555C'
const INK_3 = '#9A9AA2'

const TABS = [
  { id: 0, label: 'Home', glyph: '⌂' },
  { id: 1, label: 'Search', glyph: '⌕' },
  { id: 2, label: 'Orders', glyph: '▤' },
  { id: 3, label: 'Cart', glyph: '⛃' },
  { id: 4, label: 'Account', glyph: '◍' },
]

export default function AppFrame({ width, height, layout, packs, categories, catalogue, eventName, eventVenue, platform = 'ios' }) {
  const android = platform === 'android'
  const S = width / REFERENCE_WIDTH
  const s = n => n * S

  const [tab, setTab] = useState(0)
  const [cart, setCart] = useState({})
  const [guestName, setGuestName] = useState('')
  const [query, setQuery] = useState('')
  const [openCategory, setOpenCategory] = useState(null)

  const pack = id => (packs || []).find(p => p.id === id)
  const header = pack(layout?.headerPack)
  const items = cat => (catalogue || []).filter(p => p.cat === cat)

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)
  const cartLines = Object.entries(cart)
    .map(([id, qty]) => ({ product: (catalogue || []).find(p => String(p.id) === id), qty }))
    .filter(l => l.product)
  const cartTotal = cartLines.reduce((sum, l) => sum + (l.product.price || 0) * l.qty, 0)

  const add = product => setCart(c => ({ ...c, [product.id]: (c[product.id] || 0) + 1 }))
  const remove = product => setCart(c => {
    const next = { ...c }
    if (next[product.id] > 1) next[product.id] -= 1
    else delete next[product.id]
    return next
  })

  const aisles = (layout?.aisles || []).filter(a => a.on)
  const price = p => (p.price != null ? p.price.toFixed(0) + ' AED' : 'At truck')

  return (
    <div style={{
      width, height, background: '#111', borderRadius: android ? s(20) : s(34), padding: s(9),
      boxShadow: '0 8px 26px rgba(20,20,30,.18)', flex: '0 0 auto',
    }}>
      <div style={{
        width: '100%', height: '100%', background: BG, borderRadius: android ? s(14) : s(26),
        overflow: 'hidden', display: 'flex', flexDirection: 'column', color: INK,
      }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 0 && (
            <Home {...{ s, guestName, setGuestName, setTab, eventName, eventVenue, header, aisles, items,
                        categories, openCategory, setOpenCategory, add, price, layout, pack }} />
          )}
          {tab === 1 && <Search {...{ s, query, setQuery, catalogue, add, price }} />}
          {tab === 2 && <Orders s={s} />}
          {tab === 3 && <Cart {...{ s, cartLines, cartTotal, add, remove, setTab, price }} />}
          {tab === 4 && <Account {...{ s, guestName, cartCount }} />}
        </div>

        {/* Tab bar — Home, Search, Orders, Cart, Account, exactly as RootView. */}
        <div style={{
          display: 'flex', borderTop: '1px solid ' + LINE, background: SURFACE,
          paddingBottom: android ? s(8) : s(4), paddingTop: android ? s(6) : 0,
        }}>
          {TABS.map(t => {
            const on = t.id === tab
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, textAlign: 'center', padding: s(7) + 'px 0 ' + s(6) + 'px',
                cursor: 'pointer', background: 'none', position: 'relative',
                color: on ? ORANGE_DEEP : INK_3,
              }}>
                <div style={{
                  fontSize: s(17), lineHeight: 1, margin: '0 auto',
                  width: android ? s(56) : 'auto', height: android ? s(30) : 'auto',
                  display: android ? 'grid' : 'block', placeItems: 'center',
                  borderRadius: android ? s(15) : 0,
                  background: android && on ? AMBER_SOFT : 'transparent',
                }}>{t.glyph}</div>
                <div style={{
                  fontSize: s(android ? 10.5 : 9.5), fontWeight: on ? 700 : 500,
                  marginTop: s(android ? 4 : 3),
                }}>{t.label}</div>
                {t.id === 3 && cartCount > 0 && (
                  <span style={{
                    position: 'absolute', top: s(3), right: '50%', marginRight: s(-16),
                    background: '#E5484D', color: '#fff', fontSize: s(8), fontWeight: 800,
                    minWidth: s(14), height: s(14), borderRadius: s(7), display: 'grid',
                    placeItems: 'center', padding: '0 ' + s(3) + 'px',
                  }}>{cartCount}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Home ---------------- */

function Home({ s, guestName, setGuestName, setTab, eventName, eventVenue, header, aisles, items,
                categories, openCategory, setOpenCategory, add, price, layout, pack }) {
  const shown = openCategory ? aisles.filter(a => a.cat === openCategory) : aisles

  return (
    <div style={{ paddingTop: s(6) }}>
      {/* accountBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: s(10), padding: '0 ' + s(16) + 'px' }}>
        <div style={{
          width: s(38), height: s(38), borderRadius: '50%', background: AMBER_SOFT,
          display: 'grid', placeItems: 'center', fontSize: s(17), flexShrink: 0,
        }}>🧀</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: s(14), fontWeight: 700 }}>
            {guestName ? 'Hi ' + guestName : 'Welcome'}
          </div>
          <div style={{ fontSize: s(11), color: INK_3 }}>
            {guestName ? 'Events across the UAE' : 'Sign in to save your order'}
          </div>
        </div>
        {guestName
          ? <span style={{ fontSize: s(16), color: INK_2 }}>🔔</span>
          : <button onClick={() => setGuestName('Tim')} style={{
              fontSize: s(12), fontWeight: 700, color: '#fff', background: ORANGE,
              padding: s(8) + 'px ' + s(14) + 'px', borderRadius: 999, cursor: 'pointer',
            }}>Sign in</button>}
      </div>

      {/* searchBar — taps through to the Search tab, same as the app */}
      <button onClick={() => setTab(1)} style={{
        display: 'flex', alignItems: 'center', gap: s(10), width: 'calc(100% - ' + s(32) + 'px)',
        margin: s(20) + 'px ' + s(16) + 'px 0', background: SURFACE, borderRadius: s(10),
        padding: s(12) + 'px ' + s(14) + 'px', cursor: 'pointer', textAlign: 'left',
        boxShadow: '0 1px 2px rgba(20,20,30,.05)',
      }}>
        <span style={{ fontSize: s(14), color: INK_3 }}>⌕</span>
        <span style={{ fontSize: s(14), color: INK_3 }}>Search the menu…</span>
      </button>

      {/* event / collection point */}
      <div style={{
        display: 'flex', alignItems: 'center', margin: s(20) + 'px ' + s(16) + 'px 0',
        background: AMBER_SOFT, borderRadius: s(10), padding: s(12) + 'px ' + s(14) + 'px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: s(13), fontWeight: 700, color: ORANGE_DEEP }}>
            {eventName || 'All locations'}
          </div>
          <div style={{ fontSize: s(11), color: INK_2 }}>
            {eventVenue || 'Select the Melting Cheese collection point'}
          </div>
        </div>
        <button style={{ fontSize: s(12), fontWeight: 700, color: ORANGE_DEEP, cursor: 'pointer', background: 'none' }}>
          Change
        </button>
      </div>

      {/* header banner */}
      <div style={{
        margin: s(20) + 'px ' + s(16) + 'px 0', background: '#FFC93C',
        borderRadius: s(14), padding: s(18),
      }}>
        <div style={{ fontSize: s(9), fontWeight: 900, letterSpacing: s(1), color: 'rgba(28,28,30,.55)' }}>
          MELTING CHEESE
        </div>
        <div style={{ fontSize: s(24), fontWeight: 900, lineHeight: 1.1, marginTop: s(4) }}>
          {(header?.headline || 'BOLD FLAVOR. BIG ENERGY.').split('.')[0]}.
        </div>
        {(header?.headline || 'BOLD FLAVOR. BIG ENERGY.').split('.')[1]?.trim() && (
          <div style={{ fontSize: s(24), fontWeight: 900, lineHeight: 1.1, color: ORANGE_DEEP }}>
            {(header?.headline || 'BOLD FLAVOR. BIG ENERGY.').split('.')[1].trim()}.
          </div>
        )}
        <button onClick={() => setTab(1)} style={{
          marginTop: s(12), background: ORANGE_DEEP, color: '#fff', fontSize: s(13),
          fontWeight: 700, padding: s(10) + 'px ' + s(16) + 'px', borderRadius: 999, cursor: 'pointer',
        }}>
          {header?.cta || 'Start an order'}
        </button>
      </div>

      {/* Food Hall Categories */}
      {!!(categories || []).length && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', margin: s(20) + 'px ' + s(16) + 'px ' + s(9) + 'px' }}>
            <b style={{ fontSize: s(16), flex: 1 }}>Food Hall Categories</b>
            <button onClick={() => setOpenCategory(null)} style={{
              fontSize: s(12), fontWeight: 700, color: ORANGE_DEEP, cursor: 'pointer', background: 'none',
            }}>All menu</button>
          </div>
          <div style={{ display: 'flex', gap: s(8), overflowX: 'auto', padding: '0 ' + s(16) + 'px' }}>
            {categories.map((c, i) => {
              const on = openCategory ? openCategory === c : i === 0
              return (
                <button key={c} onClick={() => setOpenCategory(openCategory === c ? null : c)} style={{
                  flex: '0 0 auto', borderRadius: s(10), cursor: 'pointer', textAlign: 'left',
                  padding: s(9) + 'px ' + s(12) + 'px', whiteSpace: 'nowrap',
                  background: on ? INK : SURFACE, color: on ? '#fff' : INK,
                  border: on ? 'none' : '1px solid ' + LINE,
                }}>
                  <div style={{ fontSize: s(12), fontWeight: 700 }}>{c}</div>
                  <div style={{ fontSize: s(10), opacity: .7 }}>{items(c).length} items</div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* aisles */}
      {shown.map((a, i) => (
        <div key={a.cat}>
          <div style={{ display: 'flex', alignItems: 'center', margin: s(20) + 'px ' + s(16) + 'px ' + s(11) + 'px' }}>
            <b style={{ fontSize: s(16), flex: 1 }}>{a.cat}</b>
            <button onClick={() => setOpenCategory(a.cat)} style={{
              fontSize: s(12), fontWeight: 600, color: ORANGE, cursor: 'pointer', background: 'none',
            }}>See all</button>
          </div>
          <div style={{ display: 'flex', gap: s(12), overflowX: 'auto', padding: '0 ' + s(16) + 'px' }}>
            {(items(a.cat).length ? items(a.cat) : [null]).map((p, n) => (
              <Card key={p ? p.id : n} {...{ s, product: p, add, price }} />
            ))}
          </div>

          {layout?.midPack && layout.midAfter === i && (
            <MidBanner s={s} banner={pack(layout.midPack)} />
          )}
          {layout?.videoPack && layout.videoAfter === i && (
            <VideoBanner s={s} banner={pack(layout.videoPack)} />
          )}
        </div>
      ))}

      <div style={{ height: s(20) }} />
    </div>
  )
}

/* AisleCard: 142×100 photo, 26pt add button, 2-line name, bold orange price. */
function Card({ s, product, add, price }) {
  if (!product) {
    return (
      <div style={{
        width: s(142), background: SURFACE, borderRadius: s(11), overflow: 'hidden',
        flex: '0 0 auto', border: '1px dashed ' + LINE,
      }}>
        <div style={{ height: s(100), background: AMBER_SOFT, display: 'grid', placeItems: 'center', fontSize: s(26) }}>🍽</div>
        <div style={{ padding: s(9), fontSize: s(11), color: INK_3 }}>Run a sync to load items</div>
      </div>
    )
  }
  return (
    <div style={{
      width: s(142), background: SURFACE, borderRadius: s(11), overflow: 'hidden',
      flex: '0 0 auto', boxShadow: '0 1px 2px rgba(20,20,30,.05)',
    }}>
      <div style={{ position: 'relative', height: s(100), background: AMBER_SOFT }}>
        {product.img
          ? <img src={product.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: s(26) }}>🍽</div>}
        <button onClick={() => add(product)} title="Add to order" style={{
          position: 'absolute', right: s(6), bottom: s(6), width: s(26), height: s(26),
          borderRadius: '50%', background: ORANGE, color: '#fff', fontSize: s(12),
          fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center',
        }}>+</button>
      </div>
      <div style={{ padding: s(9) }}>
        <div style={{
          fontSize: s(12), fontWeight: 600, lineHeight: 1.25, height: s(30), overflow: 'hidden',
        }}>{product.name}</div>
        <div style={{ fontSize: s(12.5), fontWeight: 700, color: ORANGE, marginTop: s(4) }}>
          {price(product)}
        </div>
      </div>
    </div>
  )
}

function MidBanner({ s, banner }) {
  if (!banner) return null
  return (
    <div style={{
      margin: s(16) + 'px ' + s(16) + 'px 0', borderRadius: s(13),
      background: 'linear-gradient(90deg,#1C1C1E,#3A2A16)', color: '#fff', padding: s(16),
    }}>
      <div style={{ fontSize: s(9), fontWeight: 900, letterSpacing: s(1.4), color: ORANGE }}>PROMO</div>
      <div style={{ fontSize: s(17), fontWeight: 800, marginTop: s(5) }}>{banner.headline}</div>
      {banner.cta && (
        <div style={{ fontSize: s(11), color: 'rgba(255,255,255,.8)', marginTop: s(5) }}>{banner.cta}</div>
      )}
    </div>
  )
}

function VideoBanner({ s, banner }) {
  if (!banner) return null
  return (
    <div style={{
      margin: s(16) + 'px ' + s(16) + 'px 0', borderRadius: s(13), background: '#243447',
      color: '#fff', padding: s(16), display: 'flex', alignItems: 'center', gap: s(12),
    }}>
      <span style={{ fontSize: s(24) }}>▶</span>
      <div>
        <div style={{ fontSize: s(9), fontWeight: 900, letterSpacing: s(1.4), color: '#FFC93C' }}>VIDEO / ART</div>
        <div style={{ fontSize: s(15), fontWeight: 700 }}>{banner.name}</div>
      </div>
    </div>
  )
}

/* ---------------- Search ---------------- */

function Search({ s, query, setQuery, catalogue, add, price }) {
  const q = query.trim().toLowerCase()
  const results = q ? (catalogue || []).filter(p => p.name.toLowerCase().includes(q)) : []
  return (
    <div style={{ padding: s(16) }}>
      <div style={{ fontSize: s(22), fontWeight: 800, marginBottom: s(14) }}>Search</div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the menu…"
        style={{
          width: '100%', background: SURFACE, border: 'none', borderRadius: s(10),
          padding: s(12) + 'px ' + s(14) + 'px', fontSize: s(14), fontFamily: 'inherit',
        }} />
      <div style={{ marginTop: s(14), display: 'grid', gap: s(9) }}>
        {results.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: s(10), background: SURFACE,
            borderRadius: s(11), padding: s(9),
          }}>
            <div style={{ width: s(46), height: s(46), borderRadius: s(8), overflow: 'hidden', background: AMBER_SOFT, flexShrink: 0 }}>
              {p.img && <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: s(12.5), fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: s(12), fontWeight: 700, color: ORANGE }}>{price(p)}</div>
            </div>
            <button onClick={() => add(p)} style={{
              width: s(26), height: s(26), borderRadius: '50%', background: ORANGE,
              color: '#fff', fontSize: s(12), fontWeight: 700, cursor: 'pointer',
            }}>+</button>
          </div>
        ))}
        {q && !results.length && (
          <div style={{ fontSize: s(12), color: INK_3, textAlign: 'center', paddingTop: s(20) }}>
            Nothing matches “{query}”.
          </div>
        )}
        {!q && (
          <div style={{ fontSize: s(12), color: INK_3, textAlign: 'center', paddingTop: s(20) }}>
            Type to search the full menu.
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Orders ---------------- */

function Orders({ s }) {
  return (
    <div style={{ padding: s(16) }}>
      <div style={{ fontSize: s(22), fontWeight: 800, marginBottom: s(14) }}>Orders</div>
      <div style={{ background: SURFACE, borderRadius: s(14), padding: s(26), textAlign: 'center' }}>
        <div style={{ fontSize: s(30) }}>▤</div>
        <div style={{ fontSize: s(14), fontWeight: 700, marginTop: s(8) }}>No orders yet</div>
        <div style={{ fontSize: s(12), color: INK_3, marginTop: s(5), lineHeight: 1.5 }}>
          Orders you place show up here with a collection code.
        </div>
      </div>
    </div>
  )
}

/* ---------------- Cart ---------------- */

function Cart({ s, cartLines, cartTotal, add, remove, setTab, price }) {
  return (
    <div style={{ padding: s(16) }}>
      <div style={{ fontSize: s(22), fontWeight: 800, marginBottom: s(14) }}>My Order</div>

      {!cartLines.length ? (
        <div style={{ background: SURFACE, borderRadius: s(14), padding: s(26), textAlign: 'center' }}>
          <div style={{ fontSize: s(30) }}>⛃</div>
          <div style={{ fontSize: s(14), fontWeight: 700, marginTop: s(8) }}>Your order is empty</div>
          <div style={{ fontSize: s(12), color: INK_3, marginTop: s(5) }}>
            Tap + on any item to start building an order.
          </div>
          <button onClick={() => setTab(0)} style={{
            marginTop: s(14), background: ORANGE, color: '#fff', fontSize: s(13), fontWeight: 700,
            padding: s(10) + 'px ' + s(18) + 'px', borderRadius: 999, cursor: 'pointer',
          }}>Browse the menu</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: s(9) }}>
            {cartLines.map(({ product, qty }) => (
              <div key={product.id} style={{
                display: 'flex', alignItems: 'center', gap: s(10), background: SURFACE,
                borderRadius: s(11), padding: s(9),
              }}>
                <div style={{ width: s(46), height: s(46), borderRadius: s(8), overflow: 'hidden', background: AMBER_SOFT, flexShrink: 0 }}>
                  {product.img && <img src={product.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: s(12.5), fontWeight: 600 }}>{product.name}</div>
                  <div style={{ fontSize: s(12), fontWeight: 700, color: ORANGE }}>{price(product)}</div>
                </div>
                <button onClick={() => remove(product)} style={{
                  width: s(24), height: s(24), borderRadius: '50%', background: BG,
                  fontSize: s(13), fontWeight: 700, cursor: 'pointer',
                }}>−</button>
                <span style={{ fontSize: s(13), fontWeight: 700, minWidth: s(16), textAlign: 'center' }}>{qty}</span>
                <button onClick={() => add(product)} style={{
                  width: s(24), height: s(24), borderRadius: '50%', background: ORANGE,
                  color: '#fff', fontSize: s(13), fontWeight: 700, cursor: 'pointer',
                }}>+</button>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: s(14), background: SURFACE, borderRadius: s(14), padding: s(16),
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{ fontSize: s(13), color: INK_2, flex: 1 }}>Total</span>
            <b style={{ fontSize: s(20), color: ORANGE }}>{cartTotal.toFixed(0)} AED</b>
          </div>
          <div style={{ fontSize: s(11), color: INK_3, marginTop: s(10), textAlign: 'center' }}>
            You pay at the truck — nothing is charged in the app.
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Account ---------------- */

function Account({ s, guestName, cartCount }) {
  const rows = [
    ['📷', 'Follow us on Instagram'],
    ['🌐', 'Visit our website'],
    ['🗓', "Where we're parked next"],
    ['?', 'Help & Support'],
  ]
  return (
    <div style={{ padding: s(16), display: 'grid', gap: s(18) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: s(14), background: SURFACE, borderRadius: s(14), padding: s(14) }}>
        <div style={{ width: s(62), height: s(62), borderRadius: '50%', background: AMBER_SOFT, display: 'grid', placeItems: 'center', fontSize: s(26) }}>🧀</div>
        <div>
          <div style={{ fontSize: s(17), fontWeight: 700 }}>{guestName || 'Guest'}</div>
          <div style={{ fontSize: s(12), color: INK_2 }}>Melting Cheese Street Lab</div>
        </div>
      </div>

      <div style={{ display: 'flex', background: SURFACE, borderRadius: s(14), padding: s(16) }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: s(12), color: INK_2 }}>Orders placed</div>
          <div style={{ fontSize: s(22), fontWeight: 900 }}>0</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: s(12), color: INK_2 }}>In cart</div>
          <div style={{ fontSize: s(22), fontWeight: 900, color: ORANGE }}>{cartCount}</div>
        </div>
      </div>

      <div style={{ background: SURFACE, borderRadius: s(14), padding: '0 ' + s(14) + 'px' }}>
        {rows.map(([icon, label], i) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: s(12), padding: s(14) + 'px 0',
            borderTop: i ? '1px solid ' + LINE : 'none',
          }}>
            <span style={{ fontSize: s(15), width: s(22) }}>{icon}</span>
            <span style={{ flex: 1, fontSize: s(14) }}>{label}</span>
            <span style={{ color: INK_3, fontSize: s(14) }}>›</span>
          </div>
        ))}
      </div>

      <div style={{ background: SURFACE, borderRadius: s(14), padding: s(14) }}>
        <div style={{ fontSize: s(12), fontWeight: 700, color: INK_2 }}>About</div>
        <div style={{ fontSize: s(12), color: INK_2, marginTop: s(8), lineHeight: 1.5 }}>
          100% Halal street food, cooked fresh at events across the UAE. Build your order
          in the app and pay at the truck.
        </div>
        <div style={{ fontSize: s(11), color: INK_3, marginTop: s(8) }}>Version 1.0.0</div>
      </div>
    </div>
  )
}
