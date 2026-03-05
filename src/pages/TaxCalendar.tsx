import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Bell, CheckCircle2, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface TaxDeadline {
  id: string;
  title: string;
  description: string;
  date: string;
  category: 'paye' | 'vat' | 'cit' | 'wht' | 'filing';
  recurring: 'monthly' | 'quarterly' | 'annually';
  penalty?: string;
}

const taxDeadlines: TaxDeadline[] = [
  { id: '1', title: 'PAYE Remittance', description: 'Monthly Pay As You Earn tax remittance to FIRS', date: '10th of every month', category: 'paye', recurring: 'monthly', penalty: '10% of tax due + interest' },
  { id: '2', title: 'VAT Returns Filing', description: 'Monthly VAT returns submission to FIRS', date: '21st of every month', category: 'vat', recurring: 'monthly', penalty: '₦5,000 for first month, ₦25,000 for subsequent months' },
  { id: '3', title: 'WHT Remittance', description: 'Withholding Tax deducted must be remitted', date: '21st of every month', category: 'wht', recurring: 'monthly', penalty: '10% penalty + interest at CBN rate' },
  { id: '4', title: 'Company Income Tax (CIT)', description: 'Annual CIT returns filing deadline', date: 'June 30th', category: 'cit', recurring: 'annually', penalty: '₦25,000 first month, ₦5,000 each subsequent month' },
  { id: '5', title: 'Annual PAYE Filing', description: 'Annual employer PAYE returns (Form H1)', date: 'January 31st', category: 'paye', recurring: 'annually', penalty: '₦500,000 or 5 years imprisonment' },
  { id: '6', title: 'Personal Income Tax Returns', description: 'Individual annual tax returns filing', date: 'March 31st', category: 'filing', recurring: 'annually', penalty: '₦50,000 first month + ₦25,000 each subsequent' },
  { id: '7', title: 'CIT Interim Returns', description: 'Quarterly CIT installment payments', date: 'End of each quarter', category: 'cit', recurring: 'quarterly' },
  { id: '8', title: 'TIN Registration', description: 'New businesses must register for TIN within 6 months', date: 'Within 6 months of commencement', category: 'filing', recurring: 'annually' },
];

const categoryColors: Record<string, string> = {
  paye: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  vat: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cit: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  wht: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  filing: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const getNextOccurrence = (deadline: TaxDeadline): { date: Date; daysLeft: number; status: 'upcoming' | 'soon' | 'overdue' } => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let nextDate: Date;

  if (deadline.recurring === 'monthly') {
    const dayMatch = deadline.date.match(/(\d+)/);
    const day = dayMatch ? parseInt(dayMatch[1]) : 1;
    nextDate = new Date(currentYear, currentMonth, day);
    if (nextDate < now) nextDate = new Date(currentYear, currentMonth + 1, day);
  } else if (deadline.recurring === 'annually') {
    const monthMap: Record<string, number> = { 'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5, 'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11 };
    const parts = deadline.date.match(/(\w+)\s+(\d+)/);
    if (parts) {
      const month = monthMap[parts[1]] ?? 0;
      const day = parseInt(parts[2]);
      nextDate = new Date(currentYear, month, day);
      if (nextDate < now) nextDate = new Date(currentYear + 1, month, day);
    } else {
      nextDate = new Date(currentYear, 11, 31);
    }
  } else {
    // quarterly - end of current quarter
    const quarterEnd = Math.ceil((currentMonth + 1) / 3) * 3;
    nextDate = new Date(currentYear, quarterEnd, 0);
    if (nextDate < now) nextDate = new Date(currentYear, quarterEnd + 3, 0);
  }

  const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const status = daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'soon' : 'upcoming';
  return { date: nextDate, daysLeft, status };
};

const TaxCalendar = () => {
  const [activeTab, setActiveTab] = useState('all');

  const filteredDeadlines = activeTab === 'all' 
    ? taxDeadlines 
    : taxDeadlines.filter(d => d.recurring === activeTab);

  const sortedDeadlines = [...filteredDeadlines].sort((a, b) => {
    const aNext = getNextOccurrence(a);
    const bNext = getNextOccurrence(b);
    return aNext.daysLeft - bNext.daysLeft;
  });

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Tax Calendar</h1>
                <p className="text-sm text-muted-foreground">Nigerian tax filing deadlines & reminders</p>
              </div>
            </motion.div>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'This Month', count: sortedDeadlines.filter(d => getNextOccurrence(d).daysLeft <= 30 && getNextOccurrence(d).daysLeft >= 0).length, icon: Clock, color: 'text-blue-500' },
                { label: 'Due Soon', count: sortedDeadlines.filter(d => getNextOccurrence(d).status === 'soon').length, icon: AlertTriangle, color: 'text-amber-500' },
                { label: 'Monthly', count: taxDeadlines.filter(d => d.recurring === 'monthly').length, icon: Bell, color: 'text-green-500' },
              ].map((stat, i) => (
                <Card key={i}>
                  <CardContent className="p-3 text-center">
                    <stat.icon className={cn("w-5 h-5 mx-auto mb-1", stat.color)} />
                    <div className="text-xl font-bold">{stat.count}</div>
                    <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filter Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1 text-xs">Monthly</TabsTrigger>
                <TabsTrigger value="quarterly" className="flex-1 text-xs">Quarterly</TabsTrigger>
                <TabsTrigger value="annually" className="flex-1 text-xs">Annual</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Deadlines List */}
            <div className="space-y-3">
              {sortedDeadlines.map((deadline, i) => {
                const { daysLeft, status } = getNextOccurrence(deadline);
                return (
                  <motion.div key={deadline.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className={cn(
                      "hover:shadow-md transition-shadow",
                      status === 'soon' && "border-amber-300 dark:border-amber-700",
                      status === 'overdue' && "border-red-300 dark:border-red-700"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={cn("text-[10px]", categoryColors[deadline.category])}>
                                {deadline.category.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {deadline.recurring}
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-sm">{deadline.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{deadline.description}</p>
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>Due: {deadline.date}</span>
                            </div>
                            {deadline.penalty && (
                              <p className="text-[10px] text-red-500 mt-1">⚠ Penalty: {deadline.penalty}</p>
                            )}
                          </div>
                          <div className={cn(
                            "text-right shrink-0",
                            status === 'soon' && "text-amber-600",
                            status === 'overdue' && "text-red-600",
                            status === 'upcoming' && "text-muted-foreground"
                          )}>
                            <div className="text-lg font-bold">{Math.abs(daysLeft)}</div>
                            <div className="text-[10px]">{daysLeft < 0 ? 'days ago' : 'days left'}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TaxCalendar;
