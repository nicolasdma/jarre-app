import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { IS_MANAGED } from '@/lib/config';
import { Header } from '@/components/header';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';

export const metadata: Metadata = {
  title: 'Settings — Jarre',
  description: 'Manage your API keys and preferences',
};

export default async function SettingsPage() {
  // Self-hosted users don't need this page
  if (!IS_MANAGED) {
    redirect('/profile');
  }

  const supabase = await createClient();
  const {
    data: { user, session },
  } = await supabase.auth.getUser().then(async ({ data: { user } }) => {
    const { data } = await supabase.auth.getSession();
    return { data: { user, session: data.session } };
  });

  if (!user || !session) {
    redirect('/login');
  }

  return (
    <>
      <Header />
      <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
        <h1 className="font-mono text-[11px] tracking-[0.3em] uppercase text-j-text-secondary">
          Settings
        </h1>

        <div className="border border-j-border rounded-lg p-6">
          <ApiKeysSettings />
        </div>
      </div>
    </>
  );
}
