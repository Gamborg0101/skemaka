export { ApiClient, ApiError } from "./client"
export type { RequestOptions } from "./client"
export { ApiClientProvider, useApiClient } from "./context"

// Typed API methods — import these in queryFns, not hooks
export {
  getMobileSession,
  refreshMobileToken,
  getCurrentUser,
  deleteAccount,
  getMyShifts,
  getActiveEntry,
  clockIn,
  clockOut,
  updateTimeEntry,
  getOpenAvailabilityRequest,
  getMyAvailabilitySubmission,
  submitAvailability,
  getMyTimeOff,
  submitTimeOffRequest,
  // Manager operations
  getSchedule,
  getOrCreateSchedule,
  createManagedShift,
  updateManagedShift,
  deleteManagedShift,
  listEmployees,
  listTimeOff,
  getAllTimeOff,
  reviewTimeOff,
  getAllAvailabilitySubmissions,
  // Shift cover requests
  getMyCoverRequests,
  getPendingCoverRequests,
  createCoverRequest,
  claimCoverRequest,
  cancelCoverRequest,
  approveCoverRequest,
  denyCoverRequest,
} from "./api"
export type {
  TimeOffFilters,
  MobileSession,
  RefreshResult,
  CurrentUser,
  ClockInOptions,
  ClockOutOptions,
  UpdateTimeEntryInput,
  DayAvailability,
  TimeOffInput,
  ShiftInput,
  OpenRequestResult,
  CoverLists,
} from "./api"

export { DEFAULT_ORG_HOURS } from "./api"

// Manager-oriented React Query hooks (used by the web app)
export { useSchedule, useCreateShift, useDeleteShift } from "./hooks/useSchedule"
export { useEmployees, useUpdateEmployee } from "./hooks/useEmployees"
export { useTimeOff, useCreateTimeOff, useReviewTimeOff } from "./hooks/useTimeOff"
export { useActiveEntry, useClockIn, useClockOut } from "./hooks/useClock"
