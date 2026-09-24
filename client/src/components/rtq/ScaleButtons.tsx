import { cn } from "@/lib/utils";

export function ScaleButtons({
  labels,
  value,
  onChange,
}: {
  labels: Record<1 | 2 | 3 | 4 | 5, string>;
  value: number | undefined;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => onChange(n as 1 | 2 | 3 | 4 | 5)}
            className={cn(
              "h-11 flex-1 rounded-md border text-sm font-semibold transition-colors",
              value === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/50"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {value && <p className="text-xs text-muted-foreground">{labels[value as 1 | 2 | 3 | 4 | 5]}</p>}
    </div>
  );
}
