import { useCallback, useEffect, useState } from 'react';
import * as api from '../../lib/bridge/tasks';
import type {
  Todo,
  TodoCounts,
  TodoStatus,
  Run,
  TaskPreferences,
} from '../../lib/bridge/taskModels';

export interface TodoPage {
  key: string;
  items: Todo[];
  counts: TodoCounts;
}
export interface TaskOverview {
  runs: Run[];
  prefs: TaskPreferences;
  state: Awaited<ReturnType<typeof api.taskState>>;
}

export function useTaskWorkspace(
  filter: 'all' | TodoStatus,
  offset: number,
  onOffset: (value: number) => void,
) {
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<TodoPage>();
  const [overview, setOverview] = useState<TaskOverview>();
  const [listError, setListError] = useState<unknown>();
  const [overviewError, setOverviewError] = useState<unknown>();
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const key = `${filter}:${offset}`;
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const [items, counts] = await Promise.all([
          api.listTodos(filter, offset, controller.signal),
          api.todoCounts(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const total = counts[filter];
        if (offset > 0 && offset >= total) {
          onOffset(Math.max(0, Math.ceil(total / 100) - 1) * 100);
          return;
        }
        setPage({ key, items, counts });
        setListError(undefined);
      } catch (error) {
        if (!controller.signal.aborted) setListError(error);
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void load(), 5000);
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [filter, offset, key, revision, onOffset]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      let running = false;
      try {
        const [runs, prefs, state] = await Promise.all([
          api.taskRuns(controller.signal),
          api.taskPreferences(controller.signal),
          api.taskState(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        running = state.running;
        setOverview({ runs, prefs, state });
        setOverviewError(undefined);
      } catch (error) {
        if (!controller.signal.aborted) setOverviewError(error);
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void load(), running ? 1500 : 5000);
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [revision]);
  return {
    page: page?.key === key ? page : undefined,
    counts: page?.counts,
    overview,
    listError,
    overviewError,
    refresh,
  };
}
