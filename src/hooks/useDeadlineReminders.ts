import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface TaxDeadline {
  title: string;
  dayOfMonth: number;
  recurring: 'monthly';
}

const MONTHLY_DEADLINES: TaxDeadline[] = [
  { title: 'PAYE Remittance', dayOfMonth: 10, recurring: 'monthly' },
  { title: 'VAT Returns Filing', dayOfMonth: 21, recurring: 'monthly' },
  { title: 'WHT Remittance', dayOfMonth: 21, recurring: 'monthly' },
];

const REMINDER_KEY = 'tax_deadline_reminders_shown';

export function useDeadlineReminders() {
  const checkDeadlines = useCallback(() => {
    const now = new Date();
    const today = now.getDate();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    
    const shown = JSON.parse(localStorage.getItem(REMINDER_KEY) || '{}');

    MONTHLY_DEADLINES.forEach(deadline => {
      const daysUntil = deadline.dayOfMonth - today;
      const reminderKey = `${monthKey}-${deadline.title}`;

      if (daysUntil >= 0 && daysUntil <= 3 && !shown[reminderKey]) {
        const message = daysUntil === 0
          ? `⚠️ ${deadline.title} is due TODAY!`
          : `📅 ${deadline.title} is due in ${daysUntil} day${daysUntil > 1 ? 's' : ''} (${deadline.dayOfMonth}th)`;

        toast.warning(message, { duration: 8000 });

        shown[reminderKey] = true;
        localStorage.setItem(REMINDER_KEY, JSON.stringify(shown));
      }
    });
  }, []);

  useEffect(() => {
    // Check on mount
    checkDeadlines();
    // Check every hour
    const interval = setInterval(checkDeadlines, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkDeadlines]);
}
