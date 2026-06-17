'use client'

import { useCallback, useEffect, useState } from 'react'
import { Chip } from '@/components/ui/PageShell'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import {
  MONTH_OPTIONS,
  UPDATE_CATEGORY_META,
  UPDATE_CATEGORY_OPTIONS,
  formatUpdateMonthYear,
  type ProductUpdate,
  type UpdateCategory,
} from '@/lib/product-updates'

type FormState = {
  type: UpdateCategory
  title: string
  description: string
  month: string
  year: string
  sortOrder: string
}

const EMPTY_FORM: FormState = {
  type: 'new',
  title: '',
  description: '',
  month: '',
  year: '',
  sortOrder: '0',
}

function toFormState(update: ProductUpdate): FormState {
  return {
    type: update.type,
    title: update.title,
    description: update.description,
    month: update.month ? String(update.month) : '',
    year: update.year ? String(update.year) : '',
    sortOrder: String(update.sort_order),
  }
}

function payloadFromForm(form: FormState) {
  return {
    type: form.type,
    title: form.title,
    description: form.description,
    month: form.month ? Number(form.month) : null,
    year: form.year ? Number(form.year) : null,
    sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
  }
}

export default function AdminProductUpdatesPage() {
  const { confirm } = useConfirm()
  const { success, error } = useToast()
  const [updates, setUpdates] = useState<ProductUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [filter, setFilter] = useState<'all' | UpdateCategory>('all')

  const loadUpdates = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/product-updates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load updates')
      setUpdates(data.updates ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load updates')
      setUpdates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUpdates()
  }, [loadUpdates])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const startEdit = (update: ProductUpdate) => {
    setEditingId(update.id)
    setForm(toFormState(update))
  }

  const save = async () => {
    setSaving(true)
    try {
      const body = payloadFromForm(form)
      const res = await fetch(editingId ? `/api/admin/product-updates/${editingId}` : '/api/admin/product-updates', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save update')

      success(editingId ? 'Update saved' : 'Update created')
      resetForm()
      await loadUpdates()
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to save update')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (update: ProductUpdate) => {
    const ok = await confirm({
      title: `Delete "${update.title}"?`,
      message: 'This will remove the entry from the public What\'s new page.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/admin/product-updates/${update.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete update')

      success('Update deleted')
      if (editingId === update.id) resetForm()
      await loadUpdates()
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to delete update')
    }
  }

  const visibleUpdates = filter === 'all' ? updates : updates.filter((item) => item.type === filter)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight gradient-title">What&apos;s new</h1>
          <p className="text-muted text-sm mt-1">Manage the public product board at /updates</p>
        </div>
        <a href="/updates" target="_blank" rel="noreferrer" className="btn-secondary text-sm px-4 py-2">
          View public page
        </a>
      </div>

      <div className="glass-card-strong p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">{editingId ? 'Edit update' : 'Add update'}</h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="btn-ghost text-sm">
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 sm:col-span-2">
            <span className="label-caps">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as UpdateCategory }))}
              className="input-field w-full"
            >
              {UPDATE_CATEGORY_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {UPDATE_CATEGORY_META[type].label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 sm:col-span-2">
            <span className="label-caps">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="input-field w-full"
              placeholder="Secret Message"
            />
          </label>

          <label className="block space-y-2 sm:col-span-2">
            <span className="label-caps">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="input-field w-full min-h-28 resize-y"
              placeholder="What shipped or what is coming next?"
            />
          </label>

          <label className="block space-y-2">
            <span className="label-caps">Month</span>
            <select
              value={form.month}
              onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
              className="input-field w-full"
            >
              <option value="">No month</option>
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="label-caps">Year</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={form.year}
              onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
              className="input-field w-full"
              placeholder="2026"
            />
          </label>

          <label className="block space-y-2 sm:col-span-2">
            <span className="label-caps">Sort order</span>
            <input
              type="number"
              min={0}
              max={9999}
              value={form.sortOrder}
              onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
              className="input-field w-full"
            />
            <p className="text-faint text-xs">Higher values appear first within the same month/year.</p>
          </label>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || !form.title.trim() || !form.description.trim()}
          className="btn-primary"
        >
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add update'}
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-muted text-sm font-medium">Filter by type</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </Chip>
          {UPDATE_CATEGORY_OPTIONS.map((type) => (
            <Chip key={type} active={filter === type} onClick={() => setFilter(type)}>
              {UPDATE_CATEGORY_META[type].label}
            </Chip>
          ))}
        </div>
      </div>

      {loading && <p className="text-muted">Loading updates…</p>}
      {loadError && <p className="text-red-500">{loadError}</p>}

      {!loading && !loadError && (
        <div className="glass-card-strong overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4 flex items-center justify-between">
            <h2 className="font-bold">Entries</h2>
            <span className="text-muted text-sm">{visibleUpdates.length} shown</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {visibleUpdates.length === 0 ? (
              <p className="px-5 py-10 text-center text-muted">No updates yet</p>
            ) : (
              visibleUpdates.map((item) => (
                <article key={item.id} className="px-5 py-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="chip chip-active">{UPDATE_CATEGORY_META[item.type].label}</span>
                        {formatUpdateMonthYear(item.month, item.year) ? (
                          <span className="text-faint">{formatUpdateMonthYear(item.month, item.year)}</span>
                        ) : (
                          <span className="text-faint">No date</span>
                        )}
                        <span className="text-faint">Sort {item.sort_order}</span>
                      </div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => startEdit(item)} className="btn-secondary text-sm px-3 py-1.5">
                        Edit
                      </button>
                      <button type="button" onClick={() => remove(item)} className="btn-ghost text-sm text-red-500">
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
