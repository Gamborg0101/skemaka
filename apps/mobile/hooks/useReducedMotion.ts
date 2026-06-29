import { useState, useEffect } from "react"
import { AccessibilityInfo } from "react-native"

/**
 * Returns true when the user has enabled Reduce Motion in iOS Settings.
 * Subscribe to changes so the value stays accurate if the user toggles
 * the setting while the app is running.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    // Read the initial value
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false))

    // Subscribe to subsequent changes
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    )
    return () => subscription.remove()
  }, [])

  return reduceMotion
}
