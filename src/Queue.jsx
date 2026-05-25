import { useState, useEffect } from 'react'
import { db } from './firebase'
import { ref, push, remove, onValue } from 'firebase/database'
import { searchTracks } from './spotify'

export default function Queue({ token, roomCode, role, onPlayNow }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [queue, setQueue]       = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen]         = useState(false)

  useEffect(() => {
    const unsub = onValue(ref(db, `rooms/${roomCode}/queue`), snap => {
      const data = snap.val() || {}
      const arr = Object.entries(data)
        .map(([key, val]) => ({ key, ...val }))
        .sort((a, b) => a.addedAt - b.addedAt)
      setQueue(arr)
    })
    return () => unsub()
  }, [roomCode])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    const handle = setTimeout(async () => {
      const tracks = await searchTracks(token, query)
      setResults(tracks)
      setSearching(false)
    }, 300)
    return () => clearTimeout(handle)
  }, [query, token])

  async function addToQueue(track) {
    await push(ref(db, `rooms/${roomCode}/queue`), {
      uri: track.uri,
      name: track.name,
      artist: track.artists?.[0]?.name || '',
      art: track.album?.images?.[track.album.images.length - 1]?.url || '',
      addedBy: role,
      addedAt: Date.now(),
    })
    setQuery('')
    setResults([])
  }

  async function removeItem(key) {
    await remove(ref(db, `rooms/${roomCode}/queue/${key}`))
  }

  async function playNow(item) {
    if (role !== 'host') return
    await onPlayNow?.(item.uri)
    await removeItem(item.key)
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--mid)',
          fontSize: '11px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 0',
        }}
      >
        <span>queue {queue.length > 0 && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>· {queue.length}</span>}</span>
        <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>⌄</span>
      </button>

      {open && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* search */}
          <div style={{ position: 'relative' }}>
            <input
              placeholder="search to add..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--warm)',
                border: '1px solid var(--blush)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--deep)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--blush)'}
            />
            {searching && (
              <span style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '10px',
                color: 'var(--mid)',
                opacity: 0.6,
                fontStyle: 'italic',
                fontFamily: 'Cormorant Garamond, serif',
              }}>
                searching...
              </span>
            )}
          </div>

          {/* search results */}
          {results.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              border: '1px solid var(--blush)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}>
              {results.map(t => (
                <ResultRow key={t.id} track={t} onAdd={() => addToQueue(t)} />
              ))}
            </div>
          )}

          {/* up next */}
          {queue.length === 0 ? (
            <p style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontStyle: 'italic',
              color: 'var(--mid)',
              fontSize: '0.95rem',
              textAlign: 'center',
              padding: '12px 0',
              opacity: 0.7,
            }}>
              nothing queued yet — search to add
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{
                fontSize: '10px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--mid)',
                opacity: 0.6,
              }}>
                up next
              </p>
              {queue.map(item => (
                <QueueRow
                  key={item.key}
                  item={item}
                  role={role}
                  onPlay={() => playNow(item)}
                  onRemove={() => removeItem(item.key)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultRow({ track, onAdd }) {
  const art = track.album?.images?.[track.album.images.length - 1]?.url
  return (
    <button
      onClick={onAdd}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--warm)',
        border: 'none',
        padding: '8px 12px',
        textAlign: 'left',
        color: 'var(--deep)',
        transition: 'background 0.15s',
        width: '100%',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--blush)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--warm)'}
    >
      {art && <img src={art} alt="" style={{ width: '36px', height: '36px', borderRadius: '3px' }} />}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <p style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '1rem',
          color: 'var(--deep)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {track.name}
        </p>
        <p style={{
          fontSize: '10px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--mid)',
          opacity: 0.7,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {track.artists?.[0]?.name}
        </p>
      </div>
      <span style={{
        color: 'var(--accent)',
        fontSize: '1.1rem',
        lineHeight: 1,
      }}>+</span>
    </button>
  )
}

function QueueRow({ item, role, onPlay, onRemove }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '6px 4px',
    }}>
      {item.art && <img src={item.art} alt="" style={{ width: '36px', height: '36px', borderRadius: '3px', border: '1px solid var(--blush)' }} />}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <p style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '1rem',
          color: 'var(--deep)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.name}
        </p>
        <p style={{
          fontSize: '10px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--mid)',
          opacity: 0.7,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.artist}{item.addedBy === 'guest' && <span style={{ marginLeft: '8px', color: 'var(--accent)' }}>· guest</span>}
        </p>
      </div>
      {role === 'host' && (
        <button
          onClick={onPlay}
          aria-label="play now"
          title="play now"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      )}
      <button
        onClick={onRemove}
        aria-label="remove"
        title="remove"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--mid)',
          opacity: 0.6,
          padding: '4px',
          fontSize: '14px',
          lineHeight: 1,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1}
        onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
      >
        ×
      </button>
    </div>
  )
}
