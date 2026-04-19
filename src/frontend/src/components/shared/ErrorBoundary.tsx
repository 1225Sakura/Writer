import { Component, ReactNode, ErrorInfo } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
          <div className="max-w-md w-full bg-[#232338] rounded-lg p-6 border border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-[#e8b87d]" />
              <h1 className="text-xl font-semibold text-[#f5f0e6]">出错了</h1>
            </div>
            <p className="text-[#a0a6b5] mb-4">
              应用遇到了一些问题，请尝试刷新页面或返回首页。
            </p>
            {this.state.error && (
              <details className="mb-4 p-3 bg-[#1a1a2e] rounded text-xs text-[#7a8194] font-mono overflow-auto">
                <summary className="cursor-pointer mb-1">错误详情</summary>
                <pre className="whitespace-pre-wrap">{this.state.error.message}</pre>
              </details>
            )}
            <div className="flex gap-3">
              <Button onClick={this.handleReset} variant="outline">
                重试
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新页面
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
