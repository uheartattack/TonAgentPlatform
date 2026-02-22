export type QueueType = 'critical' | 'normal' | 'low';

export interface QueueJob {
  id: string;
  agent_id: string;
  queue_type: QueueType;
  priority: number;
  data: any;
  created_at: Date;
}