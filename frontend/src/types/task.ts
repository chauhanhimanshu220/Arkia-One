export interface TaskItem {
  id: string;
  taskGroupId: string;
  projectId?: string;
  projectName?: string;
  assignedTo: string;
  assignedToName: string;
  taskCode?: string;
  taskName?: string;
  title: string;
  description: string;
  workBreakdown?: string;
  startDate: string;
  endDate: string;
  dueDate?: string;
  totalHours: number;
  estimatedHours?: number;
  assignedHours?: number;
  plannedDays?: number;
  assignedDays?: number;
  priority?: string;
  status: string;
  assignmentStatus?: string;
  notes?: string;
  roleInTask?: string;
  expectedDeliverable?: string;
  isTaskMaster?: boolean;
}

export interface TaskAssignmentPayload {
  taskId?: string;
  taskGroupId?: string;
  projectId?: string;
  userId?: string;
  assignedTo?: string;
  taskName?: string;
  title?: string;
  description?: string;
  workBreakdown?: string;
  assignedDays?: number;
  assignedHours?: number;
  totalHours?: number;
  assignmentStartDate?: string;
  assignmentDueDate?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  roleInTask?: string;
  expectedDeliverable?: string;
  status?: string;
  projectName?: string;
  assignedToName?: string;
}

export interface TaskCreatePayload {
  taskGroupId?: string;
  projectId?: string;
  taskCode?: string;
  taskName?: string;
  title?: string;
  description: string;
  workBreakdown?: string;
  plannedDays?: number;
  estimatedHours?: number;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  endDate?: string;
  totalHours?: number;
  status: string;
  projectName?: string;
}

export interface DailyTimesheetEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  hours: number;
  workDescription: string;
}

export interface DailyTimesheet {
  id: string;
  userId: string;
  date: string;
  status: string;
  totalHours: number;
  entries: DailyTimesheetEntry[];
}

export interface DailyTimesheetSavePayload {
  userId: string;
  date: string;
  status: string;
  entries: Array<{
    taskId: string;
    hours: number;
    workDescription: string;
  }>;
}
