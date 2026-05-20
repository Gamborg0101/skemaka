import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuthStore } from "@/store/authStore"

type IconName = React.ComponentProps<typeof Ionicons>["name"]

function tabIcon(active: IconName, inactive: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { activeView } = useAuthStore()
  const isManager = activeView === "MANAGER"

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#7B6EF8",
        tabBarInactiveTintColor: "#4A4A57",
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
          title: "Shifts",
          tabBarIcon: tabIcon("calendar", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="availability/index"
        options={{
          title: "Availability",
          tabBarIcon: tabIcon("checkmark-circle", "checkmark-circle-outline"),
        }}
      />
      <Tabs.Screen
        name="requests/index"
        options={{
          title: "Time Off",
          tabBarIcon: tabIcon("calendar-clear", "calendar-clear-outline"),
        }}
      />
      <Tabs.Screen
        name="team/index"
        options={{
          title: "Team",
          tabBarIcon: tabIcon("people", "people-outline"),
          href: isManager ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
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
