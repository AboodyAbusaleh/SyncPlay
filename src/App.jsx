import { useState, useEffect } from 'react'
import { loginWithSpotify, handleCallback, getSavedToken, logout } from './spotify'
import { db } from './firebase'
import { ref, onValue } from 'firebase/database'
import Room from './Room'
import Player from './Player'

export default function App() {
  const [token, setToken]       = useState(null)
  const [roomCode, setRoomCode] = useState(null)
  const [role, setRole]         = useState(null)
  const [hostName, setHostName] = useState('')
  const [theme, setTheme]       = useState(() => {
    if (typeof window === 'undefined') return 'light'
    const t = localStorage.getItem('syncplay-theme')
      || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', t)
    return t
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('syncplay-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('code')) {
      handleCallback().then(t => { if (t) setToken(t) })
    } else {
      const saved = getSavedToken()
      if (saved) setToken(saved)
    }
  }, [])

  useEffect(() => {
    if (!roomCode) { setHostName(''); return }
    const unsub = onValue(ref(db, `rooms/${roomCode}/hostName`), snap => {
      setHostName(snap.val() || '')
    })
    return () => unsub()
  }, [roomCode])

  let content
  if (!token) {
    content = <Login theme={theme} onToggleTheme={toggleTheme} />
  } else if (!roomCode) {
    content = (
      <Layout onLogout={logout} theme={theme} onToggleTheme={toggleTheme}>
        <Room token={token} onJoin={(code, r) => { setRoomCode(code); setRole(r) }} />
      </Layout>
    )
  } else {
    content = (
      <Layout
        onLogout={logout}
        roomCode={roomCode}
        role={role}
        hostName={hostName}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        <Player token={token} roomCode={roomCode} role={role} />
      </Layout>
    )
  }

  return (
    <>
      <Ambient />
      <MusicNotes />
      {content}
      <CatGif />
      <Signature />
    </>
  )
}

function MusicNotes() {
  const [notes, setNotes] = useState([])
  const NOTE_CHARS = ['♪', '♫', '♬', '♩', '𝅘𝅥']

  useEffect(() => {
    const spawn = () => {
      const id = Date.now() + Math.random()
      const duration = 9 + Math.random() * 7
      const note = {
        id,
        char:     NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
        left:     Math.random() * 100,
        size:     16 + Math.random() * 20,
        duration,
        drift:    (Math.random() - 0.5) * 160,
        spin:     (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540),
      }
      setNotes(prev => [...prev, note])
      setTimeout(() => {
        setNotes(prev => prev.filter(n => n.id !== id))
      }, duration * 1000 + 200)
    }

    spawn()
    const interval = setInterval(spawn, 1100)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {notes.map(n => (
        <span
          key={n.id}
          className="music-note"
          style={{
            left: `${n.left}%`,
            fontSize: `${n.size}px`,
            animationDuration: `${n.duration}s`,
            '--drift': `${n.drift}px`,
            '--spin':  `${n.spin}deg`,
          }}
        >
          {n.char}
        </span>
      ))}
    </div>
  )
}

function Ambient() {
  const sparkles = [
    { top: '14%', left: '6%',  size: '22px', delay: '0s'    },
    { top: '28%', left: '94%', size: '14px', delay: '-2s'   },
    { top: '58%', left: '12%', size: '18px', delay: '-4s'   },
    { top: '76%', left: '90%', size: '12px', delay: '-1s'   },
    { top: '44%', left: '52%', size: '10px', delay: '-3s'   },
    { top: '22%', left: '70%', size: '16px', delay: '-5.5s' },
    { top: '88%', left: '46%', size: '13px', delay: '-2.7s' },
    { top: '52%', left: '82%', size: '15px', delay: '-6s'   },
  ]
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      <div
        className="blob"
        style={{
          top: '-180px',
          right: '-220px',
          width: '720px',
          height: '720px',
          background: 'radial-gradient(circle, var(--blush), transparent 70%)',
          opacity: 0.55,
        }}
      />
      <div
        className="blob"
        style={{
          bottom: '-220px',
          left: '-200px',
          width: '640px',
          height: '640px',
          background: 'radial-gradient(circle, var(--accent), transparent 70%)',
          opacity: 0.28,
          animationDelay: '-7s',
        }}
      />
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="sparkle"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            animationDelay: s.delay,
          }}
        >
          ✦
        </span>
      ))}
      <svg
        className="compass"
        width="180"
        height="180"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
        style={{ top: '40%', left: '50%', marginTop: '-90px', marginLeft: '-90px' }}
      >
        <circle cx="50" cy="50" r="40" />
        <circle cx="50" cy="50" r="32" />
        <path d="M50 6 L54 50 L50 94 L46 50 Z" fill="currentColor" />
        <path d="M6 50 L50 46 L94 50 L50 54 Z" fill="currentColor" />
        <path d="M22 22 L52 48 L78 78 L48 52 Z" fill="currentColor" opacity="0.5" />
        <path d="M22 78 L48 52 L78 22 L52 48 Z" fill="currentColor" opacity="0.5" />
      </svg>
    </div>
  )
}

function CatGif() {
  return (
    <img
      src="https://media1.tenor.com/m/ZeMyYBI_yzEAAAAd/daydreaming-cats.gif"
      alt=""
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: '14px',
        left: '14px',
        width: '88px',
        height: 'auto',
        pointerEvents: 'none',
        zIndex: 50,
        mixBlendMode: 'multiply',
      }}
    />
  )
}

function SpotifyMark({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M7 9.5c3-1 7-1 10 0.5" />
      <path d="M7.5 12.5c2.5-0.8 6-0.6 8.5 0.7" />
      <path d="M8 15c2-0.6 4.5-0.5 6.5 0.5" />
    </svg>
  )
}

function ThemeToggle({ theme, onClick }) {
  const dark = theme === 'dark'
  return (
    <button
      onClick={onClick}
      aria-label={dark ? 'switch to light mode' : 'switch to night mode'}
      title={dark ? 'light mode' : 'night mode'}
      style={{
        background: 'none',
        border: '1px solid var(--blush)',
        color: 'var(--mid)',
        borderRadius: '40px',
        width: '34px',
        height: '34px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.2s, color 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mid)'; e.currentTarget.style.color = 'var(--deep)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--blush)'; e.currentTarget.style.color = 'var(--mid)' }}
    >
      {dark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <line x1="12" y1="2" x2="12" y2="5"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="5" y2="12"/>
          <line x1="19" y1="12" x2="22" y2="12"/>
          <line x1="4.5" y1="4.5" x2="6.6" y2="6.6"/>
          <line x1="17.4" y1="17.4" x2="19.5" y2="19.5"/>
          <line x1="4.5" y1="19.5" x2="6.6" y2="17.4"/>
          <line x1="17.4" y1="6.6" x2="19.5" y2="4.5"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
        </svg>
      )}
    </button>
  )
}

function RoomCodePill({ code }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard?.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <button
      onClick={copy}
      title="click to copy"
      style={{
        background: 'var(--warm)',
        border: '1px solid var(--blush)',
        color: 'var(--accent)',
        borderRadius: '40px',
        padding: '6px 18px',
        fontSize: '1.05rem',
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        fontFamily: 'Cormorant Garamond, serif',
        transition: 'border-color 0.2s, color 0.2s, background 0.2s',
        minWidth: '120px',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--blush)' }}
    >
      {copied ? 'copied ♡' : code}
    </button>
  )
}

function Login({ theme, onToggleTheme }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '2rem',
      textAlign: 'center',
      background: 'transparent',
      position: 'relative',
      zIndex: 1,
    }}>
      <div style={{ position: 'absolute', top: '1.2rem', right: '1.5rem' }}>
        <ThemeToggle theme={theme} onClick={onToggleTheme} />
      </div>
      <p style={{
        fontSize: '11px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--accent)',
        marginBottom: '8px',
      }}>
        listen together
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', color: 'var(--deep)' }}>
        <SpotifyMark size={40} />
        <h1 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(2.8rem, 8vw, 5rem)',
          fontWeight: 300,
          color: 'var(--deep)',
          lineHeight: 1,
        }}>
          SyncPlay
        </h1>
      </div>
      <p style={{
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: '1.1rem',
        fontStyle: 'italic',
        color: 'var(--mid)',
        marginTop: '4px',
        marginBottom: '24px',
      }}>
        the same song, wherever you are
      </p>
      <button
        onClick={() => loginWithSpotify()}
        style={{
          background: 'none',
          border: '1px solid var(--accent)',
          color: 'var(--accent)',
          borderRadius: '40px',
          padding: '12px 32px',
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          transition: 'background 0.2s, color 0.2s',
        }}
        onMouseEnter={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--cream)' }}
        onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)' }}
      >
        connect spotify
      </button>
    </div>
  )
}

function Layout({ children, onLogout, roomCode, role, hostName, theme, onToggleTheme }) {
  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative', zIndex: 1 }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.2rem 2rem',
        borderBottom: '1px solid var(--blush)',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--deep)' }}>
          <SpotifyMark size={22} />
          <h1 style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '1.5rem',
            fontWeight: 300,
            color: 'var(--deep)',
            letterSpacing: '0.04em',
          }}>
            SyncPlay
          </h1>
        </div>

        {roomCode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <RoomCodePill code={roomCode} />
            <span style={{
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
            }}>
              <span className="live-dot" />
              {role === 'host'
                ? '♡ host'
                : `♡ guest${hostName ? ' of ' + hostName : ''}`}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle theme={theme} onClick={onToggleTheme} />
          <button
            onClick={onLogout}
            style={{
              background: 'none',
              border: '1px solid var(--blush)',
              color: 'var(--mid)',
              borderRadius: '40px',
              padding: '6px 18px',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mid)'; e.currentTarget.style.color = 'var(--deep)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--blush)'; e.currentTarget.style.color = 'var(--mid)' }}
          >
            logout
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

function Signature() {
  return (
    <p
      aria-hidden="true"
      className="signature"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '22px',
        fontFamily: 'Cormorant Garamond, serif',
        fontStyle: 'italic',
        fontSize: '20px',
        color: 'var(--accent)',
        pointerEvents: 'none',
        zIndex: 50,
        margin: 0,
      }}
    >
      made by abood
    </p>
  )
}
