import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

export type CustomSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

// custom select dropdown biasa, pake click-outside buat nutup
// sengaja manual biar stylingnya konsisten sama form lain
// TODO: kalo udah butuh search + banyak opsi, pindah ke react-select aja
export function CustomSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Pilih opsi",
  disabled = false,
  className,
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
  const listRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 288,
  });
  const selected = options.find((option) => option.value === value);
  const hasEnabledOptions = options.some((option) => !option.disabled);

  const updateMenuPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const gap = 6;
    const viewportPadding = 12;
    const top = rect.bottom + gap;
    const availableBelow = window.innerHeight - top - viewportPadding;
    const availableAbove = rect.top - gap - viewportPadding;
    const shouldOpenAbove =
      availableBelow < 180 && availableAbove > availableBelow;
    const nextMaxHeight = Math.max(
      140,
      Math.min(288, shouldOpenAbove ? availableAbove : availableBelow),
    );
    setMenuPosition({
      left: rect.left,
      top: shouldOpenAbove
        ? Math.max(viewportPadding, rect.top - gap - nextMaxHeight)
        : top,
      width: rect.width,
      maxHeight: nextMaxHeight,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleLayoutChange() {
      updateMenuPosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div
      ref={rootRef}
      className={clsx("relative", open && "z-[120]", className)}
    >
      <button
        id={buttonId}
        type="button"
        className={clsx(
          "field flex min-h-[42px] items-center justify-between gap-3 text-left",
          disabled && "cursor-not-allowed opacity-55",
        )}
        onClick={() => {
          if (!disabled && hasEnabledOptions) setOpen((current) => !current);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span
          className={clsx(
            "min-w-0 truncate",
            selected ? "text-dark" : "text-dark/42",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={clsx(
            "shrink-0 text-dark/45 transition",
            open && "rotate-180",
          )}
          size={17}
        />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={buttonId}
              className="fixed z-[9999] overflow-y-auto rounded-md border border-dark/10 bg-white p-1 shadow-[0_22px_80px_rgba(6,27,51,0.14)]"
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
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
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-dark/72 hover:bg-primary/5 hover:text-dark",
                      option.disabled &&
                        "cursor-not-allowed text-dark/30 hover:bg-transparent",
                    )}
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="mt-0.5 block break-words text-xs font-bold text-dark/42">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {active ? (
                      <Check className="mt-0.5 shrink-0" size={16} />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
