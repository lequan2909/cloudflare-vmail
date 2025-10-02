import type { ButtonHTMLAttributes, DetailedHTMLProps } from 'react'
import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Button } from './ui/button'

interface CopyButtonProps
  extends DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  content: string
}

export default function CopyButton({ content, ...props }: CopyButtonProps) {
  const [status, setStatus] = useState<keyof typeof icons>('idle')

  const icons = {
    idle: <Icon icon="ph:copy" className="h-4 w-4" />,
    error: <Icon icon="mdi:exclamation" className="h-4 w-4 text-red-500" />,
    success: <Icon icon="mdi:check" className="h-4 w-4 text-green-500" />,
  }

  const tooltips = {
    idle: 'Copy to clipboard',
    error: 'Failed to copy',
    success: 'Copied!',
  }

  function copy() {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(content)
        .then(() => {
          setStatus('success')
          setTimeout(() => setStatus('idle'), 2000)
        })
        .catch(() => {
          setStatus('error')
          setTimeout(() => setStatus('idle'), 2000)
        })
    }
    else {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea')
        textArea.value = content
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (successful) {
          setStatus('success')
          setTimeout(() => setStatus('idle'), 2000)
        }
        else {
          setStatus('error')
          setTimeout(() => setStatus('idle'), 2000)
        }
      }
      catch {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 2000)
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      {...props}
      onClick={copy}
      title={tooltips[status]}
      className={`transition-all ${status === 'success' ? 'bg-green-500/10' : status === 'error' ? 'bg-red-500/10' : ''} ${props.className || ''}`}
    >
      {icons[status]}
    </Button>
  )
}
