import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, FlaskConical } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { AssetIcon } from '@/components/asset/AssetIcon';
import { getAsset } from '@/data/assets';
import { round2, round6, TradeError } from '@/domain/account';
import type { Transaction } from '@/domain/types';
import { cn } from '@/lib/cn';
import { money, percent, price as fmtPrice, shares as fmtShares } from '@/lib/format';
import { useQuote } from '@/hooks';
import { useAccount } from '@/stores/account';
import { toast } from '@/stores/toast';
import { useUI } from '@/stores/ui';

type Mode = 'amount' | 'shares';
type Step = 'form' | 'review' | 'done';

export function TradeSheet() {
  const trade = useUI((s) => s.trade);
  const close = useUI((s) => s.closeTrade);
  return (
    <Modal open={!!trade} onClose={close} title={trade ? `${trade.side === 'buy' ? 'Buy' : 'Sell'} ${trade.symbol}` : 'Trade'} hideHeader>
      {trade && <TradeFlow key={trade.symbol + trade.side} symbol={trade.symbol} initialSide={trade.side} onClose={close} />}
    </Modal>
  );
}

function TradeFlow({ symbol, initialSide, onClose }: { symbol: string; initialSide: 'buy' | 'sell'; onClose: () => void }) {
  const asset = getAsset(symbol)!;
  const quote = useQuote(symbol);
  const cash = useAccount((s) => s.data?.account.cash ?? 0);
  const holding = useAccount((s) => s.data?.holdings[symbol]);
  const execute = useAccount((s) => s.trade);
  const navigate = useNavigate();

  const [side, setSideRaw] = useState<'buy' | 'sell'>(initialSide === 'sell' && !holding ? 'buy' : initialSide);
  const [mode, setModeRaw] = useState<Mode>('amount');
  const [raw, setRaw] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Transaction | null>(null);
  const [touched, setTouched] = useState(false);

  const resetInput = () => {
    setRaw('');
    setError(null);
    setTouched(false);
  };
  const setSide = (v: 'buy' | 'sell') => {
    setSideRaw(v);
    resetInput();
  };
  const setMode = (v: Mode) => {
    setModeRaw(v);
    resetInput();
  };

  const owned = holding?.shares ?? 0;
  const value = parseFloat(raw.replace(/,/g, ''));
  const valid = Number.isFinite(value) && value > 0;
  const estShares = valid ? (mode === 'shares' ? value : value / quote.price) : 0;
  const estAmount = valid ? (mode === 'amount' ? value : value * quote.price) : 0;

  const validation = useMemo(() => {
    if (!raw) return 'Enter an amount';
    if (!valid) return 'Enter a valid number';
    if (side === 'buy') {
      if (estAmount < 1) return 'Minimum order is $1.00';
      if (estAmount > cash + 0.001) return `Not enough virtual cash (${money(cash)} available)`;
    } else {
      if (owned <= 0) return `You don't own ${symbol}`;
      if (estShares > owned + 1e-6) return `You own ${fmtShares(owned)} shares`;
      if (estAmount < 0.01) return 'Order too small';
    }
    if (estShares < 0.0001) return 'Minimum order is 0.0001 shares';
    return null;
  }, [raw, valid, side, estAmount, estShares, cash, owned, symbol]);

  const quick =
    side === 'buy'
      ? [100, 500, 1000].filter((v) => v <= cash).map((v) => ({ label: `$${v.toLocaleString()}`, set: () => fill(v, 'amount') })).concat(cash >= 1 ? [{ label: 'Max', set: () => fill(Math.floor(cash * 100) / 100, 'amount') }] : [])
      : owned > 0
        ? [0.25, 0.5, 1].map((f) => ({ label: f === 1 ? 'All' : `${f * 100}%`, set: () => fill(round6(owned * f), 'shares') }))
        : [];

  function fill(v: number, m: Mode) {
    setModeRaw(m);
    setError(null);
    setRaw(m === 'amount' ? v.toFixed(2) : String(v));
    setTouched(true);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const order =
        mode === 'amount' && !(side === 'sell' && Math.abs(estShares - owned) < 1e-6)
          ? { side, symbol, amount: round2(value) }
          : { side, symbol, shares: round6(side === 'sell' && Math.abs(estShares - owned) < 1e-6 ? owned : estShares) };
      const tx = await execute(order);
      setResult(tx);
      setStep('done');
    } catch (e) {
      setError(e instanceof TradeError ? e.message : 'The order could not be completed. Please try again.');
      if (!(e instanceof TradeError)) toast.error('Order failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done' && result) {
    return (
      <div className="px-6 pb-6 pt-8 text-center">
        <div className="mx-auto flex h-16 w-16 animate-scale-in items-center justify-center rounded-full bg-gain-soft text-gain">
          <Check size={32} strokeWidth={3} />
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">Order filled</h2>
        <p className="mt-1.5 text-sm text-ink-2">
          You {result.type === 'buy' ? 'bought' : 'sold'} <strong className="text-ink">{fmtShares(result.shares ?? 0)} {symbol}</strong> for{' '}
          <strong className="text-ink">{money(result.amount)}</strong>
        </p>
        <div className="mt-5 rounded-2xl bg-surface-2 p-4 text-left text-[13.5px]">
          <Row k="Fill price" v={fmtPrice(result.price ?? 0)} />
          {result.realizedPnl !== undefined && (
            <Row k="Realised P&L" v={<span className={result.realizedPnl >= 0 ? 'text-gain' : 'text-loss'}>{money(result.realizedPnl, { sign: true })}</span>} />
          )}
          <Row k="Cash balance" v={money(result.cashAfter)} />
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-3">
          <FlaskConical size={12} /> Simulated order with virtual money
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              onClose();
              navigate('/portfolio');
            }}
          >
            View portfolio
          </Button>
          <Button size="lg" onClick={onClose} data-autofocus>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="px-6 pb-6 pt-5">
        <div className="flex items-center gap-2">
          <button className="-ml-2 rounded-lg p-2 text-ink-2 hover:bg-surface-2" onClick={() => setStep('form')} aria-label="Back to order form">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold tracking-tight">Review order</h2>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <AssetIcon symbol={symbol} size={44} />
          <div>
            <div className="font-semibold">
              {side === 'buy' ? 'Buy' : 'Sell'} {asset.name}
            </div>
            <div className="text-[13px] text-ink-3">Market order · {symbol}</div>
          </div>
        </div>
        <div className="mt-5 divide-y divide-line rounded-2xl border border-line px-4 text-[14px]">
          <Row k="Est. price per share" v={fmtPrice(quote.price)} live />
          <Row k="Est. shares" v={fmtShares(estShares)} />
          <Row k="Commission" v="$0.00" />
          <Row k={side === 'buy' ? 'Est. total cost' : 'Est. proceeds'} v={<strong>{money(estAmount)}</strong>} />
          <Row k="Cash after order" v={money(side === 'buy' ? cash - estAmount : cash + estAmount)} />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
          Market orders fill instantly at the simulated price at the moment you confirm. The final price may differ slightly from this estimate. No real money or securities are involved.
        </p>
        {error && <ErrorNote text={error} />}
        <Button block size="lg" className="mt-5" variant={side === 'buy' ? 'primary' : 'sell'} loading={busy} onClick={confirm} data-autofocus>
          {busy ? 'Placing order…' : `Confirm ${side === 'buy' ? 'purchase' : 'sale'}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="px-6 pb-6 pt-5">
      <div className="flex items-center gap-3">
        <AssetIcon symbol={symbol} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{asset.name}</div>
          <div className="num text-[13px] text-ink-3">
            {fmtPrice(quote.price)} <span className={quote.changePct >= 0 ? 'text-gain' : 'text-loss'}>{percent(quote.changePct)}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <Segmented
        className="mt-5 w-full"
        label="Order side"
        value={side}
        onChange={setSide}
        options={[
          { value: 'buy', label: 'Buy' },
          { value: 'sell', label: 'Sell' },
        ]}
      />

      {side === 'sell' && owned <= 0 ? (
        <div className="mt-6 rounded-2xl bg-surface-2 p-5 text-center text-sm text-ink-2">
          You don't own any {symbol} yet. Switch to <button className="font-semibold text-brand" onClick={() => setSide('buy')}>Buy</button> to open a position.
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between">
            <span className="label">{mode === 'amount' ? 'Amount in USD' : 'Number of shares'}</span>
            <button className="text-[13px] font-semibold text-brand hover:text-brand-strong" onClick={() => setMode(mode === 'amount' ? 'shares' : 'amount')}>
              Switch to {mode === 'amount' ? 'shares' : 'USD'}
            </button>
          </div>
          <div
            className={cn(
              'mt-2 flex items-center rounded-2xl border bg-surface px-4 transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/0.12)]',
              touched && validation && raw ? 'border-loss' : 'border-line',
            )}
          >
            {mode === 'amount' && <span className="num text-3xl font-semibold text-ink-3">$</span>}
            <input
              inputMode="decimal"
              autoComplete="off"
              aria-label={mode === 'amount' ? 'Amount in US dollars' : 'Number of shares'}
              value={raw}
              placeholder="0"
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '');
                if (v.split('.').length > 2) return;
                const [, dec] = v.split('.');
                if (dec && dec.length > (mode === 'amount' ? 2 : 4)) return;
                setRaw(v);
                setTouched(true);
              }}
              onKeyDown={(e) => e.key === 'Enter' && !validation && setStep('review')}
              className="num h-[68px] min-w-0 flex-1 bg-transparent px-1 text-3xl font-semibold outline-none placeholder:text-ink-3/50"
              data-autofocus
            />
            {mode === 'shares' && <span className="text-[15px] font-semibold text-ink-3">shares</span>}
          </div>
          <div className="mt-2 flex min-h-[20px] items-center justify-between text-[13px]">
            <span className={cn(touched && validation && raw ? 'text-loss' : 'text-ink-3')}>
              {touched && validation && raw ? validation : valid ? (mode === 'amount' ? `≈ ${fmtShares(estShares)} shares` : `≈ ${money(estAmount)}`) : ' '}
            </span>
            <span className="num text-ink-3">{side === 'buy' ? `Cash ${money(cash)}` : `Owned ${fmtShares(owned)}`}</span>
          </div>
          {quick.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {quick.map((qk) => (
                <button key={qk.label} onClick={qk.set} className="h-9 rounded-xl border border-line px-3.5 text-[13px] font-semibold text-ink-2 transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-strong">
                  {qk.label}
                </button>
              ))}
            </div>
          )}
          <Button block size="lg" className="mt-6" variant={side === 'buy' ? 'primary' : 'sell'} disabled={!!validation} onClick={() => setStep('review')}>
            Review order
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-3">
            <FlaskConical size={12} /> Virtual money · simulated prices
          </p>
        </>
      )}
    </div>
  );
}

function Row({ k, v, live }: { k: string; v: React.ReactNode; live?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-1.5 text-ink-2">
        {k}
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-label="live" />}
      </span>
      <span className="num font-medium text-ink">{v}</span>
    </div>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl bg-loss-soft px-3.5 py-3 text-[13px] text-loss" role="alert">
      <AlertCircle size={16} className="mt-px shrink-0" /> {text}
    </div>
  );
}
