// The preview card is the same static image for every share, so the text is the only thing that
// can ask the reader for anything.
const TWEET = 'Build your own minifigure:'

export async function copyLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch {
    return false
  }
}

export function shareOnX(): void {
  const intent = new URL('https://x.com/intent/post')
  intent.searchParams.set('text', TWEET)
  // The figure is in the query string, so the link alone reproduces it.
  intent.searchParams.set('url', window.location.href)
  window.open(intent, '_blank', 'noopener,noreferrer')
}
