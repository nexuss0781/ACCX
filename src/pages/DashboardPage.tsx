import { useMemo } from 'react';
import { useStore } from '../store';
import Header from '../components/layout/Header';
import { KeyRound, FolderOpen, Tag, StickyNote, TrendingUp, Star, Plus, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { timeAgo } from '../utils';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { accounts, categories, folders, notes, activities } = useStore();
  const navigate = useNavigate();

  const metrics = useMemo(() => [
    { label: 'Total Accounts', value: accounts.length, icon: KeyRound, color: '#6366f1', change: '+2 this month', up: true },
    { label: 'Folders', value: folders.length, icon: FolderOpen, color: '#3b82f6', change: '+1 this week', up: true },
    { label: 'Categories', value: categories.length, icon: Tag, color: '#10b981', change: 'Active', up: true },
    { label: 'Notes', value: notes.length, icon: StickyNote, color: '#f59e0b', change: '+3 this week', up: true },
  ], [accounts, folders, categories, notes]);

  const favoriteAccounts = useMemo(() => accounts.filter(a => a.favorite).slice(0, 5), [accounts]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    accounts.forEach(a => {
      const cat = categories.find(c => c.id === a.categoryId);
      if (cat) counts[cat.name] = (counts[cat.name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [accounts, categories]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    return months.map((month, i) => ({
      name: month,
      accounts: Math.floor(Math.random() * 5) + 2 + i,
      notes: Math.floor(Math.random() * 3) + 1 + Math.floor(i / 2),
    }));
  }, []);

  const pieColors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'];

  const activityIcon = (type: string) => {
    switch (type) {
      case 'create': return <Plus className="w-3.5 h-3.5" />;
      case 'update': return <ArrowUpRight className="w-3.5 h-3.5" />;
      case 'delete': return <ArrowDownRight className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const activityColor = (type: string) => {
    switch (type) {
      case 'create': return 'bg-success-subtle text-success-theme';
      case 'update': return 'bg-info-subtle text-info-theme';
      case 'delete': return 'bg-danger-subtle text-danger-theme';
      default: return 'bg-bg-raised text-text-secondary';
    }
  };

  const entityColor = (entity: string) => {
    switch (entity) {
      case 'account': return '#6366f1';
      case 'note': return '#f59e0b';
      case 'category': return '#10b981';
      case 'folder': return '#3b82f6';
      default: return '#64748b';
    }
  };

  return (
    <div>
      <Header title="Dashboard" subtitle="Overview of your vault" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className="bg-bg-surface rounded-2xl border border-border-theme p-5 card-hover animate-fade-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${m.color}12` }}>
                <m.icon className="w-5 h-5" style={{ color: m.color }} />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                {m.change}
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary">{m.value}</p>
            <p className="text-sm text-text-muted mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-bg-surface rounded-2xl border border-border-theme p-5">
          <h3 className="text-base font-semibold text-text-primary mb-4">Growth Overview</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAccounts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNotes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              />
              <Area type="monotone" dataKey="accounts" stroke="#6366f1" strokeWidth={2} fill="url(#colorAccounts)" />
              <Area type="monotone" dataKey="notes" stroke="#f59e0b" strokeWidth={2} fill="url(#colorNotes)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-bg-surface rounded-2xl border border-border-theme p-5">
          <h3 className="text-base font-semibold text-text-primary mb-4">By Category</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={index} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {categoryData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                      <span className="text-text-secondary">{item.name}</span>
                    </div>
                    <span className="font-medium text-text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted text-center py-8">No categories yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-surface rounded-2xl border border-border-theme p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary">Favorites</h3>
            <button
              onClick={() => navigate('/accounts')}
              className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
            >
              View all
            </button>
          </div>
          {favoriteAccounts.length > 0 ? (
            <div className="space-y-2">
              {favoriteAccounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-bg-raised transition-colors cursor-pointer" onClick={() => navigate('/accounts')}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: entityColor('account') }}>
                    {acc.title.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{acc.title}</p>
                    <p className="text-xs text-text-muted truncate">{acc.username || acc.email}</p>
                  </div>
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-8">No favorite accounts</p>
          )}
        </div>

        <div className="bg-bg-surface rounded-2xl border border-border-theme p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary">Recent Activity</h3>
          </div>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.slice(0, 6).map(act => (
                <div key={act.id} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activityColor(act.type)}`}>
                    {activityIcon(act.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">
                      <span className="font-medium">{act.type === 'create' ? 'Created' : act.type === 'update' ? 'Updated' : 'Deleted'}</span>
                      {' '}<span className="font-medium" style={{ color: entityColor(act.entity) }}>{act.entityName}</span>
                    </p>
                    <p className="text-xs text-text-muted">{timeAgo(act.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-8">No activity yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
