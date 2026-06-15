'use client'

import { CodewordsTeamBadge } from '@/components/codewords/CodewordsBoardGrid'
import { lobbyTeamSummary, otherTeam, roleLabel } from '@/lib/codewords'
import type { CodewordsPlayerRole, CodewordsRole, CodewordsTeam, Player } from '@/types'

function TeamSummaryLine({ team, roles }: { team: CodewordsTeam; roles: CodewordsPlayerRole[] }) {
  const summary = lobbyTeamSummary(roles, team)
  return (
    <p className="text-faint text-[11px] tabular-nums">
      {summary.total} player{summary.total === 1 ? '' : 's'} · {summary.spymasters} spymaster
      {summary.spymasters === 1 ? '' : 's'} · {summary.operatives} operative
      {summary.operatives === 1 ? '' : 's'}
    </p>
  )
}

function RosterRow({
  player,
  role,
  saving,
  onTeamChange,
  onRoleChange,
}: {
  player: Player
  role: CodewordsPlayerRole
  saving: boolean
  onTeamChange: (team: CodewordsTeam) => void
  onRoleChange: (role: CodewordsRole) => void
}) {
  const swapTeam = otherTeam(role.team)

  return (
    <div className="flex items-center gap-1.5 min-h-8 px-2 py-1 rounded-lg hover:bg-[var(--surface-inset-bg)]/80">
      <span className="flex-1 min-w-0 truncate text-sm font-medium" title={player.name}>
        {player.name}
      </span>
      <select
        value={role.role}
        onChange={(e) => onRoleChange(e.target.value as CodewordsRole)}
        disabled={saving}
        className="input-field text-[11px] py-1 px-1.5 w-[6.75rem] shrink-0"
        aria-label={`Role for ${player.name}`}
      >
        <option value="spymaster">Spymaster</option>
        <option value="operative">Operative</option>
      </select>
      <button
        type="button"
        onClick={() => onTeamChange(swapTeam)}
        disabled={saving}
        className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-faint hover:text-[var(--foreground)] disabled:opacity-50 px-1"
        title={`Move to ${swapTeam} team`}
      >
        → {swapTeam === 'red' ? 'Red' : 'Blue'}
      </button>
      {saving && (
        <span className="w-3 h-3 border border-[var(--primary)] border-t-transparent rounded-full animate-spin shrink-0" />
      )}
    </div>
  )
}

function UnassignedRow({
  player,
  saving,
  onAssign,
}: {
  player: Player
  saving: boolean
  onAssign: (team: CodewordsTeam) => void
}) {
  return (
    <div className="flex items-center gap-2 min-h-8 px-2 py-1 rounded-lg hover:bg-[var(--surface-inset-bg)]/80">
      <span className="flex-1 min-w-0 truncate text-sm font-medium" title={player.name}>
        {player.name}
      </span>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onAssign('red')}
          disabled={saving}
          className="text-[11px] font-semibold rounded-md border border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-100 px-2 py-0.5 disabled:opacity-50"
        >
          Red
        </button>
        <button
          type="button"
          onClick={() => onAssign('blue')}
          disabled={saving}
          className="text-[11px] font-semibold rounded-md border border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-100 px-2 py-0.5 disabled:opacity-50"
        >
          Blue
        </button>
      </div>
      {saving && (
        <span className="w-3 h-3 border border-[var(--primary)] border-t-transparent rounded-full animate-spin shrink-0" />
      )}
    </div>
  )
}

function TeamColumn({
  team,
  players,
  roles,
  savingRoleFor,
  onAssign,
}: {
  team: CodewordsTeam
  players: Player[]
  roles: CodewordsPlayerRole[]
  savingRoleFor: string | null
  onAssign: (playerId: string, team: CodewordsTeam, role: CodewordsRole) => void
}) {
  const roleByPlayer = new Map(roles.map((r) => [r.player_id, r]))
  const roster = players
    .map((player) => {
      const role = roleByPlayer.get(player.id)
      return role?.team === team ? { player, role } : null
    })
    .filter(Boolean) as { player: Player; role: CodewordsPlayerRole }[]

  const borderClass = team === 'red' ? 'border-red-500/35 bg-red-500/5' : 'border-blue-500/35 bg-blue-500/5'

  return (
    <div className={`rounded-xl border ${borderClass} flex flex-col min-h-0`}>
      <div className="px-3 py-2 border-b border-[var(--border-strong)]/60 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <CodewordsTeamBadge team={team} />
          <span className="text-xs font-bold tabular-nums">{roster.length}</span>
        </div>
        <TeamSummaryLine team={team} roles={roles} />
      </div>
      <div className="flex-1 min-h-0 max-h-72 overflow-y-auto p-1">
        {roster.length === 0 ? (
          <p className="text-faint text-xs text-center py-6 px-2">No players yet</p>
        ) : (
          roster.map(({ player, role }) => (
            <RosterRow
              key={player.id}
              player={player}
              role={role}
              saving={savingRoleFor === player.id}
              onTeamChange={(nextTeam) => onAssign(player.id, nextTeam, role.role)}
              onRoleChange={(nextRole) => onAssign(player.id, role.team, nextRole)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function CodewordsLobbyRoster({
  players,
  roles,
  savingRoleFor,
  onAssign,
}: {
  players: Player[]
  roles: CodewordsPlayerRole[]
  savingRoleFor: string | null
  onAssign: (playerId: string, team: CodewordsTeam, role: CodewordsRole) => void
}) {
  const roleByPlayer = new Map(roles.map((r) => [r.player_id, r]))
  const unassigned = players.filter((p) => !roleByPlayer.has(p.id))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamColumn
          team="red"
          players={players}
          roles={roles}
          savingRoleFor={savingRoleFor}
          onAssign={onAssign}
        />
        <TeamColumn
          team="blue"
          players={players}
          roles={roles}
          savingRoleFor={savingRoleFor}
          onAssign={onAssign}
        />
      </div>

      {unassigned.length > 0 && (
        <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset-bg)]/40">
          <div className="px-3 py-2 border-b border-[var(--border-strong)]/60 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Unassigned</p>
            <span className="text-xs font-bold tabular-nums text-faint">{unassigned.length}</span>
          </div>
          <div className="max-h-40 overflow-y-auto p-1">
            {unassigned.map((player) => (
              <UnassignedRow
                key={player.id}
                player={player}
                saving={savingRoleFor === player.id}
                onAssign={(team) => onAssign(player.id, team, 'operative')}
              />
            ))}
          </div>
          <p className="text-faint text-[11px] px-3 pb-2 leading-relaxed">
            Tap Red or Blue to add as {roleLabel('operative').toLowerCase()} — change to spymaster in the roster.
          </p>
        </div>
      )}
    </div>
  )
}
