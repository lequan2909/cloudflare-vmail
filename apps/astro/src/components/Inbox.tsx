import type { Email } from 'database/schema'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { actions } from 'astro:actions'
import { MailIcon, RefreshCw } from 'lucide-react'
import MailItem from './MailItem'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const queryClient = new QueryClient()

export function Inbox({ mails }: { mails: Email[] }) {
  const { data, isFetching } = useQuery({
    queryKey: ['emails'],
    queryFn: async () => {
      const res = (await actions.getEmailsByMessageToWho()).data!
      return res
    },
    initialData: mails,
    refetchInterval: 30000, // refetch every 30 seconds
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['emails'],
    })
  }

  return (
    <div className="space-y-6">
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
                {data.length} {data.length === 1 ? 'email' : 'emails'}
              </Badge>
            )}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Email List */}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MailIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {isFetching ? 'Checking for emails...' : 'No emails yet'}
          </h3>
          <p className="text-muted-foreground max-w-sm">
            {isFetching
              ? 'Looking for new messages in your inbox.'
              : 'Your temporary email address is ready. New emails will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((mail: Email) => (
            <MailItem key={mail.id} mail={mail} />
          ))}
        </div>
      )}
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
