import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTrading } from '@/context/TradingContext';
import { calculateLegValue, aggregateGreeks, calculatePayoffCurve } from '@/lib/pricing';
import { formatCurrency, formatPnL, formatGreek, formatPercent, getPnLColor } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw, TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';

export default function Scenario() {
  const { trades, underlyings } = useTrading();
  const openTrades = trades.filter(t => t.status === 'open');

  const [selectedTradeId, setSelectedTradeId] = useState<string>(openTrades[0]?.id || '');
  const [priceChange, setPriceChange] = useState(0);
  const [ivChange, setIvChange] = useState(0);
  const [daysForward, setDaysForward] = useState(0);

  const selectedTrade = trades.find(t => t.id === selectedTradeId);
  const underlying = selectedTrade 
    ? underlyings.find(u => u.id === selectedTrade.underlyingId) || selectedTrade.underlying
    : null;

  // Calculate base and scenario values
  const results = useMemo(() => {
    if (!selectedTrade || !underlying) return null;

    const scenarioPrice = underlying.price * (1 + priceChange / 100);
    
    // Base case (current)
    let baseValue = 0;
    let baseCost = 0;
    const baseGreeks: ReturnType<typeof calculateLegValue>['greeks'][] = [];

    // Scenario case
    let scenarioValue = 0;
    const scenarioGreeks: ReturnType<typeof calculateLegValue>['greeks'][] = [];

    const contractMultiplier = 100;

    if (!selectedTrade.legs || selectedTrade.legs.length === 0) {
      return null;
    }

    for (const leg of selectedTrade.legs) {
      // Base calculation
      const baseResult = calculateLegValue(leg, underlying.price, underlying.dividendYield);
      baseValue += baseResult.value;
      baseGreeks.push(baseResult.greeks);
      
      const multiplier = leg.side === 'buy' ? 1 : -1;
      baseCost += leg.premium * leg.quantity * contractMultiplier * multiplier;

      // Scenario calculation - adjust IV and time
      const adjustedLeg = {
        ...leg,
        option: {
          ...leg.option,
          iv: leg.option.iv + ivChange / 100,
          expiry: new Date(leg.option.expiry.getTime() - daysForward * 24 * 60 * 60 * 1000),
        },
      };
      const scenarioResult = calculateLegValue(adjustedLeg, scenarioPrice, underlying.dividendYield);
      scenarioValue += scenarioResult.value;
      scenarioGreeks.push(scenarioResult.greeks);
    }

    const basePnl = baseValue - baseCost;
    const scenarioPnl = scenarioValue - baseCost;
    const pnlDelta = scenarioPnl - basePnl;

    return {
      base: {
        price: underlying.price,
        value: baseValue,
        pnl: basePnl,
        greeks: aggregateGreeks(baseGreeks),
      },
      scenario: {
        price: scenarioPrice,
        value: scenarioValue,
        pnl: scenarioPnl,
        greeks: aggregateGreeks(scenarioGreeks),
      },
      pnlDelta,
    };
  }, [selectedTrade, underlying, priceChange, ivChange, daysForward]);

  // Generate payoff comparison data
  const payoffData = useMemo(() => {
    if (!selectedTrade || !underlying || !selectedTrade.legs || selectedTrade.legs.length === 0) return [];

    const basePayoff = calculatePayoffCurve(selectedTrade.legs, underlying.price, 0.3, 50);
    
    // Current value line (with time value)
    const currentPoints = basePayoff.map(point => {
      let value = 0;
      for (const leg of selectedTrade.legs) {
        const adjustedLeg = {
          ...leg,
          option: {
            ...leg.option,
            iv: leg.option.iv + ivChange / 100,
            expiry: new Date(leg.option.expiry.getTime() - daysForward * 24 * 60 * 60 * 1000),
          },
        };
        const { value: legValue } = calculateLegValue(adjustedLeg, point.underlyingPrice, underlying.dividendYield);
        value += legValue;
      }
      // Subtract initial cost
      const contractMultiplier = 100;
      let cost = 0;
      for (const leg of selectedTrade.legs) {
        const multiplier = leg.side === 'buy' ? 1 : -1;
        cost += leg.premium * leg.quantity * contractMultiplier * multiplier;
      }
      return {
        underlyingPrice: point.underlyingPrice,
        expiryPnl: point.profit,
        currentPnl: value - cost,
      };
    });

    return currentPoints;
  }, [selectedTrade, underlying, ivChange, daysForward]);

  const resetScenario = () => {
    setPriceChange(0);
    setIvChange(0);
    setDaysForward(0);
  };

  if (openTrades.length === 0) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">No Open Trades</p>
          <p className="text-sm text-muted-foreground">Create a trade to run scenario analysis</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Scenario Analysis</h1>
            <p className="text-sm text-muted-foreground">Simulate price, volatility, and time changes</p>
          </div>
          <Button variant="outline" onClick={resetScenario}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Trade Selection */}
        <div className="trader-panel">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <Label className="text-xs text-muted-foreground mb-2 block">Select Trade</Label>
              <Select value={selectedTradeId} onValueChange={setSelectedTradeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a trade" />
                </SelectTrigger>
                <SelectContent>
                  {openTrades.map((trade) => {
                    const tradeUnderlying = underlyings.find(u => u.id === trade.underlyingId) || trade.underlying;
                    const legCount = trade.legs?.length || 0;
                    return (
                      <SelectItem key={trade.id} value={trade.id}>
                        {tradeUnderlying?.symbol || 'Unknown'} - {legCount} leg{legCount > 1 ? 's' : ''} ({(trade.tags && trade.tags[0]) || 'custom'})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {underlying && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Current Price</span>
                <span className="text-lg font-mono font-bold text-primary">
                  {formatCurrency(underlying.price)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Scenario Controls */}
          <div className="space-y-6">
            {/* Price Change */}
            <div className="trader-panel">
              <div className="flex items-center gap-2 mb-4">
                {priceChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-profit" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss" />
                )}
                <span className="trader-panel-header mb-0">Price Change</span>
              </div>
              <Slider
                value={[priceChange]}
                onValueChange={([v]) => setPriceChange(v)}
                min={-30}
                max={30}
                step={1}
                className="mb-2"
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">-30%</span>
                <span className={cn(
                  'font-mono font-bold',
                  priceChange > 0 && 'text-profit',
                  priceChange < 0 && 'text-loss',
                  priceChange === 0 && 'text-muted-foreground'
                )}>
                  {priceChange >= 0 ? '+' : ''}{priceChange}%
                </span>
                <span className="text-muted-foreground">+30%</span>
              </div>
              {underlying && results && (
                <div className="mt-2 text-center font-mono text-sm text-primary">
                  → {formatCurrency(results.scenario.price)}
                </div>
              )}
            </div>

            {/* IV Change */}
            <div className="trader-panel">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-vega" />
                <span className="trader-panel-header mb-0">IV Change</span>
              </div>
              <Slider
                value={[ivChange]}
                onValueChange={([v]) => setIvChange(v)}
                min={-20}
                max={20}
                step={1}
                className="mb-2"
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">-20%</span>
                <span className={cn(
                  'font-mono font-bold',
                  ivChange > 0 && 'text-profit',
                  ivChange < 0 && 'text-loss',
                  ivChange === 0 && 'text-muted-foreground'
                )}>
                  {ivChange >= 0 ? '+' : ''}{ivChange}%
                </span>
                <span className="text-muted-foreground">+20%</span>
              </div>
            </div>

            {/* Days Forward */}
            <div className="trader-panel">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-theta" />
                <span className="trader-panel-header mb-0">Days Forward</span>
              </div>
              <Slider
                value={[daysForward]}
                onValueChange={([v]) => setDaysForward(v)}
                min={0}
                max={30}
                step={1}
                className="mb-2"
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Today</span>
                <span className="font-mono font-bold text-theta">
                  +{daysForward} days
                </span>
                <span className="text-muted-foreground">+30</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Comparison Cards */}
            {results && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Base Case */}
                <div className="trader-panel border-l-4 border-l-muted-foreground">
                  <div className="trader-panel-header">Current</div>
                  <div className={cn(
                    'text-2xl font-mono font-bold',
                    getPnLColor(results.base.pnl) === 'profit' && 'text-profit',
                    getPnLColor(results.base.pnl) === 'loss' && 'text-loss'
                  )}>
                    {formatPnL(results.base.pnl)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="greek-delta">Δ {formatGreek(results.base.greeks.delta, 1)}</span>
                    <span className="greek-gamma">Γ {formatGreek(results.base.greeks.gamma, 2)}</span>
                    <span className="greek-theta">Θ {formatGreek(results.base.greeks.theta, 1)}</span>
                    <span className="greek-vega">V {formatGreek(results.base.greeks.vega, 1)}</span>
                  </div>
                </div>

                {/* Scenario Case */}
                <div className="trader-panel border-l-4 border-l-primary">
                  <div className="trader-panel-header">Scenario</div>
                  <div className={cn(
                    'text-2xl font-mono font-bold',
                    getPnLColor(results.scenario.pnl) === 'profit' && 'text-profit',
                    getPnLColor(results.scenario.pnl) === 'loss' && 'text-loss'
                  )}>
                    {formatPnL(results.scenario.pnl)}
                  </div>
                  <div className={cn(
                    'text-sm font-mono mt-1',
                    results.pnlDelta > 0 && 'text-profit',
                    results.pnlDelta < 0 && 'text-loss',
                    results.pnlDelta === 0 && 'text-muted-foreground'
                  )}>
                    {results.pnlDelta >= 0 ? '+' : ''}{formatCurrency(results.pnlDelta)} vs current
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="greek-delta">Δ {formatGreek(results.scenario.greeks.delta, 1)}</span>
                    <span className="greek-gamma">Γ {formatGreek(results.scenario.greeks.gamma, 2)}</span>
                    <span className="greek-theta">Θ {formatGreek(results.scenario.greeks.theta, 1)}</span>
                    <span className="greek-vega">V {formatGreek(results.scenario.greeks.vega, 1)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payoff Chart */}
            <div className="trader-panel h-[350px]">
              <div className="trader-panel-header">P&L Profile</div>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={payoffData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="underlyingPrice"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => value.toFixed(0)}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => value.toFixed(0)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'expiryPnl' ? 'At Expiry' : 'Current Scenario'
                    ]}
                    labelFormatter={(label) => `Price: ${formatCurrency(label as number)}`}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  {underlying && (
                    <ReferenceLine x={underlying.price} stroke="hsl(var(--primary))" strokeDasharray="5 5" />
                  )}
                  <Area
                    type="monotone"
                    dataKey="expiryPnl"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted) / 0.3)"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                  />
                  <Area
                    type="monotone"
                    dataKey="currentPnl"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
