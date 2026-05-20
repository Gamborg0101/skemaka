import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Employee } from "@skemaka/types"
import { useApiClient } from "../context"

export function useEmployees(orgId: string) {
  const client = useApiClient()
  return useQuery({
    queryKey: ["employees", orgId],
    queryFn: async () => {
      const res = await client.get<{ data: Employee[] }>(`/api/orgs/${orgId}/employees`)
      return res.data ?? []
    },
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })
}

export function useUpdateEmployee(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Employee> & { id: string }) => {
      const res = await client.patch<{ data: Employee }>(`/api/orgs/${orgId}/employees/${id}`, input)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["employees", orgId] })
    },
  })
}
