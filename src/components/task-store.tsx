"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { StepItem, TaskItem } from "@/lib/types";

type TaskMap = Record<string, TaskItem>;

type Message =
  | { type: "upsert"; task: TaskItem }
  | { type: "remove"; id: string };

type TaskStore = {
  tasks: TaskMap;
  /** Merge server-loaded tasks into the store; local edits win for tasks already present. */
  hydrate: (items: TaskItem[]) => void;
  createTask: (body: {
    title: string;
    listId?: string | null;
    myDayDate?: string | null;
  }) => Promise<TaskItem | null>;
  patchTask: (item: TaskItem, changes: Partial<TaskItem>, body: object) => void;
  deleteTask: (item: TaskItem) => void;
  setSteps: (taskId: string, steps: StepItem[]) => void;
};

const TaskStoreContext = createContext<TaskStore | null>(null);
const CHANNEL = "simon-tasks";

export function TaskStoreProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskMap>({});
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const bc = new BroadcastChannel(CHANNEL);
    channel.current = bc;

    bc.onmessage = (event: MessageEvent<Message>) => {
      const message = event.data;
      setTasks((current) =>
        message.type === "remove"
          ? without(current, message.id)
          : { ...current, [message.task.id]: message.task },
      );
    };

    return () => {
      bc.close();
      channel.current = null;
    };
  }, []);

  useEffect(() => {
    function onFocus() {
      if (document.visibilityState === "visible") router.refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router]);

  const broadcast = useCallback((message: Message) => {
    channel.current?.postMessage(message);
  }, []);

  const upsert = useCallback(
    (task: TaskItem) => {
      setTasks((current) => ({ ...current, [task.id]: task }));
      broadcast({ type: "upsert", task });
    },
    [broadcast],
  );

  const remove = useCallback(
    (id: string) => {
      setTasks((current) => without(current, id));
      broadcast({ type: "remove", id });
    },
    [broadcast],
  );

  const hydrate = useCallback((items: TaskItem[]) => {
    setTasks((current) => {
      const next = { ...current };
      for (const item of items) next[item.id] = item;
      return next;
    });
  }, []);

  const createTask = useCallback<TaskStore["createTask"]>(
    async (body) => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        toast.error("Couldn't save that task. Try again.");
        return null;
      }

      const { task } = await response.json();
      const item: TaskItem = {
        id: task.id,
        title: task.title,
        notes: task.notes ?? null,
        listId: task.listId ?? null,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes ?? null,
        dueAt: task.dueAt ?? null,
        myDayDate: task.myDayDate ?? null,
        completed: false,
        steps: [],
      };
      upsert(item);
      return item;
    },
    [upsert],
  );

  const patchTask = useCallback<TaskStore["patchTask"]>(
    (item, changes, body) => {
      upsert({ ...item, ...changes });

      void fetch(`/api/tasks/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((response) => {
        if (!response.ok) {
          toast.error("Couldn't update that task.");
          upsert(item);
        }
      });
    },
    [upsert],
  );

  const deleteTask = useCallback<TaskStore["deleteTask"]>(
    (item) => {
      remove(item.id);

      void fetch(`/api/tasks/${item.id}`, { method: "DELETE" }).then(
        (response) => {
          if (!response.ok) {
            toast.error("Couldn't delete that task.");
            upsert(item);
          }
        },
      );
    },
    [remove, upsert],
  );

  const setSteps = useCallback<TaskStore["setSteps"]>(
    (taskId, steps) => {
      setTasks((current) => {
        const existing = current[taskId];
        if (!existing) return current;
        const next = { ...existing, steps };
        broadcast({ type: "upsert", task: next });
        return { ...current, [taskId]: next };
      });
    },
    [broadcast],
  );

  const value = useMemo<TaskStore>(
    () => ({ tasks, hydrate, createTask, patchTask, deleteTask, setSteps }),
    [tasks, hydrate, createTask, patchTask, deleteTask, setSteps],
  );

  return (
    <TaskStoreContext.Provider value={value}>
      {children}
    </TaskStoreContext.Provider>
  );
}

export function useTaskStore(): TaskStore {
  const store = useContext(TaskStoreContext);
  if (!store) throw new Error("useTaskStore must be used within TaskStoreProvider");
  return store;
}

/**
 * Feed a page's server-loaded tasks into the store and return the live tasks
 * that belong in this view. Server ordering is preserved; tasks that entered
 * the view client-side (created or edited elsewhere) come first.
 */
export function useTasks(
  initialTasks: TaskItem[],
  matches: (task: TaskItem) => boolean,
): TaskItem[] {
  const { tasks, hydrate } = useTaskStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrate(initialTasks);
    setHydrated(true);
  }, [initialTasks, hydrate]);

  return useMemo(() => {
    const source = hydrated ? tasks : indexBy(initialTasks);
    const order = new Set(initialTasks.map((item) => item.id));
    const fromServer = initialTasks
      .map((item) => source[item.id])
      .filter((item): item is TaskItem => Boolean(item) && matches(item));
    const newcomers = Object.values(source).filter(
      (item) => !order.has(item.id) && matches(item),
    );
    return [...newcomers, ...fromServer];
  }, [hydrated, tasks, initialTasks, matches]);
}

function without(map: TaskMap, id: string): TaskMap {
  const next = { ...map };
  delete next[id];
  return next;
}

function indexBy(items: TaskItem[]): TaskMap {
  const map: TaskMap = {};
  for (const item of items) map[item.id] = item;
  return map;
}
