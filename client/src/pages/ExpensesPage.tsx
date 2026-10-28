import { Link } from 'react-router-dom';
import { ExpenseList } from '../components/ExpenseList';
export function ExpensesPage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PROPERTY COSTS</p>
          <h1>Expenses</h1>
          <p className="intro">
            Keep a record of repairs, running costs, and other property spending.
          </p>
        </div>
        <Link className="primary-button" to="/expenses/new">
          + Record expense
        </Link>
      </section>
      <ExpenseList />
      <p className="section-footnote">
        Record expenses already paid, using the payment date. Correct an entry by voiding it with a
        reason and recording a replacement.
      </p>
    </>
  );
}
