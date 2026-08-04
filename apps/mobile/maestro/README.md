# Mobile UI tests (Maestro)

Flows that drive the real app on a simulator. They catch what typecheck, lint and
the unit tests structurally cannot: whether the app actually launches, signs in
and renders its screens.

## Running

```bash
brew install maestro                # or: curl -Ls "https://get.maestro.mobile.dev" | bash
npm run dev:web                     # the API the app talks to
npm run dev:mobile                  # Metro
maestro test apps/mobile/maestro/   # both flows, ~20s
```

Needs a dev build installed on a booted simulator (`npx expo run:ios`), not Expo Go —
`DevLogin` is `__DEV__`-gated and the flows tap it.

## Flows

| Flow | Guards |
|---|---|
| `01-launch.yaml` | Cold start clears the splash and lands on sign-in. This is the flow that would have caught `hydrate()` rejecting on a keychain read and hanging the app forever. |
| `02-signin-and-tabs.yaml` | Sign-in reaches the tab bar, and every tab renders without crashing. |

## Selecting elements

Assert on **testIDs, not visible text**, for anything rendered by a native
component. React Navigation's tab bar does not expose its labels in the
accessibility tree, so `assertVisible: "Availability"` fails while the word is
plainly on screen — a confusing failure that costs an hour to diagnose.
`tabBarButtonTestID` in `app/(tabs)/_layout.tsx` gives each tab a stable handle.

Plain `<Text>` is matchable by its content; `01-launch` relies on that.

To see what Maestro can actually match: `maestro studio`, or `maestro hierarchy`.

## Signing in

`components/DevLogin.tsx` authenticates through the **public live-demo provider** —
the same endpoint the marketing site's "Try the live demo" button uses. No password,
no server env flag, and it lands in a throwaway org (`isDemo`, deleted after 48h)
rather than a real restaurant.

The e2e credentials provider was rejected for this: it would have meant enabling
`E2E_TEST_LOGIN` on a dev server whose `DATABASE_URL` points at production.

## Known gap

The demo signs in as a **manager, who has no Employee record**, so
`/api/orgs/:id/me` returns 404 and the employee-facing tabs show a dead-end
"Could not load your profile / Try again" that no retry can fix. The flows assert
the tabs render, not that they show data. See `app/(tabs)/shifts/index.tsx`.
