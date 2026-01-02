import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTrading } from '@/context/TradingContext';
import { formatCurrency, formatPnL, formatDate, formatGreek, formatIV, formatPercent, getPnLColor, getOptionLabel } from '@/lib/formatters';
import { calculateLegValue, getDaysToExpiry, calculatePayoffCurve } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Clock, TrendingUp, X, Plus, BookOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddLegDialog } from '@/components/trades/AddLegDialog';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function TradeDetail() {
  const { tradeId } = useParams<{ tradeId: string }>();
  const navigate = useNavigate();
  const { trades, underlyings, closeTrade, addJournalEntry, getJournalEntriesForTrade, addLegToTrade, removeLegFromTrade } = useTrading();

  const trade = trades.find(t => t.id === tradeId);
  const [newNote, setNewNote] = useState('');
  const [addLegDialogOpen, setAddLegDialogOpen] = useState(false);

  if (!trade) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Trade not found</p>
          <Button variant="ghost" onClick={() => navigate('/trades')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trades
          </Button>
        </div>
      </MainLayout>
    );
  }

  const underlying = underlyings.find(u => u.id === trade.underlyingId) || trade.underlying;
  const journalEntries = getJournalEntriesForTrade(trade.id);

  // Calculate position metrics
  let totalValue = 0;
  let totalCost = 0;
  const legDetails = trade.legs.map(leg => {
    const { value, greeks } = calculateLegValue(leg, underlying.price, underlying.dividendYield);
    const contractMultiplier = 100;
    const multiplier = leg.side === 'buy' ? 1 : -1;
    const cost = leg.premium * leg.quantity * contractMultiplier * multiplier;
    totalValue += value;
    totalCost += cost;
    
    return {
      leg,
      value,
      cost,
      greeks,
      pnl: value - cost,
      daysToExpiry: getDaysToExpiry(leg.option.expiry),
    };
  });

  const totalPnl = totalValue - totalCost;
  const pnlPercent = totalCost !== 0 ? totalPnl / Math.abs(totalCost) : 0;
  const pnlColor = getPnLColor(totalPnl);

  // Payoff curve
  const payoffData = calculatePayoffCurve(trade.legs, underlying.price);

  const handleCloseTrade = () => {
    closeTrade(trade.id);
    toast.success('Trade closed successfully');
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    addJournalEntry({
      id: `journal-${Date.now()}`,
      tradeId: trade.id,
      note: newNote.trim(),
      createdAt: new Date(),
    });
    setNewNote('');
    toast.success('Note added');
  };

  const handleRemoveLeg = async (legId: string) => {
    if (trade.legs.length <= 1) {
      toast.error('Cannot remove the last leg from a trade');
      return;
    }
    try {
      await removeLegFromTrade(trade.id, legId);
      // Success toast is shown in TradingContext
    } catch (error) {
      // Error toast is shown in TradingContext
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/trades')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-foreground">{underlying.symbol}</h1>
                <Badge variant={trade.status === 'open' ? 'default' : 'secondary'}>
                  {trade.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{underlying.name}</p>
            </div>
          </div>
          {trade.status === 'open' && (
            <Button variant="destructive" onClick={handleCloseTrade}>
              <X className="mr-2 h-4 w-4" />
              Close Trade
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="trader-panel">
            <div className="trader-panel-header">Underlying Price</div>
            <div className="text-2xl font-mono font-bold text-primary">
              {formatCurrency(underlying.price)}
            </div>
          </div>
          <div className="trader-panel">
            <div className="trader-panel-header">P&L</div>
            <div className={cn(
              'text-2xl font-mono font-bold',
              pnlColor === 'profit' && 'text-profit',
              pnlColor === 'loss' && 'text-loss'
            )}>
              {formatPnL(totalPnl)}
            </div>
            <div className={cn(
              'text-sm font-mono',
              pnlColor === 'profit' && 'text-profit/70',
              pnlColor === 'loss' && 'text-loss/70'
            )}>
              {formatPercent(pnlPercent)}
            </div>
          </div>
          <div className="trader-panel">
            <div className="trader-panel-header">Position Value</div>
            <div className="text-2xl font-mono font-bold text-foreground">
              {formatCurrency(Math.abs(totalValue))}
            </div>
          </div>
          <div className="trader-panel">
            <div className="trader-panel-header">Opened</div>
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(trade.openedAt)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Legs Table */}
          <div className="trader-panel">
            <div className="trader-panel-header flex items-center justify-between">
              <span>Legs</span>
              {trade.status === 'open' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddLegDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Leg
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {legDetails.map(({ leg, value, greeks, pnl, daysToExpiry }) => {
                const legPnlColor = getPnLColor(pnl);
                return (
                  <div key={leg.id} className="rounded-lg bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={leg.side === 'buy' ? 'default' : 'secondary'}>
                          {leg.side.toUpperCase()}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {leg.quantity}x {getOptionLabel(leg.option.type, leg.option.strike, leg.option.expiry)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'font-mono font-semibold',
                          legPnlColor === 'profit' && 'text-profit',
                          legPnlColor === 'loss' && 'text-loss'
                        )}>
                          {formatPnL(pnl)}
                        </div>
                        {trade.status === 'open' && trade.legs.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveLeg(leg.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Premium:</span>
                        <span className="ml-2 font-mono">{formatCurrency(leg.premium)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IV:</span>
                        <span className="ml-2 font-mono">{formatIV(leg.option.iv)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <span className="ml-2 font-mono">{formatCurrency(Math.abs(value))}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Days to Expiry:</span>
                        <span className="ml-2 font-mono">{daysToExpiry}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="greek-delta">Δ {formatGreek(greeks.delta, 1)}</span>
                      <span className="greek-gamma">Γ {formatGreek(greeks.gamma, 3)}</span>
                      <span className="greek-theta">Θ {formatGreek(greeks.theta, 1)}</span>
                      <span className="greek-vega">V {formatGreek(greeks.vega, 1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payoff Chart */}
          <div className="trader-panel h-[400px]">
            <div className="trader-panel-header">Payoff at Expiry</div>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={payoffData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="underlyingPrice"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => value.toFixed(0)}
                  label={{ value: 'Underlying Price', position: 'bottom', fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => value.toFixed(0)}
                  label={{ value: 'P&L', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'P&L']}
                  labelFormatter={(label) => `Price: ${formatCurrency(label as number)}`}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ReferenceLine x={underlying.price} stroke="hsl(var(--primary))" strokeDasharray="5 5" />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tags & Journal */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tags */}
          <div className="trader-panel">
            <div className="trader-panel-header">Tags</div>
            <div className="flex flex-wrap gap-2">
              {trade.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-sm">
                  {tag}
                </Badge>
              ))}
              {trade.tags.length === 0 && (
                <span className="text-sm text-muted-foreground">No tags</span>
              )}
            </div>
          </div>

          {/* Journal */}
          <div className="trader-panel">
            <div className="trader-panel-header flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Trade Journal
            </div>
            <div className="space-y-3">
              {journalEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg bg-muted/30 p-3">
                  <p className="text-sm text-foreground">{entry.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                </div>
              ))}
              {journalEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">No journal entries yet.</p>
              )}
              <div className="flex gap-2 mt-4">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <Button onClick={handleAddNote} disabled={!newNote.trim()} className="mt-2">
                <Plus className="mr-2 h-4 w-4" />
                Add Note
              </Button>
            </div>
          </div>
        </div>
      </div>

      {trade && (
        <AddLegDialog
          open={addLegDialogOpen}
          onOpenChange={setAddLegDialogOpen}
          tradeId={trade.id}
        />
      )}
    </MainLayout>
  );
}
