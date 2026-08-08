import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { LeaveStatus } from './api'
import { STATUS_META } from './format'

export function StatusBadge({ status }: { status: LeaveStatus }) {
  const meta = STATUS_META[status]
  return <span className={`status-badge tone-${meta.tone}`}>{meta.label}</span>
}

/**
 * Las llamadas reales (emitir / generar y confirmar la licencia) tardan
 * 20-30s. Sin esto, la UI se ve colgada durante ese tramo.
 */
export function ProcessingPanel({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setIndex((current) => (current + 1) % messages.length),
      3200,
    )
    return () => clearInterval(id)
  }, [messages])

  return (
    <div className="processing-panel">
      <span className="spinner-light" />
      <span>{messages[index]}</span>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <motion.div
      className="inline-error"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {message}
    </motion.div>
  )
}
