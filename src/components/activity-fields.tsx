"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  asBlockColor,
  type BlockColor,
  blockColors,
  textOn,
} from "@/lib/block-colors";
import { cn } from "@/lib/utils";
import { dayBlockColors } from "@/lib/validation";

const emojiChoices = (
  "😴 💤 🌙 ☀️ 💼 💻 🏢 📞 📚 📖 ✍️ 🎓 🧠 🏋️ 🏃 ⚽ 🧘 🕌 🙏 🍳 " +
  "🍽️ ☕ 🚿 🧹 🛒 🚗 ✈️ 🏠 👨‍👩‍👧 💬 🎮 📺 🎵 🎨 🛠️ 🌳 🐾 🩺 💊 💰"
).split(" ");

export function fill(color: string | null): React.CSSProperties {
  const key = asBlockColor(color);
  return { backgroundColor: blockColors[key], color: textOn(key) };
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: BlockColor;
  onChange: (color: BlockColor) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center"
      role="radiogroup"
      aria-label="Color"
    >
      {dayBlockColors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          title={color}
          onClick={() => onChange(color)}
          className="focus-visible:ring-ring flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2"
        >
          <span
            className={cn(
              "size-3.5 rounded-full transition-transform",
              value === color &&
                "ring-foreground/60 ring-offset-background scale-125 ring-2 ring-offset-1",
            )}
            style={{ backgroundColor: blockColors[color] }}
          />
        </button>
      ))}
    </div>
  );
}

export function EmojiPicker({
  value,
  onPick,
  onClose,
}: {
  value: string | null;
  onPick: (emoji: string | null) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");

  return (
    <div
      className="border-border bg-card animate-in fade-in-0 slide-in-from-top-1 basis-full space-y-2 rounded-md border p-2 duration-150"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="grid grid-cols-8 gap-0.5 sm:grid-cols-[repeat(20,minmax(0,1fr))]">
        {emojiChoices.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            aria-pressed={value === emoji}
            onClick={() => onPick(emoji)}
            className={cn(
              "hover:bg-muted focus-visible:ring-ring flex h-9 items-center justify-center rounded-md text-lg transition-colors outline-none focus-visible:ring-2",
              value === emoji && "bg-muted",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (custom.trim()) onPick(custom.trim());
            }
          }}
          placeholder="Or type / paste any emoji"
          aria-label="Custom emoji"
          maxLength={16}
          className="w-52"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!custom.trim()}
          onClick={() => onPick(custom.trim())}
        >
          Use
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground ml-auto"
            onClick={() => onPick(null)}
          >
            No emoji
          </Button>
        )}
      </div>
    </div>
  );
}
