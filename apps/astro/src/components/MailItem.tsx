import type { Email } from 'database/schema'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { actions } from 'astro:actions'
import { Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MailItem({ mail: item }: { mail: Email }) {
  const [isRead, setIsRead] = useState(item.isRead)

  const handleClick = async (e: React.MouseEvent) => {
    if (!isRead) {
      // Optimistically update UI
      setIsRead(true)
      // Mark as read in background
      actions.markEmailAsRead({ id: item.id }).catch(() => {
        // Revert on error
        setIsRead(false)
      })
    }
  }

  return (
    <a
      href={`/mails/${item.id}`}
      onClick={handleClick}
      className={cn(
        'block p-4 rounded-lg border transition-colors',
        isRead
          ? 'bg-card border-border hover:bg-muted/50'
          : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
      )}
    >
      <div className="flex items-start gap-3">
        {!isRead && (
          <div className="mt-1">
            <Circle className="h-2 w-2 fill-primary text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-primary">
                  {item.from.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className={cn(
                'text-sm truncate',
                isRead ? 'font-medium' : 'font-semibold'
              )}>
                {item.from.name || item.from.address}
              </div>
            </div>
            <div className="text-xs text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(item.date || item.createdAt), {
                addSuffix: true,
              })}
            </div>
          </div>

          <div className="space-y-1">
            <div className={cn(
              'text-sm line-clamp-1',
              isRead ? 'font-medium' : 'font-semibold'
            )}>
              {item.subject || 'No subject'}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {item.text || item.html?.replace(/<[^>]*>/g, '') || 'No content'}
            </div>
          </div>
        </div>
      </div>
    </a>
  )
}

