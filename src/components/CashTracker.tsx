'use client';

import { useState } from 'react';
import { CashState } from '@/lib/trading-rules';
import { DollarSign, Clock, PlusCircle } from 'lucide-react';

interface Props {
  cashState: CashState | null;
  currentPrice: number;
  sma: number;
  lowerBand: number;
  avgBuyPrice: number;
  onUpdate: () => void;
}

export default function CashTracker({ cashState, currentPrice, sma, lowerBand, avgBuyPrice, onUpdate }: Props) {
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showBuybackModal, setShowBuybackModal] = useState(false);
  const [saleForm, setSaleForm] = useState({ date: '', weight: '10', price: String(currentPrice) });
  const [buybackForm, setBuybackForm] = useState({ date: '', weight: '5', price: '' });
  const [loading, setLoading] = useState(false);

  const saleDate = cashState?.sale_date ? new Date(cashState.sale_date) : null;
  const daysSinceSale = saleDate
    ? Math.floor((Date.now() - saleDate.getTime()) / 86400000)
    : 0;

  const tier1Price = Math.round(currentPrice * 0.95);
  const tier2Price = sma;
  const tier3Price = Math.max(lowerBand, Math.round(currentPrice * 0.90));

  async function recordSale() {
    setLoading(true);
    try {
      await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sell_date: saleForm.date || new Date().toISOString().split('T')[0],
          sell_weight: parseInt(saleForm.weight),
          sell_price: parseInt(saleForm.price),
        }),
      });
      setShowSaleModal(false);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function recordBuyback() {
    setLoading(true);
    try {
      await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buy_date: buybackForm.date || new Date().toISOString().split('T')[0],
          buy_weight: parseInt(buybackForm.weight),
          buy_price: parseInt(buybackForm.price),
        }),
      });
      setShowBuybackModal(false);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-semibold text-zinc-200 border-l-2 border-yellow-500 pl-2">Cash on Hand</h3>
        </div>
        {cashState && cashState.amount > 0 && daysSinceSale > 0 && (
          <div className={`flex items-center gap-1 text-xs ${daysSinceSale >= 25 ? 'text-yellow-400' : 'text-zinc-500'}`}>
            <Clock className="w-3 h-3" />
            Day {daysSinceSale} / 30
          </div>
        )}
      </div>

      <div className="text-3xl font-bold text-yellow-300 mb-4">
        ฿{(cashState?.amount || 0).toLocaleString()}
      </div>

      {/* Brick affordability progress */}
      {cashState && cashState.amount > 0 && (() => {
        const cash = cashState.amount;
        const cost5 = 5 * currentPrice;
        const cost10 = 10 * currentPrice;
        const pct5 = Math.min(cash / cost5, 1);
        const pct10 = Math.min(cash / cost10, 1);
        const can5 = cash >= cost5;
        const can10 = cash >= cost10;
        // profit portion: cash above what the sold gold originally cost
        // (approximation using portfolio avg buy price × bricks implied by cash)
        const impliedBricks = cash / currentPrice;
        const costBasis = impliedBricks * avgBuyPrice;
        const profitInCash = Math.max(0, cash - costBasis);
        const profitCovers5 = profitInCash >= cost5;

        return (
          <div className="mb-4 space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Brick buying power</p>

            {/* 5B bar */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-zinc-400">5B brick (฿{cost5.toLocaleString()})</span>
                <span className={`text-xs font-semibold ${can5 ? 'text-green-400' : 'text-zinc-400'}`}>
                  {can5 ? '✓ Ready' : `฿${(cost5 - cash).toLocaleString()} short`}
                </span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${can5 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct5 * 100}%` }}
                />
              </div>
              {can5 && profitCovers5 && (
                <p className="text-xs text-green-500 mt-1">Funded entirely by profit — principal untouched.</p>
              )}
            </div>

            {/* 10B bar */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-zinc-400">10B brick (฿{cost10.toLocaleString()})</span>
                <span className={`text-xs font-semibold ${can10 ? 'text-green-400' : 'text-zinc-400'}`}>
                  {can10 ? '✓ Ready' : `฿${(cost10 - cash).toLocaleString()} short`}
                </span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${can10 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct10 * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {cashState && cashState.amount > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Buy-back trigger prices</p>
          {[
            { label: 'Tier 1 (−5% from sell)', price: tier1Price, dist: ((tier1Price - currentPrice) / currentPrice * 100).toFixed(1) },
            { label: 'Tier 2 (SMA)', price: tier2Price, dist: ((tier2Price - currentPrice) / currentPrice * 100).toFixed(1) },
            { label: 'Tier 3 (lower band)', price: tier3Price, dist: ((tier3Price - currentPrice) / currentPrice * 100).toFixed(1) },
          ].map(tier => (
            <div key={tier.label} className="flex justify-between items-center bg-zinc-800 rounded-lg px-3 py-2">
              <span className="text-xs text-zinc-400">{tier.label}</span>
              <div className="text-right">
                <span className="text-sm font-semibold text-white">฿{tier.price.toLocaleString()}</span>
                <span className={`ml-2 text-xs ${parseFloat(tier.dist) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {tier.dist}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowSaleModal(true)}
          className="flex items-center gap-1 text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-2 rounded-lg transition-colors"
        >
          <PlusCircle className="w-3 h-3" /> Record a Sale
        </button>
        {cashState && cashState.amount > 0 && (
          <button
            onClick={() => setShowBuybackModal(true)}
            className="flex items-center gap-1 text-xs bg-blue-900 hover:bg-blue-800 text-blue-200 px-3 py-2 rounded-lg transition-colors"
          >
            <PlusCircle className="w-3 h-3" /> Record Buy-back
          </button>
        )}
      </div>

      {/* Sale Modal */}
      {showSaleModal && (
        <Modal title="Record a Sale" onClose={() => setShowSaleModal(false)}>
          <div className="space-y-3">
            <FormField label="Date" type="date" value={saleForm.date}
              onChange={v => setSaleForm(f => ({ ...f, date: v }))} />
            <FormField label="Weight (baht)" type="number" value={saleForm.weight}
              onChange={v => setSaleForm(f => ({ ...f, weight: v }))} placeholder="5 or 10" />
            <FormField label="Sell Price (฿/baht)" type="number" value={saleForm.price}
              onChange={v => setSaleForm(f => ({ ...f, price: v }))} />
            {saleForm.weight && saleForm.price && (
              <p className="text-xs text-green-400">
                Cash generated: ฿{(parseInt(saleForm.weight) * parseInt(saleForm.price)).toLocaleString()}
              </p>
            )}
            <button
              onClick={recordSale}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Record Sale'}
            </button>
          </div>
        </Modal>
      )}

      {/* Buyback Modal */}
      {showBuybackModal && (
        <Modal title="Record Buy-back" onClose={() => setShowBuybackModal(false)}>
          <div className="space-y-3">
            <FormField label="Date" type="date" value={buybackForm.date}
              onChange={v => setBuybackForm(f => ({ ...f, date: v }))} />
            <FormField label="Weight (baht)" type="number" value={buybackForm.weight}
              onChange={v => setBuybackForm(f => ({ ...f, weight: v }))} placeholder="5 or 10" />
            <FormField label="Buy Price (฿/baht)" type="number" value={buybackForm.price}
              onChange={v => setBuybackForm(f => ({ ...f, price: v }))} />
            {buybackForm.weight && buybackForm.price && (
              <p className="text-xs text-blue-400">
                Cash used: ฿{(parseInt(buybackForm.weight) * parseInt(buybackForm.price)).toLocaleString()}
                {' '}| Remaining: ฿{Math.max(0, (cashState?.amount || 0) - parseInt(buybackForm.weight) * parseInt(buybackForm.price)).toLocaleString()}
              </p>
            )}
            <button
              onClick={recordBuyback}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Record Buy-back'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-white">{title}</h4>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
