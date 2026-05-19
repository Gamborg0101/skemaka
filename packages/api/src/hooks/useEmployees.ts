import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Employee, ApiResult } from "@skemaka/types"
import { useApiClient } from "../context"

export function useEmployees(orgId: string) {
  const client = useApiClient()
  return useQuery({
    queryKey: ["employees", orgId],
    queryFn: () =>
      client.get<ApiResult<Employee[]>>(`/api/orgs/${orgId}/employees`),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })
}

export function useUpdateEmployee(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<Employee> & { id: string }) =>
      client.patch<ApiResult<Employee>>(`/api/orgs/${orgId}/employees/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["employees", orgId] })
    },
  })
}
