import { useEffect, useState } from "react";
import { employeeApi } from "../services/api";
import type { Employee, EmployeeUpsertPayload } from "../types/employee";

export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const records = await employeeApi.getEmployees();
      setEmployees(records);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, []);

  const addEmployee = async (payload: EmployeeUpsertPayload) => {
    const result = await employeeApi.addEmployee(payload);
    setEmployees((current) => [result.employee, ...current]);
    return result;
  };

  const updateEmployee = async (id: string, payload: EmployeeUpsertPayload) => {
    const employee = await employeeApi.updateEmployee(id, payload);
    setEmployees((current) => current.map((item) => (item.id === id ? employee : item)));
    return employee;
  };

  const deleteEmployee = async (id: string) => {
    await employeeApi.deleteEmployee(id);
    setEmployees((current) => current.filter((item) => item.id !== id));
  };

  return {
    employees,
    loading,
    reload: loadEmployees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
  };
};
