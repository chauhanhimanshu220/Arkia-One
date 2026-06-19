import { useEffect, useState } from "react";
import { leaveService, type LeavePayload } from "../services/leaveService";
import type { LeaveRequest, LeaveStatus } from "../types/leave";

export const useLeaves = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const records = await leaveService.getLeaves();
      setLeaves(records);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaves();
  }, []);

  const addLeave = async (payload: LeavePayload) => {
    const leave = await leaveService.addLeave(payload);
    setLeaves((current) => [leave, ...current]);
  };

  const updateLeave = async (id: string, payload: LeavePayload) => {
    const leave = await leaveService.updateLeave(id, payload);
    setLeaves((current) => current.map((item) => (item.id === id ? leave : item)));
  };

  const updateLeaveStatus = async (id: string, status: LeaveStatus) => {
    const existing = leaves.find((item) => item.id === id);
    if (!existing) {
      throw new Error("Leave request not found");
    }

    const leave = await leaveService.updateLeave(id, {
      employeeId: existing.employeeId,
      employeeName: existing.employeeName,
      department: existing.department,
      type: existing.type,
      startDate: existing.startDate,
      endDate: existing.endDate,
      days: existing.days,
      reason: existing.reason,
      status,
      managerApprovalStatus: existing.managerApprovalStatus,
      hrApprovalStatus: existing.hrApprovalStatus,
      adminApprovalStatus: existing.adminApprovalStatus,
      approvalFlowType: existing.approvalFlowType,
      approvedBy: existing.approvedBy,
    });
    setLeaves((current) => current.map((item) => (item.id === id ? leave : item)));
  };

  const deleteLeave = async (id: string) => {
    await leaveService.deleteLeave(id);
    setLeaves((current) => current.filter((item) => item.id !== id));
  };

  return {
    leaves,
    loading,
    reload: loadLeaves,
    addLeave,
    updateLeave,
    updateLeaveStatus,
    deleteLeave,
  };
};
