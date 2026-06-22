'use client'

import { useState } from 'react'

export function usePlayerQuestions() {
  const [pqWyrA, setPqWyrA] = useState('')
  const [pqWyrB, setPqWyrB] = useState('')
  const [pqTotText, setPqTotText] = useState('')
  const [pqMltText, setPqMltText] = useState('')
  const [pqSubmitting, setPqSubmitting] = useState(false)
  const [pqList, setPqList] = useState<
    {
      id: string
      player_id: string
      question_type: string
      option_a?: string
      option_b?: string
      question_text?: string
    }[]
  >([])
  const [pqOpen, setPqOpen] = useState(false)

  function resetPlayerQuestionsState() {
    setPqWyrA('')
    setPqWyrB('')
    setPqTotText('')
    setPqMltText('')
    setPqSubmitting(false)
    setPqList([])
    setPqOpen(false)
  }

  return {
    pqWyrA,
    pqWyrB,
    pqTotText,
    pqMltText,
    pqSubmitting,
    pqList,
    pqOpen,
    setPqWyrA,
    setPqWyrB,
    setPqTotText,
    setPqMltText,
    setPqOpen,
    setPqList,
    setPqSubmitting,
    resetPlayerQuestionsState,
  }
}

export type PlayerQuestionsState = ReturnType<typeof usePlayerQuestions>
