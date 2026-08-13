/**
 * Starter job-role names are written to the database as data, not rendered
 * through a component — so an untranslated seed is permanent. A Danish
 * restaurant was left with "Kitchen" and "Server" on its roster forever, and
 * no amount of UI translation afterwards could correct it.
 */
import { describe, it, expect } from "vitest"
import { localizeRoleName, DEFAULT_JOB_ROLES } from "@/lib/seedDefaultRoles"

describe("localizeRoleName", () => {
  it("translates the restaurant starter roles into Danish", () => {
    expect(localizeRoleName("Kitchen", "da")).toBe("Køkken")
    expect(localizeRoleName("Server", "da")).toBe("Tjener")
    expect(localizeRoleName("Host", "da")).toBe("Vært")
    expect(localizeRoleName("Manager", "da")).toBe("Leder")
  })

  it("leaves English alone", () => {
    expect(localizeRoleName("Kitchen", "en")).toBe("Kitchen")
    expect(localizeRoleName("Shift lead", "en")).toBe("Shift lead")
  })

  it("passes through a name it has no translation for", () => {
    // Exactly what happens to a role the user types in themselves.
    expect(localizeRoleName("Sommelier", "da")).toBe("Sommelier")
    expect(localizeRoleName("", "da")).toBe("")
  })

  it("covers every neutral default role in Danish", () => {
    for (const role of DEFAULT_JOB_ROLES) {
      const translated = localizeRoleName(role.name, "da")
      expect(translated, `${role.name} has no Danish translation`).not.toBe(role.name)
    }
  })
})
