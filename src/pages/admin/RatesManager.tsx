import { useEffect, useState } from 'react';
import { api as backendApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface TaxRate {
  id: string;
  tax_type: string;
  name: string;
  description: string | null;
  rate: number;
  min_amount: number | null;
  max_amount: number | null;
  effective_date: string;
  is_active: boolean | null;
}

const emptyRate: Omit<TaxRate, 'id'> = {
  tax_type: 'paye',
  name: '',
  description: '',
  rate: 0,
  min_amount: null,
  max_amount: null,
  effective_date: new Date().toISOString().split('T')[0],
  is_active: true,
};

const taxTypes = [
  { value: 'paye', label: 'PAYE (Pay As You Earn)' },
  { value: 'wht', label: 'WHT (Withholding Tax)' },
  { value: 'vat', label: 'VAT (Value Added Tax)' },
  { value: 'cit', label: 'CIT (Company Income Tax)' },
  { value: 'cgt', label: 'CGT (Capital Gains Tax)' },
];

export default function RatesManager() {
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [formData, setFormData] = useState<Omit<TaxRate, 'id'>>(emptyRate);
  const [isSaving, setIsSaving] = useState(false);

  const fetchRates = async () => {
    try {
      const { data, error } = await backendApi
        .from('tax_rates')
        .select('*')
        .order('tax_type', { ascending: true })
        .order('min_amount', { ascending: true });

      if (error) throw error;
      setRates((data as TaxRate[] | null) || []);
    } catch (error) {
      console.error('Error fetching rates:', error);
      toast.error('Failed to load rates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingRate) {
        const { error } = await backendApi
          .from('tax_rates')
          .update(formData)
          .eq('id', editingRate.id);

        if (error) throw error;
        toast.success('Rate updated successfully');
      } else {
        const { error } = await backendApi
          .from('tax_rates')
          .insert([formData]);

        if (error) throw error;
        toast.success('Rate created successfully');
      }

      setIsDialogOpen(false);
      setEditingRate(null);
      setFormData(emptyRate);
      fetchRates();
    } catch (error) {
      console.error('Error saving rate:', error);
      toast.error('Failed to save rate');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (rate: TaxRate) => {
    setEditingRate(rate);
    setFormData({
      tax_type: rate.tax_type,
      name: rate.name,
      description: rate.description,
      rate: rate.rate,
      min_amount: rate.min_amount,
      max_amount: rate.max_amount,
      effective_date: rate.effective_date,
      is_active: rate.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rate?')) return;

    try {
      const { error } = await backendApi
        .from('tax_rates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Rate deleted successfully');
      fetchRates();
    } catch (error) {
      console.error('Error deleting rate:', error);
      toast.error('Failed to delete rate');
    }
  };

  const openNewDialog = () => {
    setEditingRate(null);
    setFormData(emptyRate);
    setIsDialogOpen(true);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tax Rates</h1>
          <p className="text-muted-foreground">Manage Nigerian tax rates and brackets</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Rate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRate ? 'Edit Tax Rate' : 'Add New Tax Rate'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tax_type">Tax Type</Label>
                <Select
                  value={formData.tax_type}
                  onValueChange={(value) => setFormData({ ...formData, tax_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tax type" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., First ₦300,000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate (%)</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_amount">Min Amount (₦)</Label>
                  <Input
                    id="min_amount"
                    type="number"
                    value={formData.min_amount || ''}
                    onChange={(e) => setFormData({ ...formData, min_amount: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_amount">Max Amount (₦)</Label>
                  <Input
                    id="max_amount"
                    type="number"
                    value={formData.max_amount || ''}
                    onChange={(e) => setFormData({ ...formData, max_amount: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effective_date">Effective Date</Label>
                  <Input
                    id="effective_date"
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-center gap-2 pt-7">
                  <Switch
                    checked={formData.is_active ?? true}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingRate ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No rates found. Add your first tax rate above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="uppercase font-medium">{rate.tax_type}</TableCell>
                    <TableCell>{rate.name}</TableCell>
                    <TableCell>{rate.rate}%</TableCell>
                    <TableCell>
                      {formatCurrency(rate.min_amount)} - {formatCurrency(rate.max_amount)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        rate.is_active 
                          ? 'bg-green-500/20 text-green-600' 
                          : 'bg-red-500/20 text-red-600'
                      }`}>
                        {rate.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(rate)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rate.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
