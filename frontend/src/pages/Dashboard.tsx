import { MainLayout } from '@/components/layout/MainLayout';
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary';
import { PositionsTable } from '@/components/dashboard/PositionsTable';
import { GreeksChart } from '@/components/dashboard/GreeksChart';
import { UnderlyingsList } from '@/components/dashboard/UnderlyingsList';

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Portfolio Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitor your options positions and risk exposure</p>
        </div>

        {/* Summary Cards */}
        <PortfolioSummary />

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Positions Table - Takes 2 columns */}
          <div className="lg:col-span-2">
            <PositionsTable />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <GreeksChart />
            <UnderlyingsList />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
