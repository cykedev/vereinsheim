// Die Dev-Datenbank aus `.env.example` (triviale Zugangsdaten, nur lokal). Tests und die Messung nehmen sie, wenn keine
// `.env` DATABASE_URL setzt, etwa in einem frischen Worktree.
export const DEV_DATABASE_URL = "postgresql://spiegel:spiegel@localhost:5432/spiegel"
