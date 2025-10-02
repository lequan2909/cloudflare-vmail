# 📅 Cloudflare VMails 开发路线图

> **专注于开发效率 - 快速迭代，持续交付**

---

## 🎯 版本规划总览

| 版本 | 目标 | 周期 | 核心价值 |
|------|------|------|----------|
| **v1.1.0** | 紧急修复 | ✅ 已完成 | 修复 bug，提升基础体验 |
| **v1.2.0** | 核心功能 | 2-3周 | 用户留存+参与度 |
| **v1.3.0** | 高级功能 | 3-4周 | 竞争力+差异化 |
| **v2.0.0** | 现代化升级 | 1-2月 | 架构优化+性能提升 |

---

## ✅ v1.1.0 - 紧急修复版（已完成）

### 完成项
- ✅ 修复所有 TypeScript 类型错误
- ✅ 修正拼写错误（7处）
- ✅ 统一 zod 版本到 3.22.4
- ✅ 优化 Inbox 空状态和加载状态
- ✅ 改进 CopyButton 交互反馈
- ✅ 创建 Skeleton 组件

---

## 🔥 v1.2.0 - 核心功能版（2-3周）

### 数据库迁移

```sql
-- 新增字段
ALTER TABLE emails ADD COLUMN is_read INTEGER DEFAULT 0;
ALTER TABLE emails ADD COLUMN read_at INTEGER;
ALTER TABLE emails ADD COLUMN priority TEXT DEFAULT 'normal';  -- high, normal, low

-- 新增索引（性能优化）
CREATE INDEX idx_message_to ON emails(message_to);
CREATE INDEX idx_created_at_desc ON emails(created_at DESC);
CREATE INDEX idx_is_read ON emails(is_read);
CREATE INDEX idx_composite_inbox ON emails(message_to, created_at DESC, is_read);

-- 新增邮箱元数据表
CREATE TABLE mailbox_metadata (
  mailbox TEXT PRIMARY KEY,
  alias TEXT,                          -- 邮箱别名
  total_emails INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  last_email_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 用户偏好表
CREATE TABLE user_preferences (
  mailbox TEXT PRIMARY KEY,
  notifications_enabled INTEGER DEFAULT 1,
  auto_refresh_interval INTEGER DEFAULT 30000,
  theme TEXT DEFAULT 'system',
  compact_mode INTEGER DEFAULT 0
);
```

### 后端功能

#### 1. 分页支持（`packages/database/dao.ts`）
```typescript
export async function getEmailsByMessageTo(
  db: DrizzleD1Database,
  messageTo: string,
  options?: {
    limit?: number
    offset?: number
    unreadOnly?: boolean
  }
) {
  const { limit = 50, offset = 0, unreadOnly = false } = options || {}

  let query = db
    .select()
    .from(emails)
    .where(eq(emails.messageTo, messageTo))
    .orderBy(desc(emails.createdAt))
    .limit(limit)
    .offset(offset)

  if (unreadOnly) {
    query = query.where(eq(emails.isRead, 0))
  }

  return await query.all()
}
```

#### 2. 标记已读/未读
```typescript
export async function markEmailAsRead(
  db: DrizzleD1Database,
  id: string
) {
  return await db
    .update(emails)
    .set({
      isRead: 1,
      readAt: new Date()
    })
    .where(eq(emails.id, id))
    .execute()
}

export async function markAllAsRead(
  db: DrizzleD1Database,
  messageTo: string
) {
  return await db
    .update(emails)
    .set({
      isRead: 1,
      readAt: new Date()
    })
    .where(eq(emails.messageTo, messageTo))
    .execute()
}
```

#### 3. 邮箱统计
```typescript
export async function getMailboxStats(
  db: DrizzleD1Database,
  messageTo: string
) {
  const [total, unread] = await Promise.all([
    db.select({ count: count() })
      .from(emails)
      .where(eq(emails.messageTo, messageTo)),
    db.select({ count: count() })
      .from(emails)
      .where(and(
        eq(emails.messageTo, messageTo),
        eq(emails.isRead, 0)
      ))
  ])

  return {
    total: total[0]?.count || 0,
    unread: unread[0]?.count || 0,
    read: (total[0]?.count || 0) - (unread[0]?.count || 0)
  }
}
```

### 前端核心功能

#### 1. 浏览器通知系统
```typescript
// components/EmailNotification.tsx
import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from './ui/button'

export function EmailNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setPermission(Notification.permission)
    setEnabled(localStorage.getItem('notifications-enabled') === 'true')
  }, [])

  const requestPermission = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      setEnabled(true)
      localStorage.setItem('notifications-enabled', 'true')
    }
  }

  const toggleNotifications = () => {
    const newState = !enabled
    setEnabled(newState)
    localStorage.setItem('notifications-enabled', String(newState))
  }

  return (
    <div className="flex items-center gap-2">
      {permission === 'default' && (
        <Button onClick={requestPermission} variant="outline" size="sm">
          <Bell className="h-4 w-4 mr-2" />
          Enable Notifications
        </Button>
      )}

      {permission === 'granted' && (
        <Button
          onClick={toggleNotifications}
          variant={enabled ? "default" : "outline"}
          size="sm"
        >
          {enabled ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
          {enabled ? 'Notifications On' : 'Notifications Off'}
        </Button>
      )}
    </div>
  )
}

// 使用通知
export function notifyNewEmail(subject: string, from: string) {
  if (Notification.permission === 'granted' &&
      localStorage.getItem('notifications-enabled') === 'true') {
    new Notification('📬 New Email', {
      body: `From: ${from}\n${subject}`,
      icon: '/favicon.ico',
      badge: '/badge-icon.png',
      tag: 'new-email',
      requireInteraction: false
    })

    // 可选：播放声音
    const audio = new Audio('/notification.mp3')
    audio.play().catch(() => {})
  }
}
```

#### 2. 邮箱有效期倒计时
```typescript
// components/MailboxExpiry.tsx
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Progress } from './ui/progress'
import { formatDistanceToNow, differenceInSeconds } from 'date-fns'

interface MailboxExpiryProps {
  createdAt: Date
  expiresInSeconds: number  // 默认 86400 (24小时)
}

export function MailboxExpiry({ createdAt, expiresInSeconds }: MailboxExpiryProps) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [percentage, setPercentage] = useState(100)

  useEffect(() => {
    const updateTime = () => {
      const expiresAt = new Date(createdAt.getTime() + expiresInSeconds * 1000)
      const secondsLeft = differenceInSeconds(expiresAt, new Date())

      setTimeLeft(Math.max(0, secondsLeft))
      setPercentage(Math.max(0, (secondsLeft / expiresInSeconds) * 100))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [createdAt, expiresInSeconds])

  const getColor = () => {
    if (percentage > 50) return 'bg-green-500'
    if (percentage > 20) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className={`rounded-lg p-4 ${percentage < 20 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Mailbox expires in</span>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(createdAt.getTime() + expiresInSeconds * 1000))}
        </span>
      </div>
      <Progress value={percentage} className={`h-2 ${getColor()}`} />

      {percentage < 20 && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
          ⚠️ Your mailbox will expire soon! Save important emails.
        </p>
      )}
    </div>
  )
}
```

#### 3. 邮件搜索和筛选
```typescript
// components/EmailSearch.tsx
import { useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

interface EmailSearchProps {
  onSearch: (term: string) => void
  onFilter: (filter: string) => void
}

export function EmailSearch({ onSearch, onFilter }: EmailSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    onSearch(value)
  }

  const handleFilter = (value: string) => {
    setActiveFilter(value)
    onFilter(value)
  }

  return (
    <div className="flex gap-2 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search emails (sender, subject, content)..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => handleSearch('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Select value={activeFilter} onValueChange={handleFilter}>
        <SelectTrigger className="w-[140px]">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Emails</SelectItem>
          <SelectItem value="unread">Unread Only</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="important">Important</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

// 在 Inbox 中使用
const filteredEmails = useMemo(() => {
  let result = data

  // 搜索
  if (searchTerm) {
    result = result.filter(email =>
      email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.from.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.from.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.text?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  // 筛选
  switch (filter) {
    case 'unread':
      result = result.filter(email => !email.isRead)
      break
    case 'today':
      const today = new Date().toDateString()
      result = result.filter(email =>
        new Date(email.createdAt).toDateString() === today
      )
      break
    case 'important':
      result = result.filter(email => email.priority === 'high')
      break
  }

  return result
}, [data, searchTerm, filter])
```

#### 4. 已读/未读状态
```typescript
// components/MailItem.tsx 改进
import { cn } from '@/lib/utils'
import { Circle, CircleDot } from 'lucide-react'

export default function MailItem({ mail }: { mail: Email }) {
  const [isRead, setIsRead] = useState(mail.isRead)

  const handleClick = async () => {
    if (!isRead) {
      await actions.markEmailAsRead({ id: mail.id })
      setIsRead(true)
    }
  }

  return (
    <a
      href={`/mails/${mail.id}`}
      onClick={handleClick}
      className={cn(
        "block p-4 rounded-lg border transition-colors",
        isRead
          ? "bg-card border-border"
          : "bg-primary/5 border-primary/20 hover:bg-primary/10"
      )}
    >
      <div className="flex items-start gap-3">
        {/* 未读标记 */}
        {!isRead && (
          <div className="mt-1">
            <CircleDot className="h-3 w-3 text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {mail.from.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className={cn(
                "font-medium text-sm",
                !isRead && "font-semibold"
              )}>
                {mail.from.name || mail.from.address}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(mail.date || mail.createdAt), {
                addSuffix: true,
              })}
            </div>
          </div>

          <div className={cn(
            "font-medium text-sm mb-1 line-clamp-1",
            !isRead && "font-semibold"
          )}>
            {mail.subject || 'No subject'}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2">
            {mail.text || mail.html?.replace(/<[^>]*>/g, '') || 'No content'}
          </div>
        </div>
      </div>
    </a>
  )
}
```

#### 5. 统计面板
```typescript
// components/StatisticsPanel.tsx
import { MailIcon, MailOpen, Clock } from 'lucide-react'
import { Card, CardContent } from './ui/card'

interface StatsPanelProps {
  total: number
  unread: number
  today: number
}

export function StatisticsPanel({ total, unread, today }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{total}</div>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <MailIcon className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-600">{today}</div>
              <p className="text-xs text-muted-foreground mt-1">Today</p>
            </div>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-amber-600">{unread}</div>
              <p className="text-xs text-muted-foreground mt-1">Unread</p>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <MailOpen className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### 6. 纯文本/安全查看模式（View as Plain Text）
```typescript
// components/EmailViewer.tsx
import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import { Shield, Code2, FileText } from 'lucide-react'

interface EmailViewerProps {
  html?: string
  text?: string
}

export function EmailViewer({ html, text }: EmailViewerProps) {
  const [mode, setMode] = useState<'html'|'text'|'raw'>('html')
  const safeHtml = useMemo(() => sanitizeHtml(html || ''), [html])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant={mode==='html'? 'default':'outline'} size="sm" onClick={() => setMode('html')}>
          <Shield className="h-4 w-4 mr-2" /> Safe HTML
        </Button>
        <Button variant={mode==='text'? 'default':'outline'} size="sm" onClick={() => setMode('text')}>
          <FileText className="h-4 w-4 mr-2" /> Plain Text
        </Button>
        <Button variant={mode==='raw'? 'default':'outline'} size="sm" onClick={() => setMode('raw')}>
          <Code2 className="h-4 w-4 mr-2" /> Raw Source
        </Button>
      </div>

      {mode === 'html' && (
        <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      )}

      {mode === 'text' && (
        <pre className="whitespace-pre-wrap text-sm p-3 rounded-md bg-muted border">{text || 'No text content'}</pre>
      )}

      {mode === 'raw' && (
        <pre className="whitespace-pre text-xs p-3 rounded-md bg-muted border overflow-auto">{buildRawMime(text, html)}</pre>
      )}
    </div>
  )
}

// 说明：
// - sanitizeHtml 对 HTML 做白名单净化（img、script、iframe 全部屏蔽，a 添加 rel/noopener）
// - Raw Source 用于调试与导出（与导出 .eml 功能相辅相成）
```

> 安全策略：默认以 Safe HTML 渲染，禁用外链资源、内联脚本与表单提交；提供 Plain Text 与 Raw Source 切换以提升可控性与可信度。

##### 配套增强计划（建议优先顺序）

- 懒加载远程图片并带“显示图片”二次确认（P0）
- 链接安全提示与域名高亮（外链标注、复制链接地址）（P0）
- 显示原始头部信息：From/To/Reply-To/Message-ID/Date/Return-Path（P0）
- 文本模式的 monospace 切换与行号显示（P1）
- 一键复制发件人/主题/Message-ID（P1）
- OTP/验证码自动识别高亮（结合纯文本更准确）（P1）
- 下载为 .eml（与 Raw Source/导出功能联动）（P1）
- 暗色下的代码/预格式化块配色优化（P1）

### UI 改进

#### 1. Progress 组件
```typescript
// components/ui/progress.tsx
import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
```

### 实施优先级

| 功能 | 难度 | 价值 | 优先级 |
|------|------|------|--------|
| 已读状态 | 🟢 低 | 🔴 高 | P0 |
| 统计面板 | 🟢 低 | 🟡 中 | P0 |
| 邮箱倒计时 | 🟢 低 | 🟡 中 | P0 |
| 邮件通知 | 🟡 中 | 🔴 高 | P1 |
| 搜索筛选 | 🟡 中 | 🔴 高 | P1 |
| 分页支持 | 🟡 中 | 🟡 中 | P2 |

### 预期成果

- 用户留存率提升 40%
- 平均会话时长提升 30%
- 邮件查看率提升 50%

---

## 🎨 v1.3.0 - 高级功能版（3-4周）

### 数据库扩展

```sql
-- 邮箱别名和历史
CREATE TABLE mailbox_history (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  action TEXT NOT NULL,  -- created, accessed, deleted
  timestamp INTEGER NOT NULL,
  metadata TEXT  -- JSON: { ip, userAgent, etc }
);

CREATE INDEX idx_mailbox_history ON mailbox_history(mailbox, timestamp DESC);
```

### 核心功能

#### 1. 批量操作
```typescript
// components/BatchOperations.tsx
import { Trash2, MailOpen, Archive } from 'lucide-react'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'

export function BatchOperations() {
  const [selected, setSelected] = useState<string[]>([])
  const [allSelected, setAllSelected] = useState(false)

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected([])
    } else {
      setSelected(emails.map(e => e.id))
    }
    setAllSelected(!allSelected)
  }

  const deleteSelected = async () => {
    await Promise.all(
      selected.map(id => actions.deleteEmail({ id }))
    )
    setSelected([])
    queryClient.invalidateQueries(['emails'])
  }

  const markSelectedAsRead = async () => {
    await Promise.all(
      selected.map(id => actions.markEmailAsRead({ id }))
    )
    setSelected([])
    queryClient.invalidateQueries(['emails'])
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
      <Checkbox
        checked={allSelected}
        onCheckedChange={toggleSelectAll}
      />
      <span className="text-sm font-medium">
        {selected.length > 0 ? `${selected.length} selected` : 'Select all'}
      </span>

      {selected.length > 0 && (
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={markSelectedAsRead}
          >
            <MailOpen className="h-4 w-4 mr-2" />
            Mark as read
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={deleteSelected}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      )}
    </div>
  )
}
```

#### 2. 邮件导出功能
```typescript
// lib/export.ts
import { saveAs } from 'file-saver'
import JSZip from 'jszip'

export function generateEML(email: Email): string {
  return `From: ${email.from.address}
To: ${email.messageTo}
Subject: ${email.subject}
Date: ${email.date}
Message-ID: ${email.messageId}

${email.text || email.html}`
}

export async function exportEmail(email: Email) {
  const eml = generateEML(email)
  const blob = new Blob([eml], { type: 'message/rfc822' })
  saveAs(blob, `${email.subject || 'email'}.eml`)
}

export async function exportAllEmails(emails: Email[]) {
  const zip = new JSZip()

  emails.forEach((email, index) => {
    const eml = generateEML(email)
    const filename = `${index + 1}_${email.subject || 'no-subject'}.eml`
      .replace(/[^a-z0-9_\-\.]/gi, '_')
    zip.file(filename, eml)
  })

  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `emails_${Date.now()}.zip`)
}
```

#### 3. 多邮箱管理
```typescript
// components/MailboxSwitcher.tsx
import { ChevronDown, Plus, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

export function MailboxSwitcher() {
  const [mailboxes, setMailboxes] = useState<string[]>([])
  const [current, setCurrent] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('recent-mailboxes')
    if (saved) {
      setMailboxes(JSON.parse(saved))
    }
  }, [])

  const switchMailbox = async (mailbox: string) => {
    // 通过 Email ID 恢复邮箱
    const { data } = await actions.getMailboxOfEmail({ id: mailbox })
    if (data) {
      setCurrent(data)
      navigate('/')
    }
  }

  const addCurrentToRecent = (mailbox: string) => {
    const updated = [mailbox, ...mailboxes.filter(m => m !== mailbox)].slice(0, 5)
    setMailboxes(updated)
    localStorage.setItem('recent-mailboxes', JSON.stringify(updated))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{current || 'Select mailbox'}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px]">
        {mailboxes.map((mailbox) => (
          <DropdownMenuItem
            key={mailbox}
            onClick={() => switchMailbox(mailbox)}
          >
            <Check className={`mr-2 h-4 w-4 ${current === mailbox ? 'opacity-100' : 'opacity-0'}`} />
            <span className="truncate">{mailbox}</span>
          </DropdownMenuItem>
        ))}

        {mailboxes.length > 0 && <DropdownMenuSeparator />}

        <DropdownMenuItem onClick={() => navigate('/')}>
          <Plus className="mr-2 h-4 w-4" />
          Create new mailbox
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

#### 4. QR 码分享
```typescript
// components/QRCodeShare.tsx
import QRCode from 'qrcode.react'
import { QrCode, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'

export function QRCodeShare({ emailId }: { emailId: string }) {
  const shareUrl = `${window.location.origin}/retrieve?id=${emailId}`

  const downloadQR = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, 'mailbox-qr.png')
        }
      })
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-2" />
          QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan to access on another device</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="p-4 bg-white rounded-lg">
            <QRCode
              value={shareUrl}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Scan this QR code with your phone to access this mailbox
          </p>
          <Button onClick={downloadQR} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

#### 5. 时间线视图
```typescript
// components/TimelineView.tsx
import { formatRelative, isToday, isYesterday, format } from 'date-fns'

export function TimelineView({ emails }: { emails: Email[] }) {
  const groupedEmails = useMemo(() => {
    const groups: Record<string, Email[]> = {}

    emails.forEach(email => {
      const date = new Date(email.createdAt)
      const key = format(date, 'yyyy-MM-dd')

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(email)
    })

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [emails])

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'MMMM d, yyyy')
  }

  return (
    <div className="space-y-6">
      {groupedEmails.map(([date, emails]) => (
        <div key={date}>
          <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-2 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              {formatDateLabel(date)}
              <div className="h-px flex-1 bg-border" />
            </h3>
          </div>
          <div className="space-y-2">
            {emails.map(email => (
              <MailItem key={email.id} mail={email} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 移动端优化

#### 1. 底部导航栏
```typescript
// components/MobileNav.tsx
import { Home, Mail, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const pathname = window.location.pathname

  const navItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Mail, label: 'Inbox', href: '/inbox' },
    { icon: Plus, label: 'New', href: '/new' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex justify-around py-2">
        {navItems.map(({ icon: Icon, label, href }) => (
          <a
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
              pathname === href
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}
```

#### 2. 下拉刷新
```typescript
// components/PullToRefresh.tsx
import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export function PullToRefresh({
  onRefresh,
  children
}: {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pullDistance = useRef(0)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (startY.current === 0) return

    const currentY = e.touches[0].clientY
    const distance = currentY - startY.current

    if (distance > 0 && window.scrollY === 0) {
      setPulling(true)
      pullDistance.current = Math.min(distance, 100)
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance.current > 60) {
      setRefreshing(true)
      await onRefresh()
      setRefreshing(false)
    }

    setPulling(false)
    startY.current = 0
    pullDistance.current = 0
  }

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return (
    <div className="relative">
      {(pulling || refreshing) && (
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-4">
          <RefreshCw className={cn(
            "h-6 w-6 text-primary",
            refreshing && "animate-spin"
          )} />
        </div>
      )}
      <div
        style={{
          transform: pulling ? `translateY(${pullDistance.current}px)` : undefined,
          transition: pulling ? 'none' : 'transform 0.3s ease'
        }}
      >
        {children}
      </div>
    </div>
  )
}
```

### 实施优先级

| 功能 | 难度 | 价值 | 优先级 |
|------|------|------|--------|
| 批量操作 | 🟡 中 | 🔴 高 | P0 |
| 邮件导出 | 🟢 低 | 🟡 中 | P1 |
| 多邮箱管理 | 🟡 中 | 🟡 中 | P1 |
| QR 码分享 | 🟢 低 | 🟢 低 | P2 |
| 时间线视图 | 🟢 低 | 🟡 中 | P2 |
| 移动端优化 | 🟡 中 | 🔴 高 | P1 |

---

## 🚀 v2.0.0 - 现代化升级版（1-2月）

### 架构升级

#### 1. 状态管理（Zustand）
```typescript
// stores/emailStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface EmailStore {
  emails: Email[]
  filter: string
  searchTerm: string
  selectedIds: string[]

  setEmails: (emails: Email[]) => void
  setFilter: (filter: string) => void
  setSearchTerm: (term: string) => void
  toggleSelect: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
}

export const useEmailStore = create<EmailStore>()(
  persist(
    (set, get) => ({
      emails: [],
      filter: 'all',
      searchTerm: '',
      selectedIds: [],

      setEmails: (emails) => set({ emails }),
      setFilter: (filter) => set({ filter }),
      setSearchTerm: (searchTerm) => set({ searchTerm }),

      toggleSelect: (id) => {
        const { selectedIds } = get()
        set({
          selectedIds: selectedIds.includes(id)
            ? selectedIds.filter(i => i !== id)
            : [...selectedIds, id]
        })
      },

      selectAll: () => set({ selectedIds: get().emails.map(e => e.id) }),
      clearSelection: () => set({ selectedIds: [] }),
    }),
    {
      name: 'email-storage',
      partialize: (state) => ({ filter: state.filter })
    }
  )
)
```

#### 2. QueryClient 优化（单例）
```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

let queryClient: QueryClient | undefined

export function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30000,
          gcTime: 5 * 60 * 1000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    })
  }
  return queryClient
}
```

### UI 全面升级

#### 1. 动画系统
```typescript
// lib/animations.ts
export const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 }
}

export const slideIn = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 20, opacity: 0 }
}

export const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 }
}

// 使用
import { motion } from 'framer-motion'

<motion.div {...fadeIn}>
  <MailItem mail={mail} />
</motion.div>
```

#### 2. 虚拟滚动（长列表优化）
```typescript
// components/VirtualizedEmailList.tsx
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function VirtualizedEmailList({ emails }: { emails: Email[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <MailItem mail={emails[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 高级功能

#### 1. 邮件全文搜索（FTS5）
```sql
-- SQLite FTS5 全文搜索
CREATE VIRTUAL TABLE emails_fts USING fts5(
  subject,
  text,
  content=emails,
  content_rowid=rowid
);

-- 触发器保持同步
CREATE TRIGGER emails_ai AFTER INSERT ON emails BEGIN
  INSERT INTO emails_fts(rowid, subject, text)
  VALUES (new.rowid, new.subject, new.text);
END;

CREATE TRIGGER emails_ad AFTER DELETE ON emails BEGIN
  DELETE FROM emails_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER emails_au AFTER UPDATE ON emails BEGIN
  UPDATE emails_fts
  SET subject = new.subject, text = new.text
  WHERE rowid = new.rowid;
END;
```

```typescript
// DAO 中使用
export async function searchEmails(
  db: DrizzleD1Database,
  query: string,
  messageTo: string
) {
  return await db.execute(sql`
    SELECT e.* FROM emails e
    JOIN emails_fts fts ON e.rowid = fts.rowid
    WHERE emails_fts MATCH ${query}
      AND e.message_to = ${messageTo}
    ORDER BY rank
    LIMIT 50
  `)
}
```

#### 2. 乐观更新（Optimistic UI）
```typescript
// 删除邮件时立即更新 UI
const deleteMutation = useMutation({
  mutationFn: (id: string) => actions.deleteEmail({ id }),

  onMutate: async (id) => {
    // 取消正在进行的查询
    await queryClient.cancelQueries({ queryKey: ['emails'] })

    // 保存之前的数据
    const previous = queryClient.getQueryData(['emails'])

    // 乐观更新
    queryClient.setQueryData(['emails'], (old: Email[]) =>
      old?.filter(email => email.id !== id)
    )

    return { previous }
  },

  onError: (err, id, context) => {
    // 回滚
    queryClient.setQueryData(['emails'], context?.previous)
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['emails'] })
  }
})
```

#### 3. PWA 支持
```typescript
// public/sw.js - Service Worker
const CACHE_NAME = 'vmail-v1'
const urlsToCache = [
  '/',
  '/styles/main.css',
  '/scripts/main.js',
  '/offline.html'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  )
})
```

```json
// public/manifest.json
{
  "name": "Cloudflare VMails",
  "short_name": "VMails",
  "description": "Privacy-friendly temporary email service",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0ea5e9",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 性能优化

#### 1. 代码分割
```typescript
// 路由级别代码分割
const Inbox = lazy(() => import('./components/Inbox'))
const EmailDetail = lazy(() => import('./pages/EmailDetail'))

// 组件级别分割
const HeavyComponent = lazy(() => import('./components/HeavyComponent'))

// 使用
<Suspense fallback={<LoadingSpinner />}>
  <Inbox />
</Suspense>
```

#### 2. 图片优化
```typescript
// 使用 Cloudflare Image Resizing
function optimizeImage(url: string, width: number) {
  return `/cdn-cgi/image/width=${width},quality=85/${url}`
}

// 懒加载图片
<img
  loading="lazy"
  decoding="async"
  src={optimizeImage(imageUrl, 800)}
  srcSet={`
    ${optimizeImage(imageUrl, 400)} 400w,
    ${optimizeImage(imageUrl, 800)} 800w,
    ${optimizeImage(imageUrl, 1200)} 1200w
  `}
  sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
/>
```

#### 3. 数据缓存策略
```typescript
// React Query 缓存配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5分钟后数据标记为陈旧
      gcTime: 1000 * 60 * 30,         // 30分钟后回收
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})
```

### 实施优先级

| 类别 | 功能 | 难度 | 价值 | 优先级 |
|------|------|------|------|--------|
| 架构 | 状态管理 | 🟡 中 | 🔴 高 | P0 |
| 架构 | QueryClient优化 | 🟢 低 | 🟡 中 | P0 |
| 性能 | 虚拟滚动 | 🟡 中 | 🔴 高 | P1 |
| 性能 | 代码分割 | 🟢 低 | 🟡 中 | P1 |
| 功能 | PWA 支持 | 🟡 中 | 🟡 中 | P2 |
| 功能 | 全文搜索 | 🟠 高 | 🔴 高 | P1 |

---

## 📊 开发效率指南

### 快速原型开发

```bash
# 1. 新功能快速验证
pnpm dev  # 热重载，即时预览

# 2. 直接修改，快速迭代
# 不写测试，直接在浏览器验证

# 3. 类型检查（可选）
pnpm type-check  # 仅在提交前运行
```

### 组件开发流程

```
1. 复制现有相似组件
2. 快速修改样式和逻辑
3. 浏览器中实时调试
4. 满意后提交
```

### 数据库迁移

```bash
# 快速迁移（直接执行 SQL）
wrangler d1 execute DB --file=migrations/xxx.sql

# 无需 Drizzle migrations，直接改 schema
```

### 部署流程

```bash
# 快速部署到 Cloudflare
pnpm build
pnpm deploy

# 无需等待 CI/CD，直接上线
```

---

## 🎯 优先级决策矩阵

```
高价值 + 低难度 = 立即做 ⭐⭐⭐⭐⭐
高价值 + 中难度 = 优先做 ⭐⭐⭐⭐
高价值 + 高难度 = 后期做 ⭐⭐⭐
低价值 + 低难度 = 有空做 ⭐⭐
低价值 + 高难度 = 不做 ⭐
```

---

## 📝 版本发布清单

### v1.2.0 发布前
```
□ 所有功能本地测试通过
□ TypeScript 编译无错误
□ 部署到 Preview 环境
□ 手动测试核心流程
□ 更新 CHANGELOG.md
□ 部署到生产环境
```

### v1.3.0 发布前
```
□ 所有功能本地测试通过
□ 移动端响应式检查
□ 性能检查（Lighthouse）
□ 更新 CHANGELOG.md
□ 部署到生产环境
```

### v2.0.0 发布前
```
□ 完整功能测试
□ 性能优化验证
□ 数据库迁移测试
□ 备份生产数据
□ 灰度发布（10% → 50% → 100%）
```

---

## 🚀 下一步行动

### 立即开始 v1.2.0

```bash
# 1. 创建数据库迁移
wrangler d1 execute DB --file=migrations/v1.2.0.sql

# 2. 开发环境启动
pnpm dev

# 3. 按优先级实现功能
#    P0: 已读状态 + 统计面板 + 倒计时
#    P1: 通知 + 搜索
#    P2: 分页
```

### 预计时间线

- **Week 1**: 数据库迁移 + 已读状态 + 统计面板
- **Week 2**: 通知系统 + 邮箱倒计时
- **Week 3**: 搜索筛选 + UI 优化 + 部署

---

## 🌟 用户体验升级清单（可快速见效）

> 聚焦“开箱即用、低心智负担、高反馈密度”，优先做小改动带来大感知。

- **新手引导与可发现性**
  - 首次进入 30 秒交互教程（高亮关键区域，1-3 步即可完成）
  - 空状态“下一步”按钮（生成邮箱、复制地址、去设置通知）
  - 可见的“最近邮箱”与“恢复会话”入口（减少回访成本）

- **个性化与可控性**
  - 视图密度切换（舒适/紧凑），列表项高度与信息层级随之变化
  - 固定重要邮件（Pin）与自定义标签/颜色（非持久化本地即可）
  - 时区与时间格式偏好（相对/绝对一键切换）

- **效率与快捷操作**
  - 键盘快捷键（J/K 上下、X 选中、E 标记已读、Del 删除、/ 搜索）
  - 列表项悬停快速操作（已读/未读、删除、复制发件人）
  - Command 面板（Ctrl/⌘+K）：跳转邮箱、执行常用动作

- **感知性能与反馈**
  - 实时轻提示：新邮件计数上浮徽标、轻震动（移动端）
  - 更细腻的 Skeleton 与渐进式渲染；批量操作进度反馈（n/总数）
  - 自动刷新动画与“刚刚更新”时间戳（避免用户不确定）

- **可访问性与移动端**
  - 完整的焦点序、跳转链接与可见焦点样式
  - 高对比度模式与减少动效（尊重 prefers-reduced-motion）
  - 移动端滑动手势（右滑标记已读、左滑删除，带撤销）

- **可靠性与可恢复**
  - 撤销（Undo）栏：删除/标记已读 5 秒内可恢复
  - 乐观更新+失败回滚（已读/删除/批量），失败弹出重试
  - 弱网友好：请求排队与指数退避，离线提示与自动重连

- **贴心小功能（Delighters）**
  - OTP/验证码自动高亮与“一键复制”
  - 链接与附件预览（限制大小，安全沙盒）
  - 会话分组/线程视图（相同主题轻量聚合）

### 推荐落地顺序（2-3 天见效）

1) 键盘快捷键 + 列表快速操作 + 撤销栏（P0）
2) 视图密度切换 + “刚刚更新”提示（P0）
3) OTP 高亮与一键复制 + 新邮件徽标（P1）
4) 首次进入简短引导 + 最近邮箱入口（P1）
5) 高对比度与减少动效支持（P1）

> 所有改动保持“无后端依赖优先、本地状态即可”的原则，先做感知层体验，再逐步绑定后端能力。

**专注开发，快速迭代！** 🎯
