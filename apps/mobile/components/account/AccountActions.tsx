import { View, Text, Alert, Pressable } from "react-native"
import { ApiError } from "@skemaka/api"
import { Button } from "@/components/ui/Button"
import { useAuthStore } from "@/store/authStore"
import { useDeleteAccount } from "@/hooks/useEmployee"
import { useTranslations } from "@/lib/i18n"

/**
 * Sign Out + Delete Account controls. Shared by the Profile tab and the
 * no-organisation screen so account deletion (Guideline 5.1.1(v)) stays
 * reachable even before the user belongs to a team.
 */
export function AccountActions() {
  const t = useTranslations("mobile")
  const signOut = useAuthStore((s) => s.signOut)
  const deleteAccount = useDeleteAccount()

  function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ])
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and removes you from your team. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            deleteAccount.mutate(undefined, {
              // The account (and this session) no longer exist — sign out to
              // clear the stored token and return to the login screen.
              onSuccess: () => void signOut(),
              onError: (err) => {
                // 409 = sole manager: surface the server's actionable message.
                const message =
                  err instanceof ApiError && err.status === 409
                    ? err.message
                    : "Could not delete your account. Please try again."
                Alert.alert("Couldn't delete account", message)
              },
            })
          },
        },
      ],
    )
  }

  return (
    <View className="gap-3">
      <Button
        variant="danger"
        size="md"
        fullWidth
        accessibilityLabel={t("common.signOut")}
        onPress={handleSignOut}
      >
        Sign Out
      </Button>

      <Pressable
        onPress={handleDeleteAccount}
        disabled={deleteAccount.isPending}
        accessibilityRole="button"
        accessibilityLabel={t("settings.deleteAccount")}
        className="items-center py-2 active:opacity-60"
      >
        <Text className="text-sm font-medium text-danger">
          {deleteAccount.isPending ? "Deleting…" : "Delete Account"}
        </Text>
      </Pressable>
    </View>
  )
}
