'use client'

import { cellBlockIndex, getCellDisplayColor } from '@/lib/sudoku'

export type NotesGrid = number[][][]

interface SudokuBoardProps {
  puzzle: number[][]
  solution?: number[][]
  userGrid?: number[][]
  notes?: NotesGrid
  cellOwners?: (string | null)[][]
  mySolvedCells?: boolean[][]
  playerColors?: Record<string, string>
  myPlayerId?: string | null
  selectedCell?: [number, number] | null
  notesMode?: boolean
  onCellSelect?: (row: number, col: number) => void
  onNumberPress?: (value: number) => void
  onErase?: () => void
  onUndo?: () => void
  onToggleNotes?: () => void
  completionPercent?: number
  readOnly?: boolean
  /** When set, controls which cells the player can tap (overrides default claimed-cell lock). */
  canSelectCell?: (row: number, col: number) => boolean
}

const BLOCK_BORDER = 'border-slate-400/70'

function buildNotesGrid(): NotesGrid {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[]))
}

export function emptyNotesGrid(): NotesGrid {
  return buildNotesGrid()
}

export function SudokuBoard({
  puzzle,
  solution,
  userGrid,
  notes,
  cellOwners,
  mySolvedCells,
  playerColors = {},
  myPlayerId,
  selectedCell,
  notesMode = false,
  onCellSelect,
  onNumberPress,
  onErase,
  onUndo,
  onToggleNotes,
  completionPercent = 0,
  readOnly = false,
  canSelectCell,
}: SudokuBoardProps) {
  const grid = solution ?? puzzle

  return (
    <div className="w-full max-w-[min(400px,100%)] mx-auto space-y-4">
      {/* Grid */}
      <div
        className="grid border-2 border-slate-500/80 rounded-sm overflow-hidden bg-white dark:bg-slate-900"
        style={{ gridTemplateColumns: 'repeat(9, 1fr)', aspectRatio: '1' }}
      >
        {Array.from({ length: 9 }, (_, row) =>
          Array.from({ length: 9 }, (_, col) => {
            const given = puzzle[row]?.[col] !== 0
            const firstSolverId = cellOwners?.[row]?.[col] ?? null
            const hasValue = given || !!firstSolverId || !!(mySolvedCells?.[row]?.[col])
            const isSelected = selectedCell?.[0] === row && selectedCell?.[1] === col
            const cellNotes = notes?.[row]?.[col] ?? []

            let displayValue: number | string = ''
            if (given) {
              displayValue = puzzle[row]![col]!
            } else if (solution) {
              displayValue = solution[row]![col]!
            } else if (hasValue) {
              displayValue = userGrid?.[row]?.[col] || grid[row]?.[col] || ''
            } else {
              displayValue = userGrid?.[row]?.[col] || ''
            }

            const displayColor = getCellDisplayColor(row, col, {
              myPlayerId,
              mySolvedCells,
              firstSolverId,
              playerColors,
            })

            const borderRight =
              (col + 1) % 3 === 0 && col < 8 ? `border-r-2 ${BLOCK_BORDER}` : 'border-r border-slate-300/60'
            const borderBottom =
              (row + 1) % 3 === 0 && row < 8 ? `border-b-2 ${BLOCK_BORDER}` : 'border-b border-slate-300/60'

            const bgStyle = displayColor
              ? { backgroundColor: `${displayColor}${mySolvedCells?.[row]?.[col] ? '55' : '35'}` }
              : isSelected
                ? { backgroundColor: 'rgba(148, 163, 184, 0.25)' }
                : undefined

            const cellDisabled = readOnly || given || (canSelectCell ? !canSelectCell(row, col) : false)

            return (
              <button
                key={`${row}-${col}`}
                type="button"
                disabled={cellDisabled}
                onClick={() => onCellSelect?.(row, col)}
                className={[
                  'relative flex items-center justify-center select-none transition-colors',
                  borderRight,
                  borderBottom,
                  cellDisabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60',
                  given ? 'bg-white dark:bg-slate-900' : '',
                ].join(' ')}
                style={{ aspectRatio: '1', ...bgStyle }}
              >
                {cellNotes.length > 0 && !displayValue ? (
                  <div className="absolute inset-0.5 grid grid-cols-3 grid-rows-3 gap-px pointer-events-none">
                    {Array.from({ length: 9 }, (_, i) => (
                      <span
                        key={i}
                        className="flex items-center justify-center text-[7px] leading-none text-slate-500 dark:text-slate-400 font-medium"
                      >
                        {cellNotes.includes(i + 1) ? i + 1 : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span
                    className={[
                      'text-lg sm:text-xl font-semibold tabular-nums',
                      given ? 'text-slate-800 dark:text-slate-100' : '',
                      hasValue ? 'text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200',
                      solution && !given ? 'text-violet-600 dark:text-violet-400' : '',
                    ].join(' ')}
                  >
                    {displayValue}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Control toolbar */}
      {!readOnly && (
        <div className="flex items-center justify-around px-1">
          <ToolbarButton label={`${completionPercent}%`} onClick={() => {}} disabled>
            <StarIcon />
          </ToolbarButton>
          <ToolbarButton label="Chat" onClick={() => triggerVoiceChat()}>
            <ChatIcon />
          </ToolbarButton>
          <ToolbarButton label="Undo" onClick={() => onUndo?.()} disabled={!onUndo}>
            <UndoIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Notes"
            sublabel={notesMode ? 'On' : 'Off'}
            active={notesMode}
            onClick={() => onToggleNotes?.()}
          >
            <NotesIcon />
          </ToolbarButton>
          <ToolbarButton label="Erase" onClick={() => onErase?.()} disabled={!onErase}>
            <EraseIcon />
          </ToolbarButton>
        </div>
      )}

      {/* Number pad */}
      {!readOnly && onNumberPress && (
        <div className="flex items-center justify-between gap-1 px-0.5">
          {Array.from({ length: 9 }, (_, i) => {
            const num = i + 1
            return (
              <button
                key={num}
                type="button"
                onClick={() => onNumberPress(num)}
                className="flex-1 py-3 text-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors active:scale-95"
              >
                {num}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  children,
  label,
  sublabel,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  sublabel?: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex flex-col items-center gap-0.5 min-w-[3.25rem] py-1 rounded-lg transition-colors',
        active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
        disabled ? 'opacity-60 cursor-default' : 'hover:text-slate-700 dark:hover:text-slate-200',
      ].join(' ')}
    >
      <span className="w-6 h-6 flex items-center justify-center">{children}</span>
      <span className="text-[10px] font-medium leading-tight">{label}</span>
      {sublabel && <span className="text-[8px] leading-none opacity-70">{sublabel}</span>}
    </button>
  )
}

function triggerVoiceChat() {
  const btn = document.querySelector<HTMLButtonElement>('[data-audio-chat-trigger]')
  btn?.click()
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2z" strokeLinejoin="round" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
      <path d="M7 9h10M7 13h6" strokeLinecap="round" />
      <path d="M5 19l2-4H18a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h-1z" strokeLinejoin="round" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
      <path d="M9 7H5v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11a7 7 0 107 7" strokeLinecap="round" />
    </svg>
  )
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
      <path d="M14 3l7 7-10 10H4v-7L14 3z" strokeLinejoin="round" />
      <path d="M12 6l6 6" strokeLinecap="round" />
    </svg>
  )
}

function EraseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
      <path d="M20 20H8L4 16l8-8 8 8-4 4z" strokeLinejoin="round" />
      <path d="M12 6l6 6" strokeLinecap="round" />
    </svg>
  )
}

export { cellBlockIndex }
