import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { errorResponse, requireStaff } from '@/lib/session'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HandleUploadBody
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        await requireStaff()
        if (!pathname.startsWith('tracks/')) throw new Error('Invalid path')
        return {
          allowedContentTypes: ['audio/*', 'video/mp4', 'video/webm', 'application/octet-stream'],
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
    })
    return Response.json(result)
  } catch (err) {
    if (err instanceof Error && !('status' in err)) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    return errorResponse(err)
  }
}
