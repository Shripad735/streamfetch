import { useCallback, useEffect, useMemo, useState } from "react";

function isTerminalStatus(status) {
  return ["completed", "failed", "canceled"].includes(status);
}

export function useDownloadJobs({
  hasElectron,
  pushToast,
  onAuthRequired,
  onClipboardDetected,
  onNoFormats
}) {
  const [jobs, setJobs] = useState([]);
  const [runningJobId, setRunningJobId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");

  const patchJob = useCallback((jobId, updater) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job;
        return updater({ ...job });
      })
    );
  }, []);

  useEffect(() => {
    if (!hasElectron) return undefined;

    window.electronAPI.getJobs().then((payload) => {
      setJobs(payload.jobs || []);
      setRunningJobId(payload.runningJobId || "");
    });

    const unsubs = [
      window.electronAPI.onJobsUpdated((payload) => {
        setJobs(payload.jobs || []);
        setRunningJobId(payload.runningJobId || "");
      }),
      window.electronAPI.onDownloadProgress((payload) => {
        patchJob(payload.jobId, (job) => ({
          ...job,
          progress: Number(payload.percent || 0),
          speed: payload.speed || "",
          eta: payload.eta || ""
        }));
      }),
      window.electronAPI.onDownloadStatus((payload) => {
        patchJob(payload.jobId, (job) => ({
          ...job,
          status: payload.status || job.status
        }));
      }),
      window.electronAPI.onDownloadLog((payload) => {
        patchJob(payload.jobId, (job) => ({
          ...job,
          logs: [...(job.logs || []), payload].slice(-320)
        }));
      }),
      window.electronAPI.onDownloadComplete((payload) => {
        patchJob(payload.jobId, (job) => ({ ...job, status: "completed", progress: 100 }));
      }),
      window.electronAPI.onDownloadError((payload) => {
        patchJob(payload.jobId, (job) => ({ ...job, status: "failed", lastError: payload.message || "" }));

        const isAuthIssue = ["cookies_required", "browser_cookies_failed", "cookies_auth_failed"].includes(
          String(payload?.reason || "")
        );

        if (isAuthIssue) {
          onAuthRequired?.(payload);
          setSelectedJobId(String(payload.jobId || ""));
          pushToast({
            type: "warn",
            title: "Authentication Needed",
            message: "Apply cookies and retry this failed download."
          });
          return;
        }

        if (String(payload?.reason || "") === "no_formats_available") {
          onNoFormats?.(payload?.detail || payload?.message || "");
        }
      }),
      window.electronAPI.onToast((payload) => {
        pushToast({
          type: payload.type,
          title: payload.title,
          message: payload.message
        });
      }),
      window.electronAPI.onClipboardUrlDetected((payload) => {
        const detectedUrl = String(payload?.url || "").trim();
        if (!detectedUrl) return;
        onClipboardDetected?.(detectedUrl);
      })
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [hasElectron, onAuthRequired, onClipboardDetected, onNoFormats, patchJob, pushToast]);

  useEffect(() => {
    const currentExists = jobs.some((item) => item.id === selectedJobId);
    if (currentExists) return;

    const active = jobs.find((item) => item.id === runningJobId) || jobs[0];
    setSelectedJobId(active?.id || "");
  }, [jobs, selectedJobId, runningJobId]);

  const activeJobs = useMemo(() => jobs.filter((job) => !isTerminalStatus(job.status)), [jobs]);
  const historyJobs = useMemo(() => jobs.filter((job) => isTerminalStatus(job.status)), [jobs]);
  const selectedJob = useMemo(
    () => jobs.find((item) => item.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const pauseJob = useCallback(
    async (jobId) => {
      if (!hasElectron) return;
      const response = await window.electronAPI.pauseDownload(jobId);
      if (!response.success) {
        pushToast({ type: "error", title: "Pause Failed", message: response.message || "Unable to pause." });
      }
    },
    [hasElectron, pushToast]
  );

  const resumeJob = useCallback(
    async (jobId) => {
      if (!hasElectron) return;
      const response = await window.electronAPI.resumeDownload(jobId);
      if (!response.success) {
        pushToast({ type: "error", title: "Resume Failed", message: response.message || "Unable to resume." });
      }
    },
    [hasElectron, pushToast]
  );

  const cancelJob = useCallback(
    async (jobId) => {
      if (!hasElectron) return;
      const response = await window.electronAPI.cancelDownload(jobId);
      if (!response.success) {
        pushToast({ type: "error", title: "Cancel Failed", message: response.message || "Unable to cancel." });
      }
    },
    [hasElectron, pushToast]
  );

  const clearFinished = useCallback(async () => {
    if (!hasElectron) return;
    await window.electronAPI.clearFinished();
  }, [hasElectron]);

  return {
    jobs,
    runningJobId,
    selectedJobId,
    setSelectedJobId,
    activeJobs,
    historyJobs,
    selectedJob,
    pauseJob,
    resumeJob,
    cancelJob,
    clearFinished
  };
}
