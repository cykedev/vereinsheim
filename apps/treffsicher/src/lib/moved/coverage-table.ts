// Alle Server Actions von Treffsicher und ihre Entscheidung für ein Konto, das nach Spiegel umgezogen ist
// ([[adr-033]], Stufe 3). `coverage.test.ts` hält diese Tabelle gegen die Fassaden mit "use server": Eine neue Action
// ohne Eintrag macht den Test rot.

/** own: eigene Daten, abgelehnt; discipline: nach `disciplineWritable`; admin und read: bleiben */
export type Kind = "own" | "discipline" | "admin" | "read"

/** je Fassade mit "use server" (Pfad unter `src/`) jede exportierte Funktion und ihre Entscheidung */
export const WRITE_PATHS: Readonly<Record<string, Readonly<Record<string, Kind>>>> = {
  "lib/sessions/actions.ts": {
    createSession: "own",
    previewMeytonImport: "own",
    getSessionById: "read",
    getSessions: "read",
    uploadAttachment: "own",
    deleteAttachment: "own",
    updateSession: "own",
    toggleFavourite: "own",
    deleteSession: "own",
    saveWellbeing: "own",
    saveReflection: "own",
    savePrognosis: "own",
    saveFeedback: "own",
  },
  "lib/goals/actions.ts": {
    getGoalsWithAssignments: "read",
    getGoalById: "read",
    getGoalSessionOptions: "read",
    getGoalsForSelection: "read",
    createGoal: "own",
    createGoalAndRedirect: "own",
    updateGoal: "own",
    updateGoalAssignments: "own",
    deleteGoal: "own",
  },
  "lib/shot-routines/actions.ts": {
    getShotRoutines: "read",
    getShotRoutineById: "read",
    createShotRoutine: "own",
    updateShotRoutine: "own",
    deleteShotRoutine: "own",
  },
  "lib/disciplines/actions.ts": {
    getDisciplines: "read",
    getDisciplinesForManagement: "read",
    getDisciplineForDetail: "read",
    getDisciplineUsage: "read",
    getFavouriteDisciplineId: "read",
    setFavouriteDiscipline: "own",
    getHiddenDisciplineIds: "read",
    toggleHiddenDiscipline: "own",
    createDiscipline: "discipline",
    getDisciplineById: "read",
    updateDiscipline: "discipline",
    archiveDiscipline: "discipline",
    setDisciplineArchived: "discipline",
    deleteDiscipline: "discipline",
  },
  "lib/admin/actions.ts": {
    getAdminUsers: "read",
    getAdminUserById: "read",
    getAdminSystemDisciplines: "read",
    getAdminBlockedLoginRateLimitBuckets: "read",
    getAdminLoginRateLimitInsights: "read",
    clearLoginRateLimitBucket: "admin",
    createUser: "admin",
    setUserActive: "admin",
    updateUser: "admin",
  },
  "lib/account/actions.ts": { changeOwnPassword: "own" },
}
