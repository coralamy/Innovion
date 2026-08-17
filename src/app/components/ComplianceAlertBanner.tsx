'use client';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function ComplianceAlertBanner() {
  const { companyId } = useAuth();
  const [expired, setExpired] = useState(0);
  const [expiring, setExpiring] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let query = supabase.from('compliance_items').select('comp_status');
    if (companyId) query = (query as any).eq('company_id', companyId);
    query.then(({ data }) => {
      if (data) {
        setExpired(data?.filter((i) => i?.comp_status === 'expired')?.length);
        setExpiring(data?.filter((i) => i?.comp_status === 'expiring')?.length);
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const total = expired + expiring;
  if (loaded && total === 0) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{ backgroundColor: 'var(--warning-bg)', borderColor: 'rgba(245,158,11,0.3)' }}
    >
      <AlertTriangle size={18} className="text-warning flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-600 text-foreground">
          {loaded
            ? `${total} compliance issue${total !== 1 ? 's' : ''} require attention`
            : 'Checking compliance status...'}
        </p>
        {loaded && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {expired > 0 && `${expired} expired`}
            {expired > 0 && expiring > 0 && ' · '}
            {expiring > 0 && `${expiring} expiring soon`}
          </p>
        )}
      </div>
      <Link
        href="/compliance"
        className="flex items-center gap-1 text-xs font-600 text-warning hover:underline flex-shrink-0"
      >
        View all
        <ExternalLink size={12} />
      </Link>
    </div>
  );
}
