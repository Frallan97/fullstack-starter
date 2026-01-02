// Trading cockpit state management using React Context with API integration
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Trade, TradeLeg, Underlying, Alert, JournalEntry, Position, PortfolioSummary, Greeks } from '@/types/options';
import { api } from '@/lib/api-client';
import { calculateLegValue, aggregateGreeks, getDaysToExpiry } from '@/lib/pricing';
import { fetchStockPrice } from '@/lib/alphaVantage';
import { toast } from 'sonner';
import { normalizeTradeWithLegs, normalizeUnderlying, normalizeAlert, normalizeJournalEntry } from '@/lib/api-normalizers';
import { useAuth } from '@/context/AuthContext';

interface TradingState {
  trades: Trade[];
  underlyings: Underlying[];
  alerts: Alert[];
  journalEntries: JournalEntry[];
  isLoading: boolean;
}

interface TradingContextType extends TradingState {
  // Computed values
  getPositions: () => Position[];
  getPortfolioSummary: () => PortfolioSummary;
  getPositionsByUnderlying: () => Map<string, Position[]>;

  // Trade actions
  addTrade: (trade: any) => Promise<void>;
  updateTrade: (tradeId: number, updates: any) => Promise<void>;
  addLegToTrade: (tradeId: string | number, leg: TradeLeg) => Promise<void>;
  removeLegFromTrade: (tradeId: string | number, legId: string) => Promise<void>;
  closeTrade: (tradeId: number) => Promise<void>;
  deleteTrade: (tradeId: number) => Promise<void>;

  // Underlying actions
  updateUnderlyingPrice: (symbol: string, price: number) => Promise<void>;
  fetchAndUpdatePrices: () => Promise<void>;

  // Alert actions
  addAlert: (alert: any) => Promise<void>;
  deleteAlert: (alertId: number) => Promise<void>;
  checkAlerts: () => Alert[];

  // Journal actions
  addJournalEntry: (entry: any) => Promise<void>;
  deleteJournalEntry: (entryId: number) => Promise<void>;
  getJournalEntriesForTrade: (tradeId: string) => JournalEntry[];

  // Refresh data
  refreshData: () => Promise<void>;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [underlyings, setUnderlyings] = useState<Underlying[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedRef = React.useRef(false);

  // Helper to enrich trades with underlying objects
  const enrichTradesWithUnderlyings = useCallback((tradesData: any[], underlyingsData: Underlying[]) => {
    return tradesData.map(trade => {
      const underlying = underlyingsData.find(u => u.id === trade.underlyingId);
      return {
        ...trade,
        underlying: underlying || null,
      };
    });
  }, []);

  // Fetch initial data from API
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [tradesData, underlyingsData, alertsData, journalData] = await Promise.all([
        api.trades.getAll(),
        api.underlyings.getAll(),
        api.alerts.getAll(),
        api.journal.getAll(),
      ]);

      // Normalize data from API to ensure consistent types and defaults
      const normalizedUnderlyings = underlyingsData.map(normalizeUnderlying);
      const normalizedTrades = tradesData.map(normalizeTradeWithLegs);

      // Enrich trades with underlying objects
      const enrichedTrades = enrichTradesWithUnderlyings(normalizedTrades, normalizedUnderlyings);

      setTrades(enrichedTrades);
      setUnderlyings(normalizedUnderlyings);
      setAlerts(alertsData.map(normalizeAlert));
      setJournalEntries(journalData.map(normalizeJournalEntry));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data from server');
    } finally {
      setIsLoading(false);
    }
  }, [enrichTradesWithUnderlyings]);

  // Load data only when authenticated
  useEffect(() => {
    // Don't fetch if auth is still loading
    if (authLoading) return;

    // Only fetch once when authenticated
    if (isAuthenticated && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    } else if (!isAuthenticated) {
      // If not authenticated, set loading to false
      setIsLoading(false);
    }
    // Remove fetchData from deps to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  // Calculate position data for a trade
  const calculatePosition = useCallback((trade: Trade): Position => {
    const underlying = underlyings.find(u => u.id === trade.underlyingId) || trade.underlying;

    let totalValue = 0;
    let totalCost = 0;
    const legGreeks: Greeks[] = [];

    // Handle trades without legs
    if (trade.legs && trade.legs.length > 0) {
      for (const leg of trade.legs) {
        const { value, greeks } = calculateLegValue(
          leg,
          underlying.price,
          underlying.dividendYield
        );
        totalValue += value;

        const contractMultiplier = 100;
        const multiplier = leg.side === 'buy' ? 1 : -1;
        totalCost += leg.premium * leg.quantity * contractMultiplier * multiplier;

        legGreeks.push(greeks);
      }
    }

    const pnl = totalValue - totalCost;
    const pnlPercent = totalCost !== 0 ? pnl / Math.abs(totalCost) : 0;

    return {
      trade,
      currentValue: totalValue,
      pnl,
      pnlPercent,
      greeks: aggregateGreeks(legGreeks),
    };
  }, [underlyings]);

  // Get all positions
  const getPositions = useCallback((): Position[] => {
    return trades
      .filter(t => t.status === 'open')
      .map(trade => calculatePosition(trade));
  }, [trades, calculatePosition]);

  // Get portfolio summary
  const getPortfolioSummary = useCallback((): PortfolioSummary => {
    const positions = getPositions();

    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const todayPnl = totalPnl * 0.15; // Simulated today's P&L (would be calculated from previous close)
    const netGreeks = aggregateGreeks(positions.map(p => p.greeks));

    return {
      totalValue,
      totalPnl,
      todayPnl,
      netGreeks,
      positionCount: positions.length,
    };
  }, [getPositions]);

  // Group positions by underlying
  const getPositionsByUnderlying = useCallback((): Map<string, Position[]> => {
    const positions = getPositions();
    const grouped = new Map<string, Position[]>();

    for (const position of positions) {
      const underlyingId = position.trade.underlyingId;
      if (!grouped.has(underlyingId)) {
        grouped.set(underlyingId, []);
      }
      grouped.get(underlyingId)!.push(position);
    }

    return grouped;
  }, [getPositions]);

  // Trade actions
  const addTrade = useCallback(async (tradeData: any) => {
    try {
      await api.trades.create(tradeData);
      // Refresh trades to get the complete trade with all data
      const updatedTrades = await api.trades.getAll();
      const normalizedTrades = updatedTrades.map(normalizeTradeWithLegs);
      const enrichedTrades = enrichTradesWithUnderlyings(normalizedTrades, underlyings);
      setTrades(enrichedTrades);
      toast.success('Trade created successfully');
    } catch (error) {
      console.error('Failed to create trade:', error);
      toast.error('Failed to create trade');
      throw error;
    }
  }, [enrichTradesWithUnderlyings, underlyings]);

  const updateTrade = useCallback(async (tradeId: number, updates: Partial<Trade>) => {
    try {
      await api.trades.update(tradeId, updates);
      // Refresh to get updated data from backend
      const updatedTrades = await api.trades.getAll();
      const normalizedTrades = updatedTrades.map(normalizeTradeWithLegs);
      const enrichedTrades = enrichTradesWithUnderlyings(normalizedTrades, underlyings);
      setTrades(enrichedTrades);
      toast.success('Trade updated');
    } catch (error) {
      console.error('Failed to update trade:', error);
      toast.error('Failed to update trade');
      throw error;
    }
  }, [enrichTradesWithUnderlyings, underlyings]);

  const addLegToTrade = useCallback(async (tradeId: string | number, leg: TradeLeg) => {
    try {
      // Convert tradeId to number if it's a string
      const numericTradeId = typeof tradeId === 'string' ? parseInt(tradeId, 10) : tradeId;

      // Find the trade to get underlying
      const trade = trades.find(t => t.id === String(tradeId) || t.id === String(numericTradeId));
      if (!trade) {
        throw new Error('Trade not found');
      }

      // Get underlying ID from trade
      const underlying = underlyings.find(u => u.id === trade.underlyingId) || trade.underlying;
      if (!underlying) {
        throw new Error('Underlying not found for trade');
      }

      // Get the numeric ID for backend API (numericId is preserved by normalizer)
      const underlyingNumericId = (underlying as any).numericId;
      if (!underlyingNumericId) {
        throw new Error('Unable to find numeric ID for underlying');
      }

      // Format the expiry date as YYYY-MM-DD
      const expiryDate = leg.option.expiry instanceof Date
        ? leg.option.expiry.toISOString().split('T')[0]
        : new Date(leg.option.expiry).toISOString().split('T')[0];

      // Call the new add leg endpoint
      await api.trades.addLeg(numericTradeId, {
        underlyingId: underlyingNumericId,
        optionType: leg.option.type,
        strikePrice: leg.option.strike,
        expiryDate,
        impliedVolatility: leg.option.iv,
        action: leg.side,
        quantity: leg.quantity,
        entryPrice: leg.entryPrice,
      });

      // Refresh trades to get updated data
      const updatedTrades = await api.trades.getAll();
      const normalizedTrades = updatedTrades.map(normalizeTradeWithLegs);
      const enrichedTrades = enrichTradesWithUnderlyings(normalizedTrades, underlyings);
      setTrades(enrichedTrades);
      toast.success('Leg added successfully');
    } catch (error) {
      console.error('Failed to add leg:', error);
      toast.error('Failed to add leg to trade');
      throw error;
    }
  }, [trades, enrichTradesWithUnderlyings, underlyings]);

  const removeLegFromTrade = useCallback(async (tradeId: string | number, legId: string) => {
    try {
      // Convert tradeId to number if it's a string
      const numericTradeId = typeof tradeId === 'string' ? parseInt(tradeId, 10) : tradeId;
      
      // Convert legId to number (backend expects numeric ID)
      const numericLegId = parseInt(legId, 10);
      if (isNaN(numericLegId)) {
        throw new Error('Invalid leg ID');
      }
      
      // Find the trade to validate it exists and check leg count
      const trade = trades.find(t => t.id === String(tradeId) || t.id === String(numericTradeId));
      if (!trade) {
        throw new Error('Trade not found');
      }

      if (trade.legs.length <= 1) {
        toast.error('Cannot remove the last leg from a trade');
        return;
      }

      // Call the remove leg endpoint
      await api.trades.removeLeg(numericTradeId, numericLegId);

      // Refresh trades to get updated data
      const updatedTrades = await api.trades.getAll();
      const normalizedTrades = updatedTrades.map(normalizeTradeWithLegs);
      const enrichedTrades = enrichTradesWithUnderlyings(normalizedTrades, underlyings);
      setTrades(enrichedTrades);
      toast.success('Leg removed successfully');
    } catch (error) {
      console.error('Failed to remove leg:', error);
      toast.error('Failed to remove leg from trade');
      throw error;
    }
  }, [trades, enrichTradesWithUnderlyings, underlyings]);

  const closeTrade = useCallback(async (tradeId: number) => {
    try {
      await api.trades.close(tradeId);
      // Refresh trades to get updated data
      const updatedTrades = await api.trades.getAll();
      const normalizedTrades = updatedTrades.map(normalizeTradeWithLegs);
      const enrichedTrades = enrichTradesWithUnderlyings(normalizedTrades, underlyings);
      setTrades(enrichedTrades);
      toast.success('Trade closed');
    } catch (error) {
      console.error('Failed to close trade:', error);
      toast.error('Failed to close trade');
      throw error;
    }
  }, [enrichTradesWithUnderlyings, underlyings]);

  const deleteTrade = useCallback(async (tradeId: number) => {
    try {
      await api.trades.delete(tradeId);
      // Refresh all data to ensure consistency
      await fetchData();
      toast.success('Trade deleted');
    } catch (error) {
      console.error('Failed to delete trade:', error);
      toast.error('Failed to delete trade');
      throw error;
    }
  }, [fetchData]);

  // Underlying actions
  const updateUnderlyingPrice = useCallback(async (symbol: string, price: number) => {
    try {
      await api.underlyings.updatePrice(symbol, price);
      // Refresh underlyings to get updated data
      const updatedUnderlyings = await api.underlyings.getAll();
      setUnderlyings(updatedUnderlyings);
      toast.success('Price updated');
    } catch (error) {
      console.error('Failed to update price:', error);
      toast.error('Failed to update price');
      throw error;
    }
  }, []);

  const fetchAndUpdatePrices = useCallback(async () => {
    try {
      // Get current underlyings from state
      const currentUnderlyings = underlyings;
      const priceUpdates: Array<{ symbol: string; price: number }> = [];
      
      for (const underlying of currentUnderlyings) {
        try {
          const price = await fetchStockPrice(underlying.symbol);
          if (price !== null) {
            priceUpdates.push({ symbol: underlying.symbol, price });
            // Update price via API
            await api.underlyings.updatePrice(underlying.symbol, price);
          }
          // Add a small delay to avoid hitting API rate limits (5 calls per minute for free tier)
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Failed to fetch price for ${underlying.symbol}:`, error);
        }
      }

      // Refresh underlyings to get updated data from backend
      if (priceUpdates.length > 0) {
        const updatedUnderlyings = await api.underlyings.getAll();
        setUnderlyings(updatedUnderlyings);
        toast.success(`Updated prices for ${priceUpdates.length} underlyings`);
      }
    } catch (error) {
      console.error('Failed to fetch and update prices:', error);
      toast.error('Failed to update prices');
    }
  }, [underlyings]);

  // Alert actions
  const addAlert = useCallback(async (alertData: any) => {
    try {
      await api.alerts.create(alertData);
      const updatedAlerts = await api.alerts.getAll();
      setAlerts(updatedAlerts.map(normalizeAlert));
      toast.success('Alert created');
    } catch (error) {
      console.error('Failed to create alert:', error);
      toast.error('Failed to create alert');
      throw error;
    }
  }, []);

  const deleteAlert = useCallback(async (alertId: number) => {
    try {
      await api.alerts.delete(alertId);
      const updatedAlerts = await api.alerts.getAll();
      setAlerts(updatedAlerts);
      toast.success('Alert deleted');
    } catch (error) {
      console.error('Failed to delete alert:', error);
      toast.error('Failed to delete alert');
      throw error;
    }
  }, []);

  const checkAlerts = useCallback((): Alert[] => {
    const triggeredAlerts: Alert[] = [];
    const positions = getPositions();
    const positionMap = new Map(positions.map(p => [p.trade.id, p]));

    setAlerts(prev => prev.map(alert => {
      const position = positionMap.get(alert.tradeId);
      if (!position) return alert;

      let shouldTrigger = false;

      if (alert.type === 'expiry') {
        if (position.trade.legs && position.trade.legs.length > 0) {
          const minDaysToExpiry = Math.min(
            ...position.trade.legs.map(leg => getDaysToExpiry(leg.option.expiry))
          );
          shouldTrigger = minDaysToExpiry <= alert.threshold;
        }
      } else if (alert.type === 'delta') {
        shouldTrigger = Math.abs(position.greeks.delta) >= alert.threshold;
      }

      if (shouldTrigger && !alert.isTriggered) {
        triggeredAlerts.push({ ...alert, isTriggered: true, triggeredAt: new Date() });
        return { ...alert, isTriggered: true, triggeredAt: new Date() };
      }

      return alert;
    }));

    return triggeredAlerts;
  }, [getPositions]);

  // Journal actions
  const addJournalEntry = useCallback(async (entryData: any) => {
    try {
      await api.journal.create(entryData);
      const updatedJournal = await api.journal.getAll();
      setJournalEntries(updatedJournal.map(normalizeJournalEntry));
      toast.success('Journal entry created');
    } catch (error) {
      console.error('Failed to create journal entry:', error);
      toast.error('Failed to create journal entry');
      throw error;
    }
  }, []);

  const deleteJournalEntry = useCallback(async (entryId: number) => {
    try {
      await api.journal.delete(entryId);
      const updatedJournal = await api.journal.getAll();
      setJournalEntries(updatedJournal);
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('Failed to delete journal entry:', error);
      toast.error('Failed to delete journal entry');
      throw error;
    }
  }, []);

  const getJournalEntriesForTrade = useCallback((tradeId: string): JournalEntry[] => {
    return journalEntries.filter(e => e.tradeId === tradeId);
  }, [journalEntries]);

  const value = useMemo(() => ({
    trades,
    underlyings,
    alerts,
    journalEntries,
    isLoading,
    getPositions,
    getPortfolioSummary,
    getPositionsByUnderlying,
    addTrade,
    updateTrade,
    addLegToTrade,
    removeLegFromTrade,
    closeTrade,
    deleteTrade,
    updateUnderlyingPrice,
    fetchAndUpdatePrices,
    addAlert,
    deleteAlert,
    checkAlerts,
    addJournalEntry,
    deleteJournalEntry,
    getJournalEntriesForTrade,
    refreshData: fetchData,
  }), [
    trades, underlyings, alerts, journalEntries, isLoading,
    getPositions, getPortfolioSummary, getPositionsByUnderlying,
    addTrade, updateTrade, addLegToTrade, removeLegFromTrade, closeTrade, deleteTrade,
    updateUnderlyingPrice, fetchAndUpdatePrices, addAlert, deleteAlert, checkAlerts,
    addJournalEntry, deleteJournalEntry, getJournalEntriesForTrade,
    fetchData,
  ]);

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading() {
  const context = useContext(TradingContext);
  if (context === undefined) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
}
