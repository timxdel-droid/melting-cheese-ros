import { useEffect, useState } from 'react'
import { consoleStateStatus, onConsoleState, pushNow } from '../lib/consoleState.js'

/* One small pill in the header answering the question that used to have no
   answer: "is what I am looking at the shared copy, or just this browser?"

   It also carries the one message an operator must not miss - that another
   device saved a section first and this browser's version was replaced. */

const LABEL = {
  booting: ['Loading…', 'gray'],
  server: ['Saved to server', 'green'],
  local: ['This device only', 'gray'],
  'no-token': ['Not connected — add API token', 'orange'],
  offline: ['Offline — saving here', 'orange'],
  error: ['Not saving to server', 'red'],
}

export default function SyncPill() {
  const [s, setS] = useState(consoleStateStatus())
  const [note, setNote] = useState('')

  useEffect(() => onConsoleState(evt => {
    setS(consoleStateStatus())
    if (evt.type === 'conflict') {
      const who = evt.detail.by ? ' by ' + evt.detail.by : ''
      setNote('Updated elsewhere' + who + ': ' + evt.detail.sections.join(', ') + '. Showing the server copy.')
    } else if (evt.type === 'error' && typeof evt.detail === 'string') {
      setNote(evt.detail)
    }
  }), [])

  const [text, tone] = LABEL[s.status] || LABEL.error
  const title = [s.lastError, s.lastSavedAt ? 'Last saved ' + new Date(s.lastSavedAt).toLocaleString() + (s.lastSavedBy ? ' by ' + s.lastSavedBy : '') : '']
    .filter(Boolean).join(' · ')

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className={'pill ' + tone} title={title}
        onClick={() => { if (s.pending) pushNow() }}
        style={{ cursor: s.pending ? 'pointer' : 'default' }}>
        {s.pending ? '● ' : ''}{text}
      </span>
      {note && (
        <span style={{ fontSize: 11.5, color: 'var(--ink-2)', maxWidth: 380, lineHeight: 1.2 }}>
          {note} <button onClick={() => setNote('')} style={{ fontSize: 11, color: 'var(--ink-3)' }}>✕</button>
        </span>
      )}
    </span>
  )
}
