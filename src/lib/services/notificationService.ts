'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  notif_type: 'alert' | 'success' | 'info' | 'warning';
  category: 'compliance' | 'jobs' | 'workforce' | 'system' | 'incidents';
  timestamp_label: string;
  is_read: boolean;
  action_label: string | null;
  company_id: string | null;
  priority: 'low' | 'normal' | 'high' | 'critical';
  source_module: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'success' | 'info' | 'warning';
  category: 'compliance' | 'jobs' | 'workforce' | 'system' | 'incidents';
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  companyId?: string | null;
  priority: 'low' | 'normal' | 'high' | 'critical';
  sourceModule?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id?: string;
  userId: string;
  companyId?: string | null;
  category: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

function rowToNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.notif_type,
    category: row.category,
    timestamp: row.timestamp_label,
    read: row.is_read,
    actionLabel: row.action_label ?? undefined,
    companyId: row.company_id,
    priority: row.priority ?? 'normal',
    sourceModule: row.source_module,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export const notificationService = {
  async getAll(companyId?: string | null): Promise<NotificationRecord[]> {
    const supabase = createClient();
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (companyId) { query = query.eq('company_id', companyId); }
    const { data, error } = await query;
    if (error) {
      logger.error('notificationService', 'Failed to fetch notifications', { companyId, error: error.message });
      return [];
    }
    // Filter out expired notifications client-side
    const now = new Date().toISOString();
    return (data as NotificationRow[])
      .filter((r) => !r.expires_at || r.expires_at > now)
      .map(rowToNotification);
  },

  async getUnreadCount(companyId?: string | null): Promise<number> {
    const supabase = createClient();
    let query = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    if (companyId) { query = query.eq('company_id', companyId); }
    const { count, error } = await query;
    if (error) {
      logger.error('notificationService', 'Failed to fetch unread count', { error: error.message });
      return 0;
    }
    return count ?? 0;
  },

  async markRead(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) {
      logger.error('notificationService', 'Failed to mark notification read', { id, error: error.message });
      return false;
    }
    return true;
  },

  async markAllRead(companyId?: string | null): Promise<boolean> {
    const supabase = createClient();
    let query = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (companyId) { query = query.eq('company_id', companyId); }
    const { error } = await query;
    if (error) {
      logger.error('notificationService', 'Failed to mark all notifications read', { companyId, error: error.message });
      return false;
    }
    return true;
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      logger.error('notificationService', 'Failed to delete notification', { id, error: error.message });
      return false;
    }
    return true;
  },

  async create(notification: {
    title: string;
    message: string;
    type: NotificationRecord['type'];
    category: NotificationRecord['category'];
    companyId?: string | null;
    actionLabel?: string;
    priority?: NotificationRecord['priority'];
    sourceModule?: string;
    expiresAt?: string;
  }): Promise<NotificationRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title: notification.title,
        message: notification.message,
        notif_type: notification.type,
        category: notification.category,
        company_id: notification.companyId ?? null,
        action_label: notification.actionLabel ?? null,
        priority: notification.priority ?? 'normal',
        source_module: notification.sourceModule ?? null,
        expires_at: notification.expiresAt ?? null,
        timestamp_label: 'Just now',
        is_read: false,
      })
      .select()
      .single();
    if (error) {
      logger.error('notificationService', 'Failed to create notification', { title: notification.title, error: error.message });
      return null;
    }
    return rowToNotification(data as NotificationRow);
  },

  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId);
    if (error) {
      logger.error('notificationService', 'Failed to fetch notification preferences', { userId, error: error.message });
      return [];
    }
    return (data as Array<{
      id: string; user_id: string; company_id: string | null;
      category: string; email_enabled: boolean; push_enabled: boolean; in_app_enabled: boolean;
    }>).map((r) => ({
      id: r.id,
      userId: r.user_id,
      companyId: r.company_id,
      category: r.category,
      emailEnabled: r.email_enabled,
      pushEnabled: r.push_enabled,
      inAppEnabled: r.in_app_enabled,
    }));
  },

  async upsertPreference(pref: NotificationPreference): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: pref.userId,
        company_id: pref.companyId ?? null,
        category: pref.category,
        email_enabled: pref.emailEnabled,
        push_enabled: pref.pushEnabled,
        in_app_enabled: pref.inAppEnabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,category' });
    if (error) {
      logger.error('notificationService', 'Failed to upsert notification preference', { category: pref.category, error: error.message });
      return false;
    }
    return true;
  },
};
