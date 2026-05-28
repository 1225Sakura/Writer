import * as React from 'react'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


export interface WritingStatsChartProps {
  data: Array<{ label: string; value: number }>
  type?: 'bar' | 'line'
  width?: number
  height?: number
  barColor?: string
  lineColor?: string
  className?: string
}

export function WritingStatsChart({
  data,
  type = 'bar',
  width = 320,
  height = 160,
  barColor = 'var(--accent-100)',
  lineColor = 'var(--color-ifline)',
  className,
}: WritingStatsChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const padding = { top: 16, right: 16, bottom: 32, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data])

  const barWidth = data.length > 0 ? (chartWidth / data.length) * 0.6 : 0
  const barGap = data.length > 0 ? (chartWidth / data.length) * 0.4 : 0

  const handleMouseMove = (e: React.MouseEvent<SVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  // Y-axis ticks
  const yTicks = [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue]

  // Line chart points
  const linePoints = useMemo(() => {
    return data.map((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth
      const y = padding.top + chartHeight - (d.value / maxValue) * chartHeight
      return { x, y, value: d.value, label: d.label }
    })
  }, [data, chartWidth, chartHeight, maxValue])

  const pathD = linePoints.length > 0
    ? `M ${linePoints.map(p => `${p.x},${p.y}`).join(' L ')}`
    : ''

  return (
    <div className={`relative ${className || ''}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => {
          const y = padding.top + chartHeight - (tick / maxValue) * chartHeight
          return (
            <line
              key={i}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="color-mix(in srgb, var(--paper-100) 6%, transparent)"
              strokeWidth={1}
              strokeDasharray="2,4"
            />
          )
        })}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => {
          const y = padding.top + chartHeight - (tick / maxValue) * chartHeight
          return (
            <text
              key={i}
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              fill="var(--text-tertiary)"
              fontSize={10}
              fontFamily="Inter, sans-serif"
            >
              {Math.round(tick)}
            </text>
          )
        })}

        {type === 'bar' ? (
          /* Bar Chart */
          data.map((d, i) => {
            const x = padding.left + i * (barWidth + barGap) + barGap / 2
            const barHeight = (d.value / maxValue) * chartHeight
            const y = padding.top + chartHeight - barHeight

            return (
              <g key={i}>
                <motion.rect
                  x={x}
                  y={padding.top + chartHeight}
                  width={barWidth}
                  height={0}
                  rx={3}
                  fill={barColor}
                  initial={{ y: padding.top + chartHeight, height: 0 }}
                  animate={{ y, height: barHeight }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.5}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ cursor: 'pointer' }}
                />
                {/* X-axis label */}
                <text
                  x={x + barWidth / 2}
                  y={padding.top + chartHeight + 16}
                  textAnchor="middle"
                  fill="var(--text-tertiary)"
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                >
                  {d.label}
                </text>
              </g>
            )
          })
        ) : (
          /* Line Chart */
          <>
            {/* Area fill */}
            {linePoints.length > 0 && (
              <motion.path
                d={`${pathD} L ${linePoints[linePoints.length - 1].x},${padding.top + chartHeight} L ${linePoints[0].x},${padding.top + chartHeight} Z`}
                fill={lineColor}
                fillOpacity={0.1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            )}
            {/* Line */}
            {pathD && (
              <motion.path
                d={pathD}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            {/* Points */}
            {linePoints.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={4}
                fill={lineColor}
                stroke="var(--ink-100)"
                strokeWidth={2}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: DURATION.SLOW, delay: 0.8 + i * 0.05 , ease: EASE.SMOOTH }}
                opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.4}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              />
            ))}
            {/* X-axis labels */}
            {data.map((d, i) => {
              const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth
              return (
                <text
                  key={i}
                  x={x}
                  y={padding.top + chartHeight + 16}
                  textAnchor="middle"
                  fill="var(--text-tertiary)"
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                >
                  {d.label}
                </text>
              )
            })}
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <motion.div
          className="absolute pointer-events-none z-10 px-2 py-1 rounded-md text-xs"
          style={{
            left: tooltipPos.x + 8,
            top: tooltipPos.y - 32,
            background: 'color-mix(in srgb, var(--ink-100) 95%, transparent)',
            border: '1px solid color-mix(in srgb, var(--paper-100) 10%, transparent)',
            color: 'var(--paper-100)',
          }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        >
          <span className="text-[var(--text-tertiary)]">{data[hoveredIndex].label}: </span>
          <span className="font-medium">{data[hoveredIndex].value}</span>
        </motion.div>
      )}
    </div>
  )
}
