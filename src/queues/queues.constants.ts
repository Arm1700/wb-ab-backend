export const QUEUE_NAMES = {
  AbRotate: 'ab_rotate',
  WbReports: 'wb_reports',
  WbFetchMetrics: 'wb_fetch_metrics',
} as const

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]
