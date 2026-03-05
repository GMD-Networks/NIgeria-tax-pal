import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Percent, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Nigerian WHT Rates
const WHT_TYPES = [
  { key: 'rent', label: 'Rent (Land & Buildings)', rate: 10 },
  { key: 'contract', label: 'Contract (General)', rate: 5 },
  { key: 'professional', label: 'Professional Services', rate: 10 },
  { key: 'commission', label: 'Commission', rate: 10 },
  { key: 'consultancy', label: 'Consultancy', rate: 10 },
  { key: 'management', label: 'Management Fees', rate: 10 },
  { key: 'royalty', label: 'Royalty', rate: 10 },
  { key: 'dividend', label: 'Dividend', rate: 10 },
  { key: 'interest', label: 'Interest', rate: 10 },
  { key: 'director', label: 'Director\'s Fees', rate: 10 },
  { key: 'construction', label: 'Construction', rate: 5 },
  { key: 'supply', label: 'Supply of Goods', rate: 5 },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface WHTCalculatorProps {
  onCalculate?: () => void;
}

export function WHTCalculator({ onCalculate }: WHTCalculatorProps) {
  const { t } = useTranslation();
  
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [result, setResult] = useState<{
    amount: number;
    rate: number;
    wht: number;
    net: number;
  } | null>(null);

  const handleCalculate = () => {
    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0 || !transactionType) return;
    
    const selectedType = WHT_TYPES.find((t) => t.key === transactionType);
    if (!selectedType) return;
    
    const wht = numericAmount * (selectedType.rate / 100);
    
    setResult({
      amount: numericAmount,
      rate: selectedType.rate,
      wht,
      net: numericAmount - wht,
    });
    onCalculate?.();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
      setAmount(parseInt(value).toLocaleString());
    } else {
      setAmount('');
    }
  };

  const selectedType = WHT_TYPES.find((t) => t.key === transactionType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Input Section */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div>
          <Label htmlFor="type" className="text-base font-medium mb-2 block">
            {t('calculator.wht.type')}
          </Label>
          <Select value={transactionType} onValueChange={setTransactionType}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Select transaction type" />
            </SelectTrigger>
            <SelectContent>
              {WHT_TYPES.map((type) => (
                <SelectItem key={type.key} value={type.key}>
                  <div className="flex items-center justify-between w-full">
                    <span>{type.label}</span>
                    <span className="text-muted-foreground ml-4">{type.rate}%</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedType && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-secondary/20 rounded-xl p-3 flex items-center justify-between"
          >
            <span className="text-sm text-muted-foreground">WHT Rate</span>
            <span className="font-bold text-secondary">{selectedType.rate}%</span>
          </motion.div>
        )}

        <div>
          <Label htmlFor="amount" className="text-base font-medium mb-2 block">
            {t('calculator.wht.amount')}
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              ₦
            </span>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={handleAmountChange}
              className="pl-8 h-14 text-xl font-semibold rounded-xl"
            />
          </div>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={!amount || !transactionType}
          className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
        >
          <Calculator className="w-5 h-5 mr-2" />
          {t('calculator.wht.calculate')}
        </Button>
      </div>

      {/* Results Section */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-secondary" />
                  <span className="text-sm text-muted-foreground">
                    {t('calculator.wht.result.wht')}
                  </span>
                </div>
                <p className="text-xl font-bold text-secondary">
                  {formatCurrency(result.wht)}
                </p>
              </div>
              
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-success" />
                  <span className="text-sm text-muted-foreground">
                    {t('calculator.wht.result.net')}
                  </span>
                </div>
                <p className="text-xl font-bold text-success">
                  {formatCurrency(result.net)}
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="font-semibold text-foreground">Calculation Breakdown</h4>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('calculator.wht.result.amount')}</span>
                  <span className="font-medium">{formatCurrency(result.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('calculator.wht.result.rate')}</span>
                  <span className="font-medium">{result.rate}%</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('calculator.wht.result.wht')}</span>
                  <span className="font-medium text-secondary">{formatCurrency(result.wht)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-semibold">{t('calculator.wht.result.net')}</span>
                  <span className="font-bold text-success">{formatCurrency(result.net)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
