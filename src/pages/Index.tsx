import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Wrench, MessageCircle, Receipt, AlertTriangle, ScanLine } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FeatureCard } from '@/components/home/FeatureCard';
import { TaxTip } from '@/components/home/TaxTip';
import { LanguageSelector } from '@/components/home/LanguageSelector';
import { UserMenu } from '@/components/layout/UserMenu';
import { useBranding } from '@/hooks/useBranding';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { branding } = useBranding();

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-gradient-primary px-4 pt-12 pb-8 safe-top">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <h1 className="text-xl font-bold text-primary-foreground">
                  {branding.app_name || t('app.name')}
                </h1>
                <p className="text-sm text-primary-foreground/80">
                  {branding.tagline || t('app.tagline')}
                </p>
              </motion.div>
              <div className="flex items-center gap-2">
                <LanguageSelector />
                <UserMenu />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="bg-card/10 backdrop-blur-sm rounded-2xl p-4"
            >
              <h2 className="text-2xl font-bold text-primary-foreground mb-1">
                {t('home.greeting')}
              </h2>
              <p className="text-primary-foreground/80">{t('home.subtitle')}</p>
            </motion.div>
          </div>
        </header>

        {/* Main Content */}
        <div className="px-4 -mt-4">
          <div className="max-w-lg mx-auto space-y-4">
            {/* Feature Cards */}
            <div className="grid grid-cols-2 gap-3">
              <FeatureCard
                title={t('home.features.learn.title')}
                description={t('home.features.learn.description')}
                icon={BookOpen}
                onClick={() => navigate('/learn')}
                variant="accent"
                delay={0.2}
              />
              <FeatureCard
                title={t('home.features.calculator.title')}
                description={t('home.features.calculator.description')}
                icon={Wrench}
                onClick={() => navigate('/tax-tools')}
                variant="accent"
                delay={0.25}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FeatureCard
                title={t('home.features.chat.title')}
                description={t('home.features.chat.description')}
                icon={MessageCircle}
                onClick={() => navigate('/chat')}
                variant="primary"
                delay={0.3}
              />
              <FeatureCard
                title="Invoice"
                description="Create professional invoices"
                icon={Receipt}
                onClick={() => navigate('/invoice')}
                variant="secondary"
                delay={0.35}
              />
            </div>

            {/* New Receipt Scanner Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              onClick={() => navigate('/document-scanner')}
              className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <ScanLine className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Document Scanner
                </h3>
                <p className="text-sm text-muted-foreground">
                  Scan documents & convert to PDF/Word
                </p>
              </div>
            </motion.div>

            {/* Tax Tip */}
            <TaxTip />

            {/* Disclaimer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-xl"
            >
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('home.disclaimer')}
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
