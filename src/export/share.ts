const TWEET = 'Built a minifig.'

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
