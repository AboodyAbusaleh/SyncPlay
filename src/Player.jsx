import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { ref, onValue, update, get, remove } from 'firebase/database'
import Queue from './Queue'

export default function Player({ token, roomCode, role }) {
  const [player, setPlayer]   = useState(null)
  const [deviceId, setDeviceId] = useState(null)
  const [playback, setPlayback] = useState(null)
  const [ready, setReady]     = useState(false)
  const [sdkError, setSdkError] = useState(null)
  const playerRef = useRef(null)
  const hostNextRef = useRef(() => {})

  function attachErrorListeners(p) {
    p.addListener('initialization_error', ({ message }) => setSdkError({ kind: 'init', message }))
    p.addListener('authentication_error', ({ message }) => setSdkError({ kind: 'auth', message }))
    p.addListener('account_error', ({ message }) => setSdkError({ kind: 'account', message }))
    p.addListener('playback_error', ({ message }) => setSdkError({ kind: 'playback', message }))
  }

  async function playUri(uri) {
    if (role !== 'host') return
    const url = deviceId
      ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
      : 'https://api.spotify.com/v1/me/player/play'
    await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] }),
    })
  }

  async function hostNext() {
    const snap = await get(ref(db, `rooms/${roomCode}/queue`))
    const data = snap.val() || {}
    const entries = Object.entries(data).sort((a, b) => a[1].addedAt - b[1].addedAt)
    if (entries.length > 0) {
      const [key, item] = entries[0]
      await playUri(item.uri)
      await remove(ref(db, `rooms/${roomCode}/queue/${key}`))
    } else {
      playerRef.current?.nextTrack()
    }
  }

  hostNextRef.current = hostNext

  // Host — load SDK
  useEffect(() => {
    if (role !== 'host') return
    const initPlayer = () => {
      const p = new window.Spotify.Player({
        name: 'SyncPlay',
        getOAuthToken: cb => cb(token),
        volume: 0.8,
      })
      attachErrorListeners(p)
      p.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id)
        setReady(true)
        playerRef.current = p
      })
      p.addListener('player_state_changed', state => {
        if (!state) return
        setPlayback(state)
        update(ref(db, `rooms/${roomCode}/playback`), {
          isPlaying: !state.paused,
          trackUri: state.track_window.current_track.uri,
          trackName: state.track_window.current_track.name,
          artistName: state.track_window.current_track.artists[0].name,
          albumArt: state.track_window.current_track.album.images[0].url,
          position: state.position,
          updatedAt: Date.now(),
        })
      })
      p.connect()
      setPlayer(p)
    }
    if (window.Spotify) {
      initPlayer()
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        const script = document.createElement('script')
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        document.body.appendChild(script)
      }
    }
    return () => { playerRef.current?.disconnect() }
  }, [token, role])

  // Guest — load SDK
  useEffect(() => {
    if (role !== 'guest') return
    const initPlayer = () => {
      const p = new window.Spotify.Player({
        name: 'SyncPlay Guest',
        getOAuthToken: cb => cb(token),
        volume: 0.8,
      })
      attachErrorListeners(p)
      p.addListener('ready', ({ device_id }) => {
        fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        })
        playerRef.current = p
        setReady(true)
      })
      p.connect()
    }
    if (window.Spotify) {
      initPlayer()
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        const script = document.createElement('script')
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        document.body.appendChild(script)
      }
    }
    return () => { playerRef.current?.disconnect() }
  }, [role, token])

  // Guest — sync from Firebase
  useEffect(() => {
    if (role !== 'guest') return
    const unsub = onValue(ref(db, `rooms/${roomCode}/playback`), snapshot => {
      const data = snapshot.val()
      if (!data) return
      setPlayback(data)
      if (!data.trackUri || !ready) return
      if (data.isPlaying) {
        fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uris: [data.trackUri], position_ms: data.position }),
        })
      } else {
        fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    })
    return () => unsub()
  }, [role, roomCode, token, ready])

  // Host — listen for guest events
  useEffect(() => {
    if (role !== 'host') return
    const unsub = onValue(ref(db, `rooms/${roomCode}/events`), snapshot => {
      const data = snapshot.val()
      if (!data || !playerRef.current) return
      if (Date.now() - data.requestedAt > 3000) return
      if (data.type === 'play' || data.type === 'pause') playerRef.current.togglePlay()
      if (data.type === 'next') hostNextRef.current()
      if (data.type === 'prev') playerRef.current.previousTrack()
    })
    return () => unsub()
  }, [role, roomCode])

  async function transferPlayback() {
    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    })
  }

  async function togglePlay() {
    if (role === 'guest') {
      await update(ref(db, `rooms/${roomCode}/events`), {
        type: playback?.isPlaying ? 'pause' : 'play',
        requestedAt: Date.now(),
      })
      return
    }
    player?.togglePlay()
  }

  async function skipNext() {
    if (role === 'guest') {
      await update(ref(db, `rooms/${roomCode}/events`), { type: 'next', requestedAt: Date.now() })
      return
    }
    await hostNext()
  }

  async function skipPrev() {
    if (role === 'guest') {
      await update(ref(db, `rooms/${roomCode}/events`), { type: 'prev', requestedAt: Date.now() })
      return
    }
    player?.previousTrack()
  }

  const track = role === 'host'
    ? playback?.track_window?.current_track
    : playback?.trackName
      ? { name: playback.trackName, artists: [{ name: playback.artistName }], album: { images: [{ url: playback.albumArt }] } }
      : null

  const isPlaying = role === 'host' ? !playback?.paused : playback?.isPlaying

  return (
    <div className="player-layout">
      <div className="player-main">

      {/* connecting state */}
      {!ready && !sdkError && role === 'host' && <Status>connecting to spotify...</Status>}
      {!ready && !sdkError && role === 'guest' && <Status>connecting...</Status>}

      {/* error state */}
      {sdkError && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', maxWidth: '340px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            {sdkError.kind === 'auth'    ? 'session expired'
           : sdkError.kind === 'account' ? 'premium required'
           : sdkError.kind === 'init'    ? 'spotify sdk error'
           :                                'playback error'}
          </span>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--mid)', fontSize: '1.05rem' }}>
            {sdkError.kind === 'auth'
              ? 'your spotify token expired — log out and reconnect.'
              : sdkError.kind === 'account'
              ? 'the spotify web playback sdk only works with a premium account.'
              : sdkError.message || 'something went wrong loading the player.'}
          </p>
        </div>
      )}

      {/* activate button */}
      {ready && !track && role === 'host' && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            player ready
          </span>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 300, color: 'var(--deep)' }}>
            activate to begin
          </h2>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--mid)', marginBottom: '16px' }}>
            this sets SyncPlay as your active spotify device
          </p>
          <ActionBtn onClick={transferPlayback}>activate player</ActionBtn>
        </div>
      )}

      {/* waiting as guest */}
      {ready && !track && role === 'guest' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--mid)', fontSize: '1.2rem' }}>
            waiting for host to play something...
          </p>
        </div>
      )}

      {/* now playing */}
      {track && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '340px' }}>

          {/* album art */}
          {track.album?.images?.[0]?.url && (
            <div style={{
              position: 'relative',
              width: '260px',
              height: '260px',
            }}>
              <img
                src={track.album.images[0].url}
                alt="album art"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '4px',
                  border: '1px solid var(--blush)',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* track info */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <p style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '1.5rem',
              fontWeight: 300,
              color: 'var(--deep)',
              lineHeight: 1.2,
              marginBottom: '4px',
            }}>
              {track.name}
            </p>
            <p style={{
              fontSize: '12px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mid)',
              opacity: 0.7,
            }}>
              {track.artists[0].name}
            </p>
          </div>

          {/* controls */}
          <div style={{
            display: 'flex',
            gap: '32px',
            alignItems: 'center',
            marginTop: '8px',
          }}>
            <CtrlBtn onClick={skipPrev} label="previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
              </svg>
            </CtrlBtn>
            <button
              onClick={togglePlay}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'var(--deep)',
                border: 'none',
                color: 'var(--cream)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.15s, background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--mid)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--deep)'}
            >
              {isPlaying
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              }
            </button>
            <CtrlBtn onClick={skipNext} label="next">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
            </CtrlBtn>
          </div>

          {/* role badge */}
          <p style={{
            fontSize: '10px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--mid)',
            opacity: 0.5,
            marginTop: '8px',
          }}>
            {role === 'host' ? '♡ you control playback' : '♡ requests sent to host'}
          </p>
        </div>
      )}

      </div>

      {ready && (
        <div className="queue-side">
          <Queue token={token} roomCode={roomCode} role={role} onPlayNow={playUri} />
        </div>
      )}
    </div>
  )
}

function Status({ children }) {
  return (
    <p style={{
      fontFamily: 'Cormorant Garamond, serif',
      fontStyle: 'italic',
      color: 'var(--mid)',
      fontSize: '1.1rem',
    }}>
      {children}
    </p>
  )
}

function ActionBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: '1px solid var(--accent)',
        color: 'var(--accent)',
        borderRadius: '40px',
        padding: '12px 28px',
        fontSize: '11px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        transition: 'background 0.2s, color 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--cream)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--accent)' }}
    >
      {children}
    </button>
  )
}

function CtrlBtn({ children, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--mid)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        borderRadius: '50%',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--deep)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--mid)'}
    >
      {children}
    </button>
  )
}