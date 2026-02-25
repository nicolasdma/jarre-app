import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Header } from '@/components/header';
import { SectionLabel } from '@/components/ui/section-label';
import { createClient } from '@/lib/supabase/server';
import { TABLES } from '@/lib/db/tables';
import { UpgradeButton, ManageSubscriptionButton } from '@/components/billing/billing-actions';

export const metadata: Metadata = {
  title: 'Pricing — Jarre',
  description: 'Simple pricing for deep learning',
};

const FREE_FEATURES = [
  '50K tokens/month',
  'Unlimited courses',
  'Voice tutoring (7 modes)',
  'Spaced repetition',
  'Evaluations & scoring',
  'Bring your own API keys',
];

const PRO_FEATURES = [
  '500K tokens/month',
  'Everything in Free',
  '10x token budget',
  'Priority support',
  'Early access to new features',
];

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscriptionStatus = 'free';
  if (user) {
    const { data: profile } = await supabase
      .from(TABLES.userProfiles)
      .select('subscription_status')
      .eq('id', user.id)
      .single();
    subscriptionStatus = profile?.subscription_status || 'free';
  }

  const isActive = subscriptionStatus === 'active';

  return (
    <div className="min-h-screen bg-j-bg j-bg-texture">
      <Header />

      <main className="mx-auto max-w-4xl px-4 sm:px-8 pt-16 sm:pt-24 pb-16">
        <div className="text-center mb-12">
          <SectionLabel className="justify-center">Pricing</SectionLabel>
          <h1 className="text-4xl sm:text-5xl font-normal italic tracking-tight text-j-text mb-3 font-[family-name:var(--j-font-display)]">
            Simple pricing
          </h1>
          <p className="text-lg text-j-text-tertiary max-w-md mx-auto">
            Start free. Upgrade when you need more tokens.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free tier */}
          <div className="relative border border-j-border rounded-xl p-8 bg-j-surface">
            <div className="mb-6">
              <span className="font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase">
                Free
              </span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-light text-j-text">$0</span>
                <span className="text-sm text-j-text-tertiary">/month</span>
              </div>
              <p className="text-sm text-j-text-secondary mt-2">
                Full access with managed API keys
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-j-text-secondary">
                  <Check size={14} className="text-j-text-tertiary mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {!isActive && subscriptionStatus === 'free' && (
              <div className="px-4 py-2 rounded-lg text-sm font-medium text-center border border-j-border text-j-text-tertiary">
                Current plan
              </div>
            )}
          </div>

          {/* Pro tier */}
          <div className="relative border-2 border-j-accent rounded-xl p-8 bg-j-surface">
            <div className="absolute -top-3 left-6">
              <span className="bg-j-accent text-j-bg text-[10px] font-mono tracking-[0.15em] uppercase px-3 py-1 rounded-full">
                Recommended
              </span>
            </div>

            <div className="mb-6">
              <span className="font-mono text-[10px] tracking-[0.2em] text-j-accent uppercase">
                Pro
              </span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-light text-j-text">$5</span>
                <span className="text-sm text-j-text-tertiary">/month</span>
              </div>
              <p className="text-sm text-j-text-secondary mt-2">
                10x more tokens for serious learners
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-j-text">
                  <Check size={14} className="text-j-accent mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {isActive ? (
              <div className="space-y-2">
                <div className="px-4 py-2 rounded-lg text-sm font-medium text-center bg-j-accent/10 text-j-accent border border-j-accent/30">
                  Active
                </div>
                <ManageSubscriptionButton />
              </div>
            ) : (
              <UpgradeButton />
            )}
          </div>
        </div>

        {/* BYOK note */}
        <div className="text-center mt-10">
          <p className="text-sm text-j-text-tertiary">
            Or{' '}
            <Link href="/settings" className="text-j-accent hover:underline">
              bring your own API keys
            </Link>{' '}
            for unlimited usage on any plan.
          </p>
        </div>
      </main>
    </div>
  );
}
