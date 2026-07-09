interface SummaryLineProps {
  /**
   * The description label.
   */
  label: string;
  /**
   * The formatted string value.
   */
  value: string;
  /**
   * Optional semantic color tone (e.g. green for positive/success values like discounts).
   */
  tone?: 'success';
}

/**
 * SummaryLine displays a key-value row with semantic color highlighting.
 */
export default function SummaryLine({
  label,
  value,
  tone,
}: SummaryLineProps) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span
        className={`text-[13px] font-semibold ${
          tone === 'success' ? 'text-emerald-600' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
