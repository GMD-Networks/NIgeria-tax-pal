import { useEffect, useState } from 'react';
import { api as backendApi, API_BASE } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Sparkles } from 'lucide-react';

interface TaxContent {
  id: string;
  title: string;
  title_yo: string | null;
  title_ha: string | null;
  title_pcm: string | null;
  title_ig: string | null;
  content: string;
  content_yo: string | null;
  content_ha: string | null;
  content_pcm: string | null;
  content_ig: string | null;
  category: string;
  icon: string | null;
  display_order: number | null;
  is_published: boolean | null;
}

const emptyContent: Omit<TaxContent, 'id'> = {
  title: '',
  title_yo: '',
  title_ha: '',
  title_pcm: '',
  title_ig: '',
  content: '',
  content_yo: '',
  content_ha: '',
  content_pcm: '',
  content_ig: '',
  category: '',
  icon: 'FileText',
  display_order: 0,
  is_published: true,
};

export default function ContentManager() {
  const [contents, setContents] = useState<TaxContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<TaxContent | null>(null);
  const [formData, setFormData] = useState<Omit<TaxContent, 'id'>>(emptyContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchContents = async () => {
    try {
      const { data, error } = await backendApi
        .from('tax_content')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setContents((data as TaxContent[] | null) || []);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingContent) {
        const { error } = await backendApi
          .from('tax_content')
          .update(formData)
          .eq('id', editingContent.id);

        if (error) throw error;
        toast.success('Content updated successfully');
      } else {
        const { error } = await backendApi
          .from('tax_content')
          .insert([formData]);

        if (error) throw error;
        toast.success('Content created successfully');
      }

      setIsDialogOpen(false);
      setEditingContent(null);
      setFormData(emptyContent);
      fetchContents();
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save content');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (content: TaxContent) => {
    setEditingContent(content);
    setFormData({
      title: content.title,
      title_yo: content.title_yo,
      title_ha: content.title_ha,
      title_pcm: content.title_pcm,
      title_ig: content.title_ig,
      content: content.content,
      content_yo: content.content_yo,
      content_ha: content.content_ha,
      content_pcm: content.content_pcm,
      content_ig: content.content_ig,
      category: content.category,
      icon: content.icon,
      display_order: content.display_order,
      is_published: content.is_published,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const { error } = await backendApi
        .from('tax_content')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Content deleted successfully');
      fetchContents();
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  const openNewDialog = () => {
    setEditingContent(null);
    setFormData(emptyContent);
    setIsDialogOpen(true);
  };

  const handleGenerateContent = async () => {
    setIsGenerating(true);
    try {
      const session = await backendApi.auth.getSession();
      const token = session?.data?.session?.access_token;

      const response = await fetch(`${API_BASE}/functions/auto-tax-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate content');
      }

      toast.success(`Generated ${data.articles?.length || 0} new articles`);
      fetchContents();
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate tax content');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tax Content</h1>
          <p className="text-muted-foreground">Manage educational tax content in multiple languages</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateContent} 
            variant="outline"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {isGenerating ? 'Generating...' : 'AI Generate'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Content
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingContent ? 'Edit Content' : 'Add New Content'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., paye, vat, wht"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Input
                    id="icon"
                    value={formData.icon || ''}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="e.g., FileText, Calculator"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title (English)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content (English)</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title_yo">Title (Yoruba)</Label>
                  <Input
                    id="title_yo"
                    value={formData.title_yo || ''}
                    onChange={(e) => setFormData({ ...formData, title_yo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title_ha">Title (Hausa)</Label>
                  <Input
                    id="title_ha"
                    value={formData.title_ha || ''}
                    onChange={(e) => setFormData({ ...formData, title_ha: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title_pcm">Title (Pidgin)</Label>
                  <Input
                    id="title_pcm"
                    value={formData.title_pcm || ''}
                    onChange={(e) => setFormData({ ...formData, title_pcm: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title_ig">Title (Igbo)</Label>
                  <Input
                    id="title_ig"
                    value={formData.title_ig || ''}
                    onChange={(e) => setFormData({ ...formData, title_ig: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order || 0}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-7">
                  <Switch
                    checked={formData.is_published ?? true}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                  <Label>Published</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingContent ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : contents.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No content found. Add your first tax content above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contents.map((content) => (
                  <TableRow key={content.id}>
                    <TableCell className="font-medium">{content.title}</TableCell>
                    <TableCell>{content.category}</TableCell>
                    <TableCell>{content.display_order}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        content.is_published 
                          ? 'bg-green-500/20 text-green-600' 
                          : 'bg-yellow-500/20 text-yellow-600'
                      }`}>
                        {content.is_published ? 'Published' : 'Draft'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(content)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(content.id)}
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
