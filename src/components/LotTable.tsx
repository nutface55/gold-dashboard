'use client';

import { useState } from 'react';
import { Lot, isForeverLot, isLockedLot } from '@/lib/trading-rules';
import { Star, Lock, LockOpen, Pencil, Trash2, Plus, Check, X } from 'lucide-react';

interface Props {
  lots: Lot[];
  currentSellPrice: number;
  onUpdate: () => void;
}

export default function LotTable({ lots, currentSellPrice, onUpdate }: Props) {
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Lot>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ date_bought: '', weight: '5', buy_price: '', notes: '' });
  const [loading, setLoading] = useState(false);

  function startEdit(lot: Lot) {
    setEditId(lot.id);
    setEditForm({ ...lot });
  }

  async function saveEdit() {
    if (!editId) return;
    setLoading(true);
    try {
      await fetch(`/api/lots/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditId(null);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function deleteLot(id: number) {
    if (!confirm('Delete this lot?')) return;
    setLoading(true);
    try {
      await fetch(`/api/lots/${id}`, { method: 'DELETE' });
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function toggleLock(lot: Lot) {
    setLoading(true);
    try {
      await fetch(`/api/lots/${lot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lot, is_forever: !lot.is_forever }),
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function addLot() {
    setLoading(true);
    try {
      await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_bought: addForm.date_bought || new Date().toISOString().split('T')[0],
          weight: parseInt(addForm.weight),
          buy_price: parseInt(addForm.buy_price),
          notes: addForm.notes || 'Ausiris',
        }),
      });
      setShowAdd(false);
      setAddForm({ date_bought: '', weight: '5', buy_price: '', notes: '' });
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-zinc-200 border-l-2 border-yellow-500 pl-2">Lot Inventory</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-xs bg-green-900 hover:bg-green-800 text-green-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Lot
        </button>
      </div>

      {showAdd && (
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-400">Date</label>
              <input type="date" value={addForm.date_bought}
                onChange={e => setAddForm(f => ({ ...f, date_bought: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Weight (baht)</label>
              <select value={addForm.weight}
                onChange={e => setAddForm(f => ({ ...f, weight: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm">
                <option value="5">5 baht</option>
                <option value="10">10 baht</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Buy Price (฿/baht)</label>
              <input type="number" value={addForm.buy_price} placeholder="e.g. 75000"
                onChange={e => setAddForm(f => ({ ...f, buy_price: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Notes</label>
              <input type="text" value={addForm.notes} placeholder="Ausiris"
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
            </div>
          </div>
          <button onClick={addLot} disabled={loading}
            className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-1.5 rounded-lg">
            {loading ? 'Adding...' : 'Add Lot'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase border-b border-slate-800">
              <th className="text-left px-4 py-3">Lot</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-right px-4 py-3">Weight</th>
              <th className="text-right px-4 py-3">Buy Price</th>
              <th className="text-right px-4 py-3">Current Value</th>
              <th className="text-right px-4 py-3">P&L ฿</th>
              <th className="text-right px-4 py-3">P&L %</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lots.map((lot, i) => {
              const autoForever = isForeverLot(lot, currentSellPrice);
              const manualLock = lot.is_forever && !autoForever;
              const isLocked = autoForever || manualLock;
              const currentValue = lot.weight * currentSellPrice;
              const invested = lot.weight * lot.buy_price;
              const pnlAmt = currentValue - invested;
              const pnlPct = ((currentSellPrice - lot.buy_price) / lot.buy_price) * 100;

              if (editId === lot.id) {
                return (
                  <tr key={lot.id} className="border-b border-slate-800 bg-slate-800/50">
                    <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2">
                      <input type="date" value={String(editForm.date_bought || '')}
                        onChange={e => setEditForm(f => ({ ...f, date_bought: e.target.value }))}
                        className="bg-slate-700 rounded px-2 py-1 text-white text-xs w-32" />
                    </td>
                    <td className="px-4 py-2">
                      <select value={editForm.weight}
                        onChange={e => setEditForm(f => ({ ...f, weight: parseInt(e.target.value) }))}
                        className="bg-slate-700 rounded px-2 py-1 text-white text-xs">
                        <option value={5}>5B</option>
                        <option value={10}>10B</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={editForm.buy_price || ''}
                        onChange={e => setEditForm(f => ({ ...f, buy_price: parseInt(e.target.value) }))}
                        className="bg-slate-700 rounded px-2 py-1 text-white text-xs w-24" />
                    </td>
                    <td colSpan={3} />
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditId(null)} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={lot.id}
                  className={`border-b border-slate-800 hover:bg-slate-800/30 transition-colors
                    ${autoForever ? 'bg-yellow-900/10' : manualLock ? 'bg-blue-900/10' : ''}`}>
                  <td className="px-4 py-3 text-slate-400">
                    <span className="mr-1">{i + 1}</span>
                    {autoForever && (
                      <span title="Forever lot — auto-locked at 40%+ gain">
                        <Star className="inline w-3 h-3 text-yellow-400" />
                      </span>
                    )}
                    {manualLock && (
                      <span title="Manually locked — excluded from signals">
                        <Lock className="inline w-3 h-3 text-blue-400" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{String(lot.date_bought).split('T')[0]}</td>
                  <td className="px-4 py-3 text-right text-white font-medium font-mono">{lot.weight}B</td>
                  <td className="px-4 py-3 text-right text-slate-300 font-mono">฿{lot.buy_price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-white font-mono">฿{currentValue.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-medium ${pnlAmt >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnlAmt >= 0 ? '+' : ''}฿{pnlAmt.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end items-center">
                      {autoForever && (
                        <span className="text-xs text-yellow-500">Forever</span>
                      )}
                      {!autoForever && (
                        <>
                          <button
                            onClick={() => toggleLock(lot)}
                            disabled={loading}
                            title={manualLock ? 'Unlock — include in signals' : 'Lock — exclude from signals'}
                            className={`transition-colors ${manualLock ? 'text-blue-400 hover:text-blue-300' : 'text-slate-600 hover:text-blue-400'}`}
                          >
                            {manualLock
                              ? <Lock className="w-3.5 h-3.5" />
                              : <LockOpen className="w-3.5 h-3.5" />
                            }
                          </button>
                          {!isLocked && (
                            <>
                              <button onClick={() => startEdit(lot)} className="text-slate-500 hover:text-slate-300">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteLot(lot.id)} className="text-slate-500 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tradable lot summary */}
      {(() => {
        const tradableLots = lots.filter(l => !isLockedLot(l, currentSellPrice));
        if (tradableLots.length === 0) return (
          <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
            All lots are locked — no tradable positions.
          </div>
        );

        const tradableWeight = tradableLots.reduce((s, l) => s + l.weight, 0);
        const tradableInvested = tradableLots.reduce((s, l) => s + l.weight * l.buy_price, 0);
        const tradableAvg = Math.round(tradableInvested / tradableWeight);
        const tradableValue = tradableWeight * currentSellPrice;
        const tradablePnlAmt = tradableValue - tradableInvested;
        const tradablePnlPct = (tradablePnlAmt / tradableInvested) * 100;
        const lotNumbers = tradableLots.map(l => `Lot ${lots.indexOf(l) + 1}`).join(', ');

        return (
          <div className="border-t border-slate-700 px-5 py-4 bg-slate-800/40">
            <p className="text-xs font-semibold text-zinc-200 border-l-2 border-blue-500 pl-2 mb-3">
              Tradable Pool — what signals are based on
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Tradable Weight</div>
                <div className="text-base font-bold font-mono text-white">{tradableWeight}B</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Tradable Avg Cost</div>
                <div className="text-base font-bold font-mono text-yellow-300">฿{tradableAvg.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Tradable P&L</div>
                <div className={`text-base font-bold ${tradablePnlAmt >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tradablePnlAmt >= 0 ? '+' : ''}฿{tradablePnlAmt.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Tradable P&L %</div>
                <div className={`text-base font-bold ${tradablePnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tradablePnlPct >= 0 ? '+' : ''}{tradablePnlPct.toFixed(2)}%
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              <span className="text-slate-400 font-medium">Tradable lots:</span> {lotNumbers}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
