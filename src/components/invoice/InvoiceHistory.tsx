import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Calendar, Loader2, User, Edit, Share2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { api as backendApi } from '@/services/api';
import jsPDF from 'jspdf';
import { generateQRCodeDataURL, generatePaymentQRData } from '@/utils/qrcode';
import { downloadPDF } from '@/utils/nativeDownload';

interface SavedInvoice {
  id: string;
  invoice_number: string;
  client_name: string | null;
  company_name: string | null;
  subtotal: number;
  vat_amount: number;
  total: number;
  created_at: string;
  items: Array<{ description?: string; quantity?: number; unitPrice?: number; unit_price?: number }>;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  client_address: string | null;
  client_email: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  notes: string | null;
  logo_url: string | null;
}

interface InvoiceHistoryProps {
  onClose?: () => void;
  onEdit?: (invoice: SavedInvoice) => void;
}

const VAT_RATE = 0.075;

export function InvoiceHistory({ onClose, onEdit }: InvoiceHistoryProps) {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error } = await backendApi
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map database items to our interface format
      const invoiceRows = (data as SavedInvoice[] | null) || [];
      const mappedInvoices: SavedInvoice[] = invoiceRows.map((inv) => ({
        ...inv,
        items: Array.isArray(inv.items) ? inv.items : [],
      }));
      
      setInvoices(mappedInvoices);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      toast.error('Failed to load invoice history');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && isPremium) {
      fetchInvoices();
    } else {
      setIsLoading(false);
    }
  }, [user, isPremium, fetchInvoices]);

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [34, 139, 34];
  };

  const downloadInvoice = async (invoice: SavedInvoice) => {
    setDownloadingId(invoice.id);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = 25;

      const primaryColor: [number, number, number] = [34, 139, 34];
      const grayColor: [number, number, number] = [100, 100, 100];
      const blackColor: [number, number, number] = [0, 0, 0];
      const whiteColor: [number, number, number] = [255, 255, 255];

      // Header
      doc.setFontSize(32);
      doc.setTextColor(...primaryColor);
      doc.text('INVOICE', pageWidth - margin, yPos, { align: 'right' });

      yPos += 8;
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text(`Invoice #: ${invoice.invoice_number}`, pageWidth - margin, yPos + 5, { align: 'right' });
      doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, pageWidth - margin, yPos + 10, { align: 'right' });

      // Business Details
      doc.setFontSize(14);
      doc.setTextColor(...blackColor);
      doc.setFont('helvetica', 'bold');
      doc.text(invoice.company_name || 'Business Name', margin, 25);
      doc.setFont('helvetica', 'normal');
      
      let businessY = 32;
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      if (invoice.company_address) {
        doc.text(invoice.company_address, margin, businessY);
        businessY += 5;
      }
      if (invoice.company_phone) {
        doc.text(`Tel: ${invoice.company_phone}`, margin, businessY);
        businessY += 5;
      }
      if (invoice.company_email) {
        doc.text(`Email: ${invoice.company_email}`, margin, businessY);
      }

      yPos = 55;

      // Divider
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 12;

      // Bill To
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text('BILL TO:', margin, yPos);
      yPos += 6;
      
      doc.setFontSize(12);
      doc.setTextColor(...blackColor);
      doc.setFont('helvetica', 'bold');
      doc.text(invoice.client_name || 'Client', margin, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 5;
      
      if (invoice.client_address) {
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);
        const addressLines = doc.splitTextToSize(invoice.client_address, 100);
        addressLines.forEach((line: string) => {
          doc.text(line, margin, yPos);
          yPos += 4;
        });
      }

      yPos += 12;

      // Table
      const col1X = margin;
      const col2X = margin + 85;
      const col3X = margin + 105;
      const col4X = pageWidth - margin;
      const tableWidth = pageWidth - 2 * margin;

      doc.setFillColor(...primaryColor);
      doc.rect(margin, yPos, tableWidth, 10, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(...whiteColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Description', col1X + 5, yPos + 7);
      doc.text('Qty', col2X, yPos + 7);
      doc.text('Unit Price', col3X, yPos + 7);
      doc.text('Amount', col4X - 5, yPos + 7, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      
      yPos += 14;

      // Items
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      doc.setTextColor(...blackColor);
      doc.setFontSize(9);
      
      items.forEach((item, index: number) => {
        const amount = (item.quantity || 0) * (item.unitPrice || item.unit_price || 0);
        
        if (index % 2 === 0) {
          doc.setFillColor(248, 248, 248);
          doc.rect(margin, yPos - 5, tableWidth, 10, 'F');
        }
        
        const desc = (item.description || '').length > 40 
          ? item.description.substring(0, 37) + '...' 
          : item.description || '';
        doc.text(desc, col1X + 5, yPos);
        doc.text((item.quantity || 0).toString(), col2X, yPos);
        doc.text('N' + (item.unitPrice || item.unit_price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 }), col3X, yPos);
        doc.text('N' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }), col4X - 5, yPos, { align: 'right' });
        
        yPos += 10;
      });

      yPos += 8;

      // Totals
      const totalsX = pageWidth - 90;
      doc.setDrawColor(220, 220, 220);
      doc.line(totalsX, yPos, pageWidth - margin, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setTextColor(...blackColor);
      doc.text('Subtotal:', totalsX, yPos);
      doc.text('N' + invoice.subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
      
      yPos += 8;
      doc.text('VAT (7.5%):', totalsX, yPos);
      doc.text('N' + invoice.vat_amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
      
      yPos += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('TOTAL:', totalsX, yPos);
      doc.text('N' + invoice.total.toLocaleString('en-NG', { minimumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      yPos += 20;

      // Payment Details
      if (invoice.bank_name || invoice.account_number) {
        doc.setFillColor(248, 252, 248);
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.3);
        doc.rect(margin, yPos, tableWidth, 45, 'FD');
        
        doc.setFontSize(11);
        doc.setTextColor(...primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT DETAILS', margin + 8, yPos + 10);
        doc.setFont('helvetica', 'normal');
        
        doc.setFontSize(9);
        doc.setTextColor(...blackColor);
        let paymentY = yPos + 18;
        
        if (invoice.bank_name) {
          doc.text('Bank: ' + invoice.bank_name, margin + 8, paymentY);
          paymentY += 6;
        }
        if (invoice.account_name) {
          doc.text('Account Name: ' + invoice.account_name, margin + 8, paymentY);
          paymentY += 6;
        }
        if (invoice.account_number) {
          doc.text('Account Number: ' + invoice.account_number, margin + 8, paymentY);
          paymentY += 6;
        }
        if (invoice.sort_code) {
          doc.text('Sort Code: ' + invoice.sort_code, margin + 8, paymentY);
        }

        yPos += 52;
      }

      // Notes
      if (invoice.notes) {
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);
        doc.text('Notes:', margin, yPos);
        yPos += 5;
        doc.setTextColor(...blackColor);
        const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
        noteLines.slice(0, 3).forEach((line: string) => {
          doc.text(line, margin, yPos);
          yPos += 4;
        });
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text('Generated by Nigeria Tax Companion', pageWidth / 2, pageHeight - 10, { align: 'center' });

      await downloadPDF(doc, `${invoice.invoice_number}.pdf`);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isPremium) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Invoice History
          </CardTitle>
          <CardDescription>
            Upgrade to premium to access your invoice history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Premium subscribers can view and download all past invoices
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Invoice History
        </CardTitle>
        <CardDescription>
          View and download your past invoices
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No invoices found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Generated invoices will appear here
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <AnimatePresence>
              <div className="space-y-3">
                {invoices.map((invoice, index) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{invoice.invoice_number}</Badge>
                        </div>
                        <p className="font-medium flex items-center gap-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {invoice.client_name || 'Unknown Client'}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="font-semibold text-lg">
                          ₦{invoice.total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex gap-2">
                          {onEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEdit(invoice)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadInvoice(invoice)}
                            disabled={downloadingId === invoice.id}
                          >
                            {downloadingId === invoice.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const shareText = `Invoice ${invoice.invoice_number} for ${invoice.client_name} - Total: ₦${invoice.total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
                              if (navigator.share) {
                                await navigator.share({ title: invoice.invoice_number, text: shareText });
                              } else {
                                await navigator.clipboard.writeText(shareText);
                                toast.success('Copied to clipboard!');
                              }
                            }}
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
