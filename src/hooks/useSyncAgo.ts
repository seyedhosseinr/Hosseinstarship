'use client'

import { useEffect, useState } from 'react'

export function formatSyncAgo(lastSyncTime: Date | null) {
  if (!lastSyncTime) return ''

  const diff = Date.now() - lastSyncTime.getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))

  if (minutes < 1) return 'همین الان'
  if (minutes < 60) return `${minutes} دقیقه پیش`

  const hours = Math.floor(minutes / 60)
  return `${hours} ساعت پیش`
}

export function useSyncAgo(lastSyncTime: Date | null) {
  const [syncAgo, setSyncAgo] = useState(() => formatSyncAgo(lastSyncTime))

  useEffect(() => {
    setSyncAgo(formatSyncAgo(lastSyncTime))

    if (!lastSyncTime) return

    const interval = setInterval(() => {
      setSyncAgo(formatSyncAgo(lastSyncTime))
    }, 60000)

    return () => clearInterval(interval)
  }, [lastSyncTime])

  return syncAgo
}
