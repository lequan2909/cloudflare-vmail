import type { Email } from 'database/schema'
import { formatDistanceToNow } from 'date-fns'

export default function MailItem({ mail: item }: { mail: Email }) {
  return (
    <a
      href={`/mails/${item.id}`}
      key={item.id}
      className="block p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">
                {item.from.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="font-medium text-card-foreground text-sm">
              {item.from.name || item.from.address}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.date || item.createdAt), {
              addSuffix: true,
            })}
          </div>
        </div>

        <div className="space-y-1">
          <div className="font-medium text-sm text-card-foreground line-clamp-1">
            {item.subject || 'No subject'}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2">
            {item.text || item.html?.replace(/<[^>]*>/g, '') || 'No content'}
          </div>
        </div>
      </div>
    </a>
  )
}
