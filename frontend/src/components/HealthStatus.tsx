import { useHealth } from '@/hooks/useApi'

export function HealthStatus() {
  const { data, error, loading, refetch } = useHealth()

  return (
    <section style={styles.card}>
      <h2>GET /api/v1/health <span style={styles.badge}>public</span></h2>

      {loading && <p style={styles.muted}>Loading…</p>}

      {error && (
        <p style={styles.error}>Error: {error.message}</p>
      )}

      {data && (
        <table style={styles.table}>
          <tbody>
            <tr><td style={styles.label}>Status</td><td>{data.status}</td></tr>
            <tr><td style={styles.label}>Timestamp</td><td>{data.timestamp}</td></tr>
          </tbody>
        </table>
      )}

      <button onClick={refetch} style={styles.btn}>Refresh</button>
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 },
  badge: { fontSize: 11, background: '#d4edda', color: '#155724', borderRadius: 4, padding: '2px 6px', marginLeft: 8 },
  error: { color: '#dc3545' },
  muted: { color: '#666' },
  table: { borderCollapse: 'collapse', width: '100%', marginBottom: 12 },
  label: { fontWeight: 600, paddingRight: 16, paddingBottom: 4, width: 120 },
  btn: { padding: '6px 14px', cursor: 'pointer' },
}
