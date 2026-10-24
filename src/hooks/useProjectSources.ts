"use client";

import { useCallback, useEffect, useState } from "react";
import { projectsApi } from "@/lib/api";
import type { ProjectSources } from "@/lib/types";

/** Lo que ya está indexado en un proyecto: repos (ramas y commits) y documentos. */
export function useProjectSources(projectId: string | null) {
  const [sources, setSources] = useState<ProjectSources | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setSources(null);
      return;
    }
    setLoading(true);
    try {
      const data = await projectsApi.sources(projectId);
      setSources(data);
      setError(null);
    } catch (e) {
      setSources(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { sources, loading, error, reload: load };
}
