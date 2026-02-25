import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { TABLES } from '@/lib/db/tables';
import { IS_MANAGED } from '@/lib/config';
import { UpgradeButton, ManageSubscriptionButton } from '@/components/billing/billing-actions';

export const metadata: Metadata = {
  title: 'Profile — Jarre',
  description: 'View your learning profile and token usage statistics',
};

const CATEGORY_LABELS: Record<string, string> = {
  evaluation: 'Evaluaciones',
  evaluation_generate: 'Generación de preguntas',
  voice_score: 'Voice eval scoring',
  voice_teach_score: 'Voice teach scoring',
  voice_practice_score: 'Voice practice scoring',
  review: 'Review (micro-tests)',
  quiz: 'Quiz justificaciones',
  notes_polish: 'Polish de notas',
  voice_memory: 'Voice memory',
  self_explanation: 'Self-explanation',
};

function formatNumber(n: number): string {
  return n.toLocaleString('es-ES');
}

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch subscription status
  const { data: profile } = await supabase
    .from(TABLES.userProfiles)
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  const subscriptionStatus = profile?.subscription_status || 'free';

  // Fetch token usage
  const { data: rows } = await supabase
    .from(TABLES.tokenUsage)
    .select('category, tokens, created_at')
    .eq('user_id', user.id);

  const usage = rows || [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let total = 0;
  let last30Days = 0;
  let currentMonth = 0;
  const byCategory: Record<string, number> = {};

  for (const row of usage) {
    total += row.tokens;
    byCategory[row.category] = (byCategory[row.category] || 0) + row.tokens;
    const created = new Date(row.created_at);
    if (created >= thirtyDaysAgo) {
      last30Days += row.tokens;
    }
    if (created >= monthStart) {
      currentMonth += row.tokens;
    }
  }

  // Monthly cap for managed mode (50K free, 500K paid)
  const monthlyLimit = subscriptionStatus === 'active' ? 500_000 : 50_000;
  const usagePercent = Math.min(100, Math.round((currentMonth / monthlyLimit) * 100));

  // Sort categories by usage (descending)
  const sortedCategories = Object.entries(byCategory).sort(([, a], [, b]) => b - a);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">Perfil</h1>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Token Usage (DeepSeek)
          </h2>

          {IS_MANAGED && (
            <div className="border rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Este mes</span>
                <span className="text-sm font-mono tabular-nums">
                  {formatNumber(currentMonth)} / {formatNumber(monthlyLimit)}
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              {usagePercent >= 80 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Bring your own API keys to remove usage limits.{' '}
                  <Link href="/settings" className="text-blue-500 hover:underline">
                    Settings
                  </Link>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border rounded-lg p-4">
              <div className="text-2xl font-bold">{formatNumber(total)}</div>
              <div className="text-sm text-muted-foreground">Tokens totales</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-2xl font-bold">{formatNumber(last30Days)}</div>
              <div className="text-sm text-muted-foreground">Últimos 30 días</div>
            </div>
          </div>

          {sortedCategories.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium">Categoría</th>
                    <th className="text-right px-4 py-2 font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCategories.map(([category, tokens]) => (
                    <tr key={category} className="border-b last:border-b-0">
                      <td className="px-4 py-2">
                        {CATEGORY_LABELS[category] || category}
                      </td>
                      <td className="text-right px-4 py-2 tabular-nums">
                        {formatNumber(tokens)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No hay datos de consumo de tokens aún.
            </p>
          )}
        </section>

        {IS_MANAGED && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Subscription
            </h2>

            {subscriptionStatus === 'free' && (
              <div className="border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">Upgrade to Pro</h3>
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  <li>500K tokens/month (10x free tier)</li>
                  <li>Priority support</li>
                </ul>
                <UpgradeButton />
              </div>
            )}

            {subscriptionStatus === 'active' && (
              <div className="border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
                    Pro
                  </span>
                  <span className="text-sm text-muted-foreground">Active subscription</span>
                </div>
                <ManageSubscriptionButton />
              </div>
            )}

            {subscriptionStatus === 'past_due' && (
              <div className="border border-yellow-500 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded">
                    Payment failed
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Your last payment failed. Please update your payment method to keep Pro access.
                </p>
                <ManageSubscriptionButton />
              </div>
            )}

            {subscriptionStatus === 'canceled' && (
              <div className="border rounded-lg p-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Your subscription has been canceled. Reactivate to get 500K tokens/month.
                </p>
                <UpgradeButton />
              </div>
            )}
          </section>
        )}

        <section className="text-sm text-muted-foreground">
          <p>{user.email}</p>
          <p className="mt-1">ID: {user.id.slice(0, 8)}...</p>
        </section>
      </main>
    </div>
  );
}
