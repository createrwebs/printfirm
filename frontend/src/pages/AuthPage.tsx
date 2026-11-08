import { USER_UPDATED_EVENT } from '../lib/userEvents'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import BrandMark from '../components/BrandMark'
import LanguageSwitch from '../components/layout/LanguageSwitch'
import { useI18n } from '../i18n'

function safeNextPath(raw: string | null, fallback = '/') {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return fallback
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  const stripped =
    base && (raw === base || raw.startsWith(`${base}/`) || raw.startsWith(`${base}?`))
      ? raw.slice(base.length) || '/'
      : raw
  if (stripped.startsWith('/auth')) return fallback
  return stripped
}

export default function AuthPage() {
  const nav = useNavigate()
  const { t } = useI18n()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'), '/')

  const [toraUsername, setToraUsername] = useState('')
  const [toraPassword, setToraPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const oauthToken = hash.get('access_token')
    const oauthError = params.get('oauth_error')
    if (oauthToken) {
      localStorage.setItem('token', oauthToken)
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search.replace(/([?&])oauth_error=[^&]*/g, '').replace(/[?&]$/, '')}`)
      window.dispatchEvent(new Event(USER_UPDATED_EVENT))
      nav(nextPath, { replace: true })
      return
    }
    if (oauthError) setError(oauthError)
  }, [nav, nextPath, params])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!toraUsername.trim() || !toraPassword) {
      setError('กรุณากรอก Username และ Password ของ ToraAPI')
      return
    }

    setLoading(true)
    try {
      const res = await api.loginWithToraApi('', '', {
        username: toraUsername.trim(),
        password: toraPassword,
      })
      localStorage.setItem('token', res.access_token)
      window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT, { detail: res.user }))
      nav(nextPath, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.fail'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel-top">
          <BrandMark />
          <LanguageSwitch />
        </div>
        <h1>เข้าสู่ระบบด้วยบัญชี ToraAPI</h1>
        <form onSubmit={onSubmit} className="stack" noValidate>
          <p className="auth-hint" style={{ marginBottom: 8, lineHeight: 1.5 }}>
            ระบบเชื่อมต่อและหักเครดิตจากบัญชี <strong>ToraAPI</strong> ของคุณโดยตรง
            หากยังไม่มีบัญชีหรือเครดิตไม่เพียงพอ กรุณาไปที่{' '}
            <a href="https://www.toraapi.com" target="_blank" rel="noopener noreferrer">
              toraapi.com
            </a>
          </p>
          <label>
            ชื่อผู้ใช้ (Username)
            <input
              type="text"
              placeholder="กรอก Username ของ toraapi.com"
              autoComplete="username"
              value={toraUsername}
              onChange={(e) => {
                setToraUsername(e.target.value)
                if (error) setError('')
              }}
            />
          </label>
          <label>
            รหัสผ่าน (Password)
            <input
              type="password"
              placeholder="กรอกรหัสผ่านของคุณ"
              autoComplete="current-password"
              value={toraPassword}
              onChange={(e) => {
                setToraPassword(e.target.value)
                if (error) setError('')
              }}
            />
          </label>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button className="btn primary" disabled={loading}>
            {loading ? t('auth.processing') : 'เข้าสู่ระบบ'}
          </button>
        </form>
        <a
          href="https://www.toraapi.com"
          target="_blank"
          rel="noopener noreferrer"
          className="linkish"
          style={{ display: 'inline-block', textAlign: 'center', marginTop: 8 }}
        >
          ยังไม่มีบัญชี? สมัครสมาชิกและเติมเครดิตที่ toraapi.com
        </a>
      </div>
      <div className="auth-visual" aria-hidden>
        <div className="ink-wash" />
      </div>
    </div>
  )
}
