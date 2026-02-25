import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/billing/stripe';
import { withAuth } from '@/lib/api/middleware';
import { TABLES } from '@/lib/db/tables';

export const POST = withAuth(async (request, { supabase, user }) => {
  const stripe = getStripe();
  const { data: profile } = await supabase
    .from(TABLES.userProfiles)
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No billing account found' },
      { status: 404 },
    );
  }

  const origin = request.headers.get('origin') || '';

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/profile`,
  });

  return NextResponse.json({ url: session.url });
});
