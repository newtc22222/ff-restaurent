import CurrencyInput from 'react-currency-input-field';

interface AmountInputProps {
  /**
   * The input label.
   */
  label: string;
  /**
   * Numeric value in cents/currency.
   */
  value: number;
  /**
   * Callback fired when value changes.
   */
  onChange: (value: number) => void;
}

/**
 * AmountInput provides a standardized input field for VND currency amounts, handling formatting internally.
 */
export default function AmountInput({
  label,
  value,
  onChange,
}: AmountInputProps) {
  return (
    <label className="block space-y-1.5">
      <span className="label">{label}</span>
      <CurrencyInput
        className="field w-full"
        value={value === 0 ? '' : value}
        onValueChange={(_val, _name, values) => onChange(values?.float ?? 0)}
        allowDecimals={false}
        allowNegativeValue={false}
        intlConfig={{ locale: 'vi-VN', currency: 'VND' }}
      />
    </label>
  );
}
