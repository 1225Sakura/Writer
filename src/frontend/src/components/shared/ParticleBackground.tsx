/**
 * ParticleBackground - 纯CSS实现的浮动粒子背景
 *
 * 使用多个绝对定位的小圆点（div），每个粒子有不同的浮动动画
 * 颜色使用半透明的主题色，非常轻量，不占用JS线程
 *
 * 注意：此组件使用纯CSS keyframes，不涉及任何JS动画计算
 * 对写作性能零影响
 */
export function ParticleBackground() {
  // 预定义粒子配置，避免运行时计算
  const particles = [
    { size: 4, left: '10%', top: '20%', delay: '0s', duration: '20s', color: 'rgba(94, 106, 210, 0.08)' },
    { size: 6, left: '25%', top: '60%', delay: '2s', duration: '25s', color: 'rgba(94, 181, 166, 0.06)' },
    { size: 3, left: '40%', top: '30%', delay: '4s', duration: '18s', color: 'rgba(155, 126, 217, 0.07)' },
    { size: 5, left: '55%', top: '70%', delay: '1s', duration: '22s', color: 'rgba(94, 106, 210, 0.05)' },
    { size: 4, left: '70%', top: '15%', delay: '3s', duration: '24s', color: 'rgba(232, 184, 125, 0.06)' },
    { size: 7, left: '85%', top: '50%', delay: '5s', duration: '28s', color: 'rgba(94, 106, 210, 0.04)' },
    { size: 3, left: '15%', top: '80%', delay: '6s', duration: '19s', color: 'rgba(91, 142, 232, 0.06)' },
    { size: 5, left: '50%', top: '45%', delay: '7s', duration: '21s', color: 'rgba(126, 183, 74, 0.05)' },
    { size: 4, left: '75%', top: '85%', delay: '8s', duration: '23s', color: 'rgba(94, 106, 210, 0.06)' },
    { size: 6, left: '30%', top: '10%', delay: '9s', duration: '26s', color: 'rgba(212, 93, 93, 0.04)' },
    { size: 3, left: '60%', top: '35%', delay: '10s', duration: '17s', color: 'rgba(155, 126, 217, 0.05)' },
    { size: 5, left: '90%', top: '75%', delay: '11s', duration: '20s', color: 'rgba(94, 181, 166, 0.05)' },
  ]

  return (
    <div
      className="particle-background"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            backgroundColor: p.color,
            borderRadius: '50%',
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  )
}
