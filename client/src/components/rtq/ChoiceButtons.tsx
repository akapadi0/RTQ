import { cn } from "@/lib/utils";

export function ChoiceButtons<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "w-full text-left rounded-md border px-4 py-3 text-sm transition-colors",
            value === opt.value
              ? "border-primary bg-primary/5 font-medium"
              : "border-border hover:border-primary/40 hover:bg-muted/50"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
