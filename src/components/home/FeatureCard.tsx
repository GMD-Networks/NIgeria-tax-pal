import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
  delay?: number;
}

const variants = {
  primary: 'bg-gradient-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  accent: 'bg-card border border-border hover:border-primary/30',
};

export function FeatureCard({
  title,
  description,
  icon: Icon,
  onClick,
  variant = 'accent',
  delay = 0,
}: FeatureCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative w-full p-4 rounded-2xl text-left transition-all duration-300',
        'shadow-sm hover:shadow-md',
        variants[variant]
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl',
            variant === 'accent'
              ? 'bg-primary/10 text-primary'
              : 'bg-white/20 text-current'
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              'font-semibold text-base mb-0.5',
              variant === 'accent' ? 'text-foreground' : 'text-current'
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              'text-sm leading-snug',
              variant === 'accent'
                ? 'text-muted-foreground'
                : 'text-current/80'
            )}
          >
            {description}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
