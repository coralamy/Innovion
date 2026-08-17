import React from 'react';
import AppLayout from '@/components/AppLayout';
import SchedulingModule from './components/SchedulingModule';

export default function SchedulingPage() {
  return (
    <AppLayout currentPath="/scheduling">
      <SchedulingModule />
    </AppLayout>
  );
}
