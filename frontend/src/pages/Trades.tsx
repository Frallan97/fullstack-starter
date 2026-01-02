import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTrading } from '@/context/TradingContext';
import { formatCurrency, formatPnL, formatDate, formatPercent, getPnLColor } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Search, Filter, ChevronRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NewTradeDialog } from '@/components/trades/NewTradeDialog';
import { DateFilter } from '@/components/filters/DateFilter';
import { MonthView } from '@/components/views/MonthView';
import { Trade } from '@/types/options';

type DateFilterType = 'start' | 'end' | 'both';

export default function Trades() {
  const { trades, underlyings, getPositions } = useTrading();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('start');
  const [isNewTradeOpen, setIsNewTradeOpen] = useState(false);

  const positions = getPositions();
  const positionMap = new Map(positions.map(p => [p.trade.id, p]));

  // Helper function to get the end date for a trade
  // For closed trades: use closedAt
  // For open trades: use the latest expiry date from option legs
  const getTradeEndDate = (trade: Trade): Date => {
    if (trade.closedAt) {
      return trade.closedAt;
    }
    // For open trades, find the latest expiry date from all legs
    if (!trade.legs || trade.legs.length === 0) {
      return trade.openedAt; // Fallback to opened date if no legs
    }
    const expiryDates = trade.legs.map(leg => leg.option.expiry);
    return new Date(Math.max(...expiryDates.map(d => d.getTime())));
  };

  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      const underlying = underlyings.find(u => u.id === trade.underlyingId) || trade.underlying;
      const matchesSearch =
        (underlying?.symbol || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (underlying?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || trade.status === statusFilter;
      
      // Filter by month/year if selected
      let matchesDate = true;
      if (selectedMonth !== null || selectedYear !== null) {
        let matchesStart = false;
        let matchesEnd = false;
        
        // Check start date (openedAt)
        if (dateFilterType === 'start' || dateFilterType === 'both') {
          const startMonth = trade.openedAt.getMonth();
          const startYear = trade.openedAt.getFullYear();
          const matchesStartMonth = selectedMonth === null || startMonth === selectedMonth;
          const matchesStartYear = selectedYear === null || startYear === selectedYear;
          matchesStart = matchesStartMonth && matchesStartYear;
        }
        
        // Check end date (expiry for open trades, closedAt for closed trades)
        if (dateFilterType === 'end' || dateFilterType === 'both') {
          const endDate = getTradeEndDate(trade);
          const endMonth = endDate.getMonth();
          const endYear = endDate.getFullYear();
          const matchesEndMonth = selectedMonth === null || endMonth === selectedMonth;
          const matchesEndYear = selectedYear === null || endYear === selectedYear;
          matchesEnd = matchesEndMonth && matchesEndYear;
        }
        
        // Combine results based on filter type
        if (dateFilterType === 'both') {
          matchesDate = matchesStart || matchesEnd;
        } else if (dateFilterType === 'start') {
          matchesDate = matchesStart;
        } else { // 'end'
          matchesDate = matchesEnd;
        }
      }
      
      // Filter by specific date if selected (takes precedence)
      if (selectedDate) {
        let matchesStartDate = false;
        let matchesEndDate = false;
        
        if (dateFilterType === 'start' || dateFilterType === 'both') {
          matchesStartDate = trade.openedAt.toDateString() === selectedDate.toDateString();
        }
        
        if (dateFilterType === 'end' || dateFilterType === 'both') {
          const endDate = getTradeEndDate(trade);
          matchesEndDate = endDate.toDateString() === selectedDate.toDateString();
        }
        
        if (dateFilterType === 'both') {
          matchesDate = matchesStartDate || matchesEndDate;
        } else if (dateFilterType === 'start') {
          matchesDate = matchesStartDate;
        } else { // 'end'
          matchesDate = matchesEndDate;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [trades, underlyings, searchQuery, statusFilter, selectedMonth, selectedYear, selectedDate, dateFilterType]);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Trades</h1>
            <p className="text-sm text-muted-foreground">Manage your options trades and positions</p>
          </div>
          <Button onClick={() => setIsNewTradeOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Trade
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by symbol, name, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(['all', 'open', 'closed'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-4 flex-wrap">
            <DateFilter
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onMonthChange={setSelectedMonth}
              onYearChange={setSelectedYear}
            />
            <ToggleGroup
              type="single"
              value={dateFilterType}
              onValueChange={(value) => {
                if (value) setDateFilterType(value as DateFilterType);
              }}
              className="border rounded-md"
            >
              <ToggleGroupItem value="start" aria-label="Filter by start date" size="sm">
                Start Date
              </ToggleGroupItem>
              <ToggleGroupItem value="end" aria-label="Filter by end date" size="sm">
                End Date
              </ToggleGroupItem>
              <ToggleGroupItem value="both" aria-label="Filter by both dates" size="sm">
                Both
              </ToggleGroupItem>
            </ToggleGroup>
            {selectedDate && (
              <Badge variant="secondary" className="gap-2">
                {formatDate(selectedDate)}
                <button
                  onClick={() => setSelectedDate(null)}
                  className="ml-1 hover:opacity-70"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        </div>

        {/* Trades List */}
        <div className="trader-panel">
          {filteredTrades.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No trades found matching your criteria.
            </div>
          ) : (
            <MonthView
              items={filteredTrades}
              getItemDate={(trade) => {
                // Use the appropriate date based on filter type
                if (dateFilterType === 'end') {
                  return getTradeEndDate(trade);
                }
                return trade.openedAt;
              }}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              renderListItem={(trade) => {
                const position = positionMap.get(trade.id);
                const pnl = position?.pnl || 0;
                const pnlPercent = position?.pnlPercent || 0;
                const pnlColor = getPnLColor(pnl);
                const underlying = underlyings.find(u => u.id === trade.underlyingId) || trade.underlying;

                return (
                  <Link
                    key={trade.id}
                    to={`/trades/${trade.id}`}
                    className="group flex items-center justify-between rounded-lg bg-muted/30 px-4 py-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold',
                        trade.status === 'open' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        {(underlying?.symbol || 'UN').slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{underlying?.symbol || 'Unknown'}</span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">
                            {trade.legs?.length || 0} leg{(trade.legs?.length || 0) !== 1 ? 's' : ''}
                          </span>
                          <Badge 
                            variant={trade.status === 'open' ? 'default' : 'secondary'}
                            className="ml-2"
                          >
                            {trade.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Opened {formatDate(trade.openedAt)}
                          </span>
                          {trade.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Leg Summary */}
                      {trade.legs && trade.legs.length > 0 && (
                        <div className="hidden md:block text-right">
                          <div className="text-xs text-muted-foreground">Legs</div>
                          <div className="text-sm text-foreground">
                            {trade.legs.map((leg, idx) => (
                              <span key={leg.id}>
                                {idx > 0 && ', '}
                                {leg.side === 'buy' ? '+' : '-'}{leg.quantity} {leg.option.type.charAt(0).toUpperCase()}{leg.option.strike}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* P&L */}
                      {trade.status === 'open' && position && (
                        <div className="text-right min-w-[100px]">
                          <div className={cn(
                            'font-mono text-sm font-semibold',
                            pnlColor === 'profit' && 'text-profit',
                            pnlColor === 'loss' && 'text-loss',
                            pnlColor === 'neutral' && 'text-muted-foreground'
                          )}>
                            {formatPnL(pnl)}
                          </div>
                          <div className={cn(
                            'font-mono text-xs',
                            pnlColor === 'profit' && 'text-profit/70',
                            pnlColor === 'loss' && 'text-loss/70',
                            pnlColor === 'neutral' && 'text-muted-foreground'
                          )}>
                            {formatPercent(pnlPercent)}
                          </div>
                        </div>
                      )}

                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </Link>
                );
              }}
              emptyMessage="No trades found matching your criteria."
              onDateClick={(date) => {
                if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
                  setSelectedDate(null);
                } else {
                  setSelectedDate(date);
                }
              }}
              selectedDate={selectedDate}
            />
          )}
        </div>
      </div>

      <NewTradeDialog open={isNewTradeOpen} onOpenChange={setIsNewTradeOpen} />
    </MainLayout>
  );
}
