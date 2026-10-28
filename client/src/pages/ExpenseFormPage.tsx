import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { label, type PropertyOption } from '../types/portfolio';
import { expenseCategories, type Expense } from '../types/finance';
function ExpenseForm({ properties }: { properties: PropertyOption[] }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const result = await api<{ expense: Expense }>('/expenses', {
        method: 'POST',
        body: {
          propertyId: String(data.get('propertyId')),
          category: String(data.get('category')),
          description: String(data.get('description') || '').trim(),
          amount: Number(data.get('amount')),
          expenseDate: String(data.get('expenseDate')),
          notes: String(data.get('notes') || '').trim(),
          requestId,
        },
      });
      navigate(`/expenses/${result.expense.id}`, {
        replace: true,
        state: { message: 'Expense recorded. Dashboard totals have been updated.' },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to record expense.');
    } finally {
      setBusy(false);
    }
  }
  if (!properties.length)
    return (
      <EmptyState
        title="Add a property first"
        description="Each expense belongs to one of your properties."
        action={{ to: '/properties/new', label: 'Add property' }}
      />
    );
  return (
    <form className="detail-panel record-form" onSubmit={submit}>
      <h2>Expense details</h2>
      <p className="intro">
        Record money already spent. Required fields are marked with an asterisk.
      </p>
      <fieldset className="finance-fields" disabled={busy}>
        <div className="form-grid">
          <label className="span-two">
            Property *
            <select
              name="propertyId"
              required
              defaultValue={
                properties.some((item) => item.id === params.get('propertyId'))
                  ? params.get('propertyId')!
                  : ''
              }
            >
              <option value="" disabled>
                Select a property
              </option>
              {properties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category *
            <select name="category" required defaultValue="">
              <option value="" disabled>
                Select a category
              </option>
              {expenseCategories.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date paid *
            <input
              name="expenseDate"
              type="date"
              min="1900-01-01"
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <label className="span-two">
            Description *
            <input
              name="description"
              required
              maxLength={500}
              placeholder="Replaced kitchen sink seal"
            />
          </label>
          <label>
            Amount *
            <input
              name="amount"
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              required
              placeholder="0.00"
            />
          </label>
          <label className="span-two">
            Notes
            <textarea
              name="notes"
              maxLength={5000}
              placeholder="Supplier, receipt reference, or other useful details"
            />
          </label>
        </div>
      </fieldset>
      <p className="field-help">
        Historical costs can be recorded for inactive properties. Saving does not send money or pay
        an invoice.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Link className="secondary-button" to="/expenses">
          Cancel
        </Link>
        <button className="primary-button" disabled={busy}>
          {busy ? 'Saving…' : 'Record expense'}
        </button>
      </div>
    </form>
  );
}
export function ExpenseFormPage() {
  const result = useApiQuery<{ items: PropertyOption[] }>('/properties/options');
  return (
    <>
      <Link className="back-link" to="/expenses">
        ← All expenses
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PROPERTY COSTS</p>
          <h1>Record an expense</h1>
          <p className="intro">Track what you spend on each property.</p>
        </div>
      </section>
      {result.loading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : (
        <ExpenseForm properties={result.data!.items} />
      )}
    </>
  );
}
