import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, Calendar, FileText, CheckCircle2, AlertCircle, 
  Clock, Loader2, Newspaper, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api as backendApi } from '@/services/api';
import { format } from 'date-fns';

interface GeneratedArticle {
  id: string;
  title: string;
  category: string;
}

interface RecentTaxContentItem {
  id: string;
  title: string;
  category: string;
  created_at: string;
  is_published: boolean;
}

const TaxContentFeed = () => {
  const queryClient = useQueryClient();

  // Fetch recent tax content
  const { data: recentContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ['recent-tax-content'],
    queryFn: async () => {
      const { data, error } = await backendApi
        .from('tax_content')
        .select('id, title, category, created_at, is_published')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return (data as RecentTaxContentItem[] | null) || [];
    },
  });

  // Manual trigger mutation
  const triggerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await backendApi.functions.invoke('auto-tax-content', {
        body: {}
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate content');
      
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Generated ${data.articles?.length || 0} new tax articles`);
      queryClient.invalidateQueries({ queryKey: ['recent-tax-content'] });
      queryClient.invalidateQueries({ queryKey: ['tax-content'] });
    },
    onError: (error) => {
      console.error('Content generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate content');
    }
  });

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, 'MMM d, yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Newspaper className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Tax Content Feed</CardTitle>
                <CardDescription>
                  Auto-fetch FIRS updates and generate tax content
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
              className="gap-2"
            >
              {triggerMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Auto-runs daily at 2:00 AM WAT</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>Generates 3 articles with translations</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Recent Content
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['recent-tax-content'] })}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingContent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentContent && recentContent.length > 0 ? (
            <div className="space-y-3">
              {recentContent.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{item.title}</h4>
                      {item.is_published ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getTimeAgo(item.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No content generated yet</p>
              <p className="text-sm">Click "Generate Now" to create tax articles</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Auto-Generation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Content is automatically generated daily at 2:00 AM Nigerian time (WAT). 
              Each run creates 3 new articles covering FIRS updates, tax tips, and compliance news.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Multi-Language Support
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Generated articles are automatically translated to Yoruba, Hausa, Igbo, and 
              Nigerian Pidgin English for broader accessibility.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaxContentFeed;
