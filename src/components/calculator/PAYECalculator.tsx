import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, TrendingUp, TrendingDown, HelpCircle, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { downloadFile } from '@/utils/nativeDownload';

// Nigerian PAYE Tax Bands (2026 Tax Reform - Nigeria Tax Act 2025)
// Section 58 and Fourth Schedule: New progressive rates with ₦800,000 tax-free threshold
// These are CUMULATIVE bands on CHARGEABLE INCOME (gross income minus deductions)
const TAX_BANDS = [
  { min: 0, max: 800000, rate: 0 },           // First ₦800,000: 0% (tax-free)
  { min: 800000, max: 3000000, rate: 0.15 },  // Next ₦2,200,000: 15%
  { min: 3000000, max: 12000000, rate: 0.18 }, // Next ₦9,000,000: 18%
  { min: 12000000, max: 25000000, rate: 0.21 }, // Next ₦13,000,000: 21%
  { min: 25000000, max: 50000000, rate: 0.23 }, // Next ₦25,000,000: 23%
  { min: 50000000, max: Infinity, rate: 0.25 }, // Above ₦50,000,000: 25%
];

// 2026 Tax-Free Threshold (Nigeria Tax Act 2025)
// Workers earning ₦800,000 or less annually are exempt from income tax
const TAX_FREE_THRESHOLD = 800000;

// Targeted Relief Allowance (replaced CRA in 2026)
// 20% rent relief capped at ₦500,000
const RENT_RELIEF_PERCENT = 0.20;
const RENT_RELIEF_CAP = 500000;

// Deduction rates (updated per Nigerian tax regulations 2026)
const PENSION_RATE = 0.08; // 8% - fully deductible
const NHF_RATE = 0.025; // 2.5%
const NHIS_RATE = 0.025; // 2.5%
const LIP_RATE = 0.02; // 2% Life Insurance Premium

interface DeductionOptions {
  pension: boolean;
  nhf: boolean;
  nhis: boolean;
  lip: boolean;
  rentRelief: boolean;
}

function calculatePAYE(annualIncome: number, deductions: DeductionOptions) {
  // Calculate statutory deductions first (these reduce take-home pay but are NOT tax deductible in NTA 2025)
  const pension = deductions.pension ? annualIncome * PENSION_RATE : 0;
  const nhf = deductions.nhf ? annualIncome * NHF_RATE : 0;
  const nhis = deductions.nhis ? annualIncome * NHIS_RATE : 0;
  const lip = deductions.lip ? annualIncome * LIP_RATE : 0;
  
  // NTA 2025: Rent Relief (20% of income, capped at ₦500,000) - this IS tax deductible
  const rentRelief = deductions.rentRelief 
    ? Math.min(annualIncome * RENT_RELIEF_PERCENT, RENT_RELIEF_CAP) 
    : 0;
  
  // Interest on loan and life assurance are also deductible
  // For now, using LIP as life assurance deduction
  const taxDeductibleAllowances = rentRelief;
  
  // Chargeable Income = Gross Income - Tax-Deductible Allowances (per government calculator)
  // Note: Pension, NHF, NHIS are statutory deductions but NOT deducted from chargeable income
  // The government calculator shows: Total Emolument - Rent Relief = Chargeable Income
  const chargeableIncome = Math.max(0, annualIncome - taxDeductibleAllowances);
  
  // 2026 Tax Reform: If chargeable income is ≤ ₦800,000, no income tax
  if (chargeableIncome <= TAX_FREE_THRESHOLD) {
    const totalStatutoryDeductions = pension + nhf + nhis + lip;
    
    return {
      grossIncome: annualIncome,
      pension,
      nhf,
      nhis,
      lip,
      rentRelief,
      totalDeductions: taxDeductibleAllowances,
      chargeableIncome,
      taxableIncome: 0,
      totalTax: 0,
      netIncome: annualIncome - totalStatutoryDeductions,
      effectiveRate: 0,
      isTaxExempt: true,
    };
  }
  
  // Apply progressive tax bands on chargeable income
  // NTA 2025 Fourth Schedule: Tax is calculated on cumulative bands
  let totalTax = 0;
  
  for (const band of TAX_BANDS) {
    if (chargeableIncome <= band.min) break;
    
    const taxableInBand = Math.min(chargeableIncome, band.max) - band.min;
    if (taxableInBand > 0) {
      totalTax += taxableInBand * band.rate;
    }
  }
  
  // Total statutory deductions (reduce take-home pay)
  const totalStatutoryDeductions = pension + nhf + nhis + lip;
  
  return {
    grossIncome: annualIncome,
    pension,
    nhf,
    nhis,
    lip,
    rentRelief,
    totalDeductions: taxDeductibleAllowances,
    chargeableIncome,
    taxableIncome: chargeableIncome, // For display purposes
    totalTax,
    netIncome: annualIncome - totalTax - totalStatutoryDeductions,
    effectiveRate: annualIncome > 0 ? (totalTax / annualIncome) * 100 : 0,
    isTaxExempt: false,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface PAYECalculatorProps {
  onCalculate?: () => void;
}

export function PAYECalculator({ onCalculate }: PAYECalculatorProps) {
  const { t } = useTranslation();
  
  const [salary, setSalary] = useState('');
  const [deductions, setDeductions] = useState<DeductionOptions>({
    pension: false,
    nhf: false,
    nhis: false,
    lip: false,
    rentRelief: false,
  });
  const [result, setResult] = useState<ReturnType<typeof calculatePAYE> | null>(null);

  const handleCalculate = () => {
    const amount = parseFloat(salary.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return;
    
    // Always treat input as annual income
    setResult(calculatePAYE(amount, deductions));
    onCalculate?.();
  };

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
      setSalary(parseInt(value).toLocaleString());
    } else {
      setSalary('');
    }
  };

  const toggleDeduction = (key: keyof DeductionOptions) => {
    setDeductions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    generatePDF();
  };

  const generatePDF = async () => {
    if (!result) return;

    const content = `
NIGERIA TAX COMPANION
PAYE Tax Calculation Report
Generated: ${new Date().toLocaleDateString('en-NG', { dateStyle: 'full' })}

====================================
INCOME SUMMARY
====================================
Gross Annual Income: ${formatCurrency(result.grossIncome)}
Monthly Equivalent: ${formatCurrency(result.grossIncome / 12)}

====================================
DEDUCTIONS APPLIED
====================================
${result.pension > 0 ? `Pension (8%): ${formatCurrency(result.pension)}` : ''}
${result.nhf > 0 ? `NHF (2.5%): ${formatCurrency(result.nhf)}` : ''}
${result.nhis > 0 ? `NHIS (2.5%): ${formatCurrency(result.nhis)}` : ''}
${result.lip > 0 ? `LIP (2%): ${formatCurrency(result.lip)}` : ''}
${result.rentRelief > 0 ? `Rent Relief (20% capped): ${formatCurrency(result.rentRelief)}` : ''}
Total Deductions: ${formatCurrency(result.totalDeductions)}

====================================
TAX CALCULATION (2026 Tax Reform)
====================================
${result.isTaxExempt ? `Tax Exempt: Yes (Chargeable Income ≤ ₦800,000 threshold)` : ''}
Chargeable Income: ${formatCurrency(result.chargeableIncome)}
Total PAYE Tax: ${formatCurrency(result.totalTax)}
Effective Tax Rate: ${result.effectiveRate.toFixed(2)}%

====================================
NET INCOME
====================================
Annual Net Income: ${formatCurrency(result.netIncome)}
Monthly Net Income: ${formatCurrency(result.netIncome / 12)}

====================================
Note: This calculation is based on Nigeria Tax Act 2025 (effective Jan 2026).
Tax-free threshold: ₦800,000/year. For official tax filings, consult a registered tax professional.
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const filename = `PAYE-Tax-Report-${new Date().toISOString().split('T')[0]}.txt`;
    await downloadFile(blob, filename, 'text/plain');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Input Section */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="salary" className="text-base font-medium">
            {t('calculator.paye.annual')}
          </Label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            Per Year
          </span>
        </div>
        
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            ₦
          </span>
          <Input
            id="salary"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={salary}
            onChange={handleSalaryChange}
            className="pl-8 h-14 text-xl font-semibold rounded-xl"
          />
        </div>

        {/* Optional Deductions */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-muted-foreground">
            Additional Deductions (Optional)
          </Label>
          <TooltipProvider>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="pension"
                  checked={deductions.pension}
                  onCheckedChange={() => toggleDeduction('pension')}
                />
                <label htmlFor="pension" className="flex flex-col flex-1 cursor-pointer">
                  <span className="text-sm font-medium">Pension</span>
                  <span className="text-xs text-muted-foreground">8%</span>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">Contributory Pension Scheme. Required for employees in organizations with 3+ staff. 8% deducted from salary.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="nhf"
                  checked={deductions.nhf}
                  onCheckedChange={() => toggleDeduction('nhf')}
                />
                <label htmlFor="nhf" className="flex flex-col flex-1 cursor-pointer">
                  <span className="text-sm font-medium">NHF</span>
                  <span className="text-xs text-muted-foreground">2.5%</span>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">National Housing Fund. Mandatory for employees earning ₦3,000+/month. Helps access home loans.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="nhis"
                  checked={deductions.nhis}
                  onCheckedChange={() => toggleDeduction('nhis')}
                />
                <label htmlFor="nhis" className="flex flex-col flex-1 cursor-pointer">
                  <span className="text-sm font-medium">NHIS</span>
                  <span className="text-xs text-muted-foreground">2.5%</span>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">National Health Insurance Scheme. Provides health coverage for employees and dependents. Select if enrolled.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="lip"
                  checked={deductions.lip}
                  onCheckedChange={() => toggleDeduction('lip')}
                />
                <label htmlFor="lip" className="flex flex-col flex-1 cursor-pointer">
                  <span className="text-sm font-medium">LIP</span>
                  <span className="text-xs text-muted-foreground">2%</span>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">Life Insurance Premium. Deduction for life insurance contributions. Select if you have life insurance through your employer.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-xl cursor-pointer hover:bg-primary/15 transition-colors col-span-2">
                <Checkbox
                  id="rentRelief"
                  checked={deductions.rentRelief}
                  onCheckedChange={() => toggleDeduction('rentRelief')}
                />
                <label htmlFor="rentRelief" className="flex flex-col flex-1 cursor-pointer">
                  <span className="text-sm font-medium">Rent Relief (2026)</span>
                  <span className="text-xs text-muted-foreground">20% (max ₦500k)</span>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">New 2026 Tax Reform: 20% rent relief on your income, capped at ₦500,000. Replaces old CRA system.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={!salary}
          className="w-full h-12 rounded-xl bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold"
        >
          <Calculator className="w-5 h-5 mr-2" />
          {t('calculator.paye.calculate')}
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
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-sm text-muted-foreground">
                    {t('calculator.paye.result.net')}
                  </span>
                </div>
                <p className="text-xl font-bold text-success">
                  {formatCurrency(result.netIncome / 12)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </div>
              
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">
                    {t('calculator.paye.result.tax')}
                  </span>
                </div>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(result.totalTax / 12)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="font-semibold text-foreground">Annual Breakdown</h4>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Income</span>
                  <span className="font-medium">{formatCurrency(result.grossIncome)}</span>
                </div>
                
                {result.pension > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pension (8%)</span>
                    <span className="text-destructive">-{formatCurrency(result.pension)}</span>
                  </div>
                )}
                
                {result.nhf > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NHF (2.5%)</span>
                    <span className="text-destructive">-{formatCurrency(result.nhf)}</span>
                  </div>
                )}
                
                {result.nhis > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NHIS (2.5%)</span>
                    <span className="text-destructive">-{formatCurrency(result.nhis)}</span>
                  </div>
                )}
                
                {result.lip > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">LIP (2%)</span>
                    <span className="text-destructive">-{formatCurrency(result.lip)}</span>
                  </div>
                )}
                
                {result.rentRelief > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rent Relief (20%)</span>
                    <span className="text-success">-{formatCurrency(result.rentRelief)}</span>
                  </div>
                )}
                
                {result.isTaxExempt && (
                  <div className="bg-success/10 border border-success/30 rounded-lg p-3 mt-2">
                    <p className="text-success text-sm font-medium">
                      ✓ Tax Exempt (2026 Reform)
                    </p>
                    <p className="text-success/80 text-xs mt-1">
                      Income ≤ ₦800,000/year is exempt from income tax under the Nigeria Tax Act 2025.
                    </p>
                  </div>
                )}
                
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Chargeable Income</span>
                  <span className="font-medium">{formatCurrency(result.chargeableIncome)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PAYE Tax</span>
                  <span className="text-destructive font-medium">-{formatCurrency(result.totalTax)}</span>
                </div>
                
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-semibold">Net Income</span>
                  <span className="font-bold text-success">{formatCurrency(result.netIncome)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Effective Tax Rate</span>
                  <span className="font-medium">{result.effectiveRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Download PDF Button */}
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
