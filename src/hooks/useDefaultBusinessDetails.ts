import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api as backendApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface DefaultBusinessDetails {
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  sort_code: string;
  logo_url: string | null;
  table_color: string;
  signature_text: string;
  signature_image: string | null;
}

interface DefaultBusinessDetailsRow {
  business_name?: string | null;
  business_address?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  sort_code?: string | null;
  logo_url?: string | null;
  table_color?: string | null;
  signature_text?: string | null;
  signature_image?: string | null;
}

const EMPTY_DEFAULTS: DefaultBusinessDetails = {
  business_name: '',
  business_address: '',
  business_phone: '',
  business_email: '',
  bank_name: '',
  account_name: '',
  account_number: '',
  sort_code: '',
  logo_url: null,
  table_color: '#228B22',
  signature_text: '',
  signature_image: null,
};

export function useDefaultBusinessDetails() {
  const { user } = useAuth();
  const [defaults, setDefaults] = useState<DefaultBusinessDetails>(EMPTY_DEFAULTS);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadDefaults = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await backendApi
        .from('default_business_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      const row = data as DefaultBusinessDetailsRow | null;
      if (row) {
        setDefaults({
          business_name: row.business_name || '',
          business_address: row.business_address || '',
          business_phone: row.business_phone || '',
          business_email: row.business_email || '',
          bank_name: row.bank_name || '',
          account_name: row.account_name || '',
          account_number: row.account_number || '',
          sort_code: row.sort_code || '',
          logo_url: row.logo_url || null,
          table_color: row.table_color || '#228B22',
          signature_text: row.signature_text || '',
          signature_image: row.signature_image || null,
        });
      }
      setIsLoaded(true);
    } catch (e) {
      console.error('Error loading defaults:', e);
      setIsLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadDefaults();
  }, [user, loadDefaults]);

  const saveDefaults = useCallback(async (details: Partial<DefaultBusinessDetails>) => {
    if (!user) return;
    try {
      const record: Record<string, unknown> = { user_id: user.id, ...details };
      const { data: existing } = await backendApi
        .from('default_business_details')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await backendApi
          .from('default_business_details')
          .update(record)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await backendApi
          .from('default_business_details')
          .insert(record);
        if (error) throw error;
      }
      
      setDefaults(prev => ({ ...prev, ...details }));
      toast.success('Default business details saved!');
    } catch (e) {
      console.error('Error saving defaults:', e);
      toast.error('Failed to save defaults');
    }
  }, [user]);

  return { defaults, isLoaded, saveDefaults };
}
