import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/billing/stripe';
import { withAuth } from '@/lib/api/middleware';
import { TABLES } from '@/lib/db/tables';

export const POST = withAuth(async (request, { supabase, user }) => {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 503 },
    );
  }

  // Check if user already has a Stripe customer ID
  const { data: profile } = await supabase
    .from(TABLES.userProfiles)
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from(TABLES.userProfiles)
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  const origin = request.headers.get('origin') || '';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/profile?billing=success`,
    cancel_url: `${origin}/profile`,
  });

  return NextResponse.json({ url: session.url });
});
