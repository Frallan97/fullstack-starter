import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTrading } from '@/context/TradingContext';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface StockPrice {
  symbol: string;
  close: number;
  change_abs: number;
  change_pct: number;
  high: number;
  low: number;
}

interface OptionData {
  id: number;
  optionName: string;
  optionType: 'call' | 'put';
  strikePrice: number;
  expiryDate: string;
  buyPrice: number | null;
  sellPrice: number | null;
  buyQuantity: number;
  sellQuantity: number;
}

export default function OptionsAndTerms() {
  const { underlyings, addTrade } = useTrading();
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [options, setOptions] = useState<OptionData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load stocks on mount
  useEffect(() => {
    loadStocks();
  }, [selectedDate]);

  // Load options when symbol changes
  useEffect(() => {
    if (selectedSymbol) {
      loadOptions(selectedSymbol);
    } else {
      setOptions([]);
    }
  }, [selectedSymbol, selectedDate]);

  const loadStocks = async () => {
    try {
      setLoading(true);
      const data = await api.stocks.getAll(selectedDate || undefined);
      setStocks(data);
      // Auto-select first stock if none selected
      if (!selectedSymbol && data.length > 0) {
        setSelectedSymbol(data[0].symbol);
      }
    } catch (error) {
      console.error('Failed to load stocks:', error);
      toast.error('Failed to load stocks');
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async (symbol: string) => {
    try {
      setLoading(true);
      const data = await api.stocks.getOptions(symbol, selectedDate || undefined);
      setOptions(data);
    } catch (error) {
      console.error('Failed to load options:', error);
      toast.error('Failed to load options');
    } finally {
      setLoading(false);
    }
  };

  const selectedStock = stocks.find(s => s.symbol === selectedSymbol);

  // Group options by strike price
  const optionsByStrike = useMemo(() => {
    const grouped = new Map<number, { calls: OptionData[]; puts: OptionData[] }>();
    
    options.forEach(opt => {
      if (!grouped.has(opt.strikePrice)) {
        grouped.set(opt.strikePrice, { calls: [], puts: [] });
      }
      const group = grouped.get(opt.strikePrice)!;
      if (opt.optionType === 'call') {
        group.calls.push(opt);
      } else {
        group.puts.push(opt);
      }
    });

    // Sort by strike price
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [options]);

  // Filter options by search query
  const filteredOptionsByStrike = useMemo(() => {
    if (!searchQuery) return optionsByStrike;
    
    const query = searchQuery.toLowerCase();
    return optionsByStrike.filter(([strike, { calls, puts }]) => {
      return calls.some(c => c.optionName.toLowerCase().includes(query)) ||
             puts.some(p => p.optionName.toLowerCase().includes(query));
    });
  }, [optionsByStrike, searchQuery]);

  const handleBuy = async (option: OptionData) => {
    try {
      if (!option.buyPrice) {
        toast.error('Buy price not available');
        return;
      }

      // Create trade with one leg
      await addTrade({
        strategy: 'single_leg',
        underlyingSymbol: selectedSymbol,
        entryDate: new Date().toISOString().split('T')[0],
        initialCost: option.buyPrice * 100, // Assuming contract size 100
        notes: `Bought ${option.optionName}`,
        legs: [{
          optionContractId: option.id,
          action: 'buy',
          quantity: 1,
          entryPrice: option.buyPrice,
        }],
      });
      
      toast.success(`Trade created: Bought ${option.optionName}`);
    } catch (error) {
      console.error('Failed to create trade:', error);
      toast.error('Failed to create trade');
    }
  };

  const handleSell = async (option: OptionData) => {
    try {
      if (!option.sellPrice) {
        toast.error('Sell price not available');
        return;
      }

      // Create trade with one leg
      await addTrade({
        strategy: 'single_leg',
        underlyingSymbol: selectedSymbol,
        entryDate: new Date().toISOString().split('T')[0],
        initialCost: -(option.sellPrice * 100), // Negative for sell
        notes: `Sold ${option.optionName}`,
        legs: [{
          optionContractId: option.id,
          action: 'sell',
          quantity: 1,
          entryPrice: option.sellPrice,
        }],
      });
      
      toast.success(`Trade created: Sold ${option.optionName}`);
    } catch (error) {
      console.error('Failed to create trade:', error);
      toast.error('Failed to create trade');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Risk Warning */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Investments involve a risk</h3>
              <p className="text-sm text-muted-foreground">
                These products are complicated and not suitable for everyone. Make sure you understand the risks 
                and how the products work before investing. Investments can both increase and decrease in value, 
                and you may not get back the full amount invested.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="ml-4">
              More about options & terms
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for option name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Underlying" />
            </SelectTrigger>
            <SelectContent>
              {stocks.map(stock => (
                <SelectItem key={stock.symbol} value={stock.symbol}>
                  {stock.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[150px]"
            />
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>

          <Button variant="outline" onClick={() => {
            setSearchQuery('');
            setSelectedDate('');
          }}>
            Clear
          </Button>
        </div>

        {/* Stock Information */}
        {selectedStock && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{selectedSymbol}</h2>
              <Badge variant="outline">Stock</Badge>
            </div>
            <div className="grid grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">+/-</div>
                <div className={cn(
                  "font-semibold",
                  selectedStock.change_abs >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(selectedStock.change_abs)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">+/-%</div>
                <div className={cn(
                  "font-semibold",
                  selectedStock.change_pct >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatPercent(selectedStock.change_pct)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Latest</div>
                <div className="font-semibold">{formatCurrency(selectedStock.close)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Highest</div>
                <div className="font-semibold">{formatCurrency(selectedStock.high)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Lowest</div>
                <div className="font-semibold">{formatCurrency(selectedStock.low)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Options Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_1fr] gap-0">
            {/* Call Options Header */}
            <div className="bg-muted/50 p-3 font-semibold text-center border-b border-r">
              Call Options
            </div>
            
            {/* Strike Price Header */}
            <div className="bg-primary/10 p-3 font-semibold text-center border-b">
              Strike
            </div>
            
            {/* Put Options Header */}
            <div className="bg-muted/50 p-3 font-semibold text-center border-b border-l">
              Put Options
            </div>

            {/* Options Rows */}
            {filteredOptionsByStrike.length === 0 ? (
              <div className="col-span-3 p-8 text-center text-muted-foreground">
                {loading ? 'Loading options...' : 'No options found'}
              </div>
            ) : (
              filteredOptionsByStrike.map(([strike, { calls, puts }]) => (
                <div key={strike} className="contents">
                  {/* Call Options Column */}
                  <div className="border-r border-b">
                    {calls.map((call) => (
                      <div key={call.id} className="grid grid-cols-[80px_80px_1fr_80px_80px_80px_80px] gap-2 p-2 border-b last:border-b-0 items-center text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBuy(call)}
                          disabled={!call.buyPrice}
                        >
                          Buy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSell(call)}
                          disabled={!call.sellPrice}
                        >
                          Sell
                        </Button>
                        <div className="font-medium">{call.optionName}</div>
                        <div className="text-muted-foreground">{call.buyQuantity}</div>
                        <div>{call.buyPrice ? formatCurrency(call.buyPrice) : '—'}</div>
                        <div>{call.sellPrice ? formatCurrency(call.sellPrice) : '—'}</div>
                        <div className="text-muted-foreground">{call.sellQuantity}</div>
                      </div>
                    ))}
                    {calls.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground text-center">—</div>
                    )}
                  </div>

                  {/* Strike Price Column */}
                  <div className="bg-primary/5 border-b text-center p-2 font-semibold">
                    {strike}
                  </div>

                  {/* Put Options Column */}
                  <div className="border-l border-b">
                    {puts.map((put) => (
                      <div key={put.id} className="grid grid-cols-[70px_70px_70px_70px_1fr_70px_70px] gap-2 p-2 border-b last:border-b-0 items-center text-sm">
                        <div className="text-muted-foreground">{put.buyQuantity}</div>
                        <div>{put.buyPrice ? formatCurrency(put.buyPrice) : '—'}</div>
                        <div>{put.sellPrice ? formatCurrency(put.sellPrice) : '—'}</div>
                        <div className="text-muted-foreground">{put.sellQuantity}</div>
                        <div className="font-medium">{put.optionName}</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBuy(put)}
                          disabled={!put.buyPrice}
                          className="min-w-[60px]"
                        >
                          Buy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSell(put)}
                          disabled={!put.sellPrice}
                          className="min-w-[60px]"
                        >
                          Sell
                        </Button>
                      </div>
                    ))}
                    {puts.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground text-center">—</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

