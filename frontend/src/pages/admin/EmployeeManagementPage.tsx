import { useMemo, useState } from "react";
import { EmployeeDeleteDialog } from "../../components/employees/EmployeeDeleteDialog";
import { EmployeeModal, type EmployeeModalValues } from "../../components/employees/EmployeeModal";
import { EmployeeTable } from "../../components/employees/EmployeeTable";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { SearchFilters } from "../../components/SearchFilters";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useDepartments } from "../../hooks/useDepartments";
import { useEmployees } from "../../hooks/useEmployees";
import { ApiError } from "../../services/http";
import { profilePhotoService } from "../../services/profilePhotoService";
import { useToast } from "../../hooks/useToast";
import type { Employee, EmployeeRole } from "../../types/employee";
import { formatUserRoles, hasUserRole, isAdminSeat, isApprovalRole } from "../../types/roles";

const ITEMS_PER_PAGE = 5;

export const EmployeeManagementPage = () => {
  const { employees, loading, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { departments } = useDepartments();
  const { toasts, showToast, dismissToast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | "All">("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    const departments = new Set(employees.map((employee) => employee.department)).size;
    const approvers = employees.filter((employee) => isApprovalRole(employee.roles)).length;
    const adminSeats = employees.filter((employee) => isAdminSeat(employee.roles)).length;

    return {
      totalEmployees: employees.length,
      departments,
      approvers,
      adminSeats,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesQuery =
        !query ||
        employee.fullName.toLowerCase().includes(query) ||
        employee.userId.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.id.toLowerCase().includes(query) ||
        employee.employeeCode.toLowerCase().includes(query) ||
        employee.mobileNumber.toLowerCase().includes(query) ||
        employee.designation.toLowerCase().includes(query) ||
        employee.businessUnit.toLowerCase().includes(query) ||
        formatUserRoles(employee.roles).toLowerCase().includes(query) ||
        (employee.reportingManagerName ?? "").toLowerCase().includes(query);
      const matchesRole = roleFilter === "All" || hasUserRole(employee.roles, roleFilter);
      return matchesQuery && matchesRole;
    });
  }, [employees, roleFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);

  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEmployees, page]);

  const openAddModal = () => {
    setSelectedEmployee(null);
    setModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalOpen(true);
  };

  const handleModalSubmit = async (values: EmployeeModalValues) => {
    setSaving(true);
    try {
      const existingProfilePhoto =
        selectedEmployee?.profilePhotoUrl ??
        (selectedEmployee ? profilePhotoService.getPhoto(selectedEmployee.id) : null);
      const payload = {
        employeeCode: values.employeeCode,
        userId: values.userId,
        fullName: values.fullName,
        email: values.email,
        mobileNumber: values.mobileNumber,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        role: values.role,
        roles: values.roles,
        department: values.department,
        designation: values.designation,
        reportingManagerId: values.reportingManagerId,
        businessUnit: values.businessUnit,
        workLocation: values.workLocation,
        status: values.status,
        userType: values.userType,
        password: values.password,
        profilePhotoDataUrl: values.profilePhotoDataUrl,
        removeProfilePhoto: !values.profilePhotoDataUrl && Boolean(existingProfilePhoto),
      };

      if (selectedEmployee) {
        const savedEmployee = await updateEmployee(selectedEmployee.id, payload);
        profilePhotoService.removePhoto(savedEmployee.id);
        showToast("Employee updated successfully.", "success");
      } else {
        const createResult = await addEmployee(payload);
        profilePhotoService.removePhoto(createResult.employee.id);
        showToast(
          createResult.welcomeEmail.wasSent
            ? "Employee added and welcome email sent successfully."
            : "Employee added successfully.",
          "success",
        );

        if (!createResult.welcomeEmail.wasSent) {
          showToast(createResult.welcomeEmail.message, "error");
        }
      }
      setModalOpen(false);
      setSelectedEmployee(null);
      setCurrentPage(1);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? extractApiMessage(error.message) ?? "Unable to save employee to the server."
          : "Something went wrong while saving the employee.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    try {
      await deleteEmployee(deleteTarget.id);
      showToast("Employee deleted successfully.", "success");
      setDeleteTarget(null);
      setCurrentPage(1);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? extractApiMessage(error.message) ?? "Unable to delete employee right now."
          : "Unable to delete employee right now.";
      showToast(message, "error");
    } finally {
      setDeleting(false);
    }
  };

  const extractApiMessage = (rawMessage: string) => {
    try {
      const parsed = JSON.parse(rawMessage) as { message?: string };
      return parsed.message;
    } catch {
      return rawMessage;
    }
  };

  const handleExport = () => {
    const headers = [
      "Employee ID",
      "Employee Code",
      "User ID",
      "Full Name",
      "Email",
      "Mobile Number",
      "Designation",
      "Access Role",
      "Department",
      "Reporting Manager",
      "Business Unit",
      "Work Location",
      "User Type",
      "Status",
    ];
    const rows = filteredEmployees.map((employee) => [
      employee.id,
      employee.employeeCode,
      employee.userId,
      employee.fullName,
      employee.email,
      employee.mobileNumber,
      employee.designation,
      formatUserRoles(employee.roles),
      employee.department,
      employee.reportingManagerName ?? "",
      employee.businessUnit,
      employee.workLocation,
      employee.userType,
      employee.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee-records.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Employee records exported as CSV.", "info");
  };

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...departments.filter((department) => department.status === "Active").map((department) => department.name),
        ...employees.map((employee) => employee.department),
      ]),
    ).sort((left, right) => left.localeCompare(right));
  }, [departments, employees]);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <div>
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Employee Management</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Employees" value={stats.totalEmployees} subtitle="Active team members" accent="bg-zinc-500/20" />
          <StatCard label="Departments" value={stats.departments} subtitle="Business functions covered" accent="bg-cyan-500/20" />
          <StatCard label="Approvers" value={stats.approvers} subtitle="Managers with review authority" accent="bg-amber-500/20" />
          <StatCard label="Admin Seats" value={stats.adminSeats} subtitle="Finance and system admins" accent="bg-emerald-500/20" />
        </div>

        <SearchFilters
          searchTerm={searchTerm}
          roleFilter={roleFilter}
          onSearchChange={(value) => {
            setSearchTerm(value);
            setCurrentPage(1);
          }}
          onRoleChange={(value) => {
            setRoleFilter(value);
            setCurrentPage(1);
          }}
          onExport={handleExport}
          onAdd={openAddModal}
        />

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <EmployeeTable
              employees={paginatedEmployees}
              onEdit={openEditModal}
              onDelete={(employee) => setDeleteTarget(employee)}
            />
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </section>

      <EmployeeModal
        open={modalOpen}
        employee={selectedEmployee}
        employees={employees}
        loading={saving}
        departments={departmentOptions}
        initialProfilePhoto={selectedEmployee ? selectedEmployee.profilePhotoUrl ?? profilePhotoService.getPhoto(selectedEmployee.id) : null}
        onClose={() => {
          setModalOpen(false);
          setSelectedEmployee(null);
        }}
        onSubmit={handleModalSubmit}
      />

      <EmployeeDeleteDialog
        employee={deleteTarget}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
};
