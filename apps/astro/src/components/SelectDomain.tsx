import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useEffect, useState } from 'react'

export function SelectDomain({
  domains: initialDomains,
}: { domains: string[] }) {
  const [domains, setDomains] = useState<string[]>(initialDomains || [])

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const res = await fetch('https://emails-worker.trung27031.workers.dev/api/v1/domains')
        const data = await res.json() as { domains: string[] }
        if (data.domains && Array.isArray(data.domains)) {
          // Remove duplicates and combine if needed, or just prefer API
          setDomains(data.domains)
        }
      } catch (e) {
        console.error("Failed to fetch dynamic domains", e)
      }
    }
    fetchDomains()
  }, [])

  return (
    <Select required name="domain">
      <SelectTrigger className="mb-4 bg-secondary focus:ring-blue-500 focus:border-gray-500">
        <SelectValue placeholder="Select a domain for your mailbox" />
      </SelectTrigger>
      <SelectContent>
        {domains.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
