/**
 * POST /api/auth/apple/native
 *
 * Authenticates a mobile user via a native Sign in with Apple identity token.
 * This endpoint is intentionally unauthenticated — it IS the login.
 *
 * Request body:
 *   {
 *     identityToken: string        // JWT from Apple's ASAuthorizationAppleIDCredential
 *     rawNonce?:     string        // The plaintext nonce you passed to Apple (optional)
 *     fullName?: {                 // Only present on first authorisation
 *       givenName?:  string
 *       familyName?: string
 *     }
 *   }
 *
 * Response (mirrors POST /api/auth/mobile/redeem):
 *   { token: string, userId: string, orgId: string | null, role: string }
 *
 * Security model:
 * - Apple identity token is verified with Apple's public JWKS (online, cached by jose).
 * - Issuer must be "https://appleid.apple.com".
 * - Audience must be the iOS bundle ID "com.skemaka.app".
 * - `exp` is validated automatically by jwtVerify.
 * - If rawNonce is supplied, we verify SHA-256(rawNonce) === token.nonce claim.
 * - Account linking is ONLY done on verified email — never on unverified or absent email.
 * - The minted session token uses the exact same claims as lib/auth.ts jwt callback so
 *   lib/apiGuard.ts decodeSessionToken / requireOrgMember accepts it transparently.
 */
import { NextRequest, NextResponse } from "next/server"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { encode } from "next-auth/jwt"
import { db } from "@/lib/prisma"
import { PrismaClient } from "@/app/generated/prisma/client"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { createHash } from "crypto"
import { logError, requestIdFrom } from "@/lib/log"

// ---------------------------------
// Constants
// ---------------------------------

const APPLE_ISSUER   = "https://appleid.apple.com"
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
const APPLE_AUDIENCE = "com.skemaka.app"       // iOS bundle ID

// Lazily created so the JWKS is fetched on first request, not at module load.
let _appleJWKS: ReturnType<typeof createRemoteJWKSet> | null = null
function getAppleJWKS() {
  if (!_appleJWKS) _appleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL))
  return _appleJWKS
}

const MOBILE_MAX_AGE = parseInt(
  process.env.MOBILE_TOKEN_MAX_AGE ?? String(30 * 60),
  10,
)

function sessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
}

// ---------------------------------
// Request body shape
// ---------------------------------

interface AppleNativeBody {
  identityToken: string
  rawNonce?: string
  fullName?: {
    givenName?: string
    familyName?: string
  }
}

// ---------------------------------
// Apple JWT claims we care about
// ---------------------------------

interface AppleClaims {
  sub:            string           // Stable Apple user ID — use as providerAccountId
  email?:         string
  email_verified?: boolean | "true" | "false"
  nonce?:         string           // SHA-256 of the rawNonce if one was sent
}

// ---------------------------------
// Handler
// ---------------------------------

export async function POST(req: NextRequest) {
  // 1. Rate-limit
  const { success } = await rateLimitRequest(getClientIp(req.headers), "auth")
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  // 2. Parse body
  let body: AppleNativeBody
  try {
    const raw = await req.json()
    if (!raw || typeof raw !== "object") throw new Error("not an object")
    if (typeof raw.identityToken !== "string" || !raw.identityToken) {
      return NextResponse.json({ error: "identityToken is required" }, { status: 400 })
    }
    body = raw as AppleNativeBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { identityToken, rawNonce, fullName } = body

  // 3. Verify the Apple identity token
  let claims: AppleClaims
  try {
    const { payload } = await jwtVerify(identityToken, getAppleJWKS(), {
      issuer:   APPLE_ISSUER,
      audience: APPLE_AUDIENCE,
    })
    // jwtVerify validates `exp` automatically — no manual check needed.
    if (typeof payload.sub !== "string" || !payload.sub) {
      return NextResponse.json({ error: "Invalid identity token: missing sub" }, { status: 401 })
    }
    claims = payload as unknown as AppleClaims
  } catch (err) {
    logError("apple/native", err, { requestId: requestIdFrom(req.headers), stage: "jwtVerify" })
    return NextResponse.json({ error: "Invalid or expired identity token" }, { status: 401 })
  }

  // 4. Nonce verification (prevents replay with a stolen token)
  //    Apple stores SHA-256(rawNonce) in the token's `nonce` claim.
  if (rawNonce !== undefined && rawNonce !== null) {
    if (typeof rawNonce !== "string" || rawNonce.length === 0) {
      return NextResponse.json({ error: "rawNonce must be a non-empty string" }, { status: 400 })
    }
    if (!claims.nonce) {
      // A nonce was sent but the token has no nonce claim — reject to prevent downgrade.
      return NextResponse.json({ error: "Identity token missing nonce claim" }, { status: 401 })
    }
    const expectedNonce = createHash("sha256").update(rawNonce).digest("hex")
    if (expectedNonce !== claims.nonce) {
      return NextResponse.json({ error: "Nonce mismatch" }, { status: 401 })
    }
  }

  const appleSub = claims.sub

  // Normalize email_verified: Apple sends it as a boolean or the string "true"/"false"
  const emailVerified =
    claims.email_verified === true || claims.email_verified === "true"

  // 5. Resolve / create user (all mutations in a single transaction)
  let userId: string
  try {
    userId = await db.$transaction(async (tx) => {
      // Prisma 7 types the tx param as Omit<PrismaClient, ITXClientDenyList>, which
      // hides model delegates from tsc; cast to PrismaClient (runtime is identical).
      const client = tx as unknown as PrismaClient
      // --- Path A: existing Apple account ---
      const existingAccount = await client.account.findUnique({
        where: { provider_providerAccountId: { provider: "apple", providerAccountId: appleSub } },
        select: { userId: true },
      })
      if (existingAccount) {
        return existingAccount.userId
      }

      // --- Path B: link to an existing user by verified email ---
      if (claims.email && emailVerified) {
        const existingUser = await client.user.findUnique({
          where: { email: claims.email },
          select: { id: true },
        })
        if (existingUser) {
          // Link Apple as an additional provider — creates the Account row only.
          await client.account.create({
            data: {
              userId:            existingUser.id,
              type:              "oauth",
              provider:          "apple",
              providerAccountId: appleSub,
            },
          })
          return existingUser.id
        }
      }

      // --- Path C: new user ---
      let name: string | undefined
      if (fullName) {
        const parts = [fullName.givenName, fullName.familyName].filter(Boolean)
        if (parts.length > 0) name = parts.join(" ")
      }

      const newUser = await client.user.create({
        data: {
          // email and emailVerified are only set when Apple provides them
          // (first authorisation only). Subsequent logins hit Path A.
          email:         claims.email ?? null,
          emailVerified: claims.email && emailVerified ? new Date() : null,
          name:          name ?? null,
          // User.role defaults to EMPLOYEE in the schema; membership is the authority
        },
        select: { id: true },
      })

      await client.account.create({
        data: {
          userId:            newUser.id,
          type:              "oauth",
          provider:          "apple",
          providerAccountId: appleSub,
        },
      })

      return newUser.id
    })
  } catch (err) {
    logError("apple/native", err, { requestId: requestIdFrom(req.headers), stage: "userResolution" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  // 6. Compute JWT claims — mirror lib/auth.ts jwt callback exactly
  //
  //    The jwt callback logic (from lib/auth.ts):
  //      1. Check for MANAGER membership → role = "MANAGER", orgId = membership.organizationId,
  //         subscriptionStatus from that org.
  //      2. Else check any membership → orgId = that membership.organizationId.
  //      3. If token.email === SUPERADMIN_EMAIL → role = "ADMIN".
  //      4. role ??= "EMPLOYEE".
  //
  //    We replicate those queries here so decodeSessionToken / requireOrgMember
  //    accept the minted token without any DB fallback on subsequent calls.

  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")

  let role:               string = "EMPLOYEE"
  let orgId:              string | undefined
  let subscriptionStatus: string | undefined

  const managerMembership = await db.membership.findFirst({
    where:   { userId, role: "MANAGER" },
    include: { organization: { select: { subscriptionStatus: true } } },
    orderBy: { joinedAt: "asc" },
  })

  if (managerMembership) {
    role               = "MANAGER"
    orgId              = managerMembership.organizationId
    subscriptionStatus = managerMembership.organization.subscriptionStatus
  } else {
    const empMembership = await db.membership.findFirst({
      where:   { userId },
      orderBy: { joinedAt: "asc" },
    })
    if (empMembership) {
      orgId = empMembership.organizationId
    }
  }

  // Fetch the user's email for the superadmin check (the jwt callback uses token.email
  // which is set from user.email at sign-in time).
  const userRecord = await db.user.findUnique({
    where:  { id: userId },
    select: { email: true, name: true },
  })

  if (userRecord?.email && userRecord.email === process.env.SUPERADMIN_EMAIL) {
    role = "ADMIN"
  }

  // 7. Mint the session token using next-auth/jwt encode — same as mobile/refresh
  const salt = sessionCookieName()

  const sessionToken = await encode({
    token: {
      // next-auth/jwt uses `sub` internally; `id` is the extra claim set in lib/auth.ts
      sub:                userId,
      id:                 userId,
      name:               userRecord?.name ?? undefined,
      email:              userRecord?.email ?? undefined,
      role,
      ...(orgId              !== undefined && { orgId }),
      ...(subscriptionStatus !== undefined && { subscriptionStatus }),
    },
    secret,
    salt,
    maxAge: MOBILE_MAX_AGE,
  })

  return NextResponse.json({
    token:  sessionToken,
    userId,
    orgId:  orgId ?? null,
    role,
  })
}
