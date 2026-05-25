import { useState } from 'react'
import { db } from './firebase'
import { ref, set, get } from 'firebase/database'
import { getCurrentUser } from './spotify'

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function Room({ token, onJoin }) {
  const [mode, setMode]       = useState(null)
  const [code, setCode]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function createRoom() {
    setLoading(true)
    const roomCode = generateRoomCode()
    const me = await getCurrentUser(token)
    await set(ref(db, `rooms/${roomCode}`), {
      host: true,
      hostName: me?.display_name || 'host',
      createdAt: Date.now(),
      playback: {
        isPlaying: false,
        trackUri: null,
        position: 0,
        updatedAt: Date.now(),
      },
    })
    onJoin(roomCode, 'host')
    setLoading(false)
  }

  async function joinRoom() {
    setLoading(true)
    setError('')
    const snapshot = await get(ref(db, `rooms/${code.toUpperCase()}`))
    if (snapshot.exists()) {
      onJoin(code.toUpperCase(), 'guest')
    } else {
      setError('room not found — check the code')
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 65px)',
      padding: '2rem',
      gap: '8px',
    }}>
      <span style={{
        fontSize: '11px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--accent)',
        marginBottom: '8px',
      }}>
        your session
      </span>
      <h2 style={{
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: 'clamp(2rem, 6vw, 3.2rem)',
        fontWeight: 300,
        color: 'var(--deep)',
        marginBottom: '4px',
      }}>
        {!mode ? 'start or join' : mode === 'create' ? 'create a room' : 'join a room'}
      </h2>
      <p style={{
        fontFamily: 'Cormorant Garamond, serif',
        fontStyle: 'italic',
        color: 'var(--mid)',
        fontSize: '1.05rem',
        marginBottom: '32px',
      }}>
        {!mode
          ? 'host a session or join someone\'s'
          : mode === 'create'
          ? 'a code will be generated to share'
          : 'enter the room code you were sent'}
      </p>

      {!mode && (
        <div style={{ display: 'flex', gap: '12px' }}>
          <Btn onClick={() => setMode('create')}>create room</Btn>
          <Btn onClick={() => setMode('join')} ghost>join room</Btn>
        </div>
      )}

      {mode === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Btn onClick={createRoom} disabled={loading}>
            {loading ? 'creating...' : 'generate room ✦'}
          </Btn>
          <Back onClick={() => setMode(null)} />
        </div>
      )}

      {mode === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <input
            placeholder="enter code"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
            style={{
              background: 'var(--warm)',
              border: '1px solid var(--blush)',
              borderRadius: '10px',
              padding: '14px 20px',
              color: 'var(--deep)',
              fontSize: '1.4rem',
              textAlign: 'center',
              letterSpacing: '6px',
              width: '220px',
              outline: 'none',
              fontFamily: 'Cormorant Garamond, serif',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--blush)'}
          />
          {error && (
            <p style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontStyle: 'italic',
              color: 'var(--accent)',
              fontSize: '0.95rem',
            }}>
              {error}
            </p>
          )}
          <Btn onClick={joinRoom} disabled={loading}>
            {loading ? 'joining...' : 'join ↗'}
          </Btn>
          <Back onClick={() => setMode(null)} />
        </div>
      )}
    </div>
  )
}

function Btn({ children, onClick, ghost, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: ghost ? 'none' : 'var(--deep)',
        color: ghost ? 'var(--mid)' : 'var(--cream)',
        border: ghost ? '1px solid var(--blush)' : '1px solid var(--deep)',
        borderRadius: '40px',
        padding: '12px 28px',
        fontSize: '11px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  )
}

function Back({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--mid)',
        fontSize: '11px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        opacity: 0.6,
        marginTop: '4px',
      }}
    >
      ← back
    </button>
  )
}