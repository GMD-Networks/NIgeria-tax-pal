import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Wallet, Percent, FileText, Building2, Calendar, ClipboardCheck, 
  ScanLine, PiggyBank, BarChart3, Lock, Wrench, Search, Users, MessageCircle, Bell, Tags, Share2, Globe
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToolAvailability } from '@/hooks/useToolAvailability';

interface ToolItem {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  isPro?: boolean;
  comingSoon?: boolean;
}

const calculators: ToolItem[] = [
  { key: 'paye', title: 'PAYE Calculator', description: 'Calculate Pay As You Earn tax', icon: Wallet, path: '/calculator?tab=paye' },
  { key: 'vat', title: 'VAT Calculator', description: 'Calculate Value Added Tax', icon: Percent, path: '/calculator?tab=vat' },
  { key: 'wht', title: 'WHT Calculator', description: 'Calculate Withholding Tax', icon: FileText, path: '/calculator?tab=wht' },
];

const tools: ToolItem[] = [
  { key: 'calendar', title: 'Tax Calendar', description: 'Filing deadlines & reminders', icon: Calendar, path: '/tax-calendar' },
  { key: 'deadline_reminders', title: 'Tax Deadline Reminders', description: 'Track deadlines and get reminders', icon: Bell, path: '/tax-calendar' },
  { key: 'checklist', title: 'Compliance Checklist', description: 'Interactive tax checklist', icon: ClipboardCheck, path: '/compliance-checklist' },
  { key: 'scanner', title: 'Document Scanner', description: 'Scan & convert to PDF/Word', icon: ScanLine, path: '/document-scanner' },
  { key: 'receipt_categories', title: 'Receipt Categorization', description: 'Auto-categorize receipts for tax deductions', icon: Tags, path: '/document-scanner' },
  { key: 'tin_lookup', title: 'TIN Lookup', description: 'Verify TIN numbers via FIRS', icon: Search, path: '/tin-lookup' },
  { key: 'whatsapp_share', title: 'WhatsApp Share', description: 'Share generated invoices via WhatsApp', icon: Share2, path: '/invoice' },
  { key: 'multi_currency', title: 'Multi-Currency Invoice', description: 'Create invoices in different currencies', icon: Globe, path: '/invoice' },
  { key: 'payroll', title: 'Payroll Module', description: 'PAYE, Pension, NHF & NSITF', icon: Users, path: '/payroll' },
];

const trackers: ToolItem[] = [
  { key: 'savings', title: 'Tax Savings Tracker', description: 'Track savings & achievements', icon: PiggyBank, path: '/tax-savings' },
  { key: 'assessment', title: 'Business Assessment', description: 'Business tax assessment quiz', icon: BarChart3, path: '/business-assessment' },
];

const ToolCard = ({ item, index }: { item: ToolItem; index: number }) => {
  const navigate = useNavigate();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card 
        className={cn(
          "cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-200 group relative",
          item.comingSoon && "opacity-70"
        )}
        onClick={() => !item.comingSoon && navigate(item.path)}
      >
        <CardContent className="p-4">
          {item.isPro && (
            <Badge variant="secondary" className="absolute top-3 right-3 text-[10px] gap-1">
              <Lock className="w-3 h-3" /> Pro
            </Badge>
          )}
          {item.comingSoon && (
            <Badge variant="outline" className="absolute top-3 right-3 text-[10px]">
              Soon
            </Badge>
          )}
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 mb-3 group-hover:scale-105 transition-transform">
            <item.icon className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {item.description}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const TaxTools = () => {
  const { t } = useTranslation();
  const { isToolEnabled, isLoading } = useToolAvailability();

  const enabledCalculators = calculators.filter(item => isToolEnabled(item.key));
  const enabledTools = tools.filter(item => isToolEnabled(item.key));
  const enabledTrackers = trackers.filter(item => isToolEnabled(item.key));

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Tax Tools</h1>
                <p className="text-sm text-muted-foreground">All your tax tools in one place</p>
              </div>
            </motion.div>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-8">
            {enabledCalculators.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Calculators</h2>
                <div className="grid grid-cols-2 gap-3">
                  {enabledCalculators.map((item, i) => (
                    <ToolCard key={item.key} item={item} index={i} />
                  ))}
                </div>
              </section>
            )}

            {enabledTools.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Tools</h2>
                <div className="grid grid-cols-2 gap-3">
                  {enabledTools.map((item, i) => (
                    <ToolCard key={item.key} item={item} index={i + enabledCalculators.length} />
                  ))}
                </div>
              </section>
            )}

            {enabledTrackers.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Trackers & Assessment</h2>
                <div className="grid grid-cols-2 gap-3">
                  {enabledTrackers.map((item, i) => (
                    <ToolCard key={item.key} item={item} index={i + enabledCalculators.length + enabledTools.length} />
                  ))}
                </div>
              </section>
            )}

            {enabledCalculators.length === 0 && enabledTools.length === 0 && enabledTrackers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No tools available at the moment</p>
                <p className="text-sm mt-1">Check back later for updates!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TaxTools;
