'use client'
import React from 'react'
import { Home, Info, Shield, FileText, Github, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface DockProps {
  siteName?: string
}

export function Dock({ siteName = 'VMails' }: DockProps) {
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>('light')

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setTheme(isDarkMode ? 'dark' : 'light')
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.classList[newTheme === 'dark' ? 'add' : 'remove']('dark')
    localStorage.setItem('theme', newTheme)
  }

  const dockItems = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
      color: 'hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400',
    },
    {
      label: 'About',
      href: '/about',
      icon: Info,
      color: 'hover:bg-green-500/20 hover:text-green-600 dark:hover:text-green-400',
    },
    {
      label: 'Privacy',
      href: '/privacy',
      icon: Shield,
      color: 'hover:bg-purple-500/20 hover:text-purple-600 dark:hover:text-purple-400',
    },
    {
      label: 'Terms',
      href: '/terms',
      icon: FileText,
      color: 'hover:bg-orange-500/20 hover:text-orange-600 dark:hover:text-orange-400',
    },
    {
      label: 'GitHub',
      href: 'https://github.com/MiraHikari/cloudflare-vmail',
      icon: Github,
      color: 'hover:bg-gray-500/20 hover:text-gray-600 dark:hover:text-gray-400',
      external: true,
    },
  ]

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 bg-background/80 backdrop-blur-xl border border-border rounded-2xl px-4 py-3 shadow-lg"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2 pr-2 border-r border-border">
          <div className="h-6 w-6 bg-primary rounded-lg flex-shrink-0" />
          <span className="text-sm font-semibold text-primary hidden sm:block">{siteName}</span>
        </div>

        {/* Navigation Items */}
        {dockItems.map((item, index) => (
          <DockItem
            key={index}
            href={item.href}
            icon={item.icon}
            label={item.label}
            color={item.color}
            external={item.external}
          />
        ))}

        {/* Theme Toggle */}
        <div className="ml-2 pl-2 border-l border-border">
          <button
            onClick={toggleTheme}
            className={cn(
              'p-2 rounded-xl transition-all duration-200',
              'hover:bg-yellow-500/20 hover:text-yellow-600 dark:hover:text-yellow-400',
              'hover:scale-110 active:scale-95'
            )}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

interface DockItemProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
  external?: boolean
}

function DockItem({ href, icon: Icon, label, color, external }: DockItemProps) {
  return (
    <motion.a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={cn(
        'p-2 rounded-xl transition-all duration-200',
        'text-muted-foreground hover:scale-110 active:scale-95',
        color
      )}
      title={label}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <Icon className="h-5 w-5" />
    </motion.a>
  )
}
