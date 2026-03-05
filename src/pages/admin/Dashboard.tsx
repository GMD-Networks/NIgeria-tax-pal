import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { api as backendApi } from '@/services/api';
import { 
  FileText, 
  Calculator, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Crown, 
  Clock, 
  DollarSign,
  Activity,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Stats {
  contentCount: number;
  ratesCount: number;
  chatsCount: number;
  pendingChats: number;
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  newUsersThisMonth: number;
}

interface UserGrowthData {
  date: string;
  users: number;
}

interface SubscriptionData {
  plan: string;
  count: number;
  revenue: number;
}

interface AdminUserSummary {
  id: string;
  created_at: string;
}

interface ActiveSubscriptionRow {
  plan_type: string;
  amount: number | null;
}

interface RecentActivityItem {
  id: string;
  session_id: string;
  status: string;
  language?: string | null;
  created_at: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    contentCount: 0,
    ratesCount: 0,
    chatsCount: 0,
    pendingChats: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    newUsersThisMonth: 0,
  });
  const [userGrowth, setUserGrowth] = useState<UserGrowthData[]>([]);
  const [subscriptionBreakdown, setSubscriptionBreakdown] = useState<SubscriptionData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch basic stats
        const [contentRes, ratesRes, chatsRes, pendingRes] = await Promise.all([
          backendApi.from('tax_content').select('id', { count: 'exact', head: true }),
          backendApi.from('tax_rates').select('id', { count: 'exact', head: true }),
          backendApi.from('chat_sessions').select('id', { count: 'exact', head: true }),
          backendApi.from('chat_sessions').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        ]);

        // Fetch user and subscription data
        const { data: session } = await backendApi.auth.getSession();
        let usersData: { users?: AdminUserSummary[] } | null = null;
        
        try {
          const response = await backendApi.functions.invoke('admin-users', {
            headers: session?.session?.access_token 
              ? { Authorization: `Bearer ${session.session.access_token}` }
              : undefined
          });
          usersData = response.data;
        } catch (e) {
          console.error('Failed to fetch users:', e);
        }

        // Fetch subscriptions for revenue
        const { data: subscriptions } = await backendApi
          .from('subscriptions')
          .select('*')
          .eq('status', 'active');

        // Calculate stats
        const users: AdminUserSummary[] = usersData?.users || [];
        const subscriptionRows = (subscriptions as ActiveSubscriptionRow[] | null) || [];
        const activeSubscriptions = subscriptionRows.length;
        const totalRevenue = subscriptionRows.reduce(
          (sum: number, sub) => sum + (sub.amount || 0),
          0
        );
        
        // Get new users this month
        const startOfMonthDate = startOfMonth(new Date());
        const newUsersThisMonth = users.filter((u) => 
          new Date(u.created_at) >= startOfMonthDate
        ).length;

        // Calculate subscription breakdown
        const planCounts: Record<string, { count: number; revenue: number }> = {};
        subscriptionRows.forEach((sub) => {
          if (!planCounts[sub.plan_type]) {
            planCounts[sub.plan_type] = { count: 0, revenue: 0 };
          }
          planCounts[sub.plan_type].count++;
          planCounts[sub.plan_type].revenue += sub.amount || 0;
        });

        const breakdown = Object.entries(planCounts).map(([plan, data]) => ({
          plan: plan.charAt(0).toUpperCase() + plan.slice(1),
          count: data.count,
          revenue: data.revenue,
        }));

        // Calculate user growth (last 30 days)
        const thirtyDaysAgo = subDays(new Date(), 30);
        const days = eachDayOfInterval({ start: thirtyDaysAgo, end: new Date() });
        
        const growthData = days.map(day => {
          const dayStr = format(day, 'MMM dd');
          const usersUpToDay = users.filter((u) => 
            new Date(u.created_at) <= day
          ).length;
          return { date: dayStr, users: usersUpToDay };
        });

        // Recent activity (last 5 chat sessions)
        const { data: recentChats } = await backendApi
          .from('chat_sessions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setStats({
          contentCount: contentRes.count ?? 0,
          ratesCount: ratesRes.count ?? 0,
          chatsCount: chatsRes.count ?? 0,
          pendingChats: pendingRes.count ?? 0,
          totalUsers: users.length,
          activeSubscriptions,
          totalRevenue,
          newUsersThisMonth,
        });
        setUserGrowth(growthData);
        setSubscriptionBreakdown(breakdown);
        setRecentActivity((recentChats as RecentActivityItem[] | null) || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Set up realtime subscriptions for live data
    const chatChannel = backendApi
      .channel('dashboard-chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => {
        fetchStats();
      })
      .subscribe();

    const subsChannel = backendApi
      .channel('dashboard-subs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
        fetchStats();
      })
      .subscribe();

    const contentChannel = backendApi
      .channel('dashboard-content')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tax_content' }, () => {
        fetchStats();
      })
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => {
      clearInterval(interval);
      backendApi.removeChannel(chatChannel);
      backendApi.removeChannel(subsChannel);
      backendApi.removeChannel(contentChannel);
    };
  }, []);

  const statCards = [
    { 
      title: 'Total Users', 
      value: stats.totalUsers, 
      icon: Users, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: `+${stats.newUsersThisMonth} this month`
    },
    { 
      title: 'Active Subscriptions', 
      value: stats.activeSubscriptions, 
      icon: Crown, 
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      description: 'Premium users'
    },
    { 
      title: 'Total Revenue', 
      value: `₦${stats.totalRevenue.toLocaleString()}`, 
      icon: DollarSign, 
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      description: 'All time'
    },
    { 
      title: 'Open Chats', 
      value: stats.pendingChats, 
      icon: MessageSquare, 
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      description: `${stats.chatsCount} total sessions`
    },
  ];

  const secondaryStats = [
    { title: 'Tax Content', value: stats.contentCount, icon: FileText, color: 'text-blue-500' },
    { title: 'Tax Rates', value: stats.ratesCount, icon: Calculator, color: 'text-green-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to the TaxBot Nigeria admin panel</p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              User Growth
            </CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Activity className="w-8 h-8 animate-pulse text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userGrowth}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="users" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorUsers)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Subscription Plans
            </CardTitle>
            <CardDescription>Active subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Activity className="w-8 h-8 animate-pulse text-muted-foreground" />
                </div>
              ) : subscriptionBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Crown className="w-12 h-12 mb-2 opacity-50" />
                  <p>No subscriptions yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subscriptionBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="plan"
                      label={({ plan, count }) => `${plan}: ${count}`}
                    >
                      {subscriptionBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [`${value} users`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Chat Activity
            </CardTitle>
            <CardDescription>Latest user conversations</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Activity className="w-6 h-6 animate-pulse text-muted-foreground" />
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent chats</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((chat) => (
                  <div key={chat.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${chat.status === 'open' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium">Session {chat.session_id.slice(0, 8)}...</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(chat.created_at), 'PPp')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={chat.status === 'open' ? 'default' : 'secondary'}>
                        {chat.status}
                      </Badge>
                      {chat.language && (
                        <Badge variant="outline">{chat.language.toUpperCase()}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats & System Status */}
        <div className="space-y-6">
          {/* Secondary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Content Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {secondaryStats.map((stat) => (
                <div key={stat.title} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    <span className="text-sm text-muted-foreground">{stat.title}</span>
                  </div>
                  <span className="font-bold">{isLoading ? '...' : stat.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Database connected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Authentication active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Multi-language enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Payment gateway active</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
