"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Vertical drag-to-reorder list. `onReorder` receives the full id order after
 * a drop; disabled while a search filter hides rows, since a partial order
 * would be ambiguous.
 */
export function SortableList({
  ids,
  onReorder,
  disabled = false,
  className,
  children,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ids}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        <ul className={cn("divide-border divide-y", className)}>{children}</ul>
      </SortableContext>
    </DndContext>
  );
}

export function SortableRow({
  id,
  disabled = false,
  className,
  children,
}: {
  id: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/row bg-background relative flex items-center gap-1",
        isDragging && "z-10 shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label="Drag to reorder"
        className={cn(
          "text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring/50 -ml-1 shrink-0 cursor-grab touch-none rounded-sm p-1 opacity-0 transition-opacity duration-150 outline-none group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 active:cursor-grabbing",
          disabled && "invisible",
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
    </li>
  );
}
