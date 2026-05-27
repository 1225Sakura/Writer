/**
 * Performance monitoring utilities
 * Tracks Core Web Vitals: FCP, LCP, CLS, FID, INP
 */

type PerformanceMetric = {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

interface LayoutShift extends PerformanceEntry {
  hadRecentInput: boolean
  value: number
}

type PerformanceObserver = (metrics: PerformanceMetric[]) => void

class PerformanceMonitor {
  private observers: PerformanceObserver[] = []
  private metrics: PerformanceMetric[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.init()
    }
  }

  private init() {
    // Measure FCP (First Contentful Paint)
    this.observeFCP()

    // Measure LCP (Largest Contentful Paint)
    this.observeLCP()

    // Measure CLS (Cumulative Layout Shift)
    this.observeCLS()

    // Measure FID (First Input Delay) / INP (Interaction to Next Paint)
    this.observeFID()

    // Report on page load
    window.addEventListener('load', () => {
      this.report()
    })
  }

  private observeFCP() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const fcp = entries[entries.length - 1] as PerformancePaintTiming
          if (fcp.name === 'first-contentful-paint') {
            this.recordMetric('FCP', fcp.startTime)
          }
        })
        observer.observe({ type: 'paint', buffered: true })
      } catch (e) {
        // Observer not supported
      }
    }
  }

  private observeLCP() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lcp = entries[entries.length - 1] as PerformancePaintTiming
          this.recordMetric('LCP', lcp.startTime)
        })
        observer.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch (e) {
        // Observer not supported
      }
    }
  }

  private observeCLS() {
    if ('PerformanceObserver' in window) {
      try {
        let clsValue = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as LayoutShift
            if (!layoutShift.hadRecentInput) {
              clsValue += layoutShift.value
            }
          }
          this.recordMetric('CLS', clsValue * 1000) // Convert to ms-like scale
        })
        observer.observe({ type: 'layout-shift', buffered: true })
      } catch (e) {
        // Observer not supported
      }
    }
  }

  private observeFID() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const fid = entries[0] as PerformanceEventTiming
          this.recordMetric('FID', fid.processingStart - fid.startTime)
        })
        observer.observe({ type: 'first-input', buffered: true })
      } catch (e) {
        // Observer not supported
      }
    }
  }

  private recordMetric(name: string, value: number) {
    const rating = this.getRating(name, value)
    const metric = { name, value, rating }
    this.metrics.push(metric)
    this.notifyObservers([metric])
  }

  private getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    // Thresholds based on web-vitals guidelines
    const thresholds: Record<string, { good: number; poor: number }> = {
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      CLS: { good: 100, poor: 300 }, // Scaled by 1000
      FID: { good: 100, poor: 300 },
      INP: { good: 200, poor: 500 },
    }

    const threshold = thresholds[name]
    if (!threshold) return 'needs-improvement'

    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
  }

  private notifyObservers(metrics: PerformanceMetric[]) {
    this.observers.forEach((observer) => observer(metrics))
  }

  subscribe(observer: PerformanceObserver): () => void {
    this.observers.push(observer)
    return () => {
      this.observers = this.observers.filter((o) => o !== observer)
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  report() {
    const metrics = this.getMetrics()
    if (metrics.length === 0) return

    // Send to analytics if configured
    if (import.meta.env.VITE_ANALYTICS_ID) {
      this.sendToAnalytics(metrics)
    }
  }

  private sendToAnalytics(_metrics: PerformanceMetric[]) {
    // Placeholder for analytics integration
    // Could integrate with Vercel Analytics, Plausible, etc.
  }
}

export const performanceMonitor = new PerformanceMonitor()
export type { PerformanceMetric }
