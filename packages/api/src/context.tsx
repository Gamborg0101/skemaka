import { createContext, useContext, createElement, type FC, type ReactNode } from "react"
import { ApiClient } from "./client"

const Ctx = createContext<ApiClient | null>(null)

export const ApiClientProvider: FC<{ client: ApiClient; children: ReactNode }> = ({
  client,
  children,
}) => createElement(Ctx.Provider, { value: client }, children)

export function useApiClient(): ApiClient {
  const client = useContext(Ctx)
  if (!client) throw new Error("useApiClient must be inside <ApiClientProvider>")
  return client
}
