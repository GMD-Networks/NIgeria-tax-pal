import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Lock, Crown, Sparkles, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_TIERS } from '@/types/subscription';
import type { FeatureType, PlanTier } from '@/types/subscription';

interface UsageLimitGateProps {
  featureType: FeatureType;
  currentUsage: number;
  limit: number;
  isUnlimited: boolean;
  canUse: boolean;
  children: React.ReactNode;
}

export function UsageLimitGate({
  featureType,
  currentUsage,
  limit,
  isUnlimited,
  canUse,
  children,
}: UsageLimitGateProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { initiatePayment, isLoading: isPaymentLoading } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const featureNames: Record<FeatureType, string> = {
    calculator: 'Tax Calculator',
    invoice: 'Invoice Generator',
    chat: 'AI Tax Assistant',
  };

  const handleUpgrade = async (planTier: PlanTier = 'quarterly') => {
    const paymentLink = await initiatePayment(planTier);
    if (paymentLink) {
      window.open(paymentLink, '_blank');
    }
  };

  // If user can use the feature, render children
  if (canUse || isUnlimited) {
    return (
      <>
        {/* Usage indicator for free users */}
        {!isUnlimited && user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4"
          >
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                <span>Free usage: {currentUsage} / {limit}</span>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Crown className="w-3 h-3" />
                  Upgrade
                </button>
              </div>
              <Progress value={(currentUsage / limit) * 100} className="h-1.5" />
            </div>
          </motion.div>
        )}
        {children}
        
        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <UpgradeModal
            featureName={featureNames[featureType]}
            onClose={() => setShowUpgradeModal(false)}
            onUpgrade={handleUpgrade}
            isLoading={isPaymentLoading}
          />
        )}
      </>
    );
  }

  // User has exhausted free usage
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Free Limit Reached</CardTitle>
            <CardDescription>
              You've used all {limit} free {featureNames[featureType].toLowerCase()} sessions this month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PricingTiers onSelect={handleUpgrade} isLoading={isPaymentLoading} compact />

            {!user && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sign in to upgrade to Premium
                </p>
                <Button
                  onClick={() => window.location.href = '/admin/login'}
                  variant="outline"
                  className="w-full"
                >
                  Sign In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

interface PricingTiersProps {
  onSelect: (planTier: PlanTier) => void;
  isLoading: boolean;
  compact?: boolean;
}

function PricingTiers({ onSelect, isLoading, compact = false }: PricingTiersProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('biannual');

  return (
    <div className="space-y-3">
      {PLAN_TIERS.map((plan) => (
        <motion.div
          key={plan.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedPlan(plan.id)}
          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
            selectedPlan === plan.id
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {plan.popular && (
            <Badge className="absolute -top-2 right-4 bg-gradient-to-r from-amber-500 to-orange-500">
              Most Popular
            </Badge>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === plan.id ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}>
                {selectedPlan === plan.id && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <div>
                <p className="font-semibold">{plan.name}</p>
                {plan.savings && (
                  <p className="text-xs text-green-600 dark:text-green-400">{plan.savings}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-primary">₦{plan.price.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{plan.durationLabel}</p>
            </div>
          </div>
        </motion.div>
      ))}

      <Button
        onClick={() => onSelect(selectedPlan)}
        disabled={isLoading}
        className="w-full bg-gradient-primary mt-4"
        size="lg"
      >
        <Crown className="w-4 h-4 mr-2" />
        {isLoading ? 'Processing...' : `Upgrade for ₦${PLAN_TIERS.find(p => p.id === selectedPlan)?.price.toLocaleString()}`}
      </Button>

      {!compact && (
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Unlimited Calculator usage
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Unlimited Invoice generation
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Unlimited AI Chat sessions
          </li>
        </ul>
      )}
    </div>
  );
}

interface UpgradeModalProps {
  featureName: string;
  onClose: () => void;
  onUpgrade: (planTier: PlanTier) => void;
  isLoading: boolean;
}

function UpgradeModal({ featureName, onClose, onUpgrade, isLoading }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-primary p-6 text-primary-foreground relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-primary-foreground/80 hover:text-primary-foreground"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Crown className="w-10 h-10" />
            <div>
              <h2 className="text-xl font-bold">Go Premium</h2>
              <p className="text-sm opacity-90">Choose your plan</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <PricingTiers onSelect={onUpgrade} isLoading={isLoading} />

          <Button variant="ghost" onClick={onClose} className="w-full mt-2">
            Maybe Later
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export { PricingTiers };
