import { useState } from 'react'
import { useAdminStats } from '@/hooks/useApi'
import { APIError } from '@/lib/errors'

export function AdminStats() {
  const [enabled, setEnabled] = useState(false)
  const { data, error, loading, refetch } = useAdminStats(enabled)

  const errorMsg = (() => {
    if (!error) return null
    if (error instanceof APIError) {
      if (error.isUnauthorized()) return '401 Unauthorized – set a Bearer token on the Profile section first'
      if (error.isForbidden()) return '403 Forbidden – requires admin role'
      return `${error.code}: ${error.message}`
    }
    return error.message
  })()

  return (
    <section style={styles.card}>
      <h2>GET /api/v1/admin/stats <span style={styles.badge}>admin</span></h2>
      <p style={styles.muted}>Requires a Bearer token with the <code>admin</code> role.</p>

      {!enabled && (
        <button onClick={() => setEnabled(true)} style={styles.btn}>Fetch Stats</button>
      )}

      {loading && enabled && <p style={styles.muted}>Loading…</p>}
      {errorMsg && <p style={styles.error}>{errorMsg}</p>}

      {data && (
        <>
          <table style={styles.table}>
            <tbody>
              <tr><td style={styles.label}>Total Users</td><td>{data.total_users.toLocaleString()}</td></tr>
              <tr><td style={styles.label}>Active Sessions</td><td>{data.active_sessions}</td></tr>
              <tr><td style={styles.label}>Last Updated</td><td>{data.last_updated}</td></tr>
            </tbody>
          </table>
          <button onClick={refetch} style={styles.btn}>Refresh</button>
        </>
      )}
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 },
  badge: { fontSize: 11, background: '#f8d7da', color: '#721c24', borderRadius: 4, padding: '2px 6px', marginLeft: 8 },
  error: { color: '#dc3545' },
  muted: { color: '#666', marginBottom: 10 },
  table: { borderCollapse: 'collapse', width: '100%', marginBottom: 12 },
  label: { fontWeight: 600, paddingRight: 16, paddingBottom: 4, width: 160 },
  btn: { padding: '6px 14px', cursor: 'pointer' },
}
