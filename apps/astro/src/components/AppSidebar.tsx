'use client'
import { motion } from 'framer-motion'
import { FileText, Github, Home, Info, Shield } from 'lucide-react'
import React, { useState } from 'react'
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { ModeToggle } from './ModeToggle'

interface AppSidebarProps {
  children: React.ReactNode
  siteName?: string
}

export function AppSidebar({ children, siteName = 'VMails' }: AppSidebarProps) {
  const links = [
    {
      label: 'Inbox',
      href: '/',
      icon: <Home className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: 'About',
      href: '/about',
      icon: <Info className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: 'Privacy',
      href: '/privacy',
      icon: <Shield className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: 'Terms',
      href: '/terms',
      icon: <FileText className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
  ]

  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'rounded-md flex flex-col md:flex-row bg-background w-full flex-1 mx-auto border-0 overflow-hidden min-h-screen',
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo siteName={siteName} /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2">
              <ModeToggle />
              {open && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-neutral-700 dark:text-neutral-200"
                >
                  Theme
                </motion.span>
              )}
            </div>
            <SidebarLink
              link={{
                label: 'GitHub',
                href: 'https://github.com/MiraHikari/cloudflare-vmail',
                icon: (
                  <Github className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <div className="flex flex-1 w-full h-full">
        <div className="flex flex-col gap-2 flex-1 w-full h-full bg-background">{children}</div>
      </div>
    </div>
  )
}

export function Logo({ siteName }: { siteName: string }) {
  return (
    <a
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-primary dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-bold text-primary dark:text-white whitespace-pre text-lg"
      >
        {siteName}
      </motion.span>
    </a>
  )
}

export function LogoIcon() {
  return (
    <a
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-primary dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </a>
  )
}
