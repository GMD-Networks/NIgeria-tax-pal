import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  question: string;
  options: { label: string; value: number; tip?: string }[];
  category: string;
}

const QUESTIONS: Question[] = [
  {
    id: 'registration', category: 'Registration',
    question: 'Is your business registered with the Corporate Affairs Commission (CAC)?',
    options: [
      { label: 'Yes, fully registered', value: 3 },
      { label: 'In progress', value: 1 },
      { label: 'No', value: 0, tip: 'CAC registration is mandatory for tax compliance' },
    ],
  },
  {
    id: 'tin', category: 'Registration',
    question: 'Do you have a Tax Identification Number (TIN)?',
    options: [
      { label: 'Yes', value: 3 },
      { label: 'Applied but not received', value: 1 },
      { label: 'No', value: 0, tip: 'Register at the nearest FIRS office or online at taxpromax.firs.gov.ng' },
    ],
  },
  {
    id: 'vat_registered', category: 'Registration',
    question: 'Is your business registered for VAT?',
    options: [
      { label: 'Yes', value: 3 },
      { label: 'Not applicable (turnover below ₦25M)', value: 2 },
      { label: 'No, but should be', value: 0, tip: 'Businesses with ₦25M+ turnover must register for VAT' },
    ],
  },
  {
    id: 'bookkeeping', category: 'Record Keeping',
    question: 'How do you keep your financial records?',
    options: [
      { label: 'Professional accounting software', value: 3 },
      { label: 'Spreadsheets', value: 2 },
      { label: 'Manual/paper records', value: 1 },
      { label: 'No formal records', value: 0, tip: 'Proper bookkeeping is essential for accurate tax filing' },
    ],
  },
  {
    id: 'receipts', category: 'Record Keeping',
    question: 'Do you keep receipts and invoices for all business transactions?',
    options: [
      { label: 'Yes, all organized digitally', value: 3 },
      { label: 'Mostly, some gaps', value: 2 },
      { label: 'Rarely', value: 0, tip: 'Keep all receipts for at least 6 years for audit purposes' },
    ],
  },
  {
    id: 'paye_filing', category: 'Filing',
    question: 'Do you file and remit PAYE for employees monthly?',
    options: [
      { label: 'Yes, always on time', value: 3 },
      { label: 'Sometimes late', value: 1, tip: 'Late filing attracts penalties of 10% + interest' },
      { label: 'No employees / Not applicable', value: 2 },
      { label: 'No', value: 0, tip: 'PAYE must be remitted by the 10th of each month' },
    ],
  },
  {
    id: 'vat_filing', category: 'Filing',
    question: 'Do you file VAT returns monthly?',
    options: [
      { label: 'Yes, by the 21st', value: 3 },
      { label: 'Usually, sometimes late', value: 1 },
      { label: 'Not VAT registered', value: 2 },
      { label: 'No', value: 0, tip: 'VAT returns are due by the 21st of each month' },
    ],
  },
  {
    id: 'annual_returns', category: 'Filing',
    question: 'Do you file annual tax returns (Company Income Tax)?',
    options: [
      { label: 'Yes, within 6 months of year end', value: 3 },
      { label: 'Yes, but often late', value: 1 },
      { label: 'No', value: 0, tip: 'CIT returns are due 6 months after the accounting year end' },
    ],
  },
  {
    id: 'wht_compliance', category: 'Compliance',
    question: 'Do you deduct and remit Withholding Tax on applicable payments?',
    options: [
      { label: 'Yes, always', value: 3 },
      { label: 'Sometimes', value: 1 },
      { label: 'Not sure what WHT applies to', value: 0, tip: 'WHT applies to rent, contracts, professional fees, and more' },
    ],
  },
  {
    id: 'tax_advisor', category: 'Compliance',
    question: 'Do you have a tax advisor or accountant?',
    options: [
      { label: 'Yes, professional tax advisor', value: 3 },
      { label: 'Internal accountant handles tax', value: 2 },
      { label: 'No', value: 0, tip: 'A professional advisor can help optimize your tax position' },
    ],
  },
];

const getScoreLevel = (percentage: number) => {
  if (percentage >= 80) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', description: 'Your business tax compliance is strong. Keep it up!' };
  if (percentage >= 60) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', description: 'You\'re doing well but there are areas to improve.' };
  if (percentage >= 40) return { label: 'Needs Improvement', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', description: 'Several compliance gaps need attention to avoid penalties.' };
  return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', description: 'Urgent action needed. Your business faces significant tax compliance risks.' };
};

const BusinessAssessment = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [tips, setTips] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  const question = QUESTIONS[currentIndex];
  const progress = ((currentIndex + (answers[question?.id] !== undefined ? 1 : 0)) / QUESTIONS.length) * 100;

  const selectAnswer = (value: number, tip?: string) => {
    setAnswers(prev => ({ ...prev, [question.id]: value }));
    if (tip) setTips(prev => [...prev.filter(t => t !== tip), tip]);

    setTimeout(() => {
      if (currentIndex < QUESTIONS.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setShowResults(true);
      }
    }, 300);
  };

  const totalScore = Object.values(answers).reduce((sum, v) => sum + v, 0);
  const maxScore = QUESTIONS.length * 3;
  const percentage = Math.round((totalScore / maxScore) * 100);
  const level = getScoreLevel(percentage);

  const categoryScores = QUESTIONS.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = { total: 0, max: 0 };
    acc[q.category].total += answers[q.id] || 0;
    acc[q.category].max += 3;
    return acc;
  }, {} as Record<string, { total: number; max: number }>);

  const restart = () => {
    setCurrentIndex(0);
    setAnswers({});
    setTips([]);
    setShowResults(false);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/tax-tools')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Business Assessment</h1>
                <p className="text-sm text-muted-foreground">Tax compliance health check</p>
              </div>
            </motion.div>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            {!showResults ? (
              <>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Question {currentIndex + 1} of {QUESTIONS.length}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card>
                      <CardHeader>
                        <Badge variant="outline" className="w-fit text-[10px] mb-2">{question.category}</Badge>
                        <CardTitle className="text-base leading-relaxed">{question.question}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {question.options.map((opt, i) => (
                          <Button
                            key={i}
                            variant={answers[question.id] === opt.value ? 'default' : 'outline'}
                            className="w-full justify-start text-left h-auto py-3 px-4"
                            onClick={() => selectAnswer(opt.value, opt.tip)}
                          >
                            <span className="text-sm">{opt.label}</span>
                          </Button>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
                </AnimatePresence>

                {currentIndex > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setCurrentIndex(prev => prev - 1)} className="gap-1">
                    <ArrowLeft className="w-3 h-3" /> Previous
                  </Button>
                )}
              </>
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Score Card */}
                <Card className={cn('border-2', level.bg)}>
                  <CardContent className="p-6 text-center">
                    <div className="text-5xl font-bold text-foreground mb-2">{percentage}%</div>
                    <Badge className={cn('text-sm mb-3', level.color)}>{level.label}</Badge>
                    <p className="text-sm text-muted-foreground">{level.description}</p>
                  </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Category Breakdown</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(categoryScores).map(([cat, scores]) => {
                      const catPct = Math.round((scores.total / scores.max) * 100);
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-foreground">{cat}</span>
                            <span className="text-muted-foreground">{catPct}%</span>
                          </div>
                          <Progress value={catPct} className="h-2" />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Recommendations */}
                {tips.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" /> Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {tips.map((tip, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{tip}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-3">
                  <Button onClick={restart} variant="outline" className="flex-1 gap-2">
                    <RotateCcw className="w-4 h-4" /> Retake
                  </Button>
                  <Button onClick={() => navigate('/tax-tools')} className="flex-1">
                    Back to Tools
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default BusinessAssessment;
