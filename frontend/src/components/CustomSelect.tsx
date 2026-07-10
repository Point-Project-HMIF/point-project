import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

export type CustomSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function CustomSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Pilih opsi",
  disabled = false,
  className
}: {
  id?: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const listId = `${buttonId}-list`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const hasEnabledOptions = options.some((option) => !option.disabled);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        id={buttonId}
        type="button"
        className={clsx(
          "field flex min-h-[42px] items-center justify-between gap-3 text-left",
          disabled && "cursor-not-allowed bg-cloud text-ink/45 opacity-80"
        )}
        onClick={() => {
          if (!disabled && hasEnabledOptions) setOpen((current) => !current);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className={clsx("min-w-0 truncate", selected ? "text-ink" : "text-ink/45")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={clsx("shrink-0 text-ink/45 transition", open && "rotate-180")} size={17} />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-72 overflow-y-auto rounded-md border border-ink/10 bg-white p-1 shadow-soft"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                className={clsx(
                  "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition",
                  active ? "bg-lagoon/10 text-lagoon" : "text-ink hover:bg-cloud",
                  option.disabled && "cursor-not-allowed text-ink/35 hover:bg-white"
                )}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block break-words text-xs font-bold text-ink/45">{option.description}</span>
                  ) : null}
                </span>
                {active ? <Check className="mt-0.5 shrink-0" size={16} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
