import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery, useDebouncedValue } from '../hooks/useApiQuery';
import { amount, label } from '../types/portfolio';
import { expenseCategories, type ExpensePage } from '../types/finance';
import { formatDate } from '../types/tenancy';
import { PropertyFilter } from './PaymentHistory';
import { EmptyState, ErrorState, LoadingState, Pagination } from './RecordStates';
export function ExpenseList({ propertyId: fixedPropertyId }: { propertyId?: string }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [period, setPeriod] = useState('');
  const [state, setState] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ q: useDebouncedValue(search), page: String(page) });
  for (const [key, value] of Object.entries({
    propertyId: fixedPropertyId || propertyId,
    category,
    period,
    state,
  }))
    if (value) query.set(key, value);
  const result = useApiQuery<ExpensePage>(`/expenses?${query}`);
  return (
    <section className="list-panel">
      <div className="filter-bar">
        <label className="search-label">
          Search expenses
          <input
            type="search"
            value={search}
            placeholder="Description or property"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Expense month
          <input
            type="month"
            min="1900-01"
            max="9999-12"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {expenseCategories.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Record status
          <select
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All records</option>
            <option value="RECORDED">Recorded</option>
            <option value="VOIDED">Voided</option>
          </select>
        </label>
        {!fixedPropertyId && (
          <PropertyFilter
            value={propertyId}
            onChange={(value) => {
              setPropertyId(value);
              setPage(1);
            }}
          />
        )}
      </div>
      {result.loading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : (
        result.data && (
          <>
            <p className="expense-total">
              Recorded total: <strong>{amount(result.data.recordedTotal)}</strong>
              <span>All matching pages; voided entries excluded.</span>
            </p>
            {result.data.items.length ? (
              <>
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">Expenses</caption>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Property</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <Link className="record-link" to={`/expenses/${item.id}`}>
                              {item.description}
                            </Link>
                          </td>
                          <td>
                            <Link to={`/properties/${item.propertyId}`}>{item.propertyName}</Link>
                          </td>
                          <td>{label(item.category)}</td>
                          <td>{formatDate(item.expenseDate)}</td>
                          <td className="numeric">{amount(item.amount)}</td>
                          <td>
                            <span className={`status-pill ${item.state.toLowerCase()}`}>
                              {label(item.state)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...result.data} onPage={setPage} />
              </>
            ) : (
              <EmptyState
                title="No expenses found"
                description="Record a property expense or change your filters."
              />
            )}
          </>
        )
      )}
    </section>
  );
}
