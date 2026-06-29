import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ClaimInviteClient } from "./ClaimInviteClient"

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function JoinPage({ params }: PageProps) {
  const { token } = await params

  const session = await auth()
  if (!session) {
    redirect(`/login?callbackUrl=/join/${token}`)
  }

  return <ClaimInviteClient token={token} />
}
