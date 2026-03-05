import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, FolderOpen, Trash2, Plus, Files } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { api as backendApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface InvoiceTemplate {
  id: string;
  template_name: string;
  client_name: string | null;
  client_address: string | null;
  client_email: string | null;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  notes: string | null;
  table_color: string | null;
  signature_text: string | null;
  signature_image: string | null;
  logo_url: string | null;
  created_at: string;
}

interface InvoiceData {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  notes: string;
  paymentDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    sortCode: string;
  };
  tableColor: string;
  signature?: string;
  signatureImage?: string | null;
  logo?: string | null;
}

interface InvoiceTemplatesProps {
  currentData: InvoiceData;
  currentLogo: string | null;
  onLoadTemplate: (data: Partial<InvoiceData>, logo: string | null) => void;
}

export const InvoiceTemplates = ({ currentData, currentLogo, onLoadTemplate }: InvoiceTemplatesProps) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await backendApi
        .from('invoice_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data as InvoiceTemplate[] | null) || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user, fetchTemplates]);

  const saveTemplate = async () => {
    if (!user || !templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      const { error } = await backendApi.from('invoice_templates').insert({
        user_id: user.id,
        template_name: templateName.trim(),
        client_name: currentData.clientName || null,
        client_address: currentData.clientAddress || null,
        client_email: currentData.clientEmail || null,
        business_name: currentData.businessName || null,
        business_address: currentData.businessAddress || null,
        business_phone: currentData.businessPhone || null,
        business_email: currentData.businessEmail || null,
        bank_name: currentData.paymentDetails.bankName || null,
        account_name: currentData.paymentDetails.accountName || null,
        account_number: currentData.paymentDetails.accountNumber || null,
        sort_code: currentData.paymentDetails.sortCode || null,
        notes: currentData.notes || null,
        table_color: currentData.tableColor || '#228B22',
        signature_text: currentData.signature || null,
        signature_image: currentData.signatureImage || null,
        logo_url: currentLogo || null,
      });

      if (error) throw error;

      toast.success('Template saved successfully');
      setTemplateName('');
      setSaveDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const loadTemplate = (template: InvoiceTemplate) => {
    onLoadTemplate({
      businessName: template.business_name || '',
      businessAddress: template.business_address || '',
      businessPhone: template.business_phone || '',
      businessEmail: template.business_email || '',
      clientName: template.client_name || '',
      clientAddress: template.client_address || '',
      clientEmail: template.client_email || '',
      notes: template.notes || '',
      paymentDetails: {
        bankName: template.bank_name || '',
        accountName: template.account_name || '',
        accountNumber: template.account_number || '',
        sortCode: template.sort_code || '',
      },
      tableColor: template.table_color || '#228B22',
      signature: template.signature_text || '',
      signatureImage: template.signature_image || null,
    }, template.logo_url || null);
    setLoadDialogOpen(false);
    toast.success(`Loaded template: ${template.template_name}`);
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await backendApi
        .from('invoice_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Files className="w-5 h-5 text-primary" />
          Invoice Templates
        </CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        {/* Save Template Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save as Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Invoice Template</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Template name (e.g., ABC Company)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Saves current business, client, and payment details for reuse.
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={saveTemplate}>Save Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Load Template Dialog */}
        <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <FolderOpen className="w-4 h-4 mr-2" />
              Load Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Load Invoice Template</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Files className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No saved templates yet</p>
                  <p className="text-sm">Save your first template above</p>
                </div>
              ) : (
                <AnimatePresence>
                  {templates.map((template) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => loadTemplate(template)}
                      >
                        <p className="font-medium">{template.template_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {template.client_name || 'No client'} • {template.business_name || 'No business'}
                        </p>
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0 ml-2">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{template.template_name}". This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTemplate(template.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
