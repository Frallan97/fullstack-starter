import { MainLayout } from '@/components/layout/MainLayout';
import { useTrading } from '@/context/TradingContext';
import { formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Journal() {
  const { journalEntries, trades, underlyings } = useTrading();
  const sortedEntries = [...journalEntries].sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Trade Journal</h1>
          <p className="text-sm text-muted-foreground">Your trading notes and observations</p>
        </div>

        <div className="trader-panel">
          {sortedEntries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No journal entries yet. Add notes from the trade detail page.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedEntries.map(entry => {
                const trade = trades.find(t => t.id === entry.tradeId);
                const underlying = trade
                  ? underlyings.find(u => u.id === trade.underlyingId) || trade.underlying
                  : null;
                return (
                  <Link key={entry.id} to={`/trades/${entry.tradeId}`} className="block rounded-lg bg-muted/30 p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-foreground">{underlying?.symbol || 'Unknown'}</span>
                      {trade?.tags && trade.tags.length > 0 && trade.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                      <span className="ml-auto text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground/80">{entry.note}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
