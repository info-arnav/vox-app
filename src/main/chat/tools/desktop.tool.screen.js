import { desktopCapturer, screen, shell, systemPreferences } from 'electron'

const waitForScreenPermission = async () => {
  if (process.platform !== 'darwin') return

  const initial = systemPreferences.getMediaAccessStatus('screen')
  if (initial === 'granted') return

  await desktopCapturer
    .getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
    .catch(() => {})

  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  )

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500))
    if (systemPreferences.getMediaAccessStatus('screen') === 'granted') return
  }

  throw new Error(
    'Screen recording permission was not granted. Please allow access in System Settings → Privacy & Security → Screen Recording.'
  )
}

export const captureFullScreen = async () => {
  await waitForScreenPermission()

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.min(width, 1920),
      height: Math.min(height, 1080)
    }
  })

  const primary = sources[0]
  if (!primary) {
    throw new Error('No screen source available for capture.')
  }

  const thumbnail = primary.thumbnail
  const size = thumbnail.getSize()

  const maxWidth = 1280
  const captureImage = size.width > maxWidth ? thumbnail.resize({ width: maxWidth }) : thumbnail

  const captureSize = captureImage.getSize()
  const jpegBuffer = captureImage.toJPEG(75)
  const base64Image = jpegBuffer.toString('base64')

  return {
    text: `Captured full screen (${captureSize.width}x${captureSize.height}).`,
    imageBase64: base64Image,
    mimeType: 'image/jpeg'
  }
}
