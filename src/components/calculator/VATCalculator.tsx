import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Percent, Wallet, ArrowRightLeft } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Nigerian VAT Rate (7.5% as of 2020)
const VAT_RATE = 7.5;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface VATCalculatorProps {
  onCalculate?: () => void;
}

type CalculationType = 'add' | 'extract';

export function VATCalculator({ onCalculate }: VATCalculatorProps) {
  const { t } = useTranslation();
  
  const [amount, setAmount] = useState('');
  const [calculationType, setCalculationType] = useState<CalculationType>('add');
  const [result, setResult] = useState<{
    originalAmount: number;
    vatAmount: number;
    finalAmount: number;
    type: CalculationType;
  } | null>(null);

  const handleCalculate = () => {
    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) return;
    
    if (calculationType === 'add') {
      // Add VAT to amount (amount is net, calculate gross)
      const vatAmount = numericAmount * (VAT_RATE / 100);
      setResult({
        originalAmount: numericAmount,
        vatAmount,
        finalAmount: numericAmount + vatAmount,
        type: 'add',
      });
    } else {
      // Extract VAT from amount (amount is gross, extract net and VAT)
      const netAmount = numericAmount / (1 + VAT_RATE / 100);
      const vatAmount = numericAmount - netAmount;
      setResult({
        originalAmount: numericAmount,
        vatAmount,
        finalAmount: netAmount,
        type: 'extract',
      });
    }
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Input Section */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        {/* Calculation Type Selector */}
        <div>
          <Label className="text-base font-medium mb-3 block">
            Calculation Type
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCalculationType('add')}
              className={`p-3 rounded-xl border text-left transition-all ${
                calculationType === 'add'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Percent className="w-4 h-4" />
                <span className="font-medium text-sm">Add VAT</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Calculate VAT on a net amount
              </p>
            </button>
            <button
              onClick={() => setCalculationType('extract')}
              className={`p-3 rounded-xl border text-left transition-all ${
                calculationType === 'extract'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <ArrowRightLeft className="w-4 h-4" />
                <span className="font-medium text-sm">Extract VAT</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Find VAT in a gross amount
              </p>
            </button>
          </div>
        </div>

        {/* VAT Rate Info */}
        <div className="bg-secondary/20 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Nigerian VAT Rate</span>
          <span className="font-bold text-secondary">{VAT_RATE}%</span>
        </div>

        {/* Amount Input */}
        <div>
          <Label htmlFor="vat-amount" className="text-base font-medium mb-2 block">
            {calculationType === 'add' ? 'Net Amount (Excl. VAT)' : 'Gross Amount (Incl. VAT)'}
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              ₦
            </span>
            <Input
              id="vat-amount"
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
          disabled={!amount}
          className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
        >
          <Calculator className="w-5 h-5 mr-2" />
          Calculate VAT
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
                    VAT Amount
                  </span>
                </div>
                <p className="text-xl font-bold text-secondary">
                  {formatCurrency(result.vatAmount)}
                </p>
              </div>
              
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-success" />
                  <span className="text-sm text-muted-foreground">
                    {result.type === 'add' ? 'Total (Incl. VAT)' : 'Net (Excl. VAT)'}
                  </span>
                </div>
                <p className="text-xl font-bold text-success">
                  {formatCurrency(result.finalAmount)}
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="font-semibold text-foreground">Calculation Breakdown</h4>
              
              <div className="space-y-2">
                {result.type === 'add' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Net Amount</span>
                      <span className="font-medium">{formatCurrency(result.originalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT ({VAT_RATE}%)</span>
                      <span className="font-medium text-secondary">+{formatCurrency(result.vatAmount)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-success">{formatCurrency(result.finalAmount)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gross Amount</span>
                      <span className="font-medium">{formatCurrency(result.originalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT ({VAT_RATE}%)</span>
                      <span className="font-medium text-secondary">-{formatCurrency(result.vatAmount)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-semibold">Net Amount</span>
                      <span className="font-bold text-success">{formatCurrency(result.finalAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Info note */}
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Nigerian VAT is currently 7.5% (effective February 2020). 
                Some goods and services are VAT-exempt including basic food items, medical supplies, 
                and educational materials.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
