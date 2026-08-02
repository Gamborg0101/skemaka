import { View, Text } from "react-native"

/**
 * Shown on employee-facing screens when the signed-in user has no Employee
 * record — normally a manager who has not added themselves to the roster.
 *
 * This is not an error. `/api/orgs/:id/me` returning 404 is the correct answer
 * to "which employee am I?" when the answer is "none". Rendering ErrorState here
 * produced a dead end: a red warning and a "Try again" button that could never
 * succeed, no matter how many times it was pressed.
 *
 * Copy mirrors the web app's equivalent state in
 * apps/web/app/(manager)/my-shifts/page.tsx, so a manager who uses both sees the
 * same explanation in both places.
 */
export function NoEmployeeProfile({ testID }: { testID?: string }) {
  return (
    <View testID={testID} className="flex-1 items-center justify-center gap-4 px-8">
      <Text className="text-3xl">👤</Text>
      <View className="items-center gap-1">
        <Text className="text-base font-semibold text-ink">No employee profile found</Text>
        <Text className="text-sm text-ink-secondary text-center">
          Add yourself as an employee to see your shifts here.
        </Text>
      </View>
    </View>
  )
}
