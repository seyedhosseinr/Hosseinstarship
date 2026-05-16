'use client'

import { useCallback, useState } from 'react'
import Topbar from './cockpit/Topbar'
import CRDTPanel, { type CRDTConflict } from './cockpit/CRDTPanel'
import Sidebar from './cockpit/Sidebar'
import HeroCard from './cockpit/HeroCard'
import StatRow from './cockpit/StatRow'
import FSRSQueue, { type FSRSCard } from './cockpit/FSRSQueue'
import KnowledgeSphere, { type SphereNode } from './cockpit/KnowledgeSphere'
import MCQChart, { type MCQTopic } from './cockpit/MCQChart'
import StudyHeatmap, { type HeatmapDay } from './cockpit/StudyHeatmap'
import ActivityFeed, { type ActivityItem } from './cockpit/ActivityFeed'

/* ── Mock data ────────────────────────────────────────────────────── */

const MOCK_QUERY_EVENTS: number[] = (() => {
  const now = Date.now()
  return [
    now - 540_000, now - 420_000, now - 310_000,
    now - 220_000, now - 180_000, now - 90_000,
    now - 55_000,  now - 30_000,  now - 12_000, now - 3_000,
  ]
})()

const INITIAL_CONFLICTS: CRDTConflict[] = [
  {
    id: '1',
    topic: 'Gleason Grading · کارت',
    field: 'answer',
    localValue: 'Grade 4+4=8',
    remoteValue: 'Grade 4+4=8 ✓',
    autoResolved: false,
  },
  {
    id: '2',
    topic: 'BCG Therapy · یادداشت',
    field: 'note',
    localValue: 'BCG induction 6wk',
    remoteValue: 'BCG induction 6wk + maintenance',
    autoResolved: true,
    resolvedBy: 'LWW',
  },
]

const MOCK_FSRS_CARDS: FSRSCard[] = [
  { id: 'c1', topic: 'Gleason Grading',  chapter: 'فصل ۸۵',  dueLabel: 'سررسید', dueType: 'overdue', yieldScore: 94, yieldDots: 5 },
  { id: 'c2', topic: 'BCG Therapy',      chapter: 'فصل ۱۱۲', dueLabel: '۲ روز',  dueType: 'today',   yieldScore: 81, yieldDots: 4 },
  { id: 'c3', topic: 'TNM Staging',      chapter: 'فصل ۷۸',  dueLabel: '۵ روز',  dueType: 'future',  yieldScore: 67, yieldDots: 3 },
  { id: 'c4', topic: 'TURP Technique',   chapter: 'فصل ۱۰۳', dueLabel: '۱ هفته', dueType: 'future',  yieldScore: 45, yieldDots: 2 },
  { id: 'c5', topic: 'RCC Staging',      chapter: 'فصل ۵۶',  dueLabel: '۲ هفته', dueType: 'future',  yieldScore: 30, yieldDots: 1 },
]

const MOCK_SPHERE_NODES: SphereNode[] = [
  { id: 'n1',  chapter: 'فصل ۸۵ — Gleason',      priorityScore: 90, mastery: 92, connections: ['n2', 'n3'] },
  { id: 'n2',  chapter: 'فصل ۷۸ — TNM',           priorityScore: 75, mastery: 71, connections: ['n1', 'n4'] },
  { id: 'n3',  chapter: 'فصل ۱۱۲ — BCG',          priorityScore: 80, mastery: 48, connections: ['n1', 'n5'] },
  { id: 'n4',  chapter: 'فصل ۱۰۳ — TURP',         priorityScore: 65, mastery: 45, connections: ['n2', 'n6'] },
  { id: 'n5',  chapter: 'فصل ۵۶ — RCC',           priorityScore: 70, mastery: 30, connections: ['n3', 'n7'] },
  { id: 'n6',  chapter: 'فصل ۳۴ — Urolithiasis',  priorityScore: 60, mastery: 88, connections: ['n4', 'n8'] },
  { id: 'n7',  chapter: 'فصل ۲۱ — BPH',           priorityScore: 85, mastery: 0,  connections: ['n5', 'n1'] },
  { id: 'n8',  chapter: 'فصل ۶۷ — Bladder Ca',    priorityScore: 78, mastery: 55, connections: ['n6', 'n2'] },
  { id: 'n9',  chapter: 'فصل ۴۴ — Infertility',   priorityScore: 50, mastery: 0,  connections: ['n8', 'n3'] },
  { id: 'n10', chapter: 'فصل ۹۱ — Trauma',        priorityScore: 45, mastery: 82, connections: ['n9', 'n4'] },
]

const MOCK_MCQ: MCQTopic[] = [
  { chapter: 'فصل ۸۵', accuracyPct: 92 },
  { chapter: 'فصل ۳۴', accuracyPct: 85 },
  { chapter: 'فصل ۷۸', accuracyPct: 71 },
  { chapter: 'فصل ۵۶', accuracyPct: 63 },
  { chapter: 'فصل ۱۱۲', accuracyPct: 48 },
  { chapter: 'فصل ۲۱', accuracyPct: 39 },
]

const MOCK_HEATMAP: HeatmapDay[] = (() => {
  const result: HeatmapDay[] = []
  const today = new Date()
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    // deterministic pseudo-random based on index
    const seed = (i * 7 + 13) % 11
    const count = seed < 3 ? 0 : seed < 6 ? 1 : seed < 8 ? 3 : seed < 10 ? 4 : 6
    result.push({ date: dateStr, count })
  }
  return result
})()

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'a1', timeLabel: '۱۰ دقیقه پیش', action: 'مرور شد',   subject: 'Gleason Grading',  meta: '+12 کارت',  type: 'card' },
  { id: 'a2', timeLabel: '۱ ساعت پیش',   action: 'تکمیل شد', subject: 'MCQ: Prostate',    meta: '۸/۱۰',      type: 'mcq'  },
  { id: 'a3', timeLabel: 'دیروز',         action: 'خوانده شد', subject: 'فصل ۸۵',           meta: '۲۴ دقیقه',  type: 'read' },
  { id: 'a4', timeLabel: '۲ روز پیش',    action: 'مرور شد',   subject: 'BCG Therapy',      meta: '+8 کارت',   type: 'card' },
  { id: 'a5', timeLabel: '۳ روز پیش',    action: 'تکمیل شد', subject: 'MCQ: Bladder Ca',  meta: '۶/۱۰',      type: 'mcq'  },
  { id: 'a6', timeLabel: '۴ روز پیش',    action: 'خوانده شد', subject: 'فصل ۷۸',           meta: '۳۱ دقیقه',  type: 'read' },
]

/* ── Dashboard ────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [activeNav, setActiveNav]   = useState('dashboard')
  const [crdtOpen, setCrdtOpen]     = useState(false)
  const [conflicts, setConflicts]   = useState<CRDTConflict[]>(INITIAL_CONFLICTS)

  const pendingCount = conflicts.filter(c => !c.autoResolved).length

  const handleResolve = useCallback((id: string) => {
    setConflicts(prev => prev.filter(c => c.id !== id))
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--bg-root)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── Topbar ── */}
      <Topbar
        queryEvents={MOCK_QUERY_EVENTS}
        storageUsedMB={12.4}
        storageTotalMB={60}
        pendingCRDT={pendingCount}
        lastSyncedMs={Date.now() - 3 * 60_000}
        isSyncing={false}
        isOffline={false}
        onPendingClick={() => setCrdtOpen(v => !v)}
        onSettingsClick={() => {}}
      />

      {/* ── CRDT Conflict Popover ── */}
      <CRDTPanel
        conflicts={conflicts}
        open={crdtOpen}
        anchorRef={{ current: null }}
        onClose={() => setCrdtOpen(false)}
        onResolve={handleResolve}
      />

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Sidebar — RTL renders on the right */}
        <Sidebar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          storageUsedMB={12.4}
          storageTotalMB={60}
          lastSyncedMs={Date.now() - 3 * 60_000}
          pendingCRDT={pendingCount}
          isHydrating={false}
          fsrsCount={47}
          mcqCount={12}
        />

        {/* Main scroll area */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            paddingBottom: 48,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minWidth: 0,
          }}
        >
          {/* Hero */}
          <HeroCard
            weekCurrent={7}
            weekTotal={20}
            daysUntilBoard={94}
            fsrsCount={47}
            mcqCount={12}
            criticalTopic="Gleason Grading"
            onStartStudy={() => {}}
            onBuildMCQ={() => {}}
          />

          {/* Stats */}
          <StatRow
            fsrsCount={47}
            mcqCount={12}
            accuracyPct={73}
            streakDays={18}
          />

          {/* FSRS Queue + Knowledge Sphere */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}
          >
            <FSRSQueue cards={MOCK_FSRS_CARDS} onStartReview={() => {}} />
            <KnowledgeSphere nodes={MOCK_SPHERE_NODES} />
          </div>

          {/* MCQ Chart + Heatmap + Activity Feed */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 16,
            }}
          >
            <MCQChart topics={MOCK_MCQ} />
            <StudyHeatmap days={MOCK_HEATMAP} />
            <ActivityFeed items={MOCK_ACTIVITY} />
          </div>
        </main>
      </div>
    </div>
  )
}
