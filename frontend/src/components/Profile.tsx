import { useState } from 'react'
import { useProfile } from '@/hooks/useApi'
import { APIError } from '@/lib/errors'
import { apiClient } from '@/lib/api-client'

export function Profile() {
  const [token, setToken] = useState(apiClient.getToken() ?? '')
  const [enabled, setEnabled] = useState(!!apiClient.getToken())

  const { data, error, loading, refetch } = useProfile(enabled)

  function applyToken() {
    if (token.trim()) {
      apiClient.setToken(token.trim())
      setEnabled(true)
      // trigger refetch after state settles
      setTimeout(refetch, 0)
    }
  }

  function clearToken() {
    apiClient.clearToken()
    setToken('')
    setEnabled(false)
  }

  const errorMsg = (() => {
    if (!error) return null
    if (error instanceof APIError) {
      if (error.isUnauthorized()) return '401 Unauthorized – invalid or missing token'
      if (error.isForbidden()) return '403 Forbidden – insufficient permissions'
      return `${error.code}: ${error.message}`
    }
    return error.message
  })()

  return (
    <section style={styles.card}>
      <h2>GET /api/v1/profile <span style={styles.badge}>protected</span></h2>

      <div style={styles.row}>
        <input
          style={styles.input}
          placeholder="Paste Bearer token…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button onClick={applyToken} style={styles.btn}>Set Token</button>
        <button onClick={clearToken} style={{ ...styles.btn, marginLeft: 6, background: '#eee' }}>Clear</button>
      </div>

      {loading && enabled && <p style={styles.muted}>Loading…</p>}
      {errorMsg && <p style={styles.error}>{errorMsg}</p>}

      {data && (
        <table style={styles.table}>
          <tbody>
            <tr><td style={styles.label}>User ID</td><td>{data.user_id}</td></tr>
            <tr><td style={styles.label}>Email</td><td>{data.email}</td></tr>
            <tr><td style={styles.label}>Roles</td><td>{data.roles.join(', ')}</td></tr>
          </tbody>
        </table>
      )}

      {enabled && <button onClick={refetch} style={styles.btn}>Refresh</button>}
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 },
  badge: { fontSize: 11, background: '#fff3cd', color: '#856404', borderRadius: 4, padding: '2px 6px', marginLeft: 8 },
  row: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 200, padding: '6px 10px', fontFamily: 'monospace', fontSize: 13 },
  error: { color: '#dc3545' },
  muted: { color: '#666' },
  table: { borderCollapse: 'collapse', width: '100%', marginBottom: 12 },
  label: { fontWeight: 600, paddingRight: 16, paddingBottom: 4, width: 120 },
  btn: { padding: '6px 14px', cursor: 'pointer' },
}
