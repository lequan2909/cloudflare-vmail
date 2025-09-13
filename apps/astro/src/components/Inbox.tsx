import type { Email } from 'database/schema'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { actions } from 'astro:actions'
import { MailIcon, RefreshCw, Clock, TrendingUp } from 'lucide-react'
import { useState, useEffect } from 'react'
import MailItem from './MailItem'
import PulsatingDots from './ui/pulsating-loader'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const queryClient = new QueryClient()

export function Inbox({ mails }: { mails: Email[] }) {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [previousCount, setPreviousCount] = useState<number>(mails.length)
  const [hasNewEmails, setHasNewEmails] = useState<boolean>(false)

  const { data, isFetching } = useQuery({
    queryKey: ['emails'],
    queryFn: async () => {
      const res = (await actions.getEmailsByMessageToWho()).data!
      setLastRefresh(new Date())
      return res
    },
    initialData: mails,
    refetchInterval: 20000, // refetch every 20 seconds
  })

  // Check for new emails
  useEffect(() => {
    if (data.length > previousCount) {
      setHasNewEmails(true)
      setTimeout(() => setHasNewEmails(false), 3000) // Clear notification after 3 seconds
    }
    setPreviousCount(data.length)
  }, [data.length, previousCount])

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['emails'],
    })
  }

  const formatLastRefresh = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    return `${Math.floor(diffInSeconds / 3600)}h ago`
  }

  return (
    <div className="h-full">
      {/* Unified Header */}
      <div className="relative mb-6">
        {/* New email notification */}
        {hasNewEmails && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-full shadow-lg animate-in slide-in-from-top-2">
              <TrendingUp className="h-3 w-3" />
              <span>New email received!</span>
            </div>
          </div>
        )}

        <div className="p-5 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-border/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            {/* Left section - Title and status */}
            <div className="flex items-center gap-4">
              <div
                className={`p-2.5 rounded-xl transition-all duration-200 ${
                  isFetching
                    ? 'bg-primary/20 animate-pulse shadow-sm'
                    : data.length > 0
                      ? 'bg-primary/10 shadow-sm'
                      : 'bg-muted/50'
                }`}
              >
                <MailIcon
                  className={`h-6 w-6 transition-colors ${
                    data.length > 0 ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-foreground">Inbox</h2>
                  {data.length > 0 && (
                    <Badge
                      variant={hasNewEmails ? 'default' : 'secondary'}
                      className={`text-xs px-2.5 py-1 transition-all ${
                        hasNewEmails ? 'animate-pulse shadow-sm' : ''
                      }`}
                    >
                      {data.length} {data.length === 1 ? 'email' : 'emails'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full transition-colors ${
                        isFetching ? 'bg-blue-500 animate-pulse' : 'bg-green-500'
                      }`}
                    />
                    <span className="font-medium">{isFetching ? 'Syncing' : 'Live'}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Updated {formatLastRefresh(lastRefresh)}</span>
                  </div>
                  {isFetching && (
                    <>
                      <span>•</span>
                      <span className="text-primary font-medium">Checking...</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right section - Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
                className="h-9 px-3 hover:bg-background/80 transition-all"
                title={isFetching ? 'Refreshing...' : 'Refresh inbox'}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 transition-transform ${
                    isFetching ? 'animate-spin' : 'hover:rotate-180'
                  }`}
                />
                <span className="text-xs font-medium">{isFetching ? 'Refreshing' : 'Refresh'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="relative">
        {data.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <MailIcon className="h-10 w-10 text-primary/60" />
              </div>
              {isFetching && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <PulsatingDots />
                  </div>
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {isFetching ? 'Checking for emails...' : 'No emails yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              {isFetching
                ? "We're checking your inbox for new messages."
                : 'Your temporary email address is ready. New emails will appear here automatically every 20 seconds.'}
            </p>
            {!isFetching && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Auto-refresh enabled</span>
              </div>
            )}
          </div>
        )}

        {data.length > 0 && (
          <div className="relative">
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
              {data.map((mail: Email, index) => (
                <div
                  key={mail.id}
                  className={`transition-all duration-300 ${
                    hasNewEmails && index === 0
                      ? 'animate-in slide-in-from-top-2 border-l-2 border-l-primary pl-2'
                      : ''
                  }`}
                >
                  <MailItem mail={mail} />
                </div>
              ))}
            </div>

            {/* Loading overlay for when fetching */}
            {isFetching && (
              <div className="absolute top-0 right-0 p-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <PulsatingDots />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function InboxWithQuery({ mails }: { mails: Email[] }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Inbox mails={mails} />
    </QueryClientProvider>
  )
}
