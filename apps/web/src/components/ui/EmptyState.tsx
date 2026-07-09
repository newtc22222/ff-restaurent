import { PlusCircle, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /**
   * The Lucide icon to display at the top.
   */
  icon: LucideIcon;
  /**
   * Header title.
   */
  title: string;
  /**
   * Description message.
   */
  description: string;
  /**
   * Optional ordered step instructions to help the user get started.
   */
  steps: string[];
}

/**
 * EmptyState prompts the user with helpful next steps when no content exists in a view.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  steps,
}: EmptyStateProps) {
  return (
    <div className="panel p-6">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-[#e9900c] dark:bg-amber-950">
          <Icon size={22} />
        </div>
        <h3 className="mt-3 text-lg font-bold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
        {steps.length > 0 && (
          <div className="mt-4 grid w-full gap-2 text-left md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step}
                className="rounded-lg border border-border bg-muted px-3 py-2 text-sm"
              >
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <PlusCircle size={14} /> Step {index + 1}
                </div>
                <div className="font-medium">{step}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
