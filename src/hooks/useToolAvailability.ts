import { useQuery } from '@tanstack/react-query';
import { api as backendApi } from '@/services/api';

export interface ToolConfig {
  [toolKey: string]: boolean;
}

interface ToolConfigRow {
  config_data: Record<string, unknown>;
}

const ALL_TOOLS: Record<string, string> = {
  paye: 'PAYE Calculator',
  vat: 'VAT Calculator',
  wht: 'WHT Calculator',
  calendar: 'Tax Calendar',
  checklist: 'Compliance Checklist',
  scanner: 'Document Scanner',
  savings: 'Tax Savings Tracker',
  assessment: 'Business Assessment',
  invoice: 'Invoice Generator',
  chat: 'AI Tax Chat',
  learn: 'Tax Learning',
  tin_lookup: 'TIN Lookup',
  whatsapp_share: 'WhatsApp Share',
  multi_currency: 'Multi-Currency Invoice',
  deadline_reminders: 'Tax Deadline Reminders',
  receipt_categories: 'Receipt Categorization',
  payroll: 'Payroll Module',
};

const ALWAYS_ENABLED_TOOLS = ['tin_lookup', 'whatsapp_share', 'multi_currency', 'deadline_reminders', 'receipt_categories', 'payroll'];

const DEFAULT_TOOL_CONFIG: ToolConfig = Object.keys(ALL_TOOLS).reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {} as ToolConfig);

export { ALL_TOOLS, DEFAULT_TOOL_CONFIG };

export function useToolAvailability() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-tool-config'],
    queryFn: async () => {
      const { data, error } = await backendApi
        .from('api_configurations')
        .select('config_data')
        .eq('config_type', 'tool_availability')
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) return DEFAULT_TOOL_CONFIG;

      const config = (data as ToolConfigRow).config_data;
      const merged = { ...DEFAULT_TOOL_CONFIG, ...config } as ToolConfig;
      for (const key of ALWAYS_ENABLED_TOOLS) {
        merged[key] = true;
      }
      return merged;
    },
    staleTime: 5 * 60 * 1000,
  });

  const toolConfig = data || DEFAULT_TOOL_CONFIG;

  const isToolEnabled = (toolKey: string): boolean => {
    if (ALWAYS_ENABLED_TOOLS.includes(toolKey)) {
      return true;
    }
    return toolConfig[toolKey] !== false;
  };

  return { toolConfig, isToolEnabled, isLoading, ALL_TOOLS };
}
