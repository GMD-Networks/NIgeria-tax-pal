import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ExpenseCategory = 
  | 'office_supplies' | 'travel' | 'meals' | 'utilities' 
  | 'rent' | 'salary' | 'professional_services' | 'equipment'
  | 'marketing' | 'insurance' | 'telecommunications' | 'other';

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; color: string }> = {
  office_supplies: { label: 'Office Supplies', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  travel: { label: 'Travel', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  meals: { label: 'Meals & Entertainment', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  utilities: { label: 'Utilities', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  rent: { label: 'Rent/Lease', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  salary: { label: 'Salary/Wages', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  professional_services: { label: 'Professional Services', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  equipment: { label: 'Equipment', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  marketing: { label: 'Marketing', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  insurance: { label: 'Insurance', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  telecommunications: { label: 'Telecom', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300' },
};

export function categorizeReceipt(text: string, vendor?: string): ExpenseCategory {
  const combined = `${text} ${vendor || ''}`.toLowerCase();

  if (/hotel|flight|uber|bolt|taxi|transport|travel|airfare|airline/.test(combined)) return 'travel';
  if (/restaurant|food|meal|lunch|dinner|breakfast|eat|cafe|catering/.test(combined)) return 'meals';
  if (/electric|water|nepa|phcn|gas|utility|dstv|gotv/.test(combined)) return 'utilities';
  if (/rent|lease|property|landlord/.test(combined)) return 'rent';
  if (/paper|pen|stationery|office|printer|toner|ink/.test(combined)) return 'office_supplies';
  if (/salary|wage|payroll|staff/.test(combined)) return 'salary';
  if (/lawyer|legal|accounting|audit|consultant|advisory/.test(combined)) return 'professional_services';
  if (/computer|laptop|phone|equipment|machinery|furniture/.test(combined)) return 'equipment';
  if (/advert|marketing|ads|promotion|billboard|social media/.test(combined)) return 'marketing';
  if (/insurance|premium|policy|cover/.test(combined)) return 'insurance';
  if (/mtn|airtel|glo|9mobile|internet|data|telecom|phone bill/.test(combined)) return 'telecommunications';

  return 'other';
}

interface ReceiptCategoryBadgeProps {
  category: ExpenseCategory;
  className?: string;
}

export function ReceiptCategoryBadge({ category, className }: ReceiptCategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
  return (
    <Badge className={cn('text-[10px]', config.color, className)}>
      {config.label}
    </Badge>
  );
}

export function getTaxDeductionInfo(category: ExpenseCategory): string {
  const info: Record<ExpenseCategory, string> = {
    office_supplies: 'Fully deductible as business expense',
    travel: 'Deductible if for business purposes (keep receipts)',
    meals: 'Partially deductible — entertainment limited to 10% of profit',
    utilities: 'Deductible if used for business premises',
    rent: 'Fully deductible for business premises',
    salary: 'Deductible; ensure PAYE is remitted',
    professional_services: 'Fully deductible; WHT at 10% applies',
    equipment: 'Capital allowance applies (initial + annual)',
    marketing: 'Fully deductible as business expense',
    insurance: 'Deductible for business-related insurance',
    telecommunications: 'Deductible for business communication costs',
    other: 'Deductibility depends on business purpose',
  };
  return info[category] || info.other;
}
