import { put, del } from '@vercel/blob'

export type StoredFile = { pathname: string; access: 'private' | 'public' }

let knownAccess: 'private' | 'public' | null = null

// The Blob store may be private or public; learn which once, then stop retrying.
export async function storeFile(
  pathname: string,
  body: Blob | ArrayBuffer | Buffer,
  contentType?: string,
): Promise<StoredFile> {
  const order: ('private' | 'public')[] = knownAccess ? [knownAccess] : ['public', 'private']
  let lastErr: unknown
  for (const access of order) {
    try {
      const blob = await put(pathname, body as Blob, { access, addRandomSuffix: true, contentType })
      knownAccess = access
      // For public stores the full URL is what we need to serve the file.
      return access === 'public'
        ? { pathname: blob.url, access }
        : { pathname: blob.pathname, access }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

export async function removeFile(file: StoredFile) {
  try {
    await del(file.pathname)
  } catch (err) {
    console.error('[radio] failed to delete blob', err)
  }
}
