import { money } from '../../lib/api';

interface StatCardProps {
  /**
   * Title of the statistics category.
   */
  title: string;
  /**
   * Key-value map (e.g. restaurant name to total cost spent).
   */
  data: Record<string, number>;
}

/**
 * StatCard displays categories with their spend values and progress bar indicators.
 */
export default function StatCard({ title, data }: StatCardProps) {
  const total = Object.values(data).reduce((sum, value) => sum + value, 0);

  return (
    <article className="panel p-4">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {Object.entries(data).length === 0 && (
          <p className="text-sm text-slate-500">No data.</p>
        )}
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span>{key}</span>
              <span className="font-semibold">{money(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{
                  width: `${total ? Math.max(4, (value / total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
