import { useNavigate } from 'react-router-dom';
import { User, LogIn, Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function UserMenu() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { isPremium } = useSubscription();

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/auth')}
        className="gap-2"
      >
        <LogIn className="w-4 h-4" />
        Sign In
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate('/profile')}
      className="gap-2"
    >
      <div className="relative">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </div>
        {isPremium && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
            <Crown className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
    </Button>
  );
}
