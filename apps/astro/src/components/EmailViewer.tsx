import { useMemo, useState } from 'react'
import { Shield, FileText, Code2, Copy, Check } from 'lucide-react'
import { Button } from './ui/button'
import { sanitizeHtml, buildRawMime, copyToClipboard } from '@/lib/email-utils'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface EmailViewerProps {
  email: {
    id?: string
    from?: { name?: string; address: string }
    messageTo?: string
    subject?: string
    date?: string
    messageId?: string
    text?: string
    html?: string
  }
}

type ViewMode = 'html' | 'text' | 'raw'

export function EmailViewer({ email }: EmailViewerProps) {
  const [mode, setMode] = useState<ViewMode>('html')
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const safeHtml = useMemo(() => {
    if (!email.html) return ''
    return sanitizeHtml(email.html)
  }, [email.html])

  const rawSource = useMemo(() => {
    return buildRawMime(email)
  }, [email])

  const handleCopy = async () => {
    let textToCopy = ''

    switch (mode) {
      case 'html':
        textToCopy = email.html || ''
        break
      case 'text':
        textToCopy = email.text || ''
        break
      case 'raw':
        textToCopy = rawSource
        break
    }

    const success = await copyToClipboard(textToCopy)

    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: 'Copied to clipboard',
        description: `${mode.toUpperCase()} content copied successfully`,
      })
    } else {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'html' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('html')}
            className="transition-all"
          >
            <Shield className="h-4 w-4 mr-2" />
            Safe HTML
          </Button>
          <Button
            variant={mode === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('text')}
            className="transition-all"
          >
            <FileText className="h-4 w-4 mr-2" />
            Plain Text
          </Button>
          <Button
            variant={mode === 'raw' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('raw')}
            className="transition-all"
          >
            <Code2 className="h-4 w-4 mr-2" />
            Raw Source
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="transition-all"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Security Notice */}
      {mode === 'html' && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 dark:text-blue-300">
              <strong>Safe Mode:</strong> Dangerous scripts, forms, and external resources have been removed. All links open in new tabs.
            </div>
          </div>
        </div>
      )}

      {/* Content Display */}
      <div
        className={cn(
          'rounded-lg border border-border overflow-hidden transition-all',
          'bg-card'
        )}
      >
        {mode === 'html' && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none p-6 email-content"
            dangerouslySetInnerHTML={{ __html: safeHtml || '<p class="text-muted-foreground italic">No HTML content</p>' }}
          />
        )}

        {mode === 'text' && (
          <pre className="whitespace-pre-wrap text-sm p-6 font-mono leading-relaxed text-foreground overflow-auto">
            {email.text || 'No text content available'}
          </pre>
        )}

        {mode === 'raw' && (
          <div className="relative">
            <pre className="whitespace-pre text-xs p-6 font-mono bg-muted/50 overflow-auto max-h-[600px] text-foreground">
              {rawSource}
            </pre>
          </div>
        )}
      </div>

      {/* Mode Description */}
      <div className="text-xs text-muted-foreground">
        {mode === 'html' && (
          <p>
            📧 Viewing sanitized HTML content with security protections enabled
          </p>
        )}
        {mode === 'text' && (
          <p>
            📄 Viewing plain text version - most reliable for reading content
          </p>
        )}
        {mode === 'raw' && (
          <p>
            🔍 Viewing raw MIME source - useful for debugging and exporting
          </p>
        )}
      </div>
    </div>
  )
}
