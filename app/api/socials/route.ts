export const revalidate = 3600 // cache 1 hour

type InstagramPost = {
  id: string
  caption: string | null
  media_type: string
  media_url: string | null
  thumbnail_url: string | null
  permalink: string
  timestamp: string
} | null

type FacebookPost = {
  message: string | null
  full_picture: string | null
  permalink_url: string
  created_time: string
} | null

export async function GET() {
  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const fbToken = process.env.FB_PAGE_ACCESS_TOKEN
  const fbPageId = process.env.FB_PAGE_ID

  const [igResult, fbResult] = await Promise.allSettled([
    igToken
      ? fetch(
          `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=1&access_token=${igToken}`,
          { next: { revalidate: 3600 } }
        ).then(r => r.json())
      : Promise.resolve(null),

    fbToken && fbPageId
      ? fetch(
          `https://graph.facebook.com/${fbPageId}/posts?fields=message,full_picture,permalink_url,created_time&limit=1&access_token=${fbToken}`,
          { next: { revalidate: 3600 } }
        ).then(r => r.json())
      : Promise.resolve(null),
  ])

  let instagram: InstagramPost = null
  let facebook: FacebookPost = null

  if (igResult.status === 'fulfilled' && igResult.value?.data?.[0]) {
    const p = igResult.value.data[0]
    instagram = {
      id: p.id,
      caption: p.caption ?? null,
      media_type: p.media_type,
      media_url: p.media_url ?? null,
      thumbnail_url: p.thumbnail_url ?? null,
      permalink: p.permalink,
      timestamp: p.timestamp,
    }
  }

  if (fbResult.status === 'fulfilled' && fbResult.value?.data?.[0]) {
    const p = fbResult.value.data[0]
    facebook = {
      message: p.message ?? null,
      full_picture: p.full_picture ?? null,
      permalink_url: p.permalink_url,
      created_time: p.created_time,
    }
  }

  return Response.json({ instagram, facebook })
}
