'use client';

import { useState } from 'react';
import { fetchWithKeys } from '@/lib/api/fetch-with-keys';

function BillingButton({
  children,
  onClick,
  loading,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? `${base} bg-blue-600 text-white hover:bg-blue-700`
      : `${base} border border-border hover:bg-muted`;

  return (
    <button className={styles} onClick={onClick} disabled={loading}>
      {loading ? 'Redirecting…' : children}
    </button>
  );
}

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetchWithKeys('/api/billing/checkout', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Checkout failed');
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
        return;
      }
    } catch {
      /* handled below */
    }
    setLoading(false);
  }

  return (
    <BillingButton onClick={handleUpgrade} loading={loading}>
      Upgrade to Pro — $5/month
    </BillingButton>
  );
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function handleManage() {
    setLoading(true);
    try {
      const res = await fetchWithKeys('/api/billing/portal', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Portal request failed');
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
        return;
      }
    } catch {
      /* handled below */
    }
    setLoading(false);
  }

  return (
    <BillingButton onClick={handleManage} loading={loading} variant="secondary">
      Manage subscription
    </BillingButton>
  );
}
