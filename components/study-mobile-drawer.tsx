"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ReactNode } from "react"

interface StudyMobileDrawerProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function StudyMobileDrawer({ isOpen, title, onClose, children }: StudyMobileDrawerProps) {
  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 bg-[#252526] border-t border-[#3e3e42] transform transition-transform duration-300 z-50 ${
        isOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-[#3e3e42]">
        <h3 className="text-sm font-medium text-[#ffffff]">{title}</h3>
        <Button variant="ghost" size="sm" className="w-8 h-8 p-0 hover:bg-[#3e3e42]" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="max-h-[60vh] overflow-auto">{children}</div>
    </div>
  )
}
