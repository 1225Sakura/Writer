import { Component, ReactNode, ErrorInfo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, RefreshCw, Home, Bug, Feather } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  pageName?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const pageName = this.props.pageName
      const isPageLevel = !!pageName

      return (
        <div
          className={isPageLevel ? 'flex-1 flex items-center justify-center px-6 min-h-0' : 'min-h-screen flex items-center justify-center px-6'}
          style={{ backgroundColor: isPageLevel ? 'transparent' : 'var(--ink-90)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            className="max-w-md w-full rounded-2xl p-8 border"
            style={{
              backgroundColor: 'var(--ink-85)',
              borderColor: 'var(--border-default)',
              boxShadow: 'var(--shadow-elevated-lg)',
            }}
          >
            {/* Icon with glow */}
            <div className="flex justify-center mb-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 15%, transparent) 0%, color-mix(in srgb, var(--color-danger) 5%, transparent) 100%)`,
                  border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)',
                  boxShadow: '0 0 30px color-mix(in srgb, var(--color-danger) 15%, transparent)',
                }}
              >
                <AlertTriangle className="w-8 h-8" style={{ color: 'var(--vermillion-100)' }} />
              </div>
            </div>

            {/* Title */}
            <h1
              className="text-xl font-semibold text-center mb-2"
              style={{ color: 'var(--paper-100)' }}
            >
              {pageName ? `${pageName}页面出了点小问题` : '出了点小问题'}
            </h1>

            {/* Friendly message */}
            <p
              className="text-sm text-center leading-relaxed mb-6"
              style={{ color: 'var(--paper-75)' }}
            >
              {isPageLevel
                ? '该页面遇到了意外状况，但其他页面仍可正常使用。您的数据是安全的。'
                : '应用遇到了一些意外状况，但别担心，您的数据是安全的。'}
              <br />
              您可以尝试恢复或{isPageLevel ? '切换到其他页面' : '重新开始'}。
            </p>

            {/* Error details (collapsible) */}
            {this.state.error && (
              <details className="mb-6 group">
                <summary
                  className="flex items-center gap-2 cursor-pointer text-xs py-2 px-3 rounded-lg border transition-colors duration-200"
                  style={{
                    color: 'var(--text-tertiary)',
                    borderColor: 'var(--border-default)',
                    backgroundColor: 'color-mix(in srgb, var(--paper-100) 2%, transparent)',
                  }}
                >
                  <Bug className="w-3.5 h-3.5" />
                  <span>查看错误详情</span>
                  <span className="ml-auto text-[10px] opacity-50 group-open:hidden">展开</span>
                  <span className="ml-auto text-[10px] opacity-50 hidden group-open:inline">收起</span>
                </summary>
                <div
                  className="mt-2 p-3 rounded-lg text-xs font-mono overflow-auto max-h-40"
                  style={{
                    backgroundColor: 'var(--ink-100)',
                    color: 'var(--text-tertiary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <pre className="whitespace-pre-wrap break-all">{this.state.error.message}</pre>
                  {this.state.errorInfo && (
                    <pre className="whitespace-pre-wrap break-all mt-2 opacity-60">{this.state.errorInfo.componentStack}</pre>
                  )}
                </div>
              </details>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              <Button
                onClick={this.handleReset}
                className="w-full justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-100) 0%, var(--accent-85) 100%)',
                  boxShadow: '0 4px 16px color-mix(in srgb, var(--accent-100) 25%, transparent)',
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                尝试恢复
              </Button>

              <div className="flex gap-2.5">
                {isPageLevel && (
                  <Button
                    onClick={this.handleGoHome}
                    variant="outline"
                    className="flex-1 justify-center"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    返回首页
                  </Button>
                )}

                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className={isPageLevel ? 'flex-1 justify-center' : 'flex-1 justify-center'}
                >
                  <Feather className="w-4 h-4 mr-2" />
                  刷新页面
                </Button>
              </div>
            </div>

            {/* Subtle footer */}
            <p
              className="text-center text-[11px] mt-6 tracking-wide"
              style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}
            >
              自动化写作软件 · 如遇问题请联系支持
            </p>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
