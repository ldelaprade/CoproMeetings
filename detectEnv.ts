// Détecte si l'app tourne dans AI Studio ou en mode web classique
export function detectEnvironment() {
  const host = window.location.hostname;
  if (host.endsWith('ai.studio') || host.includes('aistudio') || host.includes('googleusercontent')) {
    return 'aistudio';
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'local';
  }
  return 'web';
}

/**
 * Détecte si l'app est servie par Express (/api/info disponible).
 * Retourne { mode: 'express-server', dbPath } ou null.
 */
export async function detectServerMode(): Promise<{ mode: 'express-server'; dbPath: string } | null> {
  try {
    const res = await fetch('/api/info', { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      const json = await res.json();
      if (json.mode === 'express-server') return json;
    }
  } catch {
    // Vite dev ou aistudio : /api/info n'existe pas
  }
  return null;
}
