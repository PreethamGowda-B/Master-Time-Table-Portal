import React, { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function PageLoader() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const isFirst = useRef(true)

  useEffect(() => {
    // skip the very first render (initial page load)
    if (isFirst.current) {
      isFirst.current = false
      return
    }

    setVisible(true)
    setProgress(0)

    const t1 = setTimeout(() => setProgress(40), 100)
    const t2 = setTimeout(() => setProgress(70), 400)
    const t3 = setTimeout(() => setProgress(90), 900)
    const t4 = setTimeout(() => setProgress(100), 1700)
    const t5 = setTimeout(() => { setVisible(false); setProgress(0) }, 2000)

    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
  }, [location.pathname])

  if (!visible) return null

  return (
    <>
      {/* Top progress bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3,
        zIndex: 9999, background: 'rgba(0,0,0,0.05)'
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #06b6d4)',
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 0 10px rgba(79,70,229,0.6)',
          borderRadius: '0 2px 2px 0'
        }} />
      </div>

      {/* Overlay with spinner */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'loaderFadeIn 0.15s ease',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 14px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #e2e8f0' }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: '#4f46e5', borderRightColor: '#7c3aed',
              animation: 'loaderSpin 0.8s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 10, borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: '#06b6d4',
              animation: 'loaderSpin 1.2s linear infinite reverse',
            }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                animation: 'loaderPulse 0.8s ease-in-out infinite'
              }} />
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.5px' }}>
            Loading...
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loaderFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes loaderSpin { to { transform: rotate(360deg) } }
        @keyframes loaderPulse {
          0%,100% { transform:scale(1); opacity:1 }
          50% { transform:scale(1.5); opacity:0.6 }
        }
      `}</style>
    </>
  )
}
