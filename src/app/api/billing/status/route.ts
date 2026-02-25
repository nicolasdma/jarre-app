import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { TABLES } from '@/lib/db/tables';

export const GET = withAuth(async (_request, { supabase, user }) => {
  const { data: profile } = await supabase
    .from(TABLES.userProfiles)
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  const status = profile?.subscription_status || 'free';

  return NextResponse.json({
    status,
    isActive: status === 'active',
  });
});
