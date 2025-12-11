import type { Email } from 'database/schema'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { actions } from 'astro:actions'
import { CheckCheck, MailIcon, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { ClaimMailboxDialog } from './ClaimMailboxDialog'
import { MailboxStats } from './MailboxStats'
import MailItem from './MailItem'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Skeleton } from './ui/skeleton'

const queryClient = new QueryClient()

interface InboxProps {
  mails: Email[]
  mailboxAddress: string
  isClaimed: boolean
}

export function Inbox({ mails, mailboxAddress, isClaimed }: InboxProps) {
  const { toast } = useToast()
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const previousEmailCount = useRef(mails.length)

  const { data, isFetching } = useQuery({
    queryKey: ['emails'],
    queryFn: async () => {
      const res = (await actions.getEmailsByMessageToWho()).data!
      return res
    },
    initialData: mails,
    refetchInterval: 30000,
  })

  // Detect new emails
  useEffect(() => {
    if (data.length > previousEmailCount.current) {
      const newEmailsCount = data.length - previousEmailCount.current
      const newEmails = data.slice(0, newEmailsCount)

      // Show toast for new emails
      if (newEmailsCount === 1 && newEmails[0]) {
        const email = newEmails[0]
        toast({
          title: '📬 New email received',
          description: `From: ${email.from.name || email.from.address}`,
        })
      }
      else {
        toast({
          title: `📬 ${newEmailsCount} new emails received`,
          description: 'Check your inbox',
        })
      }
    }

    previousEmailCount.current = data.length
  }, [data, toast])

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['emails'],
    })
  }

  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true)

    try {
      await actions.markAllAsRead()

      // Refresh email list
      queryClient.invalidateQueries({
        queryKey: ['emails'],
      })

      toast({
        title: 'All emails marked as read',
        description: `${data.length} ${data.length === 1 ? 'email' : 'emails'} marked as read`,
      })
    }
    catch {
      toast({
        title: 'Failed to mark all as read',
        description: 'Please try again',
        variant: 'destructive',
      })
    }
    finally {
      setIsMarkingAllRead(false)
    }
  }

  // Filter emails based on search term
  const filteredEmails = useMemo(() => {
    if (!searchTerm.trim())
      return data

    const lowerSearch = searchTerm.toLowerCase()

    return data.filter((email) => {
      const subject = email.subject?.toLowerCase() || ''
      const fromName = email.from.name?.toLowerCase() || ''
      const fromAddress = email.from.address?.toLowerCase() || ''
      const text = email.text?.toLowerCase() || ''

      return (
        subject.includes(lowerSearch)
        || fromName.includes(lowerSearch)
        || fromAddress.includes(lowerSearch)
        || text.includes(lowerSearch)
      )
    })
  }, [data, searchTerm])

  const hasUnreadEmails = data.some(email => !email.isRead)

  return (
    <div className="space-y-6">
      {/* Stats Panel */}
      {data.length > 0 && <MailboxStats />}

      {/* Search Bar */}
      {data.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails (sender, subject, content)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MailIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Inbox</h2>
            {data.length > 0 && (
              <Badge variant="secondary" className="mt-1">
                {searchTerm
                  ? `${filteredEmails.length} of ${data.length}`
                  : `${data.length} ${data.length === 1 ? 'email' : 'emails'}`}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isClaimed && mailboxAddress && (
            <ClaimMailboxDialog mailboxAddress={mailboxAddress} />
          )}
          {hasUnreadEmails && data.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAllRead}
            >
              <CheckCheck className={`h-4 w-4 mr-2 ${isMarkingAllRead ? 'animate-pulse' : ''}`} />
              Mark all read
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isFetching && data.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Email List */}
      {!isFetching && data.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative inline-block mb-6">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <MailIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-2">
              Waiting for emails...
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm leading-relaxed">
              Your temporary mailbox is ready! Use this email address to sign up for services,
              and new emails will appear here automatically within 30 seconds.
            </p>

            {/* Usage Guide */}
            <details className="w-full max-w-md text-left bg-muted/30 rounded-lg p-4 cursor-pointer group">
              <summary className="text-sm font-medium list-none flex items-center justify-between">
                <span className="flex items-center gap-2">
                  💡 How to use your temporary mailbox?
                </span>
                <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <ol className="mt-4 space-y-2 text-sm text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold">1.</span>
                  <span>Copy your email address from the left panel</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold">2.</span>
                  <span>Paste it on any website that requires email</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold">3.</span>
                  <span>Return here to check for verification emails</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold">4.</span>
                  <span>Complete verification and delete the mailbox</span>
                </li>
              </ol>
            </details>
          </div>
        )
        : filteredEmails.length > 0
          ? (
            <div className="space-y-2">
              {filteredEmails.map((mail: Email) => (
                <MailItem key={mail.id} mail={mail} />
              ))}
            </div>
          )
          : searchTerm
            ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try a different search term or clear the search
                </p>
                <Button variant="outline" size="sm" onClick={() => setSearchTerm('')}>
                  Clear search
                </Button>
              </div>
            )
            : null}
    </div>
  )
}

export default function InboxWithQuery({ mails, mailboxAddress, isClaimed }: InboxProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Inbox mails={mails} mailboxAddress={mailboxAddress} isClaimed={isClaimed} />
    </QueryClientProvider>
  )
}
