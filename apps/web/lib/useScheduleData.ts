"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Employee, Schedule, TimeOffRequest } from "@/types";
import { useShiftMutations } from "@/lib/useShiftMutations";
import { fetchAllPages } from "@/lib/pagination";

export function useScheduleData(orgId: string, weekStart: string) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [approvedTimeOff, setApprovedTimeOff] = useState<TimeOffRequest[]>([]);

  useEffect(() => {
    // The grid needs every employee, so page through the full list.
    // Bypass the browser HTTP cache (the route sets a max-age/SWR window) so a
    // just-added employee shows up immediately instead of after ~1–5 min.
    fetchAllPages<Employee>(`/api/orgs/${orgId}/employees`, 200, { cache: "no-store" })
      .then((all) => setEmployees(all))
      .catch(() => toast.error("Failed to load employees"));
  }, [orgId]);

  // Track which (orgId, weekStart) pair the current schedule data corresponds to.
  // If the key has changed we treat the data as stale and show loading immediately
  // in render — this avoids calling setState synchronously inside an effect.
  // Starts empty (never matches a real key) so the first mount is loading.
  const [fetchedKey, setFetchedKey] = useState("");
  const currentKey = `${orgId}__${weekStart}`;
  // Derive loading/error from whether the fetched key is current.
  // We reset loadError optimistically when the key changes.
  const [loadError, setLoadError] = useState(false);

  // When the key changes in render, reset stale error flag so the old error
  // badge doesn't flash while the new request is in flight.
  if (currentKey !== fetchedKey && loadError) {
    setLoadError(false);
  }

  const loading = currentKey !== fetchedKey;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/orgs/${orgId}/schedules?weekStart=${weekStart}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { data: Schedule | null }) => {
        if (cancelled) return;
        // Return null when no schedule exists — don't auto-create.
        // The schedule is created lazily when the user adds their first shift.
        setSchedule(data.data ?? null);
        setFetchedKey(`${orgId}__${weekStart}`);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setFetchedKey(`${orgId}__${weekStart}`);
          toast.error("Failed to load schedule");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [weekStart, orgId]);

  // Lazily creates the schedule for a week on first shift add. Returns the
  // schedule (existing or newly created) so callers can immediately use its id.
  const ensureSchedule = useCallback(async (): Promise<Schedule> => {
    if (schedule) return schedule;
    const r = await fetch(`/api/orgs/${orgId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart }),
    });
    const data = (await r.json()) as { data: Schedule };
    const newSchedule = { ...data.data, shifts: [] };
    setSchedule(newSchedule);
    return newSchedule;
  }, [schedule, orgId, weekStart]);

  useEffect(() => {
    let cancelled = false;
    fetchAllPages<TimeOffRequest>(
      `/api/orgs/${orgId}/time-off?status=APPROVED&weekStart=${weekStart}`,
    )
      .then((all) => {
        if (!cancelled) setApprovedTimeOff(all);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekStart, orgId]);

  // Magic-moment: fill an empty week in one click (starter defaults or a copy of
  // the previous week). On success, swap in the returned populated schedule.
  const [generating, setGenerating] = useState(false);
  const generateWeek = useCallback(
    async (mode: "starter" | "copyPrevious") => {
      setGenerating(true);
      try {
        const r = await fetch(`/api/orgs/${orgId}/schedules/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart, mode }),
        });
        const res = (await r.json()) as { data?: Schedule; error?: string };
        if (res.data) {
          setSchedule(res.data);
          toast.success(mode === "copyPrevious" ? "Copied last week's schedule" : "Starter schedule created");
        } else {
          toast.error(res.error ?? "Failed to generate schedule");
        }
      } catch {
        toast.error("Failed to generate schedule");
      } finally {
        setGenerating(false);
      }
    },
    [orgId, weekStart],
  );

  const handlePublish = async () => {
    if (!schedule) return;
    setPublishing(true);
    try {
      const r = await fetch(`/api/orgs/${orgId}/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      const res = (await r.json()) as { data?: Schedule; error?: string };
      if (res.data) {
        setSchedule((s) =>
          s ? { ...s, publishedAt: res.data!.publishedAt } : s,
        );
        toast.success("Schedule published — employees notified by SMS");
      } else {
        toast.error(res.error ?? "Failed to publish schedule");
      }
    } catch {
      toast.error("Failed to publish schedule");
    } finally {
      setPublishing(false);
    }
  };

  const {
    handleShiftMove,
    handleShiftCreate,
    handleShiftUpdate,
    handleShiftDelete,
    handleMarkSick,
  } = useShiftMutations(
    schedule,
    setSchedule,
    orgId,
    employees,
    ensureSchedule,
  );

  return {
    schedule,
    loading,
    loadError,
    employees,
    approvedTimeOff,
    publishing,
    generating,
    generateWeek,
    handlePublish,
    handleShiftMove,
    handleShiftCreate,
    handleShiftUpdate,
    handleShiftDelete,
    handleMarkSick,
  };
}
