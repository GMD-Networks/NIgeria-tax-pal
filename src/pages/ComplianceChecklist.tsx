import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, CheckCircle2, Circle, ChevronDown, ChevronUp, RotateCcw, Award } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface ChecklistCategory {
  id: string;
  title: string;
  items: ChecklistItem[];
}

const checklistData: ChecklistCategory[] = [
  {
    id: 'registration',
    title: 'Business Registration & TIN',
    items: [
      { id: 'r1', title: 'Obtain Tax Identification Number (TIN)', description: 'Register with FIRS/JTB to get your TIN — required for all tax-related activities.', category: 'registration' },
      { id: 'r2', title: 'Register for VAT', description: 'Businesses with turnover above ₦25M must register for VAT with FIRS.', category: 'registration' },
      { id: 'r3', title: 'Register with State IRS', description: 'Employees and individuals must register with their State Internal Revenue Service.', category: 'registration' },
      { id: 'r4', title: 'Obtain CAC Registration', description: 'Ensure your business is registered with the Corporate Affairs Commission.', category: 'registration' },
    ]
  },
  {
    id: 'monthly',
    title: 'Monthly Obligations',
    items: [
      { id: 'm1', title: 'Remit PAYE deductions', description: 'Deduct and remit PAYE from employee salaries by the 10th of each month.', category: 'monthly' },
      { id: 'm2', title: 'File VAT returns', description: 'Submit monthly VAT returns to FIRS by the 21st of each month.', category: 'monthly' },
      { id: 'm3', title: 'Remit WHT deductions', description: 'Remit any Withholding Tax deducted from payments by the 21st.', category: 'monthly' },
      { id: 'm4', title: 'Maintain books of accounts', description: 'Keep accurate and up-to-date financial records.', category: 'monthly' },
    ]
  },
  {
    id: 'annual',
    title: 'Annual Filing Requirements',
    items: [
      { id: 'a1', title: 'File Annual PAYE returns (Form H1)', description: 'Submit employer annual returns by January 31st.', category: 'annual' },
      { id: 'a2', title: 'File Personal Income Tax returns', description: 'Individual returns due by March 31st each year.', category: 'annual' },
      { id: 'a3', title: 'File Company Income Tax returns', description: 'CIT returns due within 6 months of financial year end (June 30 for Dec year-end).', category: 'annual' },
      { id: 'a4', title: 'Pay Education Tax', description: 'Tertiary Education Tax at 2.5% of assessable profit (for companies).', category: 'annual' },
      { id: 'a5', title: 'File audited financial statements', description: 'Submit audited accounts along with CIT returns.', category: 'annual' },
    ]
  },
  {
    id: 'records',
    title: 'Record Keeping',
    items: [
      { id: 'k1', title: 'Keep records for at least 6 years', description: 'Nigerian tax law requires retention of tax records for a minimum of 6 years.', category: 'records' },
      { id: 'k2', title: 'Maintain payroll records', description: 'Keep detailed records of all employee compensation and tax deductions.', category: 'records' },
      { id: 'k3', title: 'Store all tax receipts and certificates', description: 'Keep copies of TCC (Tax Clearance Certificate) and payment receipts.', category: 'records' },
    ]
  }
];

const STORAGE_KEY = 'taxpal_compliance_checklist';

const ComplianceChecklist = () => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({ registration: true });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setChecked(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  const toggleItem = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalItems = checklistData.reduce((sum, cat) => sum + cat.items.length, 0);
  const completedItems = Object.values(checked).filter(Boolean).length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const resetAll = () => setChecked({});

  const getCategoryProgress = (cat: ChecklistCategory) => {
    const done = cat.items.filter(item => checked[item.id]).length;
    return { done, total: cat.items.length };
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Compliance Checklist</h1>
                <p className="text-sm text-muted-foreground">Track your Nigerian tax obligations</p>
              </div>
            </motion.div>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Progress Overview */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {progress === 100 ? <Award className="w-5 h-5 text-primary" /> : <ClipboardCheck className="w-5 h-5 text-primary" />}
                    <span className="font-semibold text-sm">
                      {progress === 100 ? '🎉 All Complete!' : `${completedItems} of ${totalItems} completed`}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetAll} className="text-xs gap-1">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </Button>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">{progress}% compliance progress</p>
              </CardContent>
            </Card>

            {/* Categories */}
            {checklistData.map((category, catIndex) => {
              const { done, total } = getCategoryProgress(category);
              const isOpen = openCategories[category.id] ?? false;

              return (
                <motion.div key={category.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: catIndex * 0.1 }}>
                  <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
                    <Card>
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm">{category.title}</CardTitle>
                              <Badge variant="secondary" className="text-[10px]">
                                {done}/{total}
                              </Badge>
                            </div>
                            {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-2">
                          {category.items.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                                checked[item.id] ? "bg-primary/5" : "hover:bg-muted/50"
                              )}
                              onClick={() => toggleItem(item.id)}
                            >
                              {checked[item.id] ? (
                                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className={cn("text-sm font-medium", checked[item.id] && "line-through text-muted-foreground")}>{item.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ComplianceChecklist;
