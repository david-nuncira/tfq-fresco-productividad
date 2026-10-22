// Huella SHA-256 (hex) usando la API WebCrypto, disponible en
// navegadores modernos y en Node 18+.

export async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto)
  const buffer = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
