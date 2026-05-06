import { HealthStatus } from '@/components/HealthStatus'
import { Profile } from '@/components/Profile'
import { AdminStats } from '@/components/AdminStats'
import { useTest } from '@/hooks/useApi'

function TestBadge() {
  const { data, loading } = useTest()
  if (loading) return null
  return (
    <span style={{ fontSize: 12, background: '#e2e3e5', borderRadius: 4, padding: '2px 8px', marginLeft: 8 }}>
      env: {data?.env ?? '—'}
    </span>
  )
}

export default function App() {
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 4 }}>
        Chi API Explorer
        <TestBadge />
      </h1>
      <p style={{ color: '#555', marginBottom: 32 }}>
        React integration for the Go Chi microservice running at{' '}
        <code>http://localhost:8080</code>
      </p>

      <HealthStatus />
      <Profile />
      <AdminStats />
    </div>
  )
}
