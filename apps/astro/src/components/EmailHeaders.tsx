import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check, Database } from 'lucide-react'
import { Button } from './ui/button'
import { copyToClipboard } from '@/lib/email-utils'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

type Address = {
  address: string
  name?: string
}

type Header = Record<string, string>

interface EmailHeadersProps {
  email: {
    id?: string
    messageFrom?: string
    messageTo?: string
    headers?: Header[]
    from?: Address
    sender?: Address
    replyTo?: Address[]
    deliveredTo?: string
    returnPath?: string
    to?: Address[]
    cc?: Address[]
    bcc?: Address[]
    subject?: string
    messageId?: string
    inReplyTo?: string
    references?: string
    date?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isRead?: boolean
    readAt?: Date | string | null
    priority?: string
  }
}

interface HeaderItem {
  label: string
  value: string
  copyable?: boolean
}

// Helper function to format addresses
function formatAddress(addr: Address | undefined | null): string {
  if (!addr) return 'N/A'
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address
}

function formatAddresses(addrs: Address[] | undefined | null): string {
  if (!addrs || addrs.length === 0) return 'N/A'
  return addrs.map(addr => formatAddress(addr)).join(', ')
}

export function EmailHeaders({ email }: EmailHeadersProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const { toast } = useToast()

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const handleCopy = async (text: string, fieldName: string) => {
    const success = await copyToClipboard(text)

    if (success) {
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
      toast({
        title: 'Copied to clipboard',
        description: `${fieldName} copied successfully`,
      })
    }
  }

  // Primary Headers - Always Visible
  const primaryHeaders: HeaderItem[] = [
    {
      label: 'From',
      value: formatAddress(email.from),
      copyable: true,
    },
    {
      label: 'To',
      value: email.messageTo || 'Unknown',
      copyable: true,
    },
    {
      label: 'Subject',
      value: email.subject || '(No subject)',
      copyable: true,
    },
    {
      label: 'Date',
      value: email.date
        ? format(new Date(email.date), 'PPpp')
        : email.createdAt
          ? format(new Date(email.createdAt), 'PPpp')
          : 'Unknown',
      copyable: false,
    },
  ]

  // Recipient Details
  const recipientHeaders: HeaderItem[] = [
    {
      label: 'To (Parsed)',
      value: formatAddresses(email.to),
      copyable: true,
    },
    {
      label: 'CC',
      value: formatAddresses(email.cc),
      copyable: true,
    },
    {
      label: 'BCC',
      value: formatAddresses(email.bcc),
      copyable: true,
    },
    {
      label: 'Reply-To',
      value: formatAddresses(email.replyTo),
      copyable: true,
    },
    {
      label: 'Sender',
      value: formatAddress(email.sender),
      copyable: true,
    },
  ]

  // Technical Headers
  const technicalHeaders: HeaderItem[] = [
    {
      label: 'Message-ID',
      value: email.messageId || 'N/A',
      copyable: true,
    },
    {
      label: 'In-Reply-To',
      value: email.inReplyTo || 'N/A',
      copyable: true,
    },
    {
      label: 'References',
      value: email.references || 'N/A',
      copyable: true,
    },
    {
      label: 'Return-Path',
      value: email.returnPath || 'N/A',
      copyable: true,
    },
    {
      label: 'Delivered-To',
      value: email.deliveredTo || 'N/A',
      copyable: true,
    },
  ]

  // Database Metadata
  const metadataHeaders: HeaderItem[] = [
    {
      label: 'Email ID',
      value: email.id || 'N/A',
      copyable: true,
    },
    {
      label: 'Message From',
      value: email.messageFrom || 'N/A',
      copyable: true,
    },
    {
      label: 'Message To',
      value: email.messageTo || 'N/A',
      copyable: true,
    },
    {
      label: 'Priority',
      value: email.priority || 'normal',
      copyable: false,
    },
    {
      label: 'Read Status',
      value: email.isRead ? 'Read' : 'Unread',
      copyable: false,
    },
    {
      label: 'Read At',
      value: email.readAt
        ? format(new Date(email.readAt), 'PPpp')
        : 'Not read yet',
      copyable: false,
    },
    {
      label: 'Created At',
      value: email.createdAt
        ? format(new Date(email.createdAt), 'PPpp')
        : 'N/A',
      copyable: false,
    },
    {
      label: 'Updated At',
      value: email.updatedAt
        ? format(new Date(email.updatedAt), 'PPpp')
        : 'N/A',
      copyable: false,
    },
  ]

  return (
    <div className="bg-muted/30 rounded-lg border border-border overflow-hidden">
      {/* Primary Headers - Always Visible */}
      <div className="p-4 space-y-3">
        {primaryHeaders.map((header) => (
          <HeaderRow
            key={header.label}
            label={header.label}
            value={header.value}
            copyable={header.copyable}
            copied={copiedField === header.label}
            onCopy={() => handleCopy(header.value, header.label)}
          />
        ))}
      </div>

      {/* Recipient Details - Collapsible */}
      <CollapsibleSection
        title="Recipient Details"
        sectionId="recipients"
        expanded={expandedSection === 'recipients'}
        onToggle={() => toggleSection('recipients')}
      >
        {recipientHeaders.map((header) => (
          <HeaderRow
            key={header.label}
            label={header.label}
            value={header.value}
            copyable={header.copyable}
            copied={copiedField === header.label}
            onCopy={() => handleCopy(header.value, header.label)}
          />
        ))}
      </CollapsibleSection>

      {/* Technical Headers - Collapsible */}
      <CollapsibleSection
        title="Technical Details"
        sectionId="technical"
        expanded={expandedSection === 'technical'}
        onToggle={() => toggleSection('technical')}
      >
        {technicalHeaders.map((header) => (
          <HeaderRow
            key={header.label}
            label={header.label}
            value={header.value}
            copyable={header.copyable}
            copied={copiedField === header.label}
            onCopy={() => handleCopy(header.value, header.label)}
          />
        ))}
      </CollapsibleSection>

      {/* Database Metadata - Collapsible */}
      <CollapsibleSection
        title="Database Metadata"
        sectionId="metadata"
        expanded={expandedSection === 'metadata'}
        onToggle={() => toggleSection('metadata')}
        icon={<Database className="h-4 w-4 text-muted-foreground" />}
      >
        {metadataHeaders.map((header) => (
          <HeaderRow
            key={header.label}
            label={header.label}
            value={header.value}
            copyable={header.copyable}
            copied={copiedField === header.label}
            onCopy={() => handleCopy(header.value, header.label)}
          />
        ))}
      </CollapsibleSection>

      {/* Raw Headers - Collapsible */}
      {email.headers && email.headers.length > 0 && (
        <CollapsibleSection
          title={`Raw SMTP Headers (${email.headers.length})`}
          sectionId="raw-headers"
          expanded={expandedSection === 'raw-headers'}
          onToggle={() => toggleSection('raw-headers')}
        >
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {email.headers.map((header, index) => (
              <div key={index} className="text-xs font-mono">
                {Object.entries(header).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[150px_1fr] gap-2 py-1">
                    <div className="text-muted-foreground font-semibold truncate">
                      {key}:
                    </div>
                    <div className="text-foreground break-all">{value}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

interface CollapsibleSectionProps {
  title: string
  sectionId: string
  expanded: boolean
  onToggle: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  icon,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border-t border-border">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border bg-muted/20">
          <div className="pt-3 space-y-3">{children}</div>
        </div>
      )}
    </div>
  )
}

interface HeaderRowProps {
  label: string
  value: string
  copyable?: boolean
  copied?: boolean
  onCopy?: () => void
}

function HeaderRow({ label, value, copyable, copied, onCopy }: HeaderRowProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="flex items-start gap-2 min-w-0">
        <div className="text-sm text-foreground break-all flex-1 font-mono">
          {value}
        </div>
        {copyable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={onCopy}
            title={`Copy ${label}`}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
