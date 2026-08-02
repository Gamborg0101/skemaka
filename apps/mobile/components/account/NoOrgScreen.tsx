import { View, Text } from "react-native"
import { Screen } from "@/components/layout/Screen"
import { AccountActions } from "@/components/account/AccountActions"
import { useTranslations } from "@/lib/i18n"

/**
 * Shown when an authenticated user has no organisation yet — e.g. a brand-new
 * Sign in with Apple / Google account that hasn't been invited to a team.
 * Organisations are created on the web, so there's nothing to do in-app except
 * wait for an invite; we still surface Sign Out / Delete Account so the account
 * stays manageable (and account deletion remains reachable per Guideline 5.1.1).
 */
export function NoOrgScreen() {
  const t = useTranslations("mobile")
  return (
    <Screen>
      <View className="flex-1 justify-between py-6">
        <View className="flex-1 items-center justify-center gap-4 px-4">
          <Text className="text-5xl">👋</Text>
          <View className="items-center gap-2">
            <Text className="text-xl font-bold text-ink text-center">
              {t("state.noTeamYet")}
            </Text>
            <Text className="text-sm text-ink-secondary text-center leading-relaxed">
              Ask your manager to send you an invite link, or create an
              organisation on the Skemaka website. Once you&apos;re added, your
              shifts and schedule will show up here.
            </Text>
          </View>
        </View>

        <AccountActions />
      </View>
    </Screen>
  )
}
