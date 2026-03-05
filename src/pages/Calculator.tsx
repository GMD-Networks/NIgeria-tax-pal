import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, FileText, Percent } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PAYECalculator } from '@/components/calculator/PAYECalculator';
import { WHTCalculator } from '@/components/calculator/WHTCalculator';
import { VATCalculator } from '@/components/calculator/VATCalculator';
import { UsageLimitGate } from '@/components/subscription/UsageLimitGate';
import { useFeatureUsage } from '@/hooks/useFeatureUsage';
import { useAuth } from '@/hooks/useAuth';

const Calculator = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'paye');
  const { 
    canUse, 
    currentUsage, 
    limit, 
    isUnlimited, 
    isLoading,
    incrementUsage 
  } = useFeatureUsage('calculator');
  const [hasTrackedUsage, setHasTrackedUsage] = useState(false);

  // Track usage when user performs a calculation
  const handleCalculation = async () => {
    if (!hasTrackedUsage && user) {
      await incrementUsage();
      setHasTrackedUsage(true);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold mb-4"
            >
              {t('calculator.title')}
            </motion.h1>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full h-12 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger
                  value="paye"
                  className="flex-1 h-10 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm"
                >
                  <Wallet className="w-4 h-4 mr-1 sm:mr-2" />
                  PAYE
                </TabsTrigger>
                <TabsTrigger
                  value="wht"
                  className="flex-1 h-10 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm"
                >
                  <FileText className="w-4 h-4 mr-1 sm:mr-2" />
                  WHT
                </TabsTrigger>
                <TabsTrigger
                  value="vat"
                  className="flex-1 h-10 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm"
                >
                  <Percent className="w-4 h-4 mr-1 sm:mr-2" />
                  VAT
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>

        {/* Calculator Content with Usage Gate */}
        <UsageLimitGate
          featureType="calculator"
          currentUsage={currentUsage}
          limit={limit}
          isUnlimited={isUnlimited}
          canUse={canUse}
        >
          <div className="px-4 py-6">
            <div className="max-w-lg mx-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="paye" className="mt-0">
                  <PAYECalculator onCalculate={handleCalculation} />
                </TabsContent>
                <TabsContent value="wht" className="mt-0">
                  <WHTCalculator onCalculate={handleCalculation} />
                </TabsContent>
                <TabsContent value="vat" className="mt-0">
                  <VATCalculator onCalculate={handleCalculation} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </UsageLimitGate>
      </div>
    </AppLayout>
  );
};

export default Calculator;
