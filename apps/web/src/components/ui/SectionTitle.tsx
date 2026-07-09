interface SectionTitleProps {
  /**
   * Main section heading text.
   */
  title: string;
  /**
   * Optional supporting subtitle text.
   */
  subtitle?: string;
}

/**
 * SectionTitle renders a styled title and supporting subtitle block.
 */
export default function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <div>
      <h2 className="text-xl font-bold">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
