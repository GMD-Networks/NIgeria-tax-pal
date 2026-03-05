import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Check, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { api as backendApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface SavedClient {
  id: string;
  client_name: string;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
}

interface SavedClientsProps {
  onSelectClient: (client: { name: string; address: string; email: string }) => void;
  currentClient?: { name: string; address: string; email: string };
}

export function SavedClients({ onSelectClient, currentClient }: SavedClientsProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', address: '', email: '', phone: '' });

  const fetchClients = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await backendApi
        .from('saved_clients')
        .select('*')
        .eq('user_id', user.id)
        .order('client_name');
      if (error) throw error;
      setClients((data || []) as SavedClient[]);
    } catch (e) {
      console.error('Error fetching clients:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchClients();
  }, [user, fetchClients]);

  const saveClient = async () => {
    if (!user || !newClient.name.trim()) { toast.error('Client name is required'); return; }
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        client_name: newClient.name.trim(),
        client_address: newClient.address || null,
        client_email: newClient.email || null,
        client_phone: newClient.phone || null,
      };
      const { error } = await backendApi.from('saved_clients').insert(payload);
      if (error) throw error;
      toast.success('Client saved');
      setNewClient({ name: '', address: '', email: '', phone: '' });
      setAddDialogOpen(false);
      fetchClients();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save client');
    }
  };

  const saveCurrentAsClient = async () => {
    if (!user || !currentClient?.name) { toast.error('No client details to save'); return; }
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        client_name: currentClient.name,
        client_address: currentClient.address || null,
        client_email: currentClient.email || null,
      };
      const { error } = await backendApi.from('saved_clients').insert(payload);
      if (error) throw error;
      toast.success('Current client saved');
      fetchClients();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save client');
    }
  };

  const deleteClient = async (id: string) => {
    try {
      const { error } = await backendApi.from('saved_clients').delete().eq('id', id);
      if (error) throw error;
      toast.success('Client removed');
      fetchClients();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const selectClient = (client: SavedClient) => {
    onSelectClient({
      name: client.client_name,
      address: client.client_address || '',
      email: client.client_email || '',
    });
    setDialogOpen(false);
    toast.success(`Selected: ${client.client_name}`);
  };

  if (!user) return null;

  return (
    <div className="flex gap-2">
      {/* Select from saved */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <Users className="w-3 h-3" /> Saved Clients
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Select Client
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No saved clients yet</p>
                <p className="text-sm mt-1">Save a client to quickly reuse their details</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  <AnimatePresence>
                    {clients.map(client => (
                      <motion.div
                        key={client.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <button className="flex-1 text-left" onClick={() => selectClient(client)}>
                          <p className="font-medium">{client.client_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[client.client_email, client.client_address].filter(Boolean).join(' • ') || 'No details'}
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
                              <AlertDialogTitle>Delete Client?</AlertDialogTitle>
                              <AlertDialogDescription>Remove "{client.client_name}" from your saved clients?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteClient(client.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); setAddDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add New Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add new client */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name *</Label><Input value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} placeholder="Client name" /></div>
            <div><Label>Email</Label><Input type="email" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} placeholder="client@email.com" /></div>
            <div><Label>Address</Label><Input value={newClient.address} onChange={e => setNewClient(p => ({ ...p, address: e.target.value }))} placeholder="Client address" /></div>
            <div><Label>Phone</Label><Input value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} placeholder="+234..." /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={saveClient}>Save Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save current client */}
      {currentClient?.name && (
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={saveCurrentAsClient}>
          <UserPlus className="w-3 h-3" /> Save Current
        </Button>
      )}
    </div>
  );
}
