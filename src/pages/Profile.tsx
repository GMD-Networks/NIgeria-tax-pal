import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Crown, 
  LogOut, 
  ArrowLeft, 
  Calculator, 
  Receipt, 
  MessageCircle,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { backendService } from '@/services/backend';
import { PricingTiers } from '@/components/subscription/UsageLimitGate';
import type { PlanTier } from '@/types/subscription';

interface UsageData {
  calculator: number;
  invoice: number;
  chat: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut, isLoading: authLoading } = useAuth();
  const { 
    subscription, 
    isPremium, 
    isLoading: subLoading, 
    refreshSubscription,
    subscriptionConfig,
    initiatePayment
  } = useSubscription();
  
  const [usageData, setUsageData] = useState<UsageData>({ calculator: 0, invoice: 0, chat: 0 });
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { state: { mode: 'login' } });
      return;
    }

    const fetchUsage = async () => {
      try {
        const [calc, inv, chat] = await Promise.all([
          backendService.getUsage(user.id, 'calculator'),
          backendService.getUsage(user.id, 'invoice'),
          backendService.getUsage(user.id, 'chat'),
        ]);

        setUsageData({
          calculator: calc.data?.usageCount || 0,
          invoice: inv.data?.usageCount || 0,
          chat: chat.data?.usageCount || 0,
        });
      } catch (error) {
        console.error('Failed to fetch usage:', error);
      } finally {
        setIsLoadingUsage(false);
      }
    };

    fetchUsage();
  }, [user, navigate]);

  const handleUpgrade = async (planTier: PlanTier) => {
    setIsUpgrading(true);
    try {
      const paymentLink = await initiatePayment(planTier);
      if (paymentLink) {
        window.open(paymentLink, '_blank');
      }
    } catch (error) {
      toast.error('Failed to initiate payment');
    } finally {
      setIsUpgrading(false);
      setShowPlanSelector(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  if (authLoading || !user) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const limit = subscriptionConfig.freeLimits.calculator;
  const usageItems = [
    { key: 'calculator', label: 'Calculator', icon: Calculator, usage: usageData.calculator },
    { key: 'invoice', label: 'Invoice', icon: Receipt, usage: usageData.invoice },
    { key: 'chat', label: 'AI Chat', icon: MessageCircle, usage: usageData.chat },
  ];

  const expiresAt = subscription?.expiresAt;
  const daysRemaining = expiresAt 
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold"
            >
              My Profile
            </motion.h1>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            {/* User Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-lg">
                        {user.email?.split('@')[0] || 'User'}
                      </h2>
                      {isPremium && (
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">
                          <Crown className="w-3 h-3 mr-1" />
                          Premium
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" />
                  Subscription
                </CardTitle>
                <CardDescription>
                  {isPremium 
                    ? 'You have premium access with unlimited features' 
                    : 'Upgrade to unlock unlimited access'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isPremium ? (
                  <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Premium Active</span>
                    </div>
                    {daysRemaining !== null && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {daysRemaining > 0 
                          ? `${daysRemaining} days remaining`
                          : 'Expires today'}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">Free Plan</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Limited to {limit} uses per feature monthly
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <h4 className="font-semibold text-lg mb-3">Upgrade to Premium</h4>
                      <div className="space-y-2 mb-4">
                        {subscriptionConfig.plans.map((plan) => (
                          <div 
                            key={plan.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-background/50"
                          >
                            <div>
                              <span className="font-medium">{plan.name}</span>
                              {plan.savings && (
                                <span className="text-xs text-green-600 ml-2">{plan.savings}</span>
                              )}
                            </div>
                            <span className="font-bold text-primary">₦{plan.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground mb-4">
                        <li>✓ Unlimited Calculator usage</li>
                        <li>✓ Unlimited Invoice generation</li>
                        <li>✓ Unlimited AI Chat</li>
                        <li>✓ Invoice history & download</li>
                      </ul>
                      <Button 
                        className="w-full" 
                        onClick={() => setShowPlanSelector(true)}
                        disabled={isUpgrading}
                      >
                        {isUpgrading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Choose a Plan'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Plan Selector Modal */}
            {showPlanSelector && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                >
                  <div className="bg-gradient-primary p-6 text-primary-foreground relative">
                    <button
                      onClick={() => setShowPlanSelector(false)}
                      className="absolute top-4 right-4 text-primary-foreground/80 hover:text-primary-foreground text-xl"
                    >
                      ×
                    </button>
                    <div className="flex items-center gap-3">
                      <Crown className="w-10 h-10" />
                      <div>
                        <h2 className="text-xl font-bold">Go Premium</h2>
                        <p className="text-sm opacity-90">Choose your plan</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <PricingTiers onSelect={handleUpgrade} isLoading={isUpgrading} />
                    <Button variant="ghost" onClick={() => setShowPlanSelector(false)} className="w-full mt-4">
                      Maybe Later
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Usage Card */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Usage</CardTitle>
                <CardDescription>
                  {isPremium 
                    ? 'Unlimited usage with premium' 
                    : `${limit} free uses per feature monthly`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingUsage ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  usageItems.map((item) => {
                    const Icon = item.icon;
                    const percentage = isPremium ? 0 : Math.min((item.usage / limit) * 100, 100);
                    
                    return (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{item.label}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {isPremium ? 'Unlimited' : `${item.usage} / ${limit}`}
                          </span>
                        </div>
                        {!isPremium && (
                          <Progress value={percentage} className="h-2" />
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Sign Out Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
