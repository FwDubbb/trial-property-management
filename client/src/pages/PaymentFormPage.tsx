import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { amount, label } from '../types/portfolio';
import {
  currentMonth,
  formatMonth,
  paymentMethods,
  type Payment,
  type PaymentOption,
  type RentPage,
} from '../types/payments';
import { formatDate } from '../types/tenancy';

function PaymentForm({ options }: { options: PaymentOption[] }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [leaseId, setLeaseId] = useState(params.get('leaseId') || '');
  const [period, setPeriod] = useState(params.get('period') || currentMonth());
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const query = new URLSearchParams({ period: period || currentMonth() });
  if (leaseId) query.set('leaseId', leaseId);
  const rent = useApiQuery<RentPage>(`/payments/rent?${query}`);
  const balance = leaseId ? rent.data?.items.find((row) => row.leaseId === leaseId) : undefined;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await api<{ payment: Payment }>('/payments', {
        method: 'POST',
        body: {
          leaseId,
          period,
          requestId,
          amount: Number(fields.get('amount')),
          paymentDate: String(fields.get('paymentDate')),
          method: String(fields.get('method')),
          reference: String(fields.get('reference') || '').trim(),
          notes: String(fields.get('notes') || '').trim(),
        },
      });
      navigate(`/payments/${result.payment.id}`, {
        replace: true,
        state: { message: 'Payment recorded. The rent balance has been updated.' },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to record payment.');
    } finally {
      setBusy(false);
    }
  }
  if (!options.length)
    return (
      <EmptyState
        title="Create a lease first"
        description="Every rent payment belongs to a tenant's lease and rent month."
        action={{ to: '/leases/new', label: 'Create lease' }}
      />
    );
  return (
    <form className="detail-panel record-form" onSubmit={submit}>
      <h2>Payment details</h2>
      <p className="intro">
        Record money you have already received. This form does not transfer money.
      </p>
      <fieldset disabled={busy} className="payment-fields">
        <div className="form-grid">
          <label className="span-two">
            Tenant / lease *
            <select
              required
              value={options.some((item) => item.leaseId === leaseId) ? leaseId : ''}
              onChange={(event) => setLeaseId(event.target.value)}
            >
              <option value="" disabled>
                Select a lease
              </option>
              {options.map((item) => (
                <option key={item.leaseId} value={item.leaseId}>
                  {item.tenantName} · {item.propertyName} / {item.unitName} ·{' '}
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rent month *
            <input
              type="month"
              required
              min="1900-01"
              max="9999-12"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </label>
          <label>
            Payment date *
            <input
              name="paymentDate"
              type="date"
              required
              min="1900-01-01"
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <div className="span-two payment-balance" aria-live="polite">
            {!leaseId ? (
              'Select a lease to see its balance.'
            ) : rent.loading ? (
              <LoadingState />
            ) : rent.error ? (
              <ErrorState message={rent.error} retry={rent.reload} />
            ) : balance ? (
              <>
                <strong>{amount(balance.outstanding)} outstanding</strong>
                <span>
                  {formatMonth(balance.period)} · Expected {amount(balance.expected)} · Paid{' '}
                  {amount(balance.paid)}
                </span>
              </>
            ) : (
              <p>No rent is due for this lease and month. Choose a month within the lease term.</p>
            )}
          </div>
          <label>
            Amount received *
            <input
              key={`${leaseId}:${period}`}
              name="amount"
              type="number"
              required
              min="0.01"
              max={balance?.outstanding || '9999999999.99'}
              step="0.01"
              placeholder="0.00"
            />
          </label>
          <label>
            Payment method *
            <select name="method" required defaultValue="">
              <option value="" disabled>
                Select a method
              </option>
              {paymentMethods.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="span-two">
            Reference number
            <input
              name="reference"
              maxLength={150}
              placeholder="Receipt, transfer, or mobile money reference"
            />
          </label>
          <label className="span-two">
            Notes
            <textarea
              name="notes"
              maxLength={5000}
              placeholder="Optional details about this rent payment"
            />
          </label>
        </div>
      </fieldset>
      <p className="field-help">
        Allocate one payment to one rent month. Split a payment covering several months into
        separate entries. Deposits and fees are not rent payments.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Link className="secondary-button" to="/payments">
          Cancel
        </Link>
        <button
          className="primary-button"
          disabled={
            busy || rent.loading || !!rent.error || !balance || Number(balance.outstanding) <= 0
          }
        >
          {busy ? 'Saving…' : 'Record payment'}
        </button>
      </div>
    </form>
  );
}
export function PaymentFormPage() {
  const options = useApiQuery<{ items: PaymentOption[] }>('/payments/options');
  return (
    <>
      <Link className="back-link" to="/payments">
        ← Rent balances
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">RENT RECEIVED</p>
          <h1>Record a payment</h1>
          <p className="intro">Keep a clear record of each rent payment.</p>
        </div>
      </section>
      {options.loading ? (
        <LoadingState />
      ) : options.error ? (
        <ErrorState message={options.error} retry={options.reload} />
      ) : (
        <PaymentForm options={options.data!.items} />
      )}
    </>
  );
}
