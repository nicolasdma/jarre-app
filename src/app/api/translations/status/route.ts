import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { TABLES } from '@/lib/db/tables';

export const GET = withAuth(async (request, { supabase }) => {
  const url = new URL(request.url);
  const resourceId = url.searchParams.get('resourceId');
  const language = url.searchParams.get('language');
  const sectionIdsParam = url.searchParams.get('sectionIds');

  if (!resourceId || !language || !sectionIdsParam) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  const sectionIds = sectionIdsParam.split(',');

  const { data: translations } = await supabase
    .from(TABLES.sectionTranslations)
    .select('section_id, section_title, content_markdown')
    .in('section_id', sectionIds)
    .eq('language', language);

  const ready: Record<string, { sectionTitle: string; contentMarkdown: string }> = {};
  for (const t of translations || []) {
    ready[t.section_id] = {
      sectionTitle: t.section_title,
      contentMarkdown: t.content_markdown,
    };
  }

  return NextResponse.json({ ready });
});
