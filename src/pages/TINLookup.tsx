import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Building2, User, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface TINResult {
  tin: string;
  name: string;
  type: 'individual' | 'company';
  status: 'active' | 'inactive' | 'not_found';
  registrationDate?: string;
  taxOffice?: string;
}

const TINLookup = () => {
  const [searchType, setSearchType] = useState<'tin' | 'name'>('tin');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<TINResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a TIN number or name to search');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    // Simulate FIRS TIN verification (in production, this would call the FIRS API)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulated response based on input
    if (query.length >= 10 && searchType === 'tin') {
      setResult({
        tin: query,
        name: 'Sample Business Ltd',
        type: 'company',
        status: 'active',
        registrationDate: '2020-03-15',
        taxOffice: 'Lagos Island Tax Office',
      });
    } else if (searchType === 'name' && query.length >= 3) {
      setResult({
        tin: '1234567890',
        name: query,
        type: query.toLowerCase().includes('ltd') || query.toLowerCase().includes('limited') ? 'company' : 'individual',
        status: 'active',
        registrationDate: '2019-08-22',
        taxOffice: 'Federal Inland Revenue Service (FIRS)',
      });
    } else {
      setResult(null);
    }

    setIsSearching(false);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">TIN Lookup</h1>
                <p className="text-sm text-muted-foreground">Verify Tax Identification Numbers</p>
              </div>
            </motion.div>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Info Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">FIRS TIN Verification</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Verify if a Tax Identification Number (TIN) is registered with the Federal Inland Revenue Service. 
                      All businesses and individuals must have a valid TIN for tax compliance.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'tin' | 'name')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="tin" className="flex-1 gap-1">
                      <Building2 className="w-4 h-4" /> By TIN
                    </TabsTrigger>
                    <TabsTrigger value="name" className="flex-1 gap-1">
                      <User className="w-4 h-4" /> By Name
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-2">
                  <Label>{searchType === 'tin' ? 'TIN Number' : 'Business/Individual Name'}</Label>
                  <Input
                    placeholder={searchType === 'tin' ? 'Enter 10-digit TIN number' : 'Enter business or individual name'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>

                <Button onClick={handleSearch} disabled={isSearching} className="w-full">
                  {isSearching ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" /> Verify TIN</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            {hasSearched && !isSearching && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {result ? (
                  <Card className="border-green-200 dark:border-green-800">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          TIN Found
                        </CardTitle>
                        <Badge className={result.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {result.status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">TIN Number</p>
                          <p className="font-semibold text-sm">{result.tin}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Type</p>
                          <p className="font-semibold text-sm capitalize">{result.type}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Registered Name</p>
                          <p className="font-semibold text-sm">{result.name}</p>
                        </div>
                        {result.registrationDate && (
                          <div>
                            <p className="text-xs text-muted-foreground">Registration Date</p>
                            <p className="font-semibold text-sm">{result.registrationDate}</p>
                          </div>
                        )}
                        {result.taxOffice && (
                          <div>
                            <p className="text-xs text-muted-foreground">Tax Office</p>
                            <p className="font-semibold text-sm">{result.taxOffice}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="p-6 text-center">
                      <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                      <h3 className="font-semibold text-foreground">TIN Not Found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        No records found for this {searchType === 'tin' ? 'TIN number' : 'name'}. 
                        Please verify the information and try again.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* How to Get TIN */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How to Get a TIN</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { step: '1', text: 'Visit the nearest FIRS office or go to taxpromax.firs.gov.ng' },
                  { step: '2', text: 'Fill out the TIN application form with required documents' },
                  { step: '3', text: 'Submit valid ID, utility bill, and CAC certificate (for businesses)' },
                  { step: '4', text: 'Receive your TIN via email or SMS within 24-48 hours' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{item.step}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TINLookup;
