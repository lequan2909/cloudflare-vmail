import { Check, Code2, Copy, FileText, Maximize2, Shield, Sparkles, Send, Paperclip, File as FileIcon, Download } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { buildRawMime, copyToClipboard, sanitizeHtml } from '@/lib/email-utils'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

interface EmailViewerProps {
  email: {
    id?: string
    from?: { name?: string, address: string }
    messageTo?: string
    subject?: string | null
    date?: string | null
    messageId?: string
    text?: string | null
    html?: string | null
    sender?: { name?: string, address: string }
    attachments?: Array<{
      filename: string
      size: number
      contentType: string
      r2Key: string
    }>
  }
}

type ViewMode = 'html' | 'text' | 'raw' | 'reply'

export function EmailViewer({ email }: EmailViewerProps) {
  const [mode, setMode] = useState<ViewMode>(() => {
    return email.html ? 'html' : 'text'
  })
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Reply State
  const [replyText, setReplyText] = useState('')
  const [instructions, setInstructions] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { toast } = useToast()

  const safeHtml = useMemo(() => {
    if (!email.html)
      return ''
    return sanitizeHtml(email.html)
  }, [email.html])

  const rawSource = useMemo(() => {
    return buildRawMime(email)
  }, [email])

  // Update iframe content when HTML changes
  useEffect(() => {
    if (mode === 'html' && iframeRef.current && safeHtml) {
      const iframe = iframeRef.current
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (iframeDoc) {
        iframeDoc.open()
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                  line-height: 1.6;
                  color: #1f2937;
                  margin: 0;
                  padding: 1.5rem;
                  background: transparent;
                }
                img {
                  max-width: 100%;
                  height: auto;
                }
                a {
                  color: #3b82f6;
                  text-decoration: underline;
                }
                table {
                  border-collapse: collapse;
                  width: 100%;
                }
                td, th {
                  padding: 8px;
                  text-align: left;
                }
                @media (prefers-color-scheme: dark) {
                  body {
                    color: #e5e7eb;
                  }
                  a {
                    color: #60a5fa;
                  }
                }
              </style>
            </head>
            <body>
              ${safeHtml}
            </body>
          </html>
        `)
        iframeDoc.close()
      }
    }
  }, [mode, safeHtml])

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
    }
    else {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  const handleGenerateReply = async () => {
    setIsGenerating(true)
    try {
      const apiKey = localStorage.getItem('vmail_admin_key');
      if (!apiKey) throw new Error("No API Key");

      const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";
      const res = await fetch(`${WORKER_URL}/api/v1/admin/ai/reply`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id, instructions })
      });

      const data = await res.json() as any;
      if (data.error) throw new Error(data.error);
      if (data.reply) setReplyText(data.reply);
      else throw new Error("No reply generated");

    } catch (e: any) {
      toast({ title: "Generation Error", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false)
    }
  };

  const handleSendReply = async () => {
    if (!replyText || !confirm("Send this reply?")) return;
    setIsSending(true);
    try {
      const apiKey = localStorage.getItem('vmail_admin_key');
      if (!apiKey) throw new Error("No API Key");

      const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";

      const fromAddr = email.messageTo || "noreply@docxs.online";
      const toAddr = email.from?.address || email.sender?.address;

      if (!toAddr) throw new Error("Could not determine To address");

      const res = await fetch(`${WORKER_URL}/api/v1/send`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddr,
          to: toAddr,
          subject: `Re: ${email.subject}`,
          content: replyText.replace(/\n/g, '<br/>')
        })
      });

      if (res.ok) {
        toast({ title: "Sent", description: "Reply sent successfully" });
        setMode('html');
        setReplyText('');
        setInstructions('');
      } else {
        const err = await res.json() as any;
        throw new Error(err.error || "Failed to send");
      }
    } catch (e: any) {
      toast({ title: "Sending Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={cn('space-y-4', isFullscreen && 'fixed inset-0 z-50 bg-background p-6 overflow-auto')}>
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-muted/30 rounded-lg p-3 border border-border">
        {/* Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={mode === 'html' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('html')}
            disabled={!email.html}
            className="transition-all"
          >
            <Shield className="h-4 w-4 mr-2" />
            HTML View
          </Button>
          <Button
            variant={mode === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('text')}
            disabled={!email.text}
            className="transition-all"
          >
            <FileText className="h-4 w-4 mr-2" />
            Text View
          </Button>
          <Button
            variant={mode === 'raw' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('raw')}
            className="transition-all"
          >
            <Code2 className="h-4 w-4 mr-2" />
            Raw MIME
          </Button>
          <Button
            variant={mode === 'reply' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (!localStorage.getItem('vmail_admin_key')) {
                alert("Please login with API Key first!");
                return;
              }
              setMode('reply');
            }}
            className={cn("transition-all", mode === 'reply' ? "bg-purple-600 hover:bg-purple-700 text-white" : "")}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Smart Reply
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="transition-all"
          >
            {copied
              ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Copied
                </>
              )
              : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
          </Button>

          {mode === 'html' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="transition-all"
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      {mode === 'html' && email.html && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Secure HTML Rendering
              </p>
              <p className="text-blue-700 dark:text-blue-300 text-xs">
                Email is displayed in a sandboxed iframe. All scripts, forms, and potentially dangerous content have been sanitized. External links open in new tabs.
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === 'text' && email.text && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-green-900 dark:text-green-100 mb-1">
                Plain Text View
              </p>
              <p className="text-green-700 dark:text-green-300 text-xs">
                Viewing the plain text version - most reliable for extracting codes and reading content without formatting.
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === 'raw' && (
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Code2 className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                Raw MIME Source
              </p>
              <p className="text-purple-700 dark:text-purple-300 text-xs">
                Viewing the reconstructed MIME source - useful for debugging email delivery issues and exporting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Attachments Section */}
      {email.attachments && email.attachments.length > 0 && (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Attachments ({email.attachments.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {email.attachments.map((att, i) => (
              <a
                key={i}
                href={`${import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev"}/api/v1/attachments/${email.id}/${encodeURIComponent(att.filename)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-md hover:border-primary/50 transition-colors group"
                download
              >
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10">
                  <FileIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" title={att.filename}>{att.filename}</p>
                  <p className="text-xs text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</p>
                </div>
                <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Content Display */}
      <div
        className={cn(
          'rounded-lg border-2 border-border overflow-hidden transition-all shadow-sm',
          'bg-card',
        )}
      >
        {mode === 'html' && (email.html ? (
          <iframe
            ref={iframeRef}
            title="Email HTML Content"
            sandbox="allow-same-origin allow-popups"
            className="w-full min-h-[500px] bg-white dark:bg-gray-900"
            style={{ height: isFullscreen ? 'calc(100vh - 300px)' : '600px' }}
          />
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No HTML content available</p>
            <p className="text-sm text-muted-foreground mt-2">Try viewing the plain text version instead</p>
          </div>
        )
        )}

        {mode === 'text' && (email.text ? (
          <pre className="whitespace-pre-wrap text-sm p-6 font-mono leading-relaxed text-foreground overflow-auto max-h-[600px]">
            {email.text}
          </pre>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No plain text content available</p>
            <p className="text-sm text-muted-foreground mt-2">Try viewing the HTML version instead</p>
          </div>
        )
        )}

        {mode === 'raw' && (
          <div className="relative">
            <pre className="whitespace-pre text-xs p-6 font-mono bg-muted/50 overflow-auto max-h-[600px] text-foreground">
              {rawSource}
            </pre>
          </div>
        )}

        {mode === 'reply' && (
          <div className="p-6 space-y-4 bg-card">
            <div className="space-y-2">
              <label className="text-sm font-medium">Optional Instructions for AI</label>
              <input
                className="w-full p-2 border rounded bg-background"
                placeholder="e.g. Decline gently, or ask for more details..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleGenerateReply} disabled={isGenerating} size="sm">
                {isGenerating ?
                  <><Sparkles className="w-4 h-4 mr-2 animate-spin" /> Generating...</> :
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Draft</>
                }
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reply Content</label>
              <textarea
                className="w-full h-64 p-4 border rounded bg-background font-mono text-sm"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Generated reply will appear here..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setMode('html')}>Cancel</Button>
              <Button onClick={handleSendReply} disabled={isSending || !replyText}>
                {isSending ? <><Send className="w-4 h-4 mr-2 animate-pulse" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send Reply</>}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 border border-border">
        <div className="flex items-center gap-4">
          {mode === 'html' && email.html && (
            <span>HTML: {(email.html.length / 1024).toFixed(2)} KB</span>
          )}
          {mode === 'text' && email.text && (
            <span>Text: {(email.text.length / 1024).toFixed(2)} KB</span>
          )}
          {mode === 'raw' && (
            <span>Raw: {(rawSource.length / 1024).toFixed(2)} KB</span>
          )}
          {mode === 'reply' && (
            <span>Compose Mode</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <code className="bg-muted px-2 py-0.5 rounded text-[10px] select-all cursor-pointer" onClick={() => copyToClipboard(email.id || "")} title="Click to copy ID">
            ID: {email.id}
          </code>
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Content loaded</span>
        </div>
      </div>
    </div>
  )
}
