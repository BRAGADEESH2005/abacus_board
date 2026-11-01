'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function BrokerStatusToggle({ id, status }: { id: string; status: 'active' | 'disabled' }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const next = status === 'active' ? 'disabled' : 'active';
  return (
    <Button
      className={status === 'active' ? 'small danger' : 'small primary'}
      loading={busy}
      onClick={async () => {
        if (next === 'disabled' && !confirm('Switch off this broker? They are logged out and cannot log in until you switch them back on. Their properties stay in the inventory.')) return;
        setBusy(true);
        try {
          await api(`/api/admin/brokers/${id}`, { method: 'PATCH', body: { status: next } });
          toast(next === 'disabled' ? 'Broker switched off' : 'Broker switched on', 'success');
          router.refresh();
        } catch (e) {
          toast((e as ApiErr).message, 'error');
        }
        setBusy(false);
      }}
    >
      {status === 'active' ? 'Switch off account' : 'Switch account back on'}
    </Button>
  );
}
