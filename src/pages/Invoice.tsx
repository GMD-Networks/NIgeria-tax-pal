import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Trash2, Download, Building2, Upload, X, CreditCard, FileText, Palette, PenLine, History, Share2, MessageCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { generateQRCodeDataURL, generatePaymentQRData } from '@/utils/qrcode';
import { downloadPDF } from '@/utils/nativeDownload';
import { UsageLimitGate } from '@/components/subscription/UsageLimitGate';
import { useFeatureUsage } from '@/hooks/useFeatureUsage';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { InvoiceHistory } from '@/components/invoice/InvoiceHistory';
import { InvoiceTemplates } from '@/components/invoice/InvoiceTemplates';
import { SignatureCanvas } from '@/components/invoice/SignatureCanvas';
import { SavedClients } from '@/components/invoice/SavedClients';
import { useDefaultBusinessDetails } from '@/hooks/useDefaultBusinessDetails';
import { api as backendApi } from '@/services/api';
import { WhatsAppShareButton } from '@/components/invoice/WhatsAppShareButton';
import { CurrencySelector } from '@/components/invoice/CurrencySelector';
import { formatCurrencyAmount } from '@/utils/currencyExchange';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface PaymentDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode: string;
}

interface InvoiceData {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes: string;
  paymentDetails: PaymentDetails;
  signature: string;
  signatureImage: string | null;
  tableColor: string;
}

interface EditableInvoiceItem {
  id?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
}

interface EditableInvoice {
  id: string;
  items: EditableInvoiceItem[];
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  client_name?: string | null;
  client_address?: string | null;
  client_email?: string | null;
  invoice_number: string;
  created_at: string;
  notes?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  sort_code?: string | null;
  logo_url?: string | null;
}

const VAT_RATE = 0.075; // 7.5% VAT

const Invoice = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { defaults, isLoaded: defaultsLoaded, saveDefaults } = useDefaultBusinessDetails();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [currency, setCurrency] = useState('NGN');
  const [activeTab, setActiveTab] = useState('create');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [lastGeneratedPDF, setLastGeneratedPDF] = useState<{ doc: jsPDF; filename: string } | null>(null);
  const { 
    canUse, 
    currentUsage, 
    limit, 
    isUnlimited, 
    isLoading,
    incrementUsage 
  } = useFeatureUsage('invoice');
  
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    businessEmail: '',
    clientName: '',
    clientAddress: '',
    clientEmail: '',
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
    notes: '',
    paymentDetails: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      sortCode: '',
    },
    signature: '',
    signatureImage: null,
    tableColor: '#228B22',
  });

  // Load defaults when they're ready
  useEffect(() => {
    if (defaultsLoaded && defaults.business_name && !editingInvoiceId) {
      setInvoiceData(prev => ({
        ...prev,
        businessName: prev.businessName || defaults.business_name,
        businessAddress: prev.businessAddress || defaults.business_address,
        businessPhone: prev.businessPhone || defaults.business_phone,
        businessEmail: prev.businessEmail || defaults.business_email,
        paymentDetails: {
          bankName: prev.paymentDetails.bankName || defaults.bank_name,
          accountName: prev.paymentDetails.accountName || defaults.account_name,
          accountNumber: prev.paymentDetails.accountNumber || defaults.account_number,
          sortCode: prev.paymentDetails.sortCode || defaults.sort_code,
        },
        tableColor: defaults.table_color || prev.tableColor,
        signature: prev.signature || defaults.signature_text,
        signatureImage: prev.signatureImage || defaults.signature_image,
      }));
      if (defaults.logo_url && !logo) {
        setLogo(defaults.logo_url);
      }
    }
  }, [
    defaultsLoaded,
    defaults.account_name,
    defaults.account_number,
    defaults.bank_name,
    defaults.business_address,
    defaults.business_email,
    defaults.business_name,
    defaults.business_phone,
    defaults.logo_url,
    defaults.signature_image,
    defaults.signature_text,
    defaults.sort_code,
    defaults.table_color,
    editingInvoiceId,
    logo,
  ]);

  const handleEditInvoice = (invoice: EditableInvoice) => {
    // Load the invoice data into the form
    const items = Array.isArray(invoice.items) 
      ? invoice.items.map((item: EditableInvoiceItem, index: number) => ({
          id: item.id || String(index + 1),
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || item.unit_price || 0,
        }))
      : [{ id: '1', description: '', quantity: 1, unitPrice: 0 }];

    setInvoiceData({
      businessName: invoice.company_name || '',
      businessAddress: invoice.company_address || '',
      businessPhone: invoice.company_phone || '',
      businessEmail: invoice.company_email || '',
      clientName: invoice.client_name || '',
      clientAddress: invoice.client_address || '',
      clientEmail: invoice.client_email || '',
      invoiceNumber: invoice.invoice_number,
      invoiceDate: new Date(invoice.created_at).toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items,
      notes: invoice.notes || '',
      paymentDetails: {
        bankName: invoice.bank_name || '',
        accountName: invoice.account_name || '',
        accountNumber: invoice.account_number || '',
        sortCode: invoice.sort_code || '',
      },
      signature: '',
      signatureImage: null,
      tableColor: '#228B22',
    });

    if (invoice.logo_url) {
      setLogo(invoice.logo_url);
    }

    setEditingInvoiceId(invoice.id);
    setActiveTab('create');
    toast.success('Invoice loaded for editing');
  };

  const colorOptions = [
    { name: 'Green', value: '#228B22' },
    { name: 'Blue', value: '#1E40AF' },
    { name: 'Purple', value: '#7C3AED' },
    { name: 'Red', value: '#DC2626' },
    { name: 'Orange', value: '#EA580C' },
    { name: 'Teal', value: '#0D9488' },
    { name: 'Navy', value: '#1E3A5F' },
    { name: 'Black', value: '#1F2937' },
  ];

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [34, 139, 34];
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }],
    }));
  };

  const removeItem = (id: string) => {
    if (invoiceData.items.length === 1) return;
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyAmount(amount, currency);
  };

  const calculateSubtotal = () => {
    return invoiceData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const calculateVAT = () => {
    return calculateSubtotal() * VAT_RATE;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateVAT();
  };

  const generatePDFDocument = async (data: InvoiceData, logoData: string | null = null): Promise<jsPDF> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = 25;

    const primaryColor: [number, number, number] = hexToRgb(data.tableColor || '#228B22');
    const grayColor: [number, number, number] = [100, 100, 100];
    const blackColor: [number, number, number] = [0, 0, 0];
    const whiteColor: [number, number, number] = [255, 255, 255];

    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', margin, yPos - 5, 30, 30);
      } catch (error) {
        console.error('Error adding logo:', error);
      }
    }

    doc.setFontSize(32);
    doc.setTextColor(...primaryColor);
    doc.text('INVOICE', pageWidth - margin, yPos, { align: 'right' });

    yPos += 8;
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text(`Invoice #: ${data.invoiceNumber}`, pageWidth - margin, yPos + 5, { align: 'right' });
    doc.text(`Date: ${data.invoiceDate}`, pageWidth - margin, yPos + 10, { align: 'right' });
    doc.text(`Due: ${data.dueDate}`, pageWidth - margin, yPos + 15, { align: 'right' });

    const businessStartX = logoData ? margin + 35 : margin;
    doc.setFontSize(14);
    doc.setTextColor(...blackColor);
    doc.setFont('helvetica', 'bold');
    doc.text(data.businessName, businessStartX, 25);
    doc.setFont('helvetica', 'normal');
    
    let businessY = 32;
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    if (data.businessAddress) {
      doc.text(data.businessAddress, businessStartX, businessY);
      businessY += 5;
    }
    if (data.businessPhone) {
      doc.text(`Tel: ${data.businessPhone}`, businessStartX, businessY);
      businessY += 5;
    }
    if (data.businessEmail) {
      doc.text(`Email: ${data.businessEmail}`, businessStartX, businessY);
    }

    yPos = Math.max(60, logoData ? 65 : 55);

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 12;

    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('BILL TO:', margin, yPos);
    yPos += 6;
    
    doc.setFontSize(12);
    doc.setTextColor(...blackColor);
    doc.setFont('helvetica', 'bold');
    doc.text(data.clientName, margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    if (data.clientAddress) {
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      const addressLines = doc.splitTextToSize(data.clientAddress, 100);
      addressLines.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 4;
      });
    }

    yPos += 12;

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

    doc.setTextColor(...blackColor);
    doc.setFontSize(9);
    data.items.forEach((item, index) => {
      const amount = item.quantity * item.unitPrice;
      
      if (index % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, yPos - 5, tableWidth, 10, 'F');
      }
      
      const desc = item.description.length > 40 ? item.description.substring(0, 37) + '...' : item.description;
      doc.text(desc, col1X + 5, yPos);
      doc.text(item.quantity.toString(), col2X, yPos);
      doc.text('N' + item.unitPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 }), col3X, yPos);
      doc.text('N' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }), col4X - 5, yPos, { align: 'right' });
      
      yPos += 10;
    });

    yPos += 8;

    const totalsX = pageWidth - 90;
    doc.setDrawColor(220, 220, 220);
    doc.line(totalsX, yPos, pageWidth - margin, yPos);
    yPos += 10;

    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vat = subtotal * VAT_RATE;
    const total = subtotal + vat;

    doc.setFontSize(10);
    doc.setTextColor(...blackColor);
    doc.text('Subtotal:', totalsX, yPos);
    doc.text('N' + subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
    
    yPos += 8;
    doc.text('VAT (7.5%):', totalsX, yPos);
    doc.text('N' + vat.toLocaleString('en-NG', { minimumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
    
    yPos += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('TOTAL:', totalsX, yPos);
    doc.text('N' + total.toLocaleString('en-NG', { minimumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    yPos += 20;

    const { paymentDetails } = data;
    if (paymentDetails.bankName || paymentDetails.accountNumber) {
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
      
      if (paymentDetails.bankName) {
        doc.text('Bank: ' + paymentDetails.bankName, margin + 8, paymentY);
        paymentY += 6;
      }
      if (paymentDetails.accountName) {
        doc.text('Account Name: ' + paymentDetails.accountName, margin + 8, paymentY);
        paymentY += 6;
      }
      if (paymentDetails.accountNumber) {
        doc.text('Account Number: ' + paymentDetails.accountNumber, margin + 8, paymentY);
        paymentY += 6;
      }
      if (paymentDetails.sortCode) {
        doc.text('Sort Code: ' + paymentDetails.sortCode, margin + 8, paymentY);
      }

      const qrSize = 30;
      const qrX = pageWidth - margin - qrSize - 8;
      const qrY = yPos + 6;
      
      const qrData = generatePaymentQRData({
        bankName: paymentDetails.bankName,
        accountName: paymentDetails.accountName,
        accountNumber: paymentDetails.accountNumber,
        amount: total,
      });
      
      const qrCodeUrl = await generateQRCodeDataURL(qrData);
      
      if (qrCodeUrl) {
        try {
          doc.addImage(qrCodeUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        } catch (error) {
          console.error('Error adding QR code:', error);
        }
      }
      
      doc.setFontSize(7);
      doc.setTextColor(...grayColor);
      doc.text('Scan to view', qrX + qrSize / 2, yPos + 40, { align: 'center' });
      doc.text('payment details', qrX + qrSize / 2, yPos + 43, { align: 'center' });

      yPos += 52;
    }

    if (data.notes) {
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text('Notes:', margin, yPos);
      yPos += 5;
      doc.setTextColor(...blackColor);
      const noteLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
      noteLines.slice(0, 3).forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 4;
      });
      yPos += 8;
    }

    // Add signature - either drawn image or typed text
    if (data.signatureImage) {
      yPos += 10;
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text('Authorized Signature:', margin, yPos);
      yPos += 5;
      
      try {
        doc.addImage(data.signatureImage, 'PNG', margin, yPos, 60, 25);
        yPos += 30;
      } catch (error) {
        console.error('Error adding signature image:', error);
      }
      
      doc.setDrawColor(...grayColor);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, margin + 60, yPos);
    } else if (data.signature) {
      yPos += 10;
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text('Authorized Signature:', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...primaryColor);
      doc.text(data.signature, margin, yPos);
      
      yPos += 5;
      doc.setDrawColor(...grayColor);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, margin + 60, yPos);
      
      doc.setFont('helvetica', 'normal');
    }

    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text('Generated by Nigeria Tax Companion', pageWidth / 2, pageHeight - 10, { align: 'center' });

    return doc;
  };

  const generatePDF = async () => {
    if (!invoiceData.businessName || !invoiceData.clientName) {
      toast.error('Please fill in business and client names');
      return;
    }

    if (invoiceData.items.some(item => !item.description || item.unitPrice <= 0)) {
      toast.error('Please fill in all item details');
      return;
    }

    // Track usage when generating invoice
    if (user) {
      const success = await incrementUsage();
      if (!success && !isUnlimited) {
        toast.error('You have reached your free usage limit. Please upgrade to continue.');
        return;
      }
    }

    const doc = await generatePDFDocument(invoiceData, logo);
    const downloaded = await downloadPDF(doc, `${invoiceData.invoiceNumber}.pdf`);
    
    // Store for sharing
    setLastGeneratedPDF({ doc, filename: `${invoiceData.invoiceNumber}.pdf` });
    
    if (!downloaded) {
      return;
    }
    
    // Save or update invoice in database for premium users
    if (user && isPremium) {
      try {
        const subtotal = calculateSubtotal();
        const vatAmount = calculateVAT();
        const total = calculateTotal();
        
        const invoiceRecord = {
          user_id: user.id,
          invoice_number: invoiceData.invoiceNumber,
          company_name: invoiceData.businessName,
          company_address: invoiceData.businessAddress,
          company_phone: invoiceData.businessPhone,
          company_email: invoiceData.businessEmail,
          client_name: invoiceData.clientName,
          client_address: invoiceData.clientAddress,
          client_email: invoiceData.clientEmail,
          items: invoiceData.items as unknown as Record<string, unknown>[],
          subtotal,
          vat_amount: vatAmount,
          total,
          notes: invoiceData.notes,
          bank_name: invoiceData.paymentDetails.bankName,
          account_name: invoiceData.paymentDetails.accountName,
          account_number: invoiceData.paymentDetails.accountNumber,
          sort_code: invoiceData.paymentDetails.sortCode,
          logo_url: logo,
        };

        if (editingInvoiceId) {
          // Update existing invoice
          await backendApi
            .from('invoices')
            .update(invoiceRecord)
            .eq('id', editingInvoiceId);
          setEditingInvoiceId(null);
        } else {
          // Insert new invoice
          await backendApi.from('invoices').insert([invoiceRecord]);
        }
      } catch (error) {
        console.error('Failed to save invoice:', error);
      }
    }
    
    setInvoiceData(prev => ({
      ...prev,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      clientName: '',
      clientAddress: '',
      clientEmail: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      notes: '',
    }));
    
    toast.success('Invoice downloaded!');
  };

  const shareInvoice = async () => {
    if (!lastGeneratedPDF) {
      toast.error('Please generate an invoice first');
      return;
    }

    try {
      const pdfBlob = lastGeneratedPDF.doc.output('blob');
      const file = new File([pdfBlob], lastGeneratedPDF.filename, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoiceData.invoiceNumber}`,
          text: `Invoice for ${invoiceData.clientName}`,
        });
        toast.success('Invoice shared!');
      } else if (navigator.share) {
        // Fallback: share without file
        await navigator.share({
          title: `Invoice ${invoiceData.invoiceNumber}`,
          text: `Invoice for ${invoiceData.clientName} - Total: ${formatCurrency(calculateTotal())}`,
        });
        toast.success('Invoice details shared!');
      } else {
        // Fallback: copy text to clipboard
        const shareText = `Invoice ${invoiceData.invoiceNumber} for ${invoiceData.clientName} - Total: ${formatCurrency(calculateTotal())}`;
        await navigator.clipboard.writeText(shareText);
        toast.success('Invoice details copied to clipboard!');
      }
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error('Share failed:', error);
        toast.error('Failed to share invoice');
      }
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
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold"
            >
              E-Invoice Generator
            </motion.h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create professional invoices with VAT
            </p>
            
            {isPremium && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create">
                    <FileText className="w-4 h-4 mr-2" />
                    Create
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History className="w-4 h-4 mr-2" />
                    History
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </header>

        {isPremium && activeTab === 'history' ? (
          <div className="px-4 py-6 pb-24">
            <div className="max-w-lg mx-auto">
              <InvoiceHistory onEdit={handleEditInvoice} />
            </div>
          </div>
        ) : (
        <UsageLimitGate
          featureType="invoice"
          currentUsage={currentUsage}
          limit={limit}
          isUnlimited={isUnlimited}
          canUse={canUse}
        >
          <div className="px-4 py-6 pb-24">
            <div className="max-w-lg mx-auto space-y-4">
            {/* Invoice Templates */}
            <InvoiceTemplates
              currentData={{
                businessName: invoiceData.businessName,
                businessAddress: invoiceData.businessAddress,
                businessPhone: invoiceData.businessPhone,
                businessEmail: invoiceData.businessEmail,
                clientName: invoiceData.clientName,
                clientAddress: invoiceData.clientAddress,
                clientEmail: invoiceData.clientEmail,
                notes: invoiceData.notes,
                paymentDetails: invoiceData.paymentDetails,
                tableColor: invoiceData.tableColor,
                signature: invoiceData.signature,
                signatureImage: invoiceData.signatureImage,
              }}
              currentLogo={logo}
              onLoadTemplate={(templateData, templateLogo) => {
                setInvoiceData(prev => ({
                  ...prev,
                  ...templateData,
                  paymentDetails: templateData.paymentDetails || prev.paymentDetails,
                  signature: templateData.signature || prev.signature,
                  signatureImage: templateData.signatureImage !== undefined ? templateData.signatureImage : prev.signatureImage,
                }));
                if (templateLogo) {
                  setLogo(templateLogo);
                }
              }}
            />

            {/* Logo Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Company Logo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logo ? (
                  <div className="relative inline-block">
                    <img src={logo} alt="Company logo" className="h-20 w-auto rounded-lg border" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={removeLogo}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label htmlFor="logo-upload">
                      <Button variant="outline" className="cursor-pointer" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Logo
                        </span>
                      </Button>
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">Max 2MB, PNG or JPG</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Business Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Your Business
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Business Name *</Label>
                  <Input
                    value={invoiceData.businessName}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, businessName: e.target.value }))}
                    placeholder="Your Company Ltd"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={invoiceData.businessAddress}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, businessAddress: e.target.value }))}
                    placeholder="123 Business Street, Lagos"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={invoiceData.businessPhone}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, businessPhone: e.target.value }))}
                      placeholder="+234 800 000 0000"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={invoiceData.businessEmail}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, businessEmail: e.target.value }))}
                      placeholder="info@company.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save as Default */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => saveDefaults({
                business_name: invoiceData.businessName,
                business_address: invoiceData.businessAddress,
                business_phone: invoiceData.businessPhone,
                business_email: invoiceData.businessEmail,
                bank_name: invoiceData.paymentDetails.bankName,
                account_name: invoiceData.paymentDetails.accountName,
                account_number: invoiceData.paymentDetails.accountNumber,
                sort_code: invoiceData.paymentDetails.sortCode,
                logo_url: logo,
                table_color: invoiceData.tableColor,
                signature_text: invoiceData.signature,
                signature_image: invoiceData.signatureImage,
              })}
            >
              💾 Save Business Details as Default
            </Button>

            {/* Client Details */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Client Details</CardTitle>
                  <SavedClients 
                    currentClient={{ name: invoiceData.clientName, address: invoiceData.clientAddress, email: invoiceData.clientEmail }}
                    onSelectClient={(client) => {
                      setInvoiceData(prev => ({
                        ...prev,
                        clientName: client.name,
                        clientAddress: client.address,
                        clientEmail: client.email,
                      }));
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Client Name *</Label>
                  <Input
                    value={invoiceData.clientName}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="Client Company"
                  />
                </div>
                <div>
                  <Label>Client Address</Label>
                  <Input
                    value={invoiceData.clientAddress}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, clientAddress: e.target.value }))}
                    placeholder="456 Client Street"
                  />
                </div>
                <div>
                  <Label>Client Email</Label>
                  <Input
                    type="email"
                    value={invoiceData.clientEmail}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, clientEmail: e.target.value }))}
                    placeholder="client@company.com"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Invoice Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Invoice #</Label>
                    <Input
                      value={invoiceData.invoiceNumber}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      disabled={!!editingInvoiceId}
                      className={editingInvoiceId ? 'bg-muted cursor-not-allowed' : ''}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={invoiceData.invoiceDate}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={invoiceData.dueDate}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoiceData.items.map((item) => (
                  <div key={item.id} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        />
                        <Input
                          type="number"
                          placeholder="Unit Price"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      disabled={invoiceData.items.length === 1}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Bank Name</Label>
                    <Input
                      value={invoiceData.paymentDetails.bankName}
                      onChange={(e) => setInvoiceData(prev => ({
                        ...prev,
                        paymentDetails: { ...prev.paymentDetails, bankName: e.target.value }
                      }))}
                      placeholder="First Bank"
                    />
                  </div>
                  <div>
                    <Label>Account Name</Label>
                    <Input
                      value={invoiceData.paymentDetails.accountName}
                      onChange={(e) => setInvoiceData(prev => ({
                        ...prev,
                        paymentDetails: { ...prev.paymentDetails, accountName: e.target.value }
                      }))}
                      placeholder="Company Name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Account Number</Label>
                    <Input
                      value={invoiceData.paymentDetails.accountNumber}
                      onChange={(e) => setInvoiceData(prev => ({
                        ...prev,
                        paymentDetails: { ...prev.paymentDetails, accountNumber: e.target.value }
                      }))}
                      placeholder="0123456789"
                    />
                  </div>
                  <div>
                    <Label>Sort Code</Label>
                    <Input
                      value={invoiceData.paymentDetails.sortCode}
                      onChange={(e) => setInvoiceData(prev => ({
                        ...prev,
                        paymentDetails: { ...prev.paymentDetails, sortCode: e.target.value }
                      }))}
                      placeholder="011"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={invoiceData.notes}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Payment terms, thank you message, etc."
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Signature */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-primary" />
                  Signature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SignatureCanvas
                  signature={invoiceData.signature}
                  signatureImage={invoiceData.signatureImage}
                  onSignatureChange={(sig) => setInvoiceData(prev => ({ ...prev, signature: sig }))}
                  onSignatureImageChange={(img) => setInvoiceData(prev => ({ ...prev, signatureImage: img }))}
                  tableColor={invoiceData.tableColor}
                />
              </CardContent>
            </Card>

            {/* Table Color */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  Invoice Style
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Table Header Color</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setInvoiceData(prev => ({ ...prev, tableColor: color.value }))}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          invoiceData.tableColor === color.value
                            ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected: {colorOptions.find(c => c.value === invoiceData.tableColor)?.name || 'Custom'}
                  </p>
                </div>
                <div>
                  <Label>Or enter custom color</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={invoiceData.tableColor}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, tableColor: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={invoiceData.tableColor}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, tableColor: e.target.value }))}
                      placeholder="#228B22"
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VAT (7.5%)</span>
                  <span>{formatCurrency(calculateVAT())}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              </CardContent>
            </Card>

            {/* Currency & Generate Buttons */}
            <div className="flex items-center gap-3 mb-3">
              <Label className="text-sm shrink-0">Currency:</Label>
              <CurrencySelector value={currency} onChange={setCurrency} />
            </div>
            <div className="flex gap-3">
              <Button 
                className="flex-1" 
                size="lg" 
                onClick={generatePDF}
              >
                <Download className="w-5 h-5 mr-2" />
                Generate & Download
              </Button>
              {lastGeneratedPDF && (
                <>
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={shareInvoice}
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                  <WhatsAppShareButton
                    invoiceNumber={invoiceData.invoiceNumber}
                    businessName={invoiceData.businessName}
                    clientName={invoiceData.clientName}
                    total={calculateTotal()}
                    dueDate={invoiceData.dueDate}
                    currency={currency}
                    paymentDetails={{
                      bankName: invoiceData.paymentDetails.bankName,
                      accountName: invoiceData.paymentDetails.accountName,
                      accountNumber: invoiceData.paymentDetails.accountNumber,
                    }}
                    size="lg"
                  />
                </>
              )}
            </div>
          </div>
        </div>
        </UsageLimitGate>
        )}
      </div>
    </AppLayout>
  );
};

export default Invoice;
