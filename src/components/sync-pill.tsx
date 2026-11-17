import { Pill } from '@/components/ui';
import { useSync } from '@/lib/sync';

/**
 * says, in words, whether work has reached the office. it sits quietly in the corner rather
 * than interrupting: losing signal on a job site is normal, not an error.
 */
export function SyncPill({ layoutId }: { layoutId?: string }) {
  const { status, unsent } = useSync();
  const waiting = layoutId ? unsent.includes(layoutId) : unsent.length > 0;
  if (status === 'live' && !waiting) return <Pill label="Synced" tone="green" />;
  if (status === 'live') return <Pill label="Sending" tone="orange" />;
  if (waiting) return <Pill label="Saved on phone" tone="orange" />;
  return <Pill label={status === 'connecting' ? 'Connecting' : 'Offline'} tone="secondary" />;
}
