'use client';

import { ArrowRight, CheckCircle, Clock, Trash2 } from 'lucide-react';

interface Buyback {
  id: number;
  buy_date: string;
  buy_weight: number;
  buy_price: number;
  cash_spent: number;
}

interface Cycle {
  id: number;
  sell_date: string;
  sell_weight: number;
  sell_price: number;
  cash_generated: number;
  status: 'open' | 'closed';
  buybacks: Buyback[];
}

interface Props {
  cycles: Cycle[];
  onUpdate: () => void;
}

export default function CycleHistory({ cycles, onUpdate }: Props) {
  async function deleteCycle(id: number) {
    if (!confirm('Delete this sale record? This will also reverse any cash balance from this sale.')) return;
    await fetch(`/api/cycles/${id}`, { method: 'DELETE' });
    onUpdate();
  }

  if (cycles.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 border-l-2 border-yellow-500 pl-2 mb-3">Cycle History</h3>
        <p className="text-sm text-zinc-600">No sell-and-rebuy cycles yet. Record a sale to start tracking.</p>
      </div>
    );
  }

  let runningGold = 0;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-200 border-l-2 border-yellow-500 pl-2">Cycle History</h3>
      </div>
      <div className="divide-y divide-zinc-800">
        {cycles.map((cycle, i) => {
          const totalBoughtBack = cycle.buybacks.reduce((s, b) => s + b.buy_weight, 0);
          const netGold = totalBoughtBack - cycle.sell_weight;
          runningGold += netGold;

          return (
            <div key={cycle.id} className="px-5 py-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500">Cycle #{i + 1}</span>
                  {cycle.status === 'closed'
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <Clock className="w-4 h-4 text-yellow-500" />
                  }
                  <span className={`text-xs ${cycle.status === 'closed' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {cycle.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {cycle.status === 'closed' && (
                    <span className={`text-sm font-bold ${netGold > 0 ? 'text-green-400' : 'text-zinc-400'}`}>
                      Net: {netGold > 0 ? '+' : ''}{netGold}B
                    </span>
                  )}
                  <button
                    onClick={() => deleteCycle(cycle.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                    title="Delete this record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div>
                  <div className="text-xs text-zinc-500">{String(cycle.sell_date).split('T')[0]}</div>
                  <div className="text-white font-medium">Sold {cycle.sell_weight}B @ ฿{cycle.sell_price.toLocaleString()}</div>
                  <div className="text-xs text-zinc-400">฿{cycle.cash_generated.toLocaleString()} cash</div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                <div>
                  {cycle.buybacks.length > 0 ? (
                    cycle.buybacks.map(b => (
                      <div key={b.id}>
                        <div className="text-xs text-zinc-500">{String(b.buy_date).split('T')[0]}</div>
                        <div className="text-white font-medium">Bought {b.buy_weight}B @ ฿{b.buy_price.toLocaleString()}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-600 text-sm italic">Waiting for dip...</div>
                  )}
                </div>
              </div>

              {cycle.status === 'closed' && (
                <div className="mt-2 text-xs text-zinc-500">
                  Running total accumulated through cycles: <span className="text-green-400 font-medium">+{runningGold}B</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
