import { useEffect, useRef } from 'react'

export default function GalaxyBackground() {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const mouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Create stars
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5,
      opacity: Math.random(),
      speed: Math.random() * 0.3 + 0.05,
      twinkle: Math.random() * Math.PI * 2,
    }))

    // Create floating particles
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 1,
      hue: Math.random() > 0.5 ? 185 : 270, // cyan or purple
      life: Math.random() * Math.PI * 2,
    }))

    // Mouse trail
    const trail = []
    const onMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      trail.push({ x: e.clientX, y: e.clientY, life: 1 })
      if (trail.length > 20) trail.shift()
    }
    window.addEventListener('mousemove', onMouseMove)

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.01

      // Draw stars
      stars.forEach(s => {
        s.twinkle += 0.02
        const opacity = (Math.sin(s.twinkle) + 1) / 2 * 0.8 + 0.1
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 230, 255, ${opacity})`
        ctx.fill()
        s.y += s.speed
        if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width }
      })

      // Draw particles
      particles.forEach(p => {
        p.life += 0.02
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        const opacity = (Math.sin(p.life) + 1) / 2 * 0.6 + 0.1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${opacity})`
        ctx.shadowBlur = 10
        ctx.shadowColor = `hsla(${p.hue}, 100%, 70%, 0.8)`
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // Draw mouse trail
      trail.forEach((pt, i) => {
        pt.life -= 0.05
        if (pt.life <= 0) return
        const size = pt.life * 3
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 245, 255, ${pt.life * 0.5})`
        ctx.shadowBlur = 15
        ctx.shadowColor = 'rgba(0, 245, 255, 0.8)'
        ctx.fill()
        ctx.shadowBlur = 0

        // Connect trail dots
        if (i > 0 && trail[i-1].life > 0) {
          ctx.beginPath()
          ctx.moveTo(trail[i-1].x, trail[i-1].y)
          ctx.lineTo(pt.x, pt.y)
          ctx.strokeStyle = `rgba(0, 245, 255, ${pt.life * 0.3})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      })

      // Nebula wisps
      for (let i = 0; i < 3; i++) {
        const x = canvas.width * (0.2 + i * 0.3) + Math.sin(t + i) * 50
        const y = canvas.height * 0.5 + Math.cos(t * 0.7 + i) * 100
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 200)
        grad.addColorStop(0, i % 2 === 0 ? 'rgba(0,245,255,0.03)' : 'rgba(123,47,255,0.03)')
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
