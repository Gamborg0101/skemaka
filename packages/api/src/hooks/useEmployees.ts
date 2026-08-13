import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Employee } from "@skemaka/types"
import { useApiClient } from "../context"
import { listEmployees } from "../api"

export function useEmployees(orgId: string) {
  const client = useApiClient()
  return useQuery({
    queryKey: ["employees", orgId],
    // Goes through listEmployees so the whole roster is paged in. Reading
    // `res.data` off one unpaginated request capped this at the server's
    // default page size (100) with nothing to indicate more existed.
    queryFn: () => listEmployees(client, orgId),
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
