import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Trash2, Download, Calculator } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Employee {
  id: string;
  name: string;
  grossSalary: number;
}

interface PayrollResult {
  name: string;
  grossSalary: number;
  paye: number;
  pension: number;
  nhf: number;
  nsitf: number;
  totalDeductions: number;
  netSalary: number;
}

// Nigerian PAYE tax bands (annual)
const calculatePAYE = (taxableIncome: number): number => {
  const annual = taxableIncome * 12;
  let tax = 0;
  let remaining = annual;

  const bands = [
    { limit: 300000, rate: 0.07 },
    { limit: 300000, rate: 0.11 },
    { limit: 500000, rate: 0.15 },
    { limit: 500000, rate: 0.19 },
    { limit: 1600000, rate: 0.21 },
    { limit: Infinity, rate: 0.24 },
  ];

  // CRA: 20% of gross + 200,000 consolidated relief
  const annualGross = taxableIncome * 12;
  const cra = Math.max(200000, 0.01 * annualGross) + 0.2 * annualGross;
  remaining = Math.max(0, annual - cra);

  for (const band of bands) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, band.limit);
    tax += taxable * band.rate;
    remaining -= taxable;
  }

  return Math.round((tax / 12) * 100) / 100;
};

const Payroll = () => {
  const [employees, setEmployees] = useState<Employee[]>([
    { id: '1', name: '', grossSalary: 0 },
  ]);
  const [results, setResults] = useState<PayrollResult[]>([]);

  const addEmployee = () => {
    setEmployees(prev => [...prev, { id: Date.now().toString(), name: '', grossSalary: 0 }]);
  };

  const removeEmployee = (id: string) => {
    if (employees.length === 1) return;
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  const updateEmployee = (id: string, field: keyof Employee, value: string | number) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const calculatePayroll = () => {
    const valid = employees.filter(e => e.name && e.grossSalary > 0);
    if (valid.length === 0) {
      toast.error('Please add at least one employee with name and salary');
      return;
    }

    const computed: PayrollResult[] = valid.map(emp => {
      const pension = Math.round(emp.grossSalary * 0.08 * 100) / 100; // 8% employee contribution
      const nhf = Math.round(emp.grossSalary * 0.025 * 100) / 100; // 2.5% NHF
      const nsitf = Math.round(emp.grossSalary * 0.01 * 100) / 100; // 1% NSITF
      const paye = calculatePAYE(emp.grossSalary);
      const totalDeductions = paye + pension + nhf + nsitf;
      const netSalary = Math.round((emp.grossSalary - totalDeductions) * 100) / 100;

      return {
        name: emp.name,
        grossSalary: emp.grossSalary,
        paye,
        pension,
        nhf,
        nsitf,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        netSalary,
      };
    });

    setResults(computed);
    toast.success(`Payroll calculated for ${computed.length} employee(s)`);
  };

  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportCSV = () => {
    if (results.length === 0) return;
    let csv = 'Name,Gross Salary,PAYE,Pension (8%),NHF (2.5%),NSITF (1%),Total Deductions,Net Salary\n';
    results.forEach(r => {
      csv += `"${r.name}",${r.grossSalary},${r.paye},${r.pension},${r.nhf},${r.nsitf},${r.totalDeductions},${r.netSalary}\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('Payroll exported to CSV');
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Payroll Module</h1>
                <p className="text-sm text-muted-foreground">PAYE, Pension, NHF & NSITF Calculator</p>
              </div>
            </motion.div>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Employee Input */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">Employees</CardTitle>
                <Button size="sm" variant="outline" onClick={addEmployee}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {employees.map((emp, i) => (
                  <div key={emp.id} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        placeholder="Employee name"
                        value={emp.name}
                        onChange={(e) => updateEmployee(emp.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label className="text-xs">Gross (₦)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={emp.grossSalary || ''}
                        onChange={(e) => updateEmployee(emp.id, 'grossSalary', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeEmployee(emp.id)} disabled={employees.length === 1}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                <Button onClick={calculatePayroll} className="w-full">
                  <Calculator className="w-4 h-4 mr-2" /> Calculate Payroll
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            {results.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Payroll Summary</h2>
                  <Button size="sm" variant="outline" onClick={exportCSV}>
                    <Download className="w-4 h-4 mr-1" /> Export CSV
                  </Button>
                </div>

                {results.map((r, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">{r.name}</h3>
                        <Badge variant="outline">Gross: {formatCurrency(r.grossSalary)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">PAYE:</span>
                          <span className="text-destructive font-medium">-{formatCurrency(r.paye)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pension (8%):</span>
                          <span className="text-destructive font-medium">-{formatCurrency(r.pension)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NHF (2.5%):</span>
                          <span className="text-destructive font-medium">-{formatCurrency(r.nhf)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NSITF (1%):</span>
                          <span className="text-destructive font-medium">-{formatCurrency(r.nsitf)}</span>
                        </div>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between items-center">
                        <span className="font-semibold text-sm">Net Salary:</span>
                        <span className="font-bold text-lg text-primary">{formatCurrency(r.netSalary)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Totals */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-2">Company Totals</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Gross:</span>
                        <span className="font-medium">{formatCurrency(results.reduce((s, r) => s + r.grossSalary, 0))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total PAYE:</span>
                        <span className="font-medium">{formatCurrency(results.reduce((s, r) => s + r.paye, 0))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Pension:</span>
                        <span className="font-medium">{formatCurrency(results.reduce((s, r) => s + r.pension, 0))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Net:</span>
                        <span className="font-bold text-primary">{formatCurrency(results.reduce((s, r) => s + r.netSalary, 0))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Payroll;
