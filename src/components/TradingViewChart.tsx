'use client';

export default function TradingViewChart() {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-zinc-200 border-l-2 border-yellow-500 pl-2">
          Gold Thai 96.5% — Live Chart
        </h3>
      </div>
      <iframe
        src="https://tradingview.mtsgold.co.th/mgb/chart/"
        width="100%"
        height="420"
        style={{ border: 'none', display: 'block' }}
        title="MTS Gold GLD965 Chart"
      />
    </div>
  );
}
