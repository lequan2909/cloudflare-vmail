import { useEffect, useState } from 'react'
import { Banner } from './ui/banner'

export function DomainNoticeBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 检查用户是否已经关闭过这个通知
    const dismissed = localStorage.getItem('domain-notice-dismissed')
    if (!dismissed) {
      setShow(true)
    }
  }, [])

  const handleHide = () => {
    setShow(false)
    localStorage.setItem('domain-notice-dismissed', 'true')
  }

  const handleViewDomains = () => {
    const mailboxForm = document.querySelector('[data-mailbox-form]')
    if (mailboxForm) {
      mailboxForm.scrollIntoView({ behavior: 'smooth' })
    }
  }

  if (!show)
    return null

  return (
    <Banner
      show={show}
      onHide={handleHide}
      variant="warning"
      icon={(
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5-.866 3.35 0 4.828a11.45 11.45 0 0 0 10.303 5.792 11.45 11.45 0 0 0 10.303-5.792c.866-1.479.866-3.328 0-4.828L13.803 4.397c-.866-1.5-3.08-1.5-3.946 0L1.303 16.125Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008Z" />
        </svg>
      )}
      title={(
        <>
          <strong>服务通知：</strong>
          临时邮箱域名
          {' '}
          <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground">
            What-the-fuck.sbs
          </code>
          {' '}
          已停止服务。
          由于域名过期且注册商收回，该域名下的邮箱地址将无法接收新邮件。我们正在努力恢复服务，请使用其他可用域名。
        </>
      )}
      action={{
        label: '查看可用域名',
        onClick: handleViewDomains,
      }}
      learnMoreUrl="/about"
    />
  )
}
