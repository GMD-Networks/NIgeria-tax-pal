import { useEffect, useState } from 'react';
import { api as backendApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Shield, Users, Crown, Clock, RefreshCw, Check, X, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
  created_at: string;
}

interface AppUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  subscription: {
    id: string;
    plan_type: string;
    status: string;
    expires_at: string | null;
  } | null;
  roles: string[];
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Action failed';
};

export default function UsersManager() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'moderator' | 'user'>('admin');
  const [isAdding, setIsAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      const { data, error } = await backendApi
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRoles((data as UserRole[] | null) || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data: session } = await backendApi.auth.getSession();
      
      const { data, error } = await backendApi.functions.invoke('admin-users', {
        headers: session?.session?.access_token 
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : undefined
      });

      if (error) throw error;
      setUsers(data?.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    setIsAdding(true);

    try {
      const { error } = await backendApi
        .from('user_roles')
        .insert([{ user_id: newUserId, role: newRole }]);

      if (error) throw error;
      
      toast.success('Role assigned successfully');
      setNewUserId('');
      fetchRoles();
      fetchUsers();
    } catch (error: unknown) {
      console.error('Error adding role:', error);
      const err = error as { code?: string };
      if (err.code === '23505') {
        toast.error('User already has this role');
      } else if (err.code === '23503') {
        toast.error('Invalid user ID');
      } else {
        toast.error('Failed to assign role');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('Are you sure you want to remove this role?')) return;

    try {
      const { error } = await backendApi
        .from('user_roles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Role removed successfully');
      fetchRoles();
      fetchUsers();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to remove role');
    }
  };

  const handleAdminAction = async (action: string, userId?: string, subscriptionId?: string) => {
    const loadingKey = `${action}-${userId || subscriptionId}`;
    setActionLoading(loadingKey);
    
    try {
      const { data: session } = await backendApi.auth.getSession();
      
      const { data, error } = await backendApi.functions.invoke('admin-manage-user', {
        headers: session?.session?.access_token 
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : undefined,
        body: { action, user_id: userId, subscription_id: subscriptionId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(data?.message || 'Action completed successfully');
      fetchUsers();
    } catch (error: unknown) {
      console.error('Error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-destructive/20 text-destructive',
    moderator: 'bg-primary/20 text-primary',
    user: 'bg-secondary text-secondary-foreground',
  };

  const planColors: Record<string, string> = {
    weekly: 'bg-muted text-muted-foreground',
    monthly: 'bg-primary/20 text-primary',
    quarterly: 'bg-accent text-accent-foreground',
    yearly: 'bg-accent text-accent-foreground',
    lifetime: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-600',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-600',
    pending: 'bg-yellow-500/20 text-yellow-600',
    inactive: 'bg-muted text-muted-foreground',
    expired: 'bg-destructive/20 text-destructive',
    cancelled: 'bg-destructive/20 text-destructive',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users & Roles</h1>
          <p className="text-muted-foreground">Manage users, subscriptions, and admin access</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchUsers(); fetchRoles(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            All Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Role Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Application Users
              </CardTitle>
              <CardDescription>
                View all registered users and their subscription status
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  No users found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{user.full_name || 'No name'}</span>
                              <span className="text-sm text-muted-foreground">{user.email}</span>
                              <span className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}...</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.subscription ? (
                              <Badge className={planColors[user.subscription.plan_type] || 'bg-muted'}>
                                {user.subscription.plan_type === 'lifetime' && <Crown className="w-3 h-3 mr-1" />}
                                {user.subscription.plan_type}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Free
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.subscription ? (
                              <div className="flex flex-col gap-1">
                                <Badge className={statusColors[user.subscription.status] || 'bg-muted'}>
                                  {user.subscription.status}
                                </Badge>
                                {user.subscription.expires_at && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(user.subscription.expires_at), 'PP')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.roles.length > 0 ? (
                                user.roles.map((role) => (
                                  <Badge key={role} className={roleColors[role] || 'bg-muted'}>
                                    {role}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-sm">User</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {/* Approve pending subscription */}
                              {user.subscription?.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-green-600 border-green-600 hover:bg-green-50"
                                  disabled={actionLoading === `approve_subscription-${user.subscription.id}`}
                                  onClick={() => handleAdminAction('approve_subscription', undefined, user.subscription?.id)}
                                >
                                  {actionLoading === `approve_subscription-${user.subscription?.id}` ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3 mr-1" />
                                  )}
                                  Approve
                                </Button>
                              )}
                              
                              {/* Cancel active subscription */}
                              {user.subscription?.status === 'active' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-yellow-600 border-yellow-600 hover:bg-yellow-50"
                                  disabled={actionLoading === `cancel_subscription-${user.subscription.id}`}
                                  onClick={() => handleAdminAction('cancel_subscription', undefined, user.subscription?.id)}
                                >
                                  {actionLoading === `cancel_subscription-${user.subscription?.id}` ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <X className="w-3 h-3 mr-1" />
                                  )}
                                  Cancel
                                </Button>
                              )}
                              
                              {/* Grant subscription */}
                              {(!user.subscription || user.subscription.status === 'cancelled' || user.subscription.status === 'expired') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-primary border-primary hover:bg-primary/10"
                                  disabled={actionLoading === `grant_subscription-${user.id}`}
                                  onClick={() => handleAdminAction('grant_subscription', user.id)}
                                >
                                  {actionLoading === `grant_subscription-${user.id}` ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Gift className="w-3 h-3 mr-1" />
                                  )}
                                  Grant
                                </Button>
                              )}
                              
                              {/* Delete user */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-destructive border-destructive hover:bg-destructive/10"
                                    disabled={actionLoading === `delete_user-${user.id}`}
                                  >
                                    {actionLoading === `delete_user-${user.id}` ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete <strong>{user.email}</strong>? This will permanently remove their account, subscriptions, invoices, and all data. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleAdminAction('delete_user', user.id)}
                                    >
                                      Delete User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Assign New Role
              </CardTitle>
              <CardDescription>
                Enter a user ID to assign admin or moderator privileges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddRole} className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[250px] space-y-2">
                  <Label htmlFor="userId">User ID (UUID)</Label>
                  <Input
                    id="userId"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div className="w-40 space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={isAdding}>
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Assign
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assigned Roles</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : roles.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  No roles assigned yet. Add the first admin above.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assigned On</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-mono text-sm">
                          {role.user_id}
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[role.role]}>
                            {role.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(role.created_at), 'PPp')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRole(role.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-muted-foreground">How to Get User IDs</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Go to the "All Users" tab to see all registered users</p>
              <p>2. Copy the User ID from the user you want to assign a role to</p>
              <p>3. Paste it above and select the desired role</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
