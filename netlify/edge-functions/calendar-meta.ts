const calendarSlugPattern = /^[a-z]+-[a-z]+-[a-z]+$/;
const socialCrawlerPattern = /facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|pinterest|googlebot/i;

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]!));
}

export default async function handler(request: Request, context: { next: () => Promise<Response> }) {
  const url = new URL(request.url);
  const slug = url.pathname.split('/').filter(Boolean)[0] || '';
  const userAgent = request.headers.get('user-agent') || '';
  if (!calendarSlugPattern.test(slug) || !socialCrawlerPattern.test(userAgent)) return context.next();

  try {
    const configResponse = await fetch(new URL('/firebase-config.json', url.origin));
    const config = await configResponse.json();
    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!authResponse.ok) return context.next();
    const { idToken } = await authResponse.json();
    const roomResponse = await fetch(`${config.databaseURL}/calendars/${slug}.json?auth=${encodeURIComponent(idToken)}`);
    if (!roomResponse.ok) return context.next();
    const room = await roomResponse.json();
    if (!room || typeof room.title !== 'string') return context.next();

    const title = escapeHtml(`${room.title} — DayGoblin`);
    const description = escapeHtml(url.searchParams.get('lang') === 'en'
      ? `${room.title} — plan together with DayGoblin and find a day that works for your group.`
      : `${room.title} — planera tillsammans med DayGoblin och hitta en dag som passar gruppen.`);
    const canonicalUrl = escapeHtml(`${url.origin}/${slug}`);
    const imageUrl = escapeHtml(`${url.origin}/share-card.svg`);
    const response = await context.next();
    const html = await response.text();
    const headMetadata = `<title>${title}</title><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonicalUrl}"><meta property="og:image" content="${imageUrl}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}">`;
    const cleanHtml = html
      .replace(/<title>[^<]*<\/title>/i, '')
      .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:type|og:title|og:description|og:url|og:image|twitter:card|twitter:title|twitter:description)["'][^>]*>/gi, '');
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    return new Response(cleanHtml.replace(/<\/head>/i, `${headMetadata}</head>`), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return context.next();
  }
}
