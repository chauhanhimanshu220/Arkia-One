import { useEffect, useState } from "react";
import { departmentService } from "../services/departmentService";
import type { DepartmentDetail, DepartmentPayload, DepartmentSummary } from "../types/department";

export const useDepartments = () => {
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const records = await departmentService.getDepartments();
      setDepartments(records);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDepartments();
  }, []);

  const addDepartment = async (payload: DepartmentPayload) => {
    const created = await departmentService.addDepartment(payload);
    setDepartments((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    return created;
  };

  const updateDepartment = async (id: string, payload: DepartmentPayload) => {
    const updated = await departmentService.updateDepartment(id, payload);
    setDepartments((current) => current.map((item) => (item.id === id ? updated : item)));
    return updated;
  };

  const activateDepartment = async (id: string) => {
    const updated = await departmentService.activateDepartment(id);
    setDepartments((current) => current.map((item) => (item.id === id ? updated : item)));
    return updated;
  };

  const deactivateDepartment = async (id: string) => {
    const updated = await departmentService.deactivateDepartment(id);
    setDepartments((current) => current.map((item) => (item.id === id ? updated : item)));
    return updated;
  };

  const getDepartment = async (id: string): Promise<DepartmentDetail> => {
    return departmentService.getDepartment(id);
  };

  return {
    departments,
    loading,
    reload: loadDepartments,
    addDepartment,
    updateDepartment,
    activateDepartment,
    deactivateDepartment,
    getDepartment,
  };
};
