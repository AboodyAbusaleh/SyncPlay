const CLIENT_ID = 'e66cf8d8aef94100b4c615abc3d4bd27'
const REDIRECT_URI = 'http://127.0.0.1:5173/callback'
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ')

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function loginWithSpotify() {
  const codeVerifier = generateRandomString(128)
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  localStorage.setItem('code_verifier', codeVerifier)

  const authUrl =
    `https://accounts.spotify.com/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}`

  window.location.href = authUrl
}

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null

  const codeVerifier = localStorage.getItem('code_verifier')

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  })

  const data = await response.json()
  if (data.access_token) {
    localStorage.setItem('spotify_token', data.access_token)
    localStorage.removeItem('code_verifier')
    window.history.replaceState({}, '', '/')
    return data.access_token
  }
  return null
}

export function getSavedToken() {
  return localStorage.getItem('spotify_token')
}

export function logout() {
  localStorage.removeItem('spotify_token')
  localStorage.removeItem('code_verifier')
  window.location.reload()
}

export async function getCurrentUser(token) {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

export async function searchTracks(token, query) {
  if (!query.trim()) return []
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=6`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return data.tracks?.items || []
}