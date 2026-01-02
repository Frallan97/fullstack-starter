import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTrading } from '@/context/TradingContext';
import { formatDate } from '@/lib/formatters';
import { getDaysToExpiry } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, Plus, Trash2, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert as AlertType } from '@/types/options';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Alerts() {
  const { alerts, trades, underlyings, addAlert, deleteAlert, checkAlerts } = useTrading();
  const openTrades = trades.filter(t => t.status === 'open');
  
  const [isOpen, setIsOpen] = useState(false);
  const [newTradeId, setNewTradeId] = useState('');
  const [newType, setNewType] = useState<'expiry' | 'delta'>('expiry');
  const [newThreshold, setNewThreshold] = useState('');

  const handleCreate = () => {
    if (!newTradeId || !newThreshold) {
      toast.error('Please fill all fields');
      return;
    }
    
    const alert: AlertType = {
      id: `alert-${Date.now()}`,
      tradeId: newTradeId,
      type: newType,
      threshold: parseFloat(newThreshold),
      isTriggered: false,
      createdAt: new Date(),
    };
    
    addAlert(alert);
    toast.success('Alert created');
    setIsOpen(false);
    setNewTradeId('');
    setNewThreshold('');
  };

  const handleCheck = () => {
    const triggered = checkAlerts();
    if (triggered.length > 0) {
      toast.warning(`${triggered.length} alert(s) triggered!`);
    } else {
      toast.success('No alerts triggered');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
            <p className="text-sm text-muted-foreground">Monitor expiry and delta thresholds</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCheck}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Check Alerts
            </Button>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New Alert</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Alert</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Trade</Label>
                    <Select value={newTradeId} onValueChange={setNewTradeId}>
                      <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                      <SelectContent>
                        {openTrades.map(t => {
                          const underlying = underlyings.find(u => u.id === t.underlyingId) || t.underlying;
                          return (
                            <SelectItem key={t.id} value={t.id}>
                              {underlying?.symbol || 'Unknown'} - {(t.tags && t.tags[0]) || 'custom'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newType} onValueChange={(v: 'expiry' | 'delta') => setNewType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expiry">Expiry (days)</SelectItem>
                        <SelectItem value="delta">Delta threshold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{newType === 'expiry' ? 'Days until expiry' : 'Delta threshold'}</Label>
                    <Input type="number" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} placeholder={newType === 'expiry' ? '7' : '0.5'} />
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full">Create Alert</Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="trader-panel">
          {alerts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No alerts configured</div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => {
                // Alerts reference underlyingSymbol, not tradeId
                const underlying = underlyings.find(u => u.symbol === alert.underlyingSymbol);
                return (
                  <div key={alert.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {alert.type === 'expiry' ? <Clock className="h-5 w-5 text-theta" /> : <TrendingUp className="h-5 w-5 text-delta" />}
                      <div>
                        <span className="font-medium">{underlying?.symbol || 'Unknown'}</span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {alert.type === 'expiry' ? `≤${alert.threshold} days to expiry` : `Delta ≥${alert.threshold}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={alert.isTriggered ? 'destructive' : 'secondary'}>
                        {alert.isTriggered ? 'Triggered' : 'Active'}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => deleteAlert(alert.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
