'use client';

export default function TradingViewChart() {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Gold Thai 96.5% — Live Chart (MTS GLD965)
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
