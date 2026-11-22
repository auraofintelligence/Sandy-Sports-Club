const memberRoles = new Set(['member', 'committee', 'treasurer', 'administrator']);
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
};

function json(value, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}

export async function handleLibrary(request, env, identity) {
  const url = new URL(request.url);
  if (!identity) return json({ error: 'Sign in to open club documents.' }, 401);
  if (!memberRoles.has(identity.role)) return json({ error: 'Member access is required.' }, 403);
  // The local account identity grants member only after checking its paid-through date.
  // An optional email allowlist alone does not establish a paid membership.
  if (identity.role === 'member' && identity.accountRole !== 'member') {
    return json({ error: 'A current paid club membership is required.' }, 403);
  }
  if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'This action is unavailable.' }, 405);
  if (!env.DB?.prepare) return json({ error: 'The document library is temporarily unavailable.' }, 503);

  const audience = identity.role === 'member' || url.searchParams.get('view')==='member' ? 'member' : 'committee';
  const filter = "access_level IN ('member', ?)";
  try {
    if (url.pathname === '/api/library' || url.pathname === '/api/library/') {
      const rows = await env.DB.prepare(`SELECT id, title, source_date AS sourceDate, document_type AS documentType,
        status, access_level AS access, byte_length AS bytes FROM library_documents WHERE ${filter}
        ORDER BY CASE document_type WHEN 'Constitution' THEN 0 ELSE 1 END, source_date DESC, title`).bind(audience).all();
      return request.method === 'HEAD'
        ? new Response(null, { headers: privateHeaders }) : json({ documents: rows.results });
    }
    const id = url.pathname.slice('/api/library/'.length);
    if (!/^[a-z0-9-]{1,80}$/.test(id)) return json({ error: 'Document unavailable.' }, 404);
    const document = await env.DB.prepare(`SELECT digest, byte_length, part_count FROM library_documents
      WHERE id = ? AND ${filter}`).bind(id, audience).first();
    if (!document) return json({ error: 'Document unavailable.' }, 404);
    const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
    const headers = { ...privateHeaders, 'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="sandy-${id}.pdf"`, 'Content-Length': String(document.byte_length) };
    if (request.method === 'HEAD') return new Response(null, { headers });
    const { results } = await env.DB.prepare('SELECT part, encoded FROM library_parts WHERE digest = ? ORDER BY part')
      .bind(document.digest).all();
    if (results.length !== document.part_count) throw new Error('Missing document part');
    const bytes = new Uint8Array(document.byte_length);
    let offset = 0;
    for (const [i, row] of results.entries()) {
      if (row.part !== i) throw new Error('Document part out of sequence');
      const chunk = atob(row.encoded);
      if (offset + chunk.length > bytes.length) throw new Error('Document length mismatch');
      for (let n = 0; n < chunk.length; n++) bytes[offset++] = chunk.charCodeAt(n);
    }
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    if (offset !== bytes.length || Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('') !== document.digest) {
      throw new Error('Document integrity check failed');
    }
    return new Response(bytes, { headers });
  } catch {
    return json({ error: 'This document could not be loaded. Please try again.' }, 503);
  }
}
