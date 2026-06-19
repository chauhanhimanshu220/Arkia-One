import { useEffect, useState } from "react";
import { projectService } from "../services/projectService";
import type { Project } from "../types/project";

export type ProjectPayload = Omit<Project, "id" | "createdAt" | "adminId" | "adminName">;

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const records = await projectService.getProjects();
      setProjects(records);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const addProject = async (payload: ProjectPayload) => {
    const project = await projectService.addProject(payload);
    setProjects((current) => [project, ...current]);
  };

  const updateProject = async (id: string, payload: ProjectPayload) => {
    const project = await projectService.updateProject(id, payload);
    setProjects((current) => current.map((item) => (item.id === id ? project : item)));
  };

  const deleteProject = async (id: string) => {
    await projectService.deleteProject(id);
    setProjects((current) => current.filter((item) => item.id !== id));
  };

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    reload: loadProjects,
  };
};
