// Share to X (Twitter) utility
// Uses x.com/intent/post for the current X API
// On mobile: navigates directly so the OS opens the X app if installed
// On desktop: opens a popup window

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function shareToX(text: string) {
  const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

  if (isMobile()) {
    // Direct navigation triggers the OS to open the X app if installed
    window.location.href = url;
  } else {
    // Desktop: centered popup window
    const width = 550;
    const height = 420;
    const left = Math.round(screen.width / 2 - width / 2);
    const top = Math.round(screen.height / 2 - height / 2);
    window.open(url, '_blank', `width=${width},height=${height},left=${left},top=${top}`);
  }
}
