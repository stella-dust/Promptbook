// Copy to the existing blog's functions/projects/promptbook/[[path]].js.
// Bind PROMPTBOOK to the promptbook Worker in Pages production service bindings.
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (url.hostname !== 'junyiyan.com') return new Response('Not found', {status:404});
  if (!env.PROMPTBOOK) return new Response('Promptbook 暂时不可用', {status:503});
  if (url.pathname !== '/projects/promptbook' && !url.pathname.startsWith('/projects/promptbook/')) return new Response('Not found', {status:404});
  return env.PROMPTBOOK.fetch(request);
}
