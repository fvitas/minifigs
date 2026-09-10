export async function copyLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch {
    return false
  }
}
