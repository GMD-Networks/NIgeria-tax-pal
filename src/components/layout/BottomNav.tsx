import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Wrench, Receipt, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { key: 'home', path: '/', icon: Home },
  { key: 'learn', path: '/learn', icon: BookOpen },
  { key: 'tax', path: '/tax-tools', icon: Wrench },
  { key: 'invoice', path: '/invoice', icon: Receipt },
  { key: 'chat', path: '/chat', icon: MessageCircle },
];

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className={cn(
                'relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <Icon
                className={cn(
                  'w-5 h-5 mb-1 relative z-10 transition-transform duration-200',
                  isActive && 'scale-110'
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  'text-xs font-medium relative z-10',
                  isActive && 'font-semibold'
                )}
              >
                {t(`nav.${item.key}`)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
