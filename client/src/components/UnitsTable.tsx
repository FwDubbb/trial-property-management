import { Link } from 'react-router-dom';
import { amount, label, type Unit } from '../types/portfolio';

export function UnitsTable({ units }: { units: Unit[] }) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">Rental units</caption>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Property</th>
            <th>Beds / baths</th>
            <th>Monthly rent</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <tr key={unit.id}>
              <td>
                <Link className="record-link" to={`/units/${unit.id}`}>
                  {unit.name}
                </Link>
              </td>
              <td>
                <Link to={`/properties/${unit.propertyId}`}>{unit.propertyName}</Link>
                {!unit.propertyActive && <span className="table-secondary">Inactive property</span>}
              </td>
              <td>
                {unit.bedrooms} / {unit.bathrooms}
              </td>
              <td className="numeric">{amount(unit.monthlyRent)}</td>
              <td>
                <span className={`status-pill ${unit.status.toLowerCase()}`}>
                  {label(unit.status)}
                </span>
              </td>
              <td>
                <Link className="table-action" to={`/units/${unit.id}`}>
                  View<span className="sr-only"> {unit.name}</span> →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
