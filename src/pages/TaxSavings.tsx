import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiggyBank, Plus, Trash2, Target, TrendingUp, Award, 
  CheckCircle2, ArrowLeft, Edit2, Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
  createdAt: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

const STORAGE_KEY = 'taxpal-savings-goals';

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_goal', title: 'Goal Setter', description: 'Created your first savings goal', icon: '🎯' },
  { id: 'first_save', title: 'First Save', description: 'Made your first savings entry', icon: '💰' },
  { id: 'goal_complete', title: 'Goal Crusher', description: 'Completed a savings goal', icon: '🏆' },
  { id: 'three_goals', title: 'Ambitious', description: 'Created 3 or more goals', icon: '🚀' },
  { id: 'total_100k', title: '₦100K Club', description: 'Total savings reached ₦100,000', icon: '💎' },
  { id: 'total_1m', title: 'Millionaire Saver', description: 'Total savings reached ₦1,000,000', icon: '👑' },
];

const CATEGORIES = ['PAYE Refund', 'VAT Savings', 'Tax Relief', 'Pension', 'Other'];

const TaxSavings = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddSaving, setShowAddSaving] = useState<string | null>(null);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('Other');
  const [savingAmount, setSavingAmount] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setGoals(parsed.goals || []);
      setUnlockedAchievements(parsed.achievements || []);
    }
  }, []);

  const persist = (newGoals: SavingsGoal[], newAchievements: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ goals: newGoals, achievements: newAchievements }));
    setGoals(newGoals);
    setUnlockedAchievements(newAchievements);
  };

  const checkAchievements = (goals: SavingsGoal[], achievements: string[]): string[] => {
    const newUnlocked = [...achievements];
    const total = goals.reduce((sum, g) => sum + g.currentAmount, 0);

    if (goals.length >= 1 && !newUnlocked.includes('first_goal')) newUnlocked.push('first_goal');
    if (goals.some(g => g.currentAmount > 0) && !newUnlocked.includes('first_save')) newUnlocked.push('first_save');
    if (goals.some(g => g.currentAmount >= g.targetAmount) && !newUnlocked.includes('goal_complete')) newUnlocked.push('goal_complete');
    if (goals.length >= 3 && !newUnlocked.includes('three_goals')) newUnlocked.push('three_goals');
    if (total >= 100000 && !newUnlocked.includes('total_100k')) newUnlocked.push('total_100k');
    if (total >= 1000000 && !newUnlocked.includes('total_1m')) newUnlocked.push('total_1m');

    if (newUnlocked.length > achievements.length) {
      const newest = ACHIEVEMENTS.find(a => a.id === newUnlocked[newUnlocked.length - 1]);
      if (newest) toast.success(`🏆 Achievement Unlocked: ${newest.title}!`);
    }
    return newUnlocked;
  };

  const addGoal = () => {
    if (!newGoalName || !newGoalTarget || Number(newGoalTarget) <= 0) {
      toast.error('Please enter a valid goal name and target amount');
      return;
    }
    const newGoal: SavingsGoal = {
      id: crypto.randomUUID(),
      name: newGoalName,
      targetAmount: Number(newGoalTarget),
      currentAmount: 0,
      category: newGoalCategory,
      createdAt: new Date().toISOString(),
    };
    const updated = [...goals, newGoal];
    const ach = checkAchievements(updated, unlockedAchievements);
    persist(updated, ach);
    setShowAddGoal(false);
    setNewGoalName('');
    setNewGoalTarget('');
    toast.success('Savings goal created!');
  };

  const addSaving = (goalId: string) => {
    const amount = Number(savingAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const updated = goals.map(g => g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount } : g);
    const ach = checkAchievements(updated, unlockedAchievements);
    persist(updated, ach);
    setShowAddSaving(null);
    setSavingAmount('');
    toast.success(`₦${amount.toLocaleString()} added to savings!`);
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    persist(updated, unlockedAchievements);
    toast.success('Goal removed');
  };

  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

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
                <PiggyBank className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Tax Savings</h1>
                <p className="text-sm text-muted-foreground">Track your tax savings goals</p>
              </div>
            </motion.div>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Overview */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Saved</p>
                    <p className="text-3xl font-bold text-foreground">₦{totalSaved.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Target</p>
                    <p className="text-lg font-semibold text-foreground">₦{totalTarget.toLocaleString()}</p>
                  </div>
                </div>
                <Progress value={overallProgress} className="h-3" />
                <p className="text-xs text-muted-foreground mt-2">{overallProgress.toFixed(0)}% of total goal</p>
              </CardContent>
            </Card>

            {/* Achievements */}
            <section>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Achievements ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {ACHIEVEMENTS.map(ach => {
                  const unlocked = unlockedAchievements.includes(ach.id);
                  return (
                    <Card key={ach.id} className={unlocked ? 'border-primary/40 bg-primary/5' : 'opacity-40'}>
                      <CardContent className="p-3 text-center">
                        <span className="text-2xl">{ach.icon}</span>
                        <p className="text-[10px] font-semibold mt-1 text-foreground">{ach.title}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Goals */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Savings Goals</h2>
                <Button size="sm" variant="outline" onClick={() => setShowAddGoal(true)} className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Add Goal
                </Button>
              </div>

              <AnimatePresence>
                {showAddGoal && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <Card className="mb-3">
                      <CardContent className="p-4 space-y-3">
                        <Input placeholder="Goal name (e.g., PAYE Refund)" value={newGoalName} onChange={e => setNewGoalName(e.target.value)} />
                        <Input type="number" placeholder="Target amount (₦)" value={newGoalTarget} onChange={e => setNewGoalTarget(e.target.value)} />
                        <div className="flex flex-wrap gap-2">
                          {CATEGORIES.map(cat => (
                            <Badge
                              key={cat}
                              variant={newGoalCategory === cat ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => setNewGoalCategory(cat)}
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={addGoal} className="flex-1">Create Goal</Button>
                          <Button size="sm" variant="outline" onClick={() => setShowAddGoal(false)}>Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {goals.length === 0 && !showAddGoal && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No savings goals yet</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddGoal(true)}>Create your first goal</Button>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {goals.map((goal, i) => {
                  const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                  const isComplete = goal.currentAmount >= goal.targetAmount;
                  return (
                    <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className={isComplete ? 'border-green-500/40 bg-green-50/50 dark:bg-green-900/10' : ''}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm text-foreground">{goal.name}</h3>
                                {isComplete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              </div>
                              <Badge variant="outline" className="text-[10px] mt-1">{goal.category}</Badge>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowAddSaving(goal.id); setSavingAmount(''); }}>
                                <Plus className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteGoal(goal.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-2">
                            <span>₦{goal.currentAmount.toLocaleString()}</span>
                            <span>₦{goal.targetAmount.toLocaleString()}</span>
                          </div>
                          <Progress value={progress} className="h-2" />

                          <AnimatePresence>
                            {showAddSaving === goal.id && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex gap-2">
                                <Input type="number" placeholder="Amount (₦)" value={savingAmount} onChange={e => setSavingAmount(e.target.value)} className="flex-1" />
                                <Button size="sm" onClick={() => addSaving(goal.id)}><Save className="w-3 h-3" /></Button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TaxSavings;
