import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shareInvoiceViaWhatsApp } from '@/utils/whatsappShare';

interface WhatsAppShareButtonProps {
  invoiceNumber: string;
  businessName: string;
  clientName: string;
  total: number;
  dueDate: string;
  currency?: string;
  paymentDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  };
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon' | 'lg';
}

export function WhatsAppShareButton({
  invoiceNumber,
  businessName,
  clientName,
  total,
  dueDate,
  currency,
  paymentDetails,
  variant = 'outline',
  size = 'sm',
}: WhatsAppShareButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() =>
        shareInvoiceViaWhatsApp({
          invoiceNumber,
          businessName,
          clientName,
          total,
          dueDate,
          currency,
          paymentDetails,
        })
      }
      className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
    >
      <MessageCircle className="w-4 h-4" />
      {size !== 'icon' && 'WhatsApp'}
    </Button>
  );
}
