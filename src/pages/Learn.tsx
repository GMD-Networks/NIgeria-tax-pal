import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Wallet, FileText, AlertCircle, TrendingUp, ChevronRight, ChevronLeft, Loader2,
  Receipt, Building2, ShoppingCart, Stamp, Landmark, Bell, BookOpen, Clock, WifiOff
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { api as backendApi } from '@/services/api';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet,
  FileText,
  AlertCircle,
  TrendingUp,
  Receipt,
  Building2,
  ShoppingCart,
  Stamp,
  Landmark,
  Bell,
};

interface TaxContentItem {
  id: string;
  title: string;
  content: string;
  category: string;
  icon?: string | null;
  created_at?: string;
  [key: string]: string | number | boolean | null | undefined;
}

// Content images - professional Nigerian tax/business themed for embedding in articles
const contentImages: string[] = [
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop&q=80',
];

// Get a consistent image based on article ID or index
const getContentImage = (id: string, position: number) => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return contentImages[(hash + position) % contentImages.length];
};

const categoryColors: Record<string, { bg: string; text: string; gradient: string }> = {
  paye: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500/20 to-teal-500/20' },
  wht: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500/20 to-indigo-500/20' },
  mistakes: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500/20 to-orange-500/20' },
  updates: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', gradient: 'from-purple-500/20 to-pink-500/20' },
  cgt: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', gradient: 'from-rose-500/20 to-red-500/20' },
  cit: { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', gradient: 'from-cyan-500/20 to-sky-500/20' },
  vat: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', gradient: 'from-orange-500/20 to-yellow-500/20' },
  stamp: { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', gradient: 'from-pink-500/20 to-fuchsia-500/20' },
  levy: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500/20 to-emerald-500/20' },
};

const cleanArticleText = (text: string) => {
  if (!text) return '';
  const normalized = text
    .replace(/^```(?:json|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const contentMatch = normalized.match(/"content"\s*:\s*"((?:\\.|[^"\\])*)"/is);
  let cleaned = contentMatch?.[1]
    ? contentMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    : normalized;

  cleaned = cleaned
    .replace(/^[\[\{]\s*$/gm, '')
    .replace(/^[\]\},]\s*$/gm, '')
    .replace(/^\s*"?(title|content|category|title_yo|title_ha|title_pcm|title_ig|content_yo|content_ha|content_pcm|content_ig)"?\s*:\s*/gim, '')
    .replace(/^\s*,+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
};

const extractLanguageSection = (text: string, lang: string) => {
  const normalized = cleanArticleText(text);
  if (!normalized) return '';

  const labels = {
    en: ['english', 'en'],
    yo: ['yoruba', 'yo', 'yorùbá'],
    ha: ['hausa', 'ha'],
    ig: ['igbo', 'ig'],
    pcm: ['pidgin', 'nigerian pidgin', 'pcm'],
  } as const;

  const allLabels = Object.values(labels).flat().map(label => label.replace(/\s+/g, '\\s+')).join('|');
  const target = (labels[lang as keyof typeof labels] || labels.en)
    .map(label => label.replace(/\s+/g, '\\s+'))
    .join('|');

  const regex = new RegExp(`(?:^|\\n)\\s*(?:${target})\\s*[:\\-]\\s*(.+?)(?=(?:\\n\\s*(?:${allLabels})\\s*[:\\-])|$)`, 'is');
  const match = normalized.match(regex);
  return match?.[1]?.trim() || '';
};

// Split content into paragraphs intelligently
const splitIntoParagraphs = (text: string): string[] => {
  // First, try splitting by double newlines
  let paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  // If we only got 1 paragraph, the content is jam-packed - split by sentences
  if (paragraphs.length === 1 && text.length > 300) {
    // Split long text into logical paragraphs (every 2-3 sentences)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    paragraphs = [];
    let currentParagraph = '';
    
    sentences.forEach((sentence, i) => {
      currentParagraph += sentence.trim() + ' ';
      // Create a new paragraph every 2-3 sentences or at natural breaks
      if ((i + 1) % 3 === 0 || sentence.includes(':') || i === sentences.length - 1) {
        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim());
        }
        currentParagraph = '';
      }
    });
    
    // Add remaining text if any
    if (currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }
  }
  
  // Also split by single newlines if paragraphs still seem too long
  paragraphs = paragraphs.flatMap(p => {
    if (p.includes('\n') && p.length > 200) {
      return p.split('\n').filter(s => s.trim());
    }
    return [p];
  });
  
  return paragraphs.filter(p => p.trim().length > 0);
};

// Render clean content with proper paragraph spacing and embedded images
const renderContent = (text: string, articleId: string) => {
  const paragraphs = splitIntoParagraphs(text);
  
  // Keep image usage low for simpler, cleaner reading experience
  const imagePositions = [3];
  
  return (
    <div className="space-y-5">
      {paragraphs.map((paragraph, index) => {
        const trimmed = paragraph.trim();
        if (!trimmed) return null;
        
        // Check if it looks like a heading (short, ends without period, starts with capital)
        const isHeading = trimmed.length < 60 && !trimmed.endsWith('.') && /^[A-Z]/.test(trimmed) && !trimmed.includes(',');
        const showImage = imagePositions.includes(index) && paragraphs.length > index + 1;
        const isFirstParagraph = index === 0 && !isHeading;
        
        return (
          <div key={index} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
            {isHeading && index > 0 ? (
              <h3 className="font-display text-lg font-bold text-foreground mt-6 mb-3 pb-2 border-b border-border/40">
                {trimmed}
              </h3>
            ) : isFirstParagraph ? (
              // First paragraph with drop cap
              <p className="article-first-paragraph font-serif text-foreground/90 leading-[1.85] text-[15.5px] tracking-wide">
                {trimmed}
              </p>
            ) : (
              <p className="font-serif text-foreground/90 leading-[1.85] text-[15.5px] tracking-wide">
                {trimmed}
              </p>
            )}
            
            {/* Embedded image between paragraphs */}
            {showImage && (
              <div className="my-8 rounded-xl overflow-hidden shadow-lg ring-1 ring-border/20">
                <img 
                  src={getContentImage(articleId, index)} 
                  alt="Tax information illustration"
                  className="w-full h-44 object-cover"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Format date for "New" badge
const isRecent = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return diffHours < 48; // Within 48 hours
};

// Get clean category display name - handles translation keys and raw category names
const getCategoryDisplayName = (category: string, t: (key: string) => string): string => {
  const translationKey = `learn.categories.${category}`;
  const translated = t(translationKey);
  
  // If translation returns the key itself, it means no translation exists
  // In that case, just return the raw category name formatted nicely
  if (translated === translationKey || translated.includes('learn.categories.')) {
    // Clean up the category name: capitalize first letter of each word
    return category
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  return translated;
};

const Learn = () => {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  const currentLang = (i18n.language || 'en').toLowerCase().split('-')[0];

  // Fetch tax content from database
  const { data: taxContent, isLoading, isError, refetch } = useQuery({
    queryKey: ['tax-content'],
    queryFn: async () => {
      const { data, error } = await backendApi
        .from('tax_content')
        .select('*')
        .eq('is_published', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return (data as TaxContentItem[] | null) || [];
    },
    retry: 2,
    retryDelay: 3000,
  });

  // Get localized title and content based on current language
  const getLocalizedTitle = useCallback((item: NonNullable<typeof taxContent>[0]) => {
    if (!item) return '';
    const lang = ['en', 'yo', 'ha', 'ig', 'pcm'].includes(currentLang) ? currentLang : 'en';
    if (lang === 'en') return cleanArticleText(item.title || '');
    const localizedTitle = item[`title_${lang}` as keyof typeof item] as string | null;
    return cleanArticleText(localizedTitle || item.title || '');
  }, [currentLang]);

  const getLocalizedContent = useCallback((item: NonNullable<typeof taxContent>[0]) => {
    if (!item) return '';
    const lang = ['en', 'yo', 'ha', 'ig', 'pcm'].includes(currentLang) ? currentLang : 'en';
    if (lang === 'en') {
      const extractedEnglish = extractLanguageSection(item.content || '', 'en');
      return cleanArticleText(extractedEnglish || item.content || '');
    }
    const localizedContent = item[`content_${lang}` as keyof typeof item] as string | null;
    if (localizedContent && localizedContent.trim()) {
      return cleanArticleText(localizedContent);
    }
    const extractedLang = extractLanguageSection(item.content || '', lang);
    if (extractedLang) {
      return cleanArticleText(extractedLang);
    }
    return cleanArticleText(item.content || '');
  }, [currentLang]);

  // Get unique categories from content
  const categories = useMemo(() => {
    if (!taxContent) return [];
    const uniqueCategories = [...new Set(taxContent.map(item => item.category))];
    return uniqueCategories.map(cat => ({
      key: cat,
      icon: iconMap[taxContent.find(item => item.category === cat)?.icon || 'FileText'] || FileText,
      colors: categoryColors[cat] || { bg: 'bg-muted', text: 'text-muted-foreground', gradient: 'from-muted/20 to-muted/10' },
      count: taxContent.filter(item => item.category === cat).length,
    }));
  }, [taxContent]);

  // Filter content by search and category
  const filteredContent = useMemo(() => {
    if (!taxContent) return [];
    let filtered = taxContent;
    
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const title = getLocalizedTitle(item).toLowerCase();
        const content = getLocalizedContent(item).toLowerCase();
        return title.includes(query) || content.includes(query);
      });
    }
    
    return filtered;
  }, [taxContent, selectedCategory, searchQuery, getLocalizedTitle, getLocalizedContent]);

  // Get selected article details
  const articleDetails = useMemo(() => {
    if (!selectedArticle || !taxContent) return null;
    return taxContent.find(item => item.id === selectedArticle);
  }, [selectedArticle, taxContent]);

  // Article Detail View
  if (articleDetails) {
    const colors = categoryColors[articleDetails.category] || categoryColors.updates;
    
    return (
      <AppLayout>
        <div className="min-h-screen bg-background">
          {/* Simple Header */}
          <header className="bg-gradient-to-b from-primary/5 to-background border-b border-border px-4 pt-12 pb-4 safe-top">
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => setSelectedArticle(null)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">{t('common.back')}</span>
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 py-6 pb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg mx-auto"
            >
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                {/* Category Badge */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold',
                    colors.bg, colors.text
                  )}>
                    {(() => {
                      const Icon = iconMap[articleDetails.icon || 'FileText'] || FileText;
                      return <Icon className="w-4 h-4" />;
                    })()}
                    {getCategoryDisplayName(articleDetails.category, t)}
                  </div>
                  {isRecent(articleDetails.created_at) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                      <Clock className="w-3 h-3" />
                      New
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-foreground mb-6 leading-tight">
                  {getLocalizedTitle(articleDetails)}
                </h1>

                {/* Divider */}
                <div className="w-16 h-1 bg-gradient-to-r from-primary to-primary/50 rounded-full mb-6" />

                {/* Content */}
                <article className="prose-custom">
                  {renderContent(getLocalizedContent(articleDetails), articleDetails.id)}
                </article>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-border/50 flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="w-4 h-4" />
                  <span>Nigerian Tax Information</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Category List View (when a category is selected)
  if (selectedCategory) {
    const colors = categoryColors[selectedCategory] || categoryColors.updates;
    
    return (
      <AppLayout>
        <div className="min-h-screen bg-background">
          {/* Simple Header */}
          <header className="bg-gradient-to-b from-primary/5 to-background border-b border-border px-4 pt-12 pb-4 safe-top">
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => setSelectedCategory(null)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">{t('common.back')}</span>
              </button>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <div className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-xl',
                  colors.bg
                )}>
                  {(() => {
                    const Icon = iconMap[filteredContent[0]?.icon || 'FileText'] || FileText;
                    return <Icon className={cn('w-6 h-6', colors.text)} />;
                  })()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {getCategoryDisplayName(selectedCategory, t)}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {filteredContent.length} {filteredContent.length === 1 ? t('learn.article') : t('learn.articles')}
                  </p>
                </div>
              </motion.div>
            </div>
          </header>

          {/* Articles List */}
          <div className="px-4 py-6">
            <div className="max-w-lg mx-auto space-y-3">
              <AnimatePresence>
                {filteredContent.map((item, index) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedArticle(item.id)}
                    className="w-full flex items-start gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all duration-200 text-left group"
                  >
                    <div className={cn(
                      'flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 transition-transform group-hover:scale-105',
                      colors.bg
                    )}>
                      {(() => {
                        const Icon = iconMap[item.icon || 'FileText'] || FileText;
                        return <Icon className={cn('w-6 h-6', colors.text)} />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground line-clamp-2">
                          {getLocalizedTitle(item)}
                        </h3>
                        {isRecent(item.created_at) && (
                          <span className="inline-flex px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded uppercase flex-shrink-0">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {getLocalizedContent(item).slice(0, 120)}...
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                ))}
              </AnimatePresence>

              {filteredContent.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t('learn.noContent')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Main Category Grid View
  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-gradient-to-b from-primary/5 to-background border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-4"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {t('learn.title')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Nigerian Tax Knowledge Base
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('learn.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-xl bg-card border-border shadow-sm text-base"
              />
            </motion.div>
          </div>
        </header>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading content...</p>
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <WifiOff className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-1">Unable to load content</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Please check your internet connection and try again.
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Search Results */}
        {searchQuery && !isLoading && (
          <div className="px-4 py-6">
            <div className="max-w-lg mx-auto space-y-3">
              <p className="text-sm font-medium text-muted-foreground mb-4">
                {filteredContent.length} {t('learn.results')} for "{searchQuery}"
              </p>
              {filteredContent.map((item, index) => {
                const colors = categoryColors[item.category] || categoryColors.updates;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedArticle(item.id)}
                    className="w-full flex items-start gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all duration-200 text-left group"
                  >
                    <div className={cn(
                      'flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0',
                      colors.bg
                    )}>
                      {(() => {
                        const Icon = iconMap[item.icon || 'FileText'] || FileText;
                        return <Icon className={cn('w-6 h-6', colors.text)} />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground line-clamp-1">
                          {getLocalizedTitle(item)}
                        </h3>
                        {isRecent(item.created_at) && (
                          <span className="inline-flex px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded uppercase">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {getCategoryDisplayName(item.category, t)}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {getLocalizedContent(item).slice(0, 100)}...
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                );
              })}
              
              {filteredContent.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No results found for "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Grid */}
        {!searchQuery && !isLoading && (
          <div className="px-4 py-6">
            <div className="max-w-lg mx-auto space-y-4">
              {categories.map((category, index) => {
                const Icon = category.icon;
                return (
                  <motion.button
                    key={category.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    onClick={() => setSelectedCategory(category.key)}
                    className="w-full bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-lg transition-all duration-300 group p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'flex items-center justify-center w-14 h-14 rounded-xl transition-transform group-hover:scale-105',
                          category.colors.bg
                        )}>
                          <Icon className={cn('w-7 h-7', category.colors.text)} />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-lg text-foreground mb-1">
                            {getCategoryDisplayName(category.key, t)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {category.count} {category.count === 1 ? t('learn.article') : t('learn.articles')}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                    </div>
                  </motion.button>
                );
              })}

              {categories.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">{t('learn.noContent')}</p>
                  <p className="text-sm mt-1">Check back later for tax articles</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Learn;
