"use client";

import { useRouter } from 'next/navigation'

export function QuickActions() {
  const router = useRouter()

  const actions = [
    {
      id: 'top-up',
      label: 'Top-up',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      onClick: () => {
        // TODO: Implement top-up flow (likely using Onramp APIs from CDP)
        console.log('Top-up clicked - to be implemented in Phase 3')
      },
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      id: 'send',
      label: 'Send',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      ),
      onClick: () => router.push('/send'),
      color: 'bg-primary-500 hover:bg-primary-600'
    },
    {
      id: 'receive',
      label: 'Receive',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-4l5 5 5-5m-5-7v12" />
        </svg>
      ),
      onClick: () => router.push('/receive'),
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      onClick: () => router.push('/history'),
      color: 'bg-gray-500 hover:bg-gray-600'
    }
  ]

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`
              ${action.color} text-white rounded-xl p-4 
              transition-all duration-200 transform active:scale-95
              flex flex-col items-center justify-center space-y-2
              shadow-md hover:shadow-lg
            `}
          >
            <div className="p-2 bg-white/20 rounded-lg">
              {action.icon}
            </div>
            <span className="font-medium text-sm">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}