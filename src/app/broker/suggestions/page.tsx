import type { Metadata } from 'next';
import Link from 'next/link';
import { pageBroker } from '@/lib/auth';
import { loadBrokerProperties, loadBrokerSuggestions, loadOpenRequirements } from '@/lib/services/brokerData';
import { SuggestFromHere } from '@/components/broker/SuggestFromHere';
import { fmtDate } from '@/lib/format';

export const metadata: Metadata = { title: 'My suggestions' };

export default async function SuggestionsPage() {
  const { broker } = await pageBroker();
  const [list, props, open] = await Promise.all([loadBrokerSuggestions(broker._id), loadBrokerProperties(broker._id), loadOpenRequirements()]);
  return (
    <main className="page">
      <h1>My suggestions</h1>
      <p className="lead">Every property you suggested for a requirement, and Abacus&apos;s response. A suggestion is a hint; Abacus decides every match.</p>
      <SuggestFromHere properties={props} requirements={open.requirements} suggested={list.map((s) => `${s.propertyId}|${s.requirementId}`)} />
      {list.length === 0 ? (
        <div className="empty">
          <b>No suggestions yet</b>
          Pick one of your properties above and choose the requirements it fits.
        </div>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Property</th>
                <th>Requirement</th>
                <th>Date</th>
                <th>Note</th>
                <th>Abacus response</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.propertyDeleted ? (
                      <span className="mono">{s.propertyCode}</span>
                    ) : (
                      <Link className="mono" href={`/broker/properties/${s.propertyId}/edit`}>
                        {s.propertyCode}
                      </Link>
                    )}
                  </td>
                  <td>
                    {s.requirementOpen ? (
                      <Link className="mono" href={`/broker/requirements/${s.requirementId}`}>
                        {s.requirementCode}
                      </Link>
                    ) : (
                      <span className="mono">{s.requirementCode}</span>
                    )}
                    <div className="muted">{s.requirementPlace}{!s.requirementOpen ? ' · closed' : ''}</div>
                  </td>
                  <td>{fmtDate(s.createdAt)}</td>
                  <td className="small">{s.note || '—'}</td>
                  <td>
                    <span className={`pill ${s.response === 'Taken forward' ? 'p-won' : s.response === 'Not taken forward' ? 'p-no' : 'p-wait'}`}>{s.response}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
