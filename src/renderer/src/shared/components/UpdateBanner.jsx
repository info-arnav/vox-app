import { useEffect, useState } from 'react'
import { ArrowUpCircle } from 'lucide-react'

function UpdateBanner() {
  const [downloaded, setDownloaded] = useState(false)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    const unsubAvailable = window.api.update.onAvailable(() => {})
    const unsubDownloaded = window.api.update.onDownloaded(() => setDownloaded(true))
    return () => {
      unsubAvailable()
      unsubDownloaded()
    }
  }, [])

  if (!downloaded) return null

  const handleRestart = () => {
    setRestarting(true)
    window.api.update.installAndRestart()
  }

  return (
    <div className="update-banner">
      <ArrowUpCircle className="update-banner-icon" size={15} strokeWidth={2} />
      <span className="update-banner-text">Update ready</span>
      <button className="update-banner-btn" disabled={restarting} onClick={handleRestart}>
        {restarting ? 'Restarting…' : 'Restart now'}
      </button>
    </div>
  )
}

export default UpdateBanner
