export { ApiClient, ApiError } from "./client"
export type { RequestOptions } from "./client"
export { ApiClientProvider, useApiClient } from "./context"

// Typed API methods — import these in queryFns, not hooks
export {
  getMobileSession,
  refreshMobileToken,
  getCurrentUser,
  getMyShifts,
  getActiveEntry,
  clockIn,
  clockOut,
  getOpenAvailabilityRequest,
  getMyAvailabilitySubmission,
  submitAvailability,
  getMyTimeOff,
  submitTimeOffRequest,
} from "./api"
export type {
  MobileSession,
  RefreshResult,
  CurrentUser,
  ClockInOptions,
  ClockOutOptions,
  DayAvailability,
  TimeOffInput,
} from "./api"

// Manager-oriented React Query hooks (used by the web app)
export { useSchedule, useCreateShift, useDeleteShift } from "./hooks/useSchedule"
export { useEmployees, useUpdateEmployee } from "./hooks/useEmployees"
export { useTimeOff, useCreateTimeOff, useReviewTimeOff } from "./hooks/useTimeOff"
export { useActiveEntry, useClockIn, useClockOut } from "./hooks/useClock"
