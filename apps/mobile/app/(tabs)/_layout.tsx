import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

type IconName = React.ComponentProps<typeof Ionicons>["name"]

function tabIcon(active: IconName, inactive: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  )
}

export default function TabsLayout() {
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
          paddingBottom: 4,
          height: 60,
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
          tabBarIcon: tabIcon("time", "time-outline"),
        }}
      />
      <Tabs.Screen
        name="requests/index"
        options={{
          title: "Requests",
          tabBarIcon: tabIcon("paper-plane", "paper-plane-outline"),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: tabIcon("person-circle", "person-circle-outline"),
        }}
      />
    </Tabs>
  )
}
