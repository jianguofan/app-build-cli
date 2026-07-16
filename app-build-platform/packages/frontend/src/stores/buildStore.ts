import { create } from 'zustand';

interface BuildTask {
  id: string;
  platform: 'ios' | 'android';
  flavor: 'oversea' | 'cn';
  env: 'dev' | 'staging' | 'pre' | 'prod';
  androidArtifact?: 'apk' | 'appbundle';
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: string;
  completedAt?: string;
  duration?: number;
}

interface BuildState {
  tasks: BuildTask[];
  currentTask: BuildTask | null;
  setTasks: (tasks: BuildTask[]) => void;
  setCurrentTask: (task: BuildTask | null) => void;
  updateTask: (id: string, updates: Partial<BuildTask>) => void;
}

export const useBuildStore = create<BuildState>((set) => ({
  tasks: [],
  currentTask: null,

  setTasks: (tasks) => set({ tasks }),

  setCurrentTask: (task) => set({ currentTask: task }),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      ),
      currentTask:
        state.currentTask?.id === id
          ? { ...state.currentTask, ...updates }
          : state.currentTask,
    })),
}));
