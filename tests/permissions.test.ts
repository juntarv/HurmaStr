import { describe, it, expect } from "vitest";
import type { Session } from "@/lib/auth";
import {
  isAdmin,
  isHrOrAdmin,
  canManageEmployees,
  canManageDirectories,
  canManageUsers,
  canAdjustBalances,
  canViewPayroll,
  isSelf,
  canViewSensitive,
  canDecideApproval,
  canSeeLeaveDetails,
} from "@/lib/permissions";

/**
 * Фейкова сесія без рантайм-залежностей (permissions.ts не тягне prisma).
 * Тип Session беремо лише як type-import з @/lib/auth.
 */
function session(role: Session["role"], employeeId: string | null = null): Session {
  return { userId: "u", email: "e", role, employeeId, fullName: "F" };
}

const ADMIN = session("ADMIN", "a1");
const HR = session("HR", "h1");
const MANAGER = session("MANAGER", "m1");
const EMPLOYEE = session("EMPLOYEE", "e1");

describe("isAdmin", () => {
  it("ADMIN → true", () => expect(isAdmin(ADMIN)).toBe(true));
  it("HR → false", () => expect(isAdmin(HR)).toBe(false));
  it("MANAGER → false", () => expect(isAdmin(MANAGER)).toBe(false));
  it("EMPLOYEE → false", () => expect(isAdmin(EMPLOYEE)).toBe(false));
});

describe("isHrOrAdmin", () => {
  it("ADMIN → true", () => expect(isHrOrAdmin(ADMIN)).toBe(true));
  it("HR → true", () => expect(isHrOrAdmin(HR)).toBe(true));
  it("MANAGER → false", () => expect(isHrOrAdmin(MANAGER)).toBe(false));
  it("EMPLOYEE → false", () => expect(isHrOrAdmin(EMPLOYEE)).toBe(false));
});

describe("canManageEmployees (= HR/ADMIN)", () => {
  it("ADMIN → true", () => expect(canManageEmployees(ADMIN)).toBe(true));
  it("HR → true", () => expect(canManageEmployees(HR)).toBe(true));
  it("MANAGER → false", () => expect(canManageEmployees(MANAGER)).toBe(false));
  it("EMPLOYEE → false", () => expect(canManageEmployees(EMPLOYEE)).toBe(false));
});

describe("canManageDirectories (= HR/ADMIN)", () => {
  it("ADMIN → true", () => expect(canManageDirectories(ADMIN)).toBe(true));
  it("HR → true", () => expect(canManageDirectories(HR)).toBe(true));
  it("MANAGER → false", () => expect(canManageDirectories(MANAGER)).toBe(false));
  it("EMPLOYEE → false", () => expect(canManageDirectories(EMPLOYEE)).toBe(false));
});

describe("canAdjustBalances (= HR/ADMIN)", () => {
  it("ADMIN → true", () => expect(canAdjustBalances(ADMIN)).toBe(true));
  it("HR → true", () => expect(canAdjustBalances(HR)).toBe(true));
  it("MANAGER → false", () => expect(canAdjustBalances(MANAGER)).toBe(false));
  it("EMPLOYEE → false", () => expect(canAdjustBalances(EMPLOYEE)).toBe(false));
});

describe("canManageUsers (лише ADMIN)", () => {
  it("ADMIN → true", () => expect(canManageUsers(ADMIN)).toBe(true));
  it("HR → false", () => expect(canManageUsers(HR)).toBe(false));
  it("MANAGER → false", () => expect(canManageUsers(MANAGER)).toBe(false));
  it("EMPLOYEE → false", () => expect(canManageUsers(EMPLOYEE)).toBe(false));
});

describe("isSelf", () => {
  it("збіг employeeId → true", () =>
    expect(isSelf(session("EMPLOYEE", "e1"), "e1")).toBe(true));
  it("різні employeeId → false", () =>
    expect(isSelf(session("EMPLOYEE", "e1"), "e2")).toBe(false));
  it("employeeId = null → false", () =>
    expect(isSelf(session("EMPLOYEE", "e1"), null)).toBe(false));
  it("employeeId = undefined → false", () =>
    expect(isSelf(session("EMPLOYEE", "e1"), undefined)).toBe(false));
  it("сесія без employeeId (null) → false", () =>
    expect(isSelf(session("EMPLOYEE", null), "e1")).toBe(false));
  it("сесія без employeeId і employeeId=null → false", () =>
    expect(isSelf(session("EMPLOYEE", null), null)).toBe(false));
});

describe("canViewPayroll", () => {
  it("ADMIN → true", () =>
    expect(canViewPayroll(ADMIN, { id: "x" })).toBe(true));
  it("HR → true", () =>
    expect(canViewPayroll(HR, { id: "x" })).toBe(true));
  it("сам співробітник → true", () =>
    expect(canViewPayroll(session("EMPLOYEE", "e1"), { id: "e1" })).toBe(true));
  it("сторонній EMPLOYEE → false", () =>
    expect(canViewPayroll(session("EMPLOYEE", "e1"), { id: "e2" })).toBe(false));
  it("сторонній MANAGER (не сам, не HR) → false", () =>
    expect(canViewPayroll(session("MANAGER", "m1"), { id: "e2" })).toBe(false));
});

describe("canViewSensitive", () => {
  it("ADMIN → true", () =>
    expect(canViewSensitive(ADMIN, { id: "e2" })).toBe(true));
  it("HR → true", () =>
    expect(canViewSensitive(HR, { id: "e2" })).toBe(true));
  it("сам співробітник → true", () =>
    expect(canViewSensitive(session("EMPLOYEE", "e1"), { id: "e1" })).toBe(true));
  it("його керівник (managerId === session.employeeId) → true", () =>
    expect(
      canViewSensitive(session("EMPLOYEE", "m1"), { id: "e2", managerId: "m1" }),
    ).toBe(true));
  it("керівник іншого співробітника → false", () =>
    expect(
      canViewSensitive(session("EMPLOYEE", "m1"), { id: "e2", managerId: "m9" }),
    ).toBe(false));
  it("сторонній без збігу → false", () =>
    expect(
      canViewSensitive(session("EMPLOYEE", "e1"), { id: "e2", managerId: null }),
    ).toBe(false));
  it("сесія без employeeId, managerId=null → false (без хибного збігу null===null)", () =>
    expect(
      canViewSensitive(session("EMPLOYEE", null), { id: "e2", managerId: null }),
    ).toBe(false));
});

describe("canDecideApproval", () => {
  const mgrStep = (approverId: string | null) =>
    ({ role: "MANAGER", approverId }) as const;
  const hrStep = (approverId: string | null) =>
    ({ role: "HR", approverId }) as const;
  const req = (employeeId: string) => ({ employeeId });

  it("власну заявку не може погодити НІХТО — навіть ADMIN → false", () =>
    expect(
      canDecideApproval(session("ADMIN", "a1"), hrStep("a1"), req("a1")),
    ).toBe(false));

  it("власну заявку не може погодити призначений approver (сам заявник) → false", () =>
    expect(
      canDecideApproval(session("MANAGER", "m1"), mgrStep("m1"), req("m1")),
    ).toBe(false));

  it("призначений approverId === session.employeeId (звичайний EMPLOYEE-керівник) → true", () =>
    expect(
      canDecideApproval(session("EMPLOYEE", "m1"), mgrStep("m1"), req("e2")),
    ).toBe(true));

  it("крок HR + сесія HR → true", () =>
    expect(
      canDecideApproval(session("HR", "h1"), hrStep(null), req("e2")),
    ).toBe(true));

  it("крок HR + сесія ADMIN → true", () =>
    expect(
      canDecideApproval(session("ADMIN", "a1"), hrStep(null), req("e2")),
    ).toBe(true));

  it("ADMIN як запасний погоджувач на MANAGER-кроці без призначення → true", () =>
    expect(
      canDecideApproval(session("ADMIN", "a1"), mgrStep(null), req("e2")),
    ).toBe(true));

  it("ADMIN запасний навіть коли призначено іншого керівника → true", () =>
    expect(
      canDecideApproval(session("ADMIN", "a1"), mgrStep("m1"), req("e2")),
    ).toBe(true));

  it("звичайний EMPLOYEE на чужу MANAGER-заявку без призначення → false", () =>
    expect(
      canDecideApproval(session("EMPLOYEE", "e1"), mgrStep(null), req("e2")),
    ).toBe(false));

  it("EMPLOYEE на чужу MANAGER-заявку, призначено іншого → false", () =>
    expect(
      canDecideApproval(session("EMPLOYEE", "e1"), mgrStep("m9"), req("e2")),
    ).toBe(false));

  it("HR не має спец-права на MANAGER-кроці, якщо не призначений і не ADMIN → false", () =>
    expect(
      canDecideApproval(session("HR", "h1"), mgrStep(null), req("e2")),
    ).toBe(false));
});

describe("canSeeLeaveDetails", () => {
  it("немедичний тип → завжди true (навіть сторонній без employeeId)", () =>
    expect(
      canSeeLeaveDetails(session("EMPLOYEE", null), { employeeId: "e2" }, false),
    ).toBe(true));

  it("медичний + ADMIN → true", () =>
    expect(
      canSeeLeaveDetails(ADMIN, { employeeId: "e2" }, true),
    ).toBe(true));

  it("медичний + HR → true", () =>
    expect(
      canSeeLeaveDetails(HR, { employeeId: "e2" }, true),
    ).toBe(true));

  it("медичний + сам співробітник → true", () =>
    expect(
      canSeeLeaveDetails(session("EMPLOYEE", "e1"), { employeeId: "e1" }, true),
    ).toBe(true));

  it("медичний + його керівник (employeeManagerId === session.employeeId) → true", () =>
    expect(
      canSeeLeaveDetails(
        session("EMPLOYEE", "m1"),
        { employeeId: "e2", employeeManagerId: "m1" },
        true,
      ),
    ).toBe(true));

  it("медичний + сторонній EMPLOYEE → false", () =>
    expect(
      canSeeLeaveDetails(
        session("EMPLOYEE", "e1"),
        { employeeId: "e2", employeeManagerId: "m9" },
        true,
      ),
    ).toBe(false));

  it("медичний + сесія без employeeId, employeeManagerId=null → false", () =>
    expect(
      canSeeLeaveDetails(
        session("EMPLOYEE", null),
        { employeeId: "e2", employeeManagerId: null },
        true,
      ),
    ).toBe(false));
});
