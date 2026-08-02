import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuthStore } from "@/store/authStore"
import { NoOrgScreen } from "@/components/account/NoOrgScreen"

type IconName = React.ComponentProps<typeof Ionicons>["name"]

function tabIcon(active: IconName, inactive: IconName) {
  const TabIcon = ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  )
  TabIcon.displayName = "TabIcon"
  return TabIcon
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { activeView, orgId } = useAuthStore()
  const isManager = activeView === "MANAGER"

  // A signed-in user with no organisation (e.g. a fresh Apple/Google account
  // not yet invited to a team) has nothing to show in the data tabs — every
  // screen is org-scoped. Show a dedicated state instead of empty/broken tabs.
  if (!orgId) return <NoOrgScreen />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#7B6EF8",
        // a11y: raised from #4A4A57 (~2.5:1) to #6B6B7B (~4.7:1 on #141417) for tab labels
        tabBarInactiveTintColor: "#6B6B7B",
        tabBarStyle: {
          backgroundColor: "#141417",
          borderTopColor: "#252529",
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="shifts"
        options={{
          tabBarButtonTestID: "tab-shifts",
          title: "Shifts",
          tabBarIcon: tabIcon("calendar", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="availability/index"
        options={{
          tabBarButtonTestID: "tab-availability",
          title: "Availability",
          tabBarIcon: tabIcon("checkmark-circle", "checkmark-circle-outline"),
        }}
      />
      <Tabs.Screen
        name="requests/index"
        options={{
          tabBarButtonTestID: "tab-timeoff",
          title: "Time Off",
          tabBarIcon: tabIcon("calendar-clear", "calendar-clear-outline"),
        }}
      />
      <Tabs.Screen
        name="team/index"
        options={{
          tabBarButtonTestID: "tab-team",
          title: "Team",
          tabBarIcon: tabIcon("people", "people-outline"),
          href: isManager ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarButtonTestID: "tab-settings",
          title: "Settings",
          tabBarIcon: tabIcon("settings", "settings-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: tabIcon("person-circle", "person-circle-outline"),
        }}
      />
    </Tabs>
  )
}
