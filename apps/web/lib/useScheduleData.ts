"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { Employee, Schedule, TimeOffRequest } from "@/types";
import { useShiftMutations } from "@/lib/useShiftMutations";
import { fetchAllPages } from "@/lib/pagination";

/** Why an employee shouldn't be scheduled on a given day (soft warning). */
export type AvailabilityConflict = { type: "timeoff" | "unavailable" };

export function useScheduleData(orgId: string, weekStart: string) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [approvedTimeOff, setApprovedTimeOff] = useState<TimeOffRequest[]>([]);
  const [unavailable, setUnavailable] = useState<{ employeeId: string; date: string }[]>([]);

  // The grid needs every employee, so page through the full list. Bypass the
  // browser HTTP cache (the route sets a max-age/SWR window) so a just-added
  // employee shows up immediately instead of after ~1–5 min.
  //
  // Retry on transient failure: the first authenticated request after org
  // creation (onboarding → schedule) hits the slow-path membership/billing
  // lookup on a possibly-cold Neon connection. Without retries one flaky call
  // left `employees` empty — so a freshly added employee never appeared on the
  // schedule and couldn't be assigned a shift. OrgProvider already retries the
  // context load for the same reason; this brings the roster fetch to parity.
  const loadEmployees = useCallback(async () => {
    for (let i = 0; i < 3; i++) {
      try {
        // Active only: deactivated staff (and the manager when "include me in the
        // schedule" is off) shouldn't appear as assignable rows/chips.
        const all = await fetchAllPages<Employee>(
          `/api/orgs/${orgId}/employees?status=active`,
          200,
          { cache: "no-store" },
        );
        setEmployees(all);
        return;
      } catch {
        if (i < 2) await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
      }
    }
    toast.error("Failed to load employees");
  }, [orgId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Self-heal a stale/empty roster: refetch when the tab regains focus or the
  // page is restored (including from the back/forward cache). Covers an employee
  // added in another tab and any first-load race on the onboarding hand-off.
  useEffect(() => {
    const refetch = () => {
      if (document.visibilityState === "visible") loadEmployees();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("pageshow", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
      window.removeEventListener("pageshow", refetch);
    };
  }, [loadEmployees]);

  // Track which (orgId, weekStart) pair the current schedule data corresponds to.
  // If the key has changed we treat the data as stale and show loading immediately
  // in render — this avoids calling setState synchronously inside an effect.
  // Starts empty (never matches a real key) so the first mount is loading.
  const [fetchedKey, setFetchedKey] = useState("");
  // Bumped to force a background re-fetch of the current week (e.g. after a
  // multi-week roll-out publishes it) without flipping the loading state.
  const [reloadNonce, setReloadNonce] = useState(0);
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
  }, [weekStart, orgId, reloadNonce]);

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

  // Days employees marked unavailable for this week (best-effort; empty when no
  // availability was collected). Powers the soft conflict warning in the scheduler.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orgs/${orgId}/availability/conflicts?weekStart=${weekStart}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res: { data?: { employeeId: string; date: string }[] }) => {
        if (!cancelled) setUnavailable(res.data ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekStart, orgId]);

  // Fast lookup: is (employee, date) a conflict? Approved time-off takes
  // precedence over self-reported unavailability in the message.
  const unavailableSet = useMemo(
    () => new Set(unavailable.map((u) => `${u.employeeId}__${u.date}`)),
    [unavailable],
  );
  const getConflict = useCallback(
    (employeeId: string, date: string): AvailabilityConflict | null => {
      const onLeave = approvedTimeOff.some(
        (r) => r.employeeId === employeeId && date >= r.startDate.slice(0, 10) && date <= r.endDate.slice(0, 10),
      );
      if (onLeave) return { type: "timeoff" };
      if (unavailableSet.has(`${employeeId}__${date}`)) return { type: "unavailable" };
      return null;
    },
    [approvedTimeOff, unavailableSet],
  );

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
      const res = (await r.json()) as { data?: Schedule; notified?: number; error?: string };
      if (res.data) {
        setSchedule((s) =>
          s ? { ...s, publishedAt: res.data!.publishedAt } : s,
        );
        const n = res.notified ?? 0;
        toast.success(
          n > 0
            ? `Schedule rolled out — ${n} ${n === 1 ? "person" : "people"} notified`
            : "Schedule rolled out — your team can see it now",
        );
      } else {
        toast.error(res.error ?? "Failed to roll out schedule");
      }
    } catch {
      toast.error("Failed to roll out schedule");
    } finally {
      setPublishing(false);
    }
  };

  const {
    handleShiftMove,
    handleShiftCreate,
    handleShiftUpdate,
    handleShiftDelete,
    handleShiftCancel,
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
    getConflict,
    publishing,
    generating,
    generateWeek,
    handlePublish,
    reloadSchedule: () => setReloadNonce((n) => n + 1),
    handleShiftMove,
    handleShiftCreate,
    handleShiftUpdate,
    handleShiftDelete,
    handleShiftCancel,
    handleMarkSick,
  };
}
